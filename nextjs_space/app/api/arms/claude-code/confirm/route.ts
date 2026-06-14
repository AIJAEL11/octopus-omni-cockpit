import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// ═══════════════════════════════════════════════════════════════════════════════
// User confirms or rejects a pending command (execute_cmd / delete_file)
// POST { commandId, decision: 'approve' | 'reject' }
// ═══════════════════════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id

  let body: { commandId: string; decision: 'approve' | 'reject' }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { commandId, decision } = body
  if (!commandId || !decision) {
    return NextResponse.json({ error: 'commandId and decision are required' }, { status: 400 })
  }

  const cmd = await prisma.bridgeCommand.findFirst({
    where: {
      id: commandId,
      session: { userId },
      status: 'pending',
    },
  })
  if (!cmd) {
    return NextResponse.json({ error: 'Command not found or not pending' }, { status: 404 })
  }

  const newStatus = decision === 'approve' ? 'approved' : 'rejected'
  await prisma.bridgeCommand.update({
    where: { id: commandId },
    data: { status: newStatus },
  })

  return NextResponse.json({ ok: true, status: newStatus })
}
