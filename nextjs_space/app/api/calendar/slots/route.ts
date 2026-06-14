export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET — Get available slots for a booking page (public)
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const slug = url.searchParams.get('slug')
    const date = url.searchParams.get('date')

    if (!slug || !date) {
      return NextResponse.json({ error: 'slug y date requeridos' }, { status: 400 })
    }

    const config = await prisma.bookingConfig.findUnique({ where: { slug } })
    if (!config || !config.enabled) return NextResponse.json({ error: 'Booking no disponible' }, { status: 404 })

    // Check if this day is available
    const dayOfWeek = new Date(date + 'T12:00:00').getDay()
    const availableDays = config.availableDays.split(',').map(Number)
    if (!availableDays.includes(dayOfWeek)) {
      return NextResponse.json({ slots: [], message: 'Día no disponible' })
    }

    // Generate time slots
    const slots: string[] = []
    for (let h = config.startHour; h < config.endHour; h++) {
      for (let m = 0; m < 60; m += config.duration + config.bufferTime) {
        const hour = h.toString().padStart(2, '0')
        const min = m.toString().padStart(2, '0')
        slots.push(`${hour}:${min}`)
      }
    }

    // Get existing events for that day
    const dayStart = new Date(date + 'T00:00:00')
    const dayEnd = new Date(date + 'T23:59:59')

    const existingEvents = await prisma.calendarEvent.findMany({
      where: {
        userId: config.userId,
        status: { not: 'cancelled' },
        startTime: { gte: dayStart },
        endTime: { lte: dayEnd },
      },
      select: { startTime: true, endTime: true },
    })

    // Filter out conflicting slots
    const available = slots.filter(slot => {
      const [hh, mm] = slot.split(':').map(Number)
      const slotStart = new Date(date + `T${slot}:00`)
      const slotEnd = new Date(slotStart.getTime() + config.duration * 60000)

      return !existingEvents.some(ev => {
        return (slotStart < ev.endTime && slotEnd > ev.startTime)
      })
    })

    return NextResponse.json({ slots: available, duration: config.duration })
  } catch (error) {
    console.error('Slots GET error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
