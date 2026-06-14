import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/nexus/search — Public discovery endpoint
// Returns active Nexus projects for consumers/widget
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') || ''
    const category = searchParams.get('category')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
    const offset = parseInt(searchParams.get('offset') || '0')

    // Only show ACTIVE projects with at least one active launch
    const where: Record<string, unknown> = {
      status: 'ACTIVE',
      launches: { some: { status: 'ACTIVE' } },
    }

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { tags: { has: q.toLowerCase() } },
      ]
    }

    if (category) {
      where.category = category
    }

    const [projects, total] = await Promise.all([
      prisma.nexusProject.findMany({
        where: where as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        orderBy: { launchedAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          name: true,
          description: true,
          url: true,
          imageUrl: true,
          category: true,
          tags: true,
          launchedAt: true,
        },
      }),
      prisma.nexusProject.count({ where: where as any }), // eslint-disable-line @typescript-eslint/no-explicit-any
    ])

    // Get distinct categories for filtering
    const categories = await prisma.nexusProject.findMany({
      where: { status: 'ACTIVE' },
      distinct: ['category'],
      select: { category: true },
    })

    return NextResponse.json({
      projects,
      total,
      limit,
      offset,
      categories: categories.map((c) => c.category).filter(Boolean),
    })
  } catch (error: unknown) {
    console.error('[Nexus Search GET]', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
