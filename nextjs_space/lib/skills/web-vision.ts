// ============================================
// 🐙👁️ WEB VISION SKILL — Design Reference Extraction
// ============================================
// Captures screenshots of a URL and uses LLM Vision to extract
// a structured design analysis that the Code Engine can use
// to generate code inspired by the reference site.
// ============================================

import { callLLM } from '@/lib/turbo-llm'

export const WEB_VISION_SKILL_INFO = {
  id: 'web-vision',
  name: '👁️ Web Vision',
  description: 'Captures and analyzes website designs to extract color palettes, typography, layout patterns, and component inventories.',
  capabilities: [
    'Screenshot capture (above-fold + full page)',
    'Color palette extraction (hex codes)',
    'Typography analysis (fonts, weights, sizes)',
    'Layout structure mapping',
    'Component style inventory',
    'CSS tokens generation (:root vars)',
    'Tailwind config generation',
  ],
  status: 'active' as const,
}

// ── Types ──
export interface DesignAnalysis {
  url: string
  timestamp: string
  overall: {
    aesthetic: string       // e.g. "Dark minimalist with neon accents"
    industry: string        // e.g. "AI/SaaS", "E-commerce", "Agency"
    quality: string         // e.g. "Awwwards-level", "Professional", "Standard"
    mood: string            // e.g. "Futuristic, confident, premium"
  }
  colors: {
    background: string      // Primary bg hex
    foreground: string      // Primary text hex
    primary: string         // CTA/accent color hex
    secondary: string       // Secondary accent hex
    muted: string           // Muted/subtle color hex
    surface: string         // Card/surface color hex
    palette: string[]       // All detected colors
  }
  typography: {
    headingFont: string     // Font family for headings
    bodyFont: string        // Font family for body
    weights: string[]       // Used font weights
    headingStyle: string    // e.g. "Bold uppercase tracking-tight"
    sizeScale: string       // e.g. "Large — hero 80px, h2 48px, body 16px"
  }
  layout: {
    structure: string       // e.g. "Single-page scroll with fixed nav"
    navStyle: string        // e.g. "Fixed transparent navbar, logo left, links center, CTA right"
    heroStyle: string       // e.g. "Full-screen with 3D background, content bottom-left"
    gridSystem: string      // e.g. "12-col grid, max-w-7xl container"
    sections: string[]      // List of page sections in order
  }
  components: {
    cards: string           // Card style description
    buttons: string         // Button style description
    forms: string           // Form/input style description
    effects: string         // Special effects (glassmorphism, parallax, particles, etc.)
    animations: string      // Animation patterns
  }
  cssTokens: string         // Ready-to-use CSS :root block with custom properties
  tailwindConfig: string    // Ready-to-use Tailwind config extend block
}

// ── Screenshot Capture (Multi-Strategy with Fallbacks) ──
// Strategy 1: image.thum.io (fast, direct image)
// Strategy 2: image.thum.io with /noanimate/ (works for some sites that block strategy 1)
// Strategy 3: microlink.io API (reliable fallback, returns JSON with screenshot URL)

export function buildScreenshotUrls(targetUrl: string): { above: string; full: string } {
  const parts = ['https:', '', 'image.thum.io', 'get']
  const svcBase = parts.join('/')
  return {
    above: svcBase + '/width/1280/crop/900/' + targetUrl,
    full:  svcBase + '/width/1280/crop/2400/' + targetUrl,
  }
}

// Helper: fetch a single screenshot from a direct image URL
async function fetchScreenshotDirect(screenshotUrl: string, timeoutMs = 20000): Promise<Buffer | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(screenshotUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    })
    clearTimeout(timeout)
    if (!res.ok) {
      console.warn(`[WebVision] HTTP ${res.status} for ${screenshotUrl.substring(0, 80)}`)
      return null
    }
    const buffer = Buffer.from(await res.arrayBuffer())
    if (buffer.length > 5000) {
      console.log(`[WebVision] Screenshot OK: ${(buffer.length / 1024).toFixed(0)}KB from ${screenshotUrl.substring(0, 60)}...`)
      return buffer
    }
    console.warn(`[WebVision] Screenshot too small (${buffer.length} bytes)`)
    return null
  } catch (err) {
    console.warn(`[WebVision] Fetch failed: ${err instanceof Error ? err.message : err}`)
    return null
  }
}

// Helper: fetch screenshot via microlink.io API (returns JSON with a screenshot URL)
async function fetchViaMicrolink(targetUrl: string, timeoutMs = 25000): Promise<Buffer | null> {
  try {
    const mlParts = ['https:', '', 'api.microlink.io']
    const mlBase = mlParts.join('/')
    const apiUrl = mlBase + '/?url=' + encodeURIComponent(targetUrl) + '&screenshot=true&meta=false'
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(apiUrl, { signal: controller.signal })
    clearTimeout(timeout)
    if (!res.ok) {
      console.warn(`[WebVision] Microlink API HTTP ${res.status}`)
      return null
    }
    const json = await res.json() as { status: string; data?: { screenshot?: { url?: string } } }
    const ssUrl = json?.data?.screenshot?.url
    if (!ssUrl) {
      console.warn('[WebVision] Microlink returned no screenshot URL')
      return null
    }
    console.log(`[WebVision] Microlink screenshot URL: ${ssUrl.substring(0, 80)}...`)
    // Download the actual image
    return await fetchScreenshotDirect(ssUrl, 15000)
  } catch (err) {
    console.warn(`[WebVision] Microlink failed: ${err instanceof Error ? err.message : err}`)
    return null
  }
}

export async function captureScreenshots(url: string): Promise<{ above: string; full: string; raw: Buffer[] }> {
  const thumParts = ['https:', '', 'image.thum.io', 'get']
  const thumBase = thumParts.join('/')

  // Strategy 1: thum.io standard
  console.log('[WebVision] Strategy 1: thum.io standard')
  const aboveUrl1 = thumBase + '/width/1280/crop/900/' + url
  const fullUrl1  = thumBase + '/width/1280/crop/2400/' + url
  let aboveBuf = await fetchScreenshotDirect(aboveUrl1)
  let fullBuf  = aboveBuf ? await fetchScreenshotDirect(fullUrl1) : null

  // Strategy 2: thum.io with /noanimate/ (helps for animated/JS-heavy sites)
  if (!aboveBuf) {
    console.log('[WebVision] Strategy 2: thum.io with /noanimate/')
    const aboveUrl2 = thumBase + '/width/1280/crop/900/noanimate/' + url
    const fullUrl2  = thumBase + '/width/1280/crop/2400/noanimate/' + url
    aboveBuf = await fetchScreenshotDirect(aboveUrl2)
    fullBuf  = aboveBuf ? await fetchScreenshotDirect(fullUrl2) : null
  }

  // Strategy 3: microlink.io (most reliable fallback)
  if (!aboveBuf) {
    console.log('[WebVision] Strategy 3: microlink.io API')
    aboveBuf = await fetchViaMicrolink(url)
    // Microlink only gives one screenshot, use it for both
    fullBuf = null
  }

  const results: Buffer[] = []
  if (aboveBuf) results.push(aboveBuf)
  if (fullBuf) results.push(fullBuf)

  console.log(`[WebVision] Final: ${results.length} screenshot(s) captured`)

  return {
    above: results[0] ? `data:image/png;base64,${results[0].toString('base64')}` : '',
    full:  results[1] ? `data:image/png;base64,${results[1].toString('base64')}` : '',
    raw: results,
  }
}

// ── Design Analysis Prompt ──
const DESIGN_ANALYST_PROMPT = `You are an elite web design analyst with 15 years of experience at Apple, Stripe, and top agencies.
You are analyzing screenshots of a website to extract precise, actionable design specifications.

Your analysis must be EXACT — specific hex codes, font names, pixel values, not vague descriptions.
Respond in JSON format matching this structure exactly:

{
  "overall": {
    "aesthetic": "<2-3 word aesthetic label>",
    "industry": "<industry/vertical>",
    "quality": "<Awwwards-level / Professional / Standard>",
    "mood": "<3-4 mood descriptors>"
  },
  "colors": {
    "background": "<hex>",
    "foreground": "<hex>",
    "primary": "<hex>",
    "secondary": "<hex>",
    "muted": "<hex>",
    "surface": "<hex>",
    "palette": ["<hex1>", "<hex2>", ...]
  },
  "typography": {
    "headingFont": "<font family>",
    "bodyFont": "<font family>",
    "weights": ["300", "400", ...],
    "headingStyle": "<style description>",
    "sizeScale": "<size descriptions>"
  },
  "layout": {
    "structure": "<overall page structure>",
    "navStyle": "<detailed navbar description>",
    "heroStyle": "<detailed hero section description>",
    "gridSystem": "<grid/container description>",
    "sections": ["<section1>", "<section2>", ...]
  },
  "components": {
    "cards": "<card style with specific CSS values>",
    "buttons": "<button styles with colors, radius, padding>",
    "forms": "<form/input styling>",
    "effects": "<special visual effects>",
    "animations": "<animation patterns observed>"
  },
  "cssTokens": ":root { --background: <hex>; --foreground: <hex>; --primary: <hex>; ... }",
  "tailwindConfig": "colors: { background: '<hex>', primary: '<hex>', ... }, fontFamily: { heading: ['<font>'], body: ['<font>'] }"
}

Be SPECIFIC. Example: Instead of "dark background" say "#0A0A0F".
Instead of "sans-serif font" say "Inter" or "Sora".
Instead of "rounded buttons" say "border-radius: 8px, padding: 12px 24px".
Extract the COMPLETE color palette — every distinct color you see.
Note ALL animation patterns: scroll reveals, hover effects, transitions.
For cssTokens, generate a complete :root block ready to paste into CSS.
For tailwindConfig, generate a theme.extend block ready to paste into tailwind.config.`

// ── LLM Vision Analysis ──
export async function analyzeDesign(
  screenshots: { above: string; full: string },
  url: string,
  userId?: string,
): Promise<DesignAnalysis> {
  const start = Date.now()
  
  // Build multimodal message with screenshots
  const contentParts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
    { type: 'text', text: `Analyze this website: ${url}\n\nExtract the complete design specification as JSON.` },
  ]
  
  if (screenshots.above) {
    contentParts.push({ type: 'image_url', image_url: { url: screenshots.above } })
  }
  if (screenshots.full) {
    contentParts.push({ type: 'image_url', image_url: { url: screenshots.full } })
  }
  
  if (contentParts.length === 1) {
    throw new Error('No screenshots captured — cannot analyze design')
  }
  
  const messages = [
    { role: 'system', content: DESIGN_ANALYST_PROMPT },
    { role: 'user', content: contentParts },
  ]
  
  const result = await callLLM(userId || null, messages, {
    model: 'gpt-4.1',
    temperature: 0.3,
    maxTokens: 4000,
  })
  
  const raw = result.choices?.[0]?.message?.content || ''
  const duration = Date.now() - start
  console.log(`[WebVision] Design analysis completed in ${duration}ms (${raw.length} chars)`)
  
  // Parse JSON from LLM response (handle markdown fences)
  let jsonStr = raw
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonMatch) jsonStr = jsonMatch[1]
  
  // Try to find JSON object directly
  const braceStart = jsonStr.indexOf('{')
  const braceEnd = jsonStr.lastIndexOf('}')
  if (braceStart >= 0 && braceEnd > braceStart) {
    jsonStr = jsonStr.slice(braceStart, braceEnd + 1)
  }
  
  try {
    const parsed = JSON.parse(jsonStr)
    return {
      url,
      timestamp: new Date().toISOString(),
      ...parsed,
    }
  } catch (parseErr) {
    console.error('[WebVision] Failed to parse design analysis JSON:', parseErr)
    // Return a minimal fallback with the raw text
    return {
      url,
      timestamp: new Date().toISOString(),
      overall: { aesthetic: 'Unknown', industry: 'Unknown', quality: 'Unknown', mood: 'Unknown' },
      colors: { background: '#0a0a0f', foreground: '#ffffff', primary: '#6366f1', secondary: '#8b5cf6', muted: '#71717a', surface: '#1a1a2e', palette: [] },
      typography: { headingFont: 'Inter', bodyFont: 'Inter', weights: ['400', '600', '700'], headingStyle: 'Bold', sizeScale: 'Standard' },
      layout: { structure: 'Single-page', navStyle: 'Fixed top', heroStyle: 'Full-screen', gridSystem: 'Standard', sections: [] },
      components: { cards: 'Standard', buttons: 'Standard', forms: 'Standard', effects: 'None detected', animations: 'None detected' },
      cssTokens: raw.substring(0, 500),
      tailwindConfig: '',
    }
  }
}

// ── Format analysis as LLM context block ──
export function formatDesignReference(analysis: DesignAnalysis): string {
  return `\n[DESIGN_REFERENCE — Analyzed from ${analysis.url}]
The user wants to create something inspired by this website. Use these EXACT design tokens:

AESTHETIC: ${analysis.overall.aesthetic} | ${analysis.overall.mood} | ${analysis.overall.quality}
INDUSTRY: ${analysis.overall.industry}

COLOR PALETTE:
  Background: ${analysis.colors.background}
  Foreground: ${analysis.colors.foreground}
  Primary/Accent: ${analysis.colors.primary}
  Secondary: ${analysis.colors.secondary}
  Muted: ${analysis.colors.muted}
  Surface/Cards: ${analysis.colors.surface}
  Full palette: ${analysis.colors.palette.join(', ')}

TYPOGRAPHY:
  Headings: ${analysis.typography.headingFont} — ${analysis.typography.headingStyle}
  Body: ${analysis.typography.bodyFont}
  Weights: ${analysis.typography.weights.join(', ')}
  Scale: ${analysis.typography.sizeScale}

LAYOUT:
  Structure: ${analysis.layout.structure}
  Navigation: ${analysis.layout.navStyle}
  Hero: ${analysis.layout.heroStyle}
  Grid: ${analysis.layout.gridSystem}
  Sections: ${analysis.layout.sections.join(' → ')}

COMPONENTS:
  Cards: ${analysis.components.cards}
  Buttons: ${analysis.components.buttons}
  Forms: ${analysis.components.forms}
  Effects: ${analysis.components.effects}
  Animations: ${analysis.components.animations}

READY-TO-USE CSS TOKENS:
${analysis.cssTokens}

TAILWIND CONFIG EXTEND:
${analysis.tailwindConfig}

IMPORTANT: Use these exact colors, fonts, and patterns. Do NOT substitute or simplify.
Create original content (different brand name, copy) but match the VISUAL STYLE exactly.
[/DESIGN_REFERENCE]\n`
}

// ── URL Detection — does the user want design inspiration? ──
const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi
const DESIGN_INTENT_ES = /\b(mira|mirala|analiza|como esta|parecid[oa]|inspir|estilo|diseño|copia|clona|replica|referencia|hazme.*como|similar|igualit)\b/i
const DESIGN_INTENT_EN = /\b(look at|check out|like this|inspired by|similar to|clone|replicate|make.*like|design like|style of|copy.*design|reference)\b/i

export function detectDesignIntent(message: string): { hasUrl: boolean; url: string; hasIntent: boolean } {
  const urlMatch = message.match(URL_PATTERN)
  if (!urlMatch) return { hasUrl: false, url: '', hasIntent: false }
  
  const url = urlMatch[0].replace(/[.,;:!?]+$/, '') // Strip trailing punctuation
  const hasIntent = DESIGN_INTENT_ES.test(message) || DESIGN_INTENT_EN.test(message)
  
  return { hasUrl: true, url, hasIntent }
}