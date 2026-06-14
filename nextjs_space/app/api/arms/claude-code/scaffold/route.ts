import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, withDbRetry } from '@/lib/prisma'
import { buildSaasScaffoldFiles } from '@/lib/saas-scaffold'

export const dynamic = 'force-dynamic'

/**
 * POST /api/arms/claude-code/scaffold
 *
 * Inyecta un esqueleto SaaS full-stack determinístico (Next.js 14 +
 * Prisma/SQLite + NextAuth + Stripe opcional) en una sesión del Code Engine.
 * Cada archivo se persiste como BridgeCommand write_file (completed), igual que
 * la generación del LLM, así el runtime de WebContainers lo monta tal cual.
 *
 * Body: { sessionId?, appName?, accent?, auth?, database?, payments? }
 * Si no se pasa sessionId, crea una sesión nueva.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const userId = session.user.id
    const body = await req.json().catch(() => ({}))

    let sessionId = String(body.sessionId || '')
    let createdSession = false
    if (sessionId) {
      const cs = await withDbRetry(() => prisma.codeSession.findFirst({
        where: { id: sessionId, userId }, select: { id: true },
      }))
      if (!cs) return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })
    } else {
      const cs = await withDbRetry(() => prisma.codeSession.create({
        data: {
          userId,
          model: 'scaffold/saas',
          title: String(body.appName || 'SaaS Scaffold').slice(0, 120),
        },
      }))
      sessionId = cs.id
      createdSession = true
    }

    const files = buildSaasScaffoldFiles({
      appName: body.appName ? String(body.appName) : undefined,
      accent: body.accent ? String(body.accent) : undefined,
      auth: typeof body.auth === 'boolean' ? body.auth : undefined,
      database: typeof body.database === 'boolean' ? body.database : undefined,
      payments: typeof body.payments === 'boolean' ? body.payments : undefined,
    })

    // Limpia escrituras previas de los paths entrantes (upsert) y crea las nuevas.
    const incoming = new Set(files.map(f => f.path))
    const prev = await withDbRetry(() => prisma.bridgeCommand.findMany({
      where: { sessionId, type: 'write_file' },
      select: { id: true, payload: true },
    }))
    const stale = prev.filter(c => {
      try { return incoming.has(String(JSON.parse(c.payload).path).replace(/\\/g, '/')) } catch { return false }
    }).map(c => c.id)
    if (stale.length > 0) {
      await withDbRetry(() => prisma.bridgeCommand.deleteMany({ where: { id: { in: stale } } }))
    }
    for (const f of files) {
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
      createdSession,
      fileCount: files.length,
      filesWritten: files.map(f => f.path),
      runtimeUrl: `/dashboard/claude-code/runtime?sessionId=${sessionId}`,
    })
  } catch (error) {
    console.error('Scaffold error:', error)
    return NextResponse.json({ error: 'Error generando el scaffold' }, { status: 500 })
  }
}
