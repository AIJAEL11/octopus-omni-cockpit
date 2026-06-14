import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { callLLM } from '@/lib/turbo-llm'
import { generateBlogImage } from '@/services/image-generator'
import { authorizePublish } from '@/lib/skills/skill-factory-service'

export const dynamic = 'force-dynamic'
export const maxDuration = 180 // Extended for image generation step

// ── Security: Validate cron secret ──
function validateCronSecret(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  return token === cronSecret
}

// ── Decrypt API key ──
function decryptApiKey(encrypted: string): string {
  try {
    const decoded = Buffer.from(encrypted, 'base64').toString('utf-8')
    const salt = process.env.NEXTAUTH_SECRET || 'octopus-salt'
    return decoded.replace(`${salt}:`, '')
  } catch {
    return encrypted
  }
}

// ── Slug generator ──
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .substring(0, 100)
}

// ── Topic generation prompt (SEO Pillar 1: H1/Title Architecture + Pillar 6: Meta) ──
const CURRENT_YEAR = new Date().getFullYear()

const TOPIC_GENERATION_PROMPT = `You are an elite SEO content strategist for Wildverse, a food transparency platform.
You are an expert English-speaking nutritionist. All output, titles, and body text must be in American English only, regardless of the input language.

Generate ONE unique blog article topic about food science, nutrition transparency, or ingredient analysis.

SEO TITLE FORMULA (MANDATORY — every title MUST follow this):
  [Number] [Primary Keyword] + [Benefit or Warning] ([Year])
  The number goes FIRST. The primary keyword appears within the first 60 characters.
  Always end with (${CURRENT_YEAR}) or reference the current year.

Examples of CORRECT titles:
- "7 Hidden Sugars in 'Healthy' Foods That Spike Your Blood Sugar (${CURRENT_YEAR})"
- "12 Ultra-Processed Ingredients Linked to Chronic Inflammation (${CURRENT_YEAR})"
- "5 Artificial Sweeteners the FDA Still Allows — and Why Experts Worry (${CURRENT_YEAR})"
- "9 Nutrition Label Tricks Brands Use to Hide Sugar (${CURRENT_YEAR})"
- "6 Seed Oil Facts That Change Everything You Thought You Knew (${CURRENT_YEAR})"

POWER WORDS to weave in: "Exposed", "Hidden", "Dangerous", "Proven", "Shocking", "Banned", "Secret", "Critical".

Focus areas: hidden sugars, ultra-processed ingredients, food additives, artificial sweeteners, nutrition labels, clean eating, food transparency, ingredient safety.

META DESCRIPTION: Also generate a meta description of MAX 155 characters that:
- Contains the primary keyword
- Ends with a micro-CTA (e.g. "Scan yours free.", "Check your labels now.", "See the full list.")

COVER IMAGE PROMPT: Also generate a short (1-2 sentence) image prompt describing an ideal editorial cover photo for this article.
- Style: minimalist, Apple-style product photography, clean white background, abstract representation
- Health/food science themed, professional medical editorial aesthetic
- NO text in the image, NO people, just objects/ingredients/abstract elements

Return ONLY a JSON object, no markdown, no explanation:
{"title": "SEO Title Here", "keyword": "primary keyword", "angle": "brief unique angle", "metaDescription": "Max 155 char meta description with CTA", "coverImagePrompt": "Short editorial image description"}

IMPORTANT: Be creative. Target HIGH-VOLUME search keywords. Think trending topics people search RIGHT NOW.`

// ── Existing blog posts for internal linking ──
const EXISTING_BLOG_POSTS = [
  { url: 'https://blog.wildverse.io/blog/artificial-sweeteners-side-effects-what-recent-studies-reveal', title: 'Artificial Sweeteners Side Effects' },
  { url: 'https://blog.wildverse.io/blog/hidden-sugar-alcohols-are-they-really-safe-in-sugar-free-foods', title: 'Hidden Sugar Alcohols Safety' },
  { url: 'https://blog.wildverse.io/blog/ai-vs-hidden-sugars-in-food-3-second-truth', title: 'AI vs Hidden Sugars in Food' },
]
const SCANNER_URL = 'https://blog.wildverse.io/scan'
const BLOG_BASE_URL = 'https://blog.wildverse.io/blog/'

// ── Article generation prompt (VERA SEO Engine — 6 Pillars) ──
function buildArticlePrompt(topic: { title: string; keyword: string; angle: string; metaDescription?: string }): string {
  const internalLinks = EXISTING_BLOG_POSTS.map(p => `  - <a href="${p.url}">${p.title}</a>`).join('\n')

  return `You are VERA, the elite SEO content engine for Wildverse blog.
You are an expert English-speaking nutritionist. All output — titles, headings, body text, FAQ answers, and every word — must be in American English only. ZERO Spanish or other languages. No exceptions.

Write a COMPLETE, LONG-FORM blog article optimized for Google ranking and Featured Snippets.

TOPIC: ${topic.title}
PRIMARY KEYWORD: ${topic.keyword}
ANGLE: ${topic.angle}
YEAR: ${CURRENT_YEAR}

OUTPUT: Return ONLY clean HTML (no JSON wrapper, no markdown fences, no <html>/<body> tags).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PILLAR 2 — SEMANTIC KEYWORD DENSITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Use 3-5 semantic variations of "${topic.keyword}" throughout the article.
  Example: if keyword is "hidden sugars" also use "added sugars", "concealed sweeteners", "sugar content", "stealth sugars".
- Sprinkle these variations naturally — never keyword-stuff.
- Include at least 2 long-tail question keywords as <h3> subheadings (e.g. "Is [keyword] really dangerous?", "How does [keyword] affect your body?").

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PILLAR 3 — STRUCTURE FOR FEATURED SNIPPETS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Every section MUST have a proper <h2> or <h3> heading. The article structure:

1. <h2>What [Topic] Really Means in ${CURRENT_YEAR}</h2>
   → 2-3 paragraphs: definition, scientific context, hard data with numbers.
   → Include at least ONE statistic or study reference.

2. <h2>[Number] [Keyword Variation] [Benefit/Warning]</h2>
   → Example: "8 Hidden Sugars That Sabotage Your Diet"
   → Use <ol> with <li> items. Each item:
     <li><strong>Item Name</strong> — description with data/context (40+ words per item)</li>
   → Minimum 5 items, ideally 7-10.

3. <h2>How [Topic] Affects Your Health — What Science Says</h2>
   → 2-3 paragraphs with studies, data points, expert perspectives.
   → Include a <h3> long-tail question like "Can [keyword] cause [health issue]?"

4. <h2>Frequently Asked Questions About ${topic.keyword}</h2>
   → Minimum 4 questions people ACTUALLY search on Google.
   → Format: <h3>Question?</h3> followed by <p>Answer (60+ words, definitive, snippet-friendly)</p>
   → First sentence of each answer should be a direct, concise response (Google Featured Snippet format).

5. <h2>What Wildverse Experts Recommend</h2>
   → Expert-tone closing analysis, 2 paragraphs.
   → Reference specific findings from the article.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PILLAR 4 — INTERNAL LINKING & CONVERSION CTAs
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Naturally link to 2-3 of these existing Wildverse articles where contextually relevant:
${internalLinks}
- Use descriptive anchor text (NOT "click here" — use the topic as anchor).
- Include 2-3 VISCERAL CTAs throughout the article (not just at the end). Each CTA must create URGENCY and FOMO — make the reader feel they are missing out by NOT scanning their food:
  CTA option 1: <p><strong>Thousands are already scanning their food daily.</strong> Don't eat blind — <a href="${SCANNER_URL}">see what's really in your food with Wildverse</a>.</p>
  CTA option 2: <p><strong>Still guessing what's in your food?</strong> One free scan with <a href="${SCANNER_URL}">Wildverse</a> shows you everything the label hides — in 3 seconds.</p>
  CTA option 3: <p><strong>Your neighbor already scanned their pantry. Have you?</strong> Try <a href="${SCANNER_URL}">Wildverse free</a> — the AI food scanner trusted by health-conscious families.</p>
- VARY the wording — never repeat the same CTA. Place after a shocking fact or key revelation.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PILLAR 5 — TRANSACTIONAL WRAP-UP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
End the article with this EXACT closing block:

<div style="margin-top:2.5rem;padding:2rem;background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:16px;border:1px solid #334155;text-align:center;">
  <p style="font-size:0.85rem;font-weight:600;color:#4ade80;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:0.5rem;">🦖 Free AI Scanner</p>
  <h3 style="font-size:1.5rem;font-weight:800;margin-bottom:0.75rem;color:#f8fafc;">What Are You Really Eating?</h3>
  <p style="font-size:1.05rem;margin-bottom:1.25rem;color:#94a3b8;">Thousands of people are already scanning their groceries with Wildverse. One scan reveals every hidden additive, sugar, and chemical in your food — in 3 seconds. Don't be the last to know what's on your plate.</p>
  <a href="${SCANNER_URL}" style="display:inline-block;padding:1rem 2.5rem;background:linear-gradient(135deg,#16a34a,#059669);color:white;border-radius:12px;text-decoration:none;font-weight:bold;font-size:1.15rem;box-shadow:0 4px 20px rgba(22,163,74,0.4);">Start Scanning Free →</a>
  <p style="margin-top:0.75rem;font-size:0.85rem;color:#64748b;">No downloads. No signup. Just the truth about your food.</p>
</div>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WRITING RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Minimum 1200 words total, 150+ per H2 section.
- Professional, authoritative tone — backed by data and science.
- Use real statistics, study references, and expert quotes when possible.
- ZERO typos. Double-check every brand name and technical term.
- Well-formed HTML — all tags properly closed.
- CRITICAL: ALL content MUST be written in AMERICAN ENGLISH. No Spanish, no mixed languages. The blog audience is strictly English-speaking. Zero tolerance for non-English text in titles, headings, body, FAQ, or any section.
- Do NOT wrap in <html>, <head>, or <body> tags — just the article content.

Write the article NOW. Return ONLY the HTML content.`
}

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  
  // Security check
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('[CRON:auto-publish] \u2501\u2501\u2501 Starting daily auto-publish \u2501\u2501\u2501')

  try {
    // ── Step 1: Find the admin user with content_publisher configured ──
    const publisherConfig = await prisma.apiKey.findFirst({
      where: { serviceType: 'content_publisher', status: 'active' },
    })

    if (!publisherConfig || !publisherConfig.baseUrl) {
      console.error('[CRON:auto-publish] No active content_publisher config found')
      return NextResponse.json({
        success: false,
        error: 'No content_publisher configured',
        duration: Date.now() - startTime
      }, { status: 404 })
    }

    const userId = publisherConfig.userId
    console.log(`[CRON:auto-publish] Using publisher config for user: ${userId}`)

    // ── Step 2: Generate a topic via LLM ──
    console.log('[CRON:auto-publish] Generating topic...')
    const topicResponse = await callLLM(userId, [
      { role: 'system', content: TOPIC_GENERATION_PROMPT },
      { role: 'user', content: 'Generate a fresh, unique blog topic for today. Make it trending and SEO-optimized.' }
    ], { model: 'gpt-4.1', temperature: 0.9, maxTokens: 500 })

    let topic: { title: string; keyword: string; angle: string; metaDescription?: string; coverImagePrompt?: string }
    try {
      const topicText = topicResponse.choices[0]?.message?.content || ''
      // Extract JSON from response (handle markdown fences)
      const jsonMatch = topicText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON found in topic response')
      topic = JSON.parse(jsonMatch[0])
      if (!topic.title || !topic.keyword) throw new Error('Missing title or keyword')
    } catch (parseErr) {
      console.error('[CRON:auto-publish] Failed to parse topic:', parseErr)
      // Fallback topic
      topic = {
        title: `7 Hidden Food Additives Your Labels Don't Reveal (${CURRENT_YEAR})`,
        keyword: 'hidden food additives',
        angle: 'Exposing common additives that bypass label requirements',
        metaDescription: 'Discover 7 hidden food additives lurking in everyday products. Check your labels now.',
        coverImagePrompt: 'Minimalist arrangement of food additive molecules and ingredient containers on clean white surface'
      }
    }

    console.log(`[CRON:auto-publish] Topic: "${topic.title}" (keyword: ${topic.keyword})`)

    // ── Step 3: Generate the full article via LLM ──
    console.log('[CRON:auto-publish] Generating article...')
    const articleResponse = await callLLM(userId, [
      { role: 'system', content: buildArticlePrompt(topic) },
      { role: 'user', content: `Write the complete article about: ${topic.title}` }
    ], { model: 'gpt-4.1', temperature: 0.7, maxTokens: 12000 })

    let articleContent = articleResponse.choices[0]?.message?.content || ''
    
    // Clean up markdown fences if present
    articleContent = articleContent.replace(/^```html\n?/i, '').replace(/\n?```$/i, '').trim()
    
    if (articleContent.length < 800) {
      console.error('[CRON:auto-publish] Article too short:', articleContent.length)
      return NextResponse.json({
        success: false,
        error: `Article too short (${articleContent.length} chars)`,
        topic,
        duration: Date.now() - startTime
      }, { status: 500 })
    }

    console.log(`[CRON:auto-publish] Article generated: ${articleContent.length} chars`)

    // ── Step 3.5: Generate cover image via Skill Factory Image Module ──
    let coverImageUrl: string | null = null
    try {
      console.log('[CRON:auto-publish] 🎨 skill_factory_painting — Generating cover image...')
      const imgResult = await generateBlogImage({
        title: topic.title,
        excerpt: articleContent.substring(0, 200).replace(/<[^>]+>/g, ''),
        category: 'content',
        slug: generateSlug(topic.title),
        aspectRatio: '16:9',
        styleOverride: topic.coverImagePrompt || undefined,
        userId,
      })
      if (imgResult?.imageUrl) {
        coverImageUrl = imgResult.imageUrl
        console.log(`[CRON:auto-publish] 🎨 Cover image generated: ${coverImageUrl.substring(0, 120)}... (cached: ${imgResult.cached})`)
      } else {
        console.warn('[CRON:auto-publish] 🎨 Image generation returned null — publishing without cover')
      }
    } catch (imgErr) {
      console.warn('[CRON:auto-publish] 🎨 Image generation failed (non-blocking):', imgErr)
    }

    // ── Step 3.8: 🛡️ SKILL FACTORY SECURITY PROTOCOL — Audit before publish ──
    const publishAuth = authorizePublish({
      agentId: 'vera',
      title: topic.title,
      content: articleContent,
      contentType: 'blog_post',
      callerContext: 'cron',
    })

    console.log(`[CRON:auto-publish] 🛡️ Security: mode=${publishAuth.mode}, trust=${publishAuth.trustLevel}, authorized=${publishAuth.authorized}, audit=${publishAuth.audit.audit_status} (score: ${publishAuth.audit.quality_score}/100)`)

    if (!publishAuth.authorized) {
      console.error(`[CRON:auto-publish] ❌ BLOCKED by Security Protocol: ${publishAuth.reason}`)
      return NextResponse.json({
        success: false,
        error: `Security protocol blocked publish: ${publishAuth.reason}`,
        security: {
          mode: publishAuth.mode,
          trustLevel: publishAuth.trustLevel,
          audit_status: publishAuth.audit.audit_status,
          zero_stats_audit: publishAuth.audit.zero_stats_audit,
          quality_score: publishAuth.audit.quality_score,
          flags: publishAuth.audit.flags,
        },
        topic,
        duration: Date.now() - startTime
      }, { status: 422 })
    }

    console.log(`[CRON:auto-publish] ✅ Security CLEARED — ${publishAuth.mode} mode, direct publish authorized`)

    // ── Step 4: Publish to the blog endpoint ──
    const apiKey = decryptApiKey(publisherConfig.apiKey)
    const endpointUrl = publisherConfig.baseUrl
    const slug = generateSlug(topic.title)

    const publishPayload: Record<string, string> = {
      title: topic.title,
      content: articleContent,
      slug,
      status: 'published'
    }
    // Include meta description if available (Pillar 6)
    if (topic.metaDescription) {
      publishPayload.metaDescription = topic.metaDescription
    }
    // Include cover image if generated
    if (coverImageUrl) {
      publishPayload.cover_image = coverImageUrl
      publishPayload.coverImage = coverImageUrl
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'x-real-source': 'octopus-content-publisher',
    }

    console.log(`[CRON:auto-publish] Publishing to ${endpointUrl}...`)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(publishPayload),
      signal: controller.signal
    })

    clearTimeout(timeout)

    let responseText = ''
    try { responseText = await response.text() } catch { responseText = 'No response body' }

    let respJson: Record<string, unknown> = {}
    try { respJson = JSON.parse(responseText) } catch { /* non-JSON */ }

    const publishedUrl = (respJson.url || respJson.published_url || respJson.link || '') as string
    const duration = Date.now() - startTime

    // ── Step 5: Log the result ──
    await prisma.contentPublishLog.create({
      data: {
        userId,
        agentId: 'cron-auto-publish',
        title: topic.title,
        slug,
        status: response.ok ? 'published' : 'error',
        contentType: 'blog_post',
        publishedUrl: publishedUrl || null,
        payload: JSON.stringify(publishPayload).substring(0, 10000),
        response: responseText.substring(0, 5000),
        duration,
        error: response.ok ? null : `HTTP ${response.status}: ${responseText.substring(0, 500)}`,
        metadata: JSON.stringify({
          source: 'cron-auto-publish',
          topic,
          httpStatus: response.status,
          articleLength: articleContent.length,
          model: articleResponse.model || 'gpt-4.1',
          metaDescription: topic.metaDescription || null,
          coverImage: coverImageUrl || null,
          coverImagePrompt: topic.coverImagePrompt || null,
          seoPillars: 'v2-6pillars',
          imageModule: coverImageUrl ? 'active' : 'skipped',
          securityProtocol: {
            mode: publishAuth.mode,
            trustLevel: publishAuth.trustLevel,
            audit_status: publishAuth.audit.audit_status,
            zero_stats_audit: publishAuth.audit.zero_stats_audit,
            quality_score: publishAuth.audit.quality_score,
          },
          timestamp: new Date().toISOString()
        })
      }
    }).catch(err => console.error('[CRON:auto-publish] Log error:', err))

    // Update usage count
    if (response.ok) {
      await prisma.apiKey.update({
        where: { id: publisherConfig.id },
        data: { usageCount: { increment: 1 }, lastUsed: new Date() }
      }).catch(() => {})
    }

    // ── Step 6: Update last run timestamp ──
    await prisma.skillExecution.create({
      data: {
        userId,
        skillId: 'cron-auto-publish',
        method: 'daily-publish',
        params: JSON.stringify({ topic, slug, publishedUrl }),
        success: response.ok,
        duration,
        trigger: 'auto',
        error: response.ok ? null : `HTTP ${response.status}`,
      }
    }).catch(() => {})

    if (response.ok) {
      console.log(`[CRON:auto-publish] \u2705 SUCCESS: "${topic.title}" published at ${publishedUrl} (${duration}ms)`)
      return NextResponse.json({
        success: true,
        title: topic.title,
        slug,
        publishedUrl,
        keyword: topic.keyword,
        articleLength: articleContent.length,
        coverImage: coverImageUrl || null,
        metaDescription: topic.metaDescription || null,
        httpStatus: response.status,
        duration,
        serverResponse: respJson
      })
    } else {
      console.error(`[CRON:auto-publish] \u274c FAILED: HTTP ${response.status} \u2014 ${responseText.substring(0, 200)}`)
      return NextResponse.json({
        success: false,
        title: topic.title,
        error: `HTTP ${response.status}: ${responseText.substring(0, 500)}`,
        duration
      }, { status: 502 })
    }
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(`[CRON:auto-publish] \u274c FATAL ERROR:`, errorMsg)

    // Log the failure
    try {
      await prisma.skillExecution.create({
        data: {
          userId: 'system',
          skillId: 'cron-auto-publish',
          method: 'daily-publish',
          params: JSON.stringify({ error: errorMsg }),
          success: false,
          duration,
          trigger: 'auto',
          error: errorMsg,
        }
      })
    } catch { /* ignore logging errors */ }

    return NextResponse.json({
      success: false,
      error: errorMsg,
      duration
    }, { status: 500 })
  }
}

// GET - Check last run status
export async function GET(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const lastRun = await prisma.skillExecution.findFirst({
      where: { skillId: 'cron-auto-publish' },
      orderBy: { createdAt: 'desc' },
      select: {
        success: true,
        duration: true,
        params: true,
        error: true,
        createdAt: true,
      }
    })

    const totalRuns = await prisma.skillExecution.count({
      where: { skillId: 'cron-auto-publish' }
    })

    const successfulRuns = await prisma.skillExecution.count({
      where: { skillId: 'cron-auto-publish', success: true }
    })

    return NextResponse.json({
      status: 'active',
      lastRun: lastRun ? {
        success: lastRun.success,
        duration: lastRun.duration,
        timestamp: lastRun.createdAt,
        details: lastRun.params ? JSON.parse(lastRun.params) : null,
        error: lastRun.error
      } : null,
      stats: {
        totalRuns,
        successfulRuns,
        failedRuns: totalRuns - successfulRuns
      }
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 })
  }
}
