import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/nexus/launches/[id] — Get single launch details
// PATCH /api/nexus/launches/[id] — Update launch (admin: activate, pause, etc.)
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
      include: {
        project: {
          select: { id: true, name: true, url: true, imageUrl: true, status: true },
        },
        _count: { select: { events: true } },
      },
    })

    if (!launch) {
      return NextResponse.json({ error: 'Launch not found' }, { status: 404 })
    }

    return NextResponse.json({ launch })
  } catch (error: unknown) {
    console.error('[Nexus Launch GET]', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(
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

    const body = await req.json()
    const { status } = body

    const allowedTransitions: Record<string, string[]> = {
      PENDING: ['CANCELLED'],
      ACTIVE: ['EXHAUSTED', 'CANCELLED'],
    }

    if (status && allowedTransitions[launch.status]?.includes(status)) {
      const updated = await prisma.nexusLaunch.update({
        where: { id: params.id },
        data: { status },
      })
      return NextResponse.json({ launch: updated })
    }

    return NextResponse.json(
      { error: `Cannot transition from ${launch.status} to ${status}` },
      { status: 400 }
    )
  } catch (error: unknown) {
    console.error('[Nexus Launch PATCH]', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
