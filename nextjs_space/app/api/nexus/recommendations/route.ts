import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/nexus/recommendations — Smart recommendations engine
// Personalized recommendations based on anonymous user behavior
// PUBLIC endpoint (no auth) — used by widget/extension
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const anonymousId = searchParams.get('anonymousId')
    const limit = Math.min(parseInt(searchParams.get('limit') || '5'), 10)

    // Active projects with active launches
    const baseWhere = {
      status: 'ACTIVE' as const,
      launches: { some: { status: 'ACTIVE' as const } },
    }

    if (!anonymousId) {
      // No history — return popular projects (most clicks)
      const popular = await prisma.nexusProject.findMany({
        where: baseWhere,
        orderBy: { launches: { _count: 'desc' } },
        take: limit,
        select: {
          id: true,
          name: true,
          description: true,
          url: true,
          imageUrl: true,
          category: true,
          tags: true,
          launches: {
            where: { status: 'ACTIVE' },
            take: 1,
            select: { id: true, impressions: true, clicks: true },
          },
        },
      })

      return NextResponse.json({
        projects: popular.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description.slice(0, 200),
          url: p.url,
          imageUrl: p.imageUrl,
          category: p.category,
          tags: p.tags,
          launchId: p.launches[0]?.id || null,
          score: p.launches[0]?.clicks || 0,
          reason: 'popular',
        })),
        strategy: 'popular',
      })
    }

    // With history: find categories the user clicked on
    const userClicks = await prisma.nexusEvent.findMany({
      where: {
        anonymousId,
        eventType: 'CLICK',
      },
      select: { projectId: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    const clickedProjectIds = userClicks.map((e) => e.projectId)

    if (clickedProjectIds.length === 0) {
      // User has no clicks, fall back to popular
      const popular = await prisma.nexusProject.findMany({
        where: baseWhere,
        take: limit,
        select: {
          id: true, name: true, description: true, url: true,
          imageUrl: true, category: true, tags: true,
          launches: { where: { status: 'ACTIVE' }, take: 1, select: { id: true } },
        },
      })
      return NextResponse.json({
        projects: popular.map((p) => ({
          id: p.id, name: p.name, description: p.description.slice(0, 200),
          url: p.url, imageUrl: p.imageUrl, category: p.category,
          tags: p.tags, launchId: p.launches[0]?.id || null,
          score: 0, reason: 'default',
        })),
        strategy: 'default',
      })
    }

    // Find categories of clicked projects
    const clickedProjects = await prisma.nexusProject.findMany({
      where: { id: { in: clickedProjectIds } },
      select: { category: true, tags: true },
    })

    const preferredCategories = [...new Set(
      clickedProjects.map((p) => p.category).filter(Boolean)
    )]
    const preferredTags = [...new Set(
      clickedProjects.flatMap((p) => p.tags)
    )].slice(0, 10)

    // Recommend projects in same categories, excluding already seen
    const dismissed = await prisma.nexusEvent.findMany({
      where: { anonymousId, eventType: 'DISMISS' },
      select: { projectId: true },
    })
    const excludeIds = [...new Set([...clickedProjectIds, ...dismissed.map((e) => e.projectId)])]

    const recommended = await prisma.nexusProject.findMany({
      where: {
        ...baseWhere,
        id: { notIn: excludeIds },
        OR: [
          ...(preferredCategories.length > 0 ? [{ category: { in: preferredCategories as string[] } }] : []),
          ...(preferredTags.length > 0 ? [{ tags: { hasSome: preferredTags } }] : []),
        ],
      } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      take: limit,
      select: {
        id: true, name: true, description: true, url: true,
        imageUrl: true, category: true, tags: true,
        launches: { where: { status: 'ACTIVE' }, take: 1, select: { id: true } },
      },
    })

    return NextResponse.json({
      projects: recommended.map((p) => ({
        id: p.id, name: p.name, description: p.description.slice(0, 200),
        url: p.url, imageUrl: p.imageUrl, category: p.category,
        tags: p.tags, launchId: p.launches[0]?.id || null,
        score: 0, reason: 'personalized',
      })),
      strategy: 'personalized',
      preferredCategories,
      preferredTags: preferredTags.slice(0, 5),
    })
  } catch (error: unknown) {
    console.error('[Nexus Recommendations GET]', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
