import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { formatExecutionFeedback, type ExecutionFeedback } from '@/lib/nervous-system'

export const dynamic = 'force-dynamic'

// ═══════════════════════════════════════════════════════════════════════════════
// Bridge POSTs results here after executing a command.
// Supports two modes:
//   1. Final result:  { commandId, status: 'completed'|'failed', result?, error? }
//   2. Stream chunk:  { commandId, action: 'stream', chunk: string }
//      → Appends stdout/stderr to streamOutput field (terminal streaming)
// ═══════════════════════════════════════════════════════════════════════════════
async function validateBridgeToken(token: string): Promise<string | null> {
  if (!token) return null
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      apiKey: token,
      OR: [{ serviceType: 'hogar_bridge' }, { serviceType: 'octopus_bridge' }],
    },
  })
  return apiKey?.userId || null
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('x-bridge-token') || ''
  const userId = await validateBridgeToken(token)
  if (!userId) {
    return NextResponse.json({ error: 'Invalid bridge token' }, { status: 401 })
  }

  let body: {
    commandId: string
    action?: 'stream'
    chunk?: string
    status?: 'completed' | 'failed'
    result?: unknown
    error?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { commandId } = body
  if (!commandId) {
    return NextResponse.json({ error: 'commandId is required' }, { status: 400 })
  }

  // ── Stream chunk mode ──────────────────────────────────────────────────
  if (body.action === 'stream' && body.chunk) {
    const cmd = await prisma.bridgeCommand.findFirst({
      where: {
        id: commandId,
        session: { userId },
        status: 'executing',
      },
      select: { id: true, streamOutput: true },
    })
    if (!cmd) {
      return NextResponse.json({ error: 'Command not found or not executing' }, { status: 404 })
    }

    // Append chunk (cap at 500KB total to prevent unbounded growth)
    const prev = cmd.streamOutput || ''
    const newOutput = (prev + body.chunk).slice(-500_000)
    await prisma.bridgeCommand.update({
      where: { id: commandId },
      data: { streamOutput: newOutput },
    })

    return NextResponse.json({ ok: true })
  }

  // ── Final result mode ──────────────────────────────────────────────────
  const { status, result, error } = body
  if (!status) {
    return NextResponse.json({ error: 'status is required' }, { status: 400 })
  }

  // Verify ownership — also accept re-sync for 'executing' commands that went offline
  const cmd = await prisma.bridgeCommand.findFirst({
    where: {
      id: commandId,
      session: { userId },
      status: { in: ['executing', 'approved', 'pending'] },
    },
  })
  if (!cmd) {
    // Might be a re-sync for an already-reported command — accept silently
    const existing = await prisma.bridgeCommand.findFirst({
      where: { id: commandId, session: { userId } },
      select: { status: true },
    })
    if (existing && (existing.status === 'completed' || existing.status === 'failed')) {
      return NextResponse.json({ ok: true, resync: true })
    }
    return NextResponse.json({ error: 'Command not found or not pending' }, { status: 404 })
  }

  // Truncate huge results to 200KB max
  const resultStr = result !== undefined ? JSON.stringify(result).substring(0, 200000) : null

  // ── Protect save_image from Bridge overwrite ──
  // The image-gen pipeline is the authority for save_image commands.
  // If the background worker already generated the image (payload has URL) and set
  // status='approved', the Bridge might later report 'failed' (e.g. download error).
  // We must NOT let that overwrite the successful generation status.
  if (cmd.type === 'save_image' && status === 'failed') {
    let cmdPayload: Record<string, unknown> = {}
    try { cmdPayload = JSON.parse(cmd.payload as string) } catch {}
    if (cmdPayload.url && typeof cmdPayload.url === 'string' && (cmdPayload.url as string).startsWith('http')) {
      console.log(`[Respond] ⚠ save_image ${commandId.slice(0, 8)} — Bridge reported 'failed' but image URL exists in payload, keeping current status '${cmd.status}'`)
      // Still save the Bridge error info for debugging, but set status to 'completed'
      // so the image shows as done (generated + Bridge attempted download)
      await prisma.bridgeCommand.update({
        where: { id: commandId },
        data: {
          status: 'completed',
          result: resultStr,
          error: error ? `[Bridge] ${error.substring(0, 1000)}` : null,
        },
      })
      return NextResponse.json({ ok: true, imageProtected: true })
    }
  }

  await prisma.bridgeCommand.update({
    where: { id: commandId },
    data: {
      status,
      result: resultStr,
      error: error ? error.substring(0, 1000) : null,
    },
  })

  // ── Sprint 10: Live State Injection ──
  // After all commands in a message are completed/failed, inject [SYSTEM_FEEDBACK]
  // as an invisible system message for the LLM to reference in future turns.
  try {
    if (cmd.messageId) {
      const remaining = await prisma.bridgeCommand.count({
        where: {
          messageId: cmd.messageId,
          status: { in: ['approved', 'executing', 'pending'] },
        },
      })
      if (remaining === 0) {
        // All commands for this message are done — inject feedback
        const allCmds = await prisma.bridgeCommand.findMany({
          where: { messageId: cmd.messageId, status: { in: ['completed', 'failed'] } },
          orderBy: { createdAt: 'asc' },
          select: { id: true, type: true, payload: true, status: true, result: true, error: true, updatedAt: true },
        })
        const feedbacks: ExecutionFeedback[] = allCmds.map(c => {
          let pl: Record<string, unknown> = {}
          try { pl = JSON.parse(c.payload as string) } catch {}
          let res: Record<string, unknown> = {}
          if (c.result) { try { res = typeof c.result === 'string' ? JSON.parse(c.result) : c.result as Record<string, unknown> } catch {} }
          // Extract S3 URL for save_image commands so LLM can reference in HTML
          const imgUrl = c.type === 'save_image' && typeof pl.url === 'string' && (pl.url as string).startsWith('http')
            ? pl.url as string : undefined
          return {
            commandId: c.id,
            type: c.type,
            path: pl.path as string | undefined,
            status: c.status as 'completed' | 'failed',
            error: c.error || undefined,
            readContent: c.type === 'read_file' && res.content ? String(res.content) : undefined,
            stdout: c.type === 'execute_cmd' && res.stdout ? String(res.stdout) : undefined,
            stderr: c.type === 'execute_cmd' && res.stderr ? String(res.stderr) : undefined,
            imageUrl: imgUrl,
            timestamp: c.updatedAt.toISOString(),
          }
        })
        const feedbackText = formatExecutionFeedback(feedbacks)
        if (feedbackText) {
          await prisma.codeMessage.create({
            data: {
              sessionId: cmd.sessionId,
              role: 'system',
              content: feedbackText,
              status: 'completed',
            },
          })
          console.log(`[NervousSystem] Injected SYSTEM_FEEDBACK for message ${cmd.messageId}: ${feedbacks.length} results`)
        }
      }
    }
  } catch (fbErr) {
    console.warn('[NervousSystem] Feedback injection failed:', fbErr)
  }

  return NextResponse.json({ ok: true })
}
