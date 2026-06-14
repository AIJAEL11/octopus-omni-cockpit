import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * POST /api/growth/actions/update-copy
 * Bulk-updates the email subject/body for all pending email actions.
 * Body: { subject?: string, body?: string, campaignId?: string, status?: string ('pending') }
 *
 * Personalization tokens supported in subject/body:
 *   [Name]      → lead.contactName || 'there'
 *   [Business]  → lead.businessName || lead.contactName
 *   [City]      → lead.city || ''
 *   [Email]     → lead.email
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { subject, body, campaignId } = await req.json()
    if (!subject && !body) {
      return NextResponse.json({ error: 'Debes proporcionar subject o body para actualizar' }, { status: 400 })
    }

    // Build filter for pending email actions
    const where: Record<string, unknown> = {
      userId: session.user.id,
      status: 'pending',
      actionType: { in: ['send_outreach_email', 'send_follow_up'] },
    }

    // Optionally filter by campaign — find leads in that campaign
    if (campaignId) {
      const campaignLeads = await prisma.campaignLead.findMany({
        where: { campaignId, campaign: { userId: session.user.id } },
        select: { leadId: true },
      })
      const leadIds = campaignLeads.map(cl => cl.leadId)
      if (leadIds.length === 0) {
        return NextResponse.json({ updated: 0, message: 'La campaña no tiene leads asignados' })
      }
      where.leadId = { in: leadIds }
    }

    const actions = await prisma.growthAction.findMany({
      where: where as any,
      include: { lead: { select: { contactName: true, businessName: true, city: true, email: true } } },
    })

    if (actions.length === 0) {
      return NextResponse.json({ updated: 0, message: 'No hay emails pendientes para actualizar' })
    }

    let updated = 0
    for (const action of actions) {
      try {
        const payload = action.payload ? JSON.parse(action.payload) : {}
        const lead = action.lead

        // Personalize tokens
        const personalize = (text: string): string =>
          text
            .replace(/\[Name\]/gi, lead?.contactName || 'there')
            .replace(/\[Business\]/gi, lead?.businessName || lead?.contactName || 'your business')
            .replace(/\[City\]/gi, lead?.city || '')
            .replace(/\[Email\]/gi, lead?.email || '')

        const newSubject = subject ? personalize(subject) : payload.subject
        const newBody = body ? personalize(body) : payload.body

        await prisma.growthAction.update({
          where: { id: action.id },
          data: {
            payload: JSON.stringify({ ...payload, subject: newSubject, body: newBody }),
            title: `Email → ${lead?.contactName || lead?.businessName || 'Lead'}: ${newSubject}`,
            description: (newBody || '').substring(0, 200) + '...',
          },
        })
        updated++
      } catch (err) {
        console.error(`[update-copy] failed for action ${action.id}:`, err)
      }
    }

    return NextResponse.json({
      updated,
      total: actions.length,
      message: `${updated} emails actualizados${campaignId ? ' en la campaña' : ''} con el nuevo copy.`,
    })
  } catch (error) {
    console.error('[update-copy] error:', error)
    const errMsg = error instanceof Error ? error.message : 'Error del servidor'
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
