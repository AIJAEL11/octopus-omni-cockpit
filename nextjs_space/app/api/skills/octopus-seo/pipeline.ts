import { prisma } from '@/lib/prisma'
import { callLLM } from '@/lib/turbo-llm'
import { generateBlogImage } from '@/services/image-generator'
import { authorizePublish } from '@/lib/skills/skill-factory-service'

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const BLOG_BASE = 'https://octopuskills.com/blog'

const OCTOPUS_CTA = `<div style="margin-top:2.5rem;padding:2rem;background:linear-gradient(135deg,#0F1419,#1A2332);border-radius:16px;border:1px solid #2D4A3E;text-align:center;">
  <p style="font-size:0.85rem;font-weight:600;color:#34d399;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:0.5rem;">🐙 AI Automation Platform</p>
  <h3 style="font-size:1.5rem;font-weight:800;margin-bottom:0.75rem;color:#f8fafc;">Stop Doing Everything Manually</h3>
  <p style="font-size:1.05rem;margin-bottom:1.25rem;color:#94a3b8;">Thousands of solopreneurs are already automating their marketing, sales, and content with Octopus Skills. One platform. 15+ AI modules. Zero coding required.</p>
  <a href="https://octopuskills.com" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:1rem 2.5rem;background:linear-gradient(135deg,#2D4A3E,#059669);color:white;border-radius:12px;text-decoration:none;font-weight:bold;font-size:1.15rem;box-shadow:0 4px 20px rgba(45,74,62,0.4);">Try Octopus Skills Free →</a>
  <p style="margin-top:0.75rem;font-size:0.85rem;color:#64748b;">No credit card. No setup headaches. Just results.</p>
</div>`

const CURRENT_YEAR = new Date().getFullYear()

// ─── TITLE CASE HELPER ────────────────────────────────────────────────────────

const TITLE_CASE_MINOR = new Set([
  'a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'yet', 'so',
  'in', 'on', 'at', 'to', 'by', 'of', 'up', 'as', 'is', 'if', 'it',
  'vs', 'via', 'with', 'from', 'into', 'over', 'upon',
])

// Known abbreviations that should always be uppercase
const KNOWN_ABBREVIATIONS: Record<string, string> = {
  'ai': 'AI', 'seo': 'SEO', 'crm': 'CRM', 'api': 'API', 'saas': 'SaaS',
  'roi': 'ROI', 'kpi': 'KPI', 'b2b': 'B2B', 'b2c': 'B2C', 'cms': 'CMS',
  'llm': 'LLM', 'gpt': 'GPT', 'url': 'URL', 'html': 'HTML', 'css': 'CSS',
  'pdf': 'PDF', 'cta': 'CTA', 'ceo': 'CEO', 'cto': 'CTO', 'cfo': 'CFO',
  'smb': 'SMB', 'diy': 'DIY', 'ux': 'UX', 'ui': 'UI',
  'chatgpt': 'ChatGPT', 'openai': 'OpenAI', 'wordpress': 'WordPress',
  'youtube': 'YouTube', 'linkedin': 'LinkedIn', 'instagram': 'Instagram',
  'whatsapp': 'WhatsApp', 'tiktok': 'TikTok', 'github': 'GitHub',
  'javascript': 'JavaScript', 'typescript': 'TypeScript', 'nodejs': 'NodeJS',
  'chatbot': 'Chatbot', 'ecommerce': 'eCommerce', 'paypal': 'PayPal',
  'shopify': 'Shopify', 'hubspot': 'HubSpot', 'mailchimp': 'Mailchimp',
}

// Fix brand names in HTML content (case-insensitive, handles punctuation)
const BRAND_FIXES: [RegExp, string][] = Object.entries(KNOWN_ABBREVIATIONS)
  .filter(([, v]) => /[A-Z].*[a-z]|[a-z].*[A-Z]/.test(v) || v.length >= 2) // mixed case or acronyms
  .map(([k, v]) => [new RegExp(`\\b${k}\\b`, 'gi'), v])

function fixBrandNames(html: string): string {
  // Only replace inside text nodes, not HTML attributes
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
      // Preserve fully uppercase words (like AI, SEO already in caps)
      if (/^[A-Z]{2,}$/.test(word)) return word
      // Handle parenthesized words
      if (/^\(/.test(word)) return word
      // Handle hyphenated words (e.g., "ai-powered" → "AI-Powered")
      if (word.includes('-')) {
        return word.split('-').map((part, j) => {
          const lower = part.toLowerCase()
          if (KNOWN_ABBREVIATIONS[lower]) return KNOWN_ABBREVIATIONS[lower]
          if (j === 0 && i === 0) return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
          if (part.length <= 2 && j > 0) return part.toLowerCase()
          return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
        }).join('-')
      }
      // Check known abbreviations
      const lower = word.toLowerCase()
      if (KNOWN_ABBREVIATIONS[lower]) return KNOWN_ABBREVIATIONS[lower]
      // First word always capitalized
      if (i === 0) return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      // Minor words lowercase
      if (TITLE_CASE_MINOR.has(lower)) return lower
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
}

// ─── STEP 1: TOPIC GENERATION ────────────────────────────────────────────────

const TOPIC_PROMPT = `You are an elite SEO content strategist. You ONLY speak and write in American English.

Generate ONE unique blog article topic about AI automation, no-code tools, or AI-powered business growth for solopreneurs and small businesses.

NICHE FOCUS AREAS:
- AI automation for small business operations
- No-code AI tools for marketing and sales
- AI content creation and social media automation
- AI lead generation and CRM automation
- Productivity hacks using AI
- AI for freelancers and creators
- ChatGPT, Claude, and AI tool comparisons
- AI video generation for marketing
- AI email marketing automation

SEO TITLE FORMULA (MANDATORY):
  [Number] [Primary Keyword] + [Benefit or Warning] (${CURRENT_YEAR})
  The primary keyword appears within the first 60 characters.

Examples of CORRECT titles:
- "7 AI Automation Tools That Replace a Full Marketing Team (${CURRENT_YEAR})"
- "12 No-Code AI Workflows Every Solopreneur Needs Right Now (${CURRENT_YEAR})"
- "5 AI Marketing Hacks That Actually Drive Revenue — Not Just Likes (${CURRENT_YEAR})"

ZERO STATISTICS POLICY: Use qualitative language ("numerous", "many", "several") instead of specific percentages or numbers in descriptions. Numbers in titles are OK.

META DESCRIPTION RULES:
- Must be 120-155 characters (Google truncates at ~155).
- Include the primary keyword naturally.
- Include a micro-CTA ("Learn more", "Find out", "Discover").
- Make it compelling — this is your ad copy on Google's results page.

CATEGORY: Choose the most fitting category from: ai-automation, marketing, productivity, no-code, case-studies, freelancers

COVER IMAGE PROMPT: Generate a 1-2 sentence image description. Style: minimalist, tech-forward, clean dark background, abstract AI/automation themed, NO text, NO people.

Return ONLY a JSON object:
{"title": "SEO Title in Title Case Here", "keyword": "primary keyword", "angle": "brief unique angle", "metaDescription": "Compelling 120-155 char meta description with keyword and CTA", "category": "ai-automation", "coverImagePrompt": "Image description"}`

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

  return `You are a world-class AI business strategist and SEO expert. You ONLY write in American English.
ALL output — every word, heading, paragraph, FAQ answer — MUST be in American English. ZERO Spanish or other languages.

Write a COMPREHENSIVE, AUTHORITATIVE, LONG-FORM blog article optimized for Google ranking and Featured Snippets.

TOPIC: ${topic.title}
PRIMARY KEYWORD: ${topic.keyword}
ANGLE: ${topic.angle}
YEAR: ${CURRENT_YEAR}
BRAND: Octopus Skills — the AI automation platform for solopreneurs and small businesses.
${seriesContext ? seriesInstructions : ''}

OUTPUT: Return ONLY clean HTML (no JSON wrapper, no markdown fences, no <html>/<body> tags).

━━━ ZERO STATISTICS POLICY ━━━
- NEVER use specific numbers, percentages, or statistics in visible text.
- Use qualitative language BUT you MUST invent your own unique phrasing each time. NEVER reuse any qualifier phrase — each one must be completely different from every other one in the article.
  RULES:
  1. Create 8+ UNIQUE attribution phrases across the article. No two can share the same structure or key words.
  2. Vary the SUBJECT (experts, teams, practitioners, founders, strategists, professionals, consultants, agencies, freelancers...)
  3. Vary the VERB (report, observe, discover, notice, confirm, document, highlight, demonstrate, reveal, note, emphasize, point out...)
  4. Vary the STRUCTURE — mix these patterns: "X report that...", "According to X...", "As X have noted...", "X's experience shows...", "In the words of X..."
  5. FORBIDDEN phrases (do NOT use these exact wordings): "numerous reports suggest", "industry reports suggest", "studies show", "research indicates"
  ❌ BAD: Reusing "early adopters consistently find" or "hands-on testing reveals" more than once.
  ✅ GOOD: Every single attribution phrase is unique in structure, subject, and verb.
- This protects content from becoming outdated.

━━━ NATURAL KEYWORD USAGE (CRITICAL) ━━━
- Use 3-5 semantic variations of "${topic.keyword}" naturally throughout the text.
- NEVER paste the raw keyword phrase directly into headings. Rephrase it grammatically.
  ❌ BAD:  "How ${topic.keyword} Affects Your Business" (robotic, keyword-stuffed)
  ✅ GOOD: "How These ${topic.keyword.split(' ')[0]} Strategies Transform Your Operations"
- ALL headings MUST read as natural, fluent English — as if a professional editor wrote them.
- Include at least 2 long-tail question keywords as <h3> subheadings (phrased as real questions people search).

━━━ ARTICLE STRUCTURE (MANDATORY) ━━━
Every section MUST have a proper <h2> or <h3> heading. ALL headings in Title Case.

1. <h2>Understanding [Natural Rephrase of Topic] in ${CURRENT_YEAR}</h2>
   → 3-4 paragraphs: definition, business context, why it matters now for solopreneurs.
   → Use qualitative data ("numerous industry reports suggest").
   → Minimum 250 words for this section.

2. <h2>[Number] [Natural Keyword Variation] [Benefit/Warning]</h2>
   → Use <ol> with <li> items. Each: <li><strong>Item Name</strong> — description (50+ words per item)</li>
   → Minimum 7 items, ideally 10.
   → CRITICAL: If the title contains a number (e.g., "7 AI Tools..."), the content MUST match that exact number. Do NOT list 10 items when the title says 7.
   → Include concrete examples, tool names, or real-world use cases.

3. <h2>The Real Business Impact of [Natural Rephrase]</h2>
   → 3-4 paragraphs with business case studies (qualitative).
   → Include a <h3> long-tail question.
   → Minimum 250 words.

4. <h2>Practical Implementation Strategies</h2>
   → 2-3 paragraphs with actionable steps solopreneurs can follow today.
   → Use <ul> bullet points for tips.
   → Minimum 200 words.

5. <h2>Frequently Asked Questions</h2>
   → Minimum 5 questions people actually search on Google.
   → Format: <h3>Question in Title Case?</h3> <p>Answer (80+ words, snippet-friendly)</p>
   → First sentence of each answer = direct, concise answer (this becomes the featured snippet).

6. <h2>What Octopus Skills Experts Recommend</h2>
   → Expert-tone closing, 2-3 paragraphs.
   → End with a forward-looking statement about AI automation trends.

━━━ INTERNAL LINKING POLICY ━━━
- Do NOT create any internal anchor links (<a href>).
- Reference other topics only as plain text.

━━━ CTAs (CRITICAL: MAXIMUM VARIETY) ━━━
- Include 3 organic CTAs placed naturally after impactful paragraphs.
- EACH CTA must use a COMPLETELY DIFFERENT emotional trigger. Pick 3 from this list (never use the same trigger twice):
  1. CURIOSITY: <p><strong>What could you build if repetitive tasks disappeared from your day?</strong> <a href="https://octopuskills.com" target="_blank" rel="noopener noreferrer">Explore what Octopus Skills automates</a> — you might be surprised.</p>
  2. ASPIRATION: <p><strong>The most successful solopreneurs don't work harder — they automate smarter.</strong> <a href="https://octopuskills.com" target="_blank" rel="noopener noreferrer">See how Octopus Skills helps you scale</a>.</p>
  3. PAIN POINT: <p><strong>Still copying data between apps at midnight?</strong> There's a better way. <a href="https://octopuskills.com" target="_blank" rel="noopener noreferrer">Let Octopus Skills handle the busywork</a>.</p>
  4. SOCIAL PROOF: <p><strong>Thousands of entrepreneurs already automate their workflows with AI.</strong> <a href="https://octopuskills.com" target="_blank" rel="noopener noreferrer">Join them on Octopus Skills — it's free to start</a>.</p>
  5. TIME SAVINGS: <p><strong>Imagine reclaiming 10 hours every week.</strong> That's what AI automation delivers. <a href="https://octopuskills.com" target="_blank" rel="noopener noreferrer">Try Octopus Skills free</a>.</p>
  6. FOMO: <p><strong>Your competitors are already using AI. Are you?</strong> <a href="https://octopuskills.com" target="_blank" rel="noopener noreferrer">Octopus Skills</a> — the all-in-one AI cockpit for growth-minded entrepreneurs.</p>
  7. SIMPLICITY: <p><strong>No coding. No complex setup. Just results.</strong> <a href="https://octopuskills.com" target="_blank" rel="noopener noreferrer">Start automating with Octopus Skills today</a>.</p>
- NEVER use the same CTA wording across articles. Rewrite each CTA fresh.
- Space them out — one in the first third, one in the middle, one near the end.

━━━ WRITING RULES ━━━
- TARGET: 2000+ words total. Minimum 1500 words. Each H2 section: 200+ words.
- Professional, authoritative tone — business-focused but accessible.
- Use transition phrases between sections for smooth reading flow.
- ZERO typos. Well-formed HTML.
- ALL headings in Title Case.
- ALL content in AMERICAN ENGLISH. Not a single word in Spanish or any other language.
- Write in-depth. Be thorough. Google rewards comprehensive content.

━━━ READABILITY & FORMATTING (CRITICAL) ━━━
- MAXIMUM paragraph length: 80 words. If a paragraph exceeds 80 words, SPLIT IT into two.
- After every 2-3 paragraphs, insert a visual break: a <ul>/<ol> list, a <blockquote>, a bold key takeaway, or a new <h3> subheading.
- Use SHORT, punchy sentences mixed with longer ones. Vary rhythm.
- Start some paragraphs with a question, a bold statement, or a single-word opener ("Here's the thing.", "Consider this.", "Why?").
- Use <strong> tags to highlight key phrases within paragraphs — this helps scanners.
- Avoid walls of text. If a section looks like a block of 4+ consecutive paragraphs without any list, heading, or visual element, ADD one.

Write the article NOW. Return ONLY the HTML content.`
}

// ─── STEP 3: LANGUAGE VALIDATION ──────────────────────────────────────────────

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
    'descubre', 'conoce', 'aprende', 'encuentra',
    'preguntas frecuentes', 'qué es', 'cómo funciona',
    'más información', 'por qué', 'para qué',
    'negocio', 'empresa', 'herramienta', 'automatización',
  ]
  const hasInvertedQuestion = /¿/.test(text)
  const hasInvertedExclamation = /¡/.test(text)
  const hasSpanishChars = /[ñÑáéíóúÁÉÍÓÚüÜ]/.test(text)
  const lowerText = text.toLowerCase()
  const detectedWords: string[] = []
  for (const word of spanishIndicators) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi')
    if (regex.test(lowerText)) detectedWords.push(word)
  }
  if (hasInvertedQuestion) detectedWords.push('¿ (inverted question mark)')
  if (hasInvertedExclamation) detectedWords.push('¡ (inverted exclamation)')
  const accentedMatches = text.match(/[áéíóúÁÉÍÓÚüÜ]/g) || []
  if (accentedMatches.length > 5 && hasSpanishChars) detectedWords.push(`${accentedMatches.length} accented characters`)
  const passed = detectedWords.length === 0
  return {
    passed, spanishWordCount: detectedWords.length, detectedWords,
    details: passed ? 'PASSED — No Spanish language detected'
      : `FAILED — Found ${detectedWords.length} Spanish indicators: ${detectedWords.slice(0, 10).join(', ')}`,
  }
}

// ─── STEP 4: STRUCTURE VALIDATION ─────────────────────────────────────────────

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
  const hasCTA = /octopuskills\.com/i.test(html) || /octopus\s*skills/i.test(html)
  const hasList = /<(?:ol|ul)[^>]*>/i.test(html)
  const h2Matches = html.match(/<h2[^>]*>(.*?)<\/h2>/gi) || []
  const headingsLowercase = h2Matches.filter(h => {
    const inner = h.replace(/<[^>]+>/g, '').trim()
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
    ctaPresent: { passed: hasCTA, detail: hasCTA ? 'Octopus Skills CTA detected' : 'No Octopus Skills CTA found' },
    listContent: { passed: hasList, detail: hasList ? 'List content detected' : 'No list (ol/ul) found' },
    headingQuality: { passed: headingsProperCase, detail: headingsProperCase ? 'Headings in proper Title Case' : `${headingsLowercase.length} heading(s) appear lowercase/keyword-stuffed` },
  }
  const allPassed = Object.values(checks).every(c => c.passed)
  const failedChecks = Object.entries(checks).filter(([, c]) => !c.passed)
  return {
    passed: allPassed, checks,
    details: allPassed ? 'PASSED — All structure checks OK'
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

// ─── SERIES TOPIC GENERATION PROMPT ──────────────────────────────────────────

const SERIES_TOPIC_PROMPT = `You are an elite SEO content strategist specializing in topical authority. You ONLY write in American English.

Generate a SERIES of 3 interconnected blog article topics about AI automation, no-code tools, or AI-powered business growth for solopreneurs and small businesses. The platform is Octopus Skills.

SERIES STRATEGY:
- All 3 articles must share a PARENT THEME (e.g., "AI marketing automation", "no-code business tools", "AI content creation")
- Article 1: AWARENESS — introduce the concept broadly ("What is X and why solopreneurs need it")
- Article 2: DEEP DIVE — explore a specific powerful aspect ("The hidden X that changes Y")
- Article 3: ACTION — provide solutions and implementation ("How to set up X in your business today")
- Each article targets a DIFFERENT long-tail keyword but all are semantically related
- Together they create a "topic cluster" that Google rewards with higher authority

SEO TITLE FORMULA (MANDATORY for each):
  [Number] [Primary Keyword] + [Benefit or Warning] (${CURRENT_YEAR})

ZERO STATISTICS POLICY: Use qualitative language instead of specific numbers in descriptions. Numbers in titles are OK.

META DESCRIPTION: 120-155 chars, include keyword, include micro-CTA.

CATEGORY: Choose from: ai-automation, marketing, productivity, no-code, case-studies, freelancers

COVER IMAGE PROMPT: 1-2 sentences, minimalist tech-forward style, dark background, AI/automation themed, NO text, NO people.

Return ONLY a JSON object:
{
  "seriesTheme": "Parent theme connecting all 3",
  "articles": [
    {"title": "Title 1", "keyword": "keyword1", "angle": "angle1", "metaDescription": "meta1", "category": "ai-automation", "coverImagePrompt": "img1", "seriesPosition": "Part 1 of 3", "crossRefHint": "Brief note on how this connects to parts 2 and 3"},
    {"title": "Title 2", "keyword": "keyword2", "angle": "angle2", "metaDescription": "meta2", "category": "ai-automation", "coverImagePrompt": "img2", "seriesPosition": "Part 2 of 3", "crossRefHint": "Brief note on how this connects to parts 1 and 3"},
    {"title": "Title 3", "keyword": "keyword3", "angle": "angle3", "metaDescription": "meta3", "category": "ai-automation", "coverImagePrompt": "img3", "seriesPosition": "Part 3 of 3", "crossRefHint": "Brief note on how this connects to parts 1 and 2"}
  ]
}`

// ─── SERIES CROSS-REFERENCE BANNER ───────────────────────────────────────────

function buildSeriesBanner(seriesTheme: string, currentIndex: number, allTitles: string[], allSlugs: string[]): string {
  const otherArticles = allTitles
    .map((t, i) => {
      if (i === currentIndex) return null
      const url = `${BLOG_BASE}/${allSlugs[i]}`
      const label = i < currentIndex ? '← Previous' : 'Next →'
      return `<li style="margin-bottom:0.5rem;"><a href="${url}" style="color:#34d399;text-decoration:underline;font-weight:600;">▶ Part ${i + 1}: ${t}</a> <span style="font-size:0.8rem;color:#64748b;">(${label})</span></li>`
    })
    .filter(Boolean)
    .join('\n')

  return `<div style="margin:2rem 0;padding:1.5rem;background:linear-gradient(135deg,#0F1419,#1A2332);border-radius:16px;border:2px solid #2D4A3E;">
  <p style="font-size:0.85rem;text-transform:uppercase;letter-spacing:0.05em;color:#34d399;font-weight:700;margin-bottom:0.5rem;">📚 Series: ${seriesTheme} — Part ${currentIndex + 1} of ${allTitles.length}</p>
  <p style="font-size:1rem;color:#94a3b8;margin-bottom:0.75rem;">This article is part of a comprehensive series. Read the full series for the complete picture:</p>
  <ul style="list-style:none;padding:0;margin:0;">
    ${otherArticles}
  </ul>
</div>`
}

// ─── INTERNAL LINK INJECTOR ─────────────────────────────────────────────────

function injectInternalLinks(html: string, otherArticles: { title: string; slug: string }[]): string {
  let result = html
  let linksInjected = 0
  for (const article of otherArticles) {
    const titleClean = article.title.replace(/\s*\(\d{4}\)\s*$/, '').trim()
    const titleVariations = [article.title, titleClean]
    for (const variant of titleVariations) {
      if (variant.length < 10) continue
      const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(`(?<!["'>])(?<!<a[^>]*>)(${escaped})(?![^<]*<\/a>)`, 'gi')
      const url = `${BLOG_BASE}/${article.slug}`
      const replaced = result.replace(regex, (_match, p1) => {
        linksInjected++
        return `<a href="${url}" style="color:#34d399;text-decoration:underline;font-weight:500;">${p1}</a>`
      })
      if (replaced !== result) { result = replaced; break }
    }
  }
  console.log(`[Octopus-SEO] 🔗 Internal links injected: ${linksInjected}`)
  return result
}

// ─── RESULT TYPES ────────────────────────────────────────────────────────────

export interface OctopusSEOResult {
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

export interface OctopusSEOSeriesResult {
  success: boolean
  seriesTheme: string
  articlesPublished: number
  articlesTotal: number
  articles: OctopusSEOResult[]
  totalDuration: number
  error?: string
}

// ─── MAIN PIPELINE (EXPORTED) ────────────────────────────────────────────────

export async function runOctopusSEOPipeline(
  userId: string,
  params: { topic?: string; keyword?: string; instructions?: string; category?: string },
  seriesContext?: { seriesTheme: string; position: string; crossRefHint: string; otherTitles: string[]; otherSlugs?: string[]; seriesBanner?: string; seriesId?: string }
): Promise<OctopusSEOResult> {
  const pipelineStart = Date.now()
  const steps: { step: string; status: string; duration: number; detail?: string }[] = []

  try {
    const { topic: userTopic, keyword: userKeyword, instructions } = params
    console.log(`[Octopus-SEO] ━━━ Pipeline started ━━━`)
    console.log(`[Octopus-SEO] User input: topic="${userTopic || 'auto'}" keyword="${userKeyword || 'auto'}" instructions="${instructions || 'none'}"`)

    // ═══ STEP 1: TOPIC GENERATION ═══
    const step1Start = Date.now()
    console.log('[Octopus-SEO] Step 1: Generating topic...')

    let topic: { title: string; keyword: string; angle: string; metaDescription?: string; coverImagePrompt?: string; category?: string }

    if (userTopic && userKeyword) {
      topic = {
        title: userTopic, keyword: userKeyword,
        angle: instructions || 'Comprehensive guide',
        metaDescription: '', coverImagePrompt: '',
        category: params.category || 'ai-automation',
      }
      steps.push({ step: 'topic', status: 'provided', duration: Date.now() - step1Start, detail: topic.title })
    } else {
      const userPrompt = userTopic
        ? `Generate a blog topic about: ${userTopic}. ${instructions || ''}`
        : instructions
          ? `Generate a blog topic based on: ${instructions}`
          : 'Generate a fresh, unique blog topic for today. Make it trending and SEO-optimized for AI automation and solopreneur audiences.'

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

    console.log(`[Octopus-SEO] Topic: "${topic.title}" (keyword: ${topic.keyword})`)

    // ═══ STEP 2: ARTICLE GENERATION ═══
    const step2Start = Date.now()
    console.log('[Octopus-SEO] Step 2: Generating article...')

    const articleResponse = await callLLM(userId, [
      { role: 'system', content: buildArticlePrompt(topic, seriesContext) },
      { role: 'user', content: `Write the complete article about "${topic.title}" with angle: ${topic.angle}. Remember: AMERICAN ENGLISH ONLY.${seriesContext ? ` This is ${seriesContext.position} in a series about "${seriesContext.seriesTheme}".` : ''}` },
    ], { model: 'gpt-4.1', temperature: 0.6, maxTokens: 12000 })

    let articleContent = articleResponse.choices?.[0]?.message?.content || ''
    articleContent = articleContent.replace(/^```html\s*/i, '').replace(/```\s*$/i, '').trim()

    if (!articleContent || articleContent.length < 500) {
      throw new Error(`Article generation failed — content too short (${articleContent.length} chars)`)
    }

    // Title Case enforcement on headings
    articleContent = articleContent.replace(/<(h[2-6])([^>]*)>(.*?)<\/\1>/gi, (_match, tag, attrs, inner) => {
      const cleaned = inner.replace(/<[^>]+>/g, '').trim()
      const titleCased = toTitleCase(cleaned)
      return `<${tag}${attrs}>${titleCased}</${tag}>`
    })

    // Fix brand names across ALL text (headings, paragraphs, lists, etc.)
    articleContent = fixBrandNames(articleContent)

    steps.push({ step: 'article', status: 'generated', duration: Date.now() - step2Start, detail: `${articleContent.length} chars` })
    console.log(`[Octopus-SEO] Article generated: ${articleContent.length} chars`)

    topic.title = toTitleCase(topic.title)

    // ═══ STEP 3: LANGUAGE VALIDATION ═══
    const step3Start = Date.now()
    let langCheck = validateLanguage(articleContent)

    if (!langCheck.passed) {
      console.warn(`[Octopus-SEO] ⚠️ Language check FAILED (attempt 1): ${langCheck.details}`)
      const retryResponse = await callLLM(userId, [
        { role: 'system', content: `CRITICAL: Your previous output contained Spanish words. This is UNACCEPTABLE.\n\n${buildArticlePrompt(topic, seriesContext)}\n\nABSOLUTE RULE: Write EXCLUSIVELY in American English.` },
        { role: 'user', content: `Rewrite the article about "${topic.title}" in PERFECT American English. ZERO Spanish words.` },
      ], { model: 'gpt-4.1', temperature: 0.4, maxTokens: 12000 })

      articleContent = (retryResponse.choices?.[0]?.message?.content || '').replace(/^```html\s*/i, '').replace(/```\s*$/i, '').trim()
      langCheck = validateLanguage(articleContent)

      if (!langCheck.passed) {
        steps.push({ step: 'language', status: 'FAILED', duration: Date.now() - step3Start, detail: langCheck.details })
        return { success: false, pipeline: 'rejected', error: 'Language validation failed after retry',
          validation: { language: { passed: false, detail: langCheck.details }, structure: { passed: false, checks: {} } },
          steps, totalDuration: Date.now() - pipelineStart }
      }
    }
    steps.push({ step: 'language', status: 'PASSED', duration: Date.now() - step3Start, detail: langCheck.details })

    // ═══ STEP 4: STRUCTURE VALIDATION ═══
    const step4Start = Date.now()
    const structCheck = validateStructure(articleContent)

    if (!structCheck.checks.ctaPresent?.passed) {
      articleContent += '\n' + OCTOPUS_CTA
      structCheck.checks.ctaPresent = { passed: true, detail: 'CTA auto-appended by pipeline' }
    }

    const criticalChecks = ['wordCount', 'h2Headings', 'faqSection', 'listContent']
    const criticalFailed = criticalChecks.filter(k => !structCheck.checks[k]?.passed)

    if (criticalFailed.length > 0) {
      steps.push({ step: 'structure', status: 'FAILED', duration: Date.now() - step4Start, detail: structCheck.details })
      return { success: false, pipeline: 'rejected', error: 'Structure validation failed',
        validation: { language: { passed: true, detail: langCheck.details }, structure: { passed: false, checks: structCheck.checks } },
        steps, totalDuration: Date.now() - pipelineStart }
    }
    steps.push({ step: 'structure', status: 'PASSED', duration: Date.now() - step4Start, detail: structCheck.details })

    // ═══ STEP 5: COVER IMAGE GENERATION ═══
    const step5Start = Date.now()
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
      if (imgResult?.imageUrl) coverImageUrl = imgResult.imageUrl
    } catch (imgErr) {
      console.warn('[Octopus-SEO] ⚠️ Image generation failed (non-blocking):', imgErr)
    }
    steps.push({ step: 'image', status: coverImageUrl ? 'generated' : 'skipped', duration: Date.now() - step5Start })

    // ═══ INJECT INTERNAL LINKS (if series) ═══
    if (seriesContext?.otherTitles && seriesContext?.otherSlugs) {
      const otherArticleLinks = seriesContext.otherTitles.map((title, idx) => ({
        title, slug: seriesContext.otherSlugs![idx],
      }))
      articleContent = injectInternalLinks(articleContent, otherArticleLinks)
    }

    // ═══ INJECT SERIES BANNER (if series) ═══
    if (seriesContext?.seriesBanner) {
      const firstH2End = articleContent.indexOf('</h2>')
      if (firstH2End > -1) {
        const insertPos = firstH2End + 5
        articleContent = articleContent.substring(0, insertPos) + '\n' + seriesContext.seriesBanner + '\n' + articleContent.substring(insertPos)
      } else {
        articleContent = seriesContext.seriesBanner + '\n' + articleContent
      }
    }

    // ═══ STEP 6: PUBLISH TO DATABASE ═══
    const step6Start = Date.now()
    console.log('[Octopus-SEO] Step 6: Publishing to OctoBlogPost table...')

    const slug = generateSlug(topic.title)
    const textContent = articleContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const wordCount = textContent.split(/\s+/).length
    const readTime = Math.max(1, Math.round(wordCount / 238))
    const category = topic.category || params.category || 'ai-automation'
    const seriesId = seriesContext?.seriesId || undefined
    const seriesPosition = seriesContext?.position ? parseInt((seriesContext.position.match(/\d+/) || ['0'])[0], 10) || null : null

    // Security audit
    const publishAuth = authorizePublish({
      agentId: 'octopus-seo-skill',
      title: topic.title,
      content: articleContent,
      contentType: 'blog_post',
      callerContext: 'agent-factory',
    })

    if (!publishAuth.authorized) {
      steps.push({ step: 'publish', status: 'BLOCKED', duration: Date.now() - step6Start, detail: publishAuth.reason || 'Not authorized' })
      return { success: false, pipeline: 'blocked', error: `Publish blocked: ${publishAuth.reason}`, steps, totalDuration: Date.now() - pipelineStart }
    }

    // Ensure unique slug
    let finalSlug = slug
    const existingPost = await prisma.octoBlogPost.findUnique({ where: { slug: finalSlug } })
    if (existingPost) {
      finalSlug = `${slug}-${Date.now().toString(36)}`
    }

    await prisma.octoBlogPost.create({
      data: {
        title: topic.title,
        slug: finalSlug,
        content: articleContent,
        keyword: topic.keyword,
        metaDescription: topic.metaDescription || null,
        excerpt: topic.metaDescription || textContent.substring(0, 200),
        coverImage: coverImageUrl,
        category,
        language: 'en',
        author: 'Octopus AI',
        status: 'published',
        readTime,
        wordCount,
        seriesId: seriesId || null,
        seriesPosition,
        seriesTheme: seriesContext?.seriesTheme || null,
        views: 0,
        publishedAt: new Date(),
      },
    })

    const publishedUrl = `${BLOG_BASE}/${finalSlug}`
    const duration = Date.now() - step6Start

    // Log to ContentPublishLog
    await prisma.contentPublishLog.create({
      data: {
        userId, agentId: 'octopus-seo-skill', title: topic.title, slug: finalSlug,
        status: 'published', contentType: 'blog_post', publishedUrl,
        payload: JSON.stringify({ title: topic.title, keyword: topic.keyword, category, wordCount }).substring(0, 10000),
        response: JSON.stringify({ success: true, publishedUrl }),
        duration,
        metadata: JSON.stringify({
          source: 'octopus-seo-skill', coverImage: coverImageUrl, keyword: topic.keyword,
          metaDescription: topic.metaDescription,
          validations: { language: langCheck.passed ? 'PASSED' : 'FAILED', structure: structCheck.passed ? 'PASSED' : 'FAILED' },
          pipelineDuration: Date.now() - pipelineStart,
        }),
      },
    }).catch(err => console.error('[Octopus-SEO] Log error:', err))

    steps.push({ step: 'publish', status: 'SUCCESS', duration, detail: publishedUrl })
    console.log(`[Octopus-SEO] ✅ Published: ${publishedUrl} (${Date.now() - pipelineStart}ms total)`)

    return {
      success: true, pipeline: 'completed',
      article: { title: topic.title, slug: finalSlug, keyword: topic.keyword, publishedUrl, coverImage: coverImageUrl, metaDescription: topic.metaDescription, wordCount },
      validation: { language: { passed: true, detail: langCheck.details }, structure: { passed: true, checks: structCheck.checks } },
      steps, totalDuration: Date.now() - pipelineStart,
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error(`[Octopus-SEO] ❌ Pipeline error:`, errorMsg)
    return { success: false, pipeline: 'error', error: errorMsg, steps, totalDuration: Date.now() - pipelineStart }
  }
}

// ─── SERIES PIPELINE (EXPORTED) ──────────────────────────────────────────────

export async function runOctopusSEOSeries(
  userId: string,
  params: { theme?: string; instructions?: string }
): Promise<OctopusSEOSeriesResult> {
  const seriesStart = Date.now()
  const results: OctopusSEOResult[] = []

  try {
    console.log(`[Octopus-SEO] ━━━ SERIES Pipeline started ━━━`)

    const topicUserPrompt = params.theme
      ? `Generate a 3-article series about: ${params.theme}. ${params.instructions || ''}`
      : params.instructions
        ? `Generate a 3-article series based on: ${params.instructions}`
        : 'Generate a fresh, trending 3-article series about AI automation and no-code tools for solopreneurs.'

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
        category: string; coverImagePrompt: string; seriesPosition: string; crossRefHint: string
      }>
    }

    if (!seriesData.articles || seriesData.articles.length < 3) {
      throw new Error(`Series topic generation returned ${seriesData.articles?.length || 0} articles instead of 3`)
    }

    const seriesTheme = seriesData.seriesTheme
    const articles = seriesData.articles.slice(0, 3)
    articles.forEach(a => { a.title = toTitleCase(a.title) })

    const allTitles = articles.map(a => a.title)
    const allSlugs = articles.map(a => generateSlug(a.title))
    const seriesId = `octopus-series-${Date.now().toString(36)}`

    console.log(`[Octopus-SEO] Series theme: "${seriesTheme}"`)
    articles.forEach((a, i) => console.log(`[Octopus-SEO]   Part ${i + 1}: "${a.title}" (keyword: ${a.keyword})`))

    for (let i = 0; i < articles.length; i++) {
      const article = articles[i]
      console.log(`\n[Octopus-SEO] ━━━ Series Article ${i + 1}/3 ━━━`)

      const seriesBanner = buildSeriesBanner(seriesTheme, i, allTitles, allSlugs)

      const result = await runOctopusSEOPipeline(
        userId,
        { topic: article.title, keyword: article.keyword, instructions: article.angle, category: article.category || 'ai-automation' },
        { seriesTheme, position: article.seriesPosition, crossRefHint: article.crossRefHint,
          otherTitles: allTitles.filter((_, j) => j !== i), otherSlugs: allSlugs.filter((_, j) => j !== i),
          seriesBanner, seriesId },
      )

      results.push(result)
      if (result.success) console.log(`[Octopus-SEO] ✅ Series article ${i + 1} published: ${result.article?.publishedUrl}`)
      else console.warn(`[Octopus-SEO] ⚠️ Series article ${i + 1} failed: ${result.error}`)

      if (i < articles.length - 1) await new Promise(r => setTimeout(r, 3000))
    }

    const published = results.filter(r => r.success).length
    return {
      success: published > 0, seriesTheme,
      articlesPublished: published, articlesTotal: articles.length,
      articles: results, totalDuration: Date.now() - seriesStart,
      error: published === 0 ? 'All articles failed to publish' : undefined,
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error(`[Octopus-SEO] ❌ Series error:`, errorMsg)
    return {
      success: false, seriesTheme: params.theme || 'unknown',
      articlesPublished: results.filter(r => r.success).length, articlesTotal: 3,
      articles: results, totalDuration: Date.now() - seriesStart, error: errorMsg,
    }
  }
}
