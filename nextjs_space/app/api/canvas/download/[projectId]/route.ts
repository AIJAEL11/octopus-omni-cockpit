import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, withDbRetry } from '@/lib/prisma'
import archiver from 'archiver'
import { PassThrough } from 'stream'

export const dynamic = 'force-dynamic'

/**
 * GET /api/canvas/download/[projectId] — Descargar el proyecto como ZIP
 * Listo para desplegar en cualquier hosting estático (Hostinger, Vercel, Netlify...).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const project = await withDbRetry(() => prisma.project.findFirst({
      where: { id: params.projectId, userId: session.user.id, projectType: 'canvas' },
      include: { files: { select: { path: true, content: true } } },
    }))
    if (!project) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    const archive = archiver('zip', { zlib: { level: 9 } })
    const pass = new PassThrough()
    const chunks: Buffer[] = []
    pass.on('data', (c: Buffer) => chunks.push(c))

    const done = new Promise<Buffer>((resolve, reject) => {
      pass.on('end', () => resolve(Buffer.concat(chunks)))
      archive.on('error', reject)
    })

    archive.pipe(pass)
    for (const f of project.files) {
      if (f.content != null) archive.append(f.content, { name: f.path })
    }
    await archive.finalize()
    const zipBuffer = await done

    const safeName = project.name.replace(/[^\w\-. ]+/g, '').trim().replace(/\s+/g, '-') || 'proyecto-canvas'
    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${safeName}.zip"`,
      },
    })
  } catch (error) {
    console.error('Canvas download error:', error)
    return NextResponse.json({ error: 'Error generando ZIP' }, { status: 500 })
  }
}
