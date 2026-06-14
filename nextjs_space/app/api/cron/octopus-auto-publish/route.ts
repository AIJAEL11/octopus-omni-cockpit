import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { callLLM } from '@/lib/turbo-llm'
import { generateBlogImage } from '@/services/image-generator'
import { authorizePublish } from '@/lib/skills/skill-factory-service'

export const dynamic = 'force-dynamic'
export const maxDuration = 180

function validateCronSecret(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  return token === cronSecret
}

function generateSlug(title: string): string {
  return title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim().substring(0, 100)
}

function toTitleCase(str: string): string {
  const minor = new Set(['a','an','the','and','but','or','nor','for','yet','so','in','on','at','to','by','of','up','as','is','if','it','vs','via','with','from','into','over','upon'])
  return str.split(/\s+/).map((w, i) => {
    if (i === 0) return w.charAt(0).toUpperCase() + w.slice(1)
    if (/^\(/.test(w)) return w
    if (/^[A-Z]{2,}$/.test(w)) return w
    if (minor.has(w.toLowerCase())) return w.toLowerCase()
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  }).join(' ')
}

const CURRENT_YEAR = new Date().getFullYear()
const BLOG_BASE = 'https://octopuskills.com/blog'

const OCTOPUS_CTA = `<div style="margin-top:2.5rem;padding:2rem;background:linear-gradient(135deg,#0F1419,#1A2332);border-radius:16px;border:1px solid #2D4A3E;text-align:center;">
  <p style="font-size:0.85rem;font-weight:600;color:#34d399;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:0.5rem;">🐙 AI Automation Platform</p>
  <h3 style="font-size:1.5rem;font-weight:800;margin-bottom:0.75rem;color:#f8fafc;">Stop Doing Everything Manually</h3>
  <p style="font-size:1.05rem;margin-bottom:1.25rem;color:#94a3b8;">Thousands of solopreneurs are already automating their marketing, sales, and content with Octopus Skills. One platform. 15+ AI modules. Zero coding required.</p>
  <a href="https://octopuskills.com" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:1rem 2.5rem;background:linear-gradient(135deg,#2D4A3E,#059669);color:white;border-radius:12px;text-decoration:none;font-weight:bold;font-size:1.15rem;box-shadow:0 4px 20px rgba(45,74,62,0.4);">Try Octopus Skills Free →</a>
  <p style="margin-top:0.75rem;font-size:0.85rem;color:#64748b;">No credit card. No setup headaches. Just results.</p>
</div>`

const TOPIC_PROMPT = `You are an elite SEO content strategist for Octopus Skills, an AI automation platform for solopreneurs.
You are an expert in AI, marketing automation, and no-code tools. All output must be in American English only.

Generate ONE unique blog article topic about AI automation, no-code tools, or AI-powered business growth.

SEO TITLE FORMULA (MANDATORY):
  [Number] [Primary Keyword] + [Benefit or Warning] (${CURRENT_YEAR})

Examples:
- "7 AI Marketing Tools That Replace a Full Team (${CURRENT_YEAR})"
- "12 No-Code AI Workflows Every Solopreneur Needs (${CURRENT_YEAR})"
- "5 AI Automation Mistakes That Cost Small Businesses Revenue (${CURRENT_YEAR})"

Focus areas: AI marketing automation, no-code AI workflows, AI content creation, AI lead generation, AI video for sales, productivity AI, freelancer AI tools.

META DESCRIPTION: Max 155 chars with keyword and micro-CTA.
CATEGORY: Choose from: ai-automation, marketing, productivity, no-code, case-studies, freelancers
COVER IMAGE PROMPT: 1-2 sentences, minimalist tech style, dark background, AI themed, NO text, NO people.

Return ONLY JSON:
{"title": "Title", "keyword": "keyword", "angle": "angle", "metaDescription": "meta", "category": "ai-automation", "coverImagePrompt": "image desc"}`

function buildArticlePrompt(topic: { title: string; keyword: string; angle: string; metaDescription?: string }): string {
  return `You are MAGUI, the elite SEO content engine for Octopus Skills blog.
All output must be in American English only. ZERO Spanish or other languages.

Write a COMPLETE, LONG-FORM blog article optimized for Google ranking and Featured Snippets.

TOPIC: ${topic.title}
PRIMARY KEYWORD: ${topic.keyword}
ANGLE: ${topic.angle}
YEAR: ${CURRENT_YEAR}
BRAND: Octopus Skills — the AI automation cockpit for solopreneurs and small businesses.

OUTPUT: Return ONLY clean HTML (no JSON wrapper, no markdown fences, no <html>/<body> tags).

━ KEYWORD DENSITY ━
- Use 3-5 semantic variations of "${topic.keyword}" naturally.
- Include 2+ long-tail question keywords as <h3> subheadings.

━ STRUCTURE ━
1. <h2>What [Topic] Really Means in ${CURRENT_YEAR}</h2> — 2-3 paragraphs
2. <h2>[Number] [Keyword Variation] [Benefit]</h2> — <ol> with 7+ items
3. <h2>The Real Business Impact</h2> — 2-3 paragraphs
4. <h2>Frequently Asked Questions</h2> — 4+ questions
5. <h2>What Octopus Skills Experts Recommend</h2> — closing expert analysis

━ CTAs ━
Include 2-3 FOMO CTAs linking to https://octopuskills.com. Vary wording.

━ CLOSING BLOCK ━
End with this EXACT block:
${OCTOPUS_CTA}

━ RULES ━
- Minimum 1200 words, target 2000+.
- Professional, authoritative, business-focused tone.
- ALL headings in Title Case.
- ALL content in AMERICAN ENGLISH. Zero tolerance for non-English text.
- Well-formed HTML, all tags closed.

Write the article NOW. Return ONLY the HTML content.`
}

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('[CRON:octopus-auto-publish] ━━━ Starting daily auto-publish ━━━')

  try {
    // Find the first user (admin/owner)
    const adminUser = await prisma.user.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })
    const userId = adminUser?.id || 'system'
    console.log(`[CRON:octopus-auto-publish] Using userId: ${userId}`)

    // Generate topic
    const topicResponse = await callLLM(userId, [
      { role: 'system', content: TOPIC_PROMPT },
      { role: 'user', content: 'Generate a fresh, unique blog topic for today about AI automation for solopreneurs.' },
    ], { model: 'gpt-4.1', temperature: 0.9, maxTokens: 500 })

    let topic: { title: string; keyword: string; angle: string; metaDescription?: string; category?: string; coverImagePrompt?: string }
    try {
      const topicText = topicResponse.choices[0]?.message?.content || ''
      const jsonMatch = topicText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON')
      topic = JSON.parse(jsonMatch[0])
      if (!topic.title || !topic.keyword) throw new Error('Missing fields')
    } catch {
      topic = {
        title: `7 AI Automation Tools Every Solopreneur Needs in ${CURRENT_YEAR}`,
        keyword: 'AI automation tools solopreneur',
        angle: 'Practical AI tools that save time and money',
        metaDescription: 'Discover the best AI automation tools for solopreneurs. Save hours weekly with these proven solutions.',
        category: 'ai-automation',
      }
    }

    topic.title = toTitleCase(topic.title)
    console.log(`[CRON:octopus-auto-publish] Topic: "${topic.title}"`)

    // Generate article
    const articleResponse = await callLLM(userId, [
      { role: 'system', content: buildArticlePrompt(topic) },
      { role: 'user', content: `Write the complete article about: ${topic.title}` },
    ], { model: 'gpt-4.1', temperature: 0.7, maxTokens: 12000 })

    let articleContent = articleResponse.choices[0]?.message?.content || ''
    articleContent = articleContent.replace(/^```html\n?/i, '').replace(/\n?```$/i, '').trim()

    if (articleContent.length < 800) {
      return NextResponse.json({ success: false, error: `Article too short (${articleContent.length} chars)` }, { status: 500 })
    }

    // Title Case enforcement on headings
    articleContent = articleContent.replace(/<(h[2-6])([^>]*)>(.*?)<\/\1>/gi, (_m, tag, attrs, inner) => {
      const cleaned = inner.replace(/<[^>]+>/g, '').trim()
      return `<${tag}${attrs}>${toTitleCase(cleaned)}</${tag}>`
    })

    // Auto-append CTA if missing
    if (!/octopuskills\.com/i.test(articleContent)) {
      articleContent += '\n' + OCTOPUS_CTA
    }

    // Cover image
    let coverImageUrl: string | null = null
    try {
      const imgResult = await generateBlogImage({
        title: topic.title,
        excerpt: articleContent.substring(0, 200).replace(/<[^>]+>/g, ''),
        category: 'content', slug: generateSlug(topic.title),
        aspectRatio: '16:9', styleOverride: topic.coverImagePrompt || undefined, userId,
      })
      if (imgResult?.imageUrl) coverImageUrl = imgResult.imageUrl
    } catch (imgErr) {
      console.warn('[CRON:octopus-auto-publish] Image gen failed:', imgErr)
    }

    // Security audit
    const publishAuth = authorizePublish({
      agentId: 'octopus-seo-cron', title: topic.title,
      content: articleContent, contentType: 'blog_post', callerContext: 'cron',
    })
    if (!publishAuth.authorized) {
      return NextResponse.json({ success: false, error: `Security blocked: ${publishAuth.reason}` }, { status: 422 })
    }

    // Publish to DB
    const slug = generateSlug(topic.title)
    const textContent = articleContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const wordCount = textContent.split(/\s+/).length
    const readTime = Math.max(1, Math.round(wordCount / 238))

    let finalSlug = slug
    const existing = await prisma.octoBlogPost.findUnique({ where: { slug: finalSlug } })
    if (existing) finalSlug = `${slug}-${Date.now().toString(36)}`

    await prisma.octoBlogPost.create({
      data: {
        title: topic.title, slug: finalSlug, content: articleContent,
        keyword: topic.keyword, metaDescription: topic.metaDescription || null,
        excerpt: topic.metaDescription || textContent.substring(0, 200),
        coverImage: coverImageUrl, category: topic.category || 'ai-automation',
        language: 'en', author: 'Octopus AI', status: 'published',
        readTime, wordCount, views: 0, publishedAt: new Date(),
      },
    })

    const publishedUrl = `${BLOG_BASE}/${finalSlug}`
    const duration = Date.now() - startTime

    // Log
    await prisma.contentPublishLog.create({
      data: {
        userId, agentId: 'octopus-seo-cron', title: topic.title, slug: finalSlug,
        status: 'published', contentType: 'blog_post', publishedUrl,
        payload: JSON.stringify({ title: topic.title, keyword: topic.keyword }).substring(0, 10000),
        response: JSON.stringify({ success: true }), duration,
        metadata: JSON.stringify({ source: 'octopus-auto-publish-cron', coverImage: coverImageUrl, wordCount }),
      },
    }).catch(err => console.error('[CRON:octopus-auto-publish] Log error:', err))

    await prisma.skillExecution.create({
      data: {
        userId, skillId: 'octopus-auto-publish', method: 'daily-publish',
        params: JSON.stringify({ topic, slug: finalSlug, publishedUrl }), success: true,
        duration, trigger: 'auto',
      },
    }).catch(() => {})

    console.log(`[CRON:octopus-auto-publish] ✅ Published: "${topic.title}" at ${publishedUrl} (${duration}ms)`)

    return NextResponse.json({
      success: true, title: topic.title, slug: finalSlug, publishedUrl,
      keyword: topic.keyword, wordCount, coverImage: coverImageUrl, duration,
    })
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(`[CRON:octopus-auto-publish] ❌ ERROR:`, errorMsg)

    await prisma.skillExecution.create({
      data: {
        userId: 'system', skillId: 'octopus-auto-publish', method: 'daily-publish',
        params: JSON.stringify({ error: errorMsg }), success: false, duration, trigger: 'auto', error: errorMsg,
      },
    }).catch(() => {})

    return NextResponse.json({ success: false, error: errorMsg, duration }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const lastRun = await prisma.skillExecution.findFirst({
      where: { skillId: 'octopus-auto-publish' },
      orderBy: { createdAt: 'desc' },
      select: { success: true, duration: true, params: true, error: true, createdAt: true },
    })
    const totalRuns = await prisma.skillExecution.count({ where: { skillId: 'octopus-auto-publish' } })
    const successfulRuns = await prisma.skillExecution.count({ where: { skillId: 'octopus-auto-publish', success: true } })
    return NextResponse.json({
      status: 'active',
      lastRun: lastRun ? { success: lastRun.success, duration: lastRun.duration, timestamp: lastRun.createdAt, error: lastRun.error } : null,
      stats: { totalRuns, successfulRuns, failedRuns: totalRuns - successfulRuns },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 })
  }
}
