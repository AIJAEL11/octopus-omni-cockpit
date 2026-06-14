import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET — List scenes
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const scenes = await prisma.smartScene.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ scenes })
  } catch (error) {
    console.error('Error fetching scenes:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST — Create a scene
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json()
    const { name, icon, commands, voiceTrigger } = body

    if (!name || !commands) return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })

    const scene = await prisma.smartScene.create({
      data: {
        userId: session.user.id,
        name,
        icon: icon || 'play',
        commands,
        voiceTrigger: voiceTrigger || null,
      },
    })

    return NextResponse.json({ scene })
  } catch (error) {
    console.error('Error creating scene:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE — Remove a scene
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

    await prisma.smartScene.deleteMany({
      where: { id, userId: session.user.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting scene:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
