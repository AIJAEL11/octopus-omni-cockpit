import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUserMemories, retrieveRelevantMemories, summarizeRecentSessions } from '@/lib/session-memory'

export const dynamic = 'force-dynamic'

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/arms/claude-code/memory
// ?action=all          → all memories for the user
// ?action=search&q=... → relevance-scored search
// ?action=summarize    → trigger background summarization
// ═══════════════════════════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action') || 'all'

  if (action === 'all') {
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const memories = await getUserMemories(userId, limit)
    return NextResponse.json({
      memories,
      totalSessions: memories.length,
    })
  }

  if (action === 'search') {
    const query = searchParams.get('q') || ''
    const context = await retrieveRelevantMemories(userId, query)
    return NextResponse.json(context)
  }

  if (action === 'summarize') {
    const count = await summarizeRecentSessions(userId)
    return NextResponse.json({ summarized: count })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
