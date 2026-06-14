export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { withDbRetry } from '@/lib/prisma'

/**
 * POST /api/growth/leads/auto-track
 * 
 * Automatically upsert a lead when an email is sent.
 * If the email matches an existing lead, update lastContactedAt + increment followUpCount.
 * If no lead exists, create one with whatever data is provided.
 * 
 * v2.0 — Improvements:
 * - Detailed logging for every step (debug production issues)
 * - DB retry wrapper for resilience against idle-session-timeout
 * - Duplicate prevention: uses findMany + picks most recently updated lead
 * - Input sanitization and edge case handling
 * 
 * Body: { email, contactName?, businessName?, phone?, website?, city?, state?, country?, notes?, subject? }
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now()
  let parsedBody: Record<string, unknown> = {}

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      console.warn('[auto-track] ⛔ Unauthorized request (no session)')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id

    // Parse body with error handling
    try {
      parsedBody = await req.json()
    } catch (parseErr) {
      console.error('[auto-track] ❌ Failed to parse request body:', parseErr)
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { email, contactName, businessName, phone, website, city, state, country, notes, subject } = parsedBody as Record<string, string | undefined>

    // Validate email
    const cleanEmail = (email || '').trim().toLowerCase()
    if (!cleanEmail || !cleanEmail.includes('@') || cleanEmail.length < 5) {
      console.warn(`[auto-track] ⚠️ Invalid email rejected: "${email}"`)
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
    }

    console.log(`[auto-track] 📩 Processing: email=${cleanEmail}, contactName=${contactName || 'N/A'}, businessName=${businessName || 'N/A'}, userId=${userId.slice(-6)}`)

    // Check ALL existing leads for this email (not just first) — prevents duplicates
    const existingLeads = await withDbRetry(() =>
      prisma.growthLead.findMany({
        where: { userId, email: cleanEmail },
        orderBy: { updatedAt: 'desc' },
      })
    )

    if (existingLeads.length > 0) {
      // Pick the MOST RECENTLY UPDATED lead (best match for active workflows)
      const existing = existingLeads[0]

      if (existingLeads.length > 1) {
        console.warn(`[auto-track] ⚠️ Found ${existingLeads.length} duplicate leads for ${cleanEmail}. Using most recent: ${existing.id} (updated ${existing.updatedAt?.toISOString()})`)
      }

      // Update existing lead: bump lastContactedAt, followUpCount, and set status to contacted
      const updated = await withDbRetry(() =>
        prisma.growthLead.update({
          where: { id: existing.id },
          data: {
            lastContactedAt: new Date(),
            followUpCount: (existing.followUpCount || 0) + 1,
            // Promote status: new→contacted, anything else stays
            status: ['new', 'imported'].includes(existing.status || '') ? 'contacted' : existing.status,
            // Fill in missing fields if we have new data
            ...(contactName && !existing.contactName ? { contactName: contactName.trim() } : {}),
            ...(businessName && (!existing.businessName || isGenericBusinessName(existing.businessName, existing.email || '')) ? { businessName: businessName.trim() } : {}),
            ...(phone && !existing.phone ? { phone: phone.trim() } : {}),
            ...(website && !existing.website ? { website: website.trim() } : {}),
            ...(city && !existing.city ? { city: city.trim() } : {}),
            ...(state && !existing.state ? { state: state.trim() } : {}),
            ...(country && !existing.country ? { country: country.trim() } : {}),
            ...(notes ? { notes: existing.notes ? `${existing.notes}\n---\n${notes}` : notes } : {}),
          },
          select: { id: true, businessName: true, contactName: true, email: true, followUpCount: true, lastContactedAt: true, status: true },
        })
      )

      const elapsed = Date.now() - startTime
      console.log(`[auto-track] ✅ UPDATED lead ${updated.id}: ${updated.contactName || 'N/A'} @ ${updated.businessName || 'N/A'} | followUp=#${updated.followUpCount} | status=${updated.status} | ${elapsed}ms`)
      return NextResponse.json({ action: 'updated', lead: updated })
    }

    // === CREATE NEW LEAD ===
    // Derive businessName from email domain if not provided
    let bName = (businessName || '').trim()
    if (!bName && cleanEmail.includes('@')) {
      const domainPart = cleanEmail.split('@')[1]?.split('.')[0] || ''
      bName = domainPart.charAt(0).toUpperCase() + domainPart.slice(1)
    }
    if (!bName && contactName) bName = contactName.trim()
    if (!bName) bName = cleanEmail.split('@')[0] || 'Unknown'

    // Simple email classification
    const freeProviders = ['gmail', 'yahoo', 'hotmail', 'outlook', 'aol', 'icloud', 'protonmail', 'live', 'msn', 'me', 'ymail']
    const domain = cleanEmail.split('@')[1]?.split('.')[0]?.toLowerCase() || ''
    const isBusinessEmail = !freeProviders.includes(domain)
    const emailCategory = isBusinessEmail ? 'A' : 'B'

    // Auto-score based on data completeness
    let score = 25 // base
    if (isBusinessEmail) score += 15
    if (contactName) score += 10
    if (phone) score += 10
    if (website) score += 10
    if (city) score += 5

    const lead = await withDbRetry(() =>
      prisma.growthLead.create({
        data: {
          userId,
          businessName: bName,
          contactName: contactName?.trim() || null,
          email: cleanEmail,
          emailCategory,
          phone: phone?.trim() || null,
          website: website?.trim() || null,
          city: city?.trim() || null,
          state: state?.trim() || null,
          country: country?.trim() || 'US',
          qualificationScore: Math.min(100, score),
          leadTier: score >= 70 ? 'diamond' : score >= 50 ? 'gold' : score >= 30 ? 'silver' : 'bronze',
          leadSource: 'email-outreach',
          status: 'contacted',
          lastContactedAt: new Date(),
          followUpCount: 1,
          notes: notes || (subject ? `First email: ${subject}` : null),
        },
        select: { id: true, businessName: true, contactName: true, email: true, followUpCount: true, lastContactedAt: true, qualificationScore: true, leadTier: true },
      })
    )

    const elapsed = Date.now() - startTime
    console.log(`[auto-track] ✅ CREATED lead ${lead.id}: ${lead.contactName || 'N/A'} @ ${lead.businessName} <${lead.email}> | score=${lead.qualificationScore} tier=${lead.leadTier} | ${elapsed}ms`)
    return NextResponse.json({ action: 'created', lead })
  } catch (err) {
    const elapsed = Date.now() - startTime
    console.error(`[auto-track] ❌ FATAL ERROR after ${elapsed}ms:`, err)
    console.error(`[auto-track] ❌ Request body was:`, JSON.stringify(parsedBody).slice(0, 500))
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

/** Check if a businessName is just derived from the email domain (generic) */
function isGenericBusinessName(name: string, email: string): boolean {
  if (!name || !email) return true
  const domain = email.split('@')[1]?.split('.')[0]?.toLowerCase() || ''
  return name.toLowerCase() === domain
}
