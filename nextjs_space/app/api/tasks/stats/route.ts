export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/tasks/stats — get task statistics
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = session.user.id
    const now = new Date()

    const [total, pending, inProgress, completed, overdue] = await Promise.all([
      prisma.taskItem.count({ where: { userId } }),
      prisma.taskItem.count({ where: { userId, status: 'pending' } }),
      prisma.taskItem.count({ where: { userId, status: 'in_progress' } }),
      prisma.taskItem.count({ where: { userId, status: 'completed' } }),
      prisma.taskItem.count({
        where: {
          userId,
          status: { not: 'completed' },
          dueDate: { lt: now },
        },
      }),
    ])

    return NextResponse.json({ total, pending, inProgress, completed, overdue })
  } catch (err: any) {
    console.error('[GET /api/tasks/stats]', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
