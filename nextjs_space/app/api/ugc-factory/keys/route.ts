export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const UGC_SERVICES = [
  { serviceType: 'ugc_kling_ak', name: 'Kling AI — Access Key' },
  { serviceType: 'ugc_kling_sk', name: 'Kling AI — Secret Key' },
  { serviceType: 'ugc_elevenlabs', name: 'ElevenLabs' },
  { serviceType: 'ugc_fal', name: 'fal.ai' },
]

// GET — check which UGC API keys are configured
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const apiKeys = await prisma.apiKey.findMany({
      where: {
        userId: session.user.id,
        serviceType: { in: UGC_SERVICES.map(s => s.serviceType) },
      },
      select: {
        serviceType: true,
        status: true,
        lastTested: true,
        lastUsed: true,
        usageCount: true,
        apiKey: true,
      },
    })

    const result = UGC_SERVICES.map(svc => {
      const found = apiKeys.find(k => k.serviceType === svc.serviceType)
      return {
        serviceType: svc.serviceType,
        name: svc.name,
        configured: !!found,
        status: found?.status || 'inactive',
        maskedKey: found?.apiKey ? `${'•'.repeat(16)}${found.apiKey.slice(-4)}` : '',
        lastUsed: found?.lastUsed || null,
        usageCount: found?.usageCount || 0,
      }
    })

    return NextResponse.json({ keys: result })
  } catch (error) {
    console.error('UGC keys GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST — save/update/delete a UGC API key
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { action, serviceType, apiKey } = await request.json()

    if (!serviceType || !UGC_SERVICES.find(s => s.serviceType === serviceType)) {
      return NextResponse.json({ error: 'Invalid serviceType' }, { status: 400 })
    }

    const svcName = UGC_SERVICES.find(s => s.serviceType === serviceType)!.name

    if (action === 'delete') {
      await prisma.apiKey.deleteMany({
        where: { userId: session.user.id, serviceType },
      })
      return NextResponse.json({ success: true })
    }

    if (!apiKey) {
      return NextResponse.json({ error: 'apiKey is required' }, { status: 400 })
    }

    // Clean the key — remove common prefixes users copy-paste from Kling dashboard
    let cleanKey = apiKey.trim()
    cleanKey = cleanKey.replace(/^(Access\s*Key\s*[:：]\s*)/i, '')
    cleanKey = cleanKey.replace(/^(Secret\s*Key\s*[:：]\s*)/i, '')
    cleanKey = cleanKey.replace(/^(API\s*Key\s*[:：]\s*)/i, '')
    cleanKey = cleanKey.trim()

    await prisma.apiKey.upsert({
      where: {
        userId_serviceType: {
          userId: session.user.id,
          serviceType,
        },
      },
      update: {
        apiKey: cleanKey,
        status: 'active',
        updatedAt: new Date(),
      },
      create: {
        userId: session.user.id,
        serviceType,
        name: `UGC - ${svcName}`,
        apiKey: cleanKey,
        status: 'active',
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('UGC keys POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
