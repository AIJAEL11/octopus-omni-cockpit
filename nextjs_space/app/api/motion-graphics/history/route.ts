export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '1'), 10)

    const assets = await prisma.creativeAsset.findMany({
      where: {
        userId: session.user.id,
        format: 'motion-graphic',
        status: 'ready',
        content: { not: '' },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        content: true,
        prompt: true,
        title: true,
        metadata: true,
        createdAt: true,
      },
    })

    if (limit === 1) {
      return NextResponse.json({ asset: assets[0] || null })
    }

    return NextResponse.json({ assets })
  } catch (error) {
    console.error('[MotionGraphics-History] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
