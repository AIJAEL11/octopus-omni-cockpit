export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const uid = user.id
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(todayStart)
    weekStart.setDate(weekStart.getDate() - 7)

    // Batch 1: Growth Engine core (6 queries)
    const [totalLeads, leadsToday, leadsThisWeek, leadsByStatus, leadsByTier, hotLeads] = await Promise.all([
      prisma.growthLead.count({ where: { userId: uid } }),
      prisma.growthLead.count({ where: { userId: uid, createdAt: { gte: todayStart } } }),
      prisma.growthLead.count({ where: { userId: uid, createdAt: { gte: weekStart } } }),
      prisma.growthLead.groupBy({ by: ['status'], where: { userId: uid }, _count: true }),
      prisma.growthLead.groupBy({ by: ['leadTier'], where: { userId: uid }, _count: true }),
      prisma.growthLead.count({ where: { userId: uid, priority: 'high' } }),
    ])

    // Batch 2: Sales + Creative (8 queries)
    const [salesAgents, activeSalesAgents, salesChatsTotal, salesChatsToday, salesAgentLeads, salesAgentLeadsHot, creativeAssets, creativesToday] = await Promise.all([
      prisma.salesAgent.count({ where: { userId: uid } }),
      prisma.salesAgent.count({ where: { userId: uid, isActive: true } }),
      prisma.salesChat.count({ where: { agent: { userId: uid } } }),
      prisma.salesChat.count({ where: { agent: { userId: uid }, createdAt: { gte: todayStart } } }),
      prisma.salesAgentLead.count({ where: { userId: uid } }),
      prisma.salesAgentLead.count({ where: { userId: uid, buyingSignal: 'hot' } }),
      prisma.creativeAsset.count({ where: { userId: uid } }),
      prisma.creativeAsset.count({ where: { userId: uid, createdAt: { gte: todayStart } } }),
    ])

    // Batch 3: Platform + Outreach + Recent (8 queries)
    const [projects, connections, smartDevices, knowledgeDocs, outreachSent, outreachReplied, leadsConverted, leadsBySource] = await Promise.all([
      prisma.project.count({ where: { userId: uid } }),
      prisma.armConnection.count({ where: { userId: uid, status: 'connected' } }),
      prisma.smartDevice.count({ where: { userId: uid } }),
      prisma.knowledgeDocument.count({ where: { userId: uid } }),
      prisma.growthAction.count({ where: { lead: { userId: uid }, actionType: 'email' } }),
      prisma.growthLead.count({ where: { userId: uid, status: 'replied' } }),
      prisma.growthLead.count({ where: { userId: uid, status: 'converted' } }),
      prisma.salesAgentLead.groupBy({ by: ['source'], where: { userId: uid }, _count: true }),
    ])

    // Batch 4: Recent items (2 queries)
    const [recentLeads, recentAgentLeads] = await Promise.all([
      prisma.growthLead.findMany({
        where: { userId: uid },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, businessName: true, leadTier: true, status: true, city: true, createdAt: true, email: true }
      }),
      prisma.salesAgentLead.findMany({
        where: { userId: uid },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, visitorName: true, visitorEmail: true, source: true, buyingSignal: true, status: true, createdAt: true, agent: { select: { name: true } } }
      }),
    ])

    // Calculate conversion rate
    const conversionRate = totalLeads > 0 ? ((leadsConverted / totalLeads) * 100).toFixed(1) : '0'
    const replyRate = outreachSent > 0 ? ((outreachReplied / outreachSent) * 100).toFixed(1) : '0'

    // Build status map
    const statusMap: Record<string, number> = {}
    leadsByStatus.forEach((s: any) => { statusMap[s.status] = s._count })
    
    const tierMap: Record<string, number> = {}
    leadsByTier.forEach((t: any) => { tierMap[t.leadTier] = t._count })

    const sourceMap: Record<string, number> = {}
    leadsBySource.forEach((s: any) => { sourceMap[s.source] = s._count })

    return NextResponse.json({
      // Growth Engine
      growth: {
        totalLeads,
        leadsToday,
        leadsThisWeek,
        hotLeads,
        conversionRate: parseFloat(conversionRate),
        replyRate: parseFloat(replyRate),
        outreachSent,
        statusBreakdown: statusMap,
        tierBreakdown: tierMap,
        converted: leadsConverted,
        replied: outreachReplied,
      },
      // Sales Agent
      sales: {
        totalAgents: salesAgents,
        activeAgents: activeSalesAgents,
        totalChats: salesChatsTotal,
        chatsToday: salesChatsToday,
        capturedLeads: salesAgentLeads,
        hotLeads: salesAgentLeadsHot,
        sourceBreakdown: sourceMap,
      },
      // Creative
      creative: {
        totalAssets: creativeAssets,
        assetsToday: creativesToday,
      },
      // Platform
      platform: {
        projects,
        connections,
        smartDevices,
        knowledgeDocs,
      },
      // Recent activity
      recentLeads,
      recentAgentLeads,
    })
  } catch (error) {
    console.error('KPIs error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
