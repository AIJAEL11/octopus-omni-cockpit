import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Helper: validate bridge token from ApiKey table
// Accept both browser_bridge AND hogar_bridge tokens (unified bridge)
async function validateBridgeToken(token: string) {
  if (!token) return null
  const apiKey = await prisma.apiKey.findFirst({
    where: { apiKey: token, serviceType: { in: ['browser_bridge', 'hogar_bridge'] } },
  })
  return apiKey?.userId || null
}

// GET — Bridge polls for pending commands
export async function GET(req: NextRequest) {
  try {
    let userId: string | null = null
    const token = req.headers.get('x-bridge-token') || req.nextUrl.searchParams.get('token')

    if (token) {
      userId = await validateBridgeToken(token)
    } else {
      const session = await getServerSession(authOptions)
      userId = session?.user?.id || null
    }

    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Get pending commands across all active sessions
    const commands = await prisma.browserCommand.findMany({
      where: { userId, status: 'pending' },
      include: {
        session: { select: { id: true, name: true, status: true, currentUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 20,
    })

    // Mark as sent
    if (commands.length > 0) {
      await prisma.browserCommand.updateMany({
        where: { id: { in: commands.map(c => c.id) } },
        data: { status: 'sent' },
      })
    }

    // Update bridge heartbeat
    await prisma.armConnection.upsert({
      where: { userId_armType: { userId, armType: 'browser_automation' } },
      update: { status: 'connected', updatedAt: new Date() },
      create: {
        userId, armType: 'browser_automation', name: 'Browser Automation',
        status: 'connected', credentials: JSON.stringify({ autoDetected: true }),
        connectedAt: new Date(),
      },
    })

    return NextResponse.json({
      commands: commands.map(c => ({
        id: c.id,
        sessionId: c.sessionId,
        type: c.type,
        params: c.params,
        tabId: c.tabId || null,
        session: c.session,
      })),
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Browser Bridge GET error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// POST — Bridge reports command results, screenshots, session updates
export async function POST(req: NextRequest) {
  try {
    let userId: string | null = null
    const token = req.headers.get('x-bridge-token') || req.nextUrl.searchParams.get('token')

    if (token) {
      userId = await validateBridgeToken(token)
    } else {
      const session = await getServerSession(authOptions)
      userId = session?.user?.id || null
    }

    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { type } = body

    if (type === 'command_result') {
      const { commandId, success, result, screenshotUrl, error: cmdError, duration } = body
      await prisma.browserCommand.update({
        where: { id: commandId },
        data: {
          status: success ? 'completed' : 'failed',
          result: result || null,
          screenshotUrl: screenshotUrl || null,
          error: cmdError || null,
          duration: duration || null,
          completedAt: new Date(),
        },
      })

      // Update session URL if goto command succeeded
      const cmd = await prisma.browserCommand.findUnique({
        where: { id: commandId },
        select: { sessionId: true, type: true, params: true },
      })
      if (cmd && success) {
        const updateData: Record<string, any> = {}
        if (cmd.type === 'goto' && (cmd.params as any)?.url) {
          updateData.currentUrl = (cmd.params as any).url
        }
        if (screenshotUrl) {
          updateData.lastScreenshot = screenshotUrl
        }
        if (Object.keys(updateData).length > 0) {
          await prisma.browserSession.update({
            where: { id: cmd.sessionId },
            data: updateData,
          })
        }
      }

      return NextResponse.json({ ok: true })
    }

    if (type === 'heartbeat') {
      // Just update the arm connection timestamp
      await prisma.armConnection.upsert({
        where: { userId_armType: { userId, armType: 'browser_automation' } },
        update: { status: 'connected', updatedAt: new Date() },
        create: {
          userId, armType: 'browser_automation', name: 'Browser Automation',
          status: 'connected', credentials: JSON.stringify({ autoDetected: true }),
          connectedAt: new Date(),
        },
      })
      return NextResponse.json({ ok: true, timestamp: new Date().toISOString() })
    }

    if (type === 'screenshot') {
      const { sessionId, screenshotUrl, currentUrl } = body
      if (sessionId) {
        await prisma.browserSession.update({
          where: { id: sessionId },
          data: {
            lastScreenshot: screenshotUrl || null,
            currentUrl: currentUrl || undefined,
          },
        })
      }
      return NextResponse.json({ ok: true })
    }

    // Recording: Bridge sends captured user actions
    if (type === 'recording') {
      const { sessionId, steps } = body
      if (sessionId && Array.isArray(steps) && steps.length > 0) {
        // Store recording in session metadata
        await prisma.browserSession.update({
          where: { id: sessionId },
          data: {
            metadata: { recording: steps, recordedAt: new Date().toISOString() },
          },
        })
      }
      return NextResponse.json({ ok: true, steps: steps?.length || 0 })
    }

    return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
  } catch (error) {
    console.error('Browser Bridge POST error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
