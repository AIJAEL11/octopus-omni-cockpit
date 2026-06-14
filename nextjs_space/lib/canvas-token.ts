/**
 * Token de acceso al preview del Canvas para el Bridge.
 *
 * El navegador real del PC del usuario (visión) no comparte la sesión web,
 * así que el preview acepta ?vt=HMAC(projectId) — válido SOLO para ese
 * proyecto, sin exponer nada más. Server-only (usa crypto de Node).
 */
import { createHmac } from 'crypto'

export function canvasViewToken(projectId: string): string {
  const secret = process.env.NEXTAUTH_SECRET || 'octopus-canvas'
  return createHmac('sha256', secret).update(`canvas-view:${projectId}`).digest('hex').slice(0, 40)
}

export function verifyCanvasViewToken(projectId: string, token: string | null): boolean {
  if (!token) return false
  return token === canvasViewToken(projectId)
}
