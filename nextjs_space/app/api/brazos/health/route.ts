import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getBotInfo, getWebhookInfo } from '@/lib/telegram'

export const dynamic = 'force-dynamic'

export interface BrazoHealth {
  armType: string
  name: string
  status: string // 'healthy' | 'degraded' | 'disconnected' | 'error'
  dbStatus: string // stored status in DB
  issues: string[]
  suggestions: string[]
  lastChecked: string
}

// GET - Health check de todos los brazos del usuario
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const connections = await prisma.armConnection.findMany({
      where: { userId: session.user.id },
    })

    const results: BrazoHealth[] = []

    for (const conn of connections) {
      const health: BrazoHealth = {
        armType: conn.armType,
        name: conn.name,
        status: 'healthy',
        dbStatus: conn.status,
        issues: [],
        suggestions: [],
        lastChecked: new Date().toISOString(),
      }

      // Si la DB dice desconectado, reportar
      if (conn.status !== 'connected') {
        health.status = 'disconnected'
        health.issues.push(`Estado en base de datos: ${conn.status}`)
        health.suggestions.push('Reconecta este brazo desde Brazos Activos')
        results.push(health)
        continue
      }

      let creds: Record<string, string> = {}
      try {
        creds = JSON.parse(conn.credentials)
      } catch {
        health.status = 'error'
        health.issues.push('Credenciales corruptas o inválidas')
        health.suggestions.push('Desconecta y vuelve a conectar este brazo')
        results.push(health)
        continue
      }

      // === TELEGRAM HEALTH CHECK ===
      if (conn.armType === 'telegram') {
        try {
          if (!creds.botToken) {
            health.status = 'error'
            health.issues.push('No se encontró el Bot Token')
            health.suggestions.push('Reconecta Telegram con un Bot Token válido de @BotFather')
          } else {
            // Verify bot token is valid
            const botInfo = await getBotInfo(creds.botToken)
            if (!botInfo.ok) {
              health.status = 'error'
              health.issues.push('Bot Token inválido o revocado')
              health.suggestions.push('Ve a @BotFather en Telegram → /mybots → selecciona tu bot → API Token. Copia el nuevo token y reconecta.')
            }

            // Check webhook
            const webhookInfo = await getWebhookInfo(creds.botToken)
            if (!webhookInfo.ok || !webhookInfo.result?.url) {
              health.status = health.status === 'error' ? 'error' : 'degraded'
              health.issues.push('Webhook no configurado')
              health.suggestions.push('Ve a Brazos Activos → Telegram → "Activar Webhook" para que el bot pueda recibir mensajes')
            } else {
              const expectedUrl = (process.env.NEXTAUTH_URL || '') + '/api/brazos/telegram/webhook'
              if (!webhookInfo.result.url.includes('/api/brazos/telegram/webhook')) {
                health.status = 'degraded'
                health.issues.push('Webhook apunta a una URL incorrecta')
                health.suggestions.push('Ve a Brazos Activos → Telegram → "Activar Webhook" para actualizar la URL')
              }
              if ((webhookInfo.result.pending_update_count || 0) > 50) {
                health.status = health.status === 'error' ? 'error' : 'degraded'
                health.issues.push(`${webhookInfo.result.pending_update_count} mensajes pendientes acumulados`)
                health.suggestions.push('El webhook puede estar caído. Reactívalo desde Brazos Activos.')
              }
            }

            if (!creds.chatId) {
              health.status = health.status === 'error' ? 'error' : 'degraded'
              health.issues.push('Chat ID no registrado')
              health.suggestions.push('Envía /start al bot desde Telegram para registrar tu Chat ID, luego reconecta.')
            }
          }
        } catch (err) {
          health.status = 'error'
          health.issues.push('No se pudo conectar con la API de Telegram')
          health.suggestions.push('Verifica tu conexión a internet o reintenta en unos minutos')
        }
      }

      // === GOOGLE WORKSPACE HEALTH CHECK (with proactive token refresh) ===
      if (conn.armType === 'google_workspace') {
        try {
          if (!creds.accessToken && !creds.refreshToken) {
            health.status = 'error'
            health.issues.push('Sin tokens de acceso')
            health.suggestions.push('Reconecta Google Workspace haciendo clic en "Reconectar" en Brazos Activos')
          } else {
            // Step 1: Try current access token
            let tokenValid = false
            if (creds.accessToken) {
              const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${creds.accessToken}` },
              })
              tokenValid = res.ok
            }

            if (!tokenValid && creds.refreshToken) {
              // Step 2: Token expired — proactively refresh it now
              try {
                const { getValidAccessToken } = await import('@/lib/google-oauth')
                const { accessToken: newToken, refreshed, newExpiry } = await getValidAccessToken({
                  accessToken: creds.accessToken || '',
                  refreshToken: creds.refreshToken,
                  tokenExpiry: 0, // Force refresh
                })
                if (refreshed && newExpiry) {
                  await prisma.armConnection.update({
                    where: { id: conn.id },
                    data: {
                      credentials: JSON.stringify({ ...creds, accessToken: newToken, tokenExpiry: newExpiry }),
                      status: 'connected',
                    },
                  })
                  console.log(`[Brazos Health] ✅ Proactively refreshed Google token for connection ${conn.id}`)
                  tokenValid = true
                }
              } catch (refreshErr: any) {
                console.error(`[Brazos Health] ❌ Proactive refresh failed:`, refreshErr?.message)
                health.status = 'error'
                health.issues.push('Refresh token expirado o revocado')
                health.suggestions.push('Tu proyecto de Google Cloud podría estar en modo "Testing" (tokens expiran cada 7 días). Publica tu app en Google Cloud Console → OAuth consent screen → "Publish App" para tokens permanentes. Luego reconecta en Brazos.')
              }
            }

            if (!tokenValid && health.status !== 'error') {
              health.status = 'degraded'
              health.issues.push('Token de acceso expirado')
              health.suggestions.push('Reconecta Google Workspace desde Brazos Activos')
            }
          }
        } catch {
          health.status = 'degraded'
          health.issues.push('No se pudo verificar la conexión con Google')
          health.suggestions.push('Verifica tu conexión a internet o reconecta Google Workspace')
        }
      }

      // === HOGAR INTELIGENTE (Bridge) HEALTH CHECK ===
      if (conn.armType === 'hogar_bridge') {
        // Check if bridge has been active recently
        try {
          const recentCommand = await prisma.smartCommand.findFirst({
            where: { userId: session.user.id },
            orderBy: { updatedAt: 'desc' },
          })
          if (recentCommand) {
            const lastActivity = new Date(recentCommand.updatedAt).getTime()
            const now = Date.now()
            if (now - lastActivity > 24 * 60 * 60 * 1000) {
              health.status = 'degraded'
              health.issues.push('No hay actividad del bridge en las últimas 24 horas')
              health.suggestions.push('Verifica que el bridge esté corriendo en tu PC: node octopus-bridge.js')
            }
          }
        } catch { /* ignore */ }
      }

      // If still healthy after all checks
      if (health.issues.length === 0) {
        health.status = 'healthy'
      }

      results.push(health)
    }

    // Summary
    const healthy = results.filter(r => r.status === 'healthy').length
    const degraded = results.filter(r => r.status === 'degraded').length
    const errors = results.filter(r => r.status === 'error' || r.status === 'disconnected').length

    return NextResponse.json({
      overall: errors > 0 ? 'critical' : degraded > 0 ? 'warning' : 'healthy',
      total: results.length,
      healthy,
      degraded,
      errors,
      brazos: results,
      checkedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Brazos Health] Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
