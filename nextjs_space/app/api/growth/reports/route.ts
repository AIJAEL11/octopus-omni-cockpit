import { callLLM } from '@/lib/turbo-llm'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/growth/reports
 * Generate AI daily report for Growth Engine activity.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const userId = session.user.id
    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // Today's activity
    const [todayActions, todayMessages, totalLeads, pipelineCounts, recentReplies] = await Promise.all([
      prisma.growthAction.count({ where: { userId, createdAt: { gte: yesterday } } }),
      prisma.growthMessage.count({ where: { userId, createdAt: { gte: yesterday } } }),
      prisma.growthLead.count({ where: { userId } }),
      prisma.growthLead.groupBy({ by: ['status'], where: { userId }, _count: { id: true } }),
      prisma.growthMessage.findMany({
        where: { userId, direction: 'inbound', createdAt: { gte: lastWeek } },
        include: { lead: { select: { businessName: true, replyClassification: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ])

    const pipeline: Record<string, number> = {}
    for (const p of pipelineCounts) { pipeline[p.status] = p._count.id }

    // Hot leads (high score + replied/interested)
    const hotLeads = await prisma.growthLead.findMany({
      where: {
        userId,
        OR: [
          { status: 'replied', replyClassification: 'interested' },
          { qualificationScore: { gte: 70 }, status: { in: ['replied', 'contacted'] } },
        ],
      },
      orderBy: { qualificationScore: 'desc' },
      take: 5,
    })

    // Generate AI report
    let aiReport = ''
    try {
      const apiKey = process.env.ABACUSAI_API_KEY
      if (apiKey) {
        const reportData = {
          fecha: now.toLocaleDateString('es-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
          actividadHoy: { acciones: todayActions, mensajes: todayMessages },
          pipeline,
          totalLeads,
          respuestasRecientes: recentReplies.map(r => ({
            negocio: r.lead?.businessName,
            clasificacion: r.lead?.replyClassification,
            preview: r.content?.substring(0, 100),
          })),
          leadsCalientes: hotLeads.map(l => ({
            nombre: l.businessName,
            tipo: l.businessType,
            ciudad: l.city,
            score: l.qualificationScore,
            clasificacion: l.replyClassification,
          })),
        }

        const data = await callLLM(userId, [{
          role: 'user',
          content: `Eres OCTOPUS, el AI Growth Engine de OctopusSkills. Genera un reporte diario ejecutivo en español para el usuario.

Datos: ${JSON.stringify(reportData)}

Formato del reporte:
🐙 REPORTE DIARIO GROWTH ENGINE
📅 [Fecha]

📊 RESUMEN:
[2-3 frases sobre actividad del día]

🔥 LEADS CALIENTES:
[Lista de leads prioritarios con acción sugerida]

📬 RESPUESTAS RECIENTES:
[Resumen de respuestas y qué significan]

⚡ RECOMENDACIONES:
[2-3 acciones específicas para mañana]

🎯 SCORE DEL DÍA: [X/10]

Sé conciso, directo, y accionable. Máximo 300 palabras.`,
        }], { model: 'gpt-4.1-mini', temperature: 0.6, maxTokens: 500 })
        aiReport = data.choices?.[0]?.message?.content || ''
      }
    } catch (e) {
      console.error('[Growth Report] AI error:', e)
    }

    return NextResponse.json({
      report: aiReport,
      metrics: {
        todayActions,
        todayMessages,
        totalLeads,
        pipeline,
        hotLeads: hotLeads.map(l => ({
          id: l.id,
          businessName: l.businessName,
          businessType: l.businessType,
          city: l.city,
          score: l.qualificationScore,
          tier: l.leadTier,
          status: l.status,
          replyClassification: l.replyClassification,
        })),
        recentReplies: recentReplies.map(r => ({
          id: r.id,
          leadName: r.lead?.businessName,
          classification: r.lead?.replyClassification,
          subject: r.subject,
          preview: r.content?.substring(0, 150),
          date: r.createdAt,
        })),
      },
    })
  } catch (error: any) {
    console.error('[Growth Reports] Error:', error)
    return NextResponse.json({ error: error.message || 'Error del servidor' }, { status: 500 })
  }
}
