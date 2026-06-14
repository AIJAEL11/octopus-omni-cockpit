// ============================================
// OCTOPUS Growth Engine — Scoring, Classification & AI
// ============================================

// --- Email Classification (A+/A/B+/B/C) ---
const EMAIL_CATEGORIES: Record<string, { category: string; boost: number }> = {
  // A+ — Revenue-critical
  'sales': { category: 'A+', boost: 25 },
  'events': { category: 'A+', boost: 25 },
  'catering': { category: 'A+', boost: 25 },
  'banquets': { category: 'A+', boost: 25 },
  'weddings': { category: 'A+', boost: 25 },
  // A — Revenue-focused
  'reservations': { category: 'A', boost: 15 },
  'booking': { category: 'A', boost: 15 },
  'scheduling': { category: 'A', boost: 15 },
  'partnerships': { category: 'A', boost: 15 },
  'fleet': { category: 'A', boost: 15 },
  // B+ — Owner/personal
  'hello': { category: 'B+', boost: 8 },
  // B — General
  'info': { category: 'B', boost: 0 },
  'contact': { category: 'B', boost: 0 },
  'general': { category: 'B', boost: 0 },
  // C — Noise
  'noreply': { category: 'C', boost: -10 },
  'no-reply': { category: 'C', boost: -10 },
  'support': { category: 'C', boost: -10 },
  'admin': { category: 'C', boost: -10 },
  'careers': { category: 'C', boost: -10 },
  'press': { category: 'C', boost: -10 },
  'hr': { category: 'C', boost: -10 },
}

export function classifyEmail(email: string): { category: string; boost: number } {
  if (!email) return { category: 'B', boost: 0 }
  const prefix = email.split('@')[0]?.toLowerCase() || ''
  // Check exact prefix matches
  for (const [key, val] of Object.entries(EMAIL_CATEGORIES)) {
    if (prefix === key || prefix.startsWith(key)) return val
  }
  // Personal email pattern (firstname.lastname@ or firstname@)
  if (/^[a-z]+\.[a-z]+$/.test(prefix)) return { category: 'B+', boost: 8 }
  // Location-specific (city@brand.com)
  if (/^[a-z]{3,15}$/.test(prefix) && !['info', 'contact', 'admin', 'support'].includes(prefix)) {
    return { category: 'A', boost: 15 }
  }
  return { category: 'B', boost: 0 }
}

// --- Lead Auto-Score (Rule-Based, 0-100) ---
const HIGH_FIT_TYPES = ['restaurant', 'bar', 'gym', 'entertainment', 'hotel', 'brewery', 'nightclub', 'arcade', 'bowling']
const MED_FIT_TYPES = ['salon', 'shop', 'dental', 'studio', 'cafe', 'bakery', 'spa', 'retail', 'fitness']

export function autoScoreLead(lead: {
  email?: string | null
  phone?: string | null
  website?: string | null
  city?: string | null
  googleRating?: number | null
  businessType?: string | null
  emailCategory?: string | null
}): number {
  let score = 0
  if (lead.email) score += 25
  if (lead.phone) score += 10
  if (lead.website) score += 10
  if (lead.city) score += 5
  // Google rating
  if (lead.googleRating && lead.googleRating >= 4.5) score += 15
  else if (lead.googleRating && lead.googleRating >= 4.0) score += 10
  else if (lead.googleRating) score += 5
  // Business type fit
  const type = (lead.businessType || '').toLowerCase()
  if (HIGH_FIT_TYPES.some(t => type.includes(t))) score += 20
  else if (MED_FIT_TYPES.some(t => type.includes(t))) score += 10
  else if (type) score += 5
  // Email category boost
  const cat = lead.emailCategory || 'B'
  if (cat === 'A+') score += 25
  else if (cat === 'A') score += 15
  else if (cat === 'B+') score += 8
  else if (cat === 'C') score -= 10
  return Math.max(0, Math.min(100, score))
}

// --- Priority from Score ---
export function getPriority(score: number): string {
  if (score >= 70) return 'high'
  if (score >= 40) return 'medium'
  return 'low'
}

// --- Industry Templates for Outreach ---
export const INDUSTRY_PAIN_POINTS: Record<string, { pains: string[]; hook: string }> = {
  restaurant: {
    pains: ['Mesas vacías entre semana', 'Comisiones 30%+ delivery apps', 'Sin sistema de reservas online'],
    hook: 'tráfico real a tu restaurante sin pagar comisiones'
  },
  bar: {
    pains: ['Lunes a miércoles muertos', 'Competencia de beber en casa', 'Sin presencia digital'],
    hook: 'llenar tu bar los días que más lo necesitas'
  },
  gym: {
    pains: ['67% deserción en 90 días', 'Competencia de apps fitness', 'Sin diferenciación'],
    hook: 'retención de miembros con experiencias gamificadas'
  },
  salon: {
    pains: ['No-shows constantes', 'Horarios muertos entre semana', 'Sin marketing digital'],
    hook: 'llenar tus horarios vacíos con clientes recurrentes'
  },
  cafe: {
    pains: ['Tardes muertas', 'Competencia de cadenas', 'Sin programa de fidelidad'],
    hook: 'convertir visitantes casuales en clientes diarios'
  },
  retail: {
    pains: ['Competencia de grandes marcas', 'Presupuesto limitado', 'Sin foot traffic'],
    hook: 'atraer clientes locales a tu tienda física'
  },
  hotel: {
    pains: ['Baja ocupación temporada baja', 'Dependencia de OTAs', 'Sin experiencias diferenciadas'],
    hook: 'atraer huéspedes directos con experiencias únicas'
  },
}

// --- Language Detection for Outreach ---
// Hispanic first names (common) — used as heuristic
const HISPANIC_NAMES = new Set([
  'carlos', 'juan', 'josé', 'jose', 'maría', 'maria', 'pedro', 'luis', 'miguel', 'jorge',
  'ricardo', 'fernando', 'roberto', 'antonio', 'manuel', 'rafael', 'francisco', 'alejandro',
  'javier', 'pablo', 'diego', 'sergio', 'eduardo', 'daniel', 'andrés', 'andres', 'raúl', 'raul',
  'ana', 'laura', 'sofía', 'sofia', 'carmen', 'isabel', 'patricia', 'rosa', 'lucía', 'lucia',
  'gabriela', 'valentina', 'camila', 'daniela', 'mónica', 'monica', 'paola', 'sandra', 'claudia',
  'marta', 'elena', 'teresa', 'beatriz', 'julia', 'cristina', 'adriana', 'gloria', 'silvia',
  'ernesto', 'armando', 'guillermo', 'gerardo', 'hugo', 'ramón', 'ramon', 'oscar', 'ignacio',
  'nydia', 'milka', // add edge cases found in user's leads
])

// Spanish-speaking TLDs
const HISPANIC_TLDS = new Set([
  '.mx', '.es', '.co', '.ar', '.pe', '.cl', '.ve', '.uy', '.py', '.bo', '.ec', '.gt', '.cr',
  '.pa', '.do', '.hn', '.ni', '.sv', '.pr', '.cu',
])

// Spanish-speaking cities (common ones in user's US market that indicate hispanic business)
const HISPANIC_CITY_KEYWORDS = ['mexico', 'méxico', 'españa', 'argentina', 'colombia', 'perú', 'peru', 'chile', 'venezuela']

export type OutreachLanguage = 'en' | 'es'

export function detectOutreachLanguage(lead: {
  contactName?: string | null
  email?: string | null
  city?: string | null
  website?: string | null
}): OutreachLanguage {
  // 1) TLD check — strongest signal
  const domainSources = [lead.email, lead.website].filter(Boolean) as string[]
  for (const src of domainSources) {
    const lower = src.toLowerCase()
    for (const tld of HISPANIC_TLDS) {
      if (lower.endsWith(tld) || lower.includes(tld + '/') || lower.includes(tld + '?')) {
        return 'es'
      }
    }
  }
  // 2) City check
  if (lead.city) {
    const cityLower = lead.city.toLowerCase()
    for (const kw of HISPANIC_CITY_KEYWORDS) {
      if (cityLower.includes(kw)) return 'es'
    }
  }
  // 3) First name check — only if clearly hispanic
  if (lead.contactName) {
    const firstName = lead.contactName.trim().split(/\s+/)[0]?.toLowerCase()
    if (firstName && HISPANIC_NAMES.has(firstName)) return 'es'
  }
  // Default: English (most leads are US-based)
  return 'en'
}

// --- AI Outreach Email Generation ---
export function buildOutreachPrompt(lead: {
  businessName: string
  businessType?: string | null
  contactName?: string | null
  email?: string | null
  emailCategory?: string | null
  city?: string | null
  painPoints?: string | null
  website?: string | null
}, senderName?: string, forceLanguage?: OutreachLanguage): string {
  const type = (lead.businessType || 'business').toLowerCase()
  const industry = INDUSTRY_PAIN_POINTS[type]
  const painData = lead.painPoints ? JSON.parse(lead.painPoints) : null
  const cat = lead.emailCategory || 'B'
  const sender = senderName || 'The OctopusSkills Team'
  const language = forceLanguage || detectOutreachLanguage(lead)

  let pitchStyle = ''
  if (language === 'es') {
    if (cat === 'A+' || cat === 'A') {
      pitchStyle = 'El subject debe parecer una consulta de cliente potencial. Abre como cliente interesado, transiciona a propuesta de valor. CTA: "¿Te mando un screenshot rápido de cómo se vería para tu negocio?"'
    } else if (cat === 'B+') {
      pitchStyle = 'El subject crea familiaridad falsa: "¿Recibiste mi mensaje sobre {negocio}?". Genera curiosidad. CTA: Solo responde \'sí\''
    } else {
      pitchStyle = 'Subject sobre eficiencia. Reconoce que están ocupados. CTA: Responde \'interesado\''
    }
  } else {
    if (cat === 'A+' || cat === 'A') {
      pitchStyle = 'Subject should feel like an inquiry from a potential customer. Open as an interested customer, transition to value prop. CTA: "Want me to send a quick screenshot of how this would look for your business?"'
    } else if (cat === 'B+') {
      pitchStyle = 'Subject creates false familiarity: "Did you get my message about {business}?". Generate curiosity. CTA: Just reply \'yes\''
    } else {
      pitchStyle = 'Subject about efficiency. Acknowledge they\'re busy. CTA: Reply \'interested\''
    }
  }

  // ============================================================
  // 🚨 HARD LANGUAGE ANCHOR — prevents LLM drift
  // ============================================================
  const languageDirective = language === 'es'
    ? `⚠️ CRÍTICO — IDIOMA: ESPAÑOL
El subject Y body DEBEN estar 100% en ESPAÑOL. NO mezcles inglés. NO uses palabras sueltas en inglés. 
Todo el JSON response debe estar en español. Si mezclas idiomas, el email será rechazado.`
    : `⚠️ CRITICAL — LANGUAGE: ENGLISH
Subject AND body MUST be 100% in ENGLISH. DO NOT mix Spanish. DO NOT use isolated Spanish words.
The entire JSON response must be in English. If you mix languages, the email will be rejected.`

  return `${languageDirective}

Generate a personalized outreach email for OctopusSkills — the first all-in-one AI-powered marketing, creative and automation platform for local businesses.

OCTOPUSSKILLS OFFERS:
- AI-powered SaaS platform that generates leads, creates creative content (images, videos, UGC), automates email outreach, and manages complete digital marketing
- Modules: Growth Engine (leads + automated outreach), Creative Studio, Ad Factory, UGC Factory, Motion Graphics, AI Sales Agent, Voice Agent, Social Bridge
- Website: https://octopuskills.com
- Value prop: "Your complete AI-powered marketing team — for a fraction of the cost of an agency"

LEAD DATA:
- Business: ${lead.businessName}
- Type: ${lead.businessType || 'N/A'}
- Contact: ${lead.contactName || 'Partner'}
- Email: ${lead.email || 'N/A'}
- Email category: ${cat}
- City: ${lead.city || 'N/A'}
- Website: ${lead.website || 'N/A'}
${painData ? `- Pain Points: ${JSON.stringify(painData.pains || painData.pain_points || [])}` : ''}
${painData?.ice_breaker ? `- Ice Breaker: ${painData.ice_breaker}` : ''}
${painData?.approach_recomendado ? `- Recommended approach: ${painData.approach_recomendado}` : ''}
${industry ? `- Typical industry pains: ${industry.pains.join(', ')}` : ''}

PITCH STYLE (based on category ${cat}):
${pitchStyle}

RULES:
- Signed by: ${sender}
- Tone: Professional but warm
- Max 150 words in the body
- Focus on the specific business pain and how OctopusSkills solves it with AI
- Mention they can try FREE (Starter plan — no credit card)
- NO generic marketing jargon — be specific to the lead's pain
- Use specific business pain points if available
- If approach_recomendado from Gold Standard exists, use it as a guide

${languageDirective}

Respond in exact JSON:
{
  "subject": "...",
  "body": "...(plain text, no HTML, in ${language === 'es' ? 'SPANISH' : 'ENGLISH'})...",
  "reasoning": "...why this approach works for this lead..."
}`
}

// --- Stats helpers ---
export const PIPELINE_STATUSES = ['new', 'contacted', 'replied', 'converted', 'lost'] as const
export const LEAD_TIERS = ['diamond', 'vibranium', 'antimatter'] as const
export const EMAIL_CATS = ['A+', 'A', 'B+', 'B', 'C'] as const

export type PipelineStatus = typeof PIPELINE_STATUSES[number]
export type LeadTier = typeof LEAD_TIERS[number]