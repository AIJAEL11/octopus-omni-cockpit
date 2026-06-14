import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { email } = await request.json()
    if (!email) {
      return NextResponse.json({ error: 'Email requerido' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })

    // Always return success to prevent email enumeration
    if (!user || !user.password) {
      return NextResponse.json({ success: true })
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex')
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiry },
    })

    // Build reset URL
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`

    // Send email
    const htmlBody = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a1628; color: #f5f0e8; border-radius: 16px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #2D4A3E, #1A1A1A); padding: 32px; text-align: center;">
          <h1 style="margin: 0; color: #FFD700; font-size: 24px;">🐙 OCTOPUS</h1>
          <p style="margin: 8px 0 0; color: #f5f0e8cc; font-size: 14px;">Omni Cockpit</p>
        </div>
        <div style="padding: 32px;">
          <h2 style="color: #f5f0e8; margin: 0 0 16px;">Restablecer Contraseña</h2>
          <p style="color: #f5f0e8cc; line-height: 1.6;">Hola${user.name ? ` ${user.name}` : ''},</p>
          <p style="color: #f5f0e8cc; line-height: 1.6;">Recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón de abajo:</p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${resetUrl}" style="display: inline-block; padding: 14px 36px; background: linear-gradient(135deg, #FFD700, #C4622D); color: #1A1A1A; font-weight: 600; text-decoration: none; border-radius: 12px; font-size: 15px;">Restablecer Contraseña</a>
          </div>
          <p style="color: #f5f0e899; font-size: 13px;">Este enlace expira en 1 hora. Si no solicitaste este cambio, ignora este correo.</p>
          <p style="color: #f5f0e866; font-size: 12px; margin-top: 24px; border-top: 1px solid #ffffff10; padding-top: 16px;">Si el botón no funciona, copia y pega este enlace:<br/><span style="color: #FFD700; word-break: break-all;">${resetUrl}</span></p>
        </div>
      </div>
    `

    const appUrl = process.env.NEXTAUTH_URL || ''
    let appName = 'OCTOPUS'
    try { appName = new URL(appUrl).hostname.split('.')[0] || 'OCTOPUS' } catch {}

    await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        app_id: process.env.WEB_APP_ID,
        notification_id: process.env.NOTIF_ID_PASSWORD_RESET,
        subject: '🔑 Restablecer contraseña — OCTOPUS Omni Cockpit',
        body: htmlBody,
        is_html: true,
        recipient_email: user.email,
        sender_email: `noreply@${appName}.abacusai.app`,
        sender_alias: 'OCTOPUS Omni Cockpit',
      }),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Forgot Password] Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
