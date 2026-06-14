import { callLLM } from '@/lib/turbo-llm'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserGmailTokenVerified, searchGmailThreads } from '@/lib/gmail-growth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/growth/inbox/sync
 * Sync Gmail inbox: detect new replies, classify them with AI, update lead statuses.
 * Returns count of new replies found + classifications.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const accessToken = await getUserGmailTokenVerified(session.user.id)
    if (!accessToken) {
      return NextResponse.json({ error: 'Gmail no conectado', connected: false }, { status: 403 })
    }

    // Get contacted leads (only those we've emailed)
    const leads = await prisma.growthLead.findMany({
      where: {
        userId: session.user.id,
        status: { in: ['contacted', 'replied', 'converted'] },
        email: { not: null },
      },
      select: {
        id: true, email: true, businessName: true, contactName: true,
        status: true, lastReplyAt: true,
      },
    })

    if (leads.length === 0) {
      return NextResponse.json({ synced: 0, newReplies: 0, classifications: [] })
    }

    const leadEmails = leads.map(l => l.email!).filter(Boolean)
    // Only look for RECEIVED emails (not sent by us)
    const queries = leadEmails.slice(0, 15).map(e => `from:${e}`)
    const fullQuery = `(${queries.join(' OR ')}) newer_than:30d -in:sent`

    const gmailMessages = await searchGmailThreads({ accessToken, query: fullQuery, maxResults: 30 })

    let newReplies = 0
    const classifications: { leadId: string; leadName: string; classification: string; subject: string }[] = []

    for (const msg of gmailMessages) {
      // Find which lead this is from
      const matchedLead = leads.find(l => msg.from?.toLowerCase().includes(l.email!.toLowerCase()))
      if (!matchedLead) continue

      // Check if we already have this message recorded
      const existing = await prisma.growthMessage.findFirst({
        where: {
          leadId: matchedLead.id,
          userId: session.user.id,
          direction: 'inbound',
          metadata: { contains: msg.id },
        },
      })
      if (existing) continue // Already synced

      // NEW reply found!
      newReplies++

      // Classify with AI
      const classification = await classifyReply(msg.body || msg.snippet || '', matchedLead.businessName)

      // Save inbound message
      await prisma.growthMessage.create({
        data: {
          userId: session.user.id,
          leadId: matchedLead.id,
          direction: 'inbound',
          channel: 'email',
          subject: msg.subject || 'Sin asunto',
          content: msg.body || msg.snippet || '',
          metadata: JSON.stringify({
            gmailMessageId: msg.id,
            gmailThreadId: msg.threadId,
            classification,
            classifiedAt: new Date().toISOString(),
          }),
        },
      })

      // Update lead status & classification
      const updateData: Record<string, any> = {
        lastReplyAt: new Date(),
        replyClassification: classification,
      }
      if (matchedLead.status === 'contacted') {
        updateData.status = 'replied'
      }
      if (classification === 'bounce') {
        updateData.emailBounced = true
        updateData.status = 'lost'
      }

      await prisma.growthLead.update({
        where: { id: matchedLead.id },
        data: updateData,
      })

      classifications.push({
        leadId: matchedLead.id,
        leadName: matchedLead.businessName,
        classification,
        subject: msg.subject || 'Sin asunto',
      })
    }

    return NextResponse.json({
      synced: gmailMessages.length,
      newReplies,
      classifications,
      leadsChecked: leads.length,
    })
  } catch (error: any) {
    console.error('[Growth Inbox Sync] Error:', error)
    return NextResponse.json({ error: error.message || 'Error del servidor' }, { status: 500 })
  }
}

/** Classify a reply using AI (uses callLLM with null userId — no Turbo for background tasks) */
async function classifyReply(content: string, businessName: string): Promise<string> {
  try {
    const data = await callLLM(null, [{
      role: 'user',
      content: `Clasifica esta respuesta de email de "${businessName}" en UNA de estas categorías:
- interested: Muestra interés en la propuesta, quiere más info, acepta reunión
- not_interested: Rechaza claramente, pide no contactar más
- question: Hace preguntas sobre el servicio sin comprometerse
- bounce: Email devuelto, dirección inválida, out-of-office automático
- neutral: Respuesta genérica, no se puede determinar intención

Email recibido:
"${content.substring(0, 500)}"

Responde SOLO con la categoría (una palabra): `,
    }], { model: 'gpt-4.1-mini', temperature: 0.1, maxTokens: 20 })

    const raw = (data.choices?.[0]?.message?.content || '').trim().toLowerCase()
    const valid = ['interested', 'not_interested', 'question', 'bounce', 'neutral']
    return valid.includes(raw) ? raw : 'neutral'
  } catch (e) {
    console.error('[Growth] Classification error:', e)
  }
  return 'neutral'
}
