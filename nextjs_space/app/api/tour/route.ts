export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ tourCompleted: true }) // don't show for unauthenticated
    }
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tourCompleted: true },
    })
    return NextResponse.json({ tourCompleted: user?.tourCompleted ?? false })
  } catch (error) {
    console.error('Tour GET error:', error)
    return NextResponse.json({ tourCompleted: true })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    await prisma.user.update({
      where: { id: session.user.id },
      data: { tourCompleted: true },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Tour POST error:', error)
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
