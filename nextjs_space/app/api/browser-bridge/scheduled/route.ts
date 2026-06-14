import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET — List scheduled tasks for user
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const tasks = await prisma.scheduledBrowserTask.findMany({
      where: { userId: session.user.id },
      include: { template: { select: { id: true, name: true, category: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ tasks })
  } catch (e: any) {
    console.error('[Scheduled GET]', e.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST — Create, update, delete, toggle, or trigger scheduled tasks
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { action } = body

    // ── CREATE ──
    if (action === 'create') {
      const { templateId, name, schedule, variables } = body
      if (!templateId || !name || !schedule) {
        return NextResponse.json({ error: 'templateId, name, and schedule required' }, { status: 400 })
      }

      const template = await prisma.browserTemplate.findFirst({
        where: { id: templateId, userId: session.user.id },
      })
      if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

      const nextRun = calculateNextRun(schedule)

      const task = await prisma.scheduledBrowserTask.create({
        data: {
          userId: session.user.id,
          templateId,
          name,
          schedule,
          variables: variables || null,
          status: 'active',
          nextRun,
        },
        include: { template: { select: { id: true, name: true, category: true } } },
      })

      return NextResponse.json({ task })
    }

    // ── UPDATE ──
    if (action === 'update') {
      const { id, name, schedule, variables, status } = body
      if (!id) return NextResponse.json({ error: 'Task ID required' }, { status: 400 })

      const existing = await prisma.scheduledBrowserTask.findFirst({
        where: { id, userId: session.user.id },
      })
      if (!existing) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

      const updateData: Record<string, any> = {}
      if (name) updateData.name = name
      if (schedule) {
        updateData.schedule = schedule
        updateData.nextRun = calculateNextRun(schedule)
      }
      if (variables !== undefined) updateData.variables = variables
      if (status) updateData.status = status

      const task = await prisma.scheduledBrowserTask.update({
        where: { id },
        data: updateData,
        include: { template: { select: { id: true, name: true, category: true } } },
      })

      return NextResponse.json({ task })
    }

    // ── TOGGLE (pause/resume) ──
    if (action === 'toggle') {
      const { id } = body
      if (!id) return NextResponse.json({ error: 'Task ID required' }, { status: 400 })

      const existing = await prisma.scheduledBrowserTask.findFirst({
        where: { id, userId: session.user.id },
      })
      if (!existing) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

      const newStatus = existing.status === 'active' ? 'paused' : 'active'
      const task = await prisma.scheduledBrowserTask.update({
        where: { id },
        data: {
          status: newStatus,
          nextRun: newStatus === 'active' ? calculateNextRun(existing.schedule) : null,
        },
        include: { template: { select: { id: true, name: true, category: true } } },
      })

      return NextResponse.json({ task })
    }

    // ── DELETE ──
    if (action === 'delete') {
      const { id } = body
      if (!id) return NextResponse.json({ error: 'Task ID required' }, { status: 400 })

      await prisma.scheduledBrowserTask.deleteMany({
        where: { id, userId: session.user.id },
      })

      return NextResponse.json({ success: true })
    }

    // ── TRIGGER NOW (manual run) ──
    if (action === 'trigger') {
      const { id } = body
      if (!id) return NextResponse.json({ error: 'Task ID required' }, { status: 400 })

      const task = await prisma.scheduledBrowserTask.findFirst({
        where: { id, userId: session.user.id },
        include: { template: true },
      })
      if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

      // Execute the template by creating a session + commands
      const result = await executeScheduledTemplate(session.user.id, task.template, task.variables as Record<string, string> | null)

      await prisma.scheduledBrowserTask.update({
        where: { id },
        data: {
          lastRun: new Date(),
          runCount: { increment: 1 },
          lastResult: result.success ? 'ok' : result.error || 'failed',
          nextRun: task.status === 'active' ? calculateNextRun(task.schedule) : null,
        },
      })

      return NextResponse.json({ result })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    console.error('[Scheduled POST]', e.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// ── Execute a template by creating a session and queuing commands ──
async function executeScheduledTemplate(
  userId: string,
  template: any,
  variables: Record<string, string> | null
) {
  try {
    // Create a temp session
    const browserSession = await prisma.browserSession.create({
      data: {
        userId,
        name: `[Scheduled] ${template.name}`,
        status: 'running',
      },
    })

    const steps = template.steps as Array<{ type: string; [k: string]: any }>
    const vars = variables || {}

    // Resolve variables
    const resolveVars = (val: any): any => {
      if (typeof val === 'string') {
        return val.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? `{{${k}}}`)
      }
      if (Array.isArray(val)) return val.map(resolveVars)
      if (val && typeof val === 'object') {
        return Object.fromEntries(Object.entries(val).map(([k, v]) => [k, resolveVars(v)]))
      }
      return val
    }

    const resolvedSteps = steps.map(resolveVars)

    // Create commands
    for (const step of resolvedSteps) {
      await prisma.browserCommand.create({
        data: {
          userId,
          sessionId: browserSession.id,
          type: step.type || 'goto',
          params: step as any,
          status: 'pending',
        },
      })
    }

    // Update template stats
    await prisma.browserTemplate.update({
      where: { id: template.id },
      data: { lastUsed: new Date(), useCount: { increment: 1 } },
    })

    return { success: true, sessionId: browserSession.id, commandCount: resolvedSteps.length }
  } catch (e: any) {
    console.error('[Scheduled Execute]', e.message)
    return { success: false, error: e.message }
  }
}

// ── Calculate next run from schedule string ──
function calculateNextRun(schedule: string): Date {
  const now = new Date()

  // Simple interval patterns: "every 30m", "every 2h", "every 1d"
  const intervalMatch = schedule.match(/^every\s+(\d+)\s*(m|min|h|hour|d|day)s?$/i)
  if (intervalMatch) {
    const val = parseInt(intervalMatch[1])
    const unit = intervalMatch[2].toLowerCase()
    const ms =
      unit.startsWith('m') ? val * 60 * 1000 :
      unit.startsWith('h') ? val * 60 * 60 * 1000 :
      val * 24 * 60 * 60 * 1000
    return new Date(now.getTime() + ms)
  }

  // Daily at HH:MM: "daily 09:00"
  const dailyMatch = schedule.match(/^daily\s+(\d{1,2}):(\d{2})$/i)
  if (dailyMatch) {
    const h = parseInt(dailyMatch[1])
    const m = parseInt(dailyMatch[2])
    const next = new Date(now)
    next.setHours(h, m, 0, 0)
    if (next <= now) next.setDate(next.getDate() + 1)
    return next
  }

  // "once" — run immediately
  if (schedule.toLowerCase() === 'once') {
    return new Date(now.getTime() + 5000) // 5 seconds from now
  }

  // Default: 1 hour from now
  return new Date(now.getTime() + 60 * 60 * 1000)
}
