export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { Subscription: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      planId: user.planId,
      planPeriod: user.planPeriod,
      subscription: user.Subscription ? {
        status: user.Subscription.status,
        currentPeriodEnd: user.Subscription.stripeCurrentPeriodEnd,
        cancelAtPeriodEnd: user.Subscription.cancelAtPeriodEnd,
        trialEnd: user.Subscription.trialEnd,
      } : null,
    })
  } catch (error) {
    console.error('Subscription fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
