import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, withDbRetry } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * POST /api/canvas/clone
 * Body: { url }
 *
 * Usa el Bridge para capturar una foto real del sitio objetivo y
 * devuelve el screenshotCommandId para hacer polling.
 * El LLM en el chat recibe la captura y replica el diseño en un nuevo Canvas.
 *
 * Anti-smoke: verifica heartbeat del Bridge < 45s antes de encolar.
 * Seguridad: solo acepta URLs http/https públicas (bloquea localhost, IPs).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const userId = session.user.id

    const { url } = await request.json()
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL requerida' }, { status: 400 })
    }

    // Validación de seguridad: solo URLs públicas http/https
    let parsed: URL
    try { parsed = new URL(url) } catch {
      return NextResponse.json({ error: 'URL inválida' }, { status: 400 })
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return NextResponse.json({ error: 'Solo URLs http/https' }, { status: 400 })
    }
    // Bloquear localhost e IPs privadas
    const host = parsed.hostname.toLowerCase()
    if (
      host === 'localhost' ||
      host.startsWith('127.') ||
      host.startsWith('192.168.') ||
      host.startsWith('10.') ||
      host === '0.0.0.0' ||
      /^\[?::1\]?$/.test(host)
    ) {
      return NextResponse.json({ error: 'URL no permitida' }, { status: 400 })
    }

    // Verificar Bridge conectado (heartbeat < 45s)
    const arm = await withDbRetry(() => prisma.armConnection.findUnique({
      where: { userId_armType: { userId, armType: 'browser_automation' } },
      select: { status: true, updatedAt: true },
    }))
    const bridgeOnline = !!arm && arm.status === 'connected' &&
      Date.now() - new Date(arm.updatedAt).getTime() < 45000
    if (!bridgeOnline) {
      return NextResponse.json({
        success: false,
        error: 'bridge_offline',
        message: 'El Bridge está desconectado. Ábrelo en tu PC para clonar sitios.',
      }, { status: 409 })
    }

    // Sesión de navegador
    let browserSession = await withDbRetry(() => prisma.browserSession.findFirst({
      where: { userId, status: { in: ['idle', 'active', 'running'] } },
      orderBy: { updatedAt: 'desc' },
    }))
    if (!browserSession) {
      browserSession = await withDbRetry(() => prisma.browserSession.create({
        data: { userId, name: `Clonar: ${parsed.hostname}`, status: 'active' },
      }))
    }

    // Encolar: goto → wait (5s para JS heavy) → screenshot
    await withDbRetry(() => prisma.browserCommand.create({
      data: { userId, sessionId: browserSession!.id, type: 'goto', params: { url }, status: 'pending' },
    }))
    await withDbRetry(() => prisma.browserCommand.create({
      data: { userId, sessionId: browserSession!.id, type: 'wait', params: { ms: 5000 }, status: 'pending' },
    }))
    const shot = await withDbRetry(() => prisma.browserCommand.create({
      data: { userId, sessionId: browserSession!.id, type: 'screenshot', params: { fullPage: false }, status: 'pending' },
    }))

    if (browserSession.status === 'idle') {
      await withDbRetry(() => prisma.browserSession.update({
        where: { id: browserSession!.id },
        data: { status: 'active' },
      }))
    }

    return NextResponse.json({
      success: true,
      screenshotCommandId: shot.id,
      sessionId: browserSession.id,
      targetUrl: url,
    })
  } catch (error) {
    console.error('Canvas clone error:', error)
    return NextResponse.json({ error: 'Error iniciando la clonación' }, { status: 500 })
  }
}
