import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ORCHESTRATOR_SYSTEM_PROMPT } from '@/lib/orchestrator'
import { retrieveRelevantKnowledge, formatKnowledgeForPrompt } from '@/lib/knowledge-base'
import { getUserTurboConfig, buildTurboRequest } from '@/lib/turbo-llm'

export const dynamic = 'force-dynamic'

// POST - Enviar mensaje al Orquestador con RAG
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { message, sessionId } = body

    if (!message) {
      return NextResponse.json({ error: 'Mensaje requerido' }, { status: 400 })
    }

    // Obtener o crear sesión de chat
    let chatSession: {
      id: string
      userId: string
      title: string
      messages: { role: string; content: string }[]
    } | null = null

    if (sessionId) {
      chatSession = await prisma.chatSession.findFirst({
        where: { id: sessionId, userId: session.user.id },
        include: { messages: { orderBy: { createdAt: 'asc' } } }
      })
    }

    if (!chatSession) {
      chatSession = await prisma.chatSession.create({
        data: {
          userId: session.user.id,
          title: message.slice(0, 50) + (message.length > 50 ? '...' : ''),
        },
        include: { messages: true }
      })
    }

    // Guardar mensaje del usuario
    const userMessage = await prisma.chatMessage.create({
      data: {
        sessionId: chatSession!.id,
        role: 'user',
        content: message,
      }
    })

    // ============================================
    // RAG 2.0: Recuperar conocimiento relevante
    // ============================================
    const relevantKnowledge = await retrieveRelevantKnowledge(message, {
      limit: 5,
    })
    const knowledgeContext = formatKnowledgeForPrompt(relevantKnowledge)

    // Construir historial de mensajes para el LLM
    const historyMessages = chatSession!.messages.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }))

    // Sistema enriquecido con conocimiento RAG
    const enrichedSystemPrompt = `${ORCHESTRATOR_SYSTEM_PROMPT}

${knowledgeContext}`

    const messages = [
      { role: 'system', content: enrichedSystemPrompt },
      ...historyMessages,
      { role: 'user', content: message }
    ]

    // TURBO MODE: Verificar si el usuario tiene Turbo activado
    const turboConfig = await getUserTurboConfig(session.user.id)
    const turboReq = turboConfig.enabled ? buildTurboRequest(turboConfig, messages as { role: string; content: string | unknown[] }[], { temperature: 0.7, maxTokens: 8000, stream: true }) : null

    // Llamar al LLM con streaming (turbo o estándar)
    const response = await fetch(
      turboReq?.url || 'https://apps.abacus.ai/v1/chat/completions',
      {
        method: 'POST',
        headers: turboReq?.headers || {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`
        },
        body: turboReq?.body || JSON.stringify({
          model: 'gpt-4.1',
          messages,
          stream: true,
          max_tokens: 8000,
          temperature: 0.7,
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('LLM API Error:', errorText)
      return NextResponse.json({ error: 'Error en el servicio de IA' }, { status: 500 })
    }

    // Stream la respuesta
    const encoder = new TextEncoder()
    let fullResponse = ''

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        let partialRead = ''

        try {
          // Enviar sessionId al inicio
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'session', sessionId: chatSession!.id })}\n\n`))

          while (true) {
            const { done, value } = await reader!.read()
            if (done) break

            partialRead += decoder.decode(value, { stream: true })
            const lines = partialRead.split('\n')
            partialRead = lines.pop() || ''

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6)
                if (data === '[DONE]') {
                  // Guardar respuesta completa con ID para feedback
                  const assistantMessage = await prisma.chatMessage.create({
                    data: {
                      sessionId: chatSession!.id,
                      role: 'assistant',
                      content: fullResponse,
                    }
                  })
                  // Incluir messageId para permitir feedback
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                    type: 'done', 
                    content: fullResponse,
                    messageId: assistantMessage.id,
                    hasKnowledge: relevantKnowledge.length > 0,
                    knowledgeCount: relevantKnowledge.length
                  })}\n\n`))
                  controller.close()
                  return
                }
                try {
                  const parsed = JSON.parse(data)
                  const content = parsed.choices?.[0]?.delta?.content || ''
                  if (content) {
                    fullResponse += content
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content })}\n\n`))
                  }
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          }
        } catch (error) {
          console.error('Stream error:', error)
          controller.error(error)
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
    console.error('Chat error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// GET - Obtener sesiones de chat
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (sessionId) {
      // Obtener una sesión específica con mensajes
      const chatSession = await prisma.chatSession.findFirst({
        where: { id: sessionId, userId: session.user.id },
        include: { messages: { orderBy: { createdAt: 'asc' } } }
      })
      return NextResponse.json({ session: chatSession })
    }

    // Obtener todas las sesiones
    const sessions = await prisma.chatSession.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    })

    return NextResponse.json({ sessions })
  } catch (error) {
    console.error('Error fetching sessions:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
