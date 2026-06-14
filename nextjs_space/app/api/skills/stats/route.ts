// ═══════════════════════════════════════════════════════════════════════════════
// 📊 SKILL STATS API — Phase B: Skill Memory analytics
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, withDbRetry } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const userId = session.user.id
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // Get all executions for this user
    const allExecs: any[] = await withDbRetry(() =>
      prisma.skillExecution.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 500,
      })
    )

    // Aggregate per skill
    const skillIds = ['image-skill', 'game-skill', 'code-refiner', 'wildverse-seo', 'content-publisher']
    const stats: Record<string, {
      total: number
      success: number
      failed: number
      successRate: number
      avgDuration: number
      last7Days: number[]
      lastUsed: string | null
      topCategories: Record<string, number>
      recentExecutions: Array<{
        id: string
        method: string
        success: boolean
        duration: number
        category: string | null
        trigger: string
        createdAt: string
      }>
    }> = {}

    for (const skillId of skillIds) {
      const execs = allExecs.filter(e => e.skillId === skillId)
      const succeeded = execs.filter(e => e.success)
      const failed = execs.filter(e => !e.success)

      // Last 7 days histogram (one bucket per day)
      const last7Days: number[] = []
      for (let d = 6; d >= 0; d--) {
        const dayStart = new Date(now.getTime() - d * 24 * 60 * 60 * 1000)
        dayStart.setHours(0, 0, 0, 0)
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
        last7Days.push(
          execs.filter(e => e.createdAt >= dayStart && e.createdAt < dayEnd).length
        )
      }

      // Top categories
      const topCategories: Record<string, number> = {}
      execs.forEach(e => {
        if (e.category) {
          topCategories[e.category] = (topCategories[e.category] || 0) + 1
        }
      })

      const totalDuration = execs.reduce((sum, e) => sum + e.duration, 0)

      stats[skillId] = {
        total: execs.length,
        success: succeeded.length,
        failed: failed.length,
        successRate: execs.length > 0 ? Math.round((succeeded.length / execs.length) * 100) : 0,
        avgDuration: execs.length > 0 ? Math.round(totalDuration / execs.length) : 0,
        last7Days,
        lastUsed: execs.length > 0 ? execs[0].createdAt.toISOString() : null,
        topCategories,
        recentExecutions: execs.slice(0, 5).map(e => ({
          id: e.id,
          method: e.method,
          success: e.success,
          duration: e.duration,
          category: e.category,
          trigger: e.trigger,
          createdAt: e.createdAt.toISOString(),
        })),
      }
    }

    // Global totals
    const globalTotal = allExecs.length
    const globalSuccess = allExecs.filter(e => e.success).length
    const recentWeek = allExecs.filter(e => e.createdAt >= sevenDaysAgo).length

    return NextResponse.json({
      skills: stats,
      global: {
        total: globalTotal,
        success: globalSuccess,
        successRate: globalTotal > 0 ? Math.round((globalSuccess / globalTotal) * 100) : 0,
        thisWeek: recentWeek,
      },
    })
  } catch (err) {
    console.error('[SkillStats] Error:', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
