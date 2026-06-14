import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const ADMIN_EMAILS = ['1billontopview@gmail.com']

function isAdmin(email?: string | null) {
  return email ? ADMIN_EMAILS.includes(email) : false
}

// GET /api/nexus/admin — Global admin stats + all projects
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const view = searchParams.get('view') || 'overview'

    if (view === 'overview') {
      const [totalProjects, activeProjects, pendingReview, totalLaunches, totalRevenue, totalEvents] = await Promise.all([
        prisma.nexusProject.count(),
        prisma.nexusProject.count({ where: { status: 'ACTIVE' } }),
        prisma.nexusProject.count({ where: { status: 'PENDING_REVIEW' } }),
        prisma.nexusLaunch.count(),
        prisma.nexusLaunch.aggregate({ _sum: { amountPaid: true } }),
        prisma.nexusEvent.count()
      ])

      return NextResponse.json({
        totalProjects,
        activeProjects,
        pendingReview,
        totalLaunches,
        totalRevenue: totalRevenue._sum.amountPaid || 0,
        totalEvents
      })
    }

    if (view === 'projects') {
      const projects = await prisma.nexusProject.findMany({
        include: {
          user: { select: { email: true, name: true } },
          launches: { orderBy: { createdAt: 'desc' }, take: 1, select: { impressions: true, clicks: true, status: true } },
          guardianReview: { select: { status: true, overallScore: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 100
      })
      return NextResponse.json({ projects })
    }

    return NextResponse.json({ error: 'Invalid view' }, { status: 400 })
  } catch (error: unknown) {
    console.error('[Nexus Admin GET]', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// PATCH /api/nexus/admin — Admin actions (approve/reject/activate/pause)
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { projectId, action } = await req.json()
    if (!projectId || !action) {
      return NextResponse.json({ error: 'projectId and action required' }, { status: 400 })
    }

    const validActions = ['approve', 'reject', 'activate', 'pause', 'delete']
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    if (action === 'delete') {
      await prisma.nexusProject.delete({ where: { id: projectId } })
      return NextResponse.json({ ok: true, action: 'deleted' })
    }

    const statusMap: Record<string, string> = {
      approve: 'ACTIVE',
      reject: 'REJECTED',
      activate: 'ACTIVE',
      pause: 'PAUSED'
    }

    const project = await prisma.nexusProject.update({
      where: { id: projectId },
      data: { status: statusMap[action] as any }
    })

    // If activating, also activate the latest launch
    if (action === 'approve' || action === 'activate') {
      const latestLaunch = await prisma.nexusLaunch.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'desc' }
      })
      if (latestLaunch) {
        await prisma.nexusLaunch.update({
          where: { id: latestLaunch.id },
          data: { status: 'ACTIVE', activatedAt: new Date() }
        })
      }
    }

    return NextResponse.json({ ok: true, action, status: project.status })
  } catch (error: unknown) {
    console.error('[Nexus Admin PATCH]', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
