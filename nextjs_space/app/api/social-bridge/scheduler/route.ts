export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/social-bridge/scheduler
 * Checks for due scheduled posts and dispatches them.
 * Called by SchedulerMonitor every 30s.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ dispatched: 0 })
    }

    const now = new Date()

    // Find posts that are scheduled and due
    const duePosts = await prisma.socialPost.findMany({
      where: {
        userId: session.user.id,
        status: { in: ['queued', 'pending'] },
        scheduledFor: { lte: now },
      },
      orderBy: { scheduledFor: 'asc' },
      take: 10,
    })

    if (duePosts.length === 0) {
      return NextResponse.json({ dispatched: 0, checked: now.toISOString() })
    }

    let dispatched = 0

    for (const post of duePosts) {
      try {
        // Mark as publishing
        await prisma.socialPost.update({
          where: { id: post.id },
          data: { status: 'publishing' },
        })

        // Try to publish via the publish endpoint
        const publishRes = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/social-bridge/publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            postId: post.id,
            platform: post.platform,
            content: post.content,
            mediaUrl: post.mediaUrl,
            mediaType: post.mediaType,
          }),
        })

        if (publishRes.ok) {
          dispatched++
        } else {
          // Mark as failed if publish didn't work
          await prisma.socialPost.update({
            where: { id: post.id },
            data: {
              status: 'failed',
              errorMessage: `Scheduler dispatch failed: HTTP ${publishRes.status}`,
              retryCount: { increment: 1 },
            },
          })
        }
      } catch (postErr: any) {
        await prisma.socialPost.update({
          where: { id: post.id },
          data: {
            status: 'failed',
            errorMessage: `Scheduler error: ${postErr.message}`,
            retryCount: { increment: 1 },
          },
        }).catch(() => {})
      }
    }

    return NextResponse.json({ dispatched, total: duePosts.length, checked: now.toISOString() })
  } catch (error: any) {
    console.error('[Scheduler] Error:', error.message)
    return NextResponse.json({ dispatched: 0, error: error.message }, { status: 500 })
  }
}

/**
 * POST /api/social-bridge/scheduler
 * Returns list of scheduled posts for the user.
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ scheduled: [] })
    }

    const scheduled = await prisma.socialPost.findMany({
      where: {
        userId: session.user.id,
        status: { in: ['queued', 'pending'] },
        scheduledFor: { not: null },
      },
      orderBy: { scheduledFor: 'asc' },
      select: {
        id: true,
        platform: true,
        content: true,
        mediaUrl: true,
        mediaType: true,
        status: true,
        scheduledFor: true,
        source: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ scheduled })
  } catch (error: any) {
    console.error('[Scheduler] POST Error:', error.message)
    return NextResponse.json({ scheduled: [], error: error.message }, { status: 500 })
  }
}
