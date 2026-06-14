export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function buildInvoiceHtml(invoice: any, userName: string) {
  const isQuote = invoice.type === 'quote'
  const title = isQuote ? 'COTIZACIÓN' : 'FACTURA'
  const color = invoice.brandColor || '#C4622D'
  const currSym = invoice.currency === 'USD' ? '$' : invoice.currency === 'EUR' ? '€' : invoice.currency

  const itemsRows = (invoice.items || []).map((item: any) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#333;font-size:14px;">${item.description}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#555;font-size:14px;text-align:center;">${item.quantity}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#555;font-size:14px;text-align:right;">${currSym}${item.unitPrice.toFixed(2)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#333;font-size:14px;text-align:right;font-weight:600;">${currSym}${item.total.toFixed(2)}</td>
    </tr>
  `).join('')

  const issueDate = new Date(invoice.issueDate).toLocaleDateString('es', { year: 'numeric', month: 'long', day: 'numeric' })
  const dueDate = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('es', { year: 'numeric', month: 'long', day: 'numeric' }) : null

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Inter',sans-serif; background:#fff; color:#1a1a1a; padding:40px; }
</style></head>
<body>
<div style="max-width:800px;margin:0 auto;">
  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px;">
    <div>
      <div style="font-size:36px;font-weight:700;color:${color};letter-spacing:-1px;">${title}</div>
      <div style="font-size:14px;color:#888;margin-top:4px;">${invoice.invoiceNumber}</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:16px;font-weight:600;color:#333;">${userName}</div>
      <div style="font-size:12px;color:#888;margin-top:2px;">OCTOPUS Omni Cockpit</div>
    </div>
  </div>

  <!-- Client + Dates -->
  <div style="display:flex;justify-content:space-between;margin-bottom:32px;">
    <div style="background:#f8f8f8;border-radius:12px;padding:20px;flex:1;margin-right:16px;">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#999;margin-bottom:8px;">PARA</div>
      <div style="font-size:16px;font-weight:600;color:#333;">${invoice.clientName}</div>
      ${invoice.clientCompany ? `<div style="font-size:13px;color:#666;margin-top:2px;">${invoice.clientCompany}</div>` : ''}
      ${invoice.clientEmail ? `<div style="font-size:13px;color:#666;margin-top:2px;">${invoice.clientEmail}</div>` : ''}
      ${invoice.clientPhone ? `<div style="font-size:13px;color:#666;margin-top:2px;">${invoice.clientPhone}</div>` : ''}
      ${invoice.clientAddress ? `<div style="font-size:13px;color:#666;margin-top:4px;">${invoice.clientAddress}</div>` : ''}
    </div>
    <div style="text-align:right;min-width:180px;">
      <div style="margin-bottom:12px;">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#999;">FECHA EMISIÓN</div>
        <div style="font-size:14px;font-weight:500;color:#333;">${issueDate}</div>
      </div>
      ${dueDate ? `<div><div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#999;">FECHA VENCIMIENTO</div><div style="font-size:14px;font-weight:500;color:#333;">${dueDate}</div></div>` : ''}
    </div>
  </div>

  <!-- Items -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
    <thead>
      <tr style="background:${color};">
        <th style="padding:12px;text-align:left;color:white;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;border-radius:8px 0 0 0;">Descripción</th>
        <th style="padding:12px;text-align:center;color:white;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Cant.</th>
        <th style="padding:12px;text-align:right;color:white;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Precio</th>
        <th style="padding:12px;text-align:right;color:white;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;border-radius:0 8px 0 0;">Total</th>
      </tr>
    </thead>
    <tbody>${itemsRows}</tbody>
  </table>

  <!-- Totals -->
  <div style="display:flex;justify-content:flex-end;">
    <div style="width:280px;">
      <div style="display:flex;justify-content:space-between;padding:8px 0;font-size:14px;color:#555;">
        <span>Subtotal</span><span>${currSym}${invoice.subtotal.toFixed(2)}</span>
      </div>
      ${invoice.discount > 0 ? `<div style="display:flex;justify-content:space-between;padding:8px 0;font-size:14px;color:#ef4444;"><span>Descuento</span><span>-${currSym}${invoice.discount.toFixed(2)}</span></div>` : ''}
      ${invoice.taxRate > 0 ? `<div style="display:flex;justify-content:space-between;padding:8px 0;font-size:14px;color:#555;"><span>Impuesto (${invoice.taxRate}%)</span><span>${currSym}${invoice.taxAmount.toFixed(2)}</span></div>` : ''}
      <div style="display:flex;justify-content:space-between;padding:12px 0;font-size:20px;font-weight:700;color:${color};border-top:2px solid ${color};margin-top:8px;">
        <span>TOTAL</span><span>${currSym}${invoice.total.toFixed(2)}</span>
      </div>
    </div>
  </div>

  ${invoice.notes ? `<div style="margin-top:32px;padding:16px;background:#f8f8f8;border-radius:12px;"><div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#999;margin-bottom:6px;">NOTAS</div><div style="font-size:13px;color:#555;line-height:1.5;">${invoice.notes}</div></div>` : ''}
  ${invoice.terms ? `<div style="margin-top:12px;padding:16px;background:#f8f8f8;border-radius:12px;"><div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#999;margin-bottom:6px;">TÉRMINOS</div><div style="font-size:13px;color:#555;line-height:1.5;">${invoice.terms}</div></div>` : ''}

  <div style="text-align:center;margin-top:40px;padding-top:20px;border-top:1px solid #eee;">
    <p style="font-size:11px;color:#bbb;">Generado con OCTOPUS Omni Cockpit · Wildverse LLC</p>
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
      include: { items: { orderBy: { sortOrder: 'asc' } } }
    })
    if (!invoice) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

    const html = buildInvoiceHtml(invoice, user.name || 'Usuario')

    // Create PDF request
    const createRes = await fetch('https://apps.abacus.ai/api/createConvertHtmlToPdfRequest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        html_content: html,
        pdf_options: { format: 'A4', margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }, print_background: true },
        base_url: process.env.NEXTAUTH_URL || ''
      })
    })

    if (!createRes.ok) return NextResponse.json({ error: 'Error creando PDF' }, { status: 500 })
    const { request_id } = await createRes.json()
    if (!request_id) return NextResponse.json({ error: 'No request_id' }, { status: 500 })

    // Poll for completion
    let attempts = 0
    while (attempts < 120) {
      await new Promise(r => setTimeout(r, 1000))
      const statusRes = await fetch('https://apps.abacus.ai/api/getConvertHtmlToPdfStatus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id, deployment_token: process.env.ABACUSAI_API_KEY })
      })
      const statusResult = await statusRes.json()
      if (statusResult?.status === 'SUCCESS' && statusResult?.result?.result) {
        const pdfBuffer = Buffer.from(statusResult.result.result, 'base64')
        return new NextResponse(pdfBuffer, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${invoice.invoiceNumber}.pdf"`,
          }
        })
      } else if (statusResult?.status === 'FAILED') {
        return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 })
      }
      attempts++
    }

    return NextResponse.json({ error: 'PDF timeout' }, { status: 500 })
  } catch (err: any) {
    console.error('PDF generation error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
