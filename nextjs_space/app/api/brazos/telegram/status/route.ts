import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getBotInfo, getWebhookInfo, registerBotCommands, setWebhook, deleteWebhook } from '@/lib/telegram'

export const dynamic = 'force-dynamic'

// GET - Obtener estado del bot de Telegram
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const connection = await prisma.armConnection.findFirst({
      where: { userId: session.user.id, armType: 'telegram', status: 'connected' },
    })

    if (!connection) {
      return NextResponse.json({ connected: false })
    }

    const creds = JSON.parse(connection.credentials)
    if (!creds.botToken) {
      return NextResponse.json({ connected: false, error: 'Sin bot token' })
    }

    // Obtener info del bot
    const botInfo = await getBotInfo(creds.botToken)
    const webhookInfo = await getWebhookInfo(creds.botToken)

    return NextResponse.json({
      connected: true,
      bot: botInfo.ok ? botInfo.result : null,
      webhook: webhookInfo.ok ? webhookInfo.result : null,
      chatId: creds.chatId,
    })
  } catch (error) {
    console.error('[Telegram Status] Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST - Configurar webhook y registrar comandos
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const connection = await prisma.armConnection.findFirst({
      where: { userId: session.user.id, armType: 'telegram', status: 'connected' },
    })

    if (!connection) {
      return NextResponse.json({ error: 'Telegram no conectado' }, { status: 400 })
    }

    const creds = JSON.parse(connection.credentials)
    if (!creds.botToken) {
      return NextResponse.json({ error: 'Sin bot token' }, { status: 400 })
    }

    // Determinar URL base
    const baseUrl = process.env.NEXTAUTH_URL || ''
    if (!baseUrl) {
      return NextResponse.json({ error: 'URL de la app no configurada. Debes desplegar primero.' }, { status: 400 })
    }

    const webhookUrl = `${baseUrl}/api/brazos/telegram/webhook`

    // Registrar webhook
    const webhookResult = await setWebhook(creds.botToken, webhookUrl)
    if (!webhookResult.ok) {
      return NextResponse.json({ error: `Error configurando webhook: ${webhookResult.description}` }, { status: 500 })
    }

    // Registrar comandos
    const commandsResult = await registerBotCommands(creds.botToken)

    return NextResponse.json({
      success: true,
      webhook: webhookUrl,
      commandsRegistered: commandsResult.ok,
    })
  } catch (error) {
    console.error('[Telegram Setup] Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE - Desconectar webhook
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const connection = await prisma.armConnection.findFirst({
      where: { userId: session.user.id, armType: 'telegram', status: 'connected' },
    })

    if (!connection) {
      return NextResponse.json({ error: 'Telegram no conectado' }, { status: 400 })
    }

    const creds = JSON.parse(connection.credentials)
    if (creds.botToken) {
      await deleteWebhook(creds.botToken)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Telegram Disconnect] Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
