export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ────────────────────────────────────────────────────────────────────────────
// GET /api/hosted-sites/analytics?siteId=X&period=7d
// Returns: totalViews, uniquePaths, viewsByDay[], topPages[], topReferrers[]
// ────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const siteId = req.nextUrl.searchParams.get('siteId')
    if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 })

    const periodParam = req.nextUrl.searchParams.get('period') || '7d'
    const days = periodParam === '30d' ? 30 : periodParam === '24h' ? 1 : 7

    // Verify ownership
    const site = await prisma.hostedSite.findFirst({
      where: { id: siteId, userId: session.user.id },
      select: { id: true, slug: true, name: true, createdAt: true },
    })
    if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 })

    const since = new Date()
    since.setDate(since.getDate() - days)

    // Total views in period
    const totalViews = await prisma.hostedSiteView.count({
      where: { siteId, createdAt: { gte: since } },
    })

    // All-time total views
    const totalViewsAllTime = await prisma.hostedSiteView.count({
      where: { siteId },
    })

    // Views by day — raw query for grouping by date
    const viewsByDay: { date: string; count: number }[] = []
    const allViews = await prisma.hostedSiteView.findMany({
      where: { siteId, createdAt: { gte: since } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    })

    // Group by day
    const dayMap = new Map<string, number>()
    // Pre-fill all days in range
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().split('T')[0]
      dayMap.set(key, 0)
    }
    for (const v of allViews) {
      const key = v.createdAt.toISOString().split('T')[0]
      dayMap.set(key, (dayMap.get(key) || 0) + 1)
    }
    for (const [date, count] of dayMap) {
      viewsByDay.push({ date, count })
    }

    // Top pages
    const pathCounts = new Map<string, number>()
    const pathViews = await prisma.hostedSiteView.findMany({
      where: { siteId, createdAt: { gte: since } },
      select: { path: true },
    })
    for (const v of pathViews) {
      const p = v.path || '/'
      pathCounts.set(p, (pathCounts.get(p) || 0) + 1)
    }
    const topPages = [...pathCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, count]) => ({ path, count }))

    // Top referrers (non-null only)
    const refCounts = new Map<string, number>()
    const refViews = await prisma.hostedSiteView.findMany({
      where: { siteId, createdAt: { gte: since }, referrer: { not: null } },
      select: { referrer: true },
    })
    for (const v of refViews) {
      if (!v.referrer) continue
      // Extract domain from referrer
      let domain = v.referrer
      try { domain = new URL(v.referrer).hostname } catch { /* keep raw */ }
      refCounts.set(domain, (refCounts.get(domain) || 0) + 1)
    }
    const topReferrers = [...refCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([referrer, count]) => ({ referrer, count }))

    // Top countries
    const countryCounts = new Map<string, number>()
    const countryViews = await prisma.hostedSiteView.findMany({
      where: { siteId, createdAt: { gte: since }, country: { not: null } },
      select: { country: true },
    })
    for (const v of countryViews) {
      if (!v.country) continue
      countryCounts.set(v.country, (countryCounts.get(v.country) || 0) + 1)
    }
    const topCountries = [...countryCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([country, count]) => ({ country, count }))

    return NextResponse.json({
      success: true,
      siteId: site.id,
      slug: site.slug,
      period: periodParam,
      totalViews,
      totalViewsAllTime,
      viewsByDay,
      topPages,
      topReferrers,
      topCountries,
    })
  } catch (e: unknown) {
    console.error('[Analytics] GET error', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
