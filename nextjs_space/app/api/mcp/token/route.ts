import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { mcpServerToken } from '@/lib/mcp-server-token'

export const dynamic = 'force-dynamic'

/**
 * GET /api/mcp/token — Token MCP del usuario logueado + datos de conexión.
 * El token es derivado (HMAC), estable por cuenta y NUNCA pasa por ningún LLM:
 * solo viaja del servidor a la página de conexión del propio usuario.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const origin = process.env.NEXTAUTH_URL || new URL(request.url).origin
    const token = mcpServerToken(session.user.id)
    const endpoint = `${origin}/api/mcp`

    return NextResponse.json({
      token,
      endpoint,
      claudeCodeCommand: `claude mcp add --transport http octopus ${endpoint} --header "Authorization: Bearer ${token}"`,
    })
  } catch (error) {
    console.error('MCP token error:', error)
    return NextResponse.json({ error: 'Error generando el token' }, { status: 500 })
  }
}
