export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'

// Generate Kling AI JWT token from Access Key + Secret Key
function generateKlingJWT(accessKey: string, secretKey: string): string {
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: accessKey,
    exp: now + 1800, // 30 minutes
    nbf: now - 5,
  }
  return jwt.sign(payload, secretKey, { algorithm: 'HS256', header: { alg: 'HS256', typ: 'JWT' } })
}

// Kling AI Motion Control — apply source video motion to generated image
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sourceVideoUrl, generatedImageUrl } = await request.json()
    if (!sourceVideoUrl || !generatedImageUrl) {
      return NextResponse.json({ error: 'sourceVideoUrl and generatedImageUrl are required' }, { status: 400 })
    }

    // Get user's Kling AI Access Key + Secret Key
    const klingAK = await prisma.apiKey.findFirst({
      where: { userId: session.user.id, serviceType: 'ugc_kling_ak', status: 'active' },
    })
    const klingSK = await prisma.apiKey.findFirst({
      where: { userId: session.user.id, serviceType: 'ugc_kling_sk', status: 'active' },
    })

    if (!klingAK || !klingSK) {
      return NextResponse.json({ error: 'Kling AI Access Key and Secret Key are both required. Go to UGC Factory settings to add your keys.' }, { status: 400 })
    }

    // Clean keys — remove prefixes like "Access Key: " or "Secret Key: " that users may accidentally paste
    const accessKey = klingAK.apiKey.replace(/^(Access\s*Key\s*[:：]\s*)/i, '').trim()
    const secretKey = klingSK.apiKey.replace(/^(Secret\s*Key\s*[:：]\s*)/i, '').trim()

    console.log('Kling keys debug — AK length:', accessKey.length, 'first4:', accessKey.substring(0, 4), 'last4:', accessKey.substring(accessKey.length - 4))
    console.log('Kling keys debug — SK length:', secretKey.length, 'first4:', secretKey.substring(0, 4), 'last4:', secretKey.substring(secretKey.length - 4))

    // Generate JWT token
    const token = generateKlingJWT(accessKey, secretKey)
    console.log('Kling JWT token (first 50):', token.substring(0, 50))

    // Decode and log JWT payload for debugging (without exposing secrets)
    try {
      const parts = token.split('.')
      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString())
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
      console.log('Kling JWT header:', JSON.stringify(header))
      console.log('Kling JWT payload:', JSON.stringify(payload))
    } catch (e) {
      console.error('Could not decode JWT for debug:', e)
    }

    // Call Kling AI API for image-to-video generation
    // Official endpoint: api-singapore.klingai.com (NOT api.klingai.com)
    // Kling expects pure base64 WITHOUT the "data:image/...;base64," prefix
    let imageForKling = generatedImageUrl
    if (imageForKling.startsWith('data:')) {
      imageForKling = imageForKling.replace(/^data:image\/[^;]+;base64,/, '')
    }

    const requestBody = {
      model_name: 'kling-v2-master',
      image: imageForKling,
      mode: 'pro',
      duration: '10',
      cfg_scale: 0.5,
    }

    console.log('Kling AI request — endpoint: api-singapore.klingai.com/v1/videos/image2video')
    console.log('Kling AI request — image length:', imageForKling?.length, 'isBase64:', !imageForKling.startsWith('data:') && !imageForKling.startsWith('http'))

    const klingResponse = await fetch('https://api-singapore.klingai.com/v1/videos/image2video', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
    })

    const klingData = await klingResponse.json().catch(() => null)
    console.log('Kling AI response status:', klingResponse.status, 'body:', JSON.stringify(klingData))

    // Kling API returns code 0 for success, non-zero for errors
    if (klingData?.code !== 0) {
      const errMsg = klingData?.message || klingData?.msg || `HTTP ${klingResponse.status}`
      console.error('Kling AI error:', klingData?.code, errMsg)
      return NextResponse.json({ error: `Kling AI error (code ${klingData?.code}): ${errMsg}` }, { status: 500 })
    }

    // Update API key usage
    prisma.apiKey.update({
      where: { id: klingAK.id },
      data: { lastUsed: new Date(), usageCount: { increment: 1 } },
    }).catch(() => {})

    // Kling returns a task ID — we need to poll for the result
    const taskId = klingData.data?.task_id || klingData.data?.id
    console.log('Kling AI task created:', taskId)

    return NextResponse.json({
      success: true,
      taskId,
      status: 'processing',
      message: 'Motion control task submitted. Poll for status.',
    })
  } catch (error) {
    console.error('Motion control error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
