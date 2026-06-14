export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET — Get booking config (auth) or public config (by slug)
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const slug = url.searchParams.get('slug')

    if (slug) {
      // Public: get booking config by slug
      const config = await prisma.bookingConfig.findUnique({
        where: { slug },
        include: { user: { select: { name: true, image: true, email: true } } },
      })
      if (!config || !config.enabled) return NextResponse.json({ error: 'Booking no encontrado' }, { status: 404 })
      // Convert availableDays string to array for frontend
      return NextResponse.json({
        ...config,
        availableDays: config.availableDays.split(',').map(Number)
      })
    }

    // Auth: get own booking config
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const config = await prisma.bookingConfig.findUnique({ where: { userId: user.id } })
    if (config) {
      // Convert availableDays string to array for frontend
      return NextResponse.json({
        ...config,
        availableDays: config.availableDays.split(',').map(Number)
      })
    }
    return NextResponse.json({ exists: false })
  } catch (error) {
    console.error('Booking GET error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST — Create/update booking config (auth) or Book a slot (public)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Public booking request
    if (body.bookSlot) {
      const { slug, date, time, name, email, phone, notes } = body
      if (!slug || !date || !time || !name || !email) {
        return NextResponse.json({ error: 'Campos requeridos: slug, date, time, name, email' }, { status: 400 })
      }

      const config = await prisma.bookingConfig.findUnique({
        where: { slug },
        include: { user: true },
      })
      if (!config || !config.enabled) return NextResponse.json({ error: 'Booking no disponible' }, { status: 404 })

      // Parse date+time
      const startTime = new Date(`${date}T${time}:00`)
      const endTime = new Date(startTime.getTime() + config.duration * 60000)

      // Check for conflicts
      const conflict = await prisma.calendarEvent.findFirst({
        where: {
          userId: config.userId,
          status: { not: 'cancelled' },
          OR: [
            { AND: [{ startTime: { lte: startTime } }, { endTime: { gt: startTime } }] },
            { AND: [{ startTime: { lt: endTime } }, { endTime: { gte: endTime } }] },
            { AND: [{ startTime: { gte: startTime } }, { endTime: { lte: endTime } }] },
          ],
        },
      })

      if (conflict) {
        return NextResponse.json({ error: 'Horario no disponible' }, { status: 409 })
      }

      const event = await prisma.calendarEvent.create({
        data: {
          userId: config.userId,
          title: `📅 Reunión con ${name}`,
          description: notes || null,
          startTime,
          endTime,
          type: 'booking',
          color: config.brandColor,
          isBooking: true,
          leadName: name,
          leadEmail: email,
          bookingNotes: `Tel: ${phone || 'N/A'}\n${notes || ''}`,
          status: 'confirmed',
        },
      })

      return NextResponse.json({ event, message: 'Reunión agendada exitosamente' }, { status: 201 })
    }

    // Auth: create/update booking config
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const { title, description, duration, bufferTime, availableDays, startHour, endHour, timezone, brandColor, enabled } = body

    // Generate slug from user name or email
    const baseSlug = (user.name || user.email.split('@')[0]).toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')

    // Convert availableDays array to string for DB storage
    const availableDaysStr = Array.isArray(availableDays) ? availableDays.join(',') : availableDays

    const config = await prisma.bookingConfig.upsert({
      where: { userId: user.id },
      update: {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(duration !== undefined ? { duration } : {}),
        ...(bufferTime !== undefined ? { bufferTime } : {}),
        ...(availableDaysStr !== undefined ? { availableDays: availableDaysStr } : {}),
        ...(startHour !== undefined ? { startHour } : {}),
        ...(endHour !== undefined ? { endHour } : {}),
        ...(timezone !== undefined ? { timezone } : {}),
        ...(brandColor !== undefined ? { brandColor } : {}),
        ...(enabled !== undefined ? { enabled } : {}),
      },
      create: {
        userId: user.id,
        slug: baseSlug,
        title: title || 'Agenda una Reunión',
        description: description || null,
        duration: duration || 30,
        bufferTime: bufferTime || 15,
        availableDays: availableDaysStr || '1,2,3,4,5',
        startHour: startHour ?? 9,
        endHour: endHour ?? 17,
        timezone: timezone || 'America/New_York',
        brandColor: brandColor || '#C4622D',
      },
    })

    // Return with availableDays as array for frontend consistency
    return NextResponse.json({
      ...config,
      availableDays: config.availableDays.split(',').map(Number)
    })
  } catch (error) {
    console.error('Booking POST error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
