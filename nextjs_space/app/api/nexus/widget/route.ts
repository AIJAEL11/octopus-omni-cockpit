import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/nexus/widget — Public endpoint for embeddable widget
// Returns recommended projects for anonymous consumers
// Supports CORS for cross-origin embedding
// ═══════════════════════════════════════════════════════════════════════════════

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, max-age=60', // 1 min cache for performance
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    const contextUrl = searchParams.get('context') // The page embedding the widget
    const limit = Math.min(parseInt(searchParams.get('limit') || '5'), 10)

    const where: Record<string, unknown> = {
      status: 'ACTIVE',
      launches: { some: { status: 'ACTIVE' } },
    }

    if (category) where.category = category

    // Fetch active projects randomly (simple shuffle via createdAt/launchedAt mix)
    const projects = await prisma.nexusProject.findMany({
      where: where as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      take: limit * 3, // Fetch more, then shuffle
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
          select: { id: true },
        },
      },
    })

    // Simple shuffle and limit
    const shuffled = projects
      .sort(() => Math.random() - 0.5)
      .slice(0, limit)
      .map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description.slice(0, 200),
        url: p.url,
        imageUrl: p.imageUrl,
        category: p.category,
        tags: p.tags,
        launchId: p.launches[0]?.id || null,
      }))

    return NextResponse.json(
      {
        projects: shuffled,
        context: contextUrl || null,
        total: projects.length,
      },
      { headers: CORS_HEADERS }
    )
  } catch (error: unknown) {
    console.error('[Nexus Widget GET]', error)
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
