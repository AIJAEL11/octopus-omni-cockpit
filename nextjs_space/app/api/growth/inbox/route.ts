import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserGmailTokenVerified, searchGmailThreads } from '@/lib/gmail-growth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/growth/inbox
 * Fetches real Gmail messages related to Growth Engine leads.
 * Combines: sent outreach emails + any replies from leads.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const accessToken = await getUserGmailTokenVerified(session.user.id)
    if (!accessToken) {
      return NextResponse.json({
        error: 'Gmail no conectado. Conecta Google Workspace en Brazos.',
        connected: false,
      }, { status: 403 })
    }

    // Get leads with at least one outbound message (contacted)
    const leads = await prisma.growthLead.findMany({
      where: {
        userId: session.user.id,
        status: { in: ['contacted', 'replied', 'converted'] },
      },
      select: { id: true, email: true, businessName: true, contactName: true },
    })

    if (leads.length === 0) {
      return NextResponse.json({ messages: [], connected: true, leadsCount: 0 })
    }

    // Build a Gmail search query for all lead emails
    const leadEmails = leads.map((l) => l.email).filter(Boolean)
    // Search for messages to/from lead emails
    const queries = leadEmails.slice(0, 15).map((e) => `to:${e} OR from:${e}`)
    const fullQuery = `(${queries.join(' OR ')}) newer_than:30d`

    const gmailMessages = await searchGmailThreads({
      accessToken,
      query: fullQuery,
      maxResults: 50,
    })

    // Enrich with lead info
    const enriched = gmailMessages.map((msg) => {
      const matchedLead = leads.find((l) =>
        msg.from?.includes(l.email) || msg.to?.includes(l.email)
      )
      return {
        ...msg,
        leadId: matchedLead?.id || null,
        leadName: matchedLead?.businessName || null,
        leadContact: matchedLead?.contactName || null,
        leadEmail: matchedLead?.email || null,
      }
    })

    return NextResponse.json({
      messages: enriched,
      connected: true,
      leadsCount: leads.length,
    })
  } catch (error: any) {
    console.error('[Growth Inbox] Error:', error)
    return NextResponse.json({ error: error.message || 'Error del servidor' }, { status: 500 })
  }
}
