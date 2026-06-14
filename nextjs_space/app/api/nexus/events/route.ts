import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/nexus/events — Record anonymous analytics event
// PUBLIC endpoint (no auth required) — used by widget/extension
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { launchId, projectId, anonymousId, eventType, contextUrl } = body

    if (!launchId || !projectId || !anonymousId || !eventType) {
      return NextResponse.json(
        { error: 'launchId, projectId, anonymousId, and eventType are required' },
        { status: 400 }
      )
    }

    // Validate event type
    const validTypes = ['IMPRESSION', 'CLICK', 'DISMISS']
    if (!validTypes.includes(eventType)) {
      return NextResponse.json({ error: 'Invalid eventType' }, { status: 400 })
    }

    // Verify launch exists and is active
    const launch = await prisma.nexusLaunch.findFirst({
      where: { id: launchId, projectId, status: 'ACTIVE' },
    })
    if (!launch) {
      return NextResponse.json({ error: 'Active launch not found' }, { status: 404 })
    }

    // Check blacklist
    const blacklisted = await prisma.nexusBlacklist.findFirst({
      where: { type: 'ANONYMOUS_ID', value: anonymousId },
    })
    if (blacklisted) {
      // Silently accept but don't record
      return NextResponse.json({ ok: true })
    }

    // Record event
    await prisma.nexusEvent.create({
      data: {
        launchId,
        projectId,
        anonymousId,
        eventType,
        contextUrl: contextUrl || null,
      },
    })

    // Update launch counters (denormalized for fast reads)
    const counterField =
      eventType === 'IMPRESSION' ? 'impressions' :
      eventType === 'CLICK' ? 'clicks' :
      'reaches'

    await prisma.nexusLaunch.update({
      where: { id: launchId },
      data: { [counterField]: { increment: 1 } },
    })

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    console.error('[Nexus Events POST]', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
