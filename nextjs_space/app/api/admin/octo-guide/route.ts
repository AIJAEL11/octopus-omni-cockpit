import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdminEmail } from '@/lib/admin-guard'

export const dynamic = 'force-dynamic'

// GET - Fetch ASK Octo AI analytics
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email || !isAdminEmail(session.user.email)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Get overall stats
    const [totalSessions, totalMessages, knowledgeCount] = await Promise.all([
      prisma.octoGuideSession.count(),
      prisma.octoGuideMessage.count(),
      prisma.octoKnowledge.count(),
    ])

    // Get feedback stats
    const [helpfulCount, notHelpfulCount, resolvedCount] = await Promise.all([
      prisma.octoGuideMessage.count({ where: { helpful: true, role: 'assistant' } }),
      prisma.octoGuideMessage.count({ where: { helpful: false, role: 'assistant' } }),
      prisma.octoGuideMessage.count({ where: { resolved: true, role: 'assistant' } }),
    ])

    // Get messages by module
    const messagesByModule = await prisma.octoGuideMessage.groupBy({
      by: ['module'],
      _count: { id: true },
      where: { role: 'user' },
    })

    // Get recent sessions with messages
    const recentSessions = await prisma.octoGuideSession.findMany({
      take: 20,
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    // Get user info for sessions
    const userIds = [...new Set(recentSessions.map(s => s.userId))]
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, image: true },
    })
    const userMap = new Map(users.map(u => [u.id, u]))

    // Get knowledge base articles
    const knowledgeArticles = await prisma.octoKnowledge.findMany({
      orderBy: { priority: 'desc' },
      select: {
        id: true,
        title: true,
        category: true,
        module: true,
        keywords: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    // Get learned patterns (successful Q&A pairs)
    const learnedPatterns = await prisma.octoGuideMessage.findMany({
      where: {
        role: 'assistant',
        helpful: true,
      },
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        session: {
          include: {
            messages: {
              where: { role: 'user' },
              orderBy: { createdAt: 'asc' },
              take: 1,
            },
          },
        },
      },
    })

    // Format learned patterns
    const patterns = learnedPatterns
      .filter(m => m.session?.messages?.[0])
      .map(m => ({
        id: m.id,
        question: m.session.messages[0].content,
        answer: m.content,
        module: m.module,
        createdAt: m.createdAt,
      }))

    // Get analytics over time (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const analyticsOverTime = await prisma.octoGuideAnalytics.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      orderBy: { createdAt: 'asc' },
    })

    // Calculate satisfaction rate
    const totalFeedback = helpfulCount + notHelpfulCount
    const satisfactionRate = totalFeedback > 0 
      ? Math.round((helpfulCount / totalFeedback) * 100) 
      : 0

    return NextResponse.json({
      success: true,
      stats: {
        totalSessions,
        totalMessages,
        knowledgeCount,
        helpfulCount,
        notHelpfulCount,
        resolvedCount,
        satisfactionRate,
        messagesByModule: messagesByModule.map(m => ({
          module: m.module || 'general',
          count: m._count.id,
        })),
      },
      recentSessions: recentSessions.map(s => ({
        id: s.id,
        user: userMap.get(s.userId) || null,
        context: s.context,
        messageCount: s.messages.length,
        lastMessage: s.messages[0]?.content?.slice(0, 100),
        updatedAt: s.updatedAt,
      })),
      knowledgeArticles,
      learnedPatterns: patterns,
      analyticsOverTime,
    })

  } catch (error) {
    console.error('[Admin ASK Octo] Error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// POST - Add or update knowledge article
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email || !isAdminEmail(session.user.email)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const { action, ...data } = body

    if (action === 'create_knowledge') {
      const article = await prisma.octoKnowledge.create({
        data: {
          title: data.title,
          content: data.content,
          category: data.category || 'general',
          module: data.module || 'general',
          keywords: data.keywords || [],
          examples: data.examples || [],
          priority: data.priority || 5,
        },
      })
      return NextResponse.json({ success: true, article })
    }

    if (action === 'update_knowledge') {
      const article = await prisma.octoKnowledge.update({
        where: { id: data.id },
        data: {
          title: data.title,
          content: data.content,
          category: data.category,
          module: data.module,
          keywords: data.keywords,
          examples: data.examples,
          priority: data.priority,
        },
      })
      return NextResponse.json({ success: true, article })
    }

    if (action === 'delete_knowledge') {
      await prisma.octoKnowledge.delete({ where: { id: data.id } })
      return NextResponse.json({ success: true })
    }

    if (action === 'promote_pattern') {
      // Convert a learned pattern into a knowledge article
      const pattern = await prisma.octoGuideMessage.findUnique({
        where: { id: data.patternId },
        include: {
          session: {
            include: {
              messages: { where: { role: 'user' }, take: 1, orderBy: { createdAt: 'asc' } },
            },
          },
        },
      })

      if (!pattern) {
        return NextResponse.json({ error: 'Patrón no encontrado' }, { status: 404 })
      }

      const question = pattern.session?.messages?.[0]?.content || 'Pregunta'
      const article = await prisma.octoKnowledge.create({
        data: {
          title: `FAQ: ${question.slice(0, 50)}...`,
          content: `**Pregunta:** ${question}\n\n**Respuesta:** ${pattern.content}`,
          category: 'faq',
          module: pattern.module || 'general',
          keywords: question.toLowerCase().split(' ').filter((w: string) => w.length > 3),
          examples: JSON.stringify([question]),
          priority: 7, // High priority for FAQs
        },
      })

      return NextResponse.json({ success: true, article })
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })

  } catch (error) {
    console.error('[Admin ASK Octo] Error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
