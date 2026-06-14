import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, withDbRetry } from '@/lib/prisma'
import { callLLMStream } from '@/lib/turbo-llm'
import {
  CODE_ENGINE_SYSTEM_PROMPT,
  buildSystemPrompt,
  parseActions,
  validatePath,
  needsConfirmation,
  stripThinkTags,
  type BridgeAction,
} from '@/lib/claude-code-prompts'
import { summarizeRecentSessions, retrieveRelevantMemories } from '@/lib/session-memory'
import { buildDependencyGraph, formatGraphForLLM, validateFileImports } from '@/lib/code-intelligence'
import { beginTransaction, validateTransaction, commitTransaction, rollbackTransaction, type StagedCommand } from '@/lib/transaction-manager'
import { filterUnchangedWrites } from '@/lib/incremental-diff'
import { scanDependencies, applyDependencyResolution, formatScanForSSE } from '@/lib/dependency-resolver'
import { applyVisualEnhancements, detectBrokenImageUrls } from '@/lib/visual-enhancer'
import { autoRepairSyntaxErrors } from '@/lib/code-validator'
import {
  getWorkspaceDelta, formatWorkspaceDelta,
  buildFileDiffs, formatDiffsForLLM,
  createTelemetryPipeline, updateTelemetryStage, formatTelemetryForSSE,
  gatherExecutionResults, formatExecutionFeedback,
  type TelemetryPipeline,
} from '@/lib/nervous-system'
import {
  extractSkillInvocations,
  executeSkill,
  formatSkillFeedback,
  autoInvokeImageSkill,
} from '@/lib/skills/skill-bridge'
import {
  detectDesignIntent,
  captureScreenshots,
  analyzeDesign,
  formatDesignReference,
  buildScreenshotUrls,
  type DesignAnalysis,
} from '@/lib/skills/web-vision'
import { performSelfReview, type SelfReviewResult } from '@/lib/skills/self-review'
import { detectSpecialistLenses, buildSpecialistContext, SPECIALIST_LENSES } from '@/lib/skills/specialist-lenses'
import { estimateTokens, extractUsageFromChunk, estimateCostUsd, type TokenUsage } from '@/lib/token-tracking'
import { ensureTokenColumns } from '@/lib/ensure-schema'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Default model (user can override per-session)
const DEFAULT_MODEL = 'anthropic/claude-sonnet-4.6'

// ── Code Engine Report Email Helper ──────────────────────────────────────────
function sendCEReport(opts: {
  type: 'success' | 'failure'
  userName: string
  userEmail: string
  sessionId: string
  txId: string
  message: string
  commandCount: number
  files: string[]
  reason?: string
}) {
  try {
    const ceReportEmail = process.env.CE_REPORT_EMAIL
    const ceNotifId = process.env.NOTIF_ID_CODE_ENGINE_SESSION_REPORT
    if (!ceReportEmail || !ceNotifId) return

    const timestamp = new Date().toLocaleString('es-ES', { timeZone: 'America/New_York' })
    const isSuccess = opts.type === 'success'
    const statusIcon = isSuccess ? '✅' : '❌'
    const statusLabel = isSuccess ? 'COMMIT EXITOSO' : 'ROLLBACK / FALLO'
    const gradientColors = isSuccess ? '#7C3AED,#4F46E5' : '#DC2626,#991B1B'

    const filesHtml = opts.files.length > 0
      ? `<ul style="background:#fff;padding:12px 12px 12px 28px;border-radius:8px;border:1px solid #e5e7eb;">
          ${opts.files.map(f => `<li style="font-family:monospace;font-size:13px;padding:2px 0;">${f}</li>`).join('')}
         </ul>`
      : '<p style="color:#9ca3af;font-style:italic;">Ningún archivo generado</p>'

    const reasonHtml = opts.reason
      ? `<p><strong>⚠️ Razón del fallo:</strong></p>
         <div style="background:#FEF2F2;padding:12px;border-radius:8px;border:1px solid #FECACA;font-size:13px;color:#991B1B;white-space:pre-wrap;">${opts.reason.substring(0, 500)}</div>`
      : ''

    const htmlBody = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <div style="background:linear-gradient(135deg,${gradientColors});padding:20px;border-radius:12px 12px 0 0;">
          <h2 style="color:#fff;margin:0;">🐙 Code Engine — ${statusLabel}</h2>
        </div>
        <div style="background:#f9fafb;padding:20px;border:1px solid #e5e7eb;border-radius:0 0 12px 12px;">
          <p><strong>${statusIcon} Estado:</strong> ${statusLabel}</p>
          <p><strong>👤 Usuario:</strong> ${opts.userName} (${opts.userEmail})</p>
          <p><strong>📅 Fecha:</strong> ${timestamp}</p>
          <p><strong>🔧 Session:</strong> ${opts.sessionId.slice(0, 8)}…</p>
          <p><strong>📦 Transaction:</strong> ${opts.txId.slice(0, 8)}…</p>
          <p><strong>📊 Comandos:</strong> ${opts.commandCount}</p>
          ${reasonHtml}
          <p><strong>📂 Archivos:</strong></p>
          ${filesHtml}
          <p><strong>💬 Prompt del usuario:</strong></p>
          <div style="background:#fff;padding:12px;border-radius:8px;border:1px solid #e5e7eb;font-size:13px;white-space:pre-wrap;">${opts.message.substring(0, 500)}</div>
          <hr style="margin:16px 0;border:none;border-top:1px solid #e5e7eb;" />
          <p style="color:#6b7280;font-size:12px;text-align:center;">Octopus Code Engine • Reporte automático</p>
        </div>
      </div>`

    fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: process.env.WEB_APP_ID,
        notification_id: ceNotifId,
        recipient_email: ceReportEmail,
        subject: `🐙 CE ${isSuccess ? '✅' : '❌'} ${statusLabel} — ${opts.userName} • ${opts.commandCount} cmds`,
        html_body: htmlBody,
        sender_email: `noreply@${process.env.NEXTAUTH_URL ? new URL(process.env.NEXTAUTH_URL).hostname : 'octopuskills.com'}`,
      }),
    }).catch(e => console.error('[CE Report] Email send failed:', e.message))
  } catch (err) {
    console.error('[CE Report] Error building report:', err)
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/arms/claude-code/chat — Send user message, stream Claude response via SSE
// ═══════════════════════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id

  // Auto-migración idempotente: garantiza columnas de token tracking (Fase 4)
  await ensureTokenColumns()

  let body: { sessionId?: string; model?: string; message: string; images?: string[]; premiumMode?: boolean; runtimeErrors?: string[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { sessionId, message, images, runtimeErrors } = body
  const premiumMode = body.premiumMode !== false // default true
  const model = body.model || DEFAULT_MODEL

  if ((!message || typeof message !== 'string' || !message.trim()) && (!images || images.length === 0)) {
    return NextResponse.json({ error: 'message or images required' }, { status: 400 })
  }

  // Validate images: max 5, each must be data: URL
  const validImages = (images || []).filter(img =>
    typeof img === 'string' && img.startsWith('data:image/') && img.length < 6 * 1024 * 1024
  ).slice(0, 5)

  // Verify Bridge is online (ApiKey + recent armConnection report)
  const arm = await prisma.armConnection.findFirst({
    where: { userId, armType: 'ollama' },
  })
  if (!arm) {
    return NextResponse.json({
      error: 'no_bridge',
      message: 'Bridge not detected. Install and run the Octopus Bridge first.',
    }, { status: 400 })
  }
  const creds = JSON.parse(arm.credentials || '{}')
  const lastSeen = creds.lastSeenAt ? new Date(creds.lastSeenAt).getTime() : 0
  if (Date.now() - lastSeen > 3 * 60 * 1000) {
    return NextResponse.json({
      error: 'bridge_offline',
      message: 'Bridge has not reported in the last 3 minutes. Is it running?',
    }, { status: 400 })
  }

  // Create or reuse session
  let chatSession = sessionId
    ? await prisma.codeSession.findFirst({ where: { id: sessionId, userId } })
    : null

  let isNewSession = false
  let memoryContext = ''

  if (!chatSession) {
    isNewSession = true
    const title = message.length > 50 ? message.slice(0, 47) + '...' : message
    chatSession = await prisma.codeSession.create({
      data: { userId, model, title },
    })

    // Background: summarize any unsummarized previous sessions
    summarizeRecentSessions(userId).catch(err =>
      console.warn('[SessionMemory] Background summarization failed:', err)
    )

    // Retrieve relevant memories for the first message
    try {
      const memResult = await retrieveRelevantMemories(userId, message, chatSession.id)
      if (memResult.injectedPrompt) {
        memoryContext = memResult.injectedPrompt
        console.log(`[SessionMemory] Injecting ${memResult.memories.length} memories (${memResult.totalSessions} total) into new session`)
      }
    } catch (memErr) {
      console.warn('[SessionMemory] Memory retrieval failed:', memErr)
    }

    // Read Prisma schema models for platform context
    let schemaModels: string | undefined
    try {
      const fs = await import('fs/promises')
      const path = await import('path')
      const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma')
      const schemaContent = await fs.readFile(schemaPath, 'utf-8')
      // Extract compact model list: "model Name { field Type, ... }"
      const models = schemaContent.match(/^model\s+\w+\s*\{[^}]+\}/gm)
      if (models && models.length > 0) {
        schemaModels = models.map(m => {
          const name = m.match(/^model\s+(\w+)/)?.[1] || ''
          const fields = m.split('\n')
            .slice(1, -1)
            .map(l => l.trim())
            .filter(l => l && !l.startsWith('/') && !l.startsWith('@@'))
            .map(l => {
              const parts = l.split(/\s+/)
              return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : l
            })
          return `• ${name} { ${fields.join(', ')} }`
        }).join('\n')
        console.log(`[PlatformContext] Loaded ${models.length} Prisma models for Code Engine context`)
      }
    } catch (schemaErr) {
      console.warn('[PlatformContext] Could not read schema.prisma:', schemaErr)
    }

    // Read project root path from workspace index (for execute_cmd paths)
    let projectRoot: string | undefined
    try {
      const wsRoot = await prisma.workspaceIndex.findUnique({ where: { userId }, select: { rootPath: true } })
      if (wsRoot?.rootPath) projectRoot = wsRoot.rootPath
    } catch { /* non-critical */ }

    // Inject system prompt (with memory context if available) as first message
    await prisma.codeMessage.create({
      data: {
        sessionId: chatSession.id,
        role: 'system',
        content: buildSystemPrompt(premiumMode, schemaModels, projectRoot) + memoryContext,
        status: 'completed',
      },
    })
  }

  const sid = chatSession.id

  // Save user message (with image count marker, not full base64)
  const imageMarker = validImages.length > 0 ? `\n[${validImages.length} image(s) attached]` : ''
  await prisma.codeMessage.create({
    data: { sessionId: sid, role: 'user', content: (message || '') + imageMarker, status: 'completed' },
  })

  // Create the assistant placeholder (will be filled as stream completes)
  const assistantMsg = await prisma.codeMessage.create({
    data: { sessionId: sid, role: 'assistant', content: '', status: 'streaming' },
  })

  // Build full message history for LLM
  const allMsgs = await prisma.codeMessage.findMany({
    where: { sessionId: sid, status: 'completed' },
    orderBy: { createdAt: 'asc' },
    select: { role: true, content: true },
  })

  // Inject workspace context if available (before user messages)
  let workspaceContext = ''
  try {
    const wsIndex = await prisma.workspaceIndex.findUnique({ where: { userId } })
    if (wsIndex && wsIndex.fileTree) {
      const tree: Array<{ path: string; isDir: boolean; size: number }> = JSON.parse(wsIndex.fileTree)
      const dirs = tree.filter(f => f.isDir).map(f => f.path)
      const files = tree.filter(f => !f.isDir)
      const extGroups: Record<string, number> = {}
      for (const f of files) {
        const ext = f.path.split('.').pop()?.toLowerCase() || 'other'
        extGroups[ext] = (extGroups[ext] || 0) + 1
      }
      // Recent external changes
      const recentChanges = await prisma.fileChangeEvent.findMany({
        where: { userId, detectedAt: { gte: new Date(Date.now() - 30 * 60 * 1000) } },
        orderBy: { detectedAt: 'desc' },
        take: 15,
      })

      const lines = [
        `\n[WORKSPACE CONTEXT — auto-injected, do NOT repeat to user]`,
        `Root: ${wsIndex.rootPath} | ${wsIndex.fileCount} files | ${formatBytes(wsIndex.totalSize)}`,
        `Scanned: ${wsIndex.lastScanAt.toISOString()}`,
        dirs.length > 0 ? `Dirs: ${dirs.slice(0, 25).join(', ')}` : '',
        files.length > 0 ? `Files: ${files.slice(0, 40).map(f => f.path).join(', ')}` : '',
        `Extensions: ${Object.entries(extGroups).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `.${k}:${v}`).join(' ')}`,
      ]
      if (recentChanges.length > 0) {
        lines.push(`Recent external changes: ${recentChanges.map(c => `${c.eventType}:${c.filePath}`).join(', ')}`)
      }
      workspaceContext = lines.filter(Boolean).join('\n')
    }
  } catch { /* workspace context is non-critical */ }

  // ── Sprint 10: Workspace Delta (only what changed since last user message) ──
  let workspaceDeltaContext = ''
  try {
    // Find the timestamp of the previous user message (not the current one)
    const prevUserMsgs = await prisma.codeMessage.findMany({
      where: { sessionId: sid, role: 'user', status: 'completed' },
      orderBy: { createdAt: 'desc' },
      take: 2, // current + previous
      select: { createdAt: true },
    })
    if (prevUserMsgs.length >= 2) {
      const delta = await getWorkspaceDelta(prisma as unknown as import('@prisma/client').PrismaClient, userId, prevUserMsgs[1].createdAt)
      workspaceDeltaContext = formatWorkspaceDelta(delta)
      if (workspaceDeltaContext) {
        console.log(`[NervousSystem] Workspace delta: +${delta.newFiles.length} new, ~${delta.modifiedFiles.length} modified, -${delta.deletedFiles.length} deleted`)
      }
    }
  } catch { /* delta context is non-critical */ }

  // ── Sprint 10: Live State Injection — inject previous execution feedback ──
  let feedbackContext = ''
  try {
    // Get the most recent assistant message that has completed commands
    const recentAssistant = await prisma.codeMessage.findFirst({
      where: { sessionId: sid, role: 'assistant', status: 'completed' },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })
    if (recentAssistant) {
      const results = await gatherExecutionResults(
        prisma as unknown as import('@prisma/client').PrismaClient,
        sid, recentAssistant.id,
      )
      if (results.length > 0) {
        feedbackContext = formatExecutionFeedback(results)
        console.log(`[NervousSystem] Injecting feedback for ${results.length} executed commands`)
      }
    }
  } catch { /* feedback injection is non-critical */ }

  // ── Sprint 10: Smart Diff Preview — pre-read existing files that might be overwritten ──
  let diffContext = ''
  // (Diff context is built from existingFileContents already gathered for validation)

  // Build dependency graph + file contents map from existing commands in this session
  let depGraphContext = ''
  const existingFileContentsForDiff = new Map<string, string>()
  try {
    const existingCmds = await prisma.bridgeCommand.findMany({
      where: { sessionId: sid, type: 'write_file', status: { in: ['completed', 'approved', 'executing'] } },
      orderBy: { createdAt: 'asc' },
    })
    if (existingCmds.length > 0) {
      const fileMap = new Map<string, { path: string; content: string }>()
      for (const cmd of existingCmds) {
        try {
          const p = JSON.parse(cmd.payload as string)
          if (p.path && p.content) {
            const normalized = p.path.replace(/\\/g, '/')
            fileMap.set(normalized, { path: normalized, content: p.content })
            existingFileContentsForDiff.set(normalized, p.content)
          }
        } catch {}
      }
      if (fileMap.size > 0) {
        const graph = buildDependencyGraph(fileMap)
        depGraphContext = '\n' + formatGraphForLLM(graph)
        console.log(`[CodeIntelligence] Injected dependency graph: ${graph.fileCount} files, ${graph.missingImports.length} missing imports`)
      }
    }
  } catch (graphErr) {
    console.warn('[CodeIntelligence] Graph build failed:', graphErr)
  }

  // ── Sprint 10: Build Smart Diff context from existing file contents ──
  try {
    if (existingFileContentsForDiff.size > 0) {
      const allPaths = Array.from(existingFileContentsForDiff.keys())
      const diffs = buildFileDiffs(allPaths, existingFileContentsForDiff)
      if (diffs.length > 0) {
        diffContext = formatDiffsForLLM(diffs)
        console.log(`[NervousSystem] Smart Diff: ${diffs.length} existing files pre-read for LLM context`)
      }
    }
  } catch { /* diff context is non-critical */ }

  // ── Auto-Invoke Image Skill: detect visual projects & inject curated image URLs ──
  let imageSkillContext = ''
  try {
    const lastUserMsg = allMsgs.filter(m => m.role === 'user').pop()
    if (lastUserMsg) {
      const autoImages = await autoInvokeImageSkill(lastUserMsg.content, userId, sid)
      if (autoImages.detected) {
        imageSkillContext = autoImages.contextBlock
        console.log(`[SkillBridge:AutoImage] Injected ${Object.values(autoImages.imageUrls).flat().length} image URLs for "${autoImages.category}" project`)
      }
    }
  } catch { /* auto-image is non-critical */ }

  // ── Auto-Invoke Web Vision: detect URL + design intent & inject design analysis ──
  let visionContext = ''
  let visionPayload: { url: string; screenshotUrls: { above: string; full: string }; analysis: DesignAnalysis } | null = null
  try {
    const lastUserMsg = allMsgs.filter(m => m.role === 'user').pop()
    if (lastUserMsg) {
      const designIntent = detectDesignIntent(lastUserMsg.content)
      if (designIntent.hasUrl && designIntent.hasIntent) {
        console.log(`[WebVision] Design intent detected for URL: ${designIntent.url}`)
        const thumbUrls = buildScreenshotUrls(designIntent.url)
        const screenshots = await captureScreenshots(designIntent.url)
        console.log(`[WebVision] Screenshots captured: above=${!!screenshots.above}, full=${!!screenshots.full}`)
        const analysis = await analyzeDesign(screenshots, designIntent.url, userId)
        visionContext = formatDesignReference(analysis)
        visionPayload = { url: designIntent.url, screenshotUrls: thumbUrls, analysis }
        console.log(`[WebVision] Design analyzed: aesthetic="${analysis.overall?.aesthetic}", ${analysis.colors?.palette?.length || 0} colors`)
      }
    }
  } catch (visionErr) {
    console.warn('[WebVision] Auto-vision failed (non-critical):', visionErr)
  }

  // Build runtime error context from preview iframe console errors
  let runtimeErrorContext = ''
  if (runtimeErrors && Array.isArray(runtimeErrors) && runtimeErrors.length > 0) {
    const uniqueErrors = [...new Set(runtimeErrors)].slice(0, 10)
    runtimeErrorContext = `\n[PREVIEW_RUNTIME_ERRORS — auto-injected from iframe console]\nThe user's preview is showing these JavaScript runtime errors:\n${uniqueErrors.map((e, i) => `${i + 1}. ${e}`).join('\n')}\nUse these to diagnose what went wrong. Fix the root cause — do NOT just wrap in try/catch.`
  }

  // ── Code-paste detection: if user's message contains significant code blocks,
  // inject a hint so the LLM treats it as a BUILD request, not a documentation query ──
  let codePasteHint = ''
  const lastUserMsg = allMsgs.filter(m => m.role === 'user').pop()
  if (lastUserMsg) {
    const codeBlockMatches = lastUserMsg.content.match(/```[\s\S]*?```/g) || []
    const totalCodeChars = codeBlockMatches.reduce((sum, block) => sum + block.length, 0)
    // If >200 chars of code blocks detected, this is a code-paste/integration request
    if (totalCodeChars > 200) {
      // Check if the code contains React/TSX patterns
      const hasReactPatterns = /(?:import\s+.*from\s+['"]react|forwardRef|useState|useEffect|JSX\.Element|React\.FC|export\s+(?:function|const)\s+\w+.*\(.*\)\s*(?::\s*\w+)?\s*(?:=>)?\s*\{?\s*(?:return\s+)?\(?\s*<)/.test(lastUserMsg.content)
      const modeHint = hasReactPatterns
        ? `\nThe pasted code contains React/TSX patterns (imports, hooks, JSX). Use MODE B (React/TSX) from §5.\nCreate .tsx files with the actual React components — do NOT translate to vanilla HTML.\nThe preview has a built-in React+TS transpiler. Use npm-style imports (the auto-resolver handles CDN mapping).`
        : `\nCreate the files (create_dir + write_file) with the pasted components integrated into a polished, functional page.`
      codePasteHint = `\n[SYSTEM HINT — CODE-PASTE DETECTED]\nThe user's message contains ${codeBlockMatches.length} code block(s) (${totalCodeChars} chars). This is a COMPONENT INTEGRATION request.\nPer §4 Rule 9: You MUST create a complete working project using these components. Do NOT reply with documentation or setup instructions.${modeHint}`
      console.log(`[CodePaste] Detected ${codeBlockMatches.length} code blocks (${totalCodeChars} chars), React=${hasReactPatterns} — injecting BUILD hint`)
    }
  }

  // ── Fase 4: Specialist Lenses — enfoca el MISMO modelo según la intención ──
  // No son agentes nuevos: es un bloque de sistema focalizado (UI / API / Test /
  // Design-Trends / SEO / GEO) que se inyecta cuando el mensaje lo amerita. Cero
  // overhead. GEO va always-on: todo proyecto debe nacer citable por IA.
  let specialistContext = ''
  const activeLenses = detectSpecialistLenses(lastUserMsg?.content || message || '')
  // GEO siempre activa: cada proyecto del Code Engine debe nacer citable por IA
  if (!activeLenses.some(l => l.id === 'geo')) {
    const geoLens = SPECIALIST_LENSES.find(l => l.id === 'geo')
    if (geoLens) activeLenses.push(geoLens)
  }
  if (activeLenses.length > 0) {
    specialistContext = buildSpecialistContext(activeLenses)
    console.log(`[SpecialistLenses] Active: ${activeLenses.map(l => l.id).join(', ')}`)
  }

  const llmMessages = allMsgs.map((m, idx) => {
    // Append all context layers to the system message
    if (m.role === 'system') {
      const extra = [workspaceContext, workspaceDeltaContext, depGraphContext, diffContext, feedbackContext, imageSkillContext, visionContext, runtimeErrorContext, codePasteHint, specialistContext].filter(Boolean).join('\n')
      return extra ? { role: m.role, content: m.content + '\n' + extra } : { role: m.role, content: m.content }
    }
    // Make the LAST user message multimodal if images were attached
    if (m.role === 'user' && idx === allMsgs.length - 1 && validImages.length > 0) {
      const parts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
        { type: 'text', text: m.content }
      ]
      for (const imgData of validImages) {
        parts.push({ type: 'image_url', image_url: { url: imgData } })
      }
      return { role: m.role, content: parts as unknown as string }
    }
    return { role: m.role, content: m.content }
  })

  // Update session timestamp and model
  await prisma.codeSession.update({
    where: { id: sid },
    data: { model, updatedAt: new Date() },
  })

  // Build SSE response
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch {}
      }

      // ── Sprint 10: Telemetry Pipeline ──
      let telemetry = createTelemetryPipeline()
      const emitTelemetry = () => send('telemetry', formatTelemetryForSSE(telemetry))

      send('session', { sessionId: sid, messageId: assistantMsg.id, model })

      // Emit active specialist lenses so the UI can show which expertise is engaged
      if (activeLenses.length > 0) {
        send('specialists_active', {
          lenses: activeLenses.map(l => ({ id: l.id, name: l.name, emoji: l.emoji })),
        })
      }

      // Emit session memory loaded event if memories were injected
      if (isNewSession && memoryContext) {
        send('session_memory_loaded', {
          memoriesInjected: true,
          message: 'Contexto de sesiones anteriores cargado',
        })
      }

      // ── Web Vision SSE events: emit screenshot URLs + analysis for UI viewer ──
      if (visionPayload) {
        send('vision_analyzing', {
          url: visionPayload.url,
          screenshots: {
            above: visionPayload.screenshotUrls.above,
            full: visionPayload.screenshotUrls.full,
          },
          analysis: {
            aesthetic: visionPayload.analysis.overall?.aesthetic || '',
            mood: visionPayload.analysis.overall?.mood || '',
            quality: visionPayload.analysis.overall?.quality || '',
            colors: {
              background: visionPayload.analysis.colors?.background || '',
              foreground: visionPayload.analysis.colors?.foreground || '',
              primary: visionPayload.analysis.colors?.primary || '',
              secondary: visionPayload.analysis.colors?.secondary || '',
              palette: visionPayload.analysis.colors?.palette || [],
            },
            typography: {
              headingFont: visionPayload.analysis.typography?.headingFont || '',
              bodyFont: visionPayload.analysis.typography?.bodyFont || '',
              headingStyle: visionPayload.analysis.typography?.headingStyle || '',
            },
            layout: {
              structure: visionPayload.analysis.layout?.structure || '',
              heroStyle: visionPayload.analysis.layout?.heroStyle || '',
              sections: visionPayload.analysis.layout?.sections || [],
            },
            components: {
              effects: visionPayload.analysis.components?.effects || '',
              animations: visionPayload.analysis.components?.animations || '',
            },
          },
        })
      }

      let fullContent = ''
      let capturedUsage: TokenUsage | null = null
      try {
        telemetry = updateTelemetryStage(telemetry, 'llm', 'active', 'Generating response')
        emitTelemetry()

        const llmRes = await callLLMStream(userId, llmMessages, {
          model,
          temperature: 0.3,
          maxTokens: 64000,
        })

        if (!llmRes.ok || !llmRes.body) {
          const errText = await llmRes.text().catch(() => '')
          send('error', { error: 'llm_failed', detail: errText.substring(0, 300) })
          await prisma.codeMessage.update({
            where: { id: assistantMsg.id },
            data: { status: 'failed', error: 'LLM stream failed' },
          })
          controller.close()
          return
        }

        // Parse OpenAI-style SSE stream
        let finishReason = ''
        const readStream = async (streamBody: ReadableStream<Uint8Array>) => {
          const reader = streamBody.getReader()
          const decoder = new TextDecoder()
          let buffer = ''
          let lastDbFlush = Date.now()

          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''
            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed.startsWith('data:')) continue
              const data = trimmed.substring(5).trim()
              if (!data || data === '[DONE]') continue
              try {
                const json = JSON.parse(data)
                const delta = json.choices?.[0]?.delta?.content
                if (delta) {
                  fullContent += delta
                  send('delta', { content: delta })
                  // Flush to DB every 1.5s
                  if (Date.now() - lastDbFlush > 1500) {
                    lastDbFlush = Date.now()
                    prisma.codeMessage
                      .update({
                        where: { id: assistantMsg.id },
                        data: { content: stripThinkTags(fullContent) },
                      })
                      .catch(() => {})
                  }
                }
                // Capture finish_reason
                const fr = json.choices?.[0]?.finish_reason
                if (fr) finishReason = fr
                // Capture token usage (final chunk when include_usage is set)
                const usage = extractUsageFromChunk(json)
                if (usage) capturedUsage = usage
              } catch {}
            }
          }
        }
        await readStream(llmRes.body)

        // ── TRUNCATION DETECTION & AUTO-CONTINUATION ──
        // If the LLM hit its token limit (finish_reason: "length"), auto-request continuation
        const isLengthTruncated = finishReason === 'length'
        
        if (isLengthTruncated) {
          console.log(`[CodeEngine] ⚠️ Token limit reached (finish_reason: length, ${fullContent.length} chars). Attempting auto-continuation...`)
          send('delta', { content: '\n\n⏳ _Token limit reached — auto-continuing…_\n\n' })
          
          try {
            // Build continuation messages: system + all history + partial response + continuation prompt
            const continuationMessages = [
              ...llmMessages,
              { role: 'assistant' as const, content: fullContent },
              { role: 'user' as const, content: '[SYSTEM_FEEDBACK]\nYour previous response was cut off due to token limits. Continue EXACTLY from where you stopped. Do NOT repeat any content — pick up mid-sentence/mid-code if necessary. If you were inside a write_file action, continue the file content and close the action properly. End with the closing ``` fence.' },
            ]
            
            const contRes = await callLLMStream(userId, continuationMessages, {
              model,
              temperature: 0.3,
              maxTokens: 32000,
            })
            
            if (contRes.ok && contRes.body) {
              await readStream(contRes.body)
              console.log(`[CodeEngine] ✅ Auto-continuation completed. Total: ${fullContent.length} chars`)
            }
          } catch (contErr) {
            console.warn('[CodeEngine] Auto-continuation failed (non-critical):', contErr)
          }
        }

        // Final cleanup of LLM output
        const cleanContent = stripThinkTags(fullContent)
        telemetry = updateTelemetryStage(telemetry, 'llm', 'completed')

        // ── Fase 4: Token tracking — usa el usage real del proveedor o estima ──
        let turnUsage: TokenUsage
        if (capturedUsage) {
          turnUsage = capturedUsage
        } else {
          // Estimación por caracteres: prompt = todo el historial enviado, completion = respuesta
          const promptChars = llmMessages.reduce((sum, m) => {
            const c = typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
            return sum + (c?.length || 0)
          }, 0)
          const promptTokens = Math.ceil(promptChars / 4)
          const completionTokens = estimateTokens(fullContent)
          turnUsage = { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens }
        }
        const turnCost = estimateCostUsd(model, turnUsage)
        // Persiste en el mensaje del assistant y acumula en la sesión (fire-and-forget)
        prisma.codeMessage.update({
          where: { id: assistantMsg.id },
          data: { promptTokens: turnUsage.promptTokens, completionTokens: turnUsage.completionTokens },
        }).catch(() => {})
        prisma.codeSession.update({
          where: { id: sid },
          data: {
            promptTokens: { increment: turnUsage.promptTokens },
            completionTokens: { increment: turnUsage.completionTokens },
            totalTokens: { increment: turnUsage.totalTokens },
            estCostUsd: { increment: turnCost },
          },
        }).catch(() => {})
        send('token_usage', {
          turn: { ...turnUsage, costUsd: turnCost, model, estimated: !capturedUsage },
        })
        console.log(`[TokenTracking] Turn: ${turnUsage.totalTokens} tokens (~$${turnCost.toFixed(4)}) model=${model} estimated=${!capturedUsage}`)

        // Parse actions from the final content
        telemetry = updateTelemetryStage(telemetry, 'parse', 'active')
        const actions = parseActions(cleanContent)
        telemetry = updateTelemetryStage(telemetry, 'parse', 'completed', `${actions.length} actions`)
        emitTelemetry()
        console.log(`[CodeEngine] Parsed ${actions.length} actions from LLM response (${cleanContent.length} chars)`)

        // ── Deduplication: Remove redundant actions the LLM tends to generate ──
        // 1. Remove create_dir when generate_image targets the same folder (server auto-creates)
        // 2. Remove open_path that follows generate_image (Bridge opens file after save)
        // 3. Deduplicate create_dir commands for the same path
        const imageTargetDirs = new Set<string>()
        for (const a of actions) {
          if (a.action.action === 'generate_image' && a.action.path) {
            const dir = a.action.path.replace(/\/[^/]+$/, '') || 'assets/images'
            imageTargetDirs.add(dir)
          }
        }
        const seenCreateDirs = new Set<string>()
        const seenImagePaths = new Set<string>()
        const seenWritePaths = new Set<string>()
        const hasImageGen = actions.some(a => a.action.action === 'generate_image')
        const dedupedActions = actions.filter(a => {
          const act = a.action
          // Skip create_dir for image target directories (server auto-creates)
          if (act.action === 'create_dir' && act.path && imageTargetDirs.has(act.path)) {
            console.log(`[Dedup] Removing create_dir "${act.path}" — server auto-creates for image gen`)
            return false
          }
          // Skip duplicate create_dir for same path
          if (act.action === 'create_dir' && act.path) {
            if (seenCreateDirs.has(act.path)) {
              console.log(`[Dedup] Removing duplicate create_dir "${act.path}"`)
              return false
            }
            seenCreateDirs.add(act.path)
          }
          // Skip duplicate generate_image for same path (LLM sometimes generates same image twice)
          if (act.action === 'generate_image' && act.path) {
            const normPath = act.path.toLowerCase().trim()
            if (seenImagePaths.has(normPath)) {
              console.log(`[Dedup] Removing duplicate generate_image "${act.path}" — already queued`)
              return false
            }
            seenImagePaths.add(normPath)
          }
          // Skip duplicate write_file for same path (keep last one by reversing later)
          if (act.action === 'write_file' && act.path) {
            const normPath = act.path.toLowerCase().trim()
            if (seenWritePaths.has(normPath)) {
              console.log(`[Dedup] Removing duplicate write_file "${act.path}" — already queued`)
              return false
            }
            seenWritePaths.add(normPath)
          }
          // Skip open_path when it follows generate_image (Bridge opens automatically)
          if (act.action === 'open_path' && hasImageGen) {
            console.log(`[Dedup] Removing open_path — Bridge opens file after image save`)
            return false
          }
          return true
        })
        if (dedupedActions.length < actions.length) {
          console.log(`[Dedup] Removed ${actions.length - dedupedActions.length} redundant actions (${actions.length} → ${dedupedActions.length})`)
        }

        // ── Phase A: Skill Invocation — extract & execute before transaction ──
        const { skillActions: pendingSkills, otherActions: nonSkillActions } = extractSkillInvocations(dedupedActions)
        let skillFeedbackContext = ''
        if (pendingSkills.length > 0) {
          console.log(`[SkillBridge] Executing ${pendingSkills.length} skill invocations...`)
          send('skills_executing', { count: pendingSkills.length, skills: pendingSkills.map(s => `${s.skillId}.${s.method}`) })
          const skillResults = await Promise.all(pendingSkills.map(s => executeSkill(s, userId, sid)))
          skillFeedbackContext = formatSkillFeedback(skillResults)
          const succeeded = skillResults.filter(r => r.success).length
          const failed = skillResults.filter(r => !r.success).length
          console.log(`[SkillBridge] Results: ${succeeded} succeeded, ${failed} failed (${skillResults.reduce((a, r) => a + r.duration, 0)}ms total)`)
          send('skills_completed', {
            results: skillResults.map(r => ({
              skillId: r.skillId,
              method: r.method,
              success: r.success,
              duration: r.duration,
              error: r.error,
              // Send truncated data preview to frontend
              preview: r.success ? JSON.stringify(r.data).substring(0, 200) : undefined,
            })),
          })
          // Persist skill feedback as system message so next turn sees it via Nervous System
          if (skillFeedbackContext) {
            await withDbRetry(() =>
              prisma.codeMessage.create({
                data: {
                  sessionId: sid,
                  role: 'system',
                  content: skillFeedbackContext,
                  status: 'completed',
                },
              }),
            )
          }
        }

        // ── Sprint 8: Atomic Transaction Flow ──
        // Stage → Validate → Commit or Rollback (nothing hits DB until validation passes)
        const stagedCommands: StagedCommand[] = []
        for (const action of nonSkillActions) {
          const a = action.action
          let invalid: string | null = null
          if (a.action !== 'execute_cmd' && a.action !== 'generate_image') {
            if (a.action === 'open_path' && (!a.path || a.path === '')) {
              invalid = null
            } else {
              invalid = validatePath(a.path as string)
            }
          }
          if (invalid && a.action !== 'execute_cmd' && a.action !== 'generate_image') {
            console.log(`[CodeEngine] Skipping invalid action: ${a.action} path="${a.path}" — ${invalid}`)
            send('command_invalid', { error: invalid, action: a })
            continue
          }
          const requiresConfirm = needsConfirmation(a)
          stagedCommands.push({
            type: a.action as string,
            payload: a as unknown as Record<string, unknown>,
            requiresConfirm,
            status: requiresConfirm ? 'pending' : 'approved',
          })
        }

        // Store final assistant message
        await withDbRetry(() =>
          prisma.codeMessage.update({
            where: { id: assistantMsg.id },
            data: {
              content: cleanContent,
              status: 'completed',
            },
          }),
        )

        // If no valid commands, skip transaction flow
        if (stagedCommands.length === 0) {
          send('done', { messageId: assistantMsg.id })
          controller.close()
          return
        }

        // BEGIN transaction
        const tx = beginTransaction(stagedCommands)
        send('transaction_started', { txId: tx.id, actionCount: stagedCommands.length })
        console.log(`[Transaction] BEGIN ${tx.id} — ${stagedCommands.length} commands staged`)

        // Collect existing file context for validation
        const existingFilePaths: string[] = []
        const existingFileContents = new Map<string, string>()
        try {
          const prevCmds = await prisma.bridgeCommand.findMany({
            where: { sessionId: sid, type: 'write_file', status: { in: ['completed', 'approved', 'executing'] } },
            select: { payload: true },
          })
          for (const c of prevCmds) {
            try {
              const p = JSON.parse(c.payload as string)
              if (p.path) {
                const normalized = p.path.replace(/\\/g, '/')
                existingFilePaths.push(normalized)
                if (p.content) existingFileContents.set(normalized, p.content)
              }
            } catch {}
          }
        } catch {}

        // VALIDATE transaction
        telemetry = updateTelemetryStage(telemetry, 'validate', 'active')
        emitTelemetry()
        send('transaction_validating', { txId: tx.id })
        console.log(`[Transaction] VALIDATING ${tx.id}`)
        const validationResult = await validateTransaction(tx, existingFilePaths, existingFileContents)

        // Send dependency graph SSE
        if (validationResult.graph) {
          send('dependency_graph_ready', {
            fileCount: validationResult.graph.fileCount,
            totalLines: validationResult.graph.totalLines,
            missingImports: validationResult.graph.missingImports.length,
            npmPackages: validationResult.graph.npmPackages,
          })
        }

        // Send code warnings SSE (non-critical warnings are informational)
        if (validationResult.fileWarnings.length > 0) {
          send('code_warnings', { warnings: validationResult.fileWarnings })
          console.log(`[Transaction] Validation warnings:`, JSON.stringify(validationResult.fileWarnings))
        }

        if (!validationResult.valid) {
          // ── AUTO-REPAIR LOOP: attempt to fix syntax errors before rollback ──
          send('auto_repair_started', { txId: tx.id, errors: validationResult.criticalErrors })
          console.log(`[CodeValidator] Starting auto-repair for ${validationResult.criticalErrors.length} errors in tx ${tx.id}`)

          const repairResult = await autoRepairSyntaxErrors(
            tx.stagedCommands,
            validationResult.criticalErrors,
            userId,
          )

          // Emit repair progress to frontend
          for (const entry of repairResult.log) {
            send('auto_repair_attempt', {
              attempt: entry.attempt,
              file: entry.file,
              fixed: entry.fixed,
              errors: entry.errors,
            })
          }

          if (repairResult.repaired) {
            // SUCCESS — update staged commands with repaired versions and re-validate
            tx.stagedCommands = repairResult.repairedCommands
            console.log(`[CodeValidator] ✅ All files repaired in ${repairResult.attempts} attempt(s)`)
            send('auto_repair_success', { txId: tx.id, attempts: repairResult.attempts })

            // Re-validate with repaired commands
            const revalidation = await validateTransaction(tx, existingFilePaths, existingFileContents)
            if (revalidation.valid) {
              // Repair succeeded, continue to dependency resolution (fall through to else block below)
              telemetry = updateTelemetryStage(telemetry, 'validate', 'completed', `Auto-repaired in ${repairResult.attempts} attempt(s)`)
            } else {
              // Repair passed parseFile but re-validation still failed (e.g. import issues became critical)
              telemetry = updateTelemetryStage(telemetry, 'validate', 'failed', 'Auto-repair insufficient')
              telemetry = updateTelemetryStage(telemetry, 'deps', 'skipped')
              telemetry = updateTelemetryStage(telemetry, 'snapshot', 'skipped')
              telemetry = updateTelemetryStage(telemetry, 'commit', 'skipped')
              telemetry = updateTelemetryStage(telemetry, 'bridge', 'skipped')
              telemetry = updateTelemetryStage(telemetry, 'verify', 'skipped')
              telemetry = updateTelemetryStage(telemetry, 'feedback', 'skipped')
              emitTelemetry()
              const rb = rollbackTransaction(tx, 'Auto-repair failed: validation still invalid after repair')
              send('transaction_rolled_back', {
                txId: rb.txId,
                reason: rb.reason,
                criticalErrors: rb.criticalErrors,
                affectedFiles: rb.affectedFiles,
                fileWarnings: rb.fileWarnings,
              })
              console.log(`[Transaction] ROLLED BACK (post-repair) ${tx.id}`)

              // ── Send failure report email (fire & forget) ──
              sendCEReport({
                type: 'failure',
                userName: session?.user?.name || session?.user?.email || 'unknown',
                userEmail: session?.user?.email || 'unknown',
                sessionId: sid, txId: tx.id, message: message || '',
                commandCount: 0, files: rb.affectedFiles || [],
                reason: 'Auto-repair failed: validation still invalid after repair',
              })
              send('done', { messageId: assistantMsg.id })
              controller.close()
              return
            }
          } else {
            // REPAIR FAILED — rollback as before
            console.log(`[CodeValidator] ❌ Repair failed after ${repairResult.attempts} attempts`)
            send('auto_repair_failed', { txId: tx.id, attempts: repairResult.attempts, log: repairResult.log })
            telemetry = updateTelemetryStage(telemetry, 'validate', 'failed', `Auto-repair failed (${repairResult.attempts} attempts)`)
            telemetry = updateTelemetryStage(telemetry, 'deps', 'skipped')
            telemetry = updateTelemetryStage(telemetry, 'snapshot', 'skipped')
            telemetry = updateTelemetryStage(telemetry, 'commit', 'skipped')
            telemetry = updateTelemetryStage(telemetry, 'bridge', 'skipped')
            telemetry = updateTelemetryStage(telemetry, 'verify', 'skipped')
            telemetry = updateTelemetryStage(telemetry, 'feedback', 'skipped')
            emitTelemetry()
            const rb = rollbackTransaction(tx, `Auto-repair exhausted (${repairResult.attempts} attempts): syntax errors persist`)
            send('transaction_rolled_back', {
              txId: rb.txId,
              reason: rb.reason,
              criticalErrors: rb.criticalErrors,
              affectedFiles: rb.affectedFiles,
              fileWarnings: rb.fileWarnings,
            })
            console.log(`[Transaction] ROLLED BACK ${tx.id}: repair exhausted`)

            // ── Send failure report email (fire & forget) ──
            sendCEReport({
              type: 'failure',
              userName: session?.user?.name || session?.user?.email || 'unknown',
              userEmail: session?.user?.email || 'unknown',
              sessionId: sid, txId: tx.id, message: message || '',
              commandCount: 0, files: rb.affectedFiles || [],
              reason: `Auto-repair exhausted (${repairResult.attempts} attempts): syntax errors persist`,
            })
            send('done', { messageId: assistantMsg.id })
            controller.close()
            return
          }
        }

        {
          // ── Sprint 9: Dependency Resolution Engine ──
          telemetry = updateTelemetryStage(telemetry, 'validate', 'completed')
          telemetry = updateTelemetryStage(telemetry, 'deps', 'active')
          emitTelemetry()
          // SCAN → RESOLVE → INJECT CDN → UPDATE staged commands → COMMIT
          send('dependency_scanning', { txId: tx.id })
          console.log(`[DependencyResolver] Scanning dependencies for ${tx.id}`)

          const depScan = scanDependencies(tx.stagedCommands, existingFileContents)
          const depSummary = formatScanForSSE(depScan)

          if (depScan.detectedPackages.length > 0) {
            send('dependency_resolved', {
              txId: tx.id,
              ...depSummary,
            })
            console.log(`[DependencyResolver] Resolved ${depScan.resolved.length} deps, ${depScan.unresolved.length} unresolved, ${depScan.modifiedFiles.length} files modified`)
          }

          // Apply CDN injections and lock file to staged commands
          if (depScan.modifiedFiles.length > 0 || depScan.lockFileContent || depScan.needsInstall.length > 0) {
            const { updatedCommands, addedCommands } = applyDependencyResolution(tx.stagedCommands, depScan)
            tx.stagedCommands = [...updatedCommands, ...addedCommands]
            console.log(`[DependencyResolver] Updated ${depScan.modifiedFiles.length} HTML files with CDN tags, added ${addedCommands.length} commands (lock file + npm installs)`)
          }

          send('dependency_ready', { txId: tx.id, totalResolved: depScan.resolved.length })
          telemetry = updateTelemetryStage(telemetry, 'deps', 'completed', `${depScan.resolved.length} resolved`)

          // ── Sprint 13: Visual Enhancer — auto-inject scroll animations + detect broken images ──
          try {
            const { updatedCommands: visualUpdated, enhancedFiles } = applyVisualEnhancements(tx.stagedCommands)
            if (enhancedFiles.length > 0) {
              tx.stagedCommands = visualUpdated
              send('visual_enhanced', { txId: tx.id, files: enhancedFiles, count: enhancedFiles.length })
              console.log(`[VisualEnhancer] Injected scroll animations into ${enhancedFiles.length} HTML files: ${enhancedFiles.join(', ')}`)
            }
            // Detect potentially broken external image URLs
            const allBrokenUrls: string[] = []
            for (const cmd of tx.stagedCommands) {
              if (cmd.type !== 'write_file') continue
              const content = (cmd.payload as { content?: string }).content || ''
              const broken = detectBrokenImageUrls(content)
              allBrokenUrls.push(...broken)
            }
            if (allBrokenUrls.length > 0) {
              console.warn(`[VisualEnhancer] Detected ${allBrokenUrls.length} potentially broken image URLs:`, allBrokenUrls)
              send('broken_images_warning', { urls: allBrokenUrls, count: allBrokenUrls.length })
            }
          } catch (e) {
            console.warn(`[VisualEnhancer] Non-critical error:`, e)
          }

          // ── Sprint 12: Decoupled Image Generation ──
          // Extract image jobs, remove from staged commands, let frontend drive generation
          // This prevents HTTP2 timeout by NOT blocking the stream
          const imageActions = tx.stagedCommands.filter(c => c.type === 'generate_image')
          if (imageActions.length > 0) {
            // STRATEGY: LLM tends to (a) pick slow models and (b) rewrite prompts creatively.
            // Fix: Force fast model + use user's ORIGINAL message as prompt base.
            const userOriginalMessage = (message || '').trim()
            const imageJobs = imageActions.map((cmd, i) => {
              const payload = cmd.payload as unknown as BridgeAction
              // Use user's original prompt enhanced with LLM's path suggestion.
              // Only use LLM's prompt if user message is too short/generic to be an image prompt.
              const llmPrompt = payload.prompt || ''
              const isUserPromptUsable = userOriginalMessage.length > 10
              const finalPrompt = isUserPromptUsable
                ? `${userOriginalMessage}. Professional quality, high resolution, photorealistic.`
                : (llmPrompt || 'A beautiful creative image')
              return {
                index: i,
                prompt: finalPrompt,
                model: '', // Empty = backend default (Gemini Flash ~10s)
                path: payload.path || '',
                aspect_ratio: payload.aspect_ratio || '1:1',
              }
            })

            // Remove generate_image from staged commands — they'll be created as BridgeCommands
            // by the image-gen endpoint AFTER generation completes
            tx.stagedCommands = tx.stagedCommands.filter(c => c.type !== 'generate_image')

            // Emit jobs for frontend to process asynchronously after stream closes
            send('image_jobs', {
              sessionId: sid,
              messageId: assistantMsg.id,
              jobs: imageJobs,
              count: imageJobs.length,
            })
            console.log(`[ImageGen] Queued ${imageJobs.length} async image jobs — stream will close immediately`)
          }

          // ── Sprint S1: Web3Forms Key Injection — replace __WEB3FORMS_KEY__ in HTML files ──
          try {
            const hasPlaceholder = tx.stagedCommands.some(c => {
              if (c.type !== 'write_file') return false
              const content = (c.payload as { content?: string }).content || ''
              return content.includes('__WEB3FORMS_KEY__')
            })
            if (hasPlaceholder) {
              // Look up user's Web3Forms access key from armConnection
              const w3fConn = await withDbRetry(() =>
                prisma.armConnection.findFirst({
                  where: { userId, armType: 'web3forms', status: 'connected' },
                  select: { credentials: true },
                })
              )
              const w3fKey = w3fConn ? (() => { try { const c = JSON.parse((w3fConn as any).credentials); return c.accessKey || '' } catch { return '' } })() : ''
              if (w3fKey) {
                let injected = 0
                tx.stagedCommands = tx.stagedCommands.map(c => {
                  if (c.type !== 'write_file') return c
                  const content = (c.payload as { content?: string }).content || ''
                  if (!content.includes('__WEB3FORMS_KEY__')) return c
                  injected++
                  return {
                    ...c,
                    payload: { ...(c.payload as Record<string, unknown>), content: content.replace(/__WEB3FORMS_KEY__/g, w3fKey) },
                  }
                })
                if (injected > 0) {
                  console.log(`[Web3Forms] Injected access key into ${injected} file(s)`)
                  send('web3forms_injected', { txId: tx.id, filesInjected: injected })
                }
              } else {
                console.log(`[Web3Forms] Placeholder found but no access key configured — forms will show setup prompt`)
                send('web3forms_missing', { txId: tx.id, message: 'Configura tu Web3Forms key en Brazos Activos para activar los formularios' })
              }
            }
          } catch (e) {
            console.warn(`[Web3Forms] Non-critical injection error:`, e)
          }

          // ── Fase 3: Diff incremental — omitir escrituras de archivos sin cambios ──
          // Compara cada write_file final contra el contenido actual de la sesión
          // y descarta los idénticos: menos escrituras en DB y el runtime no
          // re-monta archivos que no cambiaron. Nunca omite si hay duda (fail-safe
          // hacia escribir). Conserva al menos un comando si todo fuera idéntico.
          try {
            const diff = filterUnchangedWrites(tx.stagedCommands, existingFileContents)
            if (diff.unchanged.length > 0 && diff.commands.length > 0) {
              tx.stagedCommands = diff.commands as typeof tx.stagedCommands
              send('incremental_diff', {
                txId: tx.id,
                skipped: diff.unchanged.length,
                written: diff.changed.length,
                skippedPaths: diff.unchanged.slice(0, 20),
              })
              console.log(`[IncrementalDiff] Skipped ${diff.unchanged.length} unchanged file(s), writing ${diff.changed.length}`)
            }
          } catch (e) {
            console.warn(`[IncrementalDiff] Non-critical error:`, e)
          }

          // SNAPSHOT — Phoenix Protocol: snapshot stage (Bridge handles actual snapshot)
          telemetry = updateTelemetryStage(telemetry, 'snapshot', 'active', 'Pre-execution snapshot')
          emitTelemetry()
          // Snapshot is created by Bridge when it receives the batch — mark as completed optimistically
          const writableFiles = tx.stagedCommands.filter(c => c.type === 'write_file' || c.type === 'delete_file').length
          telemetry = updateTelemetryStage(telemetry, 'snapshot', 'completed', `${writableFiles} files`)

          // COMMIT — validation + dependency resolution passed, write all commands to DB
          telemetry = updateTelemetryStage(telemetry, 'commit', 'active')
          emitTelemetry()
          const commitResult = await commitTransaction(tx, prisma, sid, assistantMsg.id, withDbRetry)
          if (commitResult.success) {
            telemetry = updateTelemetryStage(telemetry, 'commit', 'completed', `${commitResult.commands.length} commands`)
            telemetry = updateTelemetryStage(telemetry, 'bridge', 'active', 'Waiting for Bridge execution')
            telemetry = updateTelemetryStage(telemetry, 'verify', 'pending')
            telemetry = updateTelemetryStage(telemetry, 'feedback', 'pending')
            emitTelemetry()
            send('transaction_committed', { txId: tx.id, commandCount: commitResult.commands.length })
            send('commands', { commands: commitResult.commands })
            console.log(`[Transaction] COMMITTED ${tx.id} — ${commitResult.commands.length} commands created`)

            // ── Send success report email (fire & forget) ──
            sendCEReport({
              type: 'success',
              userName: session?.user?.name || session?.user?.email || 'unknown',
              userEmail: session?.user?.email || 'unknown',
              sessionId: sid, txId: tx.id, message: message || '',
              commandCount: commitResult.commands.length,
              files: commitResult.commands.filter(c => c.type === 'write_file').map(c => (c.payload as Record<string, unknown>)?.filePath as string || 'unknown'),
            })

            // ── Self-Review: Visual Reflexion Loop (fire after commit, non-blocking) ──
            const hasWriteFiles = commitResult.commands.some(c => c.type === 'write_file')
            const hasHtmlFiles = commitResult.commands.some(c => {
              if (c.type !== 'write_file') return false
              const p = c.payload as Record<string, unknown>
              return /\.html?$/i.test((p?.filePath as string) || '')
            })
            if (hasWriteFiles && hasHtmlFiles) {
              try {
                send('self_review_started', { status: 'capturing', message: 'Capturando screenshot del resultado...' })
                telemetry = updateTelemetryStage(telemetry, 'verify', 'active', 'Visual self-review')
                emitTelemetry()

                const reviewResult = await performSelfReview(sid, userId, message || undefined)
                if (reviewResult) {
                  telemetry = updateTelemetryStage(telemetry, 'verify', 'completed', `Score: ${reviewResult.score}/100`)
                  emitTelemetry()
                  send('self_review_complete', {
                    score: reviewResult.score,
                    passed: reviewResult.passed,
                    issues: reviewResult.issues,
                    praise: reviewResult.praise,
                    summary: reviewResult.summary,
                  })
                  console.log(`[SelfReview] Score: ${reviewResult.score}/100, Issues: ${reviewResult.issues?.length || 0}`)
                } else {
                  telemetry = updateTelemetryStage(telemetry, 'verify', 'skipped', 'Screenshot failed')
                  emitTelemetry()
                }
              } catch (reviewErr) {
                console.warn('[SelfReview] Non-critical error:', reviewErr instanceof Error ? reviewErr.message : reviewErr)
                telemetry = updateTelemetryStage(telemetry, 'verify', 'skipped', 'Review failed')
                emitTelemetry()
              }
            } else {
              telemetry = updateTelemetryStage(telemetry, 'verify', 'skipped', 'No HTML files')
              emitTelemetry()
            }
          } else {
            // DB commit failed — rollback
            telemetry = updateTelemetryStage(telemetry, 'commit', 'failed', commitResult.error)
            telemetry = updateTelemetryStage(telemetry, 'bridge', 'skipped')
            telemetry = updateTelemetryStage(telemetry, 'verify', 'skipped')
            telemetry = updateTelemetryStage(telemetry, 'feedback', 'skipped')
            emitTelemetry()
            const rb = rollbackTransaction(tx, commitResult.error || 'DB commit failed')
            send('transaction_rolled_back', {
              txId: rb.txId,
              reason: rb.reason,
              criticalErrors: rb.criticalErrors,
              affectedFiles: rb.affectedFiles,
              fileWarnings: rb.fileWarnings,
            })
            console.log(`[Transaction] COMMIT FAILED ${tx.id}: ${commitResult.error}`)

            // ── Send failure report email (fire & forget) ──
            sendCEReport({
              type: 'failure',
              userName: session?.user?.name || session?.user?.email || 'unknown',
              userEmail: session?.user?.email || 'unknown',
              sessionId: sid, txId: tx.id, message: message || '',
              commandCount: 0, files: rb.affectedFiles || [],
              reason: `DB commit failed: ${commitResult.error || 'unknown'}`,
            })
          }
          send('done', { messageId: assistantMsg.id })
        }
        controller.close()
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        send('error', { error: 'stream_error', detail: msg })
        await prisma.codeMessage
          .update({
            where: { id: assistantMsg.id },
            data: { status: 'failed', error: msg.substring(0, 500) },
          })
          .catch(() => {})
        try { controller.close() } catch {}
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/arms/claude-code/chat
// ?action=sessions  -> list sessions
// ?action=messages&sessionId=X  -> get messages + commands
// ?action=session&sessionId=X   -> get single session metadata
// ═══════════════════════════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id

  // Auto-migración idempotente: garantiza columnas de token tracking (Fase 4)
  await ensureTokenColumns()

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action') || 'sessions'

  if (action === 'sessions') {
    const sessions = await prisma.codeSession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: { _count: { select: { messages: true, commands: true } } },
    })
    return NextResponse.json({ sessions })
  }

  if (action === 'messages') {
    const sessionId = searchParams.get('sessionId')
    if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
    const cs = await prisma.codeSession.findFirst({ where: { id: sessionId, userId } })
    if (!cs) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    const messages = await prisma.codeMessage.findMany({
      where: { sessionId, role: { not: 'system' } },
      orderBy: { createdAt: 'asc' },
    })
    const commands = await prisma.bridgeCommand.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json({ session: cs, messages, commands })
  }

  if (action === 'commands') {
    const sessionId = searchParams.get('sessionId')
    if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
    const cs = await prisma.codeSession.findFirst({ where: { id: sessionId, userId } })
    if (!cs) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    const commands = await prisma.bridgeCommand.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json({ commands })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE — Remove a session
// ═══════════════════════════════════════════════════════════════════════════════
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
  const cs = await prisma.codeSession.findFirst({ where: { id: sessionId, userId: session.user.id } })
  if (!cs) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  await prisma.codeSession.delete({ where: { id: sessionId } })
  return NextResponse.json({ ok: true })
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1048576).toFixed(1)}MB`
}
