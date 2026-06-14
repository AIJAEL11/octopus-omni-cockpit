import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, withDbRetry } from '@/lib/prisma'
import { canvasViewToken } from '@/lib/canvas-token'

export const dynamic = 'force-dynamic'

/**
 * 👁️ VISIÓN DEL CANVAS — captura real vía Bridge
 *
 * POST { projectId } → encola en el navegador del PC del usuario:
 *   goto(preview con token) → wait → screenshot
 * Devuelve el commandId del screenshot para hacer polling.
 *
 * GET ?commandId= → estado del comando + screenshotUrl cuando complete.
 *
 * Anti-smoke: si el Bridge no reporta heartbeat (<45s) se responde
 * bridge_offline en lugar de fingir que se capturó algo.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const userId = session.user.id

    const { projectId } = await request.json()
    const project = await withDbRetry(() => prisma.project.findFirst({
      where: { id: projectId, userId, projectType: 'canvas' },
      select: { id: true, name: true },
    }))
    if (!project) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })

    // 1. Bridge real conectado (heartbeat < 45s)
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
        message: 'El Bridge está desconectado. Ábrelo en tu PC para usar la visión.',
      }, { status: 409 })
    }

    // 2. Sesión de navegador
    let browserSession = await withDbRetry(() => prisma.browserSession.findFirst({
      where: { userId, status: { in: ['idle', 'active', 'running'] } },
      orderBy: { updatedAt: 'desc' },
    }))
    if (!browserSession) {
      browserSession = await withDbRetry(() => prisma.browserSession.create({
        data: { userId, name: `Visión: ${project.name}`, status: 'active' },
      }))
    }

    // 3. URL del preview con token de visión (el navegador del PC no tiene sesión web)
    const origin = process.env.NEXTAUTH_URL || new URL(request.url).origin
    const vt = canvasViewToken(project.id)
    const previewUrl = `${origin}/api/canvas/preview/${project.id}/index.html?vt=${vt}`

    // 4. Encolar: goto → wait → screenshot
    const goto = await withDbRetry(() => prisma.browserCommand.create({
      data: { userId, sessionId: browserSession!.id, type: 'goto', params: { url: previewUrl }, status: 'pending' },
    }))
    await withDbRetry(() => prisma.browserCommand.create({
      data: { userId, sessionId: browserSession!.id, type: 'wait', params: { ms: 3500 }, status: 'pending' },
    }))
    const shot = await withDbRetry(() => prisma.browserCommand.create({
      data: { userId, sessionId: browserSession!.id, type: 'screenshot', params: { fullPage: false }, status: 'pending' },
    }))

    if (browserSession!.status === 'idle') {
      await withDbRetry(() => prisma.browserSession.update({
        where: { id: browserSession!.id },
        data: { status: 'active' },
      }))
    }

    return NextResponse.json({
      success: true,
      sessionId: browserSession!.id,
      gotoCommandId: goto.id,
      screenshotCommandId: shot.id,
    })
  } catch (error) {
    console.error('Canvas vision error:', error)
    return NextResponse.json({ error: 'Error solicitando la captura' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const commandId = new URL(request.url).searchParams.get('commandId')
    if (!commandId) return NextResponse.json({ error: 'commandId requerido' }, { status: 400 })

    const cmd = await withDbRetry(() => prisma.browserCommand.findFirst({
      where: { id: commandId, userId: session.user.id },
      select: { status: true, screenshotUrl: true, error: true },
    }))
    if (!cmd) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    return NextResponse.json({
      status: cmd.status,
      screenshotUrl: cmd.screenshotUrl,
      error: cmd.error,
    })
  } catch (error) {
    console.error('Canvas vision poll error:', error)
    return NextResponse.json({ error: 'Error consultando estado' }, { status: 500 })
  }
}
