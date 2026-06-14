import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const JARVIS_SESSION_TITLE = 'JARVIS Assistant Session'

// GET: Cargar conversación de JARVIS
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Buscar sesión de JARVIS existente o crear una nueva.
    // IMPORTANT: To always return the **newest** 500 messages (not the oldest 500 like a
    // naive `orderBy: asc + take: 500` would do for users with >500 messages), we fetch
    // them in descending order and reverse them into ascending order for the UI.
    let jarvisSession = await prisma.chatSession.findFirst({
      where: {
        userId: session.user.id,
        title: JARVIS_SESSION_TITLE,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 500, // Últimos 500 mensajes (newest first, will reverse below)
        },
      },
    })

    if (!jarvisSession) {
      // Crear nueva sesión de JARVIS
      jarvisSession = await prisma.chatSession.create({
        data: {
          userId: session.user.id,
          title: JARVIS_SESSION_TITLE,
          status: 'active',
        },
        include: {
          messages: true,
        },
      })
    }

    // Reverse so UI gets oldest → newest chronological order
    const messagesAsc = [...jarvisSession.messages].reverse()

    // Transformar mensajes al formato esperado por el frontend
    const messages = messagesAsc.map(msg => {
      // Parse metadata si existe
      let metadata: Record<string, unknown> = {}
      if (msg.metadata) {
        try {
          metadata = JSON.parse(msg.metadata)
        } catch {
          metadata = {}
        }
      }

      return {
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.createdAt.toISOString(),
        generatedImage: metadata.generatedImage || undefined,
        actionResult: metadata.actionResult || undefined,
        isCodeShown: metadata.isCodeShown || undefined,
        isOjos: metadata.isOjos || undefined,
        codeContent: metadata.codeContent || undefined,
        fileName: metadata.fileName || undefined,
      }
    })

    return NextResponse.json({
      sessionId: jarvisSession.id,
      messages,
      userName: session.user.name || undefined,
    })
  } catch (error) {
    console.error('Error loading JARVIS memory:', error)
    return NextResponse.json({ error: 'Error cargando memoria' }, { status: 500 })
  }
}

// POST: Guardar mensaje en la conversación de JARVIS
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { message, sessionId } = body

    if (!message || !sessionId) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    // Verificar que la sesión pertenece al usuario
    const jarvisSession = await prisma.chatSession.findFirst({
      where: {
        id: sessionId,
        userId: session.user.id,
      },
    })

    if (!jarvisSession) {
      return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })
    }

    // Crear metadata para campos especiales
    const metadata: Record<string, unknown> = {}
    if (message.generatedImage) metadata.generatedImage = message.generatedImage
    if (message.actionResult) metadata.actionResult = message.actionResult
    if (message.isCodeShown !== undefined) metadata.isCodeShown = message.isCodeShown
    if (message.isOjos !== undefined) metadata.isOjos = message.isOjos
    if (message.codeContent) metadata.codeContent = message.codeContent
    if (message.fileName) metadata.fileName = message.fileName

    // Guardar mensaje
    const savedMessage = await prisma.chatMessage.create({
      data: {
        sessionId,
        role: message.role,
        content: message.content || '',
        metadata: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
      },
    })

    // Actualizar timestamp de la sesión
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    })

    return NextResponse.json({
      success: true,
      messageId: savedMessage.id,
    })
  } catch (error) {
    console.error('Error saving JARVIS message:', error)
    return NextResponse.json({ error: 'Error guardando mensaje' }, { status: 500 })
  }
}

// DELETE: Limpiar conversación de JARVIS
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID requerido' }, { status: 400 })
    }

    // Verificar que la sesión pertenece al usuario
    const jarvisSession = await prisma.chatSession.findFirst({
      where: {
        id: sessionId,
        userId: session.user.id,
        title: JARVIS_SESSION_TITLE,
      },
    })

    if (!jarvisSession) {
      return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })
    }

    // Borrar todos los mensajes de la sesión
    await prisma.chatMessage.deleteMany({
      where: { sessionId },
    })

    return NextResponse.json({ success: true, message: 'Memoria limpiada' })
  } catch (error) {
    console.error('Error clearing JARVIS memory:', error)
    return NextResponse.json({ error: 'Error limpiando memoria' }, { status: 500 })
  }
}
