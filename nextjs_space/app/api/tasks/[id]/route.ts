export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PATCH /api/tasks/[id] — update a task
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const existing = await prisma.taskItem.findFirst({
      where: { id: params.id, userId: session.user.id },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json()
    const data: Record<string, unknown> = {}

    if (body.title !== undefined) data.title = body.title.trim()
    if (body.description !== undefined) data.description = body.description?.trim() || null
    if (body.priority !== undefined) data.priority = body.priority
    if (body.status !== undefined) {
      data.status = body.status
      if (body.status === 'completed' && existing.status !== 'completed') {
        data.completedAt = new Date()
      } else if (body.status !== 'completed') {
        data.completedAt = null
      }
    }
    if (body.category !== undefined) data.category = body.category
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null

    const task = await prisma.taskItem.update({
      where: { id: params.id },
      data,
    })

    return NextResponse.json({ task })
  } catch (err: any) {
    console.error('[PATCH /api/tasks]', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}

// DELETE /api/tasks/[id] — delete a task
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const existing = await prisma.taskItem.findFirst({
      where: { id: params.id, userId: session.user.id },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.taskItem.delete({ where: { id: params.id } })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[DELETE /api/tasks]', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
