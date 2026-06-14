/**
 * GitHub Pull/Clone API Route
 * GET  /api/arms/claude-code/github-pull  → List user repos
 * POST /api/arms/claude-code/github-pull  → Pull files from a specific repo
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getGitHubCredentials, listUserRepos, pullRepoFiles } from '@/lib/github-deploy'
import { prisma } from '@/lib/prisma'

// GET: List user's GitHub repos
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const creds = await getGitHubCredentials(session.user.id)
    if (!creds) {
      return NextResponse.json({ error: 'GitHub no conectado' }, { status: 400 })
    }

    const { repos, error } = await listUserRepos(creds.token)
    if (error) {
      return NextResponse.json({ error }, { status: 500 })
    }

    return NextResponse.json({ repos })
  } catch (err) {
    console.error('[GitHubPull] GET error:', err)
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 })
  }
}

// POST: Pull/clone files from a repo into a Code Engine session
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { repoName, branch = 'main', sessionId } = body

    if (!repoName) {
      return NextResponse.json({ error: 'repoName es requerido' }, { status: 400 })
    }

    const creds = await getGitHubCredentials(session.user.id)
    if (!creds) {
      return NextResponse.json({ error: 'GitHub no conectado' }, { status: 400 })
    }

    console.log(`[GitHubPull] User ${session.user.id} pulling ${creds.username}/${repoName}@${branch}`)

    const result = await pullRepoFiles(creds.token, creds.username, repoName, branch)

    if (!result.success || !result.files) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }

    // If a sessionId is provided, create write_file bridge commands for each file
    if (sessionId && result.files.length > 0) {
      // Use repo name as workspace root
      const rootPath = `/workspace/${repoName}`

      // Create bridge commands in batches
      const commandData = result.files.map((file) => ({
        sessionId,
        userId: session.user.id,
        type: 'write_file' as const,
        payload: JSON.stringify({
          path: `${rootPath}/${file.path}`,
          content: file.content,
        }),
        status: 'completed' as const,
      }))

      // Batch create (Prisma createMany)
      await prisma.bridgeCommand.createMany({ data: commandData })

      console.log(`[GitHubPull] ✓ Created ${commandData.length} bridge commands for session ${sessionId}`)
    }

    return NextResponse.json({
      success: true,
      repoName: result.repoName,
      branch: result.branch,
      filesCount: result.files.length,
      files: result.files.map(f => ({ path: f.path, size: f.content.length })),
    })
  } catch (err) {
    console.error('[GitHubPull] POST error:', err)
    return NextResponse.json({ error: 'Error inesperado al clonar repo' }, { status: 500 })
  }
}
