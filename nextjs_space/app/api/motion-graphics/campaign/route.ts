export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { callLLM } from '@/lib/turbo-llm'

// POST: Generate campaign content (ad copies, CTAs, landing concept)
// Video generation is handled separately by the existing generate endpoint
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { goal, audience, prompt, refinedPrompt, language } = await request.json()

    if (!prompt || !goal) {
      return NextResponse.json({ error: 'prompt and goal are required' }, { status: 400 })
    }

    const lang = language || 'es'
    const effectivePrompt = refinedPrompt || prompt

    // --- STEP 1: Generate 3 ad copy variations (AIDA, PAS, Curiosity Hook) ---
    // The video prompt IS the creative seed — all text must derive from the same narrative
    const copiesPrompt = `You are an elite direct-response copywriter. Your ONLY source of creative direction is the VIDEO PROMPT below. Every headline, every line of body copy, every CTA must be a direct creative extension of the scene, emotion, and story described in this video.

=== VIDEO PROMPT (THIS IS YOUR CREATIVE BIBLE) ===
${effectivePrompt}
=== END VIDEO PROMPT ===

Campaign Goal: ${goal}
Target Audience: ${audience || 'General audience'}

RULES:
- The ad copy must feel like it was written BY someone who just watched the video described above.
- Reference specific imagery, emotions, objects, or transformations from the video prompt.
- Example: if the video shows "a guy sweating without AC", the headline could be "Stop Sweating the Small Stuff" and the body should extend that heat/relief metaphor.
- Example: if the video shows "a product rotating with a golden glow", lean into luxury/premium language that matches the visual.
- DO NOT write generic marketing copy. Every word must be traceable back to the video's narrative thread.

Generate exactly 3 variations using these frameworks:
1. AIDA (Attention → Interest → Desire → Action)
2. PAS (Problem → Agitation → Solution)
3. Curiosity Hook (Open loop that creates irresistible curiosity)

For EACH variation, provide:
- headline (max 10 words, punchy, rooted in the video imagery)
- body (max 80 words, extends the video's emotional thread)
- cta (call-to-action button text, max 5 words)
- framework ("AIDA", "PAS", or "Curiosity Hook")

Respond in valid JSON only, no markdown:
{"copies": [{"headline": "", "body": "", "cta": "", "framework": ""}]}

Write in ${lang === 'es' ? 'Spanish' : 'English'}.`

    let copies: Array<{ headline: string; body: string; cta: string; framework: string }> = []
    try {
      const copiesRes = await callLLM(session.user.id, [
        { role: 'system', content: 'You are an expert direct-response copywriter who writes ad copy that is a DIRECT creative extension of the video it accompanies. Never write generic copy. Every word must be traceable to the video prompt. Output valid JSON only.' },
        { role: 'user', content: copiesPrompt },
      ], { model: 'gpt-4.1', maxTokens: 2000, temperature: 0.8 })
      const raw = copiesRes.choices?.[0]?.message?.content || ''
      const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
      const parsed = JSON.parse(cleaned)
      copies = parsed.copies || []
    } catch (e) {
      console.error('[Campaign] Copies generation failed:', e)
      copies = [
        { headline: 'Transform Your Business Today', body: 'Discover the solution that changes everything.', cta: 'Get Started', framework: 'AIDA' },
        { headline: 'Tired of Struggling?', body: 'There is a better way. See how.', cta: 'Learn More', framework: 'PAS' },
        { headline: 'What if you could...', body: 'The answer might surprise you.', cta: 'Find Out', framework: 'Curiosity Hook' },
      ]
    }

    // --- STEP 2: Generate CTA suggestions ---
    // CTAs must also be context-aware, derived from the video narrative
    const ctaPrompt = `You are a CTA conversion specialist. Your CTAs must be DIRECTLY inspired by the video described below. Do NOT write generic CTAs like "Learn More" or "Get Started". Every CTA must feel like a natural next step for someone who just watched this specific video.

=== VIDEO PROMPT (YOUR CREATIVE CONTEXT) ===
${effectivePrompt}
=== END VIDEO PROMPT ===

Campaign Goal: ${goal}
Target Audience: ${audience || 'General audience'}
Best Headline from Ad Copy: ${copies[0]?.headline || ''}

RULES:
- Each CTA should extend the video's metaphor, emotion, or transformation.
- Example: if the video is about sweating → "Cool Down Now", "End the Heat", "Feel the Breeze"
- Example: if the video is about speed/energy → "Accelerate Today", "Don't Slow Down"
- Mix urgency levels but keep the narrative thread consistent with the video.

Generate 6 CTAs. For each provide:
- text (button text, max 5 words, video-inspired)
- subtext (supporting text below the CTA, max 12 words, references the video story)
- urgency ("low", "medium", "high")

Respond in valid JSON only:
{"ctas": [{"text": "", "subtext": "", "urgency": ""}]}

Write in ${lang === 'es' ? 'Spanish' : 'English'}.`

    let ctas: Array<{ text: string; subtext: string; urgency: string }> = []
    try {
      const ctaRes = await callLLM(session.user.id, [
        { role: 'system', content: 'You are a CTA conversion specialist who crafts CTAs that are direct extensions of the video narrative. Every CTA must feel like a natural next step after watching the specific video. No generic CTAs. Output valid JSON only.' },
        { role: 'user', content: ctaPrompt },
      ], { model: 'gpt-4.1', maxTokens: 1000, temperature: 0.7 })
      const raw = ctaRes.choices?.[0]?.message?.content || ''
      const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
      const parsed = JSON.parse(cleaned)
      ctas = parsed.ctas || []
    } catch (e) {
      console.error('[Campaign] CTAs generation failed:', e)
      ctas = [
        { text: 'Start Free Trial', subtext: 'No credit card required', urgency: 'medium' },
        { text: 'Get Started Now', subtext: 'Limited time offer', urgency: 'high' },
        { text: 'See It In Action', subtext: 'Watch the demo', urgency: 'low' },
      ]
    }

    // --- STEP 3: Generate landing page concept ---
    // Landing page must continue the exact same emotional/narrative thread from the video
    const landingPrompt = `You are a landing page architect. The user just watched a video ad. Your landing page must feel like the NATURAL CONTINUATION of that video — same emotional thread, same imagery references, same transformation arc.

=== VIDEO PROMPT (THE STORY THE VIEWER JUST SAW) ===
${effectivePrompt}
=== END VIDEO PROMPT ===

=== AD COPY THAT BROUGHT THEM HERE ===
Headline: ${copies[0]?.headline || ''}
Body: ${copies[0]?.body || ''}
CTA: ${copies[0]?.cta || ''}
=== END AD COPY ===

Campaign Goal: ${goal}
Target Audience: ${audience || 'General audience'}

RULES:
- The heroHeadline must echo the video's core transformation or emotional moment.
- painPoints should mirror the "before" state shown in the video.
- benefits should mirror the "after" state / resolution shown in the video.
- The socialProof testimonial should reference the same scenario from the video.
- Example: if the video shows someone sweating → pain point: "The unbearable heat that ruins your day", benefit: "Instant, whisper-quiet cooling that transforms any room", testimonial: "I used to dread summer afternoons..."
- DO NOT generate a generic SaaS landing page. This must feel custom-made for THIS specific video.

Generate a landing page structure with:
- heroHeadline (max 12 words, extends the video's emotional climax)
- heroSubheadline (max 25 words, bridges video → offer)
- painPoints (array of 3 pain points drawn from the video's "problem" scenes)
- benefits (array of 3 benefits drawn from the video's "solution/transformation" scenes)
- socialProof (a realistic testimonial that references the same scenario: quote + name + role)
- urgencyElement (scarcity/urgency text tied to the campaign goal)
- primaryCta (main button text, consistent with the video's narrative arc)

Respond in valid JSON only:
{"landing": {"heroHeadline": "", "heroSubheadline": "", "painPoints": [], "benefits": [], "socialProof": {"quote": "", "name": "", "role": ""}, "urgencyElement": "", "primaryCta": ""}}

Write in ${lang === 'es' ? 'Spanish' : 'English'}.`

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let landing: Record<string, any> = {}
    try {
      const landingRes = await callLLM(session.user.id, [
        { role: 'system', content: 'You are a landing page architect who designs pages that feel like the natural continuation of a video ad. The landing must extend the same emotional thread, imagery, and transformation shown in the video. Never produce generic landing pages. Output valid JSON only.' },
        { role: 'user', content: landingPrompt },
      ], { model: 'gpt-4.1', maxTokens: 1500, temperature: 0.7 })
      const raw = landingRes.choices?.[0]?.message?.content || ''
      const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
      const parsed = JSON.parse(cleaned)
      landing = parsed.landing || parsed
    } catch (e) {
      console.error('[Campaign] Landing generation failed:', e)
      landing = {
        heroHeadline: 'Transform Your Results Today',
        heroSubheadline: 'The all-in-one solution you have been looking for.',
        painPoints: ['Wasting time on manual work', 'Inconsistent results', 'Missing opportunities'],
        benefits: ['Save 10+ hours per week', 'Professional quality every time', 'Never miss a lead'],
        socialProof: { quote: 'This changed everything for our team.', name: 'Alex Rivera', role: 'Marketing Director' },
        urgencyElement: 'Only 50 spots available this month',
        primaryCta: 'Get Started Free',
      }
    }

    // --- Save campaign to DB ---
    const campaignData = {
      goal,
      audience: audience || null,
      prompt,
      refinedPrompt: effectivePrompt,
      copies,
      ctas,
      landing,
      videos: [], // Will be populated by frontend when videos complete
    }

    const asset = await prisma.creativeAsset.create({
      data: {
        userId: session.user.id,
        type: 'campaign',
        title: `Campaign — ${goal}`,
        prompt: effectivePrompt,
        content: '', // No video content yet
        platform: 'general',
        format: 'campaign',
        status: 'ready',
        tags: 'campaign,motion-graphics',
        metadata: JSON.stringify(campaignData),
      },
    })

    return NextResponse.json({
      success: true,
      campaignId: asset.id,
      copies,
      ctas,
      landing,
    })
  } catch (error) {
    console.error('[Campaign] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET: Fetch user's campaigns
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '5'), 20)

    const campaigns = await prisma.creativeAsset.findMany({
      where: {
        userId: session.user.id,
        format: 'campaign',
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        title: true,
        prompt: true,
        metadata: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ campaigns })
  } catch (error) {
    console.error('[Campaign] GET Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
