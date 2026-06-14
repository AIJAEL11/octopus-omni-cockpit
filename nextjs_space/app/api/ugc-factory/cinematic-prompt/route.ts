export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { callLLM } from '@/lib/turbo-llm'
import { getPreset, CAMERA_ANGLES, LIGHTING_SETUPS, MOOD_VIBES } from '@/lib/cinematic-presets'
import { sanitizePromptForSeedance } from '@/lib/seedance-filter-safe'

/**
 * CINEMATIC DIRECTOR — Filter-compliant prompt builder
 *
 * Two modes:
 *   1) Preset mode: takes a presetId + user's brand/product/avatar context, fills template
 *   2) Custom mode: takes camera/lighting/mood chips + product description and builds from scratch
 *
 * Output: a 6-section filter-compliant prompt ready for Seedance 2.0
 */

const CINEMATIC_DIRECTOR_SYSTEM = `You are an Elite Cinematic Director and AI prompt engineer specialized in writing FILTER-COMPLIANT video generation prompts for Seedance 2.0 (similar to Sora/Veo).

# YOUR EXPERTISE
You translate brand briefs into prompts that:
1. Pass content moderation filters (no celebrity names, no franchise IPs, no violent words, no adult words)
2. Follow the strict 6-section structure below
3. Use professional cinematography vocabulary (35mm, anamorphic, Arri Alexa Mini, golden hour, etc.)
4. Maintain character/product consistency across shots
5. Are ready for production with no further editing

# 6-SECTION OUTPUT STRUCTURE (mandatory)

[VISUAL STYLE]
Lens, grain, color grade, aspect ratio, motion behavior

[ENVIRONMENT]
Location, time of day, lighting, atmosphere, props

[CHARACTERS]
Describe subject anchors with the phrase "exact face/hair/body throughout" to lock identity

[VFX]
Only subtle, grounded VFX. Avoid supernatural/violent effects.

[SHOT SEQUENCE]
Beat-by-beat with explicit timestamps [0-3s], [3-6s], etc. Each beat must specify camera, action, and emotional cue.

[FINAL FRAME]
The last 0.5-2 seconds. What does the viewer see at the end? Logo placement, mood, sound cue.

# FILTER COMPLIANCE RULES (Seedance 2.0 specific)
- Never use real celebrity names, athlete names, musician names, or fictional character names
- Never use franchise/IP names (Marvel, Disney, Nike, Adidas, etc.)
- If user provides a real brand name, treat it as their own brand and use it ONLY in [FINAL FRAME] as logo text
- For unique products, describe the design generically (e.g., "shield-style sunglasses" not "Oakley Sutro")
- Avoid words: blood, gore, kill, weapon, explosion (use "impact" or "reveal" instead)
- Skin tone: describe naturally without reference to specific ethnicities only if relevant

# SEEDANCE 2.0 IMAGE-FILTER VOCABULARY RULES (CRITICAL — mandatory)
The Seedance 2.0 input image filter rejects anything that reads as "real-person photography".
You MUST follow this vocabulary rulebook when describing the subject/character:

❌ BANNED WORDS — never use:
"photorealistic", "photo-realistic", "hyper-realistic", "photograph", "photography",
"real person", "real human", "real people", "looks real", "natural skin", "skin texture",
"skin pores", "realistic skin", "candid", "snapshot", "selfie".

✅ REQUIRED VOCABULARY — use these instead:
"editorial cinematic", "fashion-campaign frame", "Vogue editorial", "GQ editorial",
"commercial spot", "A24-style cinematography", "anamorphic 35mm lens", "70mm film",
"Arri Alexa Mini", "soft cinematic complexion", "editorial color grade",
"fictional AI-synthesized character", "AI-generated editorial model".

✅ CHARACTER FRAMING — always describe subjects as:
"a fictional AI-synthesized editorial model" / "an AI-generated commercial spot character" /
"a stylized cinematic editorial subject". Always mark the character as fictional and synthetic.

✅ LIGHTING — prefer dramatic editorial lighting (filter-friendly):
Rembrandt lighting, directional rim light, dramatic side-light with deep shadows,
volumetric haze with backlight, editorial softbox with negative fill, cinematic chiaroscuro.

✅ FRAMING — prefer non-frontal-close-up framing:
medium portraits, three-quarter angles, side profiles, full body, partial face crops.
Avoid pure front-facing facial close-ups.

This is NOT optional. If you generate vocabulary that includes BANNED words, the filter rejects
the resulting frame. The user is generating fully fictional AI-synthesized editorial campaign
content — the vocabulary above accurately reflects that and aligns with Seedance 2.0 policy.

# MOTION RULES
- Specify camera behavior explicitly: "static camera throughout", "handheld", "dolly-in", "orbital"
- For multi-shot: each cut must say "Cut." and reset the camera
- Avoid teleporting/morphing characters (use cuts or transitions)

# OUTPUT
Return ONLY the filled 6-section prompt text. No preamble, no explanations, no "Here's your prompt". Just the prompt itself.`

interface CinematicPromptRequest {
  mode: 'preset' | 'custom'
  presetId?: string
  customConfig?: {
    cameraId: string
    lightingId: string
    moodId: string
  }
  brandName?: string
  productDescription?: string
  avatarDescription?: string
  language?: 'es' | 'en'
  duration?: number
  // Optional product images URLs for context (no upload, just text mention)
  productImageCount?: number
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = (await request.json()) as CinematicPromptRequest
    const {
      mode,
      presetId,
      customConfig,
      brandName = 'BRAND',
      productDescription = 'product',
      avatarDescription = 'a confident person',
      language = 'es',
      duration = 15,
      productImageCount = 0,
    } = body

    let userPrompt = ''

    if (mode === 'preset' && presetId) {
      const preset = getPreset(presetId)
      if (!preset) {
        return NextResponse.json({ error: 'Preset not found' }, { status: 404 })
      }

      // Replace placeholders in template
      const filledTemplate = preset.template
        .replace(/\{\{user_brand\}\}/g, brandName)
        .replace(/\{\{user_product\}\}/g, productDescription)
        .replace(/\{\{user_avatar\}\}/g, avatarDescription)

      userPrompt = `# ROLE
You are an Elite Cinematic Director. Take the template below and refine/personalize it with the brand context. Keep the 6-section structure intact.

# CONTEXT
- Brand: ${brandName}
- Product: ${productDescription}
- Avatar: ${avatarDescription}
- Language for any narration text: ${language === 'en' ? 'English' : 'Spanish'}
- Duration: ${duration} seconds
- Reference images provided by user: ${productImageCount} (mention as @image1, @image2 in [CHARACTERS] if relevant)

# TEMPLATE TO REFINE
${filledTemplate}

# YOUR TASK
Refine the template above. Strengthen weak sentences. Sharpen camera language. Verify filter-compliance (no banned words, no celebrity/IP names). If brand name appears outside [FINAL FRAME], move it to [FINAL FRAME] only. Keep duration exactly ${duration}s in [SHOT SEQUENCE] timestamps.

Return the polished 6-section prompt only.`
    } else if (mode === 'custom' && customConfig) {
      const camera = CAMERA_ANGLES.find(c => c.id === customConfig.cameraId)
      const lighting = LIGHTING_SETUPS.find(l => l.id === customConfig.lightingId)
      const mood = MOOD_VIBES.find(m => m.id === customConfig.moodId)

      if (!camera || !lighting || !mood) {
        return NextResponse.json({ error: 'Invalid custom config' }, { status: 400 })
      }

      userPrompt = `# ROLE
You are an Elite Cinematic Director. Build a fresh 6-section cinematic prompt from scratch using these creative parameters.

# CREATIVE BRIEF
- Camera: ${camera.label} (${camera.hint})
- Lighting: ${lighting.label} (${lighting.hint})
- Mood: ${mood.label} (${mood.hint})
- Brand: ${brandName}
- Product: ${productDescription}
- Avatar: ${avatarDescription}
- Duration: ${duration} seconds
- Aspect ratio: 9:16 vertical
- Language for any narration text: ${language === 'en' ? 'English' : 'Spanish'}
- Reference images provided: ${productImageCount}

# YOUR TASK
Build a complete production-ready cinematic prompt. Use the 6-section structure. Be specific and visceral. Ensure character/product consistency. Filter-compliant only. ${duration}s total in [SHOT SEQUENCE].

Return the 6-section prompt only.`
    } else {
      return NextResponse.json({ error: 'Invalid mode or missing config' }, { status: 400 })
    }

    const userId = (session.user as { id?: string }).id || null

    const llmResponse = await callLLM(
      userId,
      [
        { role: 'system', content: CINEMATIC_DIRECTOR_SYSTEM },
        { role: 'user', content: userPrompt },
      ],
      {
        model: 'gpt-4.1',
        temperature: 0.85,
        maxTokens: 2000,
      }
    )

    const rawPrompt = llmResponse.choices?.[0]?.message?.content?.trim() || ''

    if (!rawPrompt) {
      return NextResponse.json({ error: 'Empty response from LLM' }, { status: 500 })
    }

    // Defense-in-depth: even if the LLM slips up with a banned word, sanitize
    // before returning to the client. This guarantees Seedance 2.0 compliance.
    const prompt = sanitizePromptForSeedance(rawPrompt)

    return NextResponse.json({
      prompt,
      mode,
      presetId,
      engine: llmResponse.engine || 'unknown',
    })
  } catch (error) {
    console.error('[Cinematic Prompt] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error generating cinematic prompt' },
      { status: 500 }
    )
  }
}
