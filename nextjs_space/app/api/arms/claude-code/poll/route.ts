import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ═══════════════════════════════════════════════════════════════════════════════
// Bridge long-polls this endpoint to receive next approved command.
// Holds the connection for up to 25s, checking every 800ms.
// Falls back to immediate response if ?wait=0 is passed (legacy mode).
// Auth: x-bridge-token header
// ═══════════════════════════════════════════════════════════════════════════════
async function validateBridgeToken(token: string): Promise<string | null> {
  if (!token) return null
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      apiKey: token,
      OR: [{ serviceType: 'hogar_bridge' }, { serviceType: 'octopus_bridge' }],
    },
  })
  return apiKey?.userId || null
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function findApprovedCommands(userId: string) {
  return prisma.bridgeCommand.findMany({
    where: {
      status: 'approved',
      session: { userId },
    },
    orderBy: { createdAt: 'asc' },
    take: 20, // max batch size
  })
}

export async function GET(req: NextRequest) {
  const token = req.headers.get('x-bridge-token') || ''
  const userId = await validateBridgeToken(token)
  if (!userId) {
    return NextResponse.json({ error: 'Invalid bridge token' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const waitParam = searchParams.get('wait')
  const batchMode = searchParams.get('batch') !== '0' // default: batch=true
  const maxWaitMs = waitParam === '0' ? 0 : 25_000
  const pollInterval = 800

  const deadline = Date.now() + maxWaitMs

  // Long-poll loop: check DB periodically until command(s) found or timeout
  while (true) {
    const cmds = await findApprovedCommands(userId)
    if (cmds.length > 0) {
      // Batch mode: group all approved commands from the same messageId
      // This enables atomic multi-file transactions
      const firstCmd = cmds[0]
      const msgId = firstCmd.messageId

      // Get batch: all commands from same message (or just the first if no messageId)
      const batch = batchMode && msgId
        ? cmds.filter((c) => c.messageId === msgId)
        : [firstCmd]

      // Mark all batch commands as executing
      await prisma.bridgeCommand.updateMany({
        where: { id: { in: batch.map((c) => c.id) } },
        data: { status: 'executing' },
      })

      const batchPayloads = batch.map((cmd) => {
        let payload: Record<string, unknown> = {}
        try { payload = JSON.parse(cmd.payload) } catch {}
        return {
          commandId: cmd.id,
          type: cmd.type,
          payload,
        }
      })

      // Single command backward compat + batch support
      if (batchPayloads.length === 1) {
        return NextResponse.json({
          pending: true,
          commandId: batchPayloads[0].commandId,
          type: batchPayloads[0].type,
          payload: batchPayloads[0].payload,
          batch: batchPayloads, // Always include batch array
        })
      }

      return NextResponse.json({
        pending: true,
        commandId: batchPayloads[0].commandId,
        type: batchPayloads[0].type,
        payload: batchPayloads[0].payload,
        batch: batchPayloads,
      })
    }

    if (Date.now() >= deadline) break
    await sleep(pollInterval)
  }

  return NextResponse.json({ pending: false })
}
