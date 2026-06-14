import { callLLM } from '@/lib/turbo-llm'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildOutreachPrompt } from '@/lib/growth-engine'

export const dynamic = 'force-dynamic'

/**
 * POST /api/growth/campaigns/activate
 * Semi-Auto flow:
 * 1. Set campaign status to 'active'
 * 2. Generate AI outreach emails for ALL leads in campaign
 * 3. Create pending GrowthActions for each
 * 4. Return results — user reviews & clicks "Approve All"
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json()
    const { campaignId, campaignName } = body
    if (!campaignId && !campaignName) return NextResponse.json({ error: 'campaignId o campaignName requerido' }, { status: 400 })

    // Support lookup by name or ID
    let campaign
    if (campaignId && campaignId !== 'auto') {
      campaign = await prisma.campaign.findFirst({
        where: { id: campaignId, userId: session.user.id },
        include: {
          leads: { include: { lead: true } },
          _count: { select: { leads: true } },
        },
      })
    }
    // Fallback: search by name (fuzzy match)
    if (!campaign && (campaignName || campaignId === 'auto')) {
      const userCampaigns = await prisma.campaign.findMany({
        where: { userId: session.user.id, status: 'draft' },
        include: {
          leads: { include: { lead: true } },
          _count: { select: { leads: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
      if (campaignName) {
        const searchName = campaignName.toLowerCase().trim()
        campaign = userCampaigns.find(c => c.name.toLowerCase().includes(searchName)) || userCampaigns.find(c => searchName.includes(c.name.toLowerCase()))
      }
      // If still not found and "auto", pick the most recent draft
      if (!campaign && campaignId === 'auto' && userCampaigns.length > 0) {
        campaign = userCampaigns[0]
      }
    }
    if (!campaign) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })

    const campaignLeads = campaign.leads
      .map(cl => cl.lead)
      .filter(l => l && l.email && !l.email.includes('(via'))

    if (campaignLeads.length === 0) {
      return NextResponse.json({ error: 'No hay leads con email válido en esta campaña' }, { status: 400 })
    }

    // 1. Activate the campaign
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: 'active',
        startedAt: campaign.startedAt || new Date(),
      },
    })

    // 2. Get sender info
    const senderUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true } })
    const senderName = senderUser?.name || session.user.name || 'OctopusSkills Team'

    // 3. Filter out leads that already have pending actions
    const existingPending = await prisma.growthAction.findMany({
      where: {
        userId: session.user.id,
        status: 'pending',
        leadId: { in: campaignLeads.map(l => l.id) },
      },
      select: { leadId: true },
    })
    const pendingSet = new Set(existingPending.map(a => a.leadId))
    const eligibleLeads = campaignLeads.filter(l => !pendingSet.has(l.id))

    if (eligibleLeads.length === 0) {
      return NextResponse.json({
        campaignId,
        status: 'active',
        generated: 0,
        skipped: campaignLeads.length,
        message: 'Campaña activada. Todos los leads ya tienen acciones pendientes.',
      })
    }

    console.log(`[Campaign Activate] Processing ${eligibleLeads.length} leads for campaign "${campaign.name}"`)

    // 4. Generate AI emails for each lead
    const results: { leadId: string; businessName: string; subject: string; success: boolean; error?: string }[] = []

    for (const lead of eligibleLeads) {
      try {
        const isFollowUp = lead.status === 'contacted' || lead.followUpCount > 0
        const actionType = isFollowUp ? 'send_follow_up' : 'send_outreach_email'

        let prompt = buildOutreachPrompt(lead, senderName)
        if (campaign.emailTemplate) {
          prompt += `\n\nTEMPLATE DE LA CAMPAÑA (usa como guía de tono/estructura):\n${campaign.emailTemplate}`
        }
        if (campaign.emailSubject) {
          prompt += `\n\nASUNTO SUGERIDO POR EL USUARIO: "${campaign.emailSubject}" — puedes usarlo como base.`
        }
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
            title: `[${campaign.name}] ${isFollowUp ? 'Follow-up' : 'Email'} → ${lead.contactName || lead.businessName}: ${emailData.subject}`,
            description: emailData.body.substring(0, 200) + '...',
            payload: JSON.stringify({
              to: lead.email,
              toName: lead.contactName || 'Partner',
              subject: emailData.subject,
              body: emailData.body,
              campaignId: campaign.id,
              campaignName: campaign.name,
            }),
            reasoning: emailData.reasoning,
            status: 'pending',
          },
        })

        results.push({ leadId: lead.id, businessName: lead.businessName || 'Unknown', subject: emailData.subject, success: true })
        console.log(`[Campaign Activate] ✅ Generated for: ${lead.businessName}`)
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error'
        results.push({ leadId: lead.id, businessName: lead.businessName || 'Unknown', subject: '', success: false, error: errMsg })
        console.error(`[Campaign Activate] ❌ Failed for: ${lead.businessName}`, errMsg)
      }
    }

    const successCount = results.filter(r => r.success).length
    console.log(`[Campaign Activate] Complete: ${successCount}/${results.length} emails generated`)

    return NextResponse.json({
      campaignId,
      campaignName: campaign.name,
      status: 'active',
      generated: successCount,
      failed: results.length - successCount,
      skipped: campaignLeads.length - eligibleLeads.length,
      total: campaignLeads.length,
      results,
      message: `✅ Campaña "${campaign.name}" activada. ${successCount} emails generados por AI. Revisa y aprueba para enviar.`,
    })
  } catch (error: unknown) {
    console.error('[Campaign Activate] Error:', error)
    const errMsg = error instanceof Error ? error.message : 'Error del servidor'
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
