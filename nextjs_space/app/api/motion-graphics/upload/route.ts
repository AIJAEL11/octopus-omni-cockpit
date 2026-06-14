export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { uploadBufferToS3Public } from '@/lib/s3'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Only JPG, PNG, WebP or GIF allowed' }, { status: 400 })
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Max 10MB.' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const ext = file.type.split('/')[1] || 'png'
    const fileName = `mograph-frame-${session.user.id}-${Date.now()}.${ext}`

    const { publicUrl } = await uploadBufferToS3Public(buffer, fileName, file.type)

    return NextResponse.json({ url: publicUrl })
  } catch (error) {
    console.error('[MotionGraphics Upload] Error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
