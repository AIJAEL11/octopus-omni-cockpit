import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, withDbRetry } from '@/lib/prisma'
import { publishFilesToOctopus, slugify } from '@/lib/octopus-hosting'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/canvas/deploy — Despliega un proyecto Canvas
 * Body: { projectId, target: 'octopus' | 'github' | 'hostinger', repoName? }
 *
 * - octopus:   publica en Octopus Hosting (/sites/{slug}) — URL pública al instante
 * - github:    crea repo y sube los archivos con el brazo GitHub
 * - hostinger: ZIP al hosting del usuario con el brazo Hostinger
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const userId = session.user.id

    const { projectId, target, repoName } = await request.json()
    if (!projectId || !['octopus', 'github', 'hostinger'].includes(target)) {
      return NextResponse.json({ error: 'projectId y target válido requeridos' }, { status: 400 })
    }

    const project = await withDbRetry(() => prisma.project.findFirst({
      where: { id: projectId, userId, projectType: 'canvas' },
      include: { files: { select: { path: true, content: true } } },
    }))
    if (!project) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })

    const files = project.files
      .filter(f => f.content != null)
      .map(f => ({ path: f.path, content: f.content as string }))
    if (files.length === 0) {
      return NextResponse.json({ error: 'El proyecto no tiene archivos' }, { status: 400 })
    }

    // ─────────────────────────────────────────────────────────────────
    // 🐙 OCTOPUS HOSTING — publicación instantánea en /sites/{slug}
    // ─────────────────────────────────────────────────────────────────
    if (target === 'octopus') {
      const { siteId, slug } = await publishFilesToOctopus(userId, { id: project.id, name: project.name }, files)
      const origin = process.env.NEXTAUTH_URL || new URL(request.url).origin
      return NextResponse.json({
        success: true,
        target: 'octopus',
        url: `${origin}/sites/${slug}`,
        slug,
        siteId,
        filesCount: files.length,
      })
    }

    // ─────────────────────────────────────────────────────────────────
    // 🐙→🐈 GITHUB — crea repo y sube archivos con el brazo GitHub
    // ─────────────────────────────────────────────────────────────────
    if (target === 'github') {
      const { getGitHubCredentials, createRepository, pushFilesToRepo } = await import('@/lib/github-deploy')
      const creds = await getGitHubCredentials(userId)
      if (!creds) {
        return NextResponse.json({
          success: false,
          error: 'github_not_connected',
          message: 'Conecta tu cuenta de GitHub en Brazos Activos primero.',
        }, { status: 409 })
      }

      const name = (repoName || slugify(project.name)).slice(0, 80)
      const createResult = await createRepository(creds.token, name)
      // Si el repo ya existe (422), seguimos y empujamos a ese repo
      const repoFinalName = createResult.success && createResult.repoName ? createResult.repoName : name

      const pushResult = await pushFilesToRepo(creds.token, creds.username, repoFinalName, files)
      if (!pushResult.success) {
        return NextResponse.json({
          success: false,
          error: pushResult.error || 'Error subiendo archivos a GitHub',
        }, { status: 502 })
      }

      return NextResponse.json({
        success: true,
        target: 'github',
        url: `https://github.com/${creds.username}/${repoFinalName}`,
        filesCount: files.length,
      })
    }

    // ─────────────────────────────────────────────────────────────────
    // 🐙→🌐 HOSTINGER — ZIP al hosting del usuario
    // ─────────────────────────────────────────────────────────────────
    const { deployFilesToHostinger } = await import('@/lib/hostinger-deploy')
    const result = await deployFilesToHostinger(userId, files)
    if (!result.success) {
      const notConnected = (result.error || '').includes('credenciales')
      return NextResponse.json({
        success: false,
        error: notConnected ? 'hostinger_not_connected' : result.error,
        message: result.error,
      }, { status: notConnected ? 409 : 502 })
    }

    return NextResponse.json({
      success: true,
      target: 'hostinger',
      method: result.method, // 'api' = desplegado | 'zip_ready' = descarga el ZIP y súbelo
      domain: result.domain,
      url: result.method === 'api' ? `https://${result.domain}` : null,
      zipFallbackUrl: result.method === 'zip_ready' ? `/api/canvas/download/${project.id}` : null,
      filesCount: result.filesCount,
    })
  } catch (error) {
    console.error('Canvas deploy error:', error)
    return NextResponse.json({ error: 'Error desplegando el proyecto' }, { status: 500 })
  }
}
