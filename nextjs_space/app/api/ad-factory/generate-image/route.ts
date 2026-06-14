export const dynamic = 'force-dynamic'
export const maxDuration = 120 // Image generation can take up to 2 minutes

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getImageModel } from '@/lib/image-models'

// Extract image URL from LLM response
function extractImageUrl(data: Record<string, unknown>): string | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const choices = data.choices as any[] | undefined
  if (choices && choices[0]) {
    const msg = choices[0].message
    if (!msg) return null

    if (typeof msg.image_url === 'string') return msg.image_url
    if (msg.image_url && typeof msg.image_url === 'object') {
      const imgUrl = (msg.image_url as { url?: string }).url
      if (imgUrl) return imgUrl
    }

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

    const content = msg.content
    if (typeof content === 'string') {
      const anyUrl = content.match(/https?:\/\/[^\s\)\]"'<>]+/i)
      if (anyUrl) return anyUrl[0]
    }

    if (Array.isArray(content)) {
      for (const item of content) {
        if (!item || typeof item !== 'object') continue
        if (item.type === 'image_url') {
          const imgUrlObj = item.image_url
          if (typeof imgUrlObj === 'string') return imgUrlObj
          if (imgUrlObj && typeof imgUrlObj === 'object') return imgUrlObj.url || null
        }
        if (typeof item.url === 'string') return item.url
      }
    }
  }

  // Fallback: search full JSON
  const fullStr = JSON.stringify(data)
  const urlInJson = fullStr.match(/https?:\/\/[^\s\)\]"'\\<>]+/i)
  if (urlInJson) return urlInJson[0]

  return null
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { prompt, templateName, templateId, brandName, referenceImages, imageModel, focusArea } = await request.json()
    if (!prompt) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
    }

    // Optional user-provided focus area (e.g., "the product scanner", "Dimitri card").
    // When set, we prepend a short visual directive so the image model concentrates on it.
    const hasFocusArea = typeof focusArea === 'string' && focusArea.trim().length > 0
    const focusAreaTrimmed: string = hasFocusArea ? focusArea.trim() : ''
    const focusAreaBlock = hasFocusArea
      ? `\n\n🎯 USER FOCUS AREA — HIGHEST PRIORITY 🎯
The viewer must see "${focusAreaTrimmed}" as the UNMISTAKABLE HERO of this image:
• Make "${focusAreaTrimmed}" the LARGEST and MOST CENTRAL element
• Use lighting, depth of field, and framing to draw ALL attention to it
• If the reference photos show multiple product aspects, IGNORE the others and zoom in on "${focusAreaTrimmed}"
• This is NOT optional — if "${focusAreaTrimmed}" is not the visual subject, the ad is a failure\n\n`
      : ''

    // Enrich the final prompt with the focus-area directive (if present).
    const finalPrompt: string = hasFocusArea ? focusAreaBlock + prompt : prompt

    // Determine which engine to use
    const useOpenRouter = imageModel && imageModel !== 'default'

    let apiUrl: string
    let apiHeaders: Record<string, string>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let apiBody: Record<string, any>

    // Try to get user's OpenRouter/turbo API key for non-default models
    // The key may be stored as turbo_openrouter, turbo_openai, etc. — all use OpenRouter
    const apiKeyRecord = useOpenRouter
      ? await prisma.apiKey.findFirst({
          where: { userId: session.user.id, serviceType: { startsWith: 'turbo_' }, status: 'active' },
        })
      : null

    // Fallback: if user requested OpenRouter but has no key, use RouteLLM silently
    const actuallyUseOpenRouter = useOpenRouter && !!apiKeyRecord

    if (actuallyUseOpenRouter) {

      // Build multimodal content with reference images
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const contentParts: any[] = []

      // Add reference images first (if any)
      if (referenceImages && Array.isArray(referenceImages) && referenceImages.length > 0) {
        contentParts.push({ type: 'text', text: `🔒 SACRED PRODUCT FIDELITY PROTOCOL 🔒

You are about to see reference photos of the REAL physical product. Your job is to generate an ad where this EXACT product appears. Follow these absolute rules:

1. COPY THE PRODUCT EXACTLY AS PHOTOGRAPHED
   - Same container shape, same proportions, same material finish
   - Same label: every text element, every color, every graphic, every badge
   - Same cap/lid color and style
   - Same logo placement and design

2. FORBIDDEN MODIFICATIONS — VIOLATION = FAILURE
   ❌ DO NOT change the container color (if white, it stays white — never black, red, or gold)
   ❌ DO NOT redesign the label or change any text on it
   ❌ DO NOT change the cap color or style
   ❌ DO NOT add elements that don't exist on the real product
   ❌ DO NOT make the product look "better" or "more premium" — it must look REAL
   ❌ DO NOT create a generic version — match the SPECIFIC product shown

3. CREATIVE FREEDOM — Everything EXCEPT the product
   ✅ Background, lighting, scene, props, text overlays, effects = creative freedom
   ❌ The product itself = SACRED, UNTOUCHABLE, EXACT COPY

4. QUALITY STANDARD
   The product should look like it was PHYSICALLY PHOTOGRAPHED with a DSLR camera and composited into the ad scene. Studio-quality lighting on the product. It should be indistinguishable from a real product photo.

Here are the reference photos — STUDY EVERY DETAIL of this product:\n` })
        for (const imgUrl of referenceImages) {
          if (typeof imgUrl === 'string' && imgUrl.trim()) {
            contentParts.push({
              type: 'image_url',
              image_url: { url: imgUrl },
            })
          }
        }
        contentParts.push({ type: 'text', text: `\n───────────────────────────────────
Now generate this ad following the creative prompt below.

🔒 FINAL PRODUCT FIDELITY CHECK — READ THIS LAST:
Before rendering, verify against the reference photos:
□ Container color matches EXACTLY (if white, it's white — not cream, not silver, not black)
□ Label design matches EXACTLY (same text, same colors, same graphics, same layout)
□ Cap/lid matches EXACTLY (same color, same shape)
□ Logo matches EXACTLY (same placement, same design)
□ No elements added that don't exist on the real product
□ No "premium upgrade" or "artistic reinterpretation" of the packaging
If ANY checkbox fails, you have hallucinated. Regenerate.

CREATIVE PROMPT:
` + finalPrompt })

      } else {
        contentParts.push({ type: 'text', text: finalPrompt })
      }

      apiUrl = 'https://openrouter.ai/api/v1/chat/completions'
      apiHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKeyRecord.apiKey}`,
        'HTTP-Referer': 'https://octopus.app',
        'X-Title': 'OCTOPUS Ad Factory',
      }

      // Look up model metadata to shape the request correctly for each provider
      const modelMeta = getImageModel(imageModel)
      const kind = modelMeta?.kind ?? 'chat-image'
      const supportsImageConfig = (modelMeta?.supportsAspectRatio ?? false) || (modelMeta?.supportsImageSize ?? false)

      apiBody = {
        model: imageModel,
        messages: [{ role: 'user', content: contentParts }],
        // chat-image models (Gemini, GPT-5.4 Image 2) return text+image; image-only models (FLUX, Riverflow, Seedream) return image only
        modalities: kind === 'chat-image' ? ['image', 'text'] : ['image'],
      }

      // Only include image_config for models that support it (Gemini, GPT-5.4 Image 2)
      if (supportsImageConfig) {
        apiBody.image_config = { aspect_ratio: '1:1' }
      }

      // Update usage
      prisma.apiKey.update({
        where: { id: apiKeyRecord!.id },
        data: { lastUsed: new Date(), usageCount: { increment: 1 } },
      }).catch(() => {})
    } else {
      // Default: RouteLLM (Abacus AI)
      apiUrl = 'https://routellm.abacus.ai/v1/chat/completions'
      apiHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`,
      }

      // Build multimodal content with reference images for RouteLLM too
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let routeContent: string | any[] = finalPrompt

      if (referenceImages && Array.isArray(referenceImages) && referenceImages.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parts: any[] = []
        parts.push({ type: 'text', text: `🔒 SACRED PRODUCT FIDELITY PROTOCOL 🔒

You are about to see reference photos of the REAL physical product. Your job is to generate an ad where this EXACT product appears. Follow these absolute rules:

1. COPY THE PRODUCT EXACTLY AS PHOTOGRAPHED
   - Same container shape, same proportions, same material finish
   - Same label: every text element, every color, every graphic, every badge
   - Same cap/lid color and style
   - Same logo placement and design

2. FORBIDDEN MODIFICATIONS — VIOLATION = FAILURE
   ❌ DO NOT change the container color (if yellow, it stays yellow — never white, red, or silver)
   ❌ DO NOT redesign the label or change any text on it
   ❌ DO NOT change the cap color or style
   ❌ DO NOT add elements that don't exist on the real product
   ❌ DO NOT make the product look "better" or "more premium" — it must look REAL

3. CREATIVE FREEDOM — Everything EXCEPT the product
   ✅ Background, lighting, scene, props, text overlays, effects = creative freedom
   ❌ The product itself = SACRED, UNTOUCHABLE, EXACT COPY

Here are the reference photos — STUDY EVERY DETAIL of this product:\n` })

        for (const imgUrl of referenceImages) {
          if (typeof imgUrl === 'string' && imgUrl.trim()) {
            parts.push({
              type: 'image_url',
              image_url: { url: imgUrl },
            })
          }
        }

        parts.push({ type: 'text', text: `\n───────────────────────────────────
Now generate this ad following the creative prompt below.

🔒 FINAL PRODUCT FIDELITY CHECK — READ THIS LAST:
Before rendering, verify against the reference photos:
□ Container color matches EXACTLY (if yellow/orange, it's yellow/orange — not white, not red)
□ Label design matches EXACTLY (same text, same colors, same graphics, same layout)
□ Cap/lid matches EXACTLY (same color, same shape)
□ Logo matches EXACTLY (same placement, same design)
□ No elements added that don't exist on the real product
□ No "premium upgrade" or "artistic reinterpretation" of the packaging
If ANY checkbox fails, you have hallucinated. Regenerate.

CREATIVE PROMPT:
` + finalPrompt })

        routeContent = parts
      }

      apiBody = {
        model: 'route-llm',
        messages: [{ role: 'user', content: routeContent }],
        modalities: ['image'],
      }
    }

    // Use AbortController for a 110-second timeout (leave buffer before maxDuration)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 110_000)

    let response: Response
    try {
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify(apiBody),
        signal: controller.signal,
      })
    } catch (fetchErr: unknown) {
      clearTimeout(timeoutId)
      const isAbort = fetchErr instanceof Error && fetchErr.name === 'AbortError'
      console.error('Ad image fetch error:', isAbort ? 'TIMEOUT (110s)' : fetchErr)
      return NextResponse.json(
        { error: isAbort ? 'Image generation timed out — try a simpler prompt or different model' : 'Network error generating image' },
        { status: 504 }
      )
    }
    clearTimeout(timeoutId)

    if (!response.ok) {
      const errBody = await response.text().catch(() => 'unknown')
      console.error('Ad image generation error:', response.status, errBody.substring(0, 500))
      return NextResponse.json({ error: `Error generating ad image (${response.status})` }, { status: 500 })
    }

    let data: Record<string, unknown>
    try {
      data = await response.json()
    } catch {
      console.error('Ad image: response was not valid JSON')
      return NextResponse.json({ error: 'Image provider returned an invalid response' }, { status: 502 })
    }
    const imageUrl = extractImageUrl(data)

    if (!imageUrl) {
      console.error('Could not extract image URL from response')
      return NextResponse.json({ error: 'Could not generate image (no URL returned by model)' }, { status: 500 })
    }

    // Sanity check: ensure imageUrl is actually a valid image URL/data-URL.
    // Some models return a text refusal that accidentally matches our URL regex fallback.
    const isDataUrl = imageUrl.startsWith('data:image/')
    const isHttpUrl = /^https?:\/\//i.test(imageUrl)

    if (!isDataUrl && !isHttpUrl) {
      console.error('Extracted content is not a valid image URL:', imageUrl.substring(0, 200))
      return NextResponse.json({ error: 'Model returned an invalid response (no image)' }, { status: 500 })
    }

    // For data URLs, make sure the base64 payload is large enough to be a real image
    // (a truncated/empty data URL would fit in <1KB — real images are much bigger).
    if (isDataUrl) {
      const base64Part = imageUrl.split(',')[1] || ''
      if (base64Part.length < 2000) {
        console.error('Data URL base64 payload too small — likely a placeholder/safety block:', base64Part.length, 'chars')
        return NextResponse.json({ error: 'Model returned an empty image (possible safety filter or timeout)' }, { status: 500 })
      }
    }

    // Save to gallery
    const asset = await prisma.creativeAsset.create({
      data: {
        userId: session.user.id,
        type: 'image',
        title: `Ad: ${templateName || 'Custom'} - ${brandName || 'Brand'}`,
        prompt,
        content: imageUrl,
        platform: 'general',
        format: 'post',
        status: 'ready',
        tags: `ad-factory,${templateName || ''},${brandName || ''}`,
        metadata: JSON.stringify({
          source: 'ad-factory',
          templateId,
          templateName,
          brandName,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      imageUrl,
      assetId: asset.id,
      engine: actuallyUseOpenRouter ? 'openrouter' : 'routellm',
      model: actuallyUseOpenRouter ? imageModel : 'route-llm',
      fallback: useOpenRouter && !actuallyUseOpenRouter,
    })
  } catch (error) {
    console.error('Ad image generation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}