import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { uploadBufferToS3Public } from '@/lib/s3'

export const dynamic = 'force-dynamic'

/**
 * Auto-generate a "start frame" image from a text prompt using RouteLLM image generation.
 * Returns a publicly accessible S3 URL that video engines (Veo/Kling via fal.ai) can consume.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { prompt, language } = await request.json()
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const es = language === 'es'

    // Build an optimized image generation prompt
    const imagePrompt = `Create a highly cinematic, photorealistic still frame for a motion graphics video. The scene should be:

${prompt}

Style requirements:
- Ultra high quality, 4K resolution feel
- Cinematic lighting with dramatic shadows
- Professional color grading
- Suitable as the opening frame of a motion graphics video
- Clean composition with clear focal point
- No text, watermarks, or UI elements
- Photorealistic or high-end 3D render quality`

    console.log('[generate-frame] Generating start frame for prompt:', prompt.substring(0, 100))

    const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-5.1',
        messages: [{ role: 'user', content: imagePrompt }],
        modalities: ['image'],
        image_config: {
          aspect_ratio: '16:9',
          quality: 'high',
          num_images: 1,
        },
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'no body')
      console.error('[generate-frame] API error:', response.status, errorBody)
      return NextResponse.json(
        { error: es ? 'Error al generar la imagen inicial' : 'Failed to generate start frame' },
        { status: 500 }
      )
    }

    const data = await response.json()
    const rawImageUrl = extractImageUrl(data)

    if (!rawImageUrl) {
      console.error('[generate-frame] Could not extract image URL from response')
      return NextResponse.json(
        { error: es ? 'No se pudo extraer la imagen generada' : 'Could not extract generated image' },
        { status: 500 }
      )
    }

    // Ensure the URL is publicly accessible — upload to S3 if it's a data URI or base64
    let publicUrl = rawImageUrl
    if (rawImageUrl.startsWith('data:image/')) {
      console.log('[generate-frame] Image is base64 data URI, uploading to S3...')
      try {
        // Extract base64 data and content type
        const matches = rawImageUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/i)
        if (!matches) throw new Error('Invalid data URI format')
        const contentType = matches[1]
        const base64Data = matches[2]
        const buffer = Buffer.from(base64Data, 'base64')
        const ext = contentType.split('/')[1]?.replace('+xml', '') || 'png'
        const fileName = `auto-frame-${session.user.id}-${Date.now()}.${ext}`

        const result = await uploadBufferToS3Public(buffer, fileName, contentType)
        publicUrl = result.publicUrl
        console.log('[generate-frame] Uploaded to S3:', publicUrl)
      } catch (uploadErr) {
        console.error('[generate-frame] S3 upload failed:', uploadErr)
        return NextResponse.json(
          { error: es ? 'Error al subir la imagen generada' : 'Failed to upload generated image' },
          { status: 500 }
        )
      }
    } else if (!rawImageUrl.startsWith('http')) {
      // If it's raw base64 without data: prefix, wrap and upload
      console.log('[generate-frame] Image is raw base64, uploading to S3...')
      try {
        const buffer = Buffer.from(rawImageUrl, 'base64')
        const fileName = `auto-frame-${session.user.id}-${Date.now()}.png`
        const result = await uploadBufferToS3Public(buffer, fileName, 'image/png')
        publicUrl = result.publicUrl
        console.log('[generate-frame] Uploaded raw base64 to S3:', publicUrl)
      } catch (uploadErr) {
        console.error('[generate-frame] S3 upload of raw base64 failed:', uploadErr)
        return NextResponse.json(
          { error: es ? 'Error al subir la imagen generada' : 'Failed to upload generated image' },
          { status: 500 }
        )
      }
    }

    // Validate the final URL is a public HTTP(S) URL
    if (!publicUrl.startsWith('http')) {
      console.error('[generate-frame] Final URL is not HTTP:', publicUrl.substring(0, 50))
      return NextResponse.json(
        { error: es ? 'La imagen generada no tiene una URL válida' : 'Generated image URL is not valid' },
        { status: 500 }
      )
    }

    console.log('[generate-frame] ✅ Public start frame ready:', publicUrl.substring(0, 80))
    return NextResponse.json({ success: true, imageUrl: publicUrl })

  } catch (err) {
    console.error('[generate-frame] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}

// Robust image URL extraction from LLM response
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractImageUrl(data: Record<string, any>): string | null {
  const choices = data.choices as any[] | undefined
  if (!choices || !choices[0]) return null

  const msg = choices[0].message
  if (!msg) return null

  // Direct image_url on message
  if (typeof msg.image_url === 'string') return msg.image_url
  if (msg.image_url && typeof msg.image_url === 'object') {
    const url = msg.image_url.url
    if (url) return url
  }

  // message.images array (RouteLLM format)
  if (msg.images && Array.isArray(msg.images) && msg.images.length > 0) {
    const img = msg.images[0]
    if (typeof img === 'string') return img
    if (img && typeof img === 'object') {
      if (img.image_url) {
        if (typeof img.image_url === 'string') return img.image_url
        if (typeof img.image_url === 'object' && img.image_url.url) return img.image_url.url
      }
      if (typeof img.url === 'string') return img.url
      if (typeof img.data === 'string') return img.data.length > 1000 ? `data:image/png;base64,${img.data}` : img.data
      if (typeof img.b64_json === 'string') return `data:image/png;base64,${img.b64_json}`
    }
  }

  // Content-based extraction
  const content = msg.content
  if (content && typeof content === 'object' && !Array.isArray(content)) {
    if (content.type === 'image_url' && content.image_url?.url) return content.image_url.url
    if (typeof content.url === 'string') return content.url
  }
  if (typeof content === 'string') {
    const urlMatch = content.match(/https?:\/\/[^\s)\]"'<>]+/i)
    if (urlMatch) return urlMatch[0]
  }

  // Array content
  if (Array.isArray(content)) {
    for (const part of content) {
      if (part.type === 'image_url' && part.image_url?.url) return part.image_url.url
    }
  }

  return null
}
