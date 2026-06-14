import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserGmailTokenVerified, sendGmailEmail, getGmailProfile } from '@/lib/gmail-growth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/growth/inbox/reply
 * Send a reply to a lead directly from the Inbox.
 * Body: { leadId, subject, body, threadId? }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { leadId, subject, body, threadId } = await req.json()
    if (!leadId || !body) {
      return NextResponse.json({ error: 'leadId y body son requeridos' }, { status: 400 })
    }

    const lead = await prisma.growthLead.findFirst({
      where: { id: leadId, userId: session.user.id },
    })
    if (!lead || !lead.email) {
      return NextResponse.json({ error: 'Lead no encontrado o sin email' }, { status: 404 })
    }

    const accessToken = await getUserGmailTokenVerified(session.user.id)
    if (!accessToken) {
      return NextResponse.json({ error: 'Gmail no conectado' }, { status: 403 })
    }

    // Get user's real name for email sender
    const senderUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true } })
    const senderName = senderUser?.name || session.user.name || 'OCTOPUS Team'

    const profile = await getGmailProfile(accessToken)
    const result = await sendGmailEmail({
      accessToken,
      from: profile.emailAddress,
      fromName: senderName,
      to: lead.email,
      toName: lead.contactName || 'Partner',
      subject: subject || 'Re: Partnership Opportunity',
      body,
      threadId: threadId || undefined,
    })

    // Save as outbound message
    await prisma.growthMessage.create({
      data: {
        userId: session.user.id,
        leadId: lead.id,
        direction: 'outbound',
        channel: 'email',
        subject: subject || 'Re: Partnership Opportunity',
        content: body,
        metadata: JSON.stringify({
          gmailMessageId: result.id,
          gmailThreadId: result.threadId,
          sentFromInbox: true,
        }),
      },
    })

    // Update lead
    await prisma.growthLead.update({
      where: { id: lead.id },
      data: {
        lastContactedAt: new Date(),
        followUpCount: { increment: 1 },
      },
    })

    return NextResponse.json({
      success: true,
      gmailId: result.id,
      threadId: result.threadId,
    })
  } catch (error: any) {
    console.error('[Growth Reply] Error:', error)
    return NextResponse.json({ error: error.message || 'Error del servidor' }, { status: 500 })
  }
}
