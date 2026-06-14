/**
 * Sprint S2: GitHub Auto-Push API Route
 * POST /api/arms/claude-code/github-push
 * Body: { sessionId: string, projectName?: string }
 * Collects all session files and pushes them to a new GitHub repo.
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { deployToGitHub, deployToProduction } from '@/lib/github-deploy'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { sessionId, projectName, production } = body

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId es requerido' }, { status: 400 })
    }

    // Production deploy: push + enable GitHub Pages = live URL
    if (production) {
      console.log(`[GitHubPush] 🚀 PRODUCTION deploy: session ${sessionId}`)

      const result = await deployToProduction(session.user.id, sessionId, projectName)

      if (result.success) {
        console.log(`[GitHubPush] ✓ Production: ${result.filesCount} files → ${result.pagesUrl || result.repoUrl}`)
        return NextResponse.json({
          success: true,
          repoUrl: result.repoUrl,
          repoName: result.repoName,
          filesCount: result.filesCount,
          pagesUrl: result.pagesUrl,
          pagesError: result.pagesError,
        })
      } else {
        console.warn(`[GitHubPush] ✗ Production failed: ${result.error}`)
        return NextResponse.json({ success: false, error: result.error }, { status: 400 })
      }
    }

    // Standard push (no Pages)
    console.log(`[GitHubPush] User ${session.user.id} pushing session ${sessionId} to GitHub`)

    const result = await deployToGitHub(session.user.id, sessionId, projectName)

    if (result.success) {
      console.log(`[GitHubPush] ✓ Pushed ${result.filesCount} files to ${result.repoUrl}`)
      return NextResponse.json({
        success: true,
        repoUrl: result.repoUrl,
        repoName: result.repoName,
        filesCount: result.filesCount,
      })
    } else {
      console.warn(`[GitHubPush] ✗ Failed: ${result.error}`)
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }
  } catch (err) {
    console.error('[GitHubPush] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Error inesperado al subir a GitHub' },
      { status: 500 }
    )
  }
}
