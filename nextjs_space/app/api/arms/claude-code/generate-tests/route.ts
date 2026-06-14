import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, withDbRetry } from '@/lib/prisma'
import { buildTestScaffoldFiles, mergeTestDepsIntoPackageJson } from '@/lib/test-scaffold'

export const dynamic = 'force-dynamic'

/**
 * POST /api/arms/claude-code/generate-tests
 *
 * Inyecta un harness de tests (Vitest + Testing Library + Playwright) en una
 * sesión del Code Engine y cablea `npm test` en su package.json. Cada archivo
 * se persiste como BridgeCommand write_file (completed), igual que el resto.
 *
 * Body: { sessionId }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const userId = session.user.id
    const { sessionId } = await req.json().catch(() => ({}))
    if (!sessionId) return NextResponse.json({ error: 'sessionId requerido' }, { status: 400 })

    const cs = await withDbRetry(() => prisma.codeSession.findFirst({
      where: { id: sessionId, userId }, select: { id: true },
    }))
    if (!cs) return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })

    // Lee los archivos actuales (último write por path gana) para localizar package.json.
    const prevCmds = await withDbRetry(() => prisma.bridgeCommand.findMany({
      where: { sessionId, type: 'write_file', status: { in: ['completed', 'approved'] } },
      select: { payload: true },
      orderBy: { createdAt: 'asc' },
    }))
    const fileMap = new Map<string, string>()
    for (const c of prevCmds) {
      try {
        const p = JSON.parse(c.payload)
        if (p.path && typeof p.content === 'string') fileMap.set(p.path.replace(/\\/g, '/'), p.content)
      } catch {}
    }

    const harness = buildTestScaffoldFiles()
    const toWrite = [...harness]
    let packageJsonUpdated = false
    const pkg = fileMap.get('package.json')
    if (pkg) {
      const merged = mergeTestDepsIntoPackageJson(pkg)
      if (merged !== pkg) {
        toWrite.push({ path: 'package.json', content: merged })
        packageJsonUpdated = true
      }
    }

    // Upsert: limpia escrituras previas de los paths entrantes y crea las nuevas.
    const incoming = new Set(toWrite.map(f => f.path))
    const stale = prevCmds.length
      ? (await withDbRetry(() => prisma.bridgeCommand.findMany({
          where: { sessionId, type: 'write_file' },
          select: { id: true, payload: true },
        }))).filter(c => {
          try { return incoming.has(String(JSON.parse(c.payload).path).replace(/\\/g, '/')) } catch { return false }
        }).map(c => c.id)
      : []
    if (stale.length > 0) {
      await withDbRetry(() => prisma.bridgeCommand.deleteMany({ where: { id: { in: stale } } }))
    }
    for (const f of toWrite) {
      await withDbRetry(() => prisma.bridgeCommand.create({
        data: {
          sessionId,
          type: 'write_file',
          payload: JSON.stringify({ action: 'write_file', path: f.path, content: f.content }),
          status: 'completed',
        },
      }))
    }
    await withDbRetry(() => prisma.codeSession.update({
      where: { id: sessionId }, data: { updatedAt: new Date() },
    }))

    return NextResponse.json({
      sessionId,
      fileCount: toWrite.length,
      filesWritten: toWrite.map(f => f.path),
      packageJsonUpdated,
    })
  } catch (error) {
    console.error('Generate-tests error:', error)
    return NextResponse.json({ error: 'Error generando los tests' }, { status: 500 })
  }
}
