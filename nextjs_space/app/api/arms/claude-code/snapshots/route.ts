export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Validate bridge token (same pattern as poll/respond)
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

// In-memory snapshot event store (per-session, ephemeral)
const snapshotEvents: Map<string, Array<{
  id: string
  eventType: string
  data: Record<string, unknown>
  timestamp: string
}>> = new Map()

const MAX_EVENTS_PER_SESSION = 50

// POST: Bridge reports snapshot events OR frontend triggers actions
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const bridgeToken = req.headers.get('x-bridge-token')

    // Bridge reporting an event
    if (bridgeToken) {
      const userId = await validateBridgeToken(bridgeToken)
      if (!userId) return NextResponse.json({ error: 'Invalid bridge token' }, { status: 401 })

      const { eventType, data, sessionId } = body
      if (!eventType) return NextResponse.json({ error: 'Missing eventType' }, { status: 400 })

      const sid = sessionId || 'default'
      const events = snapshotEvents.get(sid) || []
      events.push({
        id: `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        eventType,
        data: data || {},
        timestamp: new Date().toISOString(),
      })
      while (events.length > MAX_EVENTS_PER_SESSION) events.shift()
      snapshotEvents.set(sid, events)

      console.log(`[Phoenix] Event: ${eventType} for session ${sid}`)
      return NextResponse.json({ ok: true })
    }

    // Frontend action (authenticated user)
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { action, sessionId: rawSessionId, snapshotId, name } = body
    const userId = session.user.id

    // Resolve sessionId — must be a valid CodeSession FK
    let sessionId = rawSessionId
    if (!sessionId) {
      const latestSession = await prisma.codeSession.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        select: { id: true },
      })
      sessionId = latestSession?.id || null
    }
    if (!sessionId) return NextResponse.json({ error: 'No active session' }, { status: 400 })

    if (action === 'rollback') {
      // Queue a rollback command for Bridge to pick up via poll
      const cmd = await prisma.bridgeCommand.create({
        data: {
          sessionId,
          messageId: null,
          type: 'rollback',
          payload: JSON.stringify({ snapshotId: snapshotId || null }),
          status: 'approved',
          requiresConfirmation: false,
        },
      })
      console.log(`[Phoenix] Rollback command queued: ${cmd.id} for user ${userId}`)
      return NextResponse.json({ ok: true, commandId: cmd.id })
    }

    if (action === 'save_checkpoint') {
      const cmd = await prisma.bridgeCommand.create({
        data: {
          sessionId,
          messageId: null,
          type: 'save_checkpoint',
          payload: JSON.stringify({ name: name || 'checkpoint' }),
          status: 'approved',
          requiresConfirmation: false,
        },
      })
      return NextResponse.json({ ok: true, commandId: cmd.id })
    }

    if (action === 'list_snapshots') {
      const cmd = await prisma.bridgeCommand.create({
        data: {
          sessionId,
          messageId: null,
          type: 'list_snapshots',
          payload: JSON.stringify({}),
          status: 'approved',
          requiresConfirmation: false,
        },
      })
      return NextResponse.json({ ok: true, commandId: cmd.id })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    console.error('[Phoenix] POST error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// GET: Frontend fetches recent snapshot events for session
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sid = req.nextUrl.searchParams.get('sessionId') || 'default'
    const events = snapshotEvents.get(sid) || []

    const latestSnap = events.filter(e => e.eventType === 'snapshot_created').slice(-1)[0]
    const latestRollback = events.filter(e => e.eventType === 'rollback_executed').slice(-1)[0]
    const latestVerify = events.filter(e => e.eventType === 'integrity_verified' || e.eventType === 'integrity_mismatch').slice(-1)[0]

    return NextResponse.json({
      events: events.slice(-20),
      context: {
        lastSnapshot: latestSnap?.data || null,
        lastRollback: latestRollback?.data || null,
        lastVerify: latestVerify?.data || null,
        totalSnapshots: events.filter(e => e.eventType === 'snapshot_created').length,
      },
    })
  } catch (err) {
    console.error('[Phoenix] GET error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
