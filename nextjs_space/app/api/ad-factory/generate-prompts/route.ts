import { callLLM } from '@/lib/turbo-llm'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AD_TEMPLATES, FOLLOWUP_PROMPT, MASTER_FIDELITY_SYSTEM } from '@/lib/ad-factory-templates'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { brandName, productName, brandDNA, selectedTemplateIds, referenceImages, focusArea } = await request.json()
    if (!brandName || !productName || !brandDNA) {
      return NextResponse.json({ error: 'brandName, productName, and brandDNA are required' }, { status: 400 })
    }

    // Prepare reference image parts for multimodal prompt
    const hasRefImages = referenceImages && Array.isArray(referenceImages) && referenceImages.length > 0
    const hasFocusArea = typeof focusArea === 'string' && focusArea.trim().length > 0
    const focusAreaTrimmed: string = hasFocusArea ? focusArea.trim() : ''

    // Filter templates if specific ones selected
    const templates = selectedTemplateIds?.length
      ? AD_TEMPLATES.filter(t => selectedTemplateIds.includes(t.id))
      : AD_TEMPLATES

    const followUp = FOLLOWUP_PROMPT
      .replace(/\[BRAND_NAME\]/g, brandName)
      .replace('[PRODUCT_NAME]', productName)

    // Focus area directive injected into the system prompt — forces every template
    // to center the visual composition around the aspect the user specified.
    const focusAreaDirective = hasFocusArea
      ? `\n\n🎯 USER FOCUS AREA — MANDATORY FOR EVERY PROMPT 🎯
The user has specifically asked that EVERY ad in this batch concentrate on this specific aspect of the product: "${focusAreaTrimmed}"

This means:
✅ Every generated prompt MUST describe a scene where "${focusAreaTrimmed}" is the visual HERO (largest, most prominent, centered).
✅ The Product Identity Block should lead with this aspect — describe "${focusAreaTrimmed}" first and in the most detail.
✅ Composition, framing, lighting all draw the viewer's eye to "${focusAreaTrimmed}".
❌ DO NOT generate prompts that showcase other parts of the product instead of "${focusAreaTrimmed}".
❌ DO NOT treat this as a "nice to have" — it is the PRIMARY SUBJECT of every ad.

If a template naturally shows multiple aspects (comparison, overview), adapt it so "${focusAreaTrimmed}" is still the element the viewer focuses on first.\n\n`
      : ''

    const systemContent = MASTER_FIDELITY_SYSTEM + `\n\n` + (hasRefImages
      ? `⚠️ PHOTO-FIRST RULE: You have been given reference photos of the real product. When writing the Product Identity Block, describe ONLY what you SEE in the photos. If the Brand DNA text contradicts the photos (wrong color, wrong shape, wrong label), IGNORE the text and trust the photos. The photos are ground truth.\n\n`
      : '') + focusAreaDirective + `You MUST return a valid JSON array. Each element must have: id (number), name (string), prompt (string), category (string). The prompt must be a complete standalone image generation prompt ready to be used immediately. Do NOT include markdown code fences. Return ONLY the JSON array.`

    // Split templates into batches of 10 to avoid token limits
    const BATCH_SIZE = 10
    const batches: typeof templates[] = []
    for (let i = 0; i < templates.length; i += BATCH_SIZE) {
      batches.push(templates.slice(i, i + BATCH_SIZE))
    }

    console.log(`Generating prompts for ${templates.length} templates in ${batches.length} batches`)

    // Process batches in parallel (max 3 concurrent)
    const MAX_CONCURRENT = 3
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let allPrompts: any[] = []

    for (let bStart = 0; bStart < batches.length; bStart += MAX_CONCURRENT) {
      const concurrentBatches = batches.slice(bStart, bStart + MAX_CONCURRENT)

      const batchResults = await Promise.all(
        concurrentBatches.map(async (batch, batchIdx) => {
          const batchNum = bStart + batchIdx + 1
          const templatePromptsStr = batch.map(t =>
            `## Template ${t.id}: ${t.name}\n\n${t.prompt}`
          ).join('\n\n---\n\n')

          const fullPromptText = `${followUp}\n\n--- BRAND DNA DOCUMENT ---\n\n${brandDNA}\n\n--- TEMPLATE PROMPTS (Batch ${batchNum}/${batches.length}, ${batch.length} templates) ---\n\n${templatePromptsStr}`

          // Build multimodal user message if reference images are available
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let userContent: string | any[]
          if (hasRefImages) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const parts: any[] = [
              { type: 'text', text: '📸 REFERENCE PHOTOS OF THE REAL PRODUCT — Study these carefully before writing any prompts:\n' },
            ]
            for (const imgUrl of referenceImages) {
              if (typeof imgUrl === 'string' && imgUrl.trim()) {
                parts.push({ type: 'image_url', image_url: { url: imgUrl } })
              }
            }
            parts.push({ type: 'text', text: '\n⬆️ These photos show the EXACT product. Your Product Identity Block MUST match what you see above — not what the Brand DNA text says.\n\n' + fullPromptText })
            userContent = parts
          } else {
            userContent = fullPromptText
          }

          // Call LLM via centralized helper (Turbo Mode + Abacus AI fallback)
          let data
          try {
            data = await callLLM(session.user.id, [
              { role: 'system', content: systemContent },
              { role: 'user', content: userContent },
            ], { model: 'gpt-4.1', maxTokens: 16000, temperature: 0.6 })
          } catch (llmErr) {
            console.error(`Batch ${batchNum} error:`, llmErr)
            return []
          }

          const content = data.choices?.[0]?.message?.content || ''

          try {
            const jsonMatch = content.match(/\[\s*\{[\s\S]*\}\s*\]/)
            if (jsonMatch) {
              return JSON.parse(jsonMatch[0])
            }
            return JSON.parse(content)
          } catch (parseErr) {
            console.error(`Batch ${batchNum} parse error:`, parseErr)
            console.error(`Batch ${batchNum} raw:`, content.substring(0, 500))
            return []
          }
        })
      )

      allPrompts = allPrompts.concat(...batchResults)
    }

    console.log(`Generated ${allPrompts.length} prompts total from ${templates.length} templates`)

    return NextResponse.json({ prompts: allPrompts })
  } catch (error) {
    console.error('Generate prompts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
