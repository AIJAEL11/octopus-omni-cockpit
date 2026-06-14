import { NextResponse } from 'next/server'
import { isAdminSession } from '@/lib/admin-guard'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { isAdmin, session } = await isAdminSession()
    if (!isAdmin || !session) {
      return NextResponse.json({ error: 'Acceso denegado — Solo administradores' }, { status: 403 })
    }

    // === BATCHED DATA FETCH (max ~5 parallel to avoid connection pool exhaustion) ===
    
    // Batch 1: Users + core counts
    const [totalUsers, users, totalProjects, totalSessions, totalMessages] = await Promise.all([
      prisma.user.count(),
      prisma.user.findMany({
        select: {
          id: true, name: true, email: true, image: true, createdAt: true, updatedAt: true,
          planId: true, turboEnabled: true, turboModel: true, elevenLabsEnabled: true,
          _count: { select: { Project: true, ChatSession: true, CreativeAsset: true, GrowthLead: true, GrowthInsight: true, ApiKey: true, ArmConnection: true, SmartDevice: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.project.count(),
      prisma.chatSession.count(),
      prisma.chatMessage.count(),
    ])

    // Batch 2: Growth + creative counts
    const [totalLeads, totalActions, totalCreativeAssets, totalArmConnections, totalApiKeys] = await Promise.all([
      prisma.growthLead.count(),
      prisma.growthAction.count(),
      prisma.creativeAsset.count(),
      prisma.armConnection.count(),
      prisma.apiKey.count(),
    ])

    // Batch 3: RAG + IoT counts
    const [totalSmartDevices, totalSemanticMemories, totalGraphEntities, totalGraphRelations, totalSemanticVectors] = await Promise.all([
      prisma.smartDevice.count(),
      prisma.semanticMemory.count(),
      prisma.graphEntity.count(),
      prisma.graphRelation.count(),
      prisma.semanticVector.count(),
    ])

    // Batch 4: Remaining counts + recent activity
    const [totalKnowledgeDocs, totalQueryHistory, recentMessages, recentSessions] = await Promise.all([
      prisma.knowledgeDocument.count(),
      prisma.queryHistory.count(),
      prisma.chatMessage.findMany({
        select: { id: true, role: true, content: true, createdAt: true, session: { select: { userId: true, User: { select: { name: true, email: true } } } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.chatSession.findMany({
        select: { id: true, title: true, status: true, createdAt: true, updatedAt: true, User: { select: { name: true, email: true } }, _count: { select: { messages: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 15,
      }),
    ])

    // Batch 5: Growth details
    const [recentLeads, recentActions, pendingActions, completedActions, leadsByStatus] = await Promise.all([
      prisma.growthLead.findMany({
        select: { id: true, businessName: true, status: true, priority: true, city: true, createdAt: true, User: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 15,
      }),
      prisma.growthAction.findMany({
        select: { id: true, actionType: true, title: true, status: true, createdAt: true, User: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 15,
      }),
      prisma.growthAction.count({ where: { status: 'pending' } }),
      prisma.growthAction.count({ where: { status: 'completed' } }),
      prisma.growthLead.groupBy({ by: ['status'], _count: true }),
    ])

    // Batch 6: Extended module counts
    const [
      totalSocialPosts, totalSocialConnections, totalExtensionSessions,
      totalSalesAgents, totalSalesChats, totalSalesLeads,
      totalInvoices, totalCalendarEvents, totalBookingConfigs, totalWorkspaces
    ] = await Promise.all([
      prisma.socialPost.count(),
      prisma.socialConnection.count(),
      prisma.extensionSession.count(),
      prisma.salesAgent.count(),
      prisma.salesChat.count(),
      prisma.salesAgentLead.count(),
      prisma.invoice.count(),
      prisma.calendarEvent.count(),
      prisma.bookingConfig.count(),
      prisma.workspace.count(),
    ])

    // Batch 7: Social Bridge + Sales details
    const [publishedPosts, activeSalesAgents, paidInvoices, hotSalesLeads] = await Promise.all([
      prisma.socialPost.count({ where: { status: 'published' } }),
      prisma.salesAgent.count({ where: { isActive: true } }),
      prisma.invoice.count({ where: { status: 'paid' } }),
      prisma.salesAgentLead.count({ where: { buyingSignal: 'hot' } }),
    ])

    // Batch 8: Code Engine + Octopus Hosting
    const [totalCodeSessions, totalHostedSites, activeHostedSites, totalHostedViews, totalHostedSnapshots, customDomainSites] = await Promise.all([
      prisma.codeSession.count(),
      prisma.hostedSite.count(),
      prisma.hostedSite.count({ where: { status: 'active' } }),
      prisma.hostedSiteView.count(),
      prisma.hostedSiteSnapshot.count(),
      prisma.hostedSite.count({ where: { NOT: { customDomain: null } } }),
    ])

    const growthStats = { totalLeads, totalActions, pendingActions, completedActions, leadsByStatus }
    const ragStats = { totalSemanticMemories, totalGraphEntities, totalGraphRelations, totalSemanticVectors, totalKnowledgeDocs, totalQueryHistory }

    const moduleStats = {
      socialBridge: { totalPosts: totalSocialPosts, publishedPosts, connections: totalSocialConnections, extensions: totalExtensionSessions },
      salesAgent: { totalAgents: totalSalesAgents, activeAgents: activeSalesAgents, chats: totalSalesChats, leads: totalSalesLeads, hotLeads: hotSalesLeads },
      invoices: { total: totalInvoices, paid: paidInvoices },
      calendar: { events: totalCalendarEvents, bookingConfigs: totalBookingConfigs },
      workspaces: { total: totalWorkspaces },
      codeEngine: { sessions: totalCodeSessions, hostedSites: totalHostedSites, activeSites: activeHostedSites, views: totalHostedViews, snapshots: totalHostedSnapshots, customDomains: customDomainSites },
    }

    return NextResponse.json({
      overview: {
        totalUsers,
        totalProjects,
        totalSessions,
        totalMessages,
        totalCreativeAssets,
        totalArmConnections,
        totalApiKeys,
        totalSmartDevices,
      },
      users,
      growthStats,
      ragStats,
      moduleStats,
      recentActivity: {
        messages: recentMessages.map((m: any) => ({
          ...m,
          content: m.content.substring(0, 150) + (m.content.length > 150 ? '...' : ''),
        })),
        sessions: recentSessions,
        leads: recentLeads,
        actions: recentActions,
      },
    })
  } catch (error) {
    console.error('[Admin API] Error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
