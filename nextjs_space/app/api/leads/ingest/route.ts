import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { classifyEmail, autoScoreLead, getPriority } from '@/lib/growth-engine'

export const dynamic = 'force-dynamic'

/**
 * POST /api/leads/ingest
 * Public endpoint for external lead capture (blogs, landing pages, widgets).
 * Auth: x-api-key header must match BLOG_INGEST_KEY env var.
 * Body: { email, name?, source, sourceUrl?, tags?: string[] }
 * Returns: { success, leadId, status }
 *
 * REUSABLE: Any Octopus user can generate their own ingest key
 * and connect external lead capture systems.
 */
export async function POST(req: NextRequest) {
  try {
    // --- API Key auth ---
    const apiKey = req.headers.get('x-api-key')
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing x-api-key header' },
        { status: 401 }
      )
    }

    // Look up user by their ingest key
    const ingestConfig = await getIngestConfig(apiKey)
    if (!ingestConfig) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 403 }
      )
    }

    // --- Parse body ---
    const body = await req.json()
    const { email, name, source, sourceUrl, tags } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'email is required' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail.includes('@')) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // --- Dedup check ---
    const existing = await prisma.growthLead.findFirst({
      where: {
        userId: ingestConfig.userId,
        email: normalizedEmail,
      },
    })

    if (existing) {
      // Update tags/sourceUrl if provided (merge tags)
      const updates: Record<string, unknown> = {}
      if (sourceUrl && !existing.sourceUrl) updates.sourceUrl = sourceUrl
      if (tags && Array.isArray(tags)) {
        const existingTags: string[] = existing.tags ? JSON.parse(existing.tags) : []
        const mergedTags = [...new Set([...existingTags, ...tags])]
        updates.tags = JSON.stringify(mergedTags)
      }
      if (Object.keys(updates).length > 0) {
        await prisma.growthLead.update({
          where: { id: existing.id },
          data: updates,
        })
      }
      return NextResponse.json({
        success: true,
        leadId: existing.id,
        status: 'existing',
        message: 'Lead already exists, metadata updated',
      })
    }

    // --- Create new lead ---
    const emailClass = classifyEmail(normalizedEmail)
    const leadData = {
      userId: ingestConfig.userId,
      businessName: name || normalizedEmail.split('@')[0] || 'Unknown',
      contactName: name || null,
      email: normalizedEmail,
      emailCategory: emailClass.category,
      leadSource: source || 'external-ingest',
      sourceUrl: sourceUrl || null,
      tags: tags && Array.isArray(tags) ? JSON.stringify(tags) : null,
      qualificationScore: 0,
      priority: 'medium' as string,
      status: 'new',
    }
    leadData.qualificationScore = autoScoreLead(leadData)
    leadData.priority = getPriority(leadData.qualificationScore)

    const lead = await prisma.growthLead.create({ data: leadData })

    // --- Auto-enroll in active nurture campaigns matching source ---
    await enrollInNurtureCampaigns(ingestConfig.userId, lead.id, source, tags)

    console.log(`[Lead Ingest] ✅ New lead: ${normalizedEmail} from ${source || 'unknown'} for user ${ingestConfig.userId}`)

    return NextResponse.json({
      success: true,
      leadId: lead.id,
      status: 'created',
    }, { status: 201 })
  } catch (error) {
    console.error('[Lead Ingest] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// --- Helpers ---

/**
 * Validate API key and return the associated user config.
 * For now, checks against the BLOG_INGEST_KEY env var (single-tenant).
 * Future: look up per-user API keys from a table.
 */
async function getIngestConfig(apiKey: string): Promise<{ userId: string } | null> {
  const envKey = process.env.BLOG_INGEST_KEY
  if (!envKey || apiKey !== envKey) return null

  // Find the admin/owner user (first user or configurable)
  // For multi-tenant: each user would have their own key
  const adminUser = await prisma.user.findFirst({
    where: { email: '1billontopview@gmail.com' },
    select: { id: true },
  })
  if (!adminUser) {
    // Fallback: first user in system
    const firstUser = await prisma.user.findFirst({ select: { id: true } })
    return firstUser ? { userId: firstUser.id } : null
  }
  return { userId: adminUser.id }
}

/**
 * Auto-enroll a new lead into active nurture campaigns
 * that match the lead's source or tags.
 */
async function enrollInNurtureCampaigns(
  userId: string,
  leadId: string,
  source?: string,
  tags?: string[]
) {
  try {
    // Find active nurture campaigns for this user
    const campaigns = await prisma.campaign.findMany({
      where: {
        userId,
        campaignType: 'nurture',
        status: 'active',
      },
    })

    for (const campaign of campaigns) {
      // Check if campaign targets this source
      let shouldEnroll = false
      if (campaign.targetCriteria) {
        try {
          const criteria = JSON.parse(campaign.targetCriteria)
          // Match by source
          if (criteria.source && source && criteria.source === source) {
            shouldEnroll = true
          }
          // Match by tag overlap
          if (criteria.tags && tags) {
            const criteraTags: string[] = criteria.tags
            if (criteraTags.some(t => tags.includes(t))) {
              shouldEnroll = true
            }
          }
          // If no criteria specified, enroll all
          if (!criteria.source && !criteria.tags) {
            shouldEnroll = true
          }
        } catch {
          shouldEnroll = true // malformed criteria = enroll all
        }
      } else {
        shouldEnroll = true // no criteria = enroll all
      }

      if (shouldEnroll) {
        // Check if already enrolled
        const exists = await prisma.campaignLead.findUnique({
          where: { campaignId_leadId: { campaignId: campaign.id, leadId } },
        })
        if (!exists) {
          await prisma.campaignLead.create({
            data: {
              campaignId: campaign.id,
              leadId,
              status: 'pending',
              currentStep: 0,
            },
          })
          // Increment totalLeads
          await prisma.campaign.update({
            where: { id: campaign.id },
            data: { totalLeads: { increment: 1 } },
          })
          console.log(`[Lead Ingest] Enrolled lead ${leadId} in nurture campaign: ${campaign.name}`)
        }
      }
    }
  } catch (err) {
    console.error('[Lead Ingest] Error enrolling in nurture campaigns:', err)
    // Non-fatal: lead was still created
  }
}
