export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { showWatermark: true, planId: true },
    })
    return NextResponse.json({
      showWatermark: user?.showWatermark ?? true,
      planId: user?.planId ?? 'starter',
    })
  } catch (error) {
    console.error('Error fetching watermark settings:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const { showWatermark } = await request.json()
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { planId: true },
    })
    // Free users cannot disable watermark
    if ((user?.planId === 'starter') && showWatermark === false) {
      return NextResponse.json(
        { error: 'Upgrade tu plan para desactivar la marca de agua', requiresUpgrade: true },
        { status: 403 }
      )
    }
    const updated = await prisma.user.update({
      where: { email: session.user.email },
      data: { showWatermark: Boolean(showWatermark) },
      select: { showWatermark: true },
    })
    return NextResponse.json({ showWatermark: updated.showWatermark })
  } catch (error) {
    console.error('Error updating watermark settings:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
