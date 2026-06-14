export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Save a mastered video (voice + music + video) to Creative Studio
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { masterUrl, voiceScript, voiceProfile, musicStyle, originalVideoUrl, prompt } = body

    if (!masterUrl) {
      return NextResponse.json({ error: 'masterUrl is required' }, { status: 400 })
    }

    const asset = await prisma.creativeAsset.create({
      data: {
        userId: session.user.id,
        type: 'video',
        title: `🔥 Audio Master — ${new Date().toLocaleDateString()}`,
        prompt: prompt || voiceScript || 'Audio Factory Master',
        content: masterUrl,
        platform: 'general',
        format: 'motion-graphic',
        status: 'ready',
        tags: 'audio-factory,master,voice-over',
        metadata: JSON.stringify({
          source: 'audio-factory',
          voiceScript,
          voiceProfile,
          musicStyle,
          originalVideoUrl,
          masterUrl,
        }),
      },
    })

    console.log('[AudioFactory] ✅ Master saved to Creative Studio:', asset.id)

    return NextResponse.json({
      success: true,
      assetId: asset.id,
    })
  } catch (error) {
    console.error('[AudioFactory-Save] Error:', error)
    return NextResponse.json({ error: 'Failed to save master' }, { status: 500 })
  }
}
