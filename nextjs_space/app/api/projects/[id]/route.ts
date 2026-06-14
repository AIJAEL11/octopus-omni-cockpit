import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET - Obtener un proyecto específico
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const project = await prisma.project.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
      include: {
        files: true,
        agentLogs: {
          orderBy: { createdAt: 'desc' },
        },
        creativeAssets: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            content: true,
            thumbnail: true,
            type: true,
            prompt: true,
            createdAt: true,
          },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ project })
  } catch (error) {
    console.error('Error fetching project:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// PATCH - Actualizar progreso del proyecto
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { progress, status, agentLog, file, name, description } = body

    // Verificar que el proyecto pertenece al usuario
    const existing = await prisma.project.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
    }

    // Actualizar proyecto
    const project = await prisma.project.update({
      where: { id: params.id },
      data: {
        ...(progress !== undefined && { progress }),
        ...(status && { status }),
        ...(name && { name }),
        ...(description !== undefined && { description }),
      },
    })

    // Agregar log de agente si existe
    if (agentLog) {
      await prisma.agentLog.create({
        data: {
          projectId: params.id,
          agentName: agentLog.agentName,
          agentType: agentLog.agentType,
          message: agentLog.message,
          status: agentLog.status || 'completed',
        },
      })
    }

    // Agregar archivo si existe
    if (file) {
      await prisma.projectFile.create({
        data: {
          projectId: params.id,
          name: file.name,
          path: file.path,
          content: file.content,
          fileType: file.fileType,
          agentId: file.agentId,
        },
      })
    }

    return NextResponse.json({ success: true, project })
  } catch (error) {
    console.error('Error updating project:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE - Eliminar proyecto
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    await prisma.project.deleteMany({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting project:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
