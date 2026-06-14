import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/nexus/launches/[id]/metrics — Real-time launch metrics
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const launch = await prisma.nexusLaunch.findFirst({
      where: { id: params.id, userId: session.user.id },
    })
    if (!launch) {
      return NextResponse.json({ error: 'Launch not found' }, { status: 404 })
    }

    // Aggregate events by type
    const eventCounts = await prisma.nexusEvent.groupBy({
      by: ['eventType'],
      where: { launchId: params.id },
      _count: { id: true },
    })

    const metrics: Record<string, number> = {
      impressions: 0,
      clicks: 0,
      dismisses: 0,
    }
    for (const ec of eventCounts) {
      if (ec.eventType === 'IMPRESSION') metrics.impressions = ec._count.id
      if (ec.eventType === 'CLICK') metrics.clicks = ec._count.id
      if (ec.eventType === 'DISMISS') metrics.dismisses = ec._count.id
    }

    const ctr = metrics.impressions > 0
      ? ((metrics.clicks / metrics.impressions) * 100).toFixed(2)
      : '0.00'

    // Daily breakdown (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const dailyEvents = await prisma.nexusEvent.findMany({
      where: { launchId: params.id, createdAt: { gte: sevenDaysAgo } },
      select: { eventType: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })

    const dailyMap = new Map<string, { impressions: number; clicks: number; dismisses: number }>()
    for (const ev of dailyEvents) {
      const day = ev.createdAt.toISOString().split('T')[0]
      if (!dailyMap.has(day)) dailyMap.set(day, { impressions: 0, clicks: 0, dismisses: 0 })
      const d = dailyMap.get(day)!
      if (ev.eventType === 'IMPRESSION') d.impressions++
      if (ev.eventType === 'CLICK') d.clicks++
      if (ev.eventType === 'DISMISS') d.dismisses++
    }

    const daily = Array.from(dailyMap.entries()).map(([date, counts]) => ({
      date,
      ...counts,
    }))

    return NextResponse.json({
      launchId: params.id,
      status: launch.status,
      metrics,
      ctr: parseFloat(ctr),
      daily,
      activatedAt: launch.activatedAt,
      expiresAt: launch.expiresAt,
    })
  } catch (error: unknown) {
    console.error('[Nexus Metrics GET]', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
