import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { deploySessionToVps } from '@/lib/vps-deploy'

export const dynamic = 'force-dynamic'
// El deploy real corre npm install + build + PM2 en el VPS: puede tardar.
export const maxDuration = 300

/**
 * POST /api/arms/claude-code/vps-deploy
 *
 * Despliega una sesión del Code Engine al VPS conectado del usuario y deja la
 * app corriendo con PM2. Las credenciales SSH se resuelven server-side dentro
 * de deploySessionToVps — nunca llegan al cliente ni a ningún LLM.
 *
 * Body: { sessionId }
 * Respuesta: { success, url, appName, filesCount, logs[] }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { sessionId } = await req.json().catch(() => ({}))
    if (!sessionId) return NextResponse.json({ error: 'sessionId requerido' }, { status: 400 })

    const result = await deploySessionToVps(session.user.id, String(sessionId))
    if (!result.success) {
      return NextResponse.json({ error: result.error, logs: result.logs }, { status: 400 })
    }
    return NextResponse.json(result)
  } catch (error) {
    console.error('VPS deploy error:', error)
    return NextResponse.json({ error: 'Error desplegando al VPS' }, { status: 500 })
  }
}
