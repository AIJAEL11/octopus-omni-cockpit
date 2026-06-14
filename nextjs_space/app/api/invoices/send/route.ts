export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function buildEmailHtml(invoice: any, userName: string, viewUrl: string) {
  const isQuote = invoice.type === 'quote'
  const title = isQuote ? 'Cotización' : 'Factura'
  const color = invoice.brandColor || '#C4622D'
  const currSym = invoice.currency === 'USD' ? '$' : invoice.currency === 'EUR' ? '€' : invoice.currency

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <div style="background:${color};padding:32px 24px;text-align:center;">
    <div style="font-size:36px;margin-bottom:8px;">🐙</div>
    <h1 style="color:white;font-size:22px;margin:0;">${title} ${invoice.invoiceNumber}</h1>
    <p style="color:rgba(255,255,255,0.8);font-size:14px;margin-top:4px;">de ${userName}</p>
  </div>
  <div style="padding:32px 24px;">
    <p style="font-size:16px;color:#333;margin-bottom:16px;">Hola ${invoice.clientName},</p>
    <p style="font-size:15px;color:#555;line-height:1.6;margin-bottom:24px;">
      ${isQuote ? 'Te enviamos esta cotización' : 'Te enviamos esta factura'} por un total de <strong style="color:${color};font-size:18px;">${currSym}${invoice.total.toFixed(2)} ${invoice.currency}</strong>.
    </p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${viewUrl}" style="display:inline-block;background:${color};color:white;padding:14px 40px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;">Ver ${title}</a>
    </div>
    <div style="background:#f8f8f8;border-radius:12px;padding:16px;">
      <table style="width:100%;font-size:13px;color:#555;">
        <tr><td style="padding:4px 0;">Número:</td><td style="text-align:right;font-weight:600;">${invoice.invoiceNumber}</td></tr>
        <tr><td style="padding:4px 0;">Total:</td><td style="text-align:right;font-weight:600;color:${color};">${currSym}${invoice.total.toFixed(2)}</td></tr>
        ${invoice.dueDate ? `<tr><td style="padding:4px 0;">Vencimiento:</td><td style="text-align:right;">${new Date(invoice.dueDate).toLocaleDateString('es')}</td></tr>` : ''}
      </table>
    </div>
  </div>
  <div style="padding:16px 24px;background:#f8f8f8;border-top:1px solid #eee;text-align:center;">
    <p style="font-size:11px;color:#999;">Enviado desde OCTOPUS Omni Cockpit · Wildverse LLC</p>
  </div>
</div>
</body></html>`
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const { invoiceId } = await req.json()
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, userId: user.id },
      include: { items: true }
    })
    if (!invoice) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
    if (!invoice.clientEmail) return NextResponse.json({ error: 'El cliente no tiene email' }, { status: 400 })

    const baseUrl = process.env.NEXTAUTH_URL || 'https://octopus-omni-cockpit-n8hd61.abacusai.app'
    const viewUrl = `${baseUrl}/invoice/${invoice.id}`
    const isQuote = invoice.type === 'quote'
    const subject = `${isQuote ? 'Cotización' : 'Factura'} ${invoice.invoiceNumber} de ${user.name || 'OCTOPUS'}`
    const htmlBody = buildEmailHtml(invoice, user.name || 'Usuario', viewUrl)

    const res = await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        app_id: process.env.WEB_APP_ID,
        notification_id: process.env.NOTIF_ID_INVOICE_SENT,
        subject,
        body: htmlBody,
        is_html: true,
        recipient_email: invoice.clientEmail,
        sender_email: user.businessEmail || user.email,
        sender_alias: user.name || 'OCTOPUS Omni Cockpit',
        reply_to: user.businessEmail || user.email,
      })
    })

    const data = await res.json()
    if (!data.success && !data.notification_disabled) {
      console.error('Email send failed:', data)
      return NextResponse.json({ error: 'Error enviando email' }, { status: 500 })
    }

    // Update status to sent
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'sent', sentAt: new Date() }
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Send invoice error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
