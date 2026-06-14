export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ────────────────────────────────────────────────────────────────────────────
// GET  — list snapshots for a site
// POST — rollback to a specific version
// ────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const siteId = req.nextUrl.searchParams.get('siteId')
    if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 })

    // Verify ownership
    const site = await prisma.hostedSite.findFirst({
      where: { id: siteId, userId: session.user.id },
    })
    if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 })

    // Get snapshots (without full file content for listing)
    const snapshots = await prisma.hostedSiteSnapshot.findMany({
      where: { siteId },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, fileCount: true, totalSize: true, createdAt: true },
    })

    return NextResponse.json({
      success: true,
      siteId: site.id,
      slug: site.slug,
      currentVersion: site.version,
      snapshots,
    })
  } catch (e: unknown) {
    console.error('[Rollback] GET error', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json()
    const { siteId, targetVersion } = body as { siteId?: string; targetVersion?: number }
    if (!siteId || !targetVersion) return NextResponse.json({ error: 'siteId and targetVersion required' }, { status: 400 })

    // Verify ownership
    const site = await prisma.hostedSite.findFirst({
      where: { id: siteId, userId: session.user.id },
    })
    if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 })

    if (site.version === targetVersion) {
      return NextResponse.json({ error: 'Already at this version' }, { status: 400 })
    }

    // Find the snapshot
    const snapshot = await prisma.hostedSiteSnapshot.findUnique({
      where: { siteId_version: { siteId, version: targetVersion } },
    })
    if (!snapshot) return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 })

    // Parse snapshot files
    let snapshotFiles: Array<{ path: string; content: string; mimeType: string; size: number }>
    try {
      snapshotFiles = JSON.parse(snapshot.files)
    } catch {
      return NextResponse.json({ error: 'Corrupted snapshot' }, { status: 500 })
    }

    // Transaction: snapshot current state → restore from snapshot
    await prisma.$transaction(async (tx) => {
      // Save current version as snapshot before rollback
      const currentFiles = await tx.hostedSiteFile.findMany({ where: { siteId } })
      if (currentFiles.length > 0) {
        const currentSnapshotFiles = currentFiles.map(f => ({ path: f.filePath, content: f.content, mimeType: f.mimeType, size: f.size }))
        await tx.hostedSiteSnapshot.create({
          data: {
            siteId,
            version: site.version,
            files: JSON.stringify(currentSnapshotFiles),
            fileCount: currentFiles.length,
            totalSize: currentFiles.reduce((sum, f) => sum + f.size, 0),
          },
        }).catch(() => { /* ignore duplicate */ })
      }

      // Delete current files
      await tx.hostedSiteFile.deleteMany({ where: { siteId } })

      // Restore files from snapshot
      for (const f of snapshotFiles) {
        await tx.hostedSiteFile.create({
          data: {
            siteId,
            filePath: f.path,
            content: f.content,
            mimeType: f.mimeType || 'text/plain',
            size: f.size || 0,
          },
        })
      }

      // Update site version
      await tx.hostedSite.update({
        where: { id: siteId },
        data: {
          version: targetVersion,
          fileCount: snapshotFiles.length,
          totalSize: snapshotFiles.reduce((sum, f) => sum + (f.size || 0), 0),
        },
      })
    })

    console.log(`[Rollback] Site ${site.slug} rolled back from v${site.version} to v${targetVersion}`)

    return NextResponse.json({
      success: true,
      slug: site.slug,
      previousVersion: site.version,
      restoredVersion: targetVersion,
    })
  } catch (e: unknown) {
    console.error('[Rollback] POST error', e)
    return NextResponse.json({ error: 'Error al hacer rollback' }, { status: 500 })
  }
}
