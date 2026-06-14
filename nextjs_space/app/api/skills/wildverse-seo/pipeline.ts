import { prisma } from '@/lib/prisma'
import { callLLM } from '@/lib/turbo-llm'
import { generateBlogImage } from '@/services/image-generator'
import { authorizePublish } from '@/lib/skills/skill-factory-service'

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const WILDVERSE_CTA = `<div style="margin-top:2.5rem;padding:2rem;background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:16px;border:1px solid #334155;text-align:center;">
  <p style="font-size:0.85rem;font-weight:600;color:#4ade80;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:0.5rem;">🦖 Free AI Scanner</p>
  <h3 style="font-size:1.5rem;font-weight:800;margin-bottom:0.75rem;color:#f8fafc;">What Are You Really Eating?</h3>
  <p style="font-size:1.05rem;margin-bottom:1.25rem;color:#94a3b8;">Thousands of people are already scanning their groceries with Wildverse. One scan reveals every hidden additive, sugar, and chemical in your food — in 3 seconds. Don't be the last to know what's on your plate.</p>
  <a href="https://wildverse.io" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:1rem 2.5rem;background:linear-gradient(135deg,#16a34a,#059669);color:white;border-radius:12px;text-decoration:none;font-weight:bold;font-size:1.15rem;box-shadow:0 4px 20px rgba(22,163,74,0.4);">Start Scanning Free →</a>
  <p style="margin-top:0.75rem;font-size:0.85rem;color:#64748b;">No downloads. No signup. Just the truth about your food.</p>
</div>`

const CURRENT_YEAR = new Date().getFullYear()

// ─── TITLE CASE HELPER ────────────────────────────────────────────────────────

const TITLE_CASE_MINOR = new Set([
  'a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'yet', 'so',
  'in', 'on', 'at', 'to', 'by', 'of', 'up', 'as', 'is', 'if', 'it',
  'vs', 'via', 'with', 'from', 'into', 'over', 'upon',
])

const KNOWN_ABBREVIATIONS: Record<string, string> = {
  'ai': 'AI', 'seo': 'SEO', 'crm': 'CRM', 'api': 'API', 'saas': 'SaaS',
  'roi': 'ROI', 'kpi': 'KPI', 'b2b': 'B2B', 'b2c': 'B2C', 'cms': 'CMS',
  'llm': 'LLM', 'gpt': 'GPT', 'url': 'URL', 'html': 'HTML', 'css': 'CSS',
  'pdf': 'PDF', 'cta': 'CTA', 'ceo': 'CEO', 'cto': 'CTO', 'cfo': 'CFO',
  'fda': 'FDA', 'gmo': 'GMO', 'bpa': 'BPA', 'dna': 'DNA', 'usda': 'USDA',
  'chatgpt': 'ChatGPT', 'openai': 'OpenAI', 'wordpress': 'WordPress',
  'youtube': 'YouTube', 'linkedin': 'LinkedIn', 'instagram': 'Instagram',
  'whatsapp': 'WhatsApp', 'tiktok': 'TikTok', 'github': 'GitHub',
  'ecommerce': 'eCommerce', 'paypal': 'PayPal', 'shopify': 'Shopify',
  'smb': 'SMB', 'diy': 'DIY', 'ux': 'UX', 'ui': 'UI',
}

// Fix brand names in HTML content (case-insensitive, handles punctuation)
const BRAND_FIXES: [RegExp, string][] = Object.entries(KNOWN_ABBREVIATIONS)
  .filter(([, v]) => /[A-Z].*[a-z]|[a-z].*[A-Z]/.test(v) || v.length >= 2)
  .map(([k, v]) => [new RegExp(`\\b${k}\\b`, 'gi'), v])

function fixBrandNames(html: string): string {
  return html.replace(/>([^<]+)</g, (_match, text) => {
    let fixed = text as string
    for (const [pattern, replacement] of BRAND_FIXES) {
      fixed = fixed.replace(pattern, replacement)
    }
    return `>${fixed}<`
  })
}

function toTitleCase(str: string): string {
  return str
    .split(/\s+/)
    .map((word, i) => {
      if (/^[A-Z]{2,}$/.test(word)) return word
      if (/^\(/.test(word)) return word
      if (word.includes('-')) {
        return word.split('-').map((part, j) => {
          const lower = part.toLowerCase()
          if (KNOWN_ABBREVIATIONS[lower]) return KNOWN_ABBREVIATIONS[lower]
          if (j === 0 && i === 0) return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
          if (part.length <= 2 && j > 0) return part.toLowerCase()
          return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
        }).join('-')
      }
      const lower = word.toLowerCase()
      if (KNOWN_ABBREVIATIONS[lower]) return KNOWN_ABBREVIATIONS[lower]
      if (i === 0) return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      if (TITLE_CASE_MINOR.has(lower)) return lower
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
}

// ─── STEP 1: TOPIC GENERATION ────────────────────────────────────────────────

const TOPIC_PROMPT = `You are an elite SEO content strategist. You ONLY speak and write in American English.

Generate ONE unique blog article topic about food science, nutrition transparency, or ingredient analysis for a health platform called Wildverse.

SEO TITLE FORMULA (MANDATORY):
  [Number] [Primary Keyword] + [Benefit or Warning] (${CURRENT_YEAR})
  The primary keyword appears within the first 60 characters.

Examples of CORRECT titles:
- "7 Hidden Sugars in 'Healthy' Foods That Spike Your Blood Sugar (${CURRENT_YEAR})"
- "12 Ultra-Processed Ingredients Linked to Chronic Inflammation (${CURRENT_YEAR})"
- "5 Artificial Sweeteners the FDA Still Allows — and Why Experts Worry (${CURRENT_YEAR})"

ZERO STATISTICS POLICY: Use qualitative language ("numerous", "many", "several") instead of specific percentages or numbers in descriptions. Numbers in titles are OK.

META DESCRIPTION RULES:
- Must be 120-155 characters (Google truncates at ~155).
- Include the primary keyword naturally.
- Include a micro-CTA ("Learn more", "Find out", "Discover").
- Make it compelling — this is your ad copy on Google's results page.

COVER IMAGE PROMPT: Generate a 1-2 sentence image description. Style: minimalist, Apple-style product photography, clean white background, abstract representation, health/food science themed, NO text, NO people.

Return ONLY a JSON object:
{"title": "SEO Title in Title Case Here", "keyword": "primary keyword", "angle": "brief unique angle", "metaDescription": "Compelling 120-155 char meta description with keyword and CTA", "coverImagePrompt": "Image description"}`

// ─── STEP 2: ARTICLE GENERATION ──────────────────────────────────────────────

function buildArticlePrompt(topic: { title: string; keyword: string; angle: string; metaDescription?: string }, seriesContext?: { seriesTheme: string; position: string; crossRefHint: string; otherTitles: string[] }): string {
  const seriesInstructions = seriesContext ? `
━━━ SERIES CONTEXT (CRITICAL) ━━━
This article is ${seriesContext.position} in a series about "${seriesContext.seriesTheme}".
Other articles in this series: ${seriesContext.otherTitles.map((t, i) => `\n  - ${t}`).join('')}
Connection: ${seriesContext.crossRefHint}

- Reference the other articles naturally in the text (e.g., "As we explored in our previous article on..." or "In our upcoming deep-dive into...").
- Do NOT use <a href> links. Just mention the titles as plain text.
- Make sure this article provides UNIQUE value — do not repeat what the other articles cover.
- Acknowledge the broader series theme in the introduction.
` : ''

  return `You are a world-class nutrition journalist and SEO expert. You ONLY write in American English.
ALL output — every word, heading, paragraph, FAQ answer — MUST be in American English. ZERO Spanish or other languages.

Write a COMPREHENSIVE, AUTHORITATIVE, LONG-FORM blog article optimized for Google ranking and Featured Snippets.

TOPIC: ${topic.title}
PRIMARY KEYWORD: ${topic.keyword}
ANGLE: ${topic.angle}
YEAR: ${CURRENT_YEAR}
${seriesContext ? seriesInstructions : ''}

OUTPUT: Return ONLY clean HTML (no JSON wrapper, no markdown fences, no <html>/<body> tags).

━━━ ZERO STATISTICS POLICY ━━━
- NEVER use specific numbers, percentages, or statistics in visible text.
- Use qualitative language BUT you MUST invent your own unique phrasing each time. NEVER reuse any qualifier phrase — each one must be completely different from every other one in the article.
  RULES:
  1. Create 8+ UNIQUE attribution phrases across the article. No two can share the same structure or key words.
  2. Vary the SUBJECT (nutritionists, dietitians, researchers, health coaches, food scientists, clinical teams, wellness experts, practitioners...)
  3. Vary the VERB (report, observe, discover, notice, confirm, document, highlight, demonstrate, reveal, note, emphasize, point out...)
  4. Vary the STRUCTURE — mix these patterns: "X report that...", "According to X...", "As X have noted...", "X's experience shows...", "In the words of X..."
  5. FORBIDDEN phrases (do NOT use these exact wordings): "numerous studies suggest", "research indicates", "studies show", "reports suggest"
  ❌ BAD: Reusing "clinical observations consistently find" or "laboratory testing reveals" more than once.
  ✅ GOOD: Every single attribution phrase is unique in structure, subject, and verb.
- This protects content from becoming outdated.

━━━ NATURAL KEYWORD USAGE (CRITICAL) ━━━
- Use 3-5 semantic variations of "${topic.keyword}" naturally throughout the text.
- NEVER paste the raw keyword phrase directly into headings. Rephrase it grammatically.
  ❌ BAD:  "How ${topic.keyword} Affects Your Health" (robotic, keyword-stuffed)
  ✅ GOOD: "How These ${topic.keyword.split(' ')[0]} Issues Impact Your Long-Term Health"
  ✅ GOOD: "The Real Health Impact of ${topic.keyword.split(' ').slice(0, 2).join(' ')} Exposure"
- ALL headings MUST read as natural, fluent English — as if a professional editor wrote them.
- Include at least 2 long-tail question keywords as <h3> subheadings (phrased as real questions people search).

━━━ ARTICLE STRUCTURE (MANDATORY) ━━━
Every section MUST have a proper <h2> or <h3> heading. ALL headings in Title Case.

1. <h2>Understanding [Natural Rephrase of Topic] in ${CURRENT_YEAR}</h2>
   → 3-4 paragraphs: definition, scientific context, why it matters now.
   → Use qualitative data ("numerous peer-reviewed studies suggest").
   → Minimum 250 words for this section.

2. <h2>[Number] [Natural Keyword Variation] [Benefit/Warning]</h2>
   → Use <ol> with <li> items. Each: <li><strong>Item Name</strong> — description (50+ words per item)</li>
   → Minimum 7 items, ideally 10.
   → CRITICAL: If the title contains a number (e.g., "7 Hidden Dangers..."), the content MUST match that exact number. Do NOT list 10 items when the title says 7.
   → Include concrete examples, brand names, or product categories where relevant.

3. <h2>The Real Health Impact of [Natural Rephrase]</h2>
   → 3-4 paragraphs with qualitative study references.
   → Include a <h3> long-tail question.
   → Minimum 250 words.

4. <h2>Science-Backed Prevention Strategies</h2>
   → 2-3 paragraphs with actionable advice.
   → Use <ul> bullet points for tips.
   → Minimum 200 words.

5. <h2>Frequently Asked Questions</h2>
   → Minimum 5 questions people actually search on Google.
   → Format: <h3>Question in Title Case?</h3> <p>Answer (80+ words, snippet-friendly)</p>
   → First sentence of each answer = direct, concise answer (this becomes the featured snippet).

6. <h2>What Wildverse Experts Recommend</h2>
   → Expert-tone closing, 2-3 paragraphs.
   → End with a forward-looking statement.

━━━ INTERNAL LINKING POLICY ━━━
- Do NOT create any internal anchor links (<a href>).
- Reference other topics only as plain text.

━━━ CTAs (CRITICAL: MAXIMUM VARIETY) ━━━
- Include 3 organic CTAs placed naturally after impactful paragraphs.
- EACH CTA must use a COMPLETELY DIFFERENT emotional trigger. Pick 3 from this list (never use the same trigger twice):
  1. CURIOSITY: <p><strong>What's really hiding in your favorite snack?</strong> <a href="https://wildverse.io" target="_blank" rel="noopener noreferrer">Scan it with Wildverse</a> — the answer might change what you buy next.</p>
  2. PROTECTION: <p><strong>Your family deserves to know what's in their food.</strong> <a href="https://wildverse.io" target="_blank" rel="noopener noreferrer">Wildverse scans any product in 3 seconds</a> — free.</p>
  3. PAIN POINT: <p><strong>Tired of decoding confusing ingredient labels?</strong> Let AI do it. <a href="https://wildverse.io" target="_blank" rel="noopener noreferrer">Try Wildverse free</a> and see what labels really mean.</p>
  4. SOCIAL PROOF: <p><strong>Thousands of families already scan their groceries before buying.</strong> <a href="https://wildverse.io" target="_blank" rel="noopener noreferrer">Join them on Wildverse</a> — it takes 3 seconds.</p>
  5. REVELATION: <p><strong>That "healthy" label might not mean what you think.</strong> <a href="https://wildverse.io" target="_blank" rel="noopener noreferrer">Wildverse reveals what's really inside</a>.</p>
  6. FOMO: <p><strong>Your neighbor already scanned their pantry. Have you?</strong> <a href="https://wildverse.io" target="_blank" rel="noopener noreferrer">Wildverse</a> — the AI food scanner trusted by health-conscious families.</p>
  7. EMPOWERMENT: <p><strong>Knowledge is power — especially at the grocery store.</strong> <a href="https://wildverse.io" target="_blank" rel="noopener noreferrer">Scan smarter with Wildverse</a>.</p>
- NEVER use the same CTA wording across articles. Rewrite each CTA fresh.
- Space them out — one in the first third, one in the middle, one near the end.

━━━ WRITING RULES ━━━
- TARGET: 2000+ words total. Minimum 1500 words. Each H2 section: 200+ words.
- Professional, authoritative tone — science-backed but accessible.
- Use transition phrases between sections for smooth reading flow.
- ZERO typos. Well-formed HTML.
- ALL headings in Title Case (capitalize major words, lowercase articles/prepositions).
- ALL content in AMERICAN ENGLISH. Not a single word in Spanish or any other language.
- Write in-depth. Be thorough. Google rewards comprehensive content that fully answers the searcher's intent.

━━━ READABILITY & FORMATTING (CRITICAL) ━━━
- MAXIMUM paragraph length: 80 words. If a paragraph exceeds 80 words, SPLIT IT into two.
- After every 2-3 paragraphs, insert a visual break: a <ul>/<ol> list, a <blockquote>, a bold key takeaway, or a new <h3> subheading.
- Use SHORT, punchy sentences mixed with longer ones. Vary rhythm.
- Start some paragraphs with a question, a bold statement, or a single-word opener ("Here's the thing.", "Consider this.", "Why?").
- Use <strong> tags to highlight key phrases within paragraphs — this helps scanners.
- Avoid walls of text. If a section looks like a block of 4+ consecutive paragraphs without any list, heading, or visual element, ADD one.

Write the article NOW. Return ONLY the HTML content.`
}

// ─── STEP 3: LANGUAGE VALIDATION (PURE CODE — NO LLM) ──────────────────────

interface LanguageValidation {
  passed: boolean
  spanishWordCount: number
  detectedWords: string[]
  details: string
}

function validateLanguage(html: string): LanguageValidation {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

  const spanishIndicators = [
    'también', 'además', 'según', 'través', 'después', 'número',
    'artículo', 'información', 'investigación', 'científico', 'científica',
    'salud', 'alimentos', 'ingredientes', 'azúcar', 'azúcares',
    'cuerpo', 'consumo', 'productos', 'pueden', 'tienen',
    'estas', 'estos', 'aquí', 'ahora', 'siempre', 'nunca',
    'porque', 'cuando', 'donde', 'mientras', 'durante',
    'necesita', 'necesario', 'importante', 'posible',
    'ejemplo', 'manera', 'forma', 'parte', 'mismo',
    'comida', 'etiqueta', 'nutrición', 'alimentación',
    'descubre', 'conoce', 'aprende', 'encuentra',
    'preguntas frecuentes', 'qué es', 'cómo funciona',
    'más información', 'por qué', 'para qué',
  ]

  const hasInvertedQuestion = /¿/.test(text)
  const hasInvertedExclamation = /¡/.test(text)
  const hasSpanishChars = /[ñÑáéíóúÁÉÍÓÚüÜ]/.test(text)

  const lowerText = text.toLowerCase()
  const detectedWords: string[] = []

  for (const word of spanishIndicators) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi')
    if (regex.test(lowerText)) {
      detectedWords.push(word)
    }
  }

  if (hasInvertedQuestion) detectedWords.push('¿ (inverted question mark)')
  if (hasInvertedExclamation) detectedWords.push('¡ (inverted exclamation)')

  const accentedMatches = text.match(/[áéíóúÁÉÍÓÚüÜ]/g) || []
  if (accentedMatches.length > 5 && hasSpanishChars) {
    detectedWords.push(`${accentedMatches.length} accented characters`)
  }

  const passed = detectedWords.length === 0

  return {
    passed,
    spanishWordCount: detectedWords.length,
    detectedWords,
    details: passed
      ? 'PASSED — No Spanish language detected'
      : `FAILED — Found ${detectedWords.length} Spanish indicators: ${detectedWords.slice(0, 10).join(', ')}`,
  }
}

// ─── STEP 4: STRUCTURE VALIDATION (PURE CODE — NO LLM) ─────────────────────

interface StructureValidation {
  passed: boolean
  checks: Record<string, { passed: boolean; detail: string }>
  details: string
}

function validateStructure(html: string): StructureValidation {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const wordCount = text.split(/\s+/).length

  const h2Count = (html.match(/<h2[^>]*>/gi) || []).length
  const h3Count = (html.match(/<h3[^>]*>/gi) || []).length

  const hasFAQ = /<h2[^>]*>.*?(?:frequently|faq|questions)/i.test(html)
  const hasCTA = /wildverse/i.test(html) && (/scan/i.test(html) || /download/i.test(html))
  const hasList = /<(?:ol|ul)[^>]*>/i.test(html)

  // Check heading quality — detect raw keyword stuffing
  const h2Matches = html.match(/<h2[^>]*>(.*?)<\/h2>/gi) || []
  const headingsLowercase = h2Matches.filter(h => {
    const inner = h.replace(/<[^>]+>/g, '').trim()
    // Flag if entire heading is lowercase (except first word)
    const words = inner.split(/\s+/).filter(w => w.length > 3)
    const lowercaseCount = words.filter(w => w === w.toLowerCase()).length
    return words.length > 3 && lowercaseCount >= words.length * 0.8
  })
  const headingsProperCase = headingsLowercase.length === 0

  const checks: Record<string, { passed: boolean; detail: string }> = {
    wordCount: { passed: wordCount >= 1200, detail: `${wordCount} words (minimum 1200, target 2000+)` },
    h2Headings: { passed: h2Count >= 4, detail: `${h2Count} H2 headings found (minimum 4)` },
    h3Subheadings: { passed: h3Count >= 3, detail: `${h3Count} H3 subheadings found (minimum 3)` },
    faqSection: { passed: hasFAQ, detail: hasFAQ ? 'FAQ section detected' : 'No FAQ section found' },
    ctaPresent: { passed: hasCTA, detail: hasCTA ? 'Wildverse CTA detected' : 'No Wildverse CTA found' },
    listContent: { passed: hasList, detail: hasList ? 'List content detected' : 'No list (ol/ul) found' },
    headingQuality: { passed: headingsProperCase, detail: headingsProperCase ? 'Headings in proper Title Case' : `${headingsLowercase.length} heading(s) appear lowercase/keyword-stuffed` },
  }

  const allPassed = Object.values(checks).every(c => c.passed)
  const failedChecks = Object.entries(checks).filter(([, c]) => !c.passed)

  return {
    passed: allPassed,
    checks,
    details: allPassed
      ? 'PASSED — All structure checks OK'
      : `FAILED — ${failedChecks.length} check(s) failed: ${failedChecks.map(([k, c]) => `${k}: ${c.detail}`).join('; ')}`,
  }
}

// ─── SLUG GENERATOR ──────────────────────────────────────────────────────────

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .substring(0, 120)
    .replace(/-$/, '')
}

// ─── DECRYPT API KEY ─────────────────────────────────────────────────────────

function decryptApiKey(encrypted: string): string {
  try {
    const decoded = Buffer.from(encrypted, 'base64').toString('utf-8')
    const salt = process.env.NEXTAUTH_SECRET || 'octopus-salt'
    return decoded.replace(`${salt}:`, '')
  } catch {
    return encrypted
  }
}

// ─── PIPELINE RESULT TYPE ────────────────────────────────────────────────────

// ─── SERIES TOPIC GENERATION PROMPT ──────────────────────────────────────────

const SERIES_TOPIC_PROMPT = `You are an elite SEO content strategist specializing in topical authority. You ONLY write in American English.

Generate a SERIES of 3 interconnected blog article topics about food science, nutrition transparency, or ingredient analysis for Wildverse.

SERIES STRATEGY:
- All 3 articles must share a PARENT THEME (e.g., "ultra-processed foods", "hidden sugars", "food additives")
- Article 1: AWARENESS — introduce the problem broadly ("What are X and why should you care?")
- Article 2: DEEP DIVE — explore a specific alarming aspect ("The hidden X in Y that Z")
- Article 3: ACTION — provide solutions and alternatives ("How to avoid X" or "Healthier alternatives to X")
- Each article targets a DIFFERENT long-tail keyword but all are semantically related
- Together they create a "topic cluster" that Google rewards with higher authority

SEO TITLE FORMULA (MANDATORY for each):
  [Number] [Primary Keyword] + [Benefit or Warning] (${CURRENT_YEAR})

ZERO STATISTICS POLICY: Use qualitative language instead of specific numbers in descriptions. Numbers in titles are OK.

META DESCRIPTION: 120-155 chars, include keyword, include micro-CTA.

COVER IMAGE PROMPT: 1-2 sentences, minimalist Apple-style, clean white background, health/food themed, NO text, NO people.

Return ONLY a JSON object:
{
  "seriesTheme": "Parent theme connecting all 3",
  "articles": [
    {"title": "Title 1", "keyword": "keyword1", "angle": "angle1", "metaDescription": "meta1", "coverImagePrompt": "img1", "seriesPosition": "Part 1 of 3", "crossRefHint": "Brief note on how this connects to parts 2 and 3"},
    {"title": "Title 2", "keyword": "keyword2", "angle": "angle2", "metaDescription": "meta2", "coverImagePrompt": "img2", "seriesPosition": "Part 2 of 3", "crossRefHint": "Brief note on how this connects to parts 1 and 3"},
    {"title": "Title 3", "keyword": "keyword3", "angle": "angle3", "metaDescription": "meta3", "coverImagePrompt": "img3", "seriesPosition": "Part 3 of 3", "crossRefHint": "Brief note on how this connects to parts 1 and 2"}
  ]
}`

// ─── SERIES CROSS-REFERENCE BANNER ───────────────────────────────────────────

function buildSeriesBanner(seriesTheme: string, currentIndex: number, allTitles: string[], allSlugs: string[]): string {
  const blogBase = 'https://blog.wildverse.io/blog'
  const otherArticles = allTitles
    .map((t, i) => {
      if (i === currentIndex) return null
      const url = `${blogBase}/${allSlugs[i]}`
      const label = i < currentIndex ? '← Previous' : 'Next →'
      return `<li style="margin-bottom:0.5rem;"><a href="${url}" style="color:#2563eb;text-decoration:underline;font-weight:600;">▶ Part ${i + 1}: ${t}</a> <span style="font-size:0.8rem;color:#64748b;">(${label})</span></li>`
    })
    .filter(Boolean)
    .join('\n')

  return `<div style="margin:2rem 0;padding:1.5rem;background:linear-gradient(135deg,#eff6ff,#dbeafe);border-radius:16px;border:2px solid #93c5fd;">
  <p style="font-size:0.85rem;text-transform:uppercase;letter-spacing:0.05em;color:#3b82f6;font-weight:700;margin-bottom:0.5rem;">📚 Series: ${seriesTheme} — Part ${currentIndex + 1} of ${allTitles.length}</p>
  <p style="font-size:1rem;color:#1e3a5f;margin-bottom:0.75rem;">This article is part of a comprehensive series. Read the full series for the complete picture:</p>
  <ul style="list-style:none;padding:0;margin:0;">
    ${otherArticles}
  </ul>
</div>`
}

// ─── INTERNAL LINK INJECTOR (POST-PROCESSING) ───────────────────────────────

function injectInternalLinks(html: string, otherArticles: { title: string; slug: string }[]): string {
  const blogBase = 'https://blog.wildverse.io/blog'
  let result = html
  let linksInjected = 0

  for (const article of otherArticles) {
    // Build variations of the title to match (with/without year, partial matches)
    const titleClean = article.title.replace(/\s*\(\d{4}\)\s*$/, '').trim()
    const titleVariations = [
      article.title,   // exact full title
      titleClean,      // without (2026)
    ]

    for (const variant of titleVariations) {
      if (variant.length < 10) continue // skip very short matches

      // Escape special regex characters in the title
      const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

      // Match the title only when it's NOT already inside an <a> tag or inside HTML attributes
      // Look for the title in regular text (not inside tags)
      const regex = new RegExp(
        `(?<!["'>])(?<!<a[^>]*>)(${escaped})(?![^<]*<\/a>)`,
        'gi'
      )

      // Only replace the FIRST occurrence to avoid over-linking
      const url = `${blogBase}/${article.slug}`
      const replaced = result.replace(regex, (_match, p1) => {
        linksInjected++
        return `<a href="${url}" style="color:#2563eb;text-decoration:underline;font-weight:500;">${p1}</a>`
      })

      if (replaced !== result) {
        result = replaced
        break // found a match for this article, move to next
      }
    }
  }

  console.log(`[Wildverse-SEO] 🔗 Internal links injected: ${linksInjected}`)
  return result
}

// ─── SERIES RESULT TYPE ──────────────────────────────────────────────────────

export interface WildverseSEOSeriesResult {
  success: boolean
  seriesTheme: string
  articlesPublished: number
  articlesTotal: number
  articles: WildverseSEOResult[]
  totalDuration: number
  error?: string
}

// ─── PIPELINE RESULT TYPE ────────────────────────────────────────────────────

export interface WildverseSEOResult {
  success: boolean
  pipeline: string
  error?: string
  article?: {
    title: string
    slug: string
    keyword: string
    publishedUrl: string
    coverImage: string | null
    metaDescription?: string
    wordCount: number
  }
  validation?: {
    language: { passed: boolean; detail: string }
    structure: { passed: boolean; checks: Record<string, { passed: boolean; detail: string }> }
  }
  steps: { step: string; status: string; duration: number; detail?: string }[]
  totalDuration: number
}

// ─── MAIN PIPELINE (EXPORTED) ────────────────────────────────────────────────

export async function runWildverseSEOPipeline(
  userId: string,
  params: { topic?: string; keyword?: string; instructions?: string },
  seriesContext?: { seriesTheme: string; position: string; crossRefHint: string; otherTitles: string[]; otherSlugs?: string[]; seriesBanner?: string }
): Promise<WildverseSEOResult> {
  const pipelineStart = Date.now()
  const steps: { step: string; status: string; duration: number; detail?: string }[] = []

  try {
    const { topic: userTopic, keyword: userKeyword, instructions } = params

    console.log(`[Wildverse-SEO] ━━━ Pipeline started ━━━`)
    console.log(`[Wildverse-SEO] User input: topic="${userTopic || 'auto'}" keyword="${userKeyword || 'auto'}" instructions="${instructions || 'none'}"`)

    // Get publisher config
    const publisherConfig = await prisma.apiKey.findFirst({
      where: { userId, serviceType: 'content_publisher', status: 'active' },
    })

    if (!publisherConfig?.baseUrl) {
      return {
        success: false,
        pipeline: 'blocked',
        error: 'No Content Publisher configured. Go to API Hub to set it up.',
        steps,
        totalDuration: Date.now() - pipelineStart,
      }
    }

    // ═══ STEP 1: TOPIC GENERATION ═══
    const step1Start = Date.now()
    console.log('[Wildverse-SEO] Step 1: Generating topic...')

    let topic: { title: string; keyword: string; angle: string; metaDescription?: string; coverImagePrompt?: string }

    if (userTopic && userKeyword) {
      topic = {
        title: userTopic,
        keyword: userKeyword,
        angle: instructions || 'Comprehensive guide',
        metaDescription: '',
        coverImagePrompt: '',
      }
      steps.push({ step: 'topic', status: 'provided', duration: Date.now() - step1Start, detail: topic.title })
    } else {
      const userPrompt = userTopic
        ? `Generate a blog topic about: ${userTopic}. ${instructions || ''}`
        : instructions
          ? `Generate a blog topic based on: ${instructions}`
          : 'Generate a fresh, unique blog topic for today. Make it trending and SEO-optimized.'

      const topicResponse = await callLLM(userId, [
        { role: 'system', content: TOPIC_PROMPT },
        { role: 'user', content: userPrompt },
      ], { model: 'gpt-4.1', temperature: 0.9, maxTokens: 500 })

      const topicText = topicResponse.choices?.[0]?.message?.content || ''
      const jsonMatch = topicText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('Topic generation failed — no JSON in response')
      topic = JSON.parse(jsonMatch[0])

      steps.push({ step: 'topic', status: 'generated', duration: Date.now() - step1Start, detail: topic.title })
    }

    console.log(`[Wildverse-SEO] Topic: "${topic.title}" (keyword: ${topic.keyword})`)

    // ═══ STEP 2: ARTICLE GENERATION ═══
    const step2Start = Date.now()
    console.log('[Wildverse-SEO] Step 2: Generating article...')

    const articleResponse = await callLLM(userId, [
      { role: 'system', content: buildArticlePrompt(topic, seriesContext) },
      { role: 'user', content: `Write the complete article about "${topic.title}" with angle: ${topic.angle}. Remember: AMERICAN ENGLISH ONLY.${seriesContext ? ` This is ${seriesContext.position} in a series about "${seriesContext.seriesTheme}".` : ''}` },
    ], { model: 'gpt-4.1', temperature: 0.6, maxTokens: 12000 })

    let articleContent = articleResponse.choices?.[0]?.message?.content || ''
    articleContent = articleContent.replace(/^```html\s*/i, '').replace(/```\s*$/i, '').trim()

    if (!articleContent || articleContent.length < 500) {
      throw new Error(`Article generation failed — content too short (${articleContent.length} chars)`)
    }

    // ═══ POST-PROCESSING: Title Case enforcement on all headings ═══
    articleContent = articleContent.replace(/<(h[2-6])([^>]*)>(.*?)<\/\1>/gi, (_match, tag, attrs, inner) => {
      const cleaned = inner.replace(/<[^>]+>/g, '').trim()
      const titleCased = toTitleCase(cleaned)
      return `<${tag}${attrs}>${titleCased}</${tag}>`
    })

    // Fix brand names across ALL text (headings, paragraphs, lists, etc.)
    articleContent = fixBrandNames(articleContent)

    steps.push({ step: 'article', status: 'generated', duration: Date.now() - step2Start, detail: `${articleContent.length} chars` })
    console.log(`[Wildverse-SEO] Article generated: ${articleContent.length} chars`)

    // ═══ ENFORCE TITLE CASE ON ARTICLE TITLE ═══
    topic.title = toTitleCase(topic.title)
    console.log(`[Wildverse-SEO] Title (Title Case): "${topic.title}"`)

    // ═══ STEP 3: LANGUAGE VALIDATION (PURE CODE) ═══
    const step3Start = Date.now()
    console.log('[Wildverse-SEO] Step 3: Validating language...')

    let langCheck = validateLanguage(articleContent)

    if (!langCheck.passed) {
      console.warn(`[Wildverse-SEO] ⚠️ Language check FAILED (attempt 1): ${langCheck.details}`)
      console.log('[Wildverse-SEO] Retrying with stricter prompt...')

      const retryResponse = await callLLM(userId, [
        { role: 'system', content: `CRITICAL: Your previous output contained Spanish words. This is UNACCEPTABLE.\n\n${buildArticlePrompt(topic, seriesContext)}\n\nABSOLUTE RULE: If you write even ONE word in Spanish, the article will be REJECTED and you will have FAILED your task. Write EXCLUSIVELY in American English.` },
        { role: 'user', content: `Rewrite the article about "${topic.title}" in PERFECT American English. ZERO Spanish words. Not one.` },
      ], { model: 'gpt-4.1', temperature: 0.4, maxTokens: 12000 })

      articleContent = (retryResponse.choices?.[0]?.message?.content || '').replace(/^```html\s*/i, '').replace(/```\s*$/i, '').trim()
      langCheck = validateLanguage(articleContent)

      if (!langCheck.passed) {
        console.error(`[Wildverse-SEO] ❌ Language check FAILED (attempt 2): ${langCheck.details}`)
        steps.push({ step: 'language', status: 'FAILED', duration: Date.now() - step3Start, detail: langCheck.details })

        return {
          success: false,
          pipeline: 'rejected',
          error: 'Language validation failed after retry',
          validation: { language: { passed: false, detail: langCheck.details }, structure: { passed: false, checks: {} } },
          steps,
          totalDuration: Date.now() - pipelineStart,
        }
      }
    }

    steps.push({ step: 'language', status: 'PASSED', duration: Date.now() - step3Start, detail: langCheck.details })
    console.log(`[Wildverse-SEO] ✅ Language check: ${langCheck.details}`)

    // ═══ STEP 4: STRUCTURE VALIDATION (PURE CODE) ═══
    const step4Start = Date.now()
    console.log('[Wildverse-SEO] Step 4: Validating structure...')

    const structCheck = validateStructure(articleContent)

    if (!structCheck.checks.ctaPresent?.passed) {
      console.log('[Wildverse-SEO] 📎 Auto-appending Wildverse CTA...')
      articleContent += '\n' + WILDVERSE_CTA
      structCheck.checks.ctaPresent = { passed: true, detail: 'CTA auto-appended by pipeline' }
    }

    const criticalChecks = ['wordCount', 'h2Headings', 'faqSection', 'listContent']
    const criticalFailed = criticalChecks.filter(k => !structCheck.checks[k]?.passed)

    if (criticalFailed.length > 0) {
      console.error(`[Wildverse-SEO] ❌ Structure check FAILED: ${structCheck.details}`)
      steps.push({ step: 'structure', status: 'FAILED', duration: Date.now() - step4Start, detail: structCheck.details })

      return {
        success: false,
        pipeline: 'rejected',
        error: 'Structure validation failed',
        validation: { language: { passed: true, detail: langCheck.details }, structure: { passed: false, checks: structCheck.checks } },
        steps,
        totalDuration: Date.now() - pipelineStart,
      }
    }

    steps.push({ step: 'structure', status: 'PASSED', duration: Date.now() - step4Start, detail: structCheck.details })
    console.log(`[Wildverse-SEO] ✅ Structure check: ${structCheck.details}`)

    // ═══ STEP 5: COVER IMAGE GENERATION ═══
    const step5Start = Date.now()
    console.log('[Wildverse-SEO] Step 5: Generating cover image...')

    let coverImageUrl: string | null = null
    try {
      const imgResult = await generateBlogImage({
        title: topic.title,
        excerpt: articleContent.replace(/<[^>]+>/g, '').substring(0, 200),
        category: 'content',
        slug: generateSlug(topic.title),
        aspectRatio: '16:9',
        styleOverride: topic.coverImagePrompt || undefined,
        userId,
      })
      if (imgResult?.imageUrl) {
        coverImageUrl = imgResult.imageUrl
        console.log(`[Wildverse-SEO] ✅ Cover image: ${coverImageUrl.substring(0, 100)}...`)
      }
    } catch (imgErr) {
      console.warn('[Wildverse-SEO] ⚠️ Image generation failed (non-blocking):', imgErr)
    }

    steps.push({
      step: 'image',
      status: coverImageUrl ? 'generated' : 'skipped',
      duration: Date.now() - step5Start,
      detail: coverImageUrl ? coverImageUrl.substring(0, 100) : 'Image generation skipped',
    })

    // ═══ INJECT INTERNAL LINKS (if part of a series) ═══
    if (seriesContext?.otherTitles && seriesContext?.otherSlugs) {
      const otherArticleLinks = seriesContext.otherTitles.map((title, idx) => ({
        title,
        slug: seriesContext.otherSlugs![idx],
      }))
      articleContent = injectInternalLinks(articleContent, otherArticleLinks)
    }

    // ═══ INJECT SERIES BANNER (if part of a series) ═══
    if (seriesContext?.seriesBanner) {
      // Add banner at top of article (after first heading) and at bottom (before CTA)
      const firstH2End = articleContent.indexOf('</h2>')
      if (firstH2End > -1) {
        const insertPos = firstH2End + 5
        articleContent = articleContent.substring(0, insertPos) + '\n' + seriesContext.seriesBanner + '\n' + articleContent.substring(insertPos)
      } else {
        articleContent = seriesContext.seriesBanner + '\n' + articleContent
      }
      console.log(`[Wildverse-SEO] 📚 Series banner injected (${seriesContext.position})`)
    }

    // ═══ STEP 6: PUBLISH TO WILDVERSE ═══
    const step6Start = Date.now()
    console.log('[Wildverse-SEO] Step 6: Publishing to Wildverse...')

    const slug = generateSlug(topic.title)

    const publishAuth = authorizePublish({
      agentId: 'wildverse-seo-skill',
      title: topic.title,
      content: articleContent,
      contentType: 'blog_post',
      callerContext: 'agent-factory',
    })

    if (!publishAuth.authorized) {
      steps.push({ step: 'publish', status: 'BLOCKED', duration: Date.now() - step6Start, detail: publishAuth.reason || 'Not authorized' })
      return {
        success: false,
        pipeline: 'blocked',
        error: `Publish blocked: ${publishAuth.reason}`,
        steps,
        totalDuration: Date.now() - pipelineStart,
      }
    }

    const apiKey = decryptApiKey(publisherConfig.apiKey)
    const endpointUrl = publisherConfig.baseUrl

    const publishPayload: Record<string, unknown> = {
      title: topic.title,
      content: articleContent,
      slug,
      status: 'published',
    }

    if (coverImageUrl) {
      publishPayload.cover_image = coverImageUrl
      publishPayload.coverImage = coverImageUrl
    }

    if (topic.metaDescription) {
      publishPayload.metaDescription = topic.metaDescription
      publishPayload.meta_description = topic.metaDescription
      publishPayload.excerpt = topic.metaDescription
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'x-real-source': 'wildverse-seo-skill',
    }

    console.log(`[Wildverse-SEO] 🚀 POST to ${endpointUrl}`)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(publishPayload),
      signal: controller.signal,
    })

    clearTimeout(timeout)
    const duration = Date.now() - step6Start

    let responseText = ''
    try { responseText = await response.text() } catch { responseText = 'No response body' }

    let respJson: Record<string, unknown> = {}
    try { respJson = JSON.parse(responseText) } catch { /* non-JSON */ }

    const publishedUrl = (respJson.url || respJson.published_url || respJson.link || '') as string

    // Log to ContentPublishLog
    await prisma.contentPublishLog.create({
      data: {
        userId,
        agentId: 'wildverse-seo-skill',
        title: topic.title,
        slug,
        status: response.ok ? 'published' : 'error',
        contentType: 'blog_post',
        publishedUrl: publishedUrl || null,
        payload: JSON.stringify(publishPayload).substring(0, 10000),
        response: responseText.substring(0, 5000),
        duration,
        metadata: JSON.stringify({
          source: 'wildverse-seo-skill',
          httpStatus: response.status,
          coverImage: coverImageUrl,
          keyword: topic.keyword,
          metaDescription: topic.metaDescription,
          validations: {
            language: langCheck.passed ? 'PASSED' : 'FAILED',
            structure: structCheck.passed ? 'PASSED' : Object.fromEntries(
              Object.entries(structCheck.checks).map(([k, v]) => [k, v.passed ? '✓' : '✗'])
            ),
          },
          pipelineDuration: Date.now() - pipelineStart,
        }),
      },
    }).catch(err => console.error('[Wildverse-SEO] Log error:', err))

    if (response.ok) {
      steps.push({ step: 'publish', status: 'SUCCESS', duration, detail: publishedUrl || slug })
      console.log(`[Wildverse-SEO] ✅ Published: ${publishedUrl || slug} (${Date.now() - pipelineStart}ms total)`)

      return {
        success: true,
        pipeline: 'completed',
        article: {
          title: topic.title,
          slug,
          keyword: topic.keyword,
          publishedUrl: publishedUrl || `https://blog.wildverse.io/blog/${slug}`,
          coverImage: coverImageUrl,
          metaDescription: topic.metaDescription,
          wordCount: articleContent.replace(/<[^>]+>/g, ' ').split(/\s+/).length,
        },
        validation: {
          language: { passed: true, detail: langCheck.details },
          structure: { passed: true, checks: structCheck.checks },
        },
        steps,
        totalDuration: Date.now() - pipelineStart,
      }
    } else {
      steps.push({ step: 'publish', status: 'FAILED', duration, detail: `HTTP ${response.status}` })
      console.error(`[Wildverse-SEO] ❌ Publish failed: HTTP ${response.status}`)

      return {
        success: false,
        pipeline: 'failed',
        error: `Publish failed: HTTP ${response.status}`,
        steps,
        totalDuration: Date.now() - pipelineStart,
      }
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error(`[Wildverse-SEO] ❌ Pipeline error:`, errorMsg)

    return {
      success: false,
      pipeline: 'error',
      error: errorMsg,
      steps,
      totalDuration: Date.now() - pipelineStart,
    }
  }
}

// ─── SERIES PIPELINE (EXPORTED) ──────────────────────────────────────────────

export async function runWildverseSEOSeries(
  userId: string,
  params: { theme?: string; instructions?: string }
): Promise<WildverseSEOSeriesResult> {
  const seriesStart = Date.now()
  const results: WildverseSEOResult[] = []

  try {
    console.log(`[Wildverse-SEO] ━━━ SERIES Pipeline started ━━━`)
    console.log(`[Wildverse-SEO] Theme: "${params.theme || 'auto'}" Instructions: "${params.instructions || 'none'}"`)

    // ═══ STEP 0: GENERATE 3 CORRELATED TOPICS ═══
    const topicUserPrompt = params.theme
      ? `Generate a 3-article series about: ${params.theme}. ${params.instructions || ''}`
      : params.instructions
        ? `Generate a 3-article series based on: ${params.instructions}`
        : 'Generate a fresh, trending 3-article series for today about food science and nutrition transparency.'

    console.log('[Wildverse-SEO] Series Step 0: Generating 3 correlated topics...')

    const topicsResponse = await callLLM(userId, [
      { role: 'system', content: SERIES_TOPIC_PROMPT },
      { role: 'user', content: topicUserPrompt },
    ], { model: 'gpt-4.1', temperature: 0.9, maxTokens: 2000 })

    const topicsText = topicsResponse.choices?.[0]?.message?.content || ''
    const jsonMatch = topicsText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Series topic generation failed — no JSON in response')

    const seriesData = JSON.parse(jsonMatch[0]) as {
      seriesTheme: string
      articles: Array<{
        title: string; keyword: string; angle: string; metaDescription: string
        coverImagePrompt: string; seriesPosition: string; crossRefHint: string
      }>
    }

    if (!seriesData.articles || seriesData.articles.length < 3) {
      throw new Error(`Series topic generation returned ${seriesData.articles?.length || 0} articles instead of 3`)
    }

    const seriesTheme = seriesData.seriesTheme
    const articles = seriesData.articles.slice(0, 3)

    // Apply Title Case to all titles
    articles.forEach(a => { a.title = toTitleCase(a.title) })

    const allTitles = articles.map(a => a.title)
    const allSlugs = articles.map(a => generateSlug(a.title))

    console.log(`[Wildverse-SEO] Series theme: "${seriesTheme}"`)
    articles.forEach((a, i) => console.log(`[Wildverse-SEO]   Part ${i + 1}: "${a.title}" (keyword: ${a.keyword})`))

    // ═══ RUN PIPELINE FOR EACH ARTICLE SEQUENTIALLY ═══
    for (let i = 0; i < articles.length; i++) {
      const article = articles[i]
      console.log(`\n[Wildverse-SEO] ━━━ Series Article ${i + 1}/3 ━━━`)

      const seriesBanner = buildSeriesBanner(seriesTheme, i, allTitles, allSlugs)

      const result = await runWildverseSEOPipeline(
        userId,
        {
          topic: article.title,
          keyword: article.keyword,
          instructions: article.angle,
        },
        {
          seriesTheme,
          position: article.seriesPosition,
          crossRefHint: article.crossRefHint,
          otherTitles: allTitles.filter((_, j) => j !== i),
          otherSlugs: allSlugs.filter((_, j) => j !== i),
          seriesBanner,
        }
      )

      results.push(result)

      if (!result.success) {
        console.warn(`[Wildverse-SEO] ⚠️ Series article ${i + 1} failed: ${result.error}`)
        // Continue with next article even if one fails
      } else {
        console.log(`[Wildverse-SEO] ✅ Series article ${i + 1} published: ${result.article?.publishedUrl}`)
      }

      // Small delay between articles to avoid rate limits
      if (i < articles.length - 1) {
        console.log('[Wildverse-SEO] Waiting 3s before next article...')
        await new Promise(r => setTimeout(r, 3000))
      }
    }

    const published = results.filter(r => r.success).length
    const totalDuration = Date.now() - seriesStart

    console.log(`\n[Wildverse-SEO] ━━━ SERIES Complete ━━━`)
    console.log(`[Wildverse-SEO] Published: ${published}/${articles.length} | Duration: ${(totalDuration / 1000).toFixed(1)}s`)

    return {
      success: published > 0,
      seriesTheme,
      articlesPublished: published,
      articlesTotal: articles.length,
      articles: results,
      totalDuration,
      error: published === 0 ? 'All articles failed to publish' : undefined,
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error(`[Wildverse-SEO] ❌ Series error:`, errorMsg)

    return {
      success: false,
      seriesTheme: params.theme || 'unknown',
      articlesPublished: results.filter(r => r.success).length,
      articlesTotal: 3,
      articles: results,
      totalDuration: Date.now() - seriesStart,
      error: errorMsg,
    }
  }
}