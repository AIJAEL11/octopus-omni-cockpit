import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, withDbRetry } from '@/lib/prisma'
import { sanitizeCanvasPath, type CanvasFile } from '@/lib/octopus-canvas'

export const dynamic = 'force-dynamic'

/**
 * POST /api/canvas — Crear o actualizar un proyecto Canvas
 * Body: { projectId?, title?, files: [{path, content}] }
 *
 * Reutiliza Project + ProjectFile (projectType: 'canvas').
 * Los archivos enviados se fusionan con los existentes (upsert por path):
 * el modelo re-emite solo los archivos que cambian al iterar.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const userId = session.user.id

    const body = await request.json()
    const { projectId, title } = body as { projectId?: string; title?: string }
    const rawFiles = (body.files || []) as CanvasFile[]

    const files: CanvasFile[] = []
    for (const f of rawFiles) {
      const path = sanitizeCanvasPath(f.path || '')
      if (path && typeof f.content === 'string' && f.content.length > 0 && f.content.length < 500_000) {
        files.push({ path, content: f.content })
      }
    }
    if (files.length === 0 && !projectId) {
      return NextResponse.json({ error: 'Sin archivos válidos' }, { status: 400 })
    }

    let project = projectId
      ? await withDbRetry(() => prisma.project.findFirst({
          where: { id: projectId, userId, projectType: 'canvas' },
          include: { files: { select: { id: true, path: true } } },
        }))
      : null

    if (!project) {
      const created = await withDbRetry(() => prisma.project.create({
        data: {
          userId,
          name: (title || 'Proyecto Canvas').slice(0, 120),
          description: 'Construido en el Canvas de OCTOPUS',
          projectType: 'canvas',
          status: 'completed',
          progress: 100,
        },
      }))
      project = { ...created, files: [] }
    } else if (title && title !== project.name) {
      await withDbRetry(() => prisma.project.update({
        where: { id: project!.id },
        data: { name: title.slice(0, 120) },
      }))
    }

    // Upsert por path (fusión: iterar re-emite solo archivos cambiados)
    const existingByPath = new Map(project.files.map(f => [f.path, f.id]))
    for (const f of files) {
      const existingId = existingByPath.get(f.path)
      const fileType = f.path.split('.').pop() || 'txt'
      if (existingId) {
        await withDbRetry(() => prisma.projectFile.update({
          where: { id: existingId },
          data: { content: f.content, fileType },
        }))
      } else {
        await withDbRetry(() => prisma.projectFile.create({
          data: {
            projectId: project!.id,
            name: f.path.split('/').pop() || f.path,
            path: f.path,
            content: f.content,
            fileType,
          },
        }))
      }
    }

    const allFiles = await withDbRetry(() => prisma.projectFile.findMany({
      where: { projectId: project!.id },
      select: { path: true, content: true },
      orderBy: { path: 'asc' },
    }))

    // Verificación de integridad: referencias relativas (src/href) sin archivo
    const paths = new Set(allFiles.map(f => f.path))
    const missingAssets: string[] = []
    for (const f of allFiles) {
      if (!/\.html?$/i.test(f.path) || !f.content) continue
      // Con comillas o sin ellas (href=./x.css también es HTML válido)
      const refs = f.content.match(/(?:src|href)\s*=\s*(?:"[^"]+"|'[^']+'|[^\s>"']+)/gi) || []
      for (const r of refs) {
        const url = r.replace(/^(?:src|href)\s*=\s*/i, '').replace(/^["']|["']$/g, '')
        if (/^(https?:|\/\/|#|data:|mailto:|tel:|javascript:)/i.test(url)) continue
        const clean = url.replace(/^\.?\//, '').split(/[?#]/)[0]
        if (clean && !paths.has(clean) && !missingAssets.includes(clean)) {
          missingAssets.push(clean)
        }
      }
    }

    return NextResponse.json({
      projectId: project.id,
      title: title || project.name,
      files: allFiles,
      missingAssets,
    })
  } catch (error) {
    console.error('Canvas POST error:', error)
    return NextResponse.json({ error: 'Error guardando el proyecto' }, { status: 500 })
  }
}

/**
 * DELETE /api/canvas?projectId=... — Eliminar un proyecto Canvas
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const projectId = new URL(request.url).searchParams.get('projectId')
    if (!projectId) return NextResponse.json({ error: 'projectId requerido' }, { status: 400 })

    const project = await withDbRetry(() => prisma.project.findFirst({
      where: { id: projectId, userId: session.user.id, projectType: 'canvas' },
      select: { id: true },
    }))
    if (!project) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    await withDbRetry(() => prisma.projectFile.deleteMany({ where: { projectId } }))
    await withDbRetry(() => prisma.project.delete({ where: { id: projectId } }))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Canvas DELETE error:', error)
    return NextResponse.json({ error: 'Error eliminando el proyecto' }, { status: 500 })
  }
}

/**
 * GET /api/canvas?projectId=... — Cargar un proyecto Canvas
 * GET /api/canvas — Listar proyectos Canvas del usuario
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (projectId) {
      const project = await withDbRetry(() => prisma.project.findFirst({
        where: { id: projectId, userId: session.user.id, projectType: 'canvas' },
        include: { files: { select: { path: true, content: true }, orderBy: { path: 'asc' } } },
      }))
      if (!project) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
      return NextResponse.json({ projectId: project.id, title: project.name, files: project.files })
    }

    const projects = await withDbRetry(() => prisma.project.findMany({
      where: { userId: session.user.id, projectType: 'canvas' },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      select: { id: true, name: true, updatedAt: true, _count: { select: { files: true } } },
    }))
    return NextResponse.json({ projects })
  } catch (error) {
    console.error('Canvas GET error:', error)
    return NextResponse.json({ error: 'Error cargando proyectos' }, { status: 500 })
  }
}
