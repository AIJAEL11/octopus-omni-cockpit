export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ────────────────────────────────────────────────────────────────────────────
// GET  — list user's hosted sites
// POST — publish a Code Engine session as a hosted site
// ────────────────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const sites = await prisma.hostedSite.findMany({
      where: { userId: session.user.id, status: { not: 'deleted' } },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, slug: true, name: true, status: true, fileCount: true, totalSize: true, sessionId: true, createdAt: true, updatedAt: true },
    })
    return NextResponse.json({ sites })
  } catch (e: unknown) {
    console.error('[HostedSites] GET error', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json()
    const { sessionId, name } = body as { sessionId?: string; name?: string }
    if (!sessionId) return NextResponse.json({ error: 'sessionId requerido' }, { status: 400 })

    // Verify session belongs to user
    const codeSession = await prisma.codeSession.findFirst({
      where: { id: sessionId, userId: session.user.id },
    })
    if (!codeSession) return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })

    // Collect all completed write_file commands (last write wins per path)
    const commands = await prisma.bridgeCommand.findMany({
      where: { sessionId, type: 'write_file', status: 'completed' },
      orderBy: { createdAt: 'asc' },
    })

    if (commands.length === 0) {
      return NextResponse.json({ error: 'No hay archivos para publicar' }, { status: 400 })
    }

    // Deduplicate — last write wins
    const fileMap = new Map<string, { path: string; content: string }>()
    for (const cmd of commands) {
      try {
        const payload = JSON.parse(cmd.payload)
        if (payload.path && payload.content) {
          // Normalize path — remove leading slashes
          const normalizedPath = payload.path.replace(/^\/+/, '').replace(/^\.\//g, '')
          fileMap.set(normalizedPath, { path: normalizedPath, content: payload.content })
        }
      } catch { /* skip invalid payloads */ }
    }

    if (fileMap.size === 0) {
      return NextResponse.json({ error: 'No se encontraron archivos válidos' }, { status: 400 })
    }

    // Generate slug
    const siteName = name || codeSession.title || 'mi-sitio'
    let baseSlug = slugify(siteName)
    if (!baseSlug) baseSlug = 'sitio'

    // Check if this session already has a hosted site (re-publish = update)
    const existingSite = await prisma.hostedSite.findFirst({
      where: { userId: session.user.id, sessionId },
    })

    let slug = baseSlug
    if (!existingSite) {
      // Check slug uniqueness
      let suffix = 0
      while (true) {
        const candidate = suffix === 0 ? slug : `${baseSlug}-${suffix}`
        const taken = await prisma.hostedSite.findUnique({ where: { slug: candidate } })
        if (!taken) { slug = candidate; break }
        suffix++
        if (suffix > 100) { slug = `${baseSlug}-${Date.now().toString(36)}`; break }
      }
    } else {
      slug = existingSite.slug // keep existing slug on re-publish
    }

    // MIME type lookup
    const mimeForExt: Record<string, string> = {
      '.html': 'text/html', '.htm': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript', '.mjs': 'application/javascript',
      '.json': 'application/json',
      '.svg': 'image/svg+xml',
      '.xml': 'application/xml',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.ico': 'image/x-icon',
      '.webmanifest': 'application/manifest+json',
    }
    function getMime(filePath: string): string {
      const ext = '.' + filePath.split('.').pop()?.toLowerCase()
      return mimeForExt[ext] || 'text/plain'
    }

    // Calculate total size
    let totalSize = 0
    const fileEntries = Array.from(fileMap.values())
    for (const f of fileEntries) totalSize += new TextEncoder().encode(f.content).length

    // Transaction: snapshot current → create/update site → upsert files
    const site = await prisma.$transaction(async (tx) => {
      let siteRecord;
      let newVersion = 1;

      if (existingSite) {
        // ── Save snapshot of current version before overwriting ──
        const currentFiles = await tx.hostedSiteFile.findMany({ where: { siteId: existingSite.id } })
        if (currentFiles.length > 0) {
          const snapshotFiles = currentFiles.map(f => ({ path: f.filePath, content: f.content, mimeType: f.mimeType, size: f.size }))
          await tx.hostedSiteSnapshot.create({
            data: {
              siteId: existingSite.id,
              version: existingSite.version || 1,
              files: JSON.stringify(snapshotFiles),
              fileCount: currentFiles.length,
              totalSize: currentFiles.reduce((sum, f) => sum + f.size, 0),
            },
          }).catch(() => { /* ignore duplicate version */ })
        }

        // Purge old snapshots — keep max 10
        const snapshots = await tx.hostedSiteSnapshot.findMany({ where: { siteId: existingSite.id }, orderBy: { version: 'desc' } })
        if (snapshots.length > 10) {
          const toDelete = snapshots.slice(10).map(s => s.id)
          await tx.hostedSiteSnapshot.deleteMany({ where: { id: { in: toDelete } } })
        }

        newVersion = (existingSite.version || 1) + 1

        // Delete old files and replace
        await tx.hostedSiteFile.deleteMany({ where: { siteId: existingSite.id } })
        siteRecord = await tx.hostedSite.update({
          where: { id: existingSite.id },
          data: { name: siteName, fileCount: fileEntries.length, totalSize, status: 'active', version: newVersion },
        })
      } else {
        siteRecord = await tx.hostedSite.create({
          data: {
            userId: session.user.id,
            sessionId,
            slug,
            name: siteName,
            fileCount: fileEntries.length,
            totalSize,
            version: 1,
          },
        })
      }

      // Create file records
      for (const f of fileEntries) {
        const content = f.content
        const size = new TextEncoder().encode(content).length
        await tx.hostedSiteFile.create({
          data: {
            siteId: siteRecord.id,
            filePath: f.path,
            content,
            mimeType: getMime(f.path),
            size,
          },
        })
      }

      return siteRecord
    })

    // Build public URLs
    const baseUrl = process.env.NEXTAUTH_URL || 'https://octopuskills.com'
    const siteUrl = `${baseUrl}/sites/${slug}`
    const subdomainUrl = `https://${slug}.octopuskills.com`

    // Provision SSL cert for subdomain (fire-and-forget, non-blocking)
    const certApiUrl = process.env.VPS_CERT_API_URL
    const certApiKey = process.env.VPS_CERT_API_KEY
    if (certApiUrl && certApiKey) {
      fetch(certApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${certApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subdomain: slug }),
        signal: AbortSignal.timeout(15000),
      }).then(r => r.json()).then(d => {
        console.log(`[HostedSites] SSL cert for ${slug}: ${d.status}`)
      }).catch(err => {
        console.warn(`[HostedSites] SSL provision skipped for ${slug}:`, err.message)
      })
    }

    return NextResponse.json({
      success: true,
      siteId: site.id,
      slug,
      url: siteUrl,
      subdomainUrl,
      fileCount: fileEntries.length,
      totalSize,
      version: site.version,
      isUpdate: !!existingSite,
    })
  } catch (e: unknown) {
    console.error('[HostedSites] POST error', e)
    return NextResponse.json({ error: 'Error al publicar' }, { status: 500 })
  }
}
