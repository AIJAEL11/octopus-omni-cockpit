export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getImageModel } from '@/lib/image-models'

// Helper to extract image URL from LLM response
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

    const {
      frameDescription: rawFrameDescription,
      firstFrameUrl,
      productImages,
      avatarType,
      avatarDescription,
      customPrompt,
      backgroundPrompt,
      imageModel,
      styleMode,
      skipInspiration,
    } = await request.json()

    // In Skip Inspiration mode (Cinematic Director path), there's no frame description.
    // Use a sensible UGC-default pose so the model can still be generated.
    const DEFAULT_UGC_POSE = `A casual UGC-style portrait shot. The subject is in a natural, relaxed seated or standing pose,
upper body visible, looking directly into the camera with a friendly engaged expression.
Camera at eye-level, slight 3/4 angle. Soft natural lighting from a side window or a soft ring light.
The subject is naturally holding or showing the product close to their chest/face area, ready to talk about it
in a video review or recommendation. Composition should leave headroom and shoulder space.`

    const frameDescription: string = (typeof rawFrameDescription === 'string' && rawFrameDescription.trim())
      ? rawFrameDescription
      : (skipInspiration ? DEFAULT_UGC_POSE : '')

    if (!frameDescription) {
      return NextResponse.json({ error: 'frameDescription is required' }, { status: 400 })
    }

    // Style mode controls how the character is rendered.
    // We have THREE modes now to align with Seedance 2.0 content policy:
    //   - 'stylized'         → 3D Pixar/animated character (always passes 2.0)
    //   - 'editorial' (NEW)  → editorial cinematic / fashion-campaign aesthetic (filter-safe for 2.0)
    //   - 'realistic'        → legacy photorealistic mode (only safe for Seedance 1.5 Pro)
    //
    // 'editorial' is the NEW DEFAULT for Skip Inspiration / Cinematic Director path.
    // It produces premium production-grade images that LOOK realistic enough for UGC
    // while using cinematic vocabulary that Seedance 2.0 tolerates.
    const isStylized = styleMode === 'stylized'
    const isEditorial = styleMode === 'editorial' || (skipInspiration && styleMode !== 'stylized' && styleMode !== 'realistic')

    // Build avatar instruction based on selection
    let avatarInstruction: string
    if (avatarType === 'custom' && customPrompt) {
      avatarInstruction = `AVATAR DESCRIPTION (use exactly this):\n${customPrompt}`
    } else if (avatarDescription) {
      let realismCue: string
      if (isStylized) {
        realismCue = 'Render them as a stylized 3D illustrated character (Pixar/animated film aesthetic), NOT photorealistic.'
      } else if (isEditorial) {
        realismCue = 'Render as a fictional AI-generated editorial model in fashion-campaign cinematic style. Premium commercial spot aesthetic — high production value, NOT a candid photograph.'
      } else {
        realismCue = 'Render with high editorial cinematic production value. The character is a fully fictional AI-synthesized model, not based on any real person.'
      }
      avatarInstruction = `AVATAR TYPE: ${avatarDescription}\nGenerate this specific type of fictional editorial model. ${realismCue}`
    } else {
      if (isStylized) {
        avatarInstruction = 'Generate an attractive, diverse stylized 3D illustrated character (Pixar/animated film aesthetic) — clearly NOT photorealistic. Choose a random gender, age, and ethnicity for diversity.'
      } else if (isEditorial) {
        avatarInstruction = 'Generate an attractive, diverse FICTIONAL AI-generated editorial model in fashion-campaign cinematic style. Random gender, age, and ethnicity for diversity. The model is fully synthetic — NOT based on any real person.'
      } else {
        avatarInstruction = 'Generate an attractive, diverse fictional AI-synthesized editorial model. Random gender, age, and ethnicity for diversity. Premium production value.'
      }
    }

    // Build the image generation prompt
    // IMPORTANT: We ONLY pass the TEXT description of the original frame, NOT the frame image itself.
    // If we send the original frame image, the AI model copies the person's face/identity.
    // By using only the text description, we force it to create a truly NEW person.
    let intro: string
    if (isStylized) {
      intro = 'Generate a single STYLIZED 3D-ILLUSTRATED image (Pixar / animated film / Spider-Verse aesthetic — clearly NON-PHOTOREALISTIC) of a BRAND NEW, ORIGINAL AI-generated character for a UGC (User Generated Content) advertisement.'
    } else if (isEditorial) {
      intro = 'Generate a single high-end EDITORIAL CINEMATIC frame for a fashion-campaign UGC commercial spot. The subject is a BRAND NEW, FICTIONAL AI-synthesized editorial model — fully original, not based on any real person. Treat the output as a still frame from a Vogue / GQ campaign film.'
    } else {
      intro = 'Generate a single high-end editorial cinematic frame featuring a BRAND NEW, fictional AI-synthesized character for a UGC commercial spot. Premium fashion-campaign aesthetic.'
    }

    let styleRules: string
    if (isStylized) {
      styleRules = `
CRITICAL RULES:
1. The CHARACTER must be a completely NEW, AI-generated individual — a fictional, stylized character with a UNIQUE design (NOT based on anyone in the reference)
2. REPLICATE the same pose, camera angle, body position and composition described above
3. The character must be a STYLIZED 3D ILLUSTRATION in the style of premium animated films (Pixar, Arcane, Spider-Verse) — clearly NOT photorealistic, with illustrated/animated quality but believable lighting and proportions
4. The product shown must match the reference product photos EXACTLY — same colors, same packaging, same label, same text visible on the product (the product itself stays realistic)
5. The character must be holding/showing the product naturally in the same way described in the pose
6. Lighting should feel cinematic and warm, like a polished animated short — vibrant colors, soft shadows
7. This image will be used for AI video generation, so the character must be in a clear, well-defined static pose with expressive, lively features for lip-sync
8. Upper body or full body visible (matching the described composition)
9. High-quality 3D rendered illustration, vibrant colors, cinematic lighting — NOT a photograph, NOT photorealistic
10. The character should look like a charismatic stylized AI avatar — illustrated, expressive, OBVIOUSLY animated, NOT a real person
11. AVOID any photographic realism on the person — the face, skin, hair must all be CLEARLY illustrated/animated to comply with downstream video generation content policies
12. DO NOT generate real-person likenesses; create a fully fictional, stylized character

Generate this image now.`
    } else if (isEditorial) {
      styleRules = `
CRITICAL RULES (EDITORIAL CINEMATIC — Seedance 2.0 filter-safe):
1. The SUBJECT is a completely fictional, AI-synthesized editorial model — a unique character, NOT based on anyone in the reference, NOT a real person
2. REPLICATE the same pose, camera angle, body position and composition described above
3. AESTHETIC: editorial cinematic / fashion-campaign frame (Vogue, GQ, A24-style cinematography). NOT a candid photograph. NOT a phone selfie. Treat as a still frame from a premium commercial spot
4. LENS: anamorphic 35mm cinema lens, subtle film grain, editorial color grade with deep shadows and rim light
5. LIGHTING: dramatic Rembrandt-style or directional rim light — soft cinematic complexion (not pore-level skin texture). The lighting should feel like a high-end fashion film, not a flat ring light
6. The product must match the reference product photos EXACTLY — same colors, packaging, label and text visible on the product
7. The subject is holding/showing the product naturally in the same way described in the pose
8. The output will feed an AI video model, so the subject must be in a clear, well-defined pose with confident editorial expression — eyes engaged, slight head tilt, ready for lip-sync
9. Upper body or full body visible (matching the described composition)
10. CRITICAL FILTER COMPLIANCE: avoid words/concepts like \"photorealistic\", \"real person\", \"photograph\", \"candid\". This is a STYLIZED EDITORIAL CINEMATIC frame, not a photograph
11. The model is FICTIONAL and AI-synthesized. No celebrity faces, no recognizable real-world identities, no copyrighted characters
12. Premium commercial spot quality — Arri Alexa Mini cinematography vibe, editorial campaign framing

Generate this editorial cinematic frame now.`
    } else {
      // Legacy 'realistic' path — still smoothed with editorial cues to maximize Seedance tolerance
      styleRules = `
CRITICAL RULES:
1. The SUBJECT must be a completely NEW, fictional AI-synthesized character — a different individual with different facial features and styling from anyone in the reference
2. REPLICATE the same pose, camera angle, body position and composition described above
3. AESTHETIC: high-end editorial cinematic frame (commercial spot grade). Soft cinematic complexion, NOT pore-level skin
4. The product shown must match the reference product photos EXACTLY — same colors, packaging, label, text on product
5. The subject is holding/showing the product naturally in the same way described
6. LIGHTING: editorial soft directional light (Rembrandt-style or rim-light) — premium commercial spot vibe, NOT flat phone-light
7. This frame will feed an AI video model, so the subject must be in a clear, well-defined pose with confident expression for lip-sync
8. Upper body or full body visible (matching the described composition)
9. High-end editorial cinematic frame, anamorphic 35mm lens vibe, subtle film grain
10. The character is a FICTIONAL AI-synthesized editorial model — NOT a real person, NOT based on any real individual
11. Avoid celebrity faces, recognizable real-world identities, copyrighted characters
12. Premium production value — treat as a still frame from a fashion-campaign commercial spot

Generate this editorial cinematic frame now.`
    }

    const prompt = `${intro}

POSE & COMPOSITION TO REPLICATE (described from a reference video frame — do NOT copy any person, only the pose):
${frameDescription}

${avatarInstruction}
${customPrompt && avatarType !== 'custom' ? `ADDITIONAL MODIFICATIONS:\n${customPrompt}\n` : ''}
${backgroundPrompt ? `BACKGROUND:\n${backgroundPrompt}\n` : ''}
${styleRules}`

    // Determine engine
    const useOpenRouter = imageModel && imageModel !== 'default'
    const apiKeyRecord = useOpenRouter
      ? await prisma.apiKey.findFirst({
          where: { userId: session.user.id, serviceType: { startsWith: 'turbo_' }, status: 'active' },
        })
      : null
    const actuallyUseOpenRouter = useOpenRouter && !!apiKeyRecord

    let apiUrl: string
    let apiHeaders: Record<string, string>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let apiBody: Record<string, any>

    if (actuallyUseOpenRouter) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const contentParts: any[] = []

      // Add product reference images ONLY (NOT the original frame — that would cause face copying)
      if (productImages && Array.isArray(productImages) && productImages.length > 0) {
        contentParts.push({ type: 'text', text: '📸 REFERENCE PHOTOS OF THE REAL PRODUCT — The product in your generated image MUST match these exactly:\n' })
        for (const imgUrl of productImages) {
          if (typeof imgUrl === 'string' && imgUrl.trim()) {
            contentParts.push({ type: 'image_url', image_url: { url: imgUrl } })
          }
        }
      }

      // NOTE: We intentionally do NOT send firstFrameUrl as an image reference here.
      // Sending the original frame causes the AI to copy the person's face/identity.
      // The pose/composition is described in text via frameDescription in the prompt.

      contentParts.push({ type: 'text', text: '\n' + prompt })

      apiUrl = 'https://openrouter.ai/api/v1/chat/completions'
      apiHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKeyRecord!.apiKey}`,
        'HTTP-Referer': 'https://octopus.app',
        'X-Title': 'OCTOPUS UGC Factory',
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

      // Only include image_config for models that support it. UGC uses 9:16 vertical (TikTok/Reels).
      if (supportsImageConfig) {
        apiBody.image_config = { aspect_ratio: '9:16' }
      }

      // Update usage
      prisma.apiKey.update({
        where: { id: apiKeyRecord!.id },
        data: { lastUsed: new Date(), usageCount: { increment: 1 } },
      }).catch(() => {})
    } else {
      // RouteLLM fallback
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parts: any[] = []
      // Product reference images ONLY
      if (productImages && Array.isArray(productImages) && productImages.length > 0) {
        parts.push({ type: 'text', text: '📸 Product reference photos — match this product exactly:\n' })
        for (const imgUrl of productImages) {
          if (typeof imgUrl === 'string' && imgUrl.trim()) {
            parts.push({ type: 'image_url', image_url: { url: imgUrl } })
          }
        }
      }
      // NOTE: No firstFrameUrl image — only text description of the pose
      parts.push({ type: 'text', text: '\n' + prompt })

      apiUrl = 'https://routellm.abacus.ai/v1/chat/completions'
      apiHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`,
      }
      apiBody = {
        model: 'route-llm',
        messages: [{ role: 'user', content: parts }],
        modalities: ['image'],
      }
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify(apiBody),
    })

    if (!response.ok) {
      const errBody = await response.text().catch(() => 'unknown')
      console.error('UGC model generation error:', response.status, errBody)
      return NextResponse.json({ error: `Error generating model image (${response.status})` }, { status: 500 })
    }

    const data = await response.json()
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

    // For data URLs, make sure the base64 payload is large enough to be a real image.
    if (isDataUrl) {
      const base64Part = imageUrl.split(',')[1] || ''
      if (base64Part.length < 2000) {
        console.error('Data URL base64 payload too small — likely a placeholder/safety block:', base64Part.length, 'chars')
        return NextResponse.json({ error: 'Model returned an empty image (possible safety filter or timeout)' }, { status: 500 })
      }
    }

    // Save to gallery
    await prisma.creativeAsset.create({
      data: {
        userId: session.user.id,
        type: 'image',
        title: 'UGC Factory — AI Model Image',
        prompt,
        content: imageUrl,
        platform: 'general',
        format: 'post',
        status: 'ready',
        tags: 'ugc-factory,model-image',
        metadata: JSON.stringify({
          source: 'ugc-factory',
          step: 'generate-model',
          styleMode: isStylized ? 'stylized' : isEditorial ? 'editorial' : 'realistic',
        }),
      },
    })

    return NextResponse.json({
      success: true,
      imageUrl,
      engine: actuallyUseOpenRouter ? 'openrouter' : 'routellm',
      model: actuallyUseOpenRouter ? imageModel : 'route-llm',
      fallback: useOpenRouter && !actuallyUseOpenRouter,
      styleMode: isStylized ? 'stylized' : isEditorial ? 'editorial' : 'realistic',
    })
  } catch (error) {
    console.error('UGC model generation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
