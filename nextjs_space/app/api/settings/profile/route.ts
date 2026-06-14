import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET - Obtener perfil del usuario
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, email: true, image: true, password: true, businessEmail: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      hasPassword: !!user.password,
      businessEmail: user.businessEmail || '',
    })
  } catch (error) {
    console.error('Error obteniendo perfil:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

// PATCH - Actualizar nombre e imagen del usuario
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const { name, image, businessEmail } = body

    const updateData: Record<string, string | null> = {}
    if (typeof name === 'string' && name.trim()) {
      updateData.name = name.trim()
    }
    if (typeof image === 'string') {
      updateData.image = image
    }
    if (typeof businessEmail === 'string') {
      updateData.businessEmail = businessEmail.trim() || null
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No hay datos para actualizar' }, { status: 400 })
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: { id: true, name: true, email: true, image: true },
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error('Error actualizando perfil:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
