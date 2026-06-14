export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Extract first frame from a video using LLM vision
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { videoUrl } = await request.json()
    if (!videoUrl) {
      return NextResponse.json({ error: 'videoUrl is required' }, { status: 400 })
    }

    // Use GPT-4.1 to analyze the first frame image
    // The client extracts the first frame via canvas and sends it as a data URL or image URL
    const response = await fetch('https://routellm.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this image in exhaustive detail. I need to recreate this exact scene with a different product. Describe:\n\n1. PERSON: Gender, approximate age, ethnicity, hair color/style, facial expression, body pose, hand positions\n2. CLOTHING: Every garment visible, colors, styles, fit\n3. PRODUCT: What is the person holding/showing? Describe it in detail (we will replace this with a new product)\n4. BACKGROUND: Setting, lighting, colors, objects, furniture\n5. CAMERA: Angle, distance, focal length estimate, orientation (portrait/landscape)\n6. COMPOSITION: Where is the person in frame, rule of thirds, negative space\n7. MOOD: Overall feeling, color temperature, lighting style\n\nBe extremely specific — this description will be used to generate an identical scene with AI, replacing the product with a new one.`,
              },
              {
                type: 'image_url',
                image_url: { url: videoUrl },
              },
            ],
          },
        ],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    })

    if (!response.ok) {
      const errBody = await response.text().catch(() => 'unknown')
      console.error('Extract frame error:', response.status, errBody)
      return NextResponse.json({ error: 'Error analyzing video' }, { status: 500 })
    }

    const data = await response.json()
    const frameDescription = data.choices?.[0]?.message?.content || ''

    return NextResponse.json({
      success: true,
      frameDescription,
    })
  } catch (error) {
    console.error('Extract frame error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
