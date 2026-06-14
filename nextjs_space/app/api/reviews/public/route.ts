export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/reviews/public — public testimonials for landing page (no auth required)
export async function GET() {
  try {
    const reviews = await prisma.review.findMany({
      where: {
        isPublic: true,
        rating: { gte: 4 },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        User: {
          select: { name: true, image: true, planId: true },
        },
      },
    })

    // Anonymize: only show first name + initial
    const safeReviews = reviews.map(r => {
      const fullName = r.User?.name || 'Octopus User'
      const parts = fullName.split(' ')
      const displayName = parts.length > 1
        ? `${parts[0]} ${parts[1][0]}.`
        : parts[0]
      return {
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        featureUsed: r.featureUsed,
        feedbackType: r.feedbackType,
        displayName,
        avatar: r.User?.image || null,
        plan: r.User?.planId || 'starter',
        createdAt: r.createdAt,
      }
    })

    // Aggregate stats
    const allReviews = await prisma.review.aggregate({
      _avg: { rating: true },
      _count: true,
    })

    return NextResponse.json({
      reviews: safeReviews,
      aggregate: {
        avgRating: Math.round((allReviews._avg.rating || 0) * 10) / 10,
        totalReviews: allReviews._count,
      },
    })
  } catch (error) {
    console.error('[Reviews Public] GET error:', error)
    return NextResponse.json({ reviews: [], aggregate: { avgRating: 0, totalReviews: 0 } })
  }
}
