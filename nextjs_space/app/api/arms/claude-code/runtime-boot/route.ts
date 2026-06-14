import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, withDbRetry } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/arms/claude-code/runtime-boot?sessionId=xxx
 *
 * Devuelve los archivos de una sesión del Code Engine para montarlos en el
 * WebContainer runtime (página aislada /dashboard/claude-code/runtime).
 * La respuesta no contiene credenciales ni datos sensibles — solo código fuente.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const userId = session.user.id
    const sessionId = new URL(request.url).searchParams.get('sessionId')
    if (!sessionId) return NextResponse.json({ error: 'sessionId requerido' }, { status: 400 })

    // Verifica que la sesión pertenece al usuario (CodeSession)
    const codeSession = await withDbRetry(() => prisma.codeSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true },
    }))
    if (!codeSession) {
      return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })
    }

    // Obtener todos los archivos escritos (último write por path gana)
    const commands = await withDbRetry(() => prisma.bridgeCommand.findMany({
      where: { sessionId, type: 'write_file', status: { in: ['completed', 'approved'] } },
      select: { payload: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }))

    const fileMap = new Map<string, string>()
    for (const cmd of commands) {
      try {
        const p = JSON.parse(cmd.payload)
        if (p.path && typeof p.content === 'string') {
          fileMap.set(p.path.replace(/\\/g, '/'), p.content)
        }
      } catch { /* malformed */ }
    }

    if (fileMap.size === 0) {
      return NextResponse.json({ error: 'La sesión no tiene archivos generados' }, { status: 404 })
    }

    // Detectar tipo de proyecto
    const paths = [...fileMap.keys()]
    const hasPackageJson = paths.includes('package.json')
    const hasTailwind = paths.some(p => p.includes('tailwind'))
    const isNextJs = hasPackageJson && (fileMap.get('package.json') || '').includes('"next"')
    const isVite = hasPackageJson && (fileMap.get('package.json') || '').includes('"vite"')
    const isReact = hasPackageJson && (fileMap.get('package.json') || '').includes('"react"')

    // Dev command según el tipo de proyecto
    let devCmd = 'npx serve . -p 3111'
    if (isNextJs) devCmd = 'npm run dev'
    else if (isVite) devCmd = 'npm run dev'
    else if (isReact) devCmd = 'npx react-scripts start'
    else if (!hasPackageJson) devCmd = 'npx serve . -p 3111'

    return NextResponse.json({
      files: Object.fromEntries(fileMap),
      meta: {
        fileCount: fileMap.size,
        hasPackageJson,
        hasTailwind,
        isNextJs,
        isVite,
        isReact,
        devCmd,
      },
    })
  } catch (error) {
    console.error('Runtime boot error:', error)
    return NextResponse.json({ error: 'Error cargando archivos' }, { status: 500 })
  }
}
