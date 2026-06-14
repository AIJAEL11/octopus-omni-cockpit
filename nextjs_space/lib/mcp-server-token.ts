/**
 * Token de acceso al MCP Server de OCTOPUS.
 *
 * Clientes MCP externos (Claude Code CLI/IDE, Claude Desktop, cursor...) no
 * comparten la sesión web, así que /api/mcp acepta Authorization: Bearer
 * octk_{userId}.{HMAC} — derivado, sin tabla nueva (cero migraciones).
 * El token da acceso SOLO a los recursos del dueño. Server-only (crypto Node).
 */
import { createHmac, timingSafeEqual } from 'crypto'

const PREFIX = 'octk_'

function sign(userId: string): string {
  const secret = process.env.NEXTAUTH_SECRET || 'octopus-mcp'
  return createHmac('sha256', secret).update(`octopus-mcp:${userId}`).digest('hex').slice(0, 40)
}

export function mcpServerToken(userId: string): string {
  return `${PREFIX}${userId}.${sign(userId)}`
}

/** Devuelve el userId si el token es válido, null si no. */
export function verifyMcpServerToken(token: string | null | undefined): string | null {
  if (!token || !token.startsWith(PREFIX)) return null
  const body = token.slice(PREFIX.length)
  const dot = body.lastIndexOf('.')
  if (dot <= 0) return null
  const userId = body.slice(0, dot)
  if (userId.length > 64 || !/^[\w-]+$/.test(userId)) return null
  const sig = body.slice(dot + 1)
  const expected = sign(userId)
  if (sig.length !== expected.length) return null
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  } catch {
    return null
  }
  return userId
}
