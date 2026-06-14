import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { exchangeCodeForTokens, getRedirectUri } from '@/lib/google-oauth'

export const dynamic = 'force-dynamic'

/** Helper: construye URL de redirect usando NEXTAUTH_URL (URL pública) */
function buildRedirect(path: string): string {
  let base = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  base = base.replace(/\/$/, '')
  return `${base}${path}`
}

/**
 * GET /api/brazos/google/callback?code=xxx&state=xxx
 * Google redirige aquí después de que el usuario autoriza.
 * Intercambia el code por tokens usando credenciales del servidor.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const stateParam = searchParams.get('state')
    const errorParam = searchParams.get('error')

    // Si el usuario canceló
    if (errorParam) {
      console.error('Google OAuth error:', errorParam)
      return NextResponse.redirect(buildRedirect('/dashboard/brazos?error=oauth_denied'))
    }

    if (!code || !stateParam) {
      return NextResponse.redirect(buildRedirect('/dashboard/brazos?error=missing_params'))
    }

    // Decodificar state para obtener userId + host
    let stateData: { userId: string; ts: number; host?: string }
    try {
      stateData = JSON.parse(Buffer.from(stateParam, 'base64url').toString())
    } catch {
      return NextResponse.redirect(buildRedirect('/dashboard/brazos?error=invalid_state'))
    }

    // Verificar que el usuario actual coincide con el state
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || session.user.id !== stateData.userId) {
      return NextResponse.redirect(buildRedirect('/dashboard/brazos?error=session_mismatch'))
    }

    // CRITICAL: use the SAME redirect URI that was used in authorize (from state.host)
    // This ensures the redirect_uri matches exactly what Google received
    const redirectUri = getRedirectUri(stateData.host)
    console.log('[Google Callback] Using redirect URI:', redirectUri)

    // Intercambiar code por tokens usando credenciales del servidor
    const tokens = await exchangeCodeForTokens(code, redirectUri)

    // Guardar/actualizar la conexión del usuario
    const credentials = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || '',
      tokenExpiry: Date.now() + tokens.expires_in * 1000,
      scopes: tokens.scope,
      authorizedAt: new Date().toISOString(),
    }

    // Buscar conexión existente o crear una nueva
    const existing = await prisma.armConnection.findFirst({
      where: {
        userId: session.user.id,
        armType: 'google_workspace',
      },
    })

    if (existing) {
      // Preservar refresh token existente si no viene uno nuevo
      const existingCreds = JSON.parse(existing.credentials)
      if (!credentials.refreshToken && existingCreds.refreshToken) {
        credentials.refreshToken = existingCreds.refreshToken
      }
      await prisma.armConnection.update({
        where: { id: existing.id },
        data: {
          credentials: JSON.stringify(credentials),
          status: 'connected',
          connectedAt: new Date(),
        },
      })
    } else {
      await prisma.armConnection.create({
        data: {
          userId: session.user.id,
          armType: 'google_workspace',
          name: 'Google Workspace',
          credentials: JSON.stringify(credentials),
          status: 'connected',
          connectedAt: new Date(),
        },
      })
    }

    console.log('[Google Callback] ¡Tokens guardados exitosamente!')
    return NextResponse.redirect(buildRedirect('/dashboard/brazos?success=google_connected'))
  } catch (error) {
    console.error('Error en callback de Google:', error)
    return NextResponse.redirect(buildRedirect('/dashboard/brazos?error=callback_failed'))
  }
}