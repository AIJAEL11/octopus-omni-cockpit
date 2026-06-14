import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/nexus/projects — List user's Nexus projects
// POST /api/nexus/projects — Create a new Nexus project
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: Record<string, unknown> = { userId: session.user.id }
    if (status) where.status = status

    const [projects, total] = await Promise.all([
      prisma.nexusProject.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          launches: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              status: true,
              impressions: true,
              clicks: true,
              reaches: true,
              activatedAt: true,
              expiresAt: true,
            },
          },
          guardianReview: {
            select: { status: true, overallScore: true },
          },
          _count: { select: { launches: true } },
        },
      }),
      prisma.nexusProject.count({ where }),
    ])

    return NextResponse.json({ projects, total, limit, offset })
  } catch (error: unknown) {
    console.error('[Nexus Projects GET]', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { name, description, url, imageUrl, category, tags } = body

    if (!name || !description || !url) {
      return NextResponse.json(
        { error: 'name, description and url are required' },
        { status: 400 }
      )
    }

    // Validate URL format
    try {
      new URL(url)
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
    }

    const project = await prisma.nexusProject.create({
      data: {
        userId: session.user.id,
        name: name.trim(),
        description: description.trim(),
        url: url.trim(),
        imageUrl: imageUrl || null,
        category: category || null,
        tags: Array.isArray(tags) ? tags : [],
        status: 'PENDING_PAYMENT',
      },
    })

    console.log(`[Nexus] Project created: ${project.id} by user ${session.user.id}`)
    return NextResponse.json({ project }, { status: 201 })
  } catch (error: unknown) {
    console.error('[Nexus Projects POST]', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
