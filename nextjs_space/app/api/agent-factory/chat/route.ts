import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { callLLMStream } from '@/lib/turbo-llm'
import { prisma } from '@/lib/prisma'
import { generateBlogImage } from '@/services/image-generator'
import { authorizePublish } from '@/lib/skills/skill-factory-service'
import { runWildverseSEOPipeline, runWildverseSEOSeries } from '@/app/api/skills/wildverse-seo/pipeline'
import { runOctopusSEOPipeline, runOctopusSEOSeries } from '@/app/api/skills/octopus-seo/pipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// ── Tool definitions that get injected into agent system prompts ──

const CONTENT_PUBLISH_TOOL_PROMPT = `

═══ REAL TOOL: content_publish ═══
You have access to a REAL tool for publishing content to the user's blog.
When the user asks you to publish, write, or send an article/post to the blog, you MUST use this tool.

To execute the publish, emit EXACTLY this block in your response:

<<<TOOL_CALL:content_publish>>>
{"title": "Article Title in English", "content": "<p>HTML content of the article in English</p>", "slug": "article-title-slug", "contentType": "blog_post", "status": "published", "coverImage": "URL of previously generated image (optional)"}
<<<END_TOOL_CALL>>>

TECHNICAL RULES:
1. The TOOL_CALL block must contain valid JSON
2. "title" and "content" are REQUIRED
3. "content" must be valid HTML (use <p>, <h2>, <h3>, <ul>, <li>, <strong>, <em>, etc.)
4. "slug" is optional — auto-generated from title if not included
5. "status" can be "published" or "draft" (default: "published")
6. NEVER simulate or invent a publish response — the system will execute the tool and give you the REAL server response
7. After the TOOL_CALL block, the system will inject the real result. Do NOT invent URLs, IDs or slugs.
8. If the user doesn't provide enough content, ASK before publishing
9. "coverImage" is OPTIONAL — if you previously generated an image with generate_image, INCLUDE the URL here as the article cover
10. When generating an image AND publishing, ALWAYS generate the image FIRST with generate_image, then use content_publish. The system will automatically link the generated image as the article cover.
11. GOLDEN RULE: NEVER publish an article without FIRST generating a cover image with generate_image. The flow is ALWAYS: generate_image → content_publish. No exceptions.
12. You do NOT need to manually copy the image URL to the coverImage field — the system does it automatically. Just make sure to call generate_image FIRST.

⚠️ CRITICAL LANGUAGE RULE — MANDATORY:
ALL article titles, content, headings, FAQ questions, and body text MUST be written in AMERICAN ENGLISH.
Even if the user speaks to you in Spanish or any other language, the PUBLISHED CONTENT must ALWAYS be in English.
The blog audience is English-speaking. ZERO Spanish words in published articles. No exceptions.

═══ DINO-SEO RULES (MANDATORY for ALL articles) ═══
All published content MUST comply with the Wildverse Dino-SEO standard.
These rules are MANDATORY. Do not publish an article that doesn't meet them.

⚠️ LANGUAGE: ALL content MUST be written in AMERICAN ENGLISH. No Spanish. No mixed languages. English only.

🔑 1. TITLE:
   - MUST include at least ONE high search-volume keyword.
   - Valid examples: "Hidden Sugars in Food: What You Need to Know",
     "Ultra-Processed Ingredients: The Complete Guide",
     "Artificial Sweeteners Exposed: A Dino Deep-Dive"
   - INVALID examples: "My New Post", "Article About Things", "Test"
   - The primary keyword MUST appear within the first 60 characters.

📐 2. HTML STRUCTURE (MANDATORY — this structure MUST always be present):
   The "content" HTML MUST contain these sections IN THIS ORDER:

   a) <h2>What is [main topic]?</h2>
      → Clear definition of the problem/topic. 2-3 paragraphs with <p>.
      → Include scientific context or hard data.

   b) <h2>[High-density informational list]</h2>
      → Examples: "Top 10 Hidden Sugars", "Most Common Ultra-Processed Ingredients",
        "Key Data Points About [Topic]"
      → Use <ul><li> or <ol><li> with at least 5-8 items.
      → Each item must have <strong>name</strong> + brief description.

   c) <h2>Frequently Asked Questions</h2>
      → MINIMUM 3 questions that people actually search on Google.
      → Format: <h3>Question?</h3> followed by <p>Answer</p>.
      → Questions must be natural and search-oriented.
      → Examples: "Is it safe to consume [X] every day?",
        "How do I identify [X] on a nutrition label?"

   d) <h2>Dino Insights</h2>
      → Closing section with expert technical analysis.
      → 1-2 paragraphs with expert perspective.
      → Tone: professional but accessible, with a technical flavor.

   e) FINAL CTA (ALWAYS include at the end of content):
      → Insert EXACTLY this HTML block before closing the content:
      <div style="margin-top:2rem;padding:1.5rem;background:#f0fdf4;border-radius:12px;border:1px solid #bbf7d0;text-align:center;">
        <p style="font-size:1.25rem;font-weight:bold;margin-bottom:0.5rem;">🦖 Want to know what's in your food?</p>
        <p style="margin-bottom:1rem;">Scan any product with Wildverse and discover the truth behind the label.</p>
        <a href="https://blog.wildverse.io/scan" style="display:inline-block;padding:0.75rem 2rem;background:#16a34a;color:white;border-radius:8px;text-decoration:none;font-weight:bold;">🦖 Scan with Wildverse</a>
      </div>

🎨 3. TONE AND STYLE:
   - Professional with "Dino" personality — technical but accessible.
   - Use data, statistics, and references whenever possible.
   - Avoid generic or vague language.
   - Every statement must provide informational value.

✅ 4. QUALITY (CLEANUP):
   - ZERO typos. Review before publishing.
   - No errors like "WWorld", "teh", "recieve", etc.
   - Brand names and technical terms correctly spelled.
   - Well-formed HTML — all opened tags must be closed.

📏 5. MINIMUM LENGTH:
   - The complete article must have at least 800 words.
   - Each H2 section must have at least 100 words.
   - The FAQ section must have at least 3 questions with 50+ word answers each.

═══════════════════════════════════════════
`

const IMAGE_GENERATE_TOOL_PROMPT = `

═══ REAL TOOL: generate_image ═══
You have access to a REAL tool for generating images with AI.
When the user asks you to create, generate, design, or produce an image, illustration, banner, cover, visual asset, or any graphic, you MUST use this tool.

To execute the generation, emit EXACTLY this block in your response:

<<<TOOL_CALL:generate_image>>>
{"title": "Short asset description", "prompt": "Detailed description in English of the image to generate", "category": "design", "aspectRatio": "16:9"}
<<<END_TOOL_CALL>>>

TECHNICAL RULES:
1. The TOOL_CALL block must contain valid JSON
2. "title" (asset name) and "prompt" (detailed visual description) are REQUIRED
3. "prompt" MUST ALWAYS be in ENGLISH for maximum generation quality, regardless of conversation language
4. "prompt" must be descriptive and visual: describe composition, colors, style, lighting, objects, mood
5. "category" is optional (design, marketing, content, ai, technology, business, etc.)
6. "aspectRatio" is optional — values: "16:9" (landscape/banner), "1:1" (square), "9:16" (vertical/stories). Default: "16:9"
7. NEVER invent or simulate image URLs — the system will generate the REAL image and give you the URL
8. After the TOOL_CALL block, the system will inject the generated image. You can then comment on the result
9. If the user requests multiple images, use a separate TOOL_CALL for each one
10. Images are generated with Wildverse brand visual style (minimalist, premium, violet-teal gradients)

Example of an effective prompt:
{"title": "Blog cover: AI Food Scanner", "prompt": "Minimalist Apple-style product photography of a smartphone displaying a holographic food nutrition scan, floating geometric health data visualizations around it, soft violet to teal gradient accents, clean white background, premium studio lighting, no text", "category": "technology", "aspectRatio": "16:9"}

⚠️ CRITICAL WORKFLOW RULE:
When the user asks to publish an article or post, ALWAYS follow this flow:
1. FIRST: Generate the cover image with generate_image
2. SECOND: Publish the content with content_publish
The system will AUTOMATICALLY link the generated image as the article cover.
NEVER publish without first generating the cover image.

═══════════════════════════════════════════
`

const OCTOPUS_SEO_TOOL_PROMPT = `

═══ TOOL 1: octopus_seo_publish (Single Article) ═══
Powerful SEO content pipeline for the Octopus Skills blog:
- Topic optimization, article generation (2000+ words, SEO-optimized, English-only)
- Language validation, structure validation, cover image generation
- Direct publish to octopuskills.com/blog

To publish a SINGLE article:
<<<TOOL_CALL:octopus_seo_publish>>>
{"topic": "Topic or subject", "keyword": "SEO keyword (optional)", "instructions": "Angle (optional)"}
<<<END_TOOL_CALL>>>

═══ TOOL 2: octopus_seo_series (3-Article Series) ═══
Publishes a SERIES of 3 interconnected articles about AI automation, no-code tools, or business growth:
- Article 1: AWARENESS (introduces the concept)
- Article 2: DEEP DIVE (explores specific aspects)
- Article 3: ACTION (implementation guide)

To publish a 3-ARTICLE SERIES:
<<<TOOL_CALL:octopus_seo_series>>>
{"theme": "Parent theme for the series", "instructions": "Any specific angle (optional)"}
<<<END_TOOL_CALL>>>

═══════════════════════════════════════════
IMPORTANT RULES:
1. You are MAGUI, the SEO content agent for Octopus Skills
2. Your blog is at octopuskills.com/blog
3. Topics should be about AI automation, no-code tools, marketing automation, and solopreneur business growth
4. NEVER write articles yourself — let the pipeline handle it
5. NEVER generate images yourself — the pipeline handles cover images
6. When user asks for a "series", "sequence", "secuencia", or multiple related articles, use octopus_seo_series
7. When user asks for a single article or blog post, use octopus_seo_publish
═══════════════════════════════════════════
`

const WILDVERSE_SEO_TOOL_PROMPT = `

═══ TOOL 1: wildverse_seo_publish (Single Article) ═══
Powerful SEO content pipeline that handles EVERYTHING:
- Topic optimization, article generation (2000+ words, SEO-optimized, English-only)
- Language & structure validation, cover image generation, publishing

To publish a SINGLE article:
<<<TOOL_CALL:wildverse_seo_publish>>>
{"topic": "Topic or subject", "keyword": "SEO keyword (optional)", "instructions": "Angle (optional)"}
<<<END_TOOL_CALL>>>

═══ TOOL 2: wildverse_seo_series (3-Article Series) ═══
Publishes a SERIES of 3 interconnected articles that build topical authority:
- Article 1: AWARENESS (introduces the problem)
- Article 2: DEEP DIVE (explores a specific alarming aspect)
- Article 3: ACTION (solutions and alternatives)
- Cross-references between articles, series banner in each
- Google LOVES topic clusters — this is premium SEO strategy

To publish a 3-ARTICLE SERIES:
<<<TOOL_CALL:wildverse_seo_series>>>
{"theme": "Parent theme for the series", "instructions": "Any specific angle (optional)"}
<<<END_TOOL_CALL>>>

RULES:
1. Tool blocks must contain valid JSON
2. For single articles: "topic" is required
3. For series: "theme" is required — it should describe the broad parent topic
4. The pipeline generates, validates, and publishes — all automatically
5. NEVER write articles yourself — let the pipeline handle it
6. NEVER generate images yourself — the pipeline handles cover images
7. When user asks for a "series", "sequence", "secuencia", or multiple related articles, use wildverse_seo_series
8. When user asks for a single article or blog post, use wildverse_seo_publish

═══════════════════════════════════════════
`

// Decrypt API key (same logic as content-publish route)
function decryptApiKey(encrypted: string): string {
  try {
    const decoded = Buffer.from(encrypted, 'base64').toString('utf-8')
    const salt = process.env.NEXTAUTH_SECRET || 'octopus-salt'
    return decoded.replace(`${salt}:`, '')
  } catch {
    return encrypted
  }
}

// Generate slug from title
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

// Execute real content publish
async function executeContentPublish(
  userId: string,
  params: { title: string; content: string; slug?: string; contentType?: string; status?: string; agentId?: string; coverImage?: string }
): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
  const startTime = Date.now()
  
  try {
    // Get user's content_publisher config
    const publisherConfig = await prisma.apiKey.findFirst({
      where: { userId, serviceType: 'content_publisher' }
    })

    if (!publisherConfig || !publisherConfig.baseUrl) {
      return { success: false, error: 'No hay endpoint de Content Publisher configurado. Ve a API Hub para configurarlo.' }
    }

    const apiKey = decryptApiKey(publisherConfig.apiKey)
    const endpointUrl = publisherConfig.baseUrl

    // Parse field mapping
    let fieldMapping: Record<string, string> = { title: 'title', content: 'content', slug: 'slug', status: 'status' }
    try {
      const configData = JSON.parse(publisherConfig.name)
      if (configData.fieldMapping) fieldMapping = configData.fieldMapping
    } catch { /* plain name string */ }

    // Build payload
    const publishPayload: Record<string, unknown> = {}
    if (fieldMapping.title) publishPayload[fieldMapping.title] = params.title
    if (fieldMapping.content) publishPayload[fieldMapping.content] = params.content
    if (fieldMapping.slug) publishPayload[fieldMapping.slug] = params.slug || generateSlug(params.title)
    if (fieldMapping.status) publishPayload[fieldMapping.status] = params.status || 'published'

    // 🎨 Cover image: use provided URL or auto-generate
    let coverImageUrl: string | null = params.coverImage || null
    if (!coverImageUrl) {
      try {
        console.log(`[Agent Factory] 🎨 Auto-generating cover image for: "${params.title}"`)
        const imgResult = await generateBlogImage({
          title: params.title,
          excerpt: typeof params.content === 'string' ? params.content.replace(/<[^>]+>/g, '').substring(0, 200) : '',
          category: params.contentType || 'content',
          slug: params.slug || generateSlug(params.title),
          userId,
        })
        if (imgResult?.imageUrl) {
          coverImageUrl = imgResult.imageUrl
          console.log(`[Agent Factory] 🎨 Cover image generated: ${coverImageUrl.substring(0, 120)}...`)
        }
      } catch (imgErr) {
        console.warn('[Agent Factory] 🎨 Image generation skipped (non-blocking):', imgErr)
      }
    } else {
      console.log(`[Agent Factory] 🎨 Using provided cover image: ${coverImageUrl.substring(0, 120)}...`)
    }
    // Attach cover image to payload
    if (coverImageUrl) {
      publishPayload.cover_image = coverImageUrl
      publishPayload.coverImage = coverImageUrl
    }

    // Build headers with auth
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-real-source': 'octopus-content-publisher',
    }
    headers['Authorization'] = `Bearer ${apiKey}`

    console.log(`[Agent Factory] 🚀 REAL HTTP POST to ${endpointUrl}`)
    console.log(`[Agent Factory] Payload:`, JSON.stringify(publishPayload).substring(0, 500))

    // Make the REAL HTTP request
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(publishPayload),
      signal: controller.signal
    })

    clearTimeout(timeout)
    const duration = Date.now() - startTime

    let responseText = ''
    try { responseText = await response.text() } catch { responseText = 'No response body' }

    let respJson: Record<string, unknown> = {}
    try { respJson = JSON.parse(responseText) } catch { /* non-JSON */ }

    const publishedUrl = (respJson.url || respJson.published_url || respJson.link || '') as string

    // Log the publish
    await prisma.contentPublishLog.create({
      data: {
        userId,
        agentId: params.agentId || 'agent-factory',
        title: params.title,
        slug: params.slug || generateSlug(params.title),
        status: response.ok ? 'published' : 'error',
        contentType: params.contentType || 'blog_post',
        publishedUrl: publishedUrl || null,
        payload: JSON.stringify(publishPayload),
        response: responseText.substring(0, 5000),
        duration,
        metadata: JSON.stringify({ source: 'agent-factory', httpStatus: response.status, coverImage: coverImageUrl || null })
      }
    }).catch(err => console.error('[Agent Factory] Log error:', err))

    if (response.ok) {
      // Update usage count
      await prisma.apiKey.update({
        where: { id: publisherConfig.id },
        data: { usageCount: { increment: 1 }, lastUsed: new Date(), status: 'active' }
      }).catch(() => {})

      console.log(`[Agent Factory] ✅ Published successfully: ${publishedUrl} (${duration}ms)`)
      return {
        success: true,
        data: {
          publishedUrl,
          slug: respJson.slug || params.slug || generateSlug(params.title),
          httpStatus: response.status,
          duration,
          serverResponse: respJson,
          message: `Artículo "${params.title}" publicado exitosamente`
        }
      }
    } else {
      console.error(`[Agent Factory] ❌ Publish failed: HTTP ${response.status} — ${responseText.substring(0, 200)}`)
      return {
        success: false,
        error: `HTTP ${response.status}: ${responseText.substring(0, 500)}`
      }
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error(`[Agent Factory] ❌ Publish error:`, errorMsg)
    return { success: false, error: errorMsg }
  }
}

// Execute real image generation
async function executeImageGenerate(
  userId: string,
  params: { title: string; prompt: string; category?: string; aspectRatio?: string; agentId?: string }
): Promise<{ success: boolean; imageUrl?: string; cached?: boolean; error?: string }> {
  try {
    console.log(`[Agent Factory] 🎨 Generating image: "${params.title}"`)
    console.log(`[Agent Factory] 🎨 Prompt: ${params.prompt.substring(0, 200)}...`)

    const result = await generateBlogImage({
      title: params.title,
      excerpt: params.prompt,
      category: params.category || 'design',
      styleOverride: params.prompt,
      slug: `agent-${Date.now()}-${params.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 40)}`,
      aspectRatio: params.aspectRatio || '16:9',
      userId,
    })

    if (result?.imageUrl) {
      console.log(`[Agent Factory] ✅ Image generated: ${result.imageUrl} (cached: ${result.cached})`)
      return { success: true, imageUrl: result.imageUrl, cached: result.cached }
    } else {
      return { success: false, error: 'El servicio de generación no devolvió una imagen' }
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error(`[Agent Factory] ❌ Image gen error:`, errorMsg)
    return { success: false, error: errorMsg }
  }
}



// Parse tool calls from LLM output
function extractToolCalls(text: string): { toolName: string; params: string; fullMatch: string }[] {
  const regex = /<<<TOOL_CALL:(\w+)>>>\s*([\s\S]*?)\s*<<<END_TOOL_CALL>>>/g
  const calls: { toolName: string; params: string; fullMatch: string }[] = []
  let match
  while ((match = regex.exec(text)) !== null) {
    calls.push({ toolName: match[1], params: match[2].trim(), fullMatch: match[0] })
  }
  return calls
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { messages, systemPrompt, model, temperature, maxTokens, agentId } = await req.json()

    if (!messages || !systemPrompt) {
      return NextResponse.json({ error: 'messages y systemPrompt son requeridos' }, { status: 400 })
    }

    const userId = (session.user as { id?: string }).id || session.user.email

    // Detect if this is VERA or MAGUI
    const isVera = agentId?.toLowerCase().includes('vera')
    const isMagui = agentId?.toLowerCase().includes('magui')
    console.log(`[Agent Factory] agentId="${agentId || 'none'}" isVera=${isVera} isMagui=${isMagui}`)

    let enhancedSystemPrompt = systemPrompt

    if (isMagui) {
      // MAGUI gets the Octopus SEO pipeline tools
      enhancedSystemPrompt += OCTOPUS_SEO_TOOL_PROMPT
    } else if (isVera) {
      // VERA only gets the Wildverse SEO pipeline tool
      try {
        const publisherConfig = await prisma.apiKey.findFirst({
          where: { userId, serviceType: 'content_publisher', status: 'active' },
          select: { id: true, baseUrl: true }
        })
        if (publisherConfig?.baseUrl) {
          enhancedSystemPrompt += WILDVERSE_SEO_TOOL_PROMPT
        }
      } catch { /* if DB fails, continue without tool */ }
    } else {
      // Non-VERA agents get the standard manual tools
      enhancedSystemPrompt += IMAGE_GENERATE_TOOL_PROMPT

      try {
        const publisherConfig = await prisma.apiKey.findFirst({
          where: { userId, serviceType: 'content_publisher', status: 'active' },
          select: { id: true, baseUrl: true }
        })
        if (publisherConfig?.baseUrl) {
          enhancedSystemPrompt += CONTENT_PUBLISH_TOOL_PROMPT
        }
      } catch { /* if DB fails, continue without tool */ }
    }

    // Build full message array with enhanced system prompt
    const fullMessages = [
      { role: 'system', content: enhancedSystemPrompt },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content
      }))
    ]

    // Get LLM stream
    const llmResponse = await callLLMStream(userId, fullMessages, {
      model: model || 'gpt-4.1',
      temperature: temperature ?? 0.7,
      maxTokens: maxTokens ?? 8192,
    })

    // All agents have tools (at minimum image gen) — intercept stream for tool call detection
    const reader = llmResponse.body?.getReader()
    if (!reader) {
      return new Response(llmResponse.body, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
      })
    }

    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const stream = new ReadableStream({
      async start(controller) {
        let fullContent = ''
        let buffering = false
        let buffer = ''
        let processedToolCalls = 0  // Track how many tool calls we've already executed
        let lastGeneratedImageUrl: string | null = null  // Track last image URL for auto-linking to publish

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n')

            for (const line of lines) {
              if (!line.startsWith('data: ')) {
                // Forward non-data lines
                controller.enqueue(encoder.encode(line + '\n'))
                continue
              }

              const data = line.slice(6).trim()
              if (data === '[DONE]') continue

              try {
                const parsed = JSON.parse(data)
                const delta = parsed.choices?.[0]?.delta?.content || ''
                if (!delta) {
                  controller.enqueue(encoder.encode(line + '\n'))
                  continue
                }

                fullContent += delta

                // Count tool call markers to handle MULTIPLE tool calls in one response
                const toolStartCount = (fullContent.match(/<<<TOOL_CALL:/g) || []).length
                const toolEndCount = (fullContent.match(/<<<END_TOOL_CALL>>>/g) || []).length
                const hasOpenToolCall = toolStartCount > toolEndCount

                // Check if we're entering a NEW tool call block (open > closed)
                if (hasOpenToolCall && !buffering) {
                  buffering = true
                  buffer += delta
                  // Show status message for each new tool call
                  const lastToolStart = fullContent.lastIndexOf('<<<TOOL_CALL:')
                  const isImageTool = fullContent.indexOf('<<<TOOL_CALL:generate_image>>>', lastToolStart) === lastToolStart
                  const isSEOTool = fullContent.indexOf('<<<TOOL_CALL:wildverse_seo_publish>>>', lastToolStart) === lastToolStart
                  const isSeriesTools = fullContent.indexOf('<<<TOOL_CALL:wildverse_seo_series>>>', lastToolStart) === lastToolStart
                  const isOctoSEOTool = fullContent.indexOf('<<<TOOL_CALL:octopus_seo_publish>>>', lastToolStart) === lastToolStart
                  const isOctoSeriesTools = fullContent.indexOf('<<<TOOL_CALL:octopus_seo_series>>>', lastToolStart) === lastToolStart
                  const statusMsg = isImageTool
                    ? '\n\n🎨 Generating image with AI...\n'
                    : isSeriesTools || isOctoSeriesTools
                      ? '\n\n📚 Launching 3-Article SEO Series Pipeline... (this takes ~3-5 minutes)\n'
                      : isSEOTool
                        ? '\n\n🚀 Running Wildverse SEO Pipeline (topic → article → validate → image → publish)...\n'
                        : isOctoSEOTool
                          ? '\n\n🐙 Running Octopus SEO Pipeline (topic → article → validate → image → publish)...\n'
                          : '\n\n🔧 Executing real publish...\n'
                  const statusEvent = `data: ${JSON.stringify({ choices: [{ delta: { content: statusMsg } }] })}\n`
                  controller.enqueue(encoder.encode(statusEvent))
                  continue
                }

                // Check if a tool call block just closed (starts == ends, but we were buffering)
                if (buffering && toolStartCount === toolEndCount) {
                  buffering = false
                  buffer = ''

                  // Extract and execute ONLY NEW tool calls (skip already-processed ones)
                  const allToolCalls = extractToolCalls(fullContent)
                  const newToolCalls = allToolCalls.slice(processedToolCalls)
                  processedToolCalls = allToolCalls.length

                  for (const tc of newToolCalls) {
                    if (tc.toolName === 'content_publish') {
                      try {
                        const params = JSON.parse(tc.params)

                        // 🛡️ SKILL FACTORY SECURITY PROTOCOL
                        const publishAuth = authorizePublish({
                          agentId: agentId || 'agent-factory',
                          title: params.title || '',
                          content: params.content || '',
                          contentType: params.contentType || 'blog_post',
                          callerContext: 'agent-factory',
                        })

                        if (!publishAuth.authorized) {
                          const blockMsg = publishAuth.requiresManualApproval
                            ? `\n\n⏸️ SAFE MODE — Publicación requiere aprobación manual.\n🛡️ Trust: ${publishAuth.trustLevel} | Audit: ${publishAuth.audit.audit_status} (score: ${publishAuth.audit.quality_score}/100)\n🚩 Flags: ${publishAuth.audit.flags.join(', ') || 'none'}\n`
                            : `\n\n❌ BLOQUEADO — ${publishAuth.reason}\n🚩 Flags: ${publishAuth.audit.flags.join(', ') || 'none'}\n`
                          const blockEvent = `data: ${JSON.stringify({ choices: [{ delta: { content: blockMsg } }] })}\n`
                          controller.enqueue(encoder.encode(blockEvent))
                        } else {
                          // ✅ Authorized — execute publish
                          // 🔗 AUTO-LINK: If agent didn't pass coverImage but we generated one earlier, inject it
                          const effectiveCoverImage = params.coverImage || lastGeneratedImageUrl || undefined
                          if (!params.coverImage && lastGeneratedImageUrl) {
                            console.log(`[Agent Factory] 🔗 AUTO-LINKING image to publish: ${lastGeneratedImageUrl.substring(0, 100)}...`)
                          }
                          const result = await executeContentPublish(userId, {
                            ...params,
                            coverImage: effectiveCoverImage,
                            agentId: agentId || 'agent-factory'
                          })

                          let resultMsg = ''
                          if (result.success && result.data) {
                            const d = result.data
                            resultMsg = `\n\n✅ ¡PUBLICADO EXITOSAMENTE! [🛡️ ${publishAuth.mode} mode]\n`
                            resultMsg += `🔗 URL: ${d.publishedUrl || 'N/A'}\n`
                            resultMsg += `📝 Slug: ${d.slug || 'N/A'}\n`
                            resultMsg += `⚡ HTTP Status: ${d.httpStatus}\n`
                            resultMsg += `⏱️ Duración: ${d.duration}ms\n`
                            resultMsg += `🛡️ Security: ${publishAuth.trustLevel} | Audit: ${publishAuth.audit.quality_score}/100\n`
                            if (effectiveCoverImage) {
                              resultMsg += `🖼️ Cover image: ${effectiveCoverImage.substring(0, 80)}...\n`
                            }
                          } else {
                            resultMsg = `\n\n❌ ERROR AL PUBLICAR: ${result.error}\n`
                          }

                          const resultEvent = `data: ${JSON.stringify({ choices: [{ delta: { content: resultMsg } }] })}\n`
                          controller.enqueue(encoder.encode(resultEvent))
                        }
                      } catch (parseErr) {
                        const errMsg = `\n\n❌ Error en tool call: JSON inválido en los parámetros\n`
                        const errEvent = `data: ${JSON.stringify({ choices: [{ delta: { content: errMsg } }] })}\n`
                        controller.enqueue(encoder.encode(errEvent))
                      }
                    } else if (tc.toolName === 'wildverse_seo_series') {
                      try {
                        const params = JSON.parse(tc.params)
                        console.log(`[Agent Factory] 📚 Wildverse SEO SERIES triggered: theme="${params.theme || 'auto'}"`)

                        // Send progress update
                        const seriesStartMsg = `\n\n📚 **Launching 3-Article Series Pipeline...**\n━ Generating 3 correlated topics...\n`
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: seriesStartMsg } }] })}\n`))

                        const seriesResult = await runWildverseSEOSeries(userId, {
                          theme: params.theme,
                          instructions: params.instructions,
                        })

                        let resultMsg = ''
                        if (seriesResult.success) {
                          resultMsg = `\n\n✅ **SERIES PUBLISHED! (${seriesResult.articlesPublished}/${seriesResult.articlesTotal} articles)**\n`
                          resultMsg += `🎯 **Series Theme:** ${seriesResult.seriesTheme}\n\n`

                          seriesResult.articles.forEach((r, idx) => {
                            if (r.success && r.article) {
                              resultMsg += `---\n**Part ${idx + 1}: ${r.article.title}**\n`
                              resultMsg += `🔗 ${r.article.publishedUrl}\n`
                              resultMsg += `🔑 Keyword: ${r.article.keyword} | 📊 ${r.article.wordCount} words\n`
                              if (r.article.coverImage) {
                                resultMsg += `![${r.article.title}](${r.article.coverImage})\n`
                              }
                            } else {
                              resultMsg += `---\n**Part ${idx + 1}: ❌ Failed** — ${r.error}\n`
                            }
                          })

                          resultMsg += `\n⏱️ **Total duration:** ${(seriesResult.totalDuration / 1000).toFixed(1)}s\n`
                          resultMsg += `🚀 **Topical authority cluster created!** Google will see these 3 interconnected articles as a strong signal of expertise.\n`
                        } else {
                          resultMsg = `\n\n❌ **Series Pipeline Failed:** ${seriesResult.error}\n`
                          resultMsg += `Published: ${seriesResult.articlesPublished}/${seriesResult.articlesTotal}\n`
                        }

                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: resultMsg } }] })}\n`))
                      } catch (parseErr) {
                        const errMsg = `\n\n❌ Error in wildverse_seo_series tool call: ${parseErr instanceof Error ? parseErr.message : 'Invalid JSON'}\n`
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: errMsg } }] })}\n`))
                      }
                    } else if (tc.toolName === 'wildverse_seo_publish') {
                      try {
                        const params = JSON.parse(tc.params)
                        console.log(`[Agent Factory] 🚀 Wildverse SEO Pipeline triggered: topic="${params.topic || 'auto'}" keyword="${params.keyword || 'auto'}"`)

                        const seoResult = await runWildverseSEOPipeline(userId, {
                          topic: params.topic,
                          keyword: params.keyword,
                          instructions: params.instructions,
                        })

                        let resultMsg = ''
                        if (seoResult.success && seoResult.article) {
                          const a = seoResult.article
                          resultMsg = `\n\n✅ **ARTICLE PUBLISHED SUCCESSFULLY!**\n`
                          resultMsg += `\n📰 **Title:** ${a.title}\n`
                          resultMsg += `🔗 **URL:** ${a.publishedUrl}\n`
                          resultMsg += `🔑 **Keyword:** ${a.keyword}\n`
                          resultMsg += `📊 **Word count:** ${a.wordCount}\n`
                          if (a.coverImage) {
                            resultMsg += `\n![${a.title}](${a.coverImage})\n`
                            resultMsg += `🖼️ **Cover image:** ${a.coverImage.substring(0, 80)}...\n`
                          }
                          resultMsg += `\n✅ **Validation report:**\n`
                          resultMsg += `  • Language: ${seoResult.validation?.language.detail}\n`
                          if (seoResult.validation?.structure.checks) {
                            for (const [k, v] of Object.entries(seoResult.validation.structure.checks)) {
                              resultMsg += `  • ${k}: ${v.passed ? '✓' : '✗'} ${v.detail}\n`
                            }
                          }
                          resultMsg += `\n⏱️ **Pipeline duration:** ${(seoResult.totalDuration / 1000).toFixed(1)}s\n`
                          resultMsg += `\n🔗 **Pipeline steps:** ${seoResult.steps.map(s => `${s.step}:${s.status}`).join(' → ')}\n`
                        } else {
                          resultMsg = `\n\n❌ **SEO Pipeline failed:** ${seoResult.error}\n`
                          resultMsg += `Pipeline: ${seoResult.pipeline}\n`
                          if (seoResult.steps.length > 0) {
                            resultMsg += `Steps completed: ${seoResult.steps.map(s => `${s.step}:${s.status}`).join(' → ')}\n`
                          }
                          if (seoResult.validation) {
                            resultMsg += `Validation: Language=${seoResult.validation.language.detail}\n`
                          }
                        }

                        const resultEvent = `data: ${JSON.stringify({ choices: [{ delta: { content: resultMsg } }] })}\n`
                        controller.enqueue(encoder.encode(resultEvent))
                      } catch (parseErr) {
                        const errMsg = `\n\n❌ Error in wildverse_seo_publish tool call: ${parseErr instanceof Error ? parseErr.message : 'Invalid JSON'}\n`
                        const errEvent = `data: ${JSON.stringify({ choices: [{ delta: { content: errMsg } }] })}\n`
                        controller.enqueue(encoder.encode(errEvent))
                      }
                    } else if (tc.toolName === 'octopus_seo_series') {
                      try {
                        const params = JSON.parse(tc.params)
                        console.log(`[Agent Factory] 📚 Octopus SEO SERIES triggered: theme="${params.theme || 'auto'}"`)

                        const seriesStartMsg = `\n\n📚 **Launching 3-Article Octopus Series Pipeline...**\n━ Generating 3 correlated topics...\n`
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: seriesStartMsg } }] })}\n`))

                        const seriesResult = await runOctopusSEOSeries(userId, {
                          theme: params.theme,
                          instructions: params.instructions,
                        })

                        let resultMsg = ''
                        if (seriesResult.success) {
                          resultMsg = `\n\n✅ **SERIES PUBLISHED! (${seriesResult.articlesPublished}/${seriesResult.articlesTotal} articles)**\n`
                          resultMsg += `🎯 **Series Theme:** ${seriesResult.seriesTheme}\n\n`
                          seriesResult.articles.forEach((r, idx) => {
                            if (r.success && r.article) {
                              resultMsg += `---\n**Part ${idx + 1}: ${r.article.title}**\n`
                              resultMsg += `🔗 ${r.article.publishedUrl}\n`
                              resultMsg += `🔑 Keyword: ${r.article.keyword} | 📊 ${r.article.wordCount} words\n`
                              if (r.article.coverImage) resultMsg += `![${r.article.title}](${r.article.coverImage})\n`
                            } else {
                              resultMsg += `---\n**Part ${idx + 1}: ❌ Failed** — ${r.error}\n`
                            }
                          })
                          resultMsg += `\n⏱️ **Total duration:** ${(seriesResult.totalDuration / 1000).toFixed(1)}s\n`
                          resultMsg += `🚀 **Topical authority cluster created for octopuskills.com/blog!**\n`
                        } else {
                          resultMsg = `\n\n❌ **Series Pipeline Failed:** ${seriesResult.error}\n`
                          resultMsg += `Published: ${seriesResult.articlesPublished}/${seriesResult.articlesTotal}\n`
                        }
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: resultMsg } }] })}\n`))
                      } catch (parseErr) {
                        const errMsg = `\n\n❌ Error in octopus_seo_series tool call: ${parseErr instanceof Error ? parseErr.message : 'Invalid JSON'}\n`
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: errMsg } }] })}\n`))
                      }
                    } else if (tc.toolName === 'octopus_seo_publish') {
                      try {
                        const params = JSON.parse(tc.params)
                        console.log(`[Agent Factory] 🐙 Octopus SEO Pipeline triggered: topic="${params.topic || 'auto'}" keyword="${params.keyword || 'auto'}"`)

                        const seoResult = await runOctopusSEOPipeline(userId, {
                          topic: params.topic,
                          keyword: params.keyword,
                          instructions: params.instructions,
                          category: params.category,
                        })

                        let resultMsg = ''
                        if (seoResult.success && seoResult.article) {
                          const a = seoResult.article
                          resultMsg = `\n\n✅ **ARTICLE PUBLISHED SUCCESSFULLY!**\n`
                          resultMsg += `\n📰 **Title:** ${a.title}\n`
                          resultMsg += `🔗 **URL:** ${a.publishedUrl}\n`
                          resultMsg += `🔑 **Keyword:** ${a.keyword}\n`
                          resultMsg += `📊 **Word count:** ${a.wordCount}\n`
                          if (a.coverImage) {
                            resultMsg += `\n![${a.title}](${a.coverImage})\n`
                            resultMsg += `🖼️ **Cover image:** ${a.coverImage.substring(0, 80)}...\n`
                          }
                          resultMsg += `\n✅ **Validation report:**\n`
                          resultMsg += `  • Language: ${seoResult.validation?.language.detail}\n`
                          if (seoResult.validation?.structure.checks) {
                            for (const [k, v] of Object.entries(seoResult.validation.structure.checks)) {
                              resultMsg += `  • ${k}: ${v.passed ? '✓' : '✗'} ${v.detail}\n`
                            }
                          }
                          resultMsg += `\n⏱️ **Pipeline duration:** ${(seoResult.totalDuration / 1000).toFixed(1)}s\n`
                          resultMsg += `\n🔗 **Pipeline steps:** ${seoResult.steps.map(s => `${s.step}:${s.status}`).join(' → ')}\n`
                        } else {
                          resultMsg = `\n\n❌ **SEO Pipeline failed:** ${seoResult.error}\n`
                          resultMsg += `Pipeline: ${seoResult.pipeline}\n`
                          if (seoResult.steps.length > 0) {
                            resultMsg += `Steps completed: ${seoResult.steps.map(s => `${s.step}:${s.status}`).join(' → ')}\n`
                          }
                        }
                        const resultEvent = `data: ${JSON.stringify({ choices: [{ delta: { content: resultMsg } }] })}\n`
                        controller.enqueue(encoder.encode(resultEvent))
                      } catch (parseErr) {
                        const errMsg = `\n\n❌ Error in octopus_seo_publish tool call: ${parseErr instanceof Error ? parseErr.message : 'Invalid JSON'}\n`
                        const errEvent = `data: ${JSON.stringify({ choices: [{ delta: { content: errMsg } }] })}\n`
                        controller.enqueue(encoder.encode(errEvent))
                      }
                    } else if (tc.toolName === 'generate_image') {
                      try {
                        const params = JSON.parse(tc.params)
                        const result = await executeImageGenerate(userId, {
                          ...params,
                          agentId: agentId || 'agent-factory'
                        })

                        let resultMsg = ''
                        if (result.success && result.imageUrl) {
                          // 🔗 Track for auto-linking to subsequent content_publish calls
                          lastGeneratedImageUrl = result.imageUrl
                          console.log(`[Agent Factory] 🔗 Image tracked for auto-link: ${result.imageUrl.substring(0, 100)}...`)
                          resultMsg = `\n\n✅ ¡Imagen generada exitosamente!${result.cached ? ' (cached)' : ''}\n`
                          resultMsg += `\n![${params.title || 'Imagen generada'}](${result.imageUrl})\n`
                          resultMsg += `\n🔗 URL: ${result.imageUrl}\n`
                          resultMsg += `\n📎 Esta imagen se vinculará automáticamente como portada al publicar.\n`
                        } else {
                          resultMsg = `\n\n❌ Error al generar imagen: ${result.error}\n`
                        }

                        const resultEvent = `data: ${JSON.stringify({ choices: [{ delta: { content: resultMsg } }] })}\n`
                        controller.enqueue(encoder.encode(resultEvent))
                      } catch (parseErr) {
                        const errMsg = `\n\n❌ Error en tool call generate_image: JSON inválido\n`
                        const errEvent = `data: ${JSON.stringify({ choices: [{ delta: { content: errMsg } }] })}\n`
                        controller.enqueue(encoder.encode(errEvent))
                      }
                    }
                  }

                  // Forward any content AFTER the tool call block
                  const afterToolCall = fullContent.split('<<<END_TOOL_CALL>>>').pop() || ''
                  if (afterToolCall.trim()) {
                    const afterEvent = `data: ${JSON.stringify({ choices: [{ delta: { content: afterToolCall } }] })}\n`
                    controller.enqueue(encoder.encode(afterEvent))
                  }
                  continue
                }

                if (buffering) {
                  buffer += delta
                  continue
                }

                // Normal content — forward as-is
                controller.enqueue(encoder.encode(line + '\n'))
              } catch {
                controller.enqueue(encoder.encode(line + '\n'))
              }
            }
          }

          // If we were buffering when stream ended (incomplete tool call), flush it
          if (buffering && buffer) {
            const flushEvent = `data: ${JSON.stringify({ choices: [{ delta: { content: buffer } }] })}\n`
            controller.enqueue(encoder.encode(flushEvent))
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } catch (err) {
          console.error('[agent-factory/chat] Stream error:', err)
        } finally {
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('[agent-factory/chat] Error:', error)
    return NextResponse.json(
      { error: 'Error al procesar la solicitud del agente' },
      { status: 500 }
    )
  }
}