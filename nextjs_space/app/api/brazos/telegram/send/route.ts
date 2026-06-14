import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendTelegramMessage, formatOctopusNotification } from '@/lib/telegram'

export const dynamic = 'force-dynamic'

// POST - Enviar mensaje a Telegram
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { message, type, title, details } = await request.json()

    // Obtener credenciales de Telegram
    const connection = await prisma.armConnection.findFirst({
      where: { userId: session.user.id, armType: 'telegram', status: 'connected' },
    })

    if (!connection) {
      return NextResponse.json({ error: 'Telegram no conectado. Ve a Brazos para configurar.' }, { status: 400 })
    }

    const creds = JSON.parse(connection.credentials)
    if (!creds.botToken || !creds.chatId) {
      return NextResponse.json({ error: 'Credenciales de Telegram incompletas' }, { status: 400 })
    }

    // Formatear mensaje
    let text: string
    if (type && title) {
      text = formatOctopusNotification(type, title, details)
    } else if (message) {
      text = message
    } else {
      return NextResponse.json({ error: 'Mensaje requerido' }, { status: 400 })
    }

    // Enviar
    const result = await sendTelegramMessage(creds.botToken, creds.chatId, text)

    if (!result.ok) {
      console.error('[Telegram] Error enviando:', result.description)
      return NextResponse.json({ error: result.description || 'Error enviando mensaje' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Mensaje enviado a Telegram' })
  } catch (error) {
    console.error('[Telegram] Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
