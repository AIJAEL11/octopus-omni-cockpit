import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET - Obtener todos los proyectos del usuario
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const projects = await prisma.project.findMany({
      where: { userId: session.user.id },
      include: {
        files: true,
        agentLogs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: { creativeAssets: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json({ projects })
  } catch (error) {
    console.error('Error fetching projects:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST - Crear un nuevo proyecto
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, projectType } = body

    if (!name) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
    }

    const project = await prisma.project.create({
      data: {
        userId: session.user.id,
        name,
        description: description || '',
        projectType: projectType || 'general',
        status: body.status || 'active',
        progress: 0,
      },
    })

    return NextResponse.json({ success: true, project })
  } catch (error) {
    console.error('Error creating project:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
