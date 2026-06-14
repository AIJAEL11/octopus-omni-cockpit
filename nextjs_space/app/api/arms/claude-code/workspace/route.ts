export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/arms/claude-code/workspace
 * Returns the user's workspace file tree from WorkspaceIndex
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await prisma.workspaceIndex.findUnique({
    where: { userId: session.user.id },
  })

  if (!workspace) {
    return NextResponse.json({ fileTree: null, fileCount: 0, totalSize: 0, rootPath: '' })
  }

  let tree = null
  try { tree = JSON.parse(workspace.fileTree) } catch { /* */ }

  return NextResponse.json({
    fileTree: tree,
    fileCount: workspace.fileCount,
    totalSize: workspace.totalSize,
    rootPath: workspace.rootPath,
    lastScanAt: workspace.lastScanAt,
  })
}
