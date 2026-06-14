import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, withDbRetry } from '@/lib/prisma'
import { encryptApiKey } from '@/lib/crypto'
import { parseStoredCreds } from '@/lib/twilio-channels'

export const dynamic = 'force-dynamic'

const CHANNEL_TYPES = ['telegram', 'whatsapp', 'sms'] as const
type ChannelType = typeof CHANNEL_TYPES[number]

/**
 * GET /api/channels — Estado de conexión de todos los canales
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const connections = await withDbRetry(() => prisma.armConnection.findMany({
      where: {
        userId: session.user.id,
        armType: { in: CHANNEL_TYPES as unknown as string[] },
      },
      select: { armType: true, status: true, connectedAt: true, credentials: true, updatedAt: true },
    }))

    const connMap = new Map(connections.map(c => [c.armType, c]))

    const channels = CHANNEL_TYPES.map(type => {
      const conn = connMap.get(type)
      let phoneNumber: string | null = null
      let chatId: string | null = null
      if (conn) {
        const creds = parseStoredCreds(conn.credentials)
        phoneNumber = creds?.phoneNumber || null
        chatId = creds?.chatId || null
      }
      return {
        type,
        connected: !!conn,
        status: conn?.status ?? null,
        connectedAt: conn?.connectedAt ?? null,
        updatedAt: conn?.updatedAt ?? null,
        phoneNumber,
        chatId,
      }
    })

    return NextResponse.json({ channels })
  } catch (error) {
    console.error('Channels GET error:', error)
    return NextResponse.json({ error: 'Error obteniendo canales' }, { status: 500 })
  }
}

/**
 * POST /api/channels — Guardar credenciales de canal
 * Body: { type, accountSid?, authToken?, phoneNumber?, botToken?, chatId? }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { type } = body

    if (!CHANNEL_TYPES.includes(type as ChannelType)) {
      return NextResponse.json({ error: 'Tipo de canal inválido' }, { status: 400 })
    }

    let creds: Record<string, string>
    let name: string

    if (type === 'whatsapp' || type === 'sms') {
      const { accountSid, authToken, phoneNumber } = body
      if (!accountSid || !authToken || !phoneNumber) {
        return NextResponse.json({ error: 'accountSid, authToken y phoneNumber requeridos' }, { status: 400 })
      }
      creds = { accountSid, authToken, phoneNumber }
      name = type === 'whatsapp' ? 'WhatsApp (Twilio)' : 'SMS (Twilio)'
    } else {
      // telegram — existing flow; bot token + chatId
      const { botToken, chatId } = body
      if (!botToken || !chatId) {
        return NextResponse.json({ error: 'botToken y chatId requeridos' }, { status: 400 })
      }
      creds = { botToken, chatId }
      name = 'Telegram Bot'
    }

    // Telegram se guarda en JSON plano por compatibilidad con las rutas
    // existentes (/api/brazos/telegram/*); Twilio se guarda cifrado.
    const encrypted = type === 'telegram'
      ? JSON.stringify(creds)
      : encryptApiKey(JSON.stringify(creds))
    const existing = await withDbRetry(() => prisma.armConnection.findUnique({
      where: { userId_armType: { userId: session.user.id, armType: type } },
    }))

    if (existing) {
      await withDbRetry(() => prisma.armConnection.update({
        where: { id: existing.id },
        data: { credentials: encrypted, status: 'connected', connectedAt: new Date() },
      }))
    } else {
      await withDbRetry(() => prisma.armConnection.create({
        data: {
          userId: session.user.id,
          armType: type,
          name,
          credentials: encrypted,
          status: 'connected',
          connectedAt: new Date(),
        },
      }))
    }

    return NextResponse.json({ success: true, type })
  } catch (error) {
    console.error('Channels POST error:', error)
    return NextResponse.json({ error: 'Error guardando canal' }, { status: 500 })
  }
}

/**
 * DELETE /api/channels?type=xxx
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    if (!type || !CHANNEL_TYPES.includes(type as ChannelType)) {
      return NextResponse.json({ error: 'Tipo requerido' }, { status: 400 })
    }

    await withDbRetry(() => prisma.armConnection.deleteMany({
      where: { userId: session.user.id, armType: type },
    }))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Channels DELETE error:', error)
    return NextResponse.json({ error: 'Error eliminando canal' }, { status: 500 })
  }
}
