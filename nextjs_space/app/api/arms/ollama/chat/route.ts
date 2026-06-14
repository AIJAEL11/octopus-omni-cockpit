import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// ── Fixed system prompt for Octopus Local AI identity ──────────────────────
const OCTOPUS_SYSTEM_PROMPT = `You are Octopus Local AI, a private AI assistant running 100% on the user's own machine via Ollama.
You are NOT OpenAI, NOT GPT-3.5, NOT GPT-4, NOT ChatGPT, NOT Claude, NOT any cloud-based model.
You must always identify yourself as a local model managed by Octopus when asked about your identity.
Never claim to be an OpenAI model or any other cloud-based AI.

Rules:
- Always respond in the same language the user writes in.
- Keep responses concise and clear unless the user asks for detail.
- You run locally — the user's data never leaves their machine.
- Do NOT wrap your response in <think> tags or expose internal reasoning. Only output the final answer.`

// Helper: strip <think>...</think> blocks from model output
function stripThinkTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
}

// Helper: validate bridge token
async function validateBridgeToken(token: string) {
  if (!token) return null
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      apiKey: token,
      OR: [
        { serviceType: 'hogar_bridge' },
        { serviceType: 'octopus_bridge' },
      ],
    },
  })
  return apiKey?.userId || null
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/arms/ollama/chat — User sends a message (creates user msg + pending assistant msg)
// ═══════════════════════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { sessionId, model, message, systemPrompt } = body

    if (!model || !message) {
      return NextResponse.json({ error: 'model and message are required' }, { status: 400 })
    }

    // Check Ollama bridge is present (last report < 3 min)
    const arm = await prisma.armConnection.findFirst({
      where: { userId: session.user.id, armType: 'ollama' },
    })
    if (!arm) {
      return NextResponse.json({ error: 'no_bridge', message: 'Ollama Bridge no detectado. Instala y ejecuta el Bridge primero.' }, { status: 400 })
    }
    const creds = JSON.parse(arm.credentials || '{}')
    const lastSeen = creds.lastSeenAt ? new Date(creds.lastSeenAt).getTime() : 0
    const staleMs = 3 * 60 * 1000 // 3 min
    if (Date.now() - lastSeen > staleMs) {
      return NextResponse.json({ error: 'bridge_offline', message: 'El Bridge no ha reportado en los últimos 3 minutos. ¿Está corriendo?' }, { status: 400 })
    }

    // Create or reuse session
    let chatSession
    if (sessionId) {
      chatSession = await prisma.ollamaChatSession.findFirst({
        where: { id: sessionId, userId: session.user.id },
      })
    }
    if (!chatSession) {
      // Generate a title from first 50 chars of message
      const title = message.length > 50 ? message.slice(0, 47) + '...' : message
      chatSession = await prisma.ollamaChatSession.create({
        data: {
          userId: session.user.id,
          model,
          title,
        },
      })
    }

    // Always inject system prompt for new sessions (identity + language + rules)
    if (!sessionId) {
      const finalSystemPrompt = OCTOPUS_SYSTEM_PROMPT + (systemPrompt ? '\n\n' + systemPrompt : '')
      await prisma.ollamaChatMessage.create({
        data: {
          sessionId: chatSession.id,
          role: 'system',
          content: finalSystemPrompt,
          status: 'completed',
        },
      })
    }

    // Create user message
    const userMsg = await prisma.ollamaChatMessage.create({
      data: {
        sessionId: chatSession.id,
        role: 'user',
        content: message,
        status: 'completed',
      },
    })

    // Create pending assistant message (Bridge will fill this in)
    const assistantMsg = await prisma.ollamaChatMessage.create({
      data: {
        sessionId: chatSession.id,
        role: 'assistant',
        content: '',
        status: 'pending',
      },
    })

    // Update session timestamp
    await prisma.ollamaChatSession.update({
      where: { id: chatSession.id },
      data: { updatedAt: new Date() },
    })

    return NextResponse.json({
      sessionId: chatSession.id,
      userMessageId: userMsg.id,
      assistantMessageId: assistantMsg.id,
      status: 'pending',
    })
  } catch (err: unknown) {
    console.error('[Ollama Chat] POST error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/arms/ollama/chat — Fetch sessions list or single message status
// ?action=sessions — List user's sessions
// ?action=messages&sessionId=X — Get messages for a session
// ?action=status&messageId=X — Poll a single message status
// ═══════════════════════════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') || 'sessions'

    if (action === 'sessions') {
      const sessions = await prisma.ollamaChatSession.findMany({
        where: { userId: session.user.id },
        orderBy: { updatedAt: 'desc' },
        take: 50,
        include: {
          _count: { select: { messages: true } },
        },
      })
      return NextResponse.json({ sessions })
    }

    if (action === 'messages') {
      const sessionId = searchParams.get('sessionId')
      if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

      const chatSess = await prisma.ollamaChatSession.findFirst({
        where: { id: sessionId, userId: session.user.id },
      })
      if (!chatSess) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

      const messages = await prisma.ollamaChatMessage.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
      })
      return NextResponse.json({ session: chatSess, messages })
    }

    if (action === 'status') {
      const messageId = searchParams.get('messageId')
      if (!messageId) return NextResponse.json({ error: 'messageId required' }, { status: 400 })

      const msg = await prisma.ollamaChatMessage.findFirst({
        where: { id: messageId, session: { userId: session.user.id } },
        select: { id: true, status: true, content: true, error: true, updatedAt: true },
      })
      if (!msg) return NextResponse.json({ error: 'Message not found' }, { status: 404 })
      return NextResponse.json(msg)
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: unknown) {
    console.error('[Ollama Chat] GET error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH /api/arms/ollama/chat — Bridge submits response or gets pending work
// x-bridge-token auth
// body: { action: 'poll' } → returns pending messages with context
// body: { action: 'respond', messageId, content, status } → updates message
// ═══════════════════════════════════════════════════════════════════════════════
export async function PATCH(req: NextRequest) {
  try {
    const token = req.headers.get('x-bridge-token') || ''
    const userId = await validateBridgeToken(token)
    if (!userId) {
      return NextResponse.json({ error: 'Invalid bridge token' }, { status: 401 })
    }

    const body = await req.json()
    const { action } = body

    // Bridge polls for pending work
    if (action === 'poll') {
      // Find oldest pending assistant message for this user
      const pendingMsg = await prisma.ollamaChatMessage.findFirst({
        where: {
          status: 'pending',
          role: 'assistant',
          session: { userId },
        },
        orderBy: { createdAt: 'asc' },
        include: {
          session: { select: { id: true, model: true } },
        },
      })

      if (!pendingMsg) {
        return NextResponse.json({ pending: false })
      }

      // Mark as processing
      await prisma.ollamaChatMessage.update({
        where: { id: pendingMsg.id },
        data: { status: 'processing' },
      })

      // Get all messages in this session for context
      const allMsgs = await prisma.ollamaChatMessage.findMany({
        where: {
          sessionId: pendingMsg.sessionId,
          NOT: { id: pendingMsg.id },
          status: 'completed',
        },
        orderBy: { createdAt: 'asc' },
        select: { role: true, content: true },
      })

      return NextResponse.json({
        pending: true,
        messageId: pendingMsg.id,
        sessionId: pendingMsg.sessionId,
        model: pendingMsg.session.model,
        messages: allMsgs.map((m) => ({ role: m.role, content: m.content })),
      })
    }

    // Bridge sends streaming partial update
    if (action === 'stream') {
      const { messageId, content: partialContent } = body
      if (!messageId) {
        return NextResponse.json({ error: 'messageId required' }, { status: 400 })
      }
      // Quick update — no ownership check for speed (token already validated)
      await prisma.ollamaChatMessage.update({
        where: { id: messageId },
        data: {
          content: partialContent || '',
          status: 'processing',
        },
      })
      return NextResponse.json({ ok: true })
    }

    // Bridge submits final response
    if (action === 'respond') {
      const { messageId, content, status: msgStatus, error: msgError } = body
      if (!messageId) {
        return NextResponse.json({ error: 'messageId required' }, { status: 400 })
      }

      // Verify the message belongs to this user and is processing
      const msg = await prisma.ollamaChatMessage.findFirst({
        where: {
          id: messageId,
          session: { userId },
          status: { in: ['processing', 'pending'] },
        },
      })
      if (!msg) {
        return NextResponse.json({ error: 'Message not found or not processing' }, { status: 404 })
      }

      // Strip <think>...</think> blocks from model output before storing
      const cleanContent = content ? stripThinkTags(content) : ''

      await prisma.ollamaChatMessage.update({
        where: { id: messageId },
        data: {
          content: cleanContent,
          status: msgStatus || 'completed',
          error: msgError || null,
        },
      })

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: unknown) {
    console.error('[Ollama Chat] PATCH error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /api/arms/ollama/chat — Delete a session
// ═══════════════════════════════════════════════════════════════════════════════
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('sessionId')
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
    }

    const chatSess = await prisma.ollamaChatSession.findFirst({
      where: { id: sessionId, userId: session.user.id },
    })
    if (!chatSess) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    await prisma.ollamaChatSession.delete({ where: { id: sessionId } })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error('[Ollama Chat] DELETE error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
