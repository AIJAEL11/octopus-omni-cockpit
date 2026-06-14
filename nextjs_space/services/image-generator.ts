// 🎨 IMAGE GENERATOR SERVICE — Wildverse-branded blog image generation
// Used by VERA and other content agents for consistent, brand-aligned imagery

import { uploadBufferToS3Public } from '@/lib/s3'
import { prisma } from '@/lib/prisma'

// ─── BRAND STYLE SYSTEM ─────────────────────────────────────────────────────

const WILDVERSE_STYLE = [
  'Apple-style minimalist product photography',
  'Clean white or very light background',
  'Soft diffused shadows',
  'Abstract representation, NOT a literal scene',
  'Subtle violet (#8B5CF6) to teal (#14B8A6) color accents',
  'No text or typography inside the image',
  'No clutter, no busy compositions',
  'Ultra clean composition with generous negative space',
  'Premium studio lighting with soft highlights',
  'High-end commercial aesthetic',
].join(', ')

// Category-specific visual cues
const CATEGORY_VISUALS: Record<string, string> = {
  technology: 'floating geometric tech objects, holographic elements, circuit-inspired patterns',
  marketing: 'abstract growth arrows, floating data visualizations, gradient orbs',
  ai: 'neural network nodes, glowing synapses, abstract AI brain, digital constellation',
  business: 'abstract corporate shapes, floating cubes, premium glass objects',
  design: 'color palette fans, abstract brush strokes, geometric harmony',
  development: 'code brackets floating, abstract terminal windows, dev tool icons',
  seo: 'magnifying glass over abstract graph, rising metrics, search patterns',
  social_media: 'floating notification bubbles, abstract social connections, network graph',
  ecommerce: 'abstract shopping elements, floating product silhouettes, premium packaging',
  productivity: 'abstract workflow arrows, floating task cards, organized geometric shapes',
  creativity: 'paint splashes in violet and teal, floating creative tools, artistic swirls',
  automation: 'interconnected gears, flowing pipeline, abstract robotic arms',
  content: 'floating document pages, abstract pen, creative writing elements',
  default: 'abstract floating geometric shapes, premium glass orbs, subtle gradients',
}

// ─── PROMPT ENGINE ───────────────────────────────────────────────────────────

export interface BlogImageRequest {
  title: string
  excerpt?: string
  category?: string
  styleOverride?: string
  slug?: string
  aspectRatio?: string // e.g. '16:9', '1:1'
}

export interface BlogImageResult {
  imageUrl: string
  cloudStoragePath?: string
  cached: boolean
  prompt: string
}

/**
 * Build a brand-aligned image prompt from article metadata.
 * Agents MUST use this — never raw prompts.
 */
function buildBlogImagePrompt(req: BlogImageRequest): string {
  const category = req.category?.toLowerCase() || 'default'
  const categoryVisual = CATEGORY_VISUALS[category] || CATEGORY_VISUALS.default

  // Extract the core topic from title (strip common filler words)
  const topicWords = req.title
    .replace(/[¿?¡!:"']/g, '')
    .replace(/\b(cómo|como|qué|que|por|para|con|del|los|las|una|unos|the|how|to|and|with|for|of|a|an)\b/gi, '')
    .trim()

  const excerptHint = req.excerpt
    ? `. Context: ${req.excerpt.substring(0, 80)}`
    : ''

  const style = req.styleOverride || WILDVERSE_STYLE

  return [
    `Minimalist abstract representation of "${topicWords}"${excerptHint}.`,
    categoryVisual,
    'Floating objects in 3D space,',
    style,
    'Shot with a 85mm lens, shallow depth of field, 4K resolution.',
  ].join(' ')
}

// ─── CACHE LAYER ─────────────────────────────────────────────────────────────

// In-memory cache to avoid duplicate gen during the same server lifecycle
const memoryCache = new Map<string, { url: string; ts: number }>()
const MEMORY_CACHE_TTL = 1000 * 60 * 60 // 1 hour

function getCacheKey(slug: string): string {
  return `blog-img:${slug}`
}

/**
 * Check if we already generated an image for this slug (DB-backed cache).
 */
async function checkCachedImage(slug: string, userId: string): Promise<string | null> {
  // Memory cache first
  const memKey = getCacheKey(slug)
  const memEntry = memoryCache.get(memKey)
  if (memEntry && Date.now() - memEntry.ts < MEMORY_CACHE_TTL) {
    return memEntry.url
  }

  // DB cache: check ContentPublishLog with matching slug that has a cover image in metadata
  try {
    const existing = await prisma.contentPublishLog.findFirst({
      where: {
        userId,
        slug,
        NOT: { metadata: null },
      },
      orderBy: { createdAt: 'desc' },
      select: { metadata: true },
    })

    if (existing?.metadata) {
      try {
        const meta = JSON.parse(existing.metadata)
        if (meta.coverImage) {
          memoryCache.set(memKey, { url: meta.coverImage, ts: Date.now() })
          return meta.coverImage
        }
      } catch { /* invalid JSON */ }
    }
  } catch (err) {
    console.warn('[ImageGen] Cache check failed:', err)
  }

  return null
}

// ─── IMAGE URL EXTRACTION ────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractImageUrl(data: any): string | null {
  const msg = data?.choices?.[0]?.message
  if (msg) {
    // RouteLLM images array: msg.images[0].image_url.url (base64 or http)
    if (Array.isArray(msg.images)) {
      for (const img of msg.images) {
        if (img?.image_url?.url) return img.image_url.url
        if (typeof img?.image_url === 'string') return img.image_url
        if (typeof img?.url === 'string') return img.url
      }
    }
    if (typeof msg.image_url === 'string') return msg.image_url
    if (msg.image_url?.url) return msg.image_url.url
    if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === 'image_url' && part.image_url?.url) return part.image_url.url
        if (part.type === 'image' && part.url) return part.url
        if (typeof part === 'string' && part.startsWith('http')) return part
      }
    }
    if (typeof msg.content === 'string') {
      if (msg.content.startsWith('data:image/')) return msg.content
      const mdMatch = msg.content.match(/!\[.*?\]\((https?:\/\/[^)]+)\)/)
      if (mdMatch) return mdMatch[1]
      const urlMatch = msg.content.match(/(https?:\/\/\S+\.(?:png|jpg|jpeg|webp|gif|svg)(?:\?[^\s)]*)?)/i)
      if (urlMatch) return urlMatch[1]
    }
  }
  // DALL-E format
  if (Array.isArray(data?.data)) {
    for (const item of data.data) {
      if (typeof item.url === 'string') return item.url
    }
  }
  // Top-level image_url
  if (typeof data?.image_url === 'string') return data.image_url
  return null
}

// ─── CORE GENERATION ─────────────────────────────────────────────────────────

/**
 * Generate a brand-aligned blog cover image.
 * Returns image URL (CDN-hosted) or null if generation fails.
 * NEVER blocks article publishing — safe to call in fire-and-forget mode.
 */
export async function generateBlogImage(
  req: BlogImageRequest & { userId?: string }
): Promise<BlogImageResult | null> {
  const slug = req.slug || slugify(req.title)

  try {
    // ── Check cache first ──
    if (req.userId) {
      const cached = await checkCachedImage(slug, req.userId)
      if (cached) {
        console.log(`[ImageGen] ✅ Cache hit for slug: ${slug}`)
        return {
          imageUrl: cached,
          cached: true,
          prompt: '(cached)',
        }
      }
    }

    // ── Build prompt ──
    const prompt = buildBlogImagePrompt(req)
    console.log(`[ImageGen] 🎨 Generating for: "${req.title}" → prompt: ${prompt.substring(0, 120)}...`)

    // ── Call RouteLLM image generation ──
    const response = await fetch('https://routellm.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.ABACUSAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'route-llm',
        messages: [{ role: 'user', content: prompt }],
        modalities: ['image'],
        image_config: {
          aspect_ratio: req.aspectRatio || '16:9',
        },
      }),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      console.error(`[ImageGen] ❌ API error ${response.status}: ${errText.substring(0, 300)}`)
      return null
    }

    const data = await response.json()
    const rawUrl = extractImageUrl(data)

    if (!rawUrl) {
      console.error('[ImageGen] ❌ No image URL in response:', JSON.stringify(data).substring(0, 500))
      return null
    }

    // ── Upload to S3 for CDN persistence ──
    let finalUrl = rawUrl
    let cloudPath: string | undefined

    try {
      let buffer: Buffer | null = null
      let ext = 'png'

      if (rawUrl.startsWith('data:image/')) {
        // Base64 data URL — decode directly
        const match = rawUrl.match(/^data:image\/(\w+);base64,(.+)$/)
        if (match) {
          ext = match[1] === 'jpeg' ? 'jpg' : match[1]
          buffer = Buffer.from(match[2], 'base64')
        }
      } else if (!rawUrl.includes('.amazonaws.com/')) {
        // Remote URL — download first
        const imgResponse = await fetch(rawUrl)
        if (imgResponse.ok) {
          const arrayBuf = await imgResponse.arrayBuffer()
          buffer = Buffer.from(arrayBuf)
          ext = rawUrl.includes('.png') ? 'png' : rawUrl.includes('.webp') ? 'webp' : 'png'
        }
      }

      if (buffer) {
        const fileName = `blog-cover-${slug}-${Date.now()}.${ext}`
        const { publicUrl, cloud_storage_path } = await uploadBufferToS3Public(
          buffer,
          fileName,
          `image/${ext}`
        )
        finalUrl = publicUrl
        cloudPath = cloud_storage_path
        console.log(`[ImageGen] ☁️ Uploaded to S3: ${publicUrl.substring(0, 100)}...`)
      }
    } catch (s3Err) {
      console.warn('[ImageGen] S3 upload failed, using original URL:', s3Err)
      // If it was base64 and S3 failed, we can't use the URL directly (too large)
      if (rawUrl.startsWith('data:image/')) {
        console.error('[ImageGen] Cannot use base64 URL directly — image lost')
        return null
      }
    }

    // ── Update memory cache ──
    memoryCache.set(getCacheKey(slug), { url: finalUrl, ts: Date.now() })

    console.log(`[ImageGen] ✅ Generated for "${req.title}": ${finalUrl.substring(0, 100)}...`)

    return {
      imageUrl: finalUrl,
      cloudStoragePath: cloudPath,
      cached: false,
      prompt,
    }
  } catch (error) {
    console.error('[ImageGen] ❌ Generation failed (non-blocking):', error)
    return null // NEVER block article publishing
  }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .substring(0, 100)
}

// ─── EXPORTS ─────────────────────────────────────────────────────────────────

export { buildBlogImagePrompt, WILDVERSE_STYLE, CATEGORY_VISUALS }
