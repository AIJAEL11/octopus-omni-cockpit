import { callLLM } from '@/lib/turbo-llm'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/growth/insights
 * Compute and return Growth Engine learning insights:
 * - Which email categories convert best
 * - Which business types respond most
 * - Best time to send
 * - Conversion patterns
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const userId = session.user.id

    // Get all leads with their messages
    const leads = await prisma.growthLead.findMany({
      where: { userId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        actions: { where: { status: { in: ['executed', 'approved'] } } },
      },
    })

    // --- Email Category Performance ---
    const catPerf: Record<string, { sent: number; replied: number; converted: number }> = {}
    for (const l of leads) {
      const cat = l.emailCategory || 'B'
      if (!catPerf[cat]) catPerf[cat] = { sent: 0, replied: 0, converted: 0 }
      if (l.status !== 'new') catPerf[cat].sent++
      if (['replied', 'converted'].includes(l.status)) catPerf[cat].replied++
      if (l.status === 'converted') catPerf[cat].converted++
    }

    // --- Business Type Performance ---
    const typePerf: Record<string, { total: number; contacted: number; replied: number; converted: number }> = {}
    for (const l of leads) {
      const t = l.businessType || 'other'
      if (!typePerf[t]) typePerf[t] = { total: 0, contacted: 0, replied: 0, converted: 0 }
      typePerf[t].total++
      if (l.status !== 'new') typePerf[t].contacted++
      if (['replied', 'converted'].includes(l.status)) typePerf[t].replied++
      if (l.status === 'converted') typePerf[t].converted++
    }

    // --- Tier Performance ---
    const tierPerf: Record<string, { total: number; replied: number; converted: number }> = {}
    for (const l of leads) {
      const tier = l.leadTier || 'diamond'
      if (!tierPerf[tier]) tierPerf[tier] = { total: 0, replied: 0, converted: 0 }
      tierPerf[tier].total++
      if (['replied', 'converted'].includes(l.status)) tierPerf[tier].replied++
      if (l.status === 'converted') tierPerf[tier].converted++
    }

    // --- Reply Classification Distribution ---
    const classificationDist: Record<string, number> = {}
    for (const l of leads) {
      if (l.replyClassification) {
        classificationDist[l.replyClassification] = (classificationDist[l.replyClassification] || 0) + 1
      }
    }

    // --- Follow-up Effectiveness ---
    const followUpData = leads.filter(l => l.followUpCount > 0)
    const followUpReplied = followUpData.filter(l => ['replied', 'converted'].includes(l.status))
    const avgFollowUpsToReply = followUpReplied.length > 0
      ? Math.round(followUpReplied.reduce((s, l) => s + l.followUpCount, 0) / followUpReplied.length * 10) / 10
      : 0

    // --- Best Performing Leads (Elite Reality List) ---
    const eliteLeads = leads
      .filter(l => l.status === 'replied' || l.status === 'converted')
      .sort((a, b) => b.qualificationScore - a.qualificationScore)
      .slice(0, 10)
      .map(l => ({
        id: l.id,
        businessName: l.businessName,
        businessType: l.businessType,
        city: l.city,
        score: l.qualificationScore,
        tier: l.leadTier,
        status: l.status,
        replyClassification: l.replyClassification,
        followUpCount: l.followUpCount,
      }))

    // --- AI-Generated Summary ---
    let aiSummary = ''
    try {
      if (leads.length > 0) {
        const summaryData = {
          totalLeads: leads.length,
          contacted: leads.filter(l => l.status !== 'new').length,
          replied: leads.filter(l => ['replied', 'converted'].includes(l.status)).length,
          converted: leads.filter(l => l.status === 'converted').length,
          topCategory: Object.entries(catPerf).sort((a, b) => (b[1].replied / Math.max(b[1].sent, 1)) - (a[1].replied / Math.max(a[1].sent, 1)))[0]?.[0] || 'N/A',
          topType: Object.entries(typePerf).sort((a, b) => (b[1].replied / Math.max(b[1].contacted, 1)) - (a[1].replied / Math.max(a[1].contacted, 1)))[0]?.[0] || 'N/A',
          classificationDist,
        }

        const data = await callLLM(userId, [{
          role: 'user',
          content: `Eres el Growth Engine AI de OctopusSkills. Analiza estos datos y genera un resumen de insights en español (máximo 150 palabras). Sé directo y accionable.

Datos: ${JSON.stringify(summaryData)}

Categoria emails performance: ${JSON.stringify(catPerf)}
Tipo negocio performance: ${JSON.stringify(typePerf)}

Formato: Párrafo breve con las 3 lecciones más importantes y 1 recomendación de acción.`,
        }], { model: 'gpt-4.1-mini', temperature: 0.5, maxTokens: 300 })
        aiSummary = data.choices?.[0]?.message?.content || ''
      }
    } catch (e) {
      console.error('[Growth Insights] AI summary error:', e)
    }

    return NextResponse.json({
      emailCategoryPerformance: catPerf,
      businessTypePerformance: typePerf,
      tierPerformance: tierPerf,
      classificationDistribution: classificationDist,
      followUpStats: {
        leadsWithFollowUps: followUpData.length,
        followUpsThatGotReply: followUpReplied.length,
        avgFollowUpsToReply,
      },
      eliteLeads,
      aiSummary,
    })
  } catch (error: any) {
    console.error('[Growth Insights] Error:', error)
    return NextResponse.json({ error: error.message || 'Error del servidor' }, { status: 500 })
  }
}
