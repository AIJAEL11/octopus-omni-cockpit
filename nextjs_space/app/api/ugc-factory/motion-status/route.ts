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
    exp: now + 1800,
    nbf: now - 5,
  }
  return jwt.sign(payload, secretKey, { algorithm: 'HS256', header: { alg: 'HS256', typ: 'JWT' } })
}

// Poll Kling AI task status
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { taskId } = await request.json()
    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 })
    }

    const klingAK = await prisma.apiKey.findFirst({
      where: { userId: session.user.id, serviceType: 'ugc_kling_ak', status: 'active' },
    })
    const klingSK = await prisma.apiKey.findFirst({
      where: { userId: session.user.id, serviceType: 'ugc_kling_sk', status: 'active' },
    })

    if (!klingAK || !klingSK) {
      return NextResponse.json({ error: 'Kling AI Access Key and Secret Key not configured' }, { status: 400 })
    }

    // Clean keys — remove prefixes like "Access Key: " or "Secret Key: "
    const accessKey = klingAK.apiKey.replace(/^(Access\s*Key\s*[:：]\s*)/i, '').trim()
    const secretKey = klingSK.apiKey.replace(/^(Secret\s*Key\s*[:：]\s*)/i, '').trim()
    const token = generateKlingJWT(accessKey, secretKey)

    // Official endpoint: api-singapore.klingai.com
    const statusResponse = await fetch(`https://api-singapore.klingai.com/v1/videos/image2video/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })

    const statusData = await statusResponse.json().catch(() => null)
    console.log('Kling status response:', JSON.stringify(statusData))

    if (statusData?.code !== 0) {
      const errMsg = statusData?.message || statusData?.msg || `HTTP ${statusResponse.status}`
      console.error('Kling status error:', statusData?.code, errMsg)
      return NextResponse.json({ error: `Kling AI status error (code ${statusData?.code}): ${errMsg}` }, { status: 500 })
    }

    const taskStatus = statusData.data?.task_status || 'unknown'
    const videoUrl = statusData.data?.task_result?.videos?.[0]?.url || null

    return NextResponse.json({
      success: true,
      status: taskStatus,
      videoUrl,
      raw: statusData,
    })
  } catch (error) {
    console.error('Motion status error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
