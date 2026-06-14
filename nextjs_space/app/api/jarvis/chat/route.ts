import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { buildChatContext } from '@/lib/jarvis-chat'
// [Fase 2] detectIntent, generateContextInstructions, ACTION_MODE_REINFORCEMENT removed
// Intent detection is now handled by the LLM via native function calling (tools)
import { analyzeUserVibe, adjustSystemPromptForVibe, detectTaskChain } from '@/lib/jarvis-intelligence'
import { buildModularPrompt } from '@/lib/octopus-personality'
import { routeContext } from '@/lib/context-router'
import { buildContextPrompt, processMessageForMemory, buildUserMemoryProfile } from '@/lib/octopus-rag'
import { extractDocumentText, getDocumentLabel } from '@/lib/document-parser'
import { getUserTurboConfig, buildTurboRequest, getUserOpenRouterKey, toAbacusModel } from '@/lib/turbo-llm'
import { compressConversationHistory } from '@/lib/jarvis-summarizer'
import { selectToolsForModules } from '@/lib/octopus-tools'
import { executeTool, ToolResult } from '@/lib/octopus-tool-executor'
import { detectCanvasIntent, buildCanvasPrompt } from '@/lib/octopus-canvas'
import { detectSpecialistLenses, buildSpecialistContext } from '@/lib/skills/specialist-lenses'
import { autoInvokeImageSkill } from '@/lib/skills/skill-bridge'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Aumentar límite de body para documentos grandes (base64)
export const fetchCache = 'force-no-store'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch (parseErr) {
      console.error('Error parsing request body (posible tamaño excedido):', parseErr instanceof Error ? parseErr.message : parseErr)
      return NextResponse.json({ error: 'Error al leer el cuerpo de la solicitud' }, { status: 400 })
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { message, history, systemContext, imageBase64, imagesBase64, documentBase64, documentName, documentMime, documentPreText, canvas, modelOverride } = body as any

    // ============================================
    // 🎨 MODO CANVAS — construcción de proyectos web en vivo (agnóstico al modelo)
    // Activo si: hay un proyecto Canvas abierto en el panel, o el mensaje pide construir algo web
    // ============================================
    let canvasPrompt = ''
    let canvasMode = false
    let canvasActiveLenses: string[] = []
    try {
      const canvasProjectId = canvas?.projectId as string | undefined
      if (canvasProjectId) {
        const proj = await prisma.project.findFirst({
          where: { id: canvasProjectId, userId: session.user.id, projectType: 'canvas' },
          include: { files: { select: { path: true } } },
        })
        if (proj) {
          canvasMode = true
          canvasPrompt = buildCanvasPrompt({ title: proj.name, files: proj.files })
        }
      }
      if (!canvasMode && typeof message === 'string' && detectCanvasIntent(message)) {
        canvasMode = true
        canvasPrompt = buildCanvasPrompt(null)
      }

      // ── Specialist Lenses + Image Skill (Canvas only) ──
      if (canvasMode && typeof message === 'string') {
        // 1. Specialist lenses: design-trends + ui are most relevant for Canvas
        const lenses = detectSpecialistLenses(message)
        // Always add ui + design-trends lenses for canvas visual projects
        const lensIds = new Set(lenses.map(l => l.id))
        const { SPECIALIST_LENSES } = await import('@/lib/skills/specialist-lenses')
        // Canvas siempre construye landings/sitios → UI + Trends + SEO + GEO son base
        for (const baseId of ['ui', 'design-trends', 'seo', 'geo'] as const) {
          if (!lensIds.has(baseId)) lenses.push(...SPECIALIST_LENSES.filter(l => l.id === baseId))
        }
        if (lenses.length > 0) {
          canvasActiveLenses = lenses.map(l => `${l.emoji} ${l.name}`)
          canvasPrompt += '\n\n' + buildSpecialistContext(lenses)
          console.log(`[Canvas] Specialist lenses active: ${canvasActiveLenses.join(', ')}`)
        }

        // 2. Image skill (secondary/fallback — graceful degradation on error)
        try {
          const imageCtx = await autoInvokeImageSkill(message, session.user.id)
          if (imageCtx.detected && imageCtx.contextBlock) {
            canvasPrompt += '\n\n' + imageCtx.contextBlock
            console.log(`[Canvas] Image skill injected: ${imageCtx.category} — ${Object.values(imageCtx.imageUrls).flat().length} images`)
          }
        } catch (imgErr) {
          console.warn('[Canvas] Image skill failed (non-fatal):', imgErr instanceof Error ? imgErr.message : imgErr)
        }
      }
    } catch (canvasErr) {
      console.error('[Canvas] Error preparando contexto (non-fatal):', canvasErr)
    }
    if (canvasMode) console.log('[OCTOPUS] 🎨 Canvas mode ACTIVE')

    // Normalize: if imagesBase64 (array) is provided use it; otherwise fallback to single imageBase64
    const imageUrls: string[] = Array.isArray(imagesBase64) && imagesBase64.length > 0
      ? imagesBase64.filter((u: any) => typeof u === 'string' && u.length > 0)
      : (typeof imageBase64 === 'string' && imageBase64.length > 0 ? [imageBase64] : [])
    const hasImages = imageUrls.length > 0

    console.log(`[OCTOPUS Chat] message="${(message || '').substring(0, 50)}", hasImage=${hasImages}, imagesCount=${imageUrls.length}, hasDoc=${!!documentBase64}, hasPreText=${!!documentPreText}, docName=${documentName || 'none'}`)

    if (!message && !hasImages && !documentBase64 && !documentPreText) {
      return NextResponse.json({ error: 'Mensaje requerido' }, { status: 400 })
    }

    // ============================================
    // DOCUMENT PROCESSING: Extraer texto de documentos
    // ============================================
    let documentContext = ''
    let isPdfDocument = false
    
    // RUTA RÁPIDA: Si el frontend ya pre-procesó el documento (archivos grandes)
    if (documentPreText && documentName) {
      console.log(`[OCTOPUS Doc] Using pre-extracted text from browser: ${documentName}, textLength: ${(documentPreText as string).length}`)
      const maxChars = 20000
      const preText = documentPreText as string
      const truncatedText = preText.length > maxChars ? preText.slice(0, maxChars) + '\n\n... (contenido truncado por longitud)' : preText
      documentContext = `\n\n📄 DOCUMENTO ADJUNTO (${documentName}):\n---INICIO DEL DOCUMENTO---\n${truncatedText}\n---FIN DEL DOCUMENTO---\n\nEl usuario ha adjuntado este documento para que lo analices. Responde basándote en su contenido.`
      console.log(`[OCTOPUS Doc] Pre-extracted context injected: ${documentContext.length} chars`)
    }
    // RUTA NORMAL: Procesar base64 en el servidor
    else if (documentBase64 && documentName) {
      try {
        const b64Len = (documentBase64 as string).length
        console.log(`[OCTOPUS Doc] Processing document server-side: ${documentName}, mime: ${documentMime}, base64 length: ${b64Len}`)
        const parsed = await extractDocumentText(documentBase64 as string, documentName, documentMime)
        isPdfDocument = parsed.isPdf
        console.log(`[OCTOPUS Doc] Parsed: type=${parsed.type}, isPdf=${parsed.isPdf}, textLength=${parsed.text?.length || 0}`)
        if (!parsed.isPdf && parsed.text) {
          const label = getDocumentLabel(parsed.type)
          const maxChars = 20000
          const truncatedText = parsed.text.length > maxChars ? parsed.text.slice(0, maxChars) + '\n\n... (contenido truncado por longitud)' : parsed.text
          documentContext = `\n\n📄 DOCUMENTO ADJUNTO (${label}: ${documentName}):\n---INICIO DEL DOCUMENTO---\n${truncatedText}\n---FIN DEL DOCUMENTO---\n\nEl usuario ha adjuntado este documento para que lo analices. Responde basándote en su contenido.`
          console.log(`[OCTOPUS Doc] Document context injected: ${documentContext.length} chars`)
        }
      } catch (docErr) {
        console.error('Error processing document:', docErr instanceof Error ? docErr.message : docErr)
        documentContext = `\n\n⚠️ No se pudo procesar el documento "${documentName}". Error al leer el archivo.`
      }
    }

    // ============================================
    // RAG 2.0: PROCESAR MENSAJE PARA MEMORIA (resiliente)
    // ============================================
    if (message) {
      try {
        const msgCount = Array.isArray(history) ? history.length : 0
        const memoryResult = await processMessageForMemory(session.user.id, message, msgCount)
        if (memoryResult.factsSaved > 0 || memoryResult.graphUpdated || memoryResult.vectorized || memoryResult.consolidated) {
          console.log(`[Phase 4] Memory: facts=${memoryResult.factsSaved}, graph=${memoryResult.graphUpdated}, vec=${memoryResult.vectorized}, consolidated=${memoryResult.consolidated}`)
        }
      } catch (ragErr) {
        console.error('RAG memory processing failed (non-fatal):', ragErr instanceof Error ? ragErr.message : ragErr)
      }
    }

    // ============================================
    // RAG 2.0: CONSTRUIR CONTEXTO ENRIQUECIDO (resiliente)
    // ============================================
    let ragContext: { contextPrompt: string; sourcesUsed: string[]; confidence: number } = { contextPrompt: '', sourcesUsed: [], confidence: 0 }
    try {
      const conversationHistory = history?.map((m: { content: string }) => m.content) || []
      ragContext = await buildContextPrompt(
        session.user.id,
        message || '',
        conversationHistory
      )
      
      console.log('RAG 2.0 Context:', {
        sourcesUsed: ragContext.sourcesUsed,
        confidence: ragContext.confidence,
        hasContext: ragContext.contextPrompt.length > 0
      })
    } catch (ragErr) {
      console.error('RAG context build failed (non-fatal):', ragErr instanceof Error ? ragErr.message : ragErr)
    }

    // 1. VIBE DETECTION: Analizar tono del usuario
    const messageHistory = history?.map((m: { content: string }) => m.content) || []
    const vibeAnalysis = analyzeUserVibe(message || '', messageHistory)
    
    console.log('Vibe Analysis:', {
      vibe: vibeAnalysis.detectedVibe,
      emotion: vibeAnalysis.emotionalState,
      confidence: vibeAnalysis.confidence,
      temperature: vibeAnalysis.suggestedTemperature
    })

    // 2. TASK CHAINING: Detectar múltiples tareas
    const taskChain = detectTaskChain(message || '')
    const hasChainedTasks = taskChain !== null && taskChain.length > 1
    
    if (hasChainedTasks) {
      console.log('Task Chain Detected:', taskChain?.map(t => t.action))
    }

    // 3. [Fase 2] Intent detection removed — LLM handles intent via function calling (tools)

    // 🛡️ DRAFT CONTEXT INJECTION: When user confirms ("luz verde", "dale"),
    // extract the last email draft from assistant's message and inject it as context.
    const CONFIRMATION_RE = /^(sí|si|yes|ok|dale|hazlo|envíalo|confirmo|luz verde|manda|apruebo|claro|va|anda|adelante|proceed|go ahead|send it)$/i
    let draftReminderPrompt = ''
    const isConfirmation = CONFIRMATION_RE.test((message || '').trim())
    if (isConfirmation && history && Array.isArray(history)) {
      const assistantMsgs = (history as Array<{ role: string; content: string }>)
        .filter(m => m.role === 'assistant')
        .slice(-3)
      for (let i = assistantMsgs.length - 1; i >= 0; i--) {
        const content = assistantMsgs[i].content || ''
        const toMatch = content.match(/(?:📧|Para|To|Destinatario)[:\s*]*([\w.+\-]+@[\w.\-]+\.[a-z]{2,})/i)
        const subjectMatch = content.match(/(?:📝|Asunto|Subject)[:\s*]*(.+?)(?:\n|$)/i)
        if (toMatch && subjectMatch) {
          const bodyMatch = content.match(/(?:📄|Cuerpo|Body|Mensaje|Contenido)[:\s*]*\n?([\s\S]+?)(?=\n\n(?:📧|📝|🏷|---|\*\*|¿|$)|$)/i)
          draftReminderPrompt = `\n🚨 BORRADOR PENDIENTE DE ENVIAR (el usuario acaba de confirmar):\n- to: "${toMatch[1].trim()}"\n- subject: "${subjectMatch[1].replace(/\*\*/g, '').trim()}"\n- body: "${bodyMatch ? bodyMatch[1].trim().substring(0, 500) : subjectMatch[1].replace(/\*\*/g, '').trim()}"\nEMITE send_email con EXACTAMENTE estos params. NO omitas ninguno.\n`
          console.log('[Draft Injection] Found pending draft for:', toMatch[1].trim())
          break
        }
      }
    }
    
    // Construir contexto del sistema
    const systemContextPrompt = systemContext 
      ? buildChatContext(systemContext)
      : ''

    // ============================================
    // 🧠 CONTEXT ROUTER: Seleccionar módulos relevantes
    // ============================================
    const recentUserMsgs = history
      ? (history as Array<{ role: string; content: string }>)
          .filter(m => m.role === 'user')
          .slice(-3)
          .map(m => m.content)
      : []
    const contextRoute = routeContext(message || '', recentUserMsgs)
    
    console.log('[Context Router]', {
      modules: contextRoute.modules,
      confidence: contextRoute.confidence,
      reasoning: contextRoute.reasoning,
    })

    // Build modular base prompt (only relevant modules)
    let basePrompt = buildModularPrompt(contextRoute.modules)

    // [Fase 2] Tool-aware prompt replaces ACTION_MODE_REINFORCEMENT
    const TOOL_GUIDANCE = `
## ⚙️ HERRAMIENTAS (TOOLS)
Tienes acceso a herramientas nativas que puedes invocar directamente. Cuando el usuario pida una acción concreta:
1. USA LAS HERRAMIENTAS disponibles — el sistema las ejecuta automáticamente y te devuelve resultados REALES.
2. NUNCA inventes datos. Si necesitas información (leads, estadísticas, campañas), llama la herramienta correspondiente.
3. Después de recibir el resultado de una herramienta, responde al usuario con los datos REALES.
4. Puedes encadenar múltiples herramientas en una sola interacción.
5. Si el usuario pide algo conversacional (opinión, pregunta abierta), conversa naturalmente sin herramientas.
6. 🚨 ANTI-ALUCINACIÓN: NUNCA digas "listo, ya lo hice" sin haber ejecutado una herramienta. Eso es MENTIR.
7. 🚨 DIAGNÓSTICO vs ACCIÓN: Preguntas con "por qué", "qué pasó" = EXPLICA. Solo ejecuta cuando el usuario PIDE acción.

## 📧 REGLAS DE EMAIL
- Al enviar email (google_send_email), SIEMPRE muestra borrador al usuario para confirmación ANTES de enviar.
- Si no confirma, usa create_draft.
- Descripciones de media SIEMPRE en INGLÉS.
`
    basePrompt += '\n\n' + TOOL_GUIDANCE

    // 4. AJUSTAR PROMPT SEGÚN VIBE
    basePrompt = adjustSystemPromptForVibe(basePrompt, vibeAnalysis)

    // 5. INSTRUCCIONES PARA TASK CHAINING
    const chainInstructions = hasChainedTasks ? `
[TAREAS ENCADENADAS DETECTADAS]
El usuario ha solicitado MÚLTIPLES tareas en secuencia:
${taskChain?.map((t, i) => `${i + 1}. ${t.action} (tipo: ${t.type})`).join('\n')}
Usa las herramientas disponibles para ejecutar cada tarea.
` : ''

    // ============================================
    // 🐙 GLOBAL STATE — Centralized consciousness (replaces scattered prompts)
    // ============================================
    let globalStatePrompt = ''
    let userCampaigns: { id: string; name: string; status: string }[] = []
    try {
      const globalState = await (await import('@/lib/octopus-global-state')).buildGlobalState(session.user.id, contextRoute.modules)
      globalStatePrompt = globalState.prompt
      userCampaigns = globalState.data.growth.campaignList
    } catch (err) {
      console.error('Error building global state:', err)
    }

    // --- USER IDENTITY (always present) ---
    // userIdentityPrompt solo como fallback si globalState falla
    const userIdentityPrompt = globalStatePrompt 
      ? '' // globalState ya incluye [IDENTIDAD]
      : (session.user.name 
        ? `\n[USUARIO] ${session.user.name} (${session.user.email || '?'}). Personaliza respuestas con su nombre.\n`
        : '')

    // --- ACTIVE MEMORY — Phase 4: Rich user profile + recent topics ---
    let memoryPrompt = ''
    try {
      // Phase 4: Build structured profile from SemanticMemory
      const userProfile = await buildUserMemoryProfile(session.user.id)
      
      // Also keep recent conversation topics for continuity
      let recentTopicsLine = ''
      if (history && Array.isArray(history) && history.length > 0) {
        const recentTopics = (history as Array<{ role: string; content: string }>)
          .filter(m => m.role === 'user')
          .slice(-5)
          .map(m => typeof m.content === 'string' ? m.content.slice(0, 80) : '')
          .filter(Boolean)
        if (recentTopics.length > 0) {
          recentTopicsLine = `\n💬 Temas recientes: ${recentTopics.map((m, i) => `${i + 1}."${m}${m.length >= 80 ? '…' : ''}"`).join(' | ')}`
        }
      }
      
      memoryPrompt = [userProfile, recentTopicsLine].filter(Boolean).join('\n')
    } catch (err) {
      console.error('Error building memory:', err)
    }

    // ============================================
    // 🐙 ASSEMBLY — Compact prompt (only active modules)
    // RECENCY EFFECT: Critical rules go LAST (LLMs pay more attention to start + end)
    // ============================================
    const CRITICAL_RULES_RECAP = `
🚨 RECORDATORIO FINAL (REGLAS CRÍTICAS):
1. Si el usuario pide una acción, USA LAS HERRAMIENTAS. No digas "listo" sin haber ejecutado nada.
2. send_email SIEMPRE con to + subject + body completos. Muestra borrador primero.
3. NUNCA inventes datos de leads, campañas o estadísticas. Consulta con herramientas.
4. Mostrá borrador completo antes de enviar email. Correcciones = mostrar versión nueva.
5. NUNCA digas "ya guardé", "lead registrado", "listo" sin haber ejecutado la herramienta correspondiente.
6. 🚨 ANTI-ENSAYO: Si el usuario pide ACCIÓN (buscar perfiles, prospectar, crear leads) → EJECUTA LA HERRAMIENTA. NUNCA respondas con artículos educativos, listas de herramientas, ni tutoriales. "Busca 10 perfiles" = growth_prospect_web, NO un ensayo sobre Hunter.io.

## 🚨 REGLAS DE CONSCIENCIA (PRIORIDAD MÁXIMA)
1. **DATO REAL vs DATO INVENTADO**: Si un dato aparece en tu estado [IDENTIDAD], [BRAZOS], [FACTORIES], etc. → es REAL. Si NO aparece → NO existe. NUNCA supongas.
2. **EMAIL DE NEGOCIO**: El campo "Email negocio" en [IDENTIDAD] es el businessEmail configurado en Settings. Es DIFERENTE del email de login.
3. **CAPABILITIES REALES**: Solo puedes usar: Brazos que aparezcan como ✅ en [BRAZOS], Skills, Agents y MCPs que aparezcan en [FACTORIES]. Si algo NO aparece → NO lo tienes.
4. **CONTEOS**: Si dice "Skills: 4/5", significa 4 activos de 5 totales. No inventes nombres de skills.
5. **PLAN Y LÍMITES**: Si dice "Plan: Starter", el usuario está en Starter. No le ofrezcas features de Business.
6. **TURBO**: Si dice "Turbo: ❌", el usuario NO tiene turbo. Exprésalo claramente.
`
    const fullSystemPrompt = [
      basePrompt,
      userIdentityPrompt,
      globalStatePrompt,          // 🐙 Centralized consciousness — replaces all scattered prompts
      memoryPrompt,
      ragContext.contextPrompt,
      systemContextPrompt,
      chainInstructions,
      draftReminderPrompt,        // 🛡️ Draft reminder when confirming email send
      canvasPrompt,               // 🎨 Canvas mode — file-block contract for live web builds
      CRITICAL_RULES_RECAP,       // 🚨 LAST — recency effect ensures LLM remembers these
    ].filter(Boolean).join('\n')

    // Log prompt size for monitoring optimization
    const promptTokenEstimate = Math.round(fullSystemPrompt.length / 4)
    console.log(`[OCTOPUS] System prompt: ~${promptTokenEstimate} tokens (${fullSystemPrompt.length} chars), modules: [${contextRoute.modules.join(', ')}]`)
    
    const messages: { role: string; content: string | { type: string; text?: string; image_url?: { url: string } }[] }[] = [
      { 
        role: 'system', 
        content: fullSystemPrompt
      },
    ]

    // Agregar historial con compresión inteligente
    const historyLimit = isConfirmation ? 99 : 50
    if (history && Array.isArray(history)) {
      const clippedHistory = history.slice(-historyLimit)
      const compressed = await compressConversationHistory(clippedHistory)
      
      if (compressed.stats.compressionApplied && compressed.summary) {
        console.log(`[OCTOPUS] Conversation compressed: ${compressed.stats.compressedCount} msgs → summary, keeping ${compressed.stats.recentCount} recent`)
        // Inyectar resumen como contexto del sistema
        messages.push({
          role: 'system',
          content: compressed.summary,
        })
        // Agregar solo mensajes recientes
        for (const msg of compressed.recentMessages) {
          messages.push({ role: msg.role, content: msg.content })
        }
      } else {
        // Sin compresión, enviar todo el historial
        for (const msg of clippedHistory) {
          messages.push({ role: msg.role, content: msg.content })
        }
      }
    }

    // Agregar mensaje actual (con imagen(es), documento PDF, o texto)
    if (hasImages) {
      const defaultPrompt = imageUrls.length === 1 ? 'Analiza esta imagen' : `Analiza estas ${imageUrls.length} imágenes`
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: message || defaultPrompt },
          ...imageUrls.map((url: string) => ({
            type: 'image_url',
            image_url: { url },
          })),
        ],
      })
    } else if (isPdfDocument && documentBase64) {
      // PDF: enviar directamente como base64 al LLM (visión nativa)
      const pdfBase64 = documentBase64.includes(',') ? documentBase64 : `data:application/pdf;base64,${documentBase64}`
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: message || `Analiza este documento PDF: ${documentName || 'documento.pdf'}` },
          { 
            type: 'image_url', 
            image_url: { url: pdfBase64 }
          },
        ],
      })
    } else {
      // Texto plano (incluye documentContext si hay documento DOCX/XLSX/CSV/TXT)
      let userMessage = message || ''
      if (documentContext) {
        userMessage = (userMessage || 'Analiza este documento') + documentContext
      }
      if (isConfirmation) {
        userMessage = `${userMessage}\n\n[SISTEMA: Confirmación detectada. Ejecuta la acción pendiente AHORA usando las herramientas disponibles.]`
      }
      // [Fase 2] "Assign leads" hint - helps the LLM use the right tool with right params
      const assignLeadsRegex = /(?:pasa|asigna|agrega|añade|mete|pon).*(?:leads?|prospectos?).*(?:campa[ñn]a)/i
      if (assignLeadsRegex.test(userMessage)) {
        const countMatch = userMessage.match(/(\d+)\s*(?:primeros?\s+)?(?:leads?|prospectos?)/i) || userMessage.match(/(?:primeros?\s+)(\d+)/i)
        const count = countMatch ? parseInt(countMatch[1]) : 25
        const campaignNames = userCampaigns.map(c => ({ id: c.id, name: c.name.toLowerCase() }))
        let targetCampaignId = campaignNames[0]?.id || ''
        for (const cn of campaignNames) {
          if (userMessage.toLowerCase().includes(cn.name)) {
            targetCampaignId = cn.id
            break
          }
        }
        if (targetCampaignId) {
          userMessage = `${userMessage}\n\n[HINT: Usa la herramienta growth_assign_leads_to_campaign con campaignId="${targetCampaignId}" y count=${count}]`
        }
      }
      messages.push({ role: 'user', content: userMessage })
    }
    
    // Ajustar maxTokens si hay documento (necesita más espacio para análisis)
    const hasDocument = !!(documentBase64 || documentContext)

    // 6. CONFIGURAR TEMPERATURA SEGÚN VIBE (en lugar de fija)
    // Canvas necesita espacio para proyectos multi-archivo completos (SaaS)
    const maxTokens = canvasMode ? 16000 : hasDocument ? 8000 : 4000
    const temperature = vibeAnalysis.suggestedTemperature
    
    // ============================================
    // TURBO MODE: Verificar si el usuario tiene Turbo activado
    // ============================================
    const turboConfig = await getUserTurboConfig(session.user.id)
    const isTurbo = turboConfig.enabled
    console.log(`[OCTOPUS] Turbo: ${isTurbo ? `YES (${turboConfig.model})` : 'NO (standard)'}`)

    // ── PRIORITY 0: User model override (🧠 selector) ──
    const overrideModel: string | null =
      typeof modelOverride === 'string' && modelOverride && modelOverride !== 'auto' ? modelOverride : null
    const overrideApiKey: string | null = overrideModel
      ? (turboConfig.apiKey || (await getUserOpenRouterKey(session.user.id)))
      : null
    if (overrideModel) {
      console.log(`[OCTOPUS] Model override: ${overrideModel} (OR key: ${overrideApiKey ? 'yes' : 'no → Abacus map'})`)
    }

    // ============================================
    // 🏎️ FUNCTION CALLING v1.0 — Tool-based execution
    // Instead of regex intent detection + prompt hacks,
    // we give the LLM real tools and let it call them natively.
    // ============================================
    const selectedTools = selectToolsForModules(contextRoute.modules)
    console.log(`[OCTOPUS] Tools: ${selectedTools.length} tools selected for modules [${contextRoute.modules.join(', ')}]`)

    // Helper to call LLM (handles turbo + standard fallback)
    async function callLLMRaw(msgs: unknown[], opts: { stream: boolean; tools?: unknown[] }) {
      const body: Record<string, unknown> = {
        model: 'gpt-4.1',
        messages: msgs,
        temperature,
        max_tokens: maxTokens,
        stream: opts.stream,
      }
      if (opts.tools && opts.tools.length > 0) {
        body.tools = opts.tools
        body.tool_choice = 'auto'
      }

      // PRIORIDAD 0: override del usuario (🧠 selector)
      if (overrideModel) {
        const orBody: Record<string, unknown> = {
          model: overrideModel,
          messages: msgs,
          temperature: overrideModel.includes('/o3') ? undefined : temperature,
          max_tokens: maxTokens,
          stream: opts.stream,
        }
        if (opts.tools && opts.tools.length > 0) {
          orBody.tools = opts.tools
          orBody.tool_choice = 'auto'
        }
        if (overrideApiKey) {
          try {
            const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${overrideApiKey}`,
                'HTTP-Referer': 'https://octopuskills.com',
                'X-Title': 'OCTOPUS Omni Cockpit',
              },
              body: JSON.stringify(orBody),
            })
            if (resp.ok) return resp
            console.warn(`[OCTOPUS] Override (${overrideModel}) OpenRouter ${resp.status}, falling back to Abacus`)
          } catch (e) {
            console.warn('[OCTOPUS] Override error:', e)
          }
        }
        // Fallback: map to Abacus equivalent
        body.model = toAbacusModel(overrideModel)
      }

      // Try turbo first if enabled (inject tools into turbo body manually)
      if (!overrideModel && isTurbo && turboConfig.enabled && turboConfig.apiKey && turboConfig.model) {
        try {
          const turboBody: Record<string, unknown> = {
            model: turboConfig.model,
            messages: msgs,
            temperature: turboConfig.model.includes('/o3') ? undefined : temperature,
            max_tokens: maxTokens,
            stream: opts.stream,
          }
          if (opts.tools && opts.tools.length > 0) {
            turboBody.tools = opts.tools
            turboBody.tool_choice = 'auto'
          }
          const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${turboConfig.apiKey}`,
              'HTTP-Referer': 'https://octopus.app',
              'X-Title': 'OCTOPUS Omni Cockpit',
            },
            body: JSON.stringify(turboBody),
          })
          if (resp.ok) return resp
          console.warn('[OCTOPUS] Turbo failed, falling back to standard')
        } catch (e) {
          console.warn('[OCTOPUS] Turbo error:', e)
        }
      }

      // Standard Abacus AI call
      const resp = await fetch('https://apps.abacus.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}` },
        body: JSON.stringify(body),
      })
      if (!resp.ok) {
        const errText = await resp.text().catch(() => '')
        console.error(`[OCTOPUS] LLM Error: ${resp.status} - ${errText.substring(0, 200)}`)
        throw new Error('Error al comunicarse con JARVIS')
      }
      return resp
    }

    // ============================================
    // TOOL LOOP: Non-streaming call → execute tools → loop until text response
    // Max 5 rounds to prevent infinite loops
    // ============================================
    const toolResults: { name: string; result: ToolResult }[] = []
    let loopMessages = [...messages] as unknown[]
    let toolRound = 0
    const MAX_TOOL_ROUNDS = 5

    // Create streaming response that sends tool events + final text
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send turbo indicator
          if (isTurbo) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ turbo: true })}\n\n`))
          }
          // Send canvas specialist lenses to UI
          if (canvasMode && canvasActiveLenses.length > 0) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ canvas_lenses: canvasActiveLenses })}\n\n`))
          }

          // Tool execution loop
          let needsToolLoop = selectedTools.length > 0
          while (needsToolLoop && toolRound < MAX_TOOL_ROUNDS) {
            toolRound++
            console.log(`[OCTOPUS] Tool round ${toolRound}/${MAX_TOOL_ROUNDS}`)

            // Non-streaming call to check for tool_calls
            const toolCheckResp = await callLLMRaw(loopMessages, { stream: false, tools: selectedTools })
            const toolCheckJson = await toolCheckResp.json()
            const choice = toolCheckJson.choices?.[0]

            if (!choice) {
              console.error('[OCTOPUS] No choices in LLM response')
              break
            }

            const toolCalls = choice.message?.tool_calls
            if (!toolCalls || toolCalls.length === 0) {
              // No tool calls — model wants to respond with text
              // Stream this as the final response
              const textContent = choice.message?.content || ''
              if (textContent) {
                // Send as content chunks (simulate streaming for consistent frontend handling)
                const chunkSize = 20
                for (let i = 0; i < textContent.length; i += chunkSize) {
                  const chunk = textContent.substring(i, i + chunkSize)
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`))
                }
              }
              needsToolLoop = false
              break
            }

            // Execute tool calls
            // Add assistant message with tool_calls to conversation
            loopMessages.push(choice.message)

            for (const tc of toolCalls) {
              const toolName = tc.function?.name || 'unknown'
              let toolArgs: Record<string, unknown> = {}
              try {
                toolArgs = JSON.parse(tc.function?.arguments || '{}')
              } catch { toolArgs = {} }

              // Send tool execution event to frontend
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                tool_start: toolName,
                tool_args: toolArgs,
              })}\n\n`))

              // Execute the tool
              const result = await executeTool(toolName, toolArgs, session.user.id)
              toolResults.push({ name: toolName, result })

              console.log(`[OCTOPUS] Tool ${toolName}: ${result.success ? 'OK' : 'FAIL'} — ${result.summary.substring(0, 100)}`)

              // Send tool result event to frontend
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                tool_result: toolName,
                tool_success: result.success,
                tool_summary: result.summary,
                tool_data: result.data,
                frontend_action: result.frontendAction || null,
              })}\n\n`))

              // Add tool result to conversation for next LLM call
              loopMessages.push({
                role: 'tool',
                tool_call_id: tc.id,
                content: JSON.stringify({
                  success: result.success,
                  data: result.data,
                  summary: result.summary,
                  error: result.error,
                }),
              })
            }

            // Continue loop — LLM will see tool results and decide what to do next
          }

          // If we exhausted tool rounds but still need text, do a final streaming call without tools
          if (needsToolLoop && toolRound >= MAX_TOOL_ROUNDS) {
            console.warn(`[OCTOPUS] Max tool rounds (${MAX_TOOL_ROUNDS}) reached, forcing text response`)
          }

          // If no text was sent yet (all rounds were tools), do a final streaming call
          if (toolRound > 0 && needsToolLoop === false) {
            // Text was already sent in the loop above
          } else if (toolRound > 0) {
            // Need a final streaming call to get text response
            const finalResp = await callLLMRaw(loopMessages, { stream: true })
            await pipeStreamToController(finalResp, controller, encoder)
          } else {
            // No tools were selected or no tool loop needed — direct streaming call
            // This is the fallback path that behaves like the old system
            const directResp = await callLLMRaw(loopMessages, {
              stream: true,
              tools: selectedTools.length > 0 ? selectedTools : undefined,
            })
            // For streaming with tools, we need to handle the case where
            // the stream contains tool_calls (unlikely but possible)
            await pipeStreamToController(directResp, controller, encoder)
          }

          // Send done signal
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } catch (error) {
          console.error('[OCTOPUS] Stream error:', error)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: '\n\n⚠️ Error procesando la solicitud.' })}\n\n`))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })

  } catch (error) {
    console.error('Error in JARVIS chat:', error)
    return NextResponse.json(
      { error: 'Error en el procesamiento' },
      { status: 500 }
    )
  }
}

// ============================================
// Helper: Pipe an SSE stream response into a ReadableStream controller
// ============================================
async function pipeStreamToController(
  response: Response,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
) {
  const reader = response.body?.getReader()
  if (!reader) return

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') continue // We handle DONE ourselves

          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content
            if (content) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
              )
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}