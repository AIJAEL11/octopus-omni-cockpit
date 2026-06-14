export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  parseFile,
  buildDependencyGraph,
  validateFileImports,
  formatGraphForLLM,
  type FileAnalysis,
  type DependencyGraph,
} from '@/lib/code-intelligence'

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/arms/claude-code/analyze
// Body: { path: string, content: string } → FileAnalysis
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { path, content } = body

    if (!path || typeof content !== 'string') {
      return NextResponse.json({ error: 'path and content required' }, { status: 400 })
    }

    const analysis: FileAnalysis = parseFile(path, content)

    return NextResponse.json({ analysis })
  } catch (err) {
    console.error('[CodeIntelligence] POST /analyze error:', err)
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/arms/claude-code/analyze?sessionId=X
// Returns the full dependency graph for the session's workspace
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('sessionId')

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
  }

  try {
    // Verify session belongs to user
    const cs = await prisma.codeSession.findFirst({
      where: { id: sessionId, userId: session.user.id },
    })
    if (!cs) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Get all write_file commands with payload
    const commands = await prisma.bridgeCommand.findMany({
      where: {
        sessionId,
        type: 'write_file',
        status: { in: ['completed', 'approved', 'executing'] },
      },
      orderBy: { createdAt: 'asc' },
    })

    // Build file map (last-write-wins dedup)
    const fileMap = new Map<string, { path: string; content: string }>()
    for (const cmd of commands) {
      try {
        const payload = JSON.parse(cmd.payload as string)
        if (payload.path && payload.content) {
          const normalized = payload.path.replace(/\\/g, '/')
          fileMap.set(normalized, { path: normalized, content: payload.content })
        }
      } catch {}
    }

    const graph: DependencyGraph = buildDependencyGraph(fileMap)
    const llmContext = formatGraphForLLM(graph)

    return NextResponse.json({ graph, llmContext })
  } catch (err) {
    console.error('[CodeIntelligence] GET /analyze error:', err)
    return NextResponse.json({ error: 'Graph build failed' }, { status: 500 })
  }
}
