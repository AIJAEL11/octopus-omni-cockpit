export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET: Check if user has OpenRouter key configured
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const apiKeyRecord = await prisma.apiKey.findFirst({
      where: { userId: session.user.id, serviceType: { startsWith: 'turbo_' }, status: 'active' },
      select: { id: true, name: true },
    })

    return NextResponse.json({
      hasOpenRouterKey: !!apiKeyRecord,
      keyName: apiKeyRecord?.name || null,
    })
  } catch {
    return NextResponse.json({ hasOpenRouterKey: false, keyName: null })
  }
}
