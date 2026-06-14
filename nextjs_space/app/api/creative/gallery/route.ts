import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET - Obtener galería de assets
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'image' | 'video' | 'copy' | null (all)
    const projectId = searchParams.get('projectId') // Filtrar por proyecto
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: Record<string, unknown> = { userId: session.user.id }
    if (type) where.type = type
    if (projectId === 'none') {
      where.projectId = null // Assets sin proyecto
    } else if (projectId) {
      where.projectId = projectId
    }

    const [assets, total] = await Promise.all([
      prisma.creativeAsset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          type: true,
          title: true,
          content: true,
          thumbnail: true,
          platform: true,
          format: true,
          status: true,
          tags: true,
          createdAt: true,
          prompt: true,
          projectId: true,
          project: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.creativeAsset.count({ where }),
    ])

    // Estadísticas rápidas
    const stats = await prisma.creativeAsset.groupBy({
      by: ['type'],
      where: { userId: session.user.id },
      _count: { id: true },
    })

    const statMap: Record<string, number> = {}
    stats.forEach(s => { statMap[s.type] = s._count.id })

    // Resumen por proyectos (para la vista de carpetas)
    const projectStats = await prisma.creativeAsset.groupBy({
      by: ['projectId'],
      where: { userId: session.user.id },
      _count: { id: true },
    })

    // Obtener nombres de proyectos
    const projectIds = projectStats
      .map(p => p.projectId)
      .filter((id): id is string => id !== null)

    const projects = projectIds.length > 0
      ? await prisma.project.findMany({
          where: { id: { in: projectIds } },
          select: { id: true, name: true },
        })
      : []

    const projectMap = new Map(projects.map(p => [p.id, p.name]))

    const projectFolders = projectStats.map(p => ({
      projectId: p.projectId,
      projectName: p.projectId ? (projectMap.get(p.projectId) || 'Proyecto') : null,
      count: p._count.id,
    }))

    return NextResponse.json({
      assets,
      total,
      stats: {
        images: statMap['image'] || 0,
        videos: statMap['video'] || 0,
        copies: statMap['copy'] || 0,
        total,
      },
      projectFolders,
    })

  } catch (error) {
    console.error('Gallery fetch error:', error)
    return NextResponse.json({ error: 'Error al cargar galería' }, { status: 500 })
  }
}

// DELETE - Eliminar asset
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    // Verificar que el asset pertenece al usuario
    const asset = await prisma.creativeAsset.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!asset) {
      return NextResponse.json({ error: 'Asset no encontrado' }, { status: 404 })
    }

    await prisma.creativeAsset.delete({ where: { id } })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Gallery delete error:', error)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}
