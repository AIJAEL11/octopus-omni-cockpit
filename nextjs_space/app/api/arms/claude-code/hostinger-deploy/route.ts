/**
 * Sprint S3: Hostinger One-Click Deploy API Route
 * POST /api/arms/claude-code/hostinger-deploy
 * Body: { sessionId: string }
 * 
 * Deploys session files to Hostinger. If API deploy succeeds, returns domain.
 * If API is unavailable, returns a ZIP download for manual upload.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { deployToHostinger } from '@/lib/hostinger-deploy'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { sessionId } = body

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId es requerido' }, { status: 400 })
    }

    console.log(`[HostingerDeploy] User ${session.user.id} deploying session ${sessionId}`)

    const result = await deployToHostinger(session.user.id, sessionId)

    if (!result.success && !result.zipBuffer) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }

    // If API deploy succeeded directly
    if (result.method === 'api') {
      console.log(`[HostingerDeploy] \u2713 Deployed ${result.filesCount} files to ${result.domain} via API`)
      return NextResponse.json({
        success: true,
        domain: result.domain,
        filesCount: result.filesCount,
        method: 'api',
      })
    }

    // Fallback: ZIP ready for manual upload
    // Return the ZIP as downloadable response
    if (result.method === 'zip_ready' && result.zipBuffer) {
      console.log(`[HostingerDeploy] Returning ZIP for manual upload (${result.filesCount} files)`)
      return new NextResponse(result.zipBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="deploy_${result.domain}_${Date.now()}.zip"`,
          'X-Deploy-Method': 'zip_manual',
          'X-Deploy-Domain': result.domain || '',
          'X-Deploy-Files': String(result.filesCount || 0),
        },
      })
    }

    return NextResponse.json({ success: false, error: 'Error inesperado' }, { status: 500 })
  } catch (err) {
    console.error('[HostingerDeploy] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Error inesperado al publicar en Hostinger' },
      { status: 500 }
    )
  }
}
