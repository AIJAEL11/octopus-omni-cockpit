export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/tasks — list tasks with optional filters
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const priority = url.searchParams.get('priority')
    const category = url.searchParams.get('category')
    const search = url.searchParams.get('search')

    const where: Record<string, unknown> = { userId: session.user.id }
    if (status) where.status = status
    if (priority) where.priority = priority
    if (category) where.category = category
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    const tasks = await prisma.taskItem.findMany({
      where: where as any,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json({ tasks })
  } catch (err: any) {
    console.error('[GET /api/tasks]', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}

// POST /api/tasks — create a new task
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { title, description, priority, category, dueDate } = body

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const task = await prisma.taskItem.create({
      data: {
        userId: session.user.id,
        title: title.trim(),
        description: description?.trim() || null,
        priority: priority || 'medium',
        category: category || 'general',
        dueDate: dueDate ? new Date(dueDate) : null,
      },
    })

    return NextResponse.json({ task }, { status: 201 })
  } catch (err: any) {
    console.error('[POST /api/tasks]', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
