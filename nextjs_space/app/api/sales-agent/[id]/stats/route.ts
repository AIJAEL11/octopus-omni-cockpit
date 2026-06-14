import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = params
    const agent = await prisma.salesAgent.findUnique({
      where: { id },
      include: {
        chatLogs: {
          orderBy: { updatedAt: 'desc' },
          take: 20,
          select: {
            id: true,
            visitorId: true,
            visitorName: true,
            visitorEmail: true,
            status: true,
            messages: true,
            createdAt: true,
            updatedAt: true,
          }
        },
        _count: { select: { chatLogs: true } }
      }
    })

    if (!agent) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    return NextResponse.json({
      conversations: agent.conversations,
      conversions: agent.conversions,
      totalChats: agent._count.chatLogs,
      recentChats: agent.chatLogs,
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
