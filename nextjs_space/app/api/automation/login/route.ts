import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, withDbRetry } from '@/lib/prisma'
import { decryptApiKey } from '@/lib/crypto'
import { getPlatform, automationArmType } from '@/lib/automation-platforms'

export const dynamic = 'force-dynamic'

/**
 * POST /api/automation/login — Auto-login en una plataforma vía el Bridge
 *
 * Construye los comandos de navegador de forma explícita y determinista
 * (goto → wait → type → type → click). Las credenciales NUNCA pasan por
 * un LLM — anti-smoke y privacidad primero.
 *
 * Body: { platform }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const userId = session.user.id

    const { platform } = await request.json()
    const platformDef = getPlatform(platform)
    if (!platformDef) {
      return NextResponse.json({ error: 'Plataforma desconocida' }, { status: 400 })
    }

    // 1. Verificar Bridge real (anti-smoke: heartbeat < 45s)
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
        message: 'El Bridge está desconectado. Abre el Octopus Bridge en tu PC y reintenta.',
      }, { status: 409 })
    }

    // 2. Recuperar credenciales guardadas
    const credConn = await withDbRetry(() => prisma.armConnection.findUnique({
      where: { userId_armType: { userId, armType: automationArmType(platform) } },
      select: { credentials: true },
    }))

    let creds: { username: string; password: string } | null = null
    if (credConn) {
      try {
        creds = JSON.parse(decryptApiKey(credConn.credentials))
      } catch { /* ilegibles */ }
    }

    // 3. Crear (o reutilizar) sesión de navegador
    let browserSession = await withDbRetry(() => prisma.browserSession.findFirst({
      where: { userId, status: { in: ['idle', 'active'] } },
      orderBy: { updatedAt: 'desc' },
    }))
    if (!browserSession) {
      browserSession = await withDbRetry(() => prisma.browserSession.create({
        data: { userId, name: `Login ${platformDef.name}`, status: 'active' },
      }))
    }

    // 4. Construir secuencia de comandos determinista
    type Step = { type: string; params: Record<string, unknown> }
    const steps: Step[] = [
      { type: 'goto', params: { url: platformDef.loginUrl } },
      { type: 'wait', params: { ms: 2500 } },
    ]

    const sel = platformDef.selectors
    if (sel && creds) {
      steps.push({ type: 'type', params: { selector: sel.username, text: creds.username } })
      if (sel.twoStep) {
        // Plataformas como X piden el usuario primero, Enter, luego contraseña
        steps.push({ type: 'keypress', params: { key: 'Enter' } })
        steps.push({ type: 'wait', params: { ms: 2000 } })
      }
      steps.push({ type: 'type', params: { selector: sel.password, text: creds.password } })
      steps.push({ type: 'click', params: { selector: sel.submit } })
      steps.push({ type: 'wait', params: { ms: 3000 } })
    }

    // 5. Encolar comandos
    const created: string[] = []
    for (const step of steps) {
      const cmd = await withDbRetry(() => prisma.browserCommand.create({
        data: {
          userId,
          sessionId: browserSession!.id,
          type: step.type,
          params: step.params as object,
          status: 'pending',
        },
      }))
      created.push(cmd.id)
    }

    if (browserSession!.status === 'idle') {
      await withDbRetry(() => prisma.browserSession.update({
        where: { id: browserSession!.id },
        data: { status: 'active' },
      }))
    }

    const mode = sel && creds ? 'auto_login' : 'open_login_page'
    return NextResponse.json({
      success: true,
      mode,
      sessionId: browserSession!.id,
      commandsQueued: created.length,
      message: mode === 'auto_login'
        ? `Auto-login en ${platformDef.name} enviado al Bridge (${created.length} comandos).`
        : `Página de login de ${platformDef.name} abierta en el Bridge — completa el acceso manualmente.`,
    })
  } catch (error) {
    console.error('Automation login error:', error)
    return NextResponse.json({ error: 'Error ejecutando login' }, { status: 500 })
  }
}
