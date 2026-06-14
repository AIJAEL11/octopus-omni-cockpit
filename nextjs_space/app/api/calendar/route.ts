export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET — list events for date range
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const url = new URL(req.url)
    const start = url.searchParams.get('start')
    const end = url.searchParams.get('end')

    const where: any = { userId: user.id }
    if (start) where.startTime = { gte: new Date(start) }
    if (end) where.endTime = { ...(where.endTime || {}), lte: new Date(end) }
    if (start && end) {
      where.startTime = { gte: new Date(start) }
      where.endTime = { lte: new Date(end) }
      // Actually we want events that overlap the range
      delete where.startTime
      delete where.endTime
      where.OR = [
        { startTime: { gte: new Date(start), lte: new Date(end) } },
        { endTime: { gte: new Date(start), lte: new Date(end) } },
        { AND: [{ startTime: { lte: new Date(start) } }, { endTime: { gte: new Date(end) } }] },
      ]
    }

    const events = await prisma.calendarEvent.findMany({
      where,
      orderBy: { startTime: 'asc' },
      take: 500,
    })

    return NextResponse.json({ events })
  } catch (error) {
    console.error('Calendar GET error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST — create event
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const body = await req.json()
    const { title, description, startTime, endTime, allDay, location, color, type, leadId, leadName, leadEmail, reminder } = body

    if (!title || !startTime || !endTime) {
      return NextResponse.json({ error: 'title, startTime y endTime son requeridos' }, { status: 400 })
    }

    const event = await prisma.calendarEvent.create({
      data: {
        userId: user.id,
        title,
        description: description || null,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        allDay: allDay || false,
        location: location || null,
        color: color || '#C4622D',
        type: type || 'meeting',
        leadId: leadId || null,
        leadName: leadName || null,
        leadEmail: leadEmail || null,
        reminder: reminder || null,
      },
    })

    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    console.error('Calendar POST error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// PATCH — update event
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const body = await req.json()
    const { id, ...data } = body
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    const existing = await prisma.calendarEvent.findFirst({ where: { id, userId: user.id } })
    if (!existing) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })

    const updateData: any = {}
    if (data.title !== undefined) updateData.title = data.title
    if (data.description !== undefined) updateData.description = data.description
    if (data.startTime) updateData.startTime = new Date(data.startTime)
    if (data.endTime) updateData.endTime = new Date(data.endTime)
    if (data.location !== undefined) updateData.location = data.location
    if (data.color) updateData.color = data.color
    if (data.type) updateData.type = data.type
    if (data.status) updateData.status = data.status

    const updated = await prisma.calendarEvent.update({ where: { id }, data: updateData })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Calendar PATCH error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE — remove event
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    const existing = await prisma.calendarEvent.findFirst({ where: { id, userId: user.id } })
    if (!existing) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })

    await prisma.calendarEvent.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Calendar DELETE error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
