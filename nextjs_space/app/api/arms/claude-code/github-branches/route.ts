export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getGitHubCredentials, listBranches, createBranch, mergeBranches } from '@/lib/github-deploy'

/**
 * GET /api/arms/claude-code/github-branches?repo=repoName
 * Lists all branches for a user's repo
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const repo = request.nextUrl.searchParams.get('repo')
  if (!repo) return NextResponse.json({ error: 'Missing repo parameter' }, { status: 400 })

  const creds = await getGitHubCredentials(session.user.id)
  if (!creds) return NextResponse.json({ error: 'GitHub not connected' }, { status: 403 })

  const result = await listBranches(creds.token, creds.username, repo)
  return NextResponse.json(result)
}

/**
 * POST /api/arms/claude-code/github-branches
 * Actions: create, merge
 * Body: { repo, action, branch?, fromBranch?, head?, base?, commitMessage? }
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { repo, action } = body
  if (!repo || !action) return NextResponse.json({ error: 'Missing repo or action' }, { status: 400 })

  const creds = await getGitHubCredentials(session.user.id)
  if (!creds) return NextResponse.json({ error: 'GitHub not connected' }, { status: 403 })

  if (action === 'create') {
    const { branch, fromBranch } = body
    if (!branch) return NextResponse.json({ error: 'Missing branch name' }, { status: 400 })
    // Sanitize branch name
    const safeName = branch.replace(/[^a-zA-Z0-9._/-]/g, '-').replace(/^-+|-+$/g, '')
    if (!safeName) return NextResponse.json({ error: 'Invalid branch name' }, { status: 400 })
    const result = await createBranch(creds.token, creds.username, repo, safeName, fromBranch || 'main')
    return NextResponse.json(result)
  }

  if (action === 'merge') {
    const { head, base, commitMessage } = body
    if (!head || !base) return NextResponse.json({ error: 'Missing head or base branch' }, { status: 400 })
    const result = await mergeBranches(creds.token, creds.username, repo, head, base, commitMessage)
    return NextResponse.json(result)
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
