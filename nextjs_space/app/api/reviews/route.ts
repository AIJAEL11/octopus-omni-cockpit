export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/reviews — submit feedback
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { rating, comment, featureUsed, feedbackType, isPublic } = body

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 })
    }

    // Sentiment score based on rating + comment length
    let sentimentScore = (rating - 3) / 2 // maps 1-5 to -1.0 to 1.0
    if (comment && comment.length > 20) {
      sentimentScore = Math.min(1, sentimentScore + 0.1)
    }

    // Auto-priority: negative results feedback = HIGH PRIORITY
    let priority = 'normal'
    if (feedbackType === 'results' && rating <= 2) {
      priority = 'critical'
    } else if (rating <= 2) {
      priority = 'high'
    }

    const review = await prisma.review.create({
      data: {
        userId: session.user.id,
        rating: Math.round(rating),
        comment: comment?.slice(0, 2000) || null,
        featureUsed: featureUsed || null,
        feedbackType: feedbackType || null,
        isPublic: isPublic ?? (rating >= 4),
        sentimentScore,
        priority,
        promoStatus: Math.round(rating) >= 4 ? 'pending' : null,
      },
    })

    // 🐙 Self-Promotion Engine: Auto-generate promo for positive reviews (4-5 stars)
    if (Math.round(rating) >= 4) {
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
      fetch(`${baseUrl}/api/reviews/promo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': req.headers.get('cookie') || '' },
        body: JSON.stringify({ reviewId: review.id }),
      }).catch(err => console.error('[SelfPromo] Auto-trigger error:', err))
    }

    return NextResponse.json({ success: true, review })
  } catch (error) {
    console.error('[Reviews] POST error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// GET /api/reviews — get all reviews (admin) or user's own
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const isAdmin = searchParams.get('admin') === 'true'

    // Check if user is admin
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { email: true } })
    const adminEmails = ['1billontopview@gmail.com']

    if (isAdmin && adminEmails.includes(user?.email || '')) {
      // Admin: get all reviews
      const reviews = await prisma.review.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          User: { select: { id: true, name: true, email: true, image: true, planId: true } },
        },
        // Include all fields including promo fields (promoStatus, promoImageUrl, promoCopy, promoVideoUrl, promoVoiceUrl)
      })

      const stats = {
        total: reviews.length,
        avgRating: reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0,
        distribution: [1, 2, 3, 4, 5].map(n => ({
          stars: n,
          count: reviews.filter(r => r.rating === n).length,
        })),
        publicCount: reviews.filter(r => r.isPublic).length,
        avgSentiment: reviews.length
          ? reviews.reduce((s, r) => s + (r.sentimentScore || 0), 0) / reviews.length
          : 0,
      }

      return NextResponse.json({ reviews, stats })
    }

    // Regular user: get own reviews
    const reviews = await prisma.review.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ reviews })
  } catch (error) {
    console.error('[Reviews] GET error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// PATCH /api/reviews — admin reply or toggle public
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { email: true } })
    const adminEmails = ['1billontopview@gmail.com']
    if (!adminEmails.includes(user?.email || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { reviewId, adminReply, isPublic, priority } = body

    if (!reviewId) return NextResponse.json({ error: 'reviewId required' }, { status: 400 })

    const data: Record<string, unknown> = {}
    if (adminReply !== undefined) {
      data.adminReply = adminReply
      data.adminRepliedAt = new Date()
    }
    if (isPublic !== undefined) data.isPublic = isPublic
    if (priority !== undefined) data.priority = priority

    const review = await prisma.review.update({
      where: { id: reviewId },
      data,
    })

    return NextResponse.json({ success: true, review })
  } catch (error) {
    console.error('[Reviews] PATCH error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
