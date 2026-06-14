import { callLLM } from '@/lib/turbo-llm'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Seasonal campaign templates (built-in, no DB)
const SEASONAL_TEMPLATES: Record<string, {
  name: string
  emoji: string
  description: string
  months: number[]
  industries: string[]
  hook: string
  urgency: string
}> = {
  summer_rush: {
    name: 'Summer Rush',
    emoji: '☀️',
    description: 'Campaña de verano — tráfico turístico y outdoor experiences',
    months: [5, 6, 7, 8],
    industries: ['restaurant', 'bar', 'hotel', 'cafe', 'entertainment'],
    hook: 'El verano trae 3x más foot traffic. ¿Estás capturando ese tráfico con marketing inteligente o se va a la competencia?',
    urgency: 'Activa tu plan Starter gratis y empieza antes del Memorial Day.',
  },
  holiday_boost: {
    name: 'Holiday Boost',
    emoji: '🎄',
    description: 'Campaña de holidays — private events, catering, gift cards',
    months: [10, 11, 12],
    industries: ['restaurant', 'bar', 'hotel', 'salon', 'retail', 'spa'],
    hook: 'La temporada de holidays es tu oportunidad #1 del año. Marketing automatizado para tus eventos privados.',
    urgency: 'Reserva tu spot antes de que empiece la temporada.',
  },
  new_year_reset: {
    name: 'New Year Reset',
    emoji: '🚀',
    description: 'Campaña de Año Nuevo — nuevos propósitos, gym, wellness, fresh start',
    months: [1, 2],
    industries: ['gym', 'fitness', 'salon', 'spa', 'cafe'],
    hook: 'Enero es el mes con más sign-ups del año. No dejes que se vayan a las 2 semanas.',
    urgency: 'Empieza Enero con ventaja — los early adopters ya están listos.',
  },
  valentines_special: {
    name: 'Valentine\'s Special',
    emoji: '💕',
    description: 'San Valentín — experiencias de pareja, cenas románticas, date nights',
    months: [2],
    industries: ['restaurant', 'bar', 'hotel', 'spa', 'entertainment'],
    hook: 'Campañas de marketing personalizadas para parejas. La experiencia de date night más única de la ciudad.',
    urgency: 'Solo 5 spots disponibles para San Valentín.',
  },
  spring_launch: {
    name: 'Spring Launch',
    emoji: '🌸',
    description: 'Lanzamiento primavera — outdoor dining, patios, events',
    months: [3, 4, 5],
    industries: ['restaurant', 'bar', 'cafe', 'brewery', 'entertainment'],
    hook: 'Patio season está aquí. Marketing inteligente que llena mesas vacías.',
    urgency: 'Plan Starter gratis — actívalo durante el Spring launch.',
  },
  back_to_school: {
    name: 'Back to School',
    emoji: '📚',
    description: 'Regreso a clases — family entertainment, after-school programs',
    months: [8, 9],
    industries: ['entertainment', 'arcade', 'bowling', 'restaurant', 'gym'],
    hook: 'Familias buscan actividades after-school. Marketing automatizado = repeat visits garantizadas.',
    urgency: 'Prepárate para el back-to-school rush con OctopusSkills.',
  },
}

/**
 * GET /api/growth/campaigns
 * Returns user's DB campaigns + seasonal templates
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const currentMonth = new Date().getMonth() + 1

    // 1. Get user's real campaigns from DB
    const campaigns = await prisma.campaign.findMany({
      where: { userId: session.user.id },
      include: {
        leads: {
          select: { id: true, status: true, leadId: true },
        },
        _count: { select: { leads: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // 1b. 🔥 AUTO-HEAL: Backfill CampaignLead.status from GrowthAction data,
    // then recompute campaign aggregate counts. This keeps progress bars accurate
    // even for historical approvals that predate the counter-sync fix.
    if (campaigns.length > 0) {
      // Collect all leadIds from all campaigns
      const allCampaignLeadIds = new Set<string>()
      for (const camp of campaigns) {
        for (const cl of camp.leads) allCampaignLeadIds.add(cl.leadId)
      }

      if (allCampaignLeadIds.size > 0) {
        // Find which leads have executed email actions (sent emails)
        const executedActions = await prisma.growthAction.findMany({
          where: {
            userId: session.user.id,
            leadId: { in: Array.from(allCampaignLeadIds) },
            status: 'executed',
            actionType: { in: ['send_outreach_email', 'send_follow_up'] },
          },
          select: { leadId: true, executedAt: true },
        })
        const sentLeadMap = new Map<string, Date | null>()
        for (const a of executedActions) {
          if (a.leadId) sentLeadMap.set(a.leadId, a.executedAt)
        }

        // Update CampaignLead rows that are still 'pending' but actually sent
        for (const camp of campaigns) {
          for (const cl of camp.leads) {
            if (cl.status === 'pending' && sentLeadMap.has(cl.leadId)) {
              await prisma.campaignLead.update({
                where: { id: cl.id },
                data: { status: 'sent', sentAt: sentLeadMap.get(cl.leadId) || new Date() },
              }).catch(() => {})
              cl.status = 'sent' // reflect in local data
            }
          }
        }
      }
    }

    // 1c. Recompute aggregate counts from (now-healed) CampaignLead data
    for (const camp of campaigns) {
      const sentCount = camp.leads.filter(cl => ['sent', 'opened', 'replied', 'converted'].includes(cl.status)).length
      const replyCount = camp.leads.filter(cl => ['replied', 'converted'].includes(cl.status)).length
      const convertedCount = camp.leads.filter(cl => cl.status === 'converted').length
      if (camp.sentCount !== sentCount || camp.replyCount !== replyCount || camp.convertedCount !== convertedCount) {
        await prisma.campaign.update({
          where: { id: camp.id },
          data: { sentCount, replyCount, convertedCount },
        }).catch(() => {})
        camp.sentCount = sentCount
        camp.replyCount = replyCount
        camp.convertedCount = convertedCount
      }
    }
    // 2. Get seasonal templates
    const leadTypes = await prisma.growthLead.groupBy({
      by: ['businessType'],
      where: { userId: session.user.id },
      _count: { id: true },
    })
    const userIndustries = leadTypes.map(l => l.businessType || 'other')

    const activeSeasonal = Object.entries(SEASONAL_TEMPLATES)
      .filter(([, c]) => c.months.includes(currentMonth))
      .map(([key, c]) => {
        const matchingLeads = userIndustries.filter(i => c.industries.includes(i))
        return {
          id: `seasonal_${key}`,
          ...c,
          isSeasonal: true,
          isActive: true,
          matchingIndustries: matchingLeads,
          relevance: matchingLeads.length > 0 ? 'high' : 'medium',
        }
      })

    return NextResponse.json({
      campaigns,
      seasonalTemplates: activeSeasonal,
      currentMonth,
      stats: {
        total: campaigns.length,
        active: campaigns.filter(c => c.status === 'active').length,
        draft: campaigns.filter(c => c.status === 'draft').length,
        completed: campaigns.filter(c => c.status === 'completed').length,
        totalLeadsInCampaigns: campaigns.reduce((sum, c) => sum + c._count.leads, 0),
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error del servidor'
    console.error('[Growth Campaigns GET] Error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST /api/growth/campaigns
 * Create a new campaign (real DB campaign) or apply seasonal template
 * Body: { name, description?, campaignType?, targetCriteria?, emailSubject?, emailTemplate?, leadIds? }
 * OR for seasonal: { seasonalId, leadId } (backward compat)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json()

    // === BACKWARD COMPAT: Seasonal campaign application ===
    if (body.campaignId && body.leadId) {
      return handleSeasonalApply(session.user.id, body.campaignId, body.leadId)
    }

    // === NEW: Create real campaign ===
    const { name, description, campaignType, targetCriteria, emailSubject, emailTemplate, sequence, leadIds } = body

    if (!name) {
      return NextResponse.json({ error: 'Nombre de campaña requerido' }, { status: 400 })
    }

    const campaign = await prisma.campaign.create({
      data: {
        userId: session.user.id,
        name,
        description: description || null,
        campaignType: campaignType || 'outreach',
        targetCriteria: targetCriteria ? JSON.stringify(targetCriteria) : null,
        emailSubject: emailSubject || null,
        emailTemplate: emailTemplate || null,
        sequence: sequence ? JSON.stringify(sequence) : null,
        status: 'draft',
      },
    })

    // If leadIds provided, assign leads to campaign
    if (leadIds && Array.isArray(leadIds) && leadIds.length > 0) {
      const validLeads = await prisma.growthLead.findMany({
        where: { id: { in: leadIds }, userId: session.user.id },
        select: { id: true },
      })

      if (validLeads.length > 0) {
        await prisma.campaignLead.createMany({
          data: validLeads.map(l => ({
            campaignId: campaign.id,
            leadId: l.id,
          })),
          skipDuplicates: true,
        })

        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { totalLeads: validLeads.length },
        })
      }
    }

    // Fetch with relations
    const full = await prisma.campaign.findUnique({
      where: { id: campaign.id },
      include: { leads: true, _count: { select: { leads: true } } },
    })

    return NextResponse.json({ campaign: full }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error del servidor'
    console.error('[Growth Campaigns POST] Error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * PATCH /api/growth/campaigns
 * Update a campaign: { id, status?, name?, description?, emailSubject?, emailTemplate?, addLeadIds?, removeLeadIds? }
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json()
    const { id, status, name, description, emailSubject, emailTemplate, campaignType, addLeadIds, removeLeadIds } = body
    if (!id) return NextResponse.json({ error: 'Campaign ID requerido' }, { status: 400 })

    // Verify ownership
    const existing = await prisma.campaign.findFirst({ where: { id, userId: session.user.id } })
    if (!existing) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })

    // Build update data
    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (emailSubject !== undefined) updateData.emailSubject = emailSubject
    if (emailTemplate !== undefined) updateData.emailTemplate = emailTemplate
    if (campaignType !== undefined) updateData.campaignType = campaignType
    if (status !== undefined) {
      updateData.status = status
      if (status === 'active' && !existing.startedAt) updateData.startedAt = new Date()
      if (status === 'completed') updateData.completedAt = new Date()
    }

    const campaign = await prisma.campaign.update({
      where: { id },
      data: updateData,
    })

    // Smart assign: assignTopN grabs the top N leads by qualification score automatically
    if (body.assignTopN && typeof body.assignTopN === 'number' && body.assignTopN > 0) {
      // Get IDs of leads already in this campaign to exclude them
      const existingCampaignLeads = await prisma.campaignLead.findMany({
        where: { campaignId: id },
        select: { leadId: true },
      })
      const excludeIds = existingCampaignLeads.map(cl => cl.leadId)

      const topLeads = await prisma.growthLead.findMany({
        where: {
          userId: session.user.id,
          ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
        },
        orderBy: { qualificationScore: 'desc' },
        take: body.assignTopN,
        select: { id: true, businessName: true, qualificationScore: true },
      })

      if (topLeads.length > 0) {
        await prisma.campaignLead.createMany({
          data: topLeads.map(l => ({ campaignId: id, leadId: l.id })),
          skipDuplicates: true,
        })
      }

      // Recount & return early with assigned lead names
      const newLeadCount = await prisma.campaignLead.count({ where: { campaignId: id } })
      await prisma.campaign.update({ where: { id }, data: { totalLeads: newLeadCount } })
      const full = await prisma.campaign.findUnique({
        where: { id },
        include: { leads: true, _count: { select: { leads: true } } },
      })
      return NextResponse.json({
        campaign: full,
        assignedLeads: topLeads,
        assignedCount: topLeads.length,
        requestedCount: body.assignTopN,
      })
    }

    // Add leads by explicit IDs
    if (addLeadIds && Array.isArray(addLeadIds) && addLeadIds.length > 0) {
      const validLeads = await prisma.growthLead.findMany({
        where: { id: { in: addLeadIds }, userId: session.user.id },
        select: { id: true },
      })
      if (validLeads.length > 0) {
        await prisma.campaignLead.createMany({
          data: validLeads.map(l => ({ campaignId: id, leadId: l.id })),
          skipDuplicates: true,
        })
      }
    }

    // Remove leads
    if (removeLeadIds && Array.isArray(removeLeadIds) && removeLeadIds.length > 0) {
      await prisma.campaignLead.deleteMany({
        where: { campaignId: id, leadId: { in: removeLeadIds } },
      })
    }

    // Recount total leads
    const leadCount = await prisma.campaignLead.count({ where: { campaignId: id } })
    await prisma.campaign.update({ where: { id }, data: { totalLeads: leadCount } })

    const full = await prisma.campaign.findUnique({
      where: { id },
      include: { leads: true, _count: { select: { leads: true } } },
    })

    return NextResponse.json({ campaign: full })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error del servidor'
    console.error('[Growth Campaigns PATCH] Error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * DELETE /api/growth/campaigns?id=xxx
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Campaign ID requerido' }, { status: 400 })

    const existing = await prisma.campaign.findFirst({ where: { id, userId: session.user.id } })
    if (!existing) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })

    await prisma.campaign.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error del servidor'
    console.error('[Growth Campaigns DELETE] Error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ============================================================
// HELPER: Seasonal template application (backward compat)
// ============================================================
async function handleSeasonalApply(userId: string, campaignId: string, leadId: string) {
  const campaign = SEASONAL_TEMPLATES[campaignId]
  if (!campaign) return NextResponse.json({ error: 'Campaña seasonal no encontrada' }, { status: 404 })

  const lead = await prisma.growthLead.findFirst({
    where: { id: leadId, userId },
  })
  if (!lead || !lead.email) return NextResponse.json({ error: 'Lead no encontrado o sin email' }, { status: 404 })

  const existingAction = await prisma.growthAction.findFirst({
    where: { leadId, userId, status: 'pending' },
  })
  if (existingAction) {
    return NextResponse.json({ error: 'Ya existe una acción pendiente para este lead' }, { status: 409 })
  }

  const senderUser = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
  const senderName = senderUser?.name || 'The OctopusSkills Team'

  const data = await callLLM(userId, [{
    role: 'user',
    content: `Genera un email de outreach para la campaña seasonal "${campaign.name}" ${campaign.emoji} de OctopusSkills.

CAMPAÑA:
- Tema: ${campaign.description}
- Hook: ${campaign.hook}
- Urgencia: ${campaign.urgency}

LEAD:
- Negocio: ${lead.businessName}
- Tipo: ${lead.businessType || 'N/A'}
- Contacto: ${lead.contactName || 'Partner'}
- Ciudad: ${lead.city || 'N/A'}

SOBRE OCTOPUSSKILLS:
OctopusSkills es la primera plataforma todo-en-uno de marketing, creatividad y automatización potenciada por IA.
Módulos: Growth Engine (leads + outreach), Creative Studio (contenido IA), IoT Sentinel (automatización), Reputation Shield (reseñas), Skill Factory (cursos).
Oferta: Plan Starter 100% gratis, sin tarjeta de crédito. Planes Pro y Business para escalar.
Website: octopuskills.com

REGLAS:
- Firmado por: ${senderName}, OctopusSkills
- Tono: Profesional pero cercano, en inglés
- Máximo 120 palabras body
- Menciona la campaña seasonal naturalmente
- CTA directo: "Reply 'YES' to reserve your spot"

Responde en JSON: { "subject": "...", "body": "...", "reasoning": "..." }`,
  }], { model: 'gpt-4.1-mini', temperature: 0.7, maxTokens: 800 })
  const raw = data.choices?.[0]?.message?.content || ''
  let emailData: { subject: string; body: string; reasoning: string }
  try {
    const m = raw.match(/\{[\s\S]*\}/)
    emailData = m ? JSON.parse(m[0]) : JSON.parse(raw)
  } catch {
    emailData = { subject: `${campaign.emoji} ${campaign.name} — ${lead.businessName}`, body: raw, reasoning: 'Fallback' }
  }

  const action = await prisma.growthAction.create({
    data: {
      userId,
      leadId: lead.id,
      actionType: 'send_outreach_email',
      title: `${campaign.emoji} ${campaign.name} → ${lead.businessName}: ${emailData.subject}`,
      description: emailData.body.substring(0, 200) + '...',
      payload: JSON.stringify({
        to: lead.email,
        toName: lead.contactName || 'Partner',
        subject: emailData.subject,
        body: emailData.body,
        campaignId,
        campaignName: campaign.name,
      }),
      reasoning: emailData.reasoning,
      status: 'pending',
    },
  })

  return NextResponse.json({ action, email: emailData })
}