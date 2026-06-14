import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function validateCronSecret(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  return token === cronSecret
}

export async function GET(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()

    // Find tasks due to run
    const dueTasks = await prisma.scheduledBrowserTask.findMany({
      where: {
        status: 'active',
        nextRun: { lte: now },
      },
      include: { template: true },
      take: 10, // Batch limit
    })

    if (dueTasks.length === 0) {
      return NextResponse.json({ message: 'No tasks due', checked: now.toISOString() })
    }

    console.log(`[Browser Cron] ${dueTasks.length} tasks due`)
    const results: { taskId: string; name: string; success: boolean; error?: string }[] = []

    for (const task of dueTasks) {
      try {
        const steps = task.template.steps as Array<{ type: string; [k: string]: any }>
        const vars = (task.variables || {}) as Record<string, string>

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

        // Create session
        const browserSession = await prisma.browserSession.create({
          data: {
            userId: task.userId,
            name: `[Cron] ${task.name}`,
            status: 'running',
          },
        })

        // Create commands
        for (const step of resolvedSteps) {
          await prisma.browserCommand.create({
            data: {
              userId: task.userId,
              sessionId: browserSession.id,
              type: step.type || 'goto',
              params: step as any,
              status: 'pending',
            },
          })
        }

        // Update template stats
        await prisma.browserTemplate.update({
          where: { id: task.templateId },
          data: { lastUsed: new Date(), useCount: { increment: 1 } },
        })

        // Calculate next run
        const nextRun = calculateNextRun(task.schedule)
        const isOneTime = task.schedule.toLowerCase() === 'once'

        await prisma.scheduledBrowserTask.update({
          where: { id: task.id },
          data: {
            lastRun: now,
            runCount: { increment: 1 },
            lastResult: 'ok',
            nextRun: isOneTime ? null : nextRun,
            status: isOneTime ? 'completed' : 'active',
          },
        })

        results.push({ taskId: task.id, name: task.name, success: true })
        console.log(`[Browser Cron] ✅ ${task.name} → session ${browserSession.id}`)
      } catch (err: any) {
        console.error(`[Browser Cron] ❌ ${task.name}:`, err.message)
        await prisma.scheduledBrowserTask.update({
          where: { id: task.id },
          data: { lastResult: err.message, lastRun: now },
        }).catch(() => {})
        results.push({ taskId: task.id, name: task.name, success: false, error: err.message })
      }
    }

    return NextResponse.json({ executed: results.length, results })
  } catch (error: any) {
    console.error('[Browser Cron] Error:', error.message)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

function calculateNextRun(schedule: string): Date {
  const now = new Date()
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
  const dailyMatch = schedule.match(/^daily\s+(\d{1,2}):(\d{2})$/i)
  if (dailyMatch) {
    const h = parseInt(dailyMatch[1])
    const m = parseInt(dailyMatch[2])
    const next = new Date(now)
    next.setHours(h, m, 0, 0)
    if (next <= now) next.setDate(next.getDate() + 1)
    return next
  }
  return new Date(now.getTime() + 60 * 60 * 1000)
}
