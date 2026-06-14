import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET — Serve asset content (image/video/audio) by creativeAsset ID
// Public endpoint for email links and "View Asset" buttons
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const asset = await prisma.creativeAsset.findUnique({
      where: { id: params.id },
      select: { content: true, type: true, title: true },
    })
    if (!asset || !asset.content) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    const content = asset.content

    // If content is a base64 data URL, extract and serve the binary
    if (content.startsWith('data:')) {
      const match = content.match(/^data:([^;]+);base64,(.+)$/)
      if (match) {
        const mimeType = match[1]
        const buffer = Buffer.from(match[2], 'base64')
        return new NextResponse(buffer, {
          status: 200,
          headers: {
            'Content-Type': mimeType,
            'Content-Disposition': `inline; filename="${asset.title || 'asset'}"`,
            'Cache-Control': 'public, max-age=86400',
          },
        })
      }
    }

    // If content is a regular URL, redirect to it
    if (content.startsWith('http://') || content.startsWith('https://')) {
      return NextResponse.redirect(content, 302)
    }

    // Fallback: return as JSON
    return NextResponse.json({ url: content, type: asset.type })
  } catch (error) {
    console.error('[Assets API] Error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
