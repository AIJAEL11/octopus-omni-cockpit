import { NextResponse } from 'next/server'
import { isAdminSession } from '@/lib/admin-guard'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { isAdmin } = await isAdminSession()
    if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Batch 1: Users with dates + messages with dates
    const [users, messages, sessions] = await Promise.all([
      prisma.user.findMany({
        select: { createdAt: true, updatedAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.chatMessage.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.chatSession.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { createdAt: true, updatedAt: true, _count: { select: { messages: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    ])

    // Batch 2: Creative assets + growth leads + devices
    const [assets, leads, devices] = await Promise.all([
      prisma.creativeAsset.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { createdAt: true, type: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.growthLead.findMany({
        select: { createdAt: true, status: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.smartDevice.findMany({
        select: { createdAt: true, platform: true, type: true },
      }),
    ])

    // === Build daily user growth (cumulative) ===
    const userGrowth: { date: string; total: number; new: number }[] = []
    const usersByDay = new Map<string, number>()
    for (const u of users) {
      const day = u.createdAt.toISOString().slice(0, 10)
      usersByDay.set(day, (usersByDay.get(day) || 0) + 1)
    }
    let cumulative = 0
    const sortedDays = [...usersByDay.keys()].sort()
    for (const day of sortedDays) {
      const newCount = usersByDay.get(day) || 0
      cumulative += newCount
      userGrowth.push({ date: day, total: cumulative, new: newCount })
    }

    // === Messages per day (last 30d) ===
    const msgsByDay = new Map<string, number>()
    for (const m of messages) {
      const day = m.createdAt.toISOString().slice(0, 10)
      msgsByDay.set(day, (msgsByDay.get(day) || 0) + 1)
    }
    const messagesPerDay = [...msgsByDay.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date))

    // === Module usage (session titles / types as proxy) ===
    const moduleUsage = {
      chat: sessions.length,
      assets: assets.length,
      growth: leads.length,
      devices: devices.length,
    }

    // === Asset types breakdown ===
    const assetTypes = new Map<string, number>()
    for (const a of assets) {
      assetTypes.set(a.type, (assetTypes.get(a.type) || 0) + 1)
    }
    const assetBreakdown = [...assetTypes.entries()].map(([type, count]) => ({ type, count }))

    // === Lead status breakdown ===
    const leadStatuses = new Map<string, number>()
    for (const l of leads) {
      leadStatuses.set(l.status, (leadStatuses.get(l.status) || 0) + 1)
    }
    const leadBreakdown = [...leadStatuses.entries()].map(([status, count]) => ({ status, count }))

    // === Active vs Inactive users ===
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const activeUsers = users.filter(u => u.updatedAt >= sevenDaysAgo).length
    const inactiveUsers = users.length - activeUsers

    // === Device platforms ===
    const devicePlatforms = new Map<string, number>()
    for (const d of devices) {
      devicePlatforms.set(d.platform, (devicePlatforms.get(d.platform) || 0) + 1)
    }
    const deviceBreakdown = [...devicePlatforms.entries()].map(([platform, count]) => ({ platform, count }))

    // === Sessions per day (last 30d) ===
    const sessionsByDay = new Map<string, number>()
    for (const s of sessions) {
      const day = s.createdAt.toISOString().slice(0, 10)
      sessionsByDay.set(day, (sessionsByDay.get(day) || 0) + 1)
    }
    const sessionsPerDay = [...sessionsByDay.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({
      userGrowth,
      messagesPerDay,
      sessionsPerDay,
      moduleUsage,
      assetBreakdown,
      leadBreakdown,
      deviceBreakdown,
      engagement: { active: activeUsers, inactive: inactiveUsers, total: users.length },
    })
  } catch (error) {
    console.error('[Admin Analytics] Error:', error)
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
