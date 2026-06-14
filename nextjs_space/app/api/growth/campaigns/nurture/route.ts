import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NURTURE_TEMPLATES, getNurtureTemplate, templateToSequence, templateToCriteria } from '@/lib/nurture-templates'

export const dynamic = 'force-dynamic'

/**
 * GET /api/growth/campaigns/nurture
 * List available nurture templates + active nurture campaigns.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const campaigns = await prisma.campaign.findMany({
      where: {
        userId: session.user.id,
        campaignType: 'nurture',
      },
      include: {
        _count: { select: { leads: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      templates: NURTURE_TEMPLATES.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        source: t.source,
        tags: t.tags,
        stepsCount: t.steps.length,
        steps: t.steps.map(s => ({ subject: s.subject, delayHours: s.delayHours })),
      })),
      campaigns,
    })
  } catch (error) {
    console.error('[Nurture API] GET error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

/**
 * POST /api/growth/campaigns/nurture
 * Create a nurture campaign from a template.
 * Body: { templateId: string } or { name, sequence: NurtureStep[], targetCriteria? }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json()
    const { templateId, name, sequence, targetCriteria } = body

    let campaignData: {
      name: string
      description: string
      sequence: string
      targetCriteria: string | null
    }

    if (templateId) {
      // Create from template
      const template = getNurtureTemplate(templateId)
      if (!template) {
        return NextResponse.json({ error: `Template not found: ${templateId}` }, { status: 404 })
      }
      campaignData = {
        name: template.name,
        description: template.description,
        sequence: templateToSequence(template),
        targetCriteria: templateToCriteria(template),
      }
    } else if (name && sequence) {
      // Custom nurture campaign
      campaignData = {
        name,
        description: body.description || '',
        sequence: typeof sequence === 'string' ? sequence : JSON.stringify(sequence),
        targetCriteria: targetCriteria ? (typeof targetCriteria === 'string' ? targetCriteria : JSON.stringify(targetCriteria)) : null,
      }
    } else {
      return NextResponse.json({ error: 'templateId or (name + sequence) required' }, { status: 400 })
    }

    // Check for duplicate active nurture campaign with same name
    const existing = await prisma.campaign.findFirst({
      where: {
        userId: session.user.id,
        name: campaignData.name,
        campaignType: 'nurture',
        status: { in: ['active', 'draft'] },
      },
    })
    if (existing) {
      return NextResponse.json({
        error: 'A nurture campaign with this name already exists',
        existingCampaignId: existing.id,
      }, { status: 409 })
    }

    const campaign = await prisma.campaign.create({
      data: {
        userId: session.user.id,
        name: campaignData.name,
        description: campaignData.description,
        campaignType: 'nurture',
        status: 'active', // Start immediately
        sequence: campaignData.sequence,
        targetCriteria: campaignData.targetCriteria,
        startedAt: new Date(),
      },
    })

    console.log(`[Nurture Campaign] ✅ Created: ${campaign.name} (${campaign.id}) for user ${session.user.id}`)

    return NextResponse.json({
      success: true,
      campaign,
      message: `Nurture campaign "${campaign.name}" created and active. New leads matching criteria will be auto-enrolled.`,
    }, { status: 201 })
  } catch (error) {
    console.error('[Nurture API] POST error:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
