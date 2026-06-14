import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import nodemailer from 'nodemailer'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { action, params } = await request.json()

    // Get SMTP connection
    const connection = await prisma.armConnection.findFirst({
      where: { userId: session.user.id, armType: 'smtp', status: 'connected' },
    })
    if (!connection) {
      return NextResponse.json(
        { error: 'SMTP no conectado. Ve a Brazos → SMTP Email → Conectar.' },
        { status: 403 }
      )
    }

    const creds = JSON.parse(connection.credentials)
    const { host, port, email, password, fromName } = creds

    if (!host || !email || !password) {
      return NextResponse.json({ error: 'Credenciales SMTP incompletas' }, { status: 400 })
    }

    // Get brand name from workspace or use fromName from creds
    let displayName = fromName || ''
    if (!displayName) {
      const workspace = await prisma.workspace.findFirst({
        where: { userId: session.user.id },
        orderBy: { updatedAt: 'desc' },
        select: { name: true },
      })
      if (workspace?.name) displayName = workspace.name
    }
    if (!displayName) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { name: true },
      })
      displayName = user?.name || ''
    }

    const fromAddress = displayName ? `"${displayName}" <${email}>` : email

    // Create transporter
    const smtpPort = parseInt(port || '465', 10)
    const transporter = nodemailer.createTransport({
      host,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: email, pass: password },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    })

    switch (action) {
      case 'send_email': {
        if (!params?.to || !params?.subject || !params?.body) {
          return NextResponse.json({ error: 'Parámetros requeridos: to, subject, body' }, { status: 400 })
        }

        const mailOptions: nodemailer.SendMailOptions = {
          from: fromAddress,
          to: params.to,
          subject: params.subject,
          ...(params.htmlBody
            ? { text: params.body, html: params.htmlBody }
            : { text: params.body }),
          ...(params.cc && { cc: params.cc }),
          ...(params.bcc && { bcc: params.bcc }),
        }

        const info = await transporter.sendMail(mailOptions)

        return NextResponse.json({
          sent: true,
          messageId: info.messageId,
          to: params.to,
          subject: params.subject,
          from: fromAddress,
          provider: 'smtp',
        })
      }

      case 'test_connection': {
        await transporter.verify()
        return NextResponse.json({ success: true, message: 'Conexión SMTP verificada', email })
      }

      default:
        return NextResponse.json({ error: `Acción '${action}' no soportada para SMTP` }, { status: 400 })
    }
  } catch (error: unknown) {
    console.error('[SMTP] Error:', error)
    const message = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({ error: `Error SMTP: ${message}` }, { status: 500 })
  }
}
