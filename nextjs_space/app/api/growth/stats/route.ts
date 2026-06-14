import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const uid = session.user.id

    const [total, byStatus, byTier, byCategory, pendingActions, cities, recentLeads, totalActions, executedActions, totalMessages, outboundMessages] = await Promise.all([
      prisma.growthLead.count({ where: { userId: uid } }),
      prisma.growthLead.groupBy({ by: ['status'], where: { userId: uid }, _count: true }),
      prisma.growthLead.groupBy({ by: ['leadTier'], where: { userId: uid }, _count: true }),
      prisma.growthLead.groupBy({ by: ['emailCategory'], where: { userId: uid, emailCategory: { not: null } }, _count: true }),
      prisma.growthAction.count({ where: { userId: uid, status: 'pending' } }),
      prisma.growthLead.groupBy({ by: ['city'], where: { userId: uid, city: { not: null } }, _count: true, orderBy: { _count: { city: 'desc' } }, take: 10 }),
      prisma.growthLead.findMany({ where: { userId: uid }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, businessName: true, city: true, status: true, qualificationScore: true, createdAt: true } }),
      prisma.growthAction.count({ where: { userId: uid } }),
      prisma.growthAction.count({ where: { userId: uid, status: 'executed' } }),
      prisma.growthMessage.count({ where: { userId: uid } }),
      prisma.growthMessage.count({ where: { userId: uid, direction: 'outbound' } }),
    ])

    const statusMap: Record<string, number> = {}
    byStatus.forEach(s => { statusMap[s.status] = s._count })
    const tierMap: Record<string, number> = {}
    byTier.forEach(t => { tierMap[t.leadTier] = t._count })
    const catMap: Record<string, number> = {}
    byCategory.forEach(c => { if (c.emailCategory) catMap[c.emailCategory] = c._count })
    const cityList = cities.map(c => ({ city: c.city, count: c._count }))

    // Phase 2 enhanced stats
    const contacted = statusMap['contacted'] || 0
    const replied = statusMap['replied'] || 0
    const converted = statusMap['converted'] || 0
    const contactRate = total > 0 ? Math.round((contacted + replied + converted) / total * 100) : 0
    const responseRate = (contacted + replied + converted) > 0 ? Math.round((replied + converted) / (contacted + replied + converted) * 100) : 0
    const conversionRate = total > 0 ? Math.round(converted / total * 100) : 0

    return NextResponse.json({
      total,
      pipeline: statusMap,
      tiers: tierMap,
      emailCategories: catMap,
      pendingActions,
      topCities: cityList,
      recentLeads,
      // Phase 2 stats
      totalActions,
      executedActions,
      totalMessages,
      outboundMessages,
      inboundMessages: totalMessages - outboundMessages,
      contactRate,
      responseRate,
      conversionRate,
      emailsSent: executedActions,
    })
  } catch (error) {
    console.error('Error fetching growth stats:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
