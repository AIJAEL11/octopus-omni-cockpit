import { callLLM } from '@/lib/turbo-llm'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildOutreachPrompt } from '@/lib/growth-engine'

export const dynamic = 'force-dynamic'

/**
 * POST /api/growth/outreach/batch
 * Generate outreach emails for multiple leads at once.
 * Body: { limit: number, status?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { limit = 10, status = 'new' } = await req.json()
    const batchLimit = Math.min(Number(limit) || 10, 25) // Max 25 at a time

    // Get sender name
    const senderUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true } })
    const senderName = senderUser?.name || session.user.name || 'OctopusSkills Team'

    // Find leads with valid email, no pending action, matching status
    const leads = await prisma.growthLead.findMany({
      where: {
        userId: session.user.id,
        status: status,
        email: { not: '' },
        NOT: {
          email: null,
        },
      },
      orderBy: { qualificationScore: 'desc' },
      take: batchLimit,
    })

    // Filter out leads that already have pending actions
    const pendingActionLeadIds = await prisma.growthAction.findMany({
      where: {
        userId: session.user.id,
        status: 'pending',
        leadId: { in: leads.map(l => l.id) },
      },
      select: { leadId: true },
    })
    const pendingSet = new Set(pendingActionLeadIds.map(a => a.leadId))
    const eligibleLeads = leads.filter(l => !pendingSet.has(l.id) && l.email && !l.email.includes('(via'))

    if (eligibleLeads.length === 0) {
      return NextResponse.json({ results: [], message: 'No hay leads elegibles para outreach' })
    }

    console.log(`[Batch Outreach] Processing ${eligibleLeads.length} leads for user ${session.user.id}`)

    const results: { leadId: string; businessName: string; success: boolean; error?: string }[] = []

    // Process leads sequentially (to avoid rate limits)
    for (const lead of eligibleLeads) {
      try {
        const isFollowUp = lead.status === 'contacted' || lead.followUpCount > 0
        const actionType = isFollowUp ? 'send_follow_up' : 'send_outreach_email'

        let prompt = buildOutreachPrompt(lead, senderName)
        if (isFollowUp) {
          prompt += `\n\nIMPORTANTE: Este es un FOLLOW-UP (#${lead.followUpCount + 1}). Sé más corto y directo (máximo 80 palabras).`
        }

        const llmData = await callLLM(session.user.id, [{ role: 'user', content: prompt }], { model: 'gpt-4.1-mini', temperature: 0.7, maxTokens: 800 })
        const raw = llmData.choices?.[0]?.message?.content || ''

        let emailData: { subject: string; body: string; reasoning: string }
        try {
          const jsonMatch = raw.match(/\{[\s\S]*\}/)
          emailData = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(raw)
        } catch {
          emailData = { subject: `Partnership opportunity for ${lead.businessName}`, body: raw, reasoning: 'Fallback' }
        }

        await prisma.growthAction.create({
          data: {
            userId: session.user.id,
            leadId: lead.id,
            actionType,
            title: `${isFollowUp ? 'Follow-up' : 'Email'} → ${lead.contactName || lead.businessName}: ${emailData.subject}`,
            description: emailData.body.substring(0, 200) + '...',
            payload: JSON.stringify({
              to: lead.email,
              toName: lead.contactName || 'Partner',
              subject: emailData.subject,
              body: emailData.body,
            }),
            reasoning: emailData.reasoning,
            status: 'pending',
          },
        })

        results.push({ leadId: lead.id, businessName: lead.businessName || lead.contactName || 'Unknown', success: true })
        console.log(`[Batch Outreach] ✅ Generated for: ${lead.businessName}`)
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error'
        results.push({ leadId: lead.id, businessName: lead.businessName || 'Unknown', success: false, error: errMsg })
        console.error(`[Batch Outreach] ❌ Failed for: ${lead.businessName}`, errMsg)
      }
    }

    const successCount = results.filter(r => r.success).length
    console.log(`[Batch Outreach] Complete: ${successCount}/${results.length} successful`)

    return NextResponse.json({
      results,
      total: results.length,
      successful: successCount,
      failed: results.length - successCount,
      message: `${successCount} emails generados. Revisa las acciones pendientes para aprobarlos.`,
    })
  } catch (error: unknown) {
    console.error('[Batch Outreach] Error:', error)
    const errMsg = error instanceof Error ? error.message : 'Error del servidor'
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
