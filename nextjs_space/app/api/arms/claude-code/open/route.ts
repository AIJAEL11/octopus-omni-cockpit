import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validatePath } from '@/lib/claude-code-prompts'

export const dynamic = 'force-dynamic'

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/arms/claude-code/open
// Direct UI action — opens a file or folder in the user's native file explorer
// via the local Bridge. Bypasses the LLM (instant button click).
//
// Body: { sessionId: string, path: string }
// Returns: { ok: true, commandId: string }
// ═══════════════════════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id

  let body: { sessionId?: string; path?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { sessionId, path: targetPath } = body
  if (!sessionId || typeof sessionId !== 'string') {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
  }
  if (typeof targetPath !== 'string') {
    return NextResponse.json({ error: 'path is required' }, { status: 400 })
  }

  // Path validation — must be within workspace sandbox
  // Empty string is allowed (means "open workspace root")
  if (targetPath !== '') {
    const invalid = validatePath(targetPath)
    if (invalid) {
      return NextResponse.json({ error: invalid }, { status: 400 })
    }
  }

  // Verify session ownership
  const codeSession = await prisma.codeSession.findFirst({
    where: { id: sessionId, userId },
  })
  if (!codeSession) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  // Verify Bridge online (Ollama arm is updated every 60s by bridge heartbeat)
  const arm = await prisma.armConnection.findFirst({
    where: { userId, armType: 'ollama' },
  })
  if (!arm) {
    return NextResponse.json({ error: 'Bridge no detectado. Instala y ejecuta el Bridge primero.' }, { status: 400 })
  }
  let lastSeen = 0
  try {
    const creds = JSON.parse(arm.credentials || '{}')
    lastSeen = creds.lastSeenAt ? new Date(creds.lastSeenAt).getTime() : 0
  } catch {}
  if (Date.now() - lastSeen > 3 * 60 * 1000) {
    return NextResponse.json({ error: 'Bridge offline. ¿Está ejecutándose?' }, { status: 400 })
  }

  // Create approved BridgeCommand — bridge will pick it up on next poll
  const cmd = await prisma.bridgeCommand.create({
    data: {
      sessionId,
      messageId: null,
      type: 'open_path',
      payload: JSON.stringify({ path: targetPath }),
      status: 'approved',
      requiresConfirmation: false,
    },
  })

  return NextResponse.json({ ok: true, commandId: cmd.id })
}
