import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { buildAuthorizationUrl } from '@/lib/google-oauth'

export const dynamic = 'force-dynamic'

/** Helper: construye URL de redirect usando NEXTAUTH_URL (URL pública) */
function buildRedirect(path: string): string {
  let base = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  base = base.replace(/\/$/, '')
  return `${base}${path}`
}

/**
 * GET /api/brazos/google/authorize
 * Inicia el flujo OAuth usando las credenciales del servidor.
 * Flujo simplificado — el usuario solo hace clic y autoriza.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.redirect(buildRedirect('/login'))
    }

    // Detect actual host from request (supports multi-domain: octopuskills.com, *.abacusai.app)
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || ''

    // El state contiene el userId + host para validar en el callback
    const state = Buffer.from(
      JSON.stringify({ userId: session.user.id, ts: Date.now(), host })
    ).toString('base64url')
    
    // Construir URL de autorización usando credenciales del servidor
    const authUrl = buildAuthorizationUrl(state, host)
    
    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('Error en authorize:', error)
    return NextResponse.redirect(buildRedirect('/dashboard/brazos?error=auth_failed'))
  }
}