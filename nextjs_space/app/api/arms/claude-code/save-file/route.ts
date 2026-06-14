import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, withDbRetry } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const MAX_FILE_SIZE = 500_000

/**
 * POST /api/arms/claude-code/save-file
 *
 * Guarda la edición manual de un archivo (Monaco editor) en una sesión del
 * Code Engine. Persiste como BridgeCommand write_file (completed) — la misma
 * representación que usa la generación del LLM, así el runtime lo recoge.
 * Reemplaza la última escritura de ese path (último write gana).
 *
 * Body: { sessionId, path, content }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const userId = session.user.id
    const { sessionId, path, content } = await req.json()

    if (!sessionId || typeof path !== 'string' || typeof content !== 'string') {
      return NextResponse.json({ error: 'sessionId, path y content requeridos' }, { status: 400 })
    }
    const cleanPath = path.replace(/\\/g, '/').replace(/^\/+/, '').slice(0, 300)
    if (!cleanPath || cleanPath.includes('..')) {
      return NextResponse.json({ error: 'Ruta inválida' }, { status: 400 })
    }
    if (content.length > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Archivo demasiado grande (máx. 500KB)' }, { status: 413 })
    }

    // Verifica propiedad de la sesión.
    const cs = await withDbRetry(() => prisma.codeSession.findFirst({
      where: { id: sessionId, userId }, select: { id: true },
    }))
    if (!cs) return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })

    // Elimina la(s) escritura(s) previa(s) de este path (último write gana).
    const prev = await withDbRetry(() => prisma.bridgeCommand.findMany({
      where: { sessionId, type: 'write_file' },
      select: { id: true, payload: true },
    }))
    const stale = prev.filter(c => {
      try { return String(JSON.parse(c.payload).path).replace(/\\/g, '/') === cleanPath } catch { return false }
    }).map(c => c.id)
    if (stale.length > 0) {
      await withDbRetry(() => prisma.bridgeCommand.deleteMany({ where: { id: { in: stale } } }))
    }

    await withDbRetry(() => prisma.bridgeCommand.create({
      data: {
        sessionId,
        type: 'write_file',
        payload: JSON.stringify({ action: 'write_file', path: cleanPath, content, source: 'manual-edit' }),
        status: 'completed',
      },
    }))
    await withDbRetry(() => prisma.codeSession.update({
      where: { id: sessionId }, data: { updatedAt: new Date() },
    }))

    return NextResponse.json({ success: true, path: cleanPath })
  } catch (error) {
    console.error('Save-file error:', error)
    return NextResponse.json({ error: 'Error guardando el archivo' }, { status: 500 })
  }
}
