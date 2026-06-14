import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = '1billontopview@gmail.com'

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/nexus/guardian — List reviews (admin only)
// POST /api/nexus/guardian — Auto-review a project (triggered on submit)
// PATCH /api/nexus/guardian — Manual review decision (admin only)
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')

    const where: Record<string, unknown> = {}
    if (status) where.status = status

    const reviews = await prisma.nexusGuardianReview.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        project: {
          select: { id: true, name: true, url: true, userId: true, status: true },
        },
      },
    })

    return NextResponse.json({ reviews })
  } catch (error: unknown) {
    console.error('[Nexus Guardian GET]', error)
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
    const { projectId } = body

    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 })
    }

    // Verify project ownership
    const project = await prisma.nexusProject.findFirst({
      where: { id: projectId, userId: session.user.id },
    })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Check if already reviewed
    const existing = await prisma.nexusGuardianReview.findUnique({
      where: { projectId },
    })
    if (existing) {
      return NextResponse.json({ review: existing })
    }

    // Auto-review: check blacklist for URL domain
    let fraudScore = 0
    let spamScore = 0
    const flags: string[] = []

    try {
      const domain = new URL(project.url).hostname
      const blacklisted = await prisma.nexusBlacklist.findFirst({
        where: { type: 'DOMAIN', value: domain },
      })
      if (blacklisted) {
        fraudScore = 100
        flags.push('BLACKLISTED_DOMAIN')
      }
    } catch {
      spamScore += 30
      flags.push('INVALID_URL')
    }

    // Simple heuristics
    if (project.description.length < 20) {
      spamScore += 20
      flags.push('SHORT_DESCRIPTION')
    }
    if (!project.imageUrl) {
      spamScore += 10
      flags.push('NO_IMAGE')
    }

    const overallScore = Math.min(100, fraudScore + spamScore)
    const reviewStatus = overallScore > 60 ? 'MANUAL_REVIEW' :
                         overallScore > 30 ? 'MANUAL_REVIEW' :
                         'APPROVED'

    const review = await prisma.nexusGuardianReview.create({
      data: {
        projectId,
        fraudScore,
        spamScore,
        maliciousScore: 0,
        overallScore,
        status: reviewStatus,
        flags,
        reviewer: 'auto',
        reviewedAt: reviewStatus === 'APPROVED' ? new Date() : null,
      },
    })

    // If auto-approved, update project status
    if (reviewStatus === 'APPROVED') {
      await prisma.nexusProject.update({
        where: { id: projectId },
        data: { status: 'APPROVED', approvedAt: new Date() },
      })
    } else {
      await prisma.nexusProject.update({
        where: { id: projectId },
        data: { status: 'PENDING_REVIEW' },
      })
    }

    console.log(`[Nexus Guardian] Review for ${projectId}: score=${overallScore}, status=${reviewStatus}, flags=${flags.join(',')}`)
    return NextResponse.json({ review }, { status: 201 })
  } catch (error: unknown) {
    console.error('[Nexus Guardian POST]', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const body = await req.json()
    const { reviewId, decision, notes } = body

    if (!reviewId || !decision) {
      return NextResponse.json({ error: 'reviewId and decision required' }, { status: 400 })
    }

    if (!['APPROVED', 'REJECTED'].includes(decision)) {
      return NextResponse.json({ error: 'decision must be APPROVED or REJECTED' }, { status: 400 })
    }

    const review = await prisma.nexusGuardianReview.update({
      where: { id: reviewId },
      data: {
        status: decision,
        notes: notes || null,
        reviewer: session.user.email,
        reviewedAt: new Date(),
      },
    })

    // Update project status accordingly
    await prisma.nexusProject.update({
      where: { id: review.projectId },
      data: {
        status: decision === 'APPROVED' ? 'APPROVED' : 'REJECTED',
        approvedAt: decision === 'APPROVED' ? new Date() : null,
        rejectionReason: decision === 'REJECTED' ? (notes || 'Rejected by admin') : null,
      },
    })

    console.log(`[Nexus Guardian] Manual decision for review ${reviewId}: ${decision}`)
    return NextResponse.json({ review })
  } catch (error: unknown) {
    console.error('[Nexus Guardian PATCH]', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
