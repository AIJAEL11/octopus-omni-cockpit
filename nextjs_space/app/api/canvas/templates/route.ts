import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, withDbRetry } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * 🧬 MARKETPLACE DE PLANTILLAS — comunidad Canvas
 *
 * Una plantilla publicada es una COPIA CONGELADA del proyecto con
 * projectType 'canvas_template' (cero migraciones de esquema):
 *   - progress     → contador de forks (créditos del autor = forks × 10)
 *   - description  → JSON { d: descripción, a: autor, c: categoría, src: proyectoOriginal }
 *
 * GET                  → galería pública (todas las plantillas, buscables)
 * POST action=publish  → publica/actualiza tu proyecto como plantilla
 * POST action=fork     → copia una plantilla a TU canvas (nuevo Project)
 * DELETE ?templateId=  → despublica tu plantilla
 */

interface TemplateMeta {
  d?: string  // descripción
  a?: string  // nombre del autor
  c?: string  // categoría
  src?: string // projectId original
}

function parseMeta(description: string | null): TemplateMeta {
  if (!description) return {}
  try { return JSON.parse(description) } catch { return { d: description } }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = (searchParams.get('search') || '').toLowerCase()
    const category = searchParams.get('category')
    const mine = searchParams.get('mine') === '1'

    const templates = await withDbRetry(() => prisma.project.findMany({
      where: {
        projectType: 'canvas_template',
        ...(mine ? { userId: session.user.id } : {}),
      },
      orderBy: [{ progress: 'desc' }, { updatedAt: 'desc' }],
      take: 100,
      select: {
        id: true, name: true, description: true, progress: true,
        updatedAt: true, userId: true,
        _count: { select: { files: true } },
      },
    }))

    const result = templates
      .map(t => {
        const meta = parseMeta(t.description)
        return {
          id: t.id,
          name: t.name,
          description: meta.d || '',
          author: meta.a || 'Anónimo',
          category: meta.c || 'general',
          forks: t.progress,
          credits: t.progress * 10,
          files: t._count.files,
          updatedAt: t.updatedAt,
          isMine: t.userId === session.user.id,
        }
      })
      .filter(t =>
        (!search || t.name.toLowerCase().includes(search) || t.description.toLowerCase().includes(search)) &&
        (!category || category === 'all' || t.category === category)
      )

    return NextResponse.json({ templates: result })
  } catch (error) {
    console.error('Templates GET error:', error)
    return NextResponse.json({ error: 'Error cargando plantillas' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const userId = session.user.id
    const body = await request.json()
    const action = body.action as 'publish' | 'fork'

    // ─────────────────────────────────────────────────────────────────
    // PUBLICAR: copia congelada del proyecto → canvas_template
    // ─────────────────────────────────────────────────────────────────
    if (action === 'publish') {
      const { projectId, description, category } = body
      const project = await withDbRetry(() => prisma.project.findFirst({
        where: { id: projectId, userId, projectType: 'canvas' },
        include: { files: { select: { name: true, path: true, content: true, fileType: true } } },
      }))
      if (!project) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
      if (project.files.length === 0) {
        return NextResponse.json({ error: 'El proyecto no tiene archivos' }, { status: 400 })
      }

      const user = await withDbRetry(() => prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      }))
      const authorName = user?.name || user?.email?.split('@')[0] || 'Anónimo'

      const meta: TemplateMeta = {
        d: (description || '').slice(0, 300),
        a: authorName,
        c: (category || 'general').slice(0, 30),
        src: projectId,
      }

      // Re-publicar = actualizar plantilla existente (misma fuente, mismo autor)
      const existing = await withDbRetry(() => prisma.project.findFirst({
        where: {
          userId,
          projectType: 'canvas_template',
          description: { contains: `"src":"${projectId}"` },
        },
        select: { id: true, progress: true },
      }))

      let templateId: string
      if (existing) {
        await withDbRetry(() => prisma.projectFile.deleteMany({ where: { projectId: existing.id } }))
        await withDbRetry(() => prisma.project.update({
          where: { id: existing.id },
          data: { name: project.name, description: JSON.stringify(meta) },
        }))
        templateId = existing.id
      } else {
        const created = await withDbRetry(() => prisma.project.create({
          data: {
            userId,
            name: project.name,
            description: JSON.stringify(meta),
            projectType: 'canvas_template',
            status: 'active',
            progress: 0,
          },
        }))
        templateId = created.id
      }

      for (const f of project.files) {
        await withDbRetry(() => prisma.projectFile.create({
          data: { projectId: templateId, name: f.name, path: f.path, content: f.content, fileType: f.fileType },
        }))
      }

      return NextResponse.json({ success: true, templateId, updated: !!existing })
    }

    // ─────────────────────────────────────────────────────────────────
    // FORK: copia la plantilla a TU canvas + incrementa créditos del autor
    // ─────────────────────────────────────────────────────────────────
    if (action === 'fork') {
      const { templateId } = body
      const template = await withDbRetry(() => prisma.project.findFirst({
        where: { id: templateId, projectType: 'canvas_template' },
        include: { files: { select: { name: true, path: true, content: true, fileType: true } } },
      }))
      if (!template) return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 })

      const fork = await withDbRetry(() => prisma.project.create({
        data: {
          userId,
          name: template.name,
          description: 'Plantilla de la comunidad — personalízala por chat',
          projectType: 'canvas',
          status: 'completed',
          progress: 100,
        },
      }))
      for (const f of template.files) {
        await withDbRetry(() => prisma.projectFile.create({
          data: { projectId: fork.id, name: f.name, path: f.path, content: f.content, fileType: f.fileType },
        }))
      }

      // Créditos del autor: +1 fork (no contar forks propios)
      if (template.userId !== userId) {
        await withDbRetry(() => prisma.project.update({
          where: { id: templateId },
          data: { progress: { increment: 1 } },
        }))
      }

      return NextResponse.json({ success: true, projectId: fork.id, title: fork.name })
    }

    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  } catch (error) {
    console.error('Templates POST error:', error)
    return NextResponse.json({ error: 'Error procesando la plantilla' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const templateId = new URL(request.url).searchParams.get('templateId')
    if (!templateId) return NextResponse.json({ error: 'templateId requerido' }, { status: 400 })

    const template = await withDbRetry(() => prisma.project.findFirst({
      where: { id: templateId, userId: session.user.id, projectType: 'canvas_template' },
      select: { id: true },
    }))
    if (!template) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

    await withDbRetry(() => prisma.projectFile.deleteMany({ where: { projectId: templateId } }))
    await withDbRetry(() => prisma.project.delete({ where: { id: templateId } }))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Templates DELETE error:', error)
    return NextResponse.json({ error: 'Error despublicando' }, { status: 500 })
  }
}
