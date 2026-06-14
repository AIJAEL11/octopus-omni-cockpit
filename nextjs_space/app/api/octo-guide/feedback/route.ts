import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Update message feedback
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const { messageId, helpful, resolved } = body

    if (!messageId) {
      return NextResponse.json({ error: 'messageId requerido' }, { status: 400 })
    }

    const message = await prisma.octoGuideMessage.update({
      where: { id: messageId },
      data: {
        helpful: helpful ?? undefined,
        resolved: resolved ?? undefined,
      }
    })

    // Update analytics if we have both helpful and resolved
    if (helpful !== undefined || resolved !== undefined) {
      const analytics = await prisma.octoGuideAnalytics.findFirst({
        where: {
          module: message.module || 'general',
          createdAt: { gte: new Date(Date.now() - 60000) } // Last minute
        },
        orderBy: { createdAt: 'desc' }
      })

      if (analytics) {
        await prisma.octoGuideAnalytics.update({
          where: { id: analytics.id },
          data: {
            wasHelpful: helpful ?? analytics.wasHelpful,
            wasResolved: resolved ?? analytics.wasResolved,
          }
        })
      }
    }

    return NextResponse.json({ success: true, message })

  } catch (error) {
    console.error('[ASK Octo AI Feedback] Error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
