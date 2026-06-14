export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getGitHubCredentials, listCommits } from '@/lib/github-deploy'

/**
 * GET /api/arms/claude-code/github-commits?repo=repoName&branch=main
 * Lists recent commits for a user's repo
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const repo = request.nextUrl.searchParams.get('repo')
  if (!repo) return NextResponse.json({ error: 'Missing repo parameter' }, { status: 400 })
  
  const branch = request.nextUrl.searchParams.get('branch') || undefined

  const creds = await getGitHubCredentials(session.user.id)
  if (!creds) return NextResponse.json({ error: 'GitHub not connected' }, { status: 403 })

  const result = await listCommits(creds.token, creds.username, repo, branch)
  return NextResponse.json(result)
}
