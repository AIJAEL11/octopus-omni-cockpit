import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET — Obtener acciones (pending + recientes)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const url = new URL(req.url)
    const status = url.searchParams.get('status')

    const where: Record<string, unknown> = { userId: session.user.id }
    if (status) where.status = status

    const actions = await prisma.growthAction.findMany({
      where: where as any,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { lead: { select: { id: true, businessName: true, email: true, city: true, emailCategory: true } } },
    })

    return NextResponse.json({ actions })
  } catch (error) {
    console.error('Error fetching actions:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
