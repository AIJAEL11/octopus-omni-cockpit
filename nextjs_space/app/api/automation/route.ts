import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, withDbRetry } from '@/lib/prisma'
import { encryptApiKey, decryptApiKey } from '@/lib/crypto'
import { AUTOMATION_PLATFORMS, getPlatform, automationArmType } from '@/lib/automation-platforms'

export const dynamic = 'force-dynamic'

/**
 * GET /api/automation — Lista de plataformas con estado de conexión del usuario
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
        armType: { startsWith: 'automation:' },
      },
      select: { armType: true, status: true, connectedAt: true, credentials: true },
    }))

    const connMap = new Map(connections.map(c => [c.armType, c]))

    const platforms = AUTOMATION_PLATFORMS.map(p => {
      const conn = connMap.get(automationArmType(p.id))
      let username: string | null = null
      if (conn) {
        try {
          const creds = JSON.parse(decryptApiKey(conn.credentials))
          username = creds.username || null
        } catch { /* credenciales ilegibles — se ignoran */ }
      }
      return {
        id: p.id,
        name: p.name,
        emoji: p.emoji,
        color: p.color,
        url: p.url,
        group: p.group,
        descriptionEs: p.descriptionEs,
        descriptionEn: p.descriptionEn,
        suggestedSkillsEs: p.suggestedSkillsEs,
        suggestedSkillsEn: p.suggestedSkillsEn,
        autoLogin: p.selectors !== null,
        connected: !!conn,
        username,
        connectedAt: conn?.connectedAt ?? null,
      }
    })

    return NextResponse.json({ platforms })
  } catch (error) {
    console.error('Automation GET error:', error)
    return NextResponse.json({ error: 'Error obteniendo plataformas' }, { status: 500 })
  }
}

/**
 * POST /api/automation — Guardar credenciales de una plataforma
 * Body: { platform, username, password }
 * Las credenciales se guardan cifradas (mismo patrón que ApiKey).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { platform, username, password } = await request.json()

    const platformDef = getPlatform(platform)
    if (!platformDef) {
      return NextResponse.json({ error: 'Plataforma desconocida' }, { status: 400 })
    }
    if (!username || !password) {
      return NextResponse.json({ error: 'Usuario y contraseña requeridos' }, { status: 400 })
    }

    const armType = automationArmType(platform)
    const encrypted = encryptApiKey(JSON.stringify({ username, password }))

    const existing = await withDbRetry(() => prisma.armConnection.findUnique({
      where: { userId_armType: { userId: session.user.id, armType } },
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
          armType,
          name: platformDef.name,
          credentials: encrypted,
          status: 'connected',
          connectedAt: new Date(),
        },
      }))
    }

    return NextResponse.json({ success: true, platform, username })
  } catch (error) {
    console.error('Automation POST error:', error)
    return NextResponse.json({ error: 'Error guardando credenciales' }, { status: 500 })
  }
}

/**
 * DELETE /api/automation?platform=xxx — Eliminar credenciales
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const platform = searchParams.get('platform')
    if (!platform || !getPlatform(platform)) {
      return NextResponse.json({ error: 'Plataforma requerida' }, { status: 400 })
    }

    await withDbRetry(() => prisma.armConnection.deleteMany({
      where: { userId: session.user.id, armType: automationArmType(platform) },
    }))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Automation DELETE error:', error)
    return NextResponse.json({ error: 'Error eliminando credenciales' }, { status: 500 })
  }
}
