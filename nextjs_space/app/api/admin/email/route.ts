import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdminEmail } from '@/lib/admin-guard'

export const dynamic = 'force-dynamic'

// ============================================
// ADMIN EMAIL: Send emails to platform users
// ============================================

const NOTIF_TYPE_MAP: Record<string, string | undefined> = {
  onboarding: process.env.NOTIF_ID_ONBOARDING_CAMPAIGN,
  announcement: process.env.NOTIF_ID_PLATFORM_ANNOUNCEMENT,
  tips: process.env.NOTIF_ID_FEATURE_TIPS,
}

function buildEmailHtml(subject: string, body: string, ctaText?: string, ctaUrl?: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#1A1A1A;border-radius:16px;overflow:hidden;border:1px solid #FFD70020;">
  <!-- Header -->
  <div style="background:linear-gradient(135deg,#2D4A3E,#1A1A1A);padding:32px 24px;text-align:center;border-bottom:1px solid #FFD70015;">
    <div style="font-size:48px;margin-bottom:12px;">🐙</div>
    <h1 style="color:#FFD700;font-size:22px;margin:0;font-weight:700;letter-spacing:0.5px;">OCTOPUS Omni Cockpit</h1>
    <p style="color:#F5F0E880;font-size:12px;margin:4px 0 0;letter-spacing:1px;">PLATAFORMA DE INTELIGENCIA OMNICANAL</p>
  </div>
  
  <!-- Content -->
  <div style="padding:32px 24px;">
    <h2 style="color:#F5F0E8;font-size:20px;margin:0 0 16px;font-weight:600;">${subject}</h2>
    <div style="color:#F5F0E8CC;font-size:15px;line-height:1.7;">
      ${body.replace(/\n/g, '<br/>')}
    </div>
    ${ctaText && ctaUrl ? `
    <div style="text-align:center;margin:32px 0 16px;">
      <a href="${ctaUrl}" style="display:inline-block;background:linear-gradient(135deg,#FFD700,#C4622D);color:#1A1A1A;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.3px;">${ctaText}</a>
    </div>
    ` : ''}
  </div>
  
  <!-- Footer -->
  <div style="padding:20px 24px;background:#0A0A0A;border-top:1px solid #F5F0E810;text-align:center;">
    <p style="color:#F5F0E830;font-size:11px;margin:0;">OCTOPUS Omni Cockpit · Wildverse LLC</p>
    <p style="color:#F5F0E820;font-size:10px;margin:4px 0 0;">Recibes este email porque eres parte de la plataforma OCTOPUS</p>
  </div>
</div>
</body>
</html>`
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !isAdminEmail(session.user.email)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { type, subject, body, ctaText, ctaUrl, recipientEmails, sendToAll } = await request.json()

    if (!subject || !body) {
      return NextResponse.json({ error: 'Asunto y cuerpo requeridos' }, { status: 400 })
    }

    // Determine notification ID
    const notificationId = NOTIF_TYPE_MAP[type] || NOTIF_TYPE_MAP.announcement
    if (!notificationId) {
      return NextResponse.json({ error: 'Tipo de notificación no configurado' }, { status: 500 })
    }

    // Get recipient emails
    let emails: string[] = []
    if (sendToAll) {
      const users = await prisma.user.findMany({ select: { email: true } })
      emails = users.map((u: any) => u.email).filter(Boolean)
    } else if (recipientEmails && Array.isArray(recipientEmails)) {
      emails = recipientEmails.filter(Boolean)
    } else {
      return NextResponse.json({ error: 'Destinatarios requeridos' }, { status: 400 })
    }

    if (emails.length === 0) {
      return NextResponse.json({ error: 'No hay destinatarios' }, { status: 400 })
    }

    const htmlBody = buildEmailHtml(subject, body, ctaText, ctaUrl)

    const appUrl = process.env.NEXTAUTH_URL || 'https://octopus-omni-cockpit-n8hd61.abacusai.app'
    let senderEmail = 'noreply@mail.abacusai.app'
    try {
      senderEmail = `noreply@${new URL(appUrl).hostname}`
    } catch {}

    // Send emails (batch, max 5 concurrent to avoid rate limits)
    const results: { email: string; success: boolean; error?: string }[] = []
    const batchSize = 5

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize)
      const batchResults = await Promise.allSettled(
        batch.map(async (email) => {
          const res = await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              deployment_token: process.env.ABACUSAI_API_KEY,
              app_id: process.env.WEB_APP_ID,
              notification_id: notificationId,
              subject,
              body: htmlBody,
              is_html: true,
              recipient_email: email,
              sender_email: senderEmail,
              sender_alias: 'OCTOPUS Omni Cockpit',
            }),
          })
          const data = await res.json()
          if (!data.success && !data.notification_disabled) {
            throw new Error(data.message || 'Failed')
          }
          return { email, success: true }
        })
      )

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value)
        } else {
          results.push({ email: batch[batchResults.indexOf(result)], success: false, error: result.reason?.message })
        }
      }
    }

    const sent = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    return NextResponse.json({
      success: true,
      sent,
      failed,
      total: emails.length,
      details: results,
    })
  } catch (err) {
    console.error('[Admin Email] Error:', err)
    return NextResponse.json({ error: 'Error al enviar emails' }, { status: 500 })
  }
}
