import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPlanGate } from '@/lib/plan-gate'

export const dynamic = 'force-dynamic'

// GET — List all smart devices for the user
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const devices = await prisma.smartDevice.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ devices })
  } catch (error) {
    console.error('Error fetching devices:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST — Add a new smart device
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json()
    const { name, type, platform, externalId, shellyId, ipAddress, macAddress, room, icon, mode } = body

    if (!name) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

    // Plan gate — check IoT device limit
    const gate = await checkPlanGate(session.user.id, 'iot')
    if (!gate.allowed) {
      return NextResponse.json({
        error: 'plan_limit',
        message: `Límite de dispositivos IoT alcanzado (${gate.current}/${gate.limit})`,
        gate,
      }, { status: 403 })
    }

    const device = await prisma.smartDevice.create({
      data: {
        userId: session.user.id,
        name,
        type: type || 'light',
        platform: platform || 'wiz',
        externalId: externalId || null,
        shellyId: shellyId || null,
        ipAddress: ipAddress || null,
        macAddress: macAddress || null,
        room: room || null,
        icon: icon || 'lightbulb',
        mode: mode || 'cloud',
        isOnline: true,
        brightness: 100,
        colorTemp: 4000,
        lastState: { on: false, brightness: 100, colorTemp: 4000 },
      },
    })

    return NextResponse.json({ device })
  } catch (error) {
    console.error('Error creating device:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// PUT — Update a device
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json()
    const { id, name, type, room, icon } = body

    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

    const device = await prisma.smartDevice.updateMany({
      where: { id, userId: session.user.id },
      data: {
        ...(name && { name }),
        ...(type && { type }),
        ...(room !== undefined && { room: room || null }),
        ...(icon && { icon }),
      },
    })

    return NextResponse.json({ success: true, device })
  } catch (error) {
    console.error('Error updating device:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE — Remove a device
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

    await prisma.smartDevice.deleteMany({
      where: { id, userId: session.user.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting device:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
