import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// ═══════════════════════════════════════════════════════════════════════════════
// SSE Stream — Frontend subscribes to receive real-time command updates.
// Replaces client-side polling of fetchCommands().
// Sends deltas: new commands, status changes, streamOutput chunks.
// ═══════════════════════════════════════════════════════════════════════════════

interface CommandSnapshot {
  id: string
  status: string
  result: string | null
  error: string | null
  streamOutput: string | null
  updatedAt: number
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
  const userId = session.user.id
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('sessionId')

  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'sessionId required' }), { status: 400 })
  }

  // Verify session ownership
  const cs = await prisma.codeSession.findFirst({ where: { id: sessionId, userId } })
  if (!cs) {
    return new Response(JSON.stringify({ error: 'Session not found' }), { status: 404 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch {}
      }

      // Track known state to only send deltas
      const knownState = new Map<string, CommandSnapshot>()
      let lastCommandCount = 0
      let alive = true

      // Send initial snapshot
      send('connected', { sessionId })

      const poll = async () => {
        if (!alive) return
        try {
          const commands = await prisma.bridgeCommand.findMany({
            where: { sessionId },
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              type: true,
              payload: true,
              status: true,
              result: true,
              error: true,
              streamOutput: true,
              requiresConfirmation: true,
              createdAt: true,
              updatedAt: true,
            },
          })

          // Detect new commands
          if (commands.length > lastCommandCount) {
            const newCmds = commands.slice(lastCommandCount)
            for (const cmd of newCmds) {
              let payload: Record<string, unknown> = {}
              try { payload = JSON.parse(cmd.payload) } catch {}
              send('command_new', {
                id: cmd.id,
                type: cmd.type,
                payload,
                status: cmd.status,
                requiresConfirmation: cmd.requiresConfirmation,
                createdAt: cmd.createdAt.toISOString(),
              })
              knownState.set(cmd.id, {
                id: cmd.id,
                status: cmd.status,
                result: cmd.result,
                error: cmd.error,
                streamOutput: cmd.streamOutput,
                updatedAt: cmd.updatedAt.getTime(),
              })
            }
            lastCommandCount = commands.length
          }

          // Detect changes in existing commands
          for (const cmd of commands) {
            const prev = knownState.get(cmd.id)
            if (!prev) continue
            const updatedMs = cmd.updatedAt.getTime()
            if (updatedMs <= prev.updatedAt) continue

            // Status changed
            if (cmd.status !== prev.status) {
              let result: unknown = null
              if (cmd.result) {
                try { result = JSON.parse(cmd.result) } catch { result = cmd.result }
              }
              send('command_update', {
                id: cmd.id,
                status: cmd.status,
                result,
                error: cmd.error,
              })
            }

            // Stream output changed (terminal streaming)
            if (cmd.streamOutput && cmd.streamOutput !== prev.streamOutput) {
              // Send only the new delta
              const prevLen = prev.streamOutput?.length || 0
              const delta = cmd.streamOutput.slice(prevLen)
              if (delta) {
                send('stream_output', {
                  id: cmd.id,
                  delta,
                  total: cmd.streamOutput.length,
                })
              }
            }

            // Update snapshot
            knownState.set(cmd.id, {
              id: cmd.id,
              status: cmd.status,
              result: cmd.result,
              error: cmd.error,
              streamOutput: cmd.streamOutput,
              updatedAt: updatedMs,
            })
          }
        } catch (err) {
          // DB error — send heartbeat to keep connection alive
          send('heartbeat', { ts: Date.now() })
        }

        if (alive) {
          setTimeout(poll, 400) // 400ms server-side poll interval
        }
      }

      // Start polling loop
      poll()

      // Send keepalive every 15s to prevent proxy timeouts
      const keepalive = setInterval(() => {
        if (!alive) { clearInterval(keepalive); return }
        send('heartbeat', { ts: Date.now() })
      }, 15000)

      // Cleanup on client disconnect (detected when enqueue throws)
      // The `pull` and `cancel` callbacks handle cleanup
      req.signal.addEventListener('abort', () => {
        alive = false
        clearInterval(keepalive)
        try { controller.close() } catch {}
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
