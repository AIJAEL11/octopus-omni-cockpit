import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, withDbRetry } from '@/lib/prisma'
import { parseStoredCreds, sendWhatsAppMessage, sendSmsMessage } from '@/lib/twilio-channels'

export const dynamic = 'force-dynamic'

/**
 * POST /api/sites/digest
 * Body: { siteId }
 *
 * Lee las analíticas del sitio publicado (7 días), detecta errores JS reales
 * capturados por el colector inyectado, y envía un resumen por Telegram o
 * WhatsApp. El mensaje incluye un enlace directo a JARVIS que dispara el
 * auto-arreglo del Canvas sin que el usuario teclee nada.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const userId = session.user.id

    const { siteId } = await request.json()
    if (!siteId) return NextResponse.json({ error: 'siteId requerido' }, { status: 400 })

    // Verificar que el sitio pertenece al usuario
    const site = await withDbRetry(() => prisma.hostedSite.findFirst({
      where: { id: siteId, userId },
      select: { id: true, name: true, slug: true, sessionId: true },
    }))
    if (!site) return NextResponse.json({ error: 'Sitio no encontrado' }, { status: 404 })

    // Canvas projectId vinculado (sessionId = canvas:{projectId})
    const projectId = site.sessionId?.startsWith('canvas:')
      ? site.sessionId.replace('canvas:', '')
      : null

    // ── Analíticas de los últimos 7 días ──────────────────────────────
    const since = new Date()
    since.setDate(since.getDate() - 7)

    const [totalViews, allViews, errorViews] = await Promise.all([
      withDbRetry(() => prisma.hostedSiteView.count({ where: { siteId, createdAt: { gte: since }, path: { not: { startsWith: '__error_' } } } })),
      withDbRetry(() => prisma.hostedSiteView.findMany({
        where: { siteId, createdAt: { gte: since }, path: { not: { startsWith: '__error_' } } },
        select: { path: true, referrer: true },
      })),
      withDbRetry(() => prisma.hostedSiteView.findMany({
        where: { siteId, createdAt: { gte: since }, path: { startsWith: '__error_' } },
        select: { path: true, referrer: true },
      })),
    ])

    // Página más visitada
    const pathCounts = new Map<string, number>()
    for (const v of allViews) {
      const p = v.path || '/'
      pathCounts.set(p, (pathCounts.get(p) || 0) + 1)
    }
    const topPage = [...pathCounts.entries()].sort((a, b) => b[1] - a[1])[0]

    // Referrer más frecuente
    const refCounts = new Map<string, number>()
    for (const v of allViews) {
      if (!v.referrer) continue
      let domain = v.referrer
      try { domain = new URL(v.referrer).hostname } catch { /* keep */ }
      refCounts.set(domain, (refCounts.get(domain) || 0) + 1)
    }
    const topRef = [...refCounts.entries()].sort((a, b) => b[1] - a[1])[0]

    // Errores únicos (de-dup por mensaje)
    const uniqueErrors = [...new Set(errorViews.map(e => e.referrer || '').filter(Boolean))].slice(0, 3)

    // ── Construir mensaje ─────────────────────────────────────────────
    const origin = process.env.NEXTAUTH_URL || 'https://octopuskills.com'
    const siteUrl = `${origin}/sites/${site.slug}`
    const fixUrl = projectId
      ? `${origin}/dashboard/jarvis?q=${encodeURIComponent(`[DIGEST-AUTOFIX:${siteId}] Revisa y mejora el sitio "${site.name}" basándote en: ${uniqueErrors.length} error(es) JS detectado(s). Mejora el rendimiento y corrige los errores.`)}`
      : null

    const lines: string[] = [
      `📊 *Reporte semanal — ${site.name}*`,
      ``,
      `👁 *${totalViews}* visita(s) esta semana`,
    ]
    if (topPage) lines.push(`📄 Página más vista: \`${topPage[0]}\` (${topPage[1]} vistas)`)
    if (topRef) lines.push(`🔗 Fuente principal: ${topRef[0]}`)
    if (uniqueErrors.length > 0) {
      lines.push(``, `⚠️ *${uniqueErrors.length} error(es) JS detectado(s) en producción:*`)
      uniqueErrors.forEach(e => lines.push(`• \`${e.slice(0, 120)}\``))
    } else {
      lines.push(`✅ Sin errores JS en producción`)
    }
    lines.push(``, `🌐 ${siteUrl}`)
    if (fixUrl) {
      lines.push(``, `🔧 ¿Quieres que OCTOPUS lo revise y mejore?`)
      lines.push(fixUrl)
    }

    const message = lines.join('\n')

    // ── Enviar por el canal disponible ───────────────────────────────
    const channels = await withDbRetry(() => prisma.armConnection.findMany({
      where: { userId, armType: { in: ['telegram', 'whatsapp', 'sms'] }, status: 'connected' },
      select: { armType: true, credentials: true },
    }))

    let sent = false
    let channel: string | null = null

    for (const ch of channels) {
      const creds = parseStoredCreds<Record<string, string>>(ch.credentials)
      if (!creds) continue

      if (ch.armType === 'telegram' && creds.bot_token && creds.chat_id) {
        const url = `https://api.telegram.org/bot${creds.bot_token}/sendMessage`
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: creds.chat_id, text: message, parse_mode: 'Markdown' }),
        })
        if (res.ok) { sent = true; channel = 'telegram'; break }
      }

      if (ch.armType === 'whatsapp' && creds.accountSid && creds.authToken && creds.phoneNumber && creds.myNumber) {
        sent = await sendWhatsAppMessage(
          { accountSid: creds.accountSid, authToken: creds.authToken, phoneNumber: creds.phoneNumber },
          creds.myNumber,
          message.replace(/\*/g, '').replace(/`/g, '"'),
        )
        if (sent) { channel = 'whatsapp'; break }
      }

      if (ch.armType === 'sms' && creds.accountSid && creds.authToken && creds.phoneNumber && creds.myNumber) {
        sent = await sendSmsMessage(
          { accountSid: creds.accountSid, authToken: creds.authToken, phoneNumber: creds.phoneNumber },
          creds.myNumber,
          message.replace(/\*/g, '').replace(/`/g, '"').slice(0, 1600),
        )
        if (sent) { channel = 'sms'; break }
      }
    }

    if (!sent) {
      return NextResponse.json({
        success: false,
        error: 'no_channel',
        message: 'Conecta Telegram, WhatsApp o SMS en Brazos Activos para recibir el resumen.',
        digestText: message,
      }, { status: 409 })
    }

    return NextResponse.json({ success: true, channel, totalViews, errors: uniqueErrors.length })
  } catch (error) {
    console.error('Digest error:', error)
    return NextResponse.json({ error: 'Error enviando el digest' }, { status: 500 })
  }
}
