// Utilidades de Google OAuth para el Brazo Google Workspace
// Credenciales centralizadas en el servidor — flujo simplificado para el usuario

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
]

/** Obtiene las credenciales OAuth del servidor (.env) */
export function getServerCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_WORKSPACE_CLIENT_ID || ''
  const clientSecret = process.env.GOOGLE_WORKSPACE_CLIENT_SECRET || ''
  if (!clientId || !clientSecret) {
    throw new Error('Google Workspace OAuth credentials not configured on server')
  }
  return { clientId, clientSecret }
}

export function getRedirectUri(requestHost?: string): string {
  // Use the actual request host if provided — critical for multi-domain setups
  // (e.g., octopuskills.com AND octopus-omni-cockpit-n8hd61.abacusai.app)
  // The redirect URI MUST match the domain the user is on, AND be registered in Google Console
  if (requestHost) {
    const proto = requestHost.includes('localhost') ? 'http' : 'https'
    return `${proto}://${requestHost}/api/brazos/google/callback`
  }
  let base = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  base = base.replace(/\/$/, '')
  return `${base}/api/brazos/google/callback`
}

export function buildAuthorizationUrl(state: string, requestHost?: string): string {
  const { clientId } = getServerCredentials()
  const redirectUri = getRedirectUri(requestHost)
  console.log('[Google OAuth] Building auth URL with redirect_uri:', redirectUri)
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<{
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
  scope: string
}> {
  const { clientId, clientSecret } = getServerCredentials()
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    console.error('Google token exchange error:', err)
    throw new Error(`Error al obtener tokens: ${res.status}`)
  }
  return res.json()
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<{ access_token: string; expires_in: number }> {
  const { clientId, clientSecret } = getServerCredentials()
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    console.error('Google token refresh error:', err)
    throw new Error(`Error al refrescar token: ${res.status}`)
  }
  return res.json()
}

/** Obtiene un access token válido, refrescando si es necesario */
export async function getValidAccessToken(credentials: {
  accessToken: string
  refreshToken: string
  tokenExpiry: number
}): Promise<{ accessToken: string; refreshed: boolean; newExpiry?: number }> {
  const now = Date.now()
  // Si el token expira en menos de 5 minutos, refrescar
  if (now < credentials.tokenExpiry - 5 * 60 * 1000) {
    return { accessToken: credentials.accessToken, refreshed: false }
  }
  const result = await refreshAccessToken(credentials.refreshToken)
  return {
    accessToken: result.access_token,
    refreshed: true,
    newExpiry: now + result.expires_in * 1000,
  }
}

/** Llama a cualquier Google API con token auto-refresh */
export async function googleApiFetch(
  url: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<Response> {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    },
  })
  return res
}
