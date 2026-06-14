import { callLLM } from '@/lib/turbo-llm'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { url, locale = 'es' } = await request.json()
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL requerida' }, { status: 400 })
    }

    const isEnglish = locale === 'en'

    // Fetch the website HTML
    let html = ''
    let fetchError = ''
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 12000)
      const res = await fetch(url.startsWith('http') ? url : `https://${url}`, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; OctopusBot/1.0; +https://octopus.ai)',
          'Accept': 'text/html,application/xhtml+xml',
        },
      })
      clearTimeout(timeout)
      html = await res.text()
      // Truncate to ~15K chars to fit in context
      if (html.length > 15000) html = html.substring(0, 15000) + '\n[...truncado]'
    } catch (e: any) {
      fetchError = e.message || 'No se pudo acceder al sitio'
    }

    const langInstruction = isEnglish
      ? 'ALL text values in the JSON (descriptions, strengths, weaknesses, recommendations, verdict, issues, notes) MUST be written in ENGLISH.'
      : 'ALL text values in the JSON (descriptions, strengths, weaknesses, recommendations, verdict, issues, notes) MUST be written in SPANISH.'

    const priorityValues = isEnglish ? 'high|medium|low' : 'alta|media|baja'
    const categoryValues = isEnglish ? 'design|seo|content|trust|conversion' : 'dise\u00f1o|seo|contenido|confianza|conversi\u00f3n'

    const analysisPrompt = `You are a Senior expert in UX/UI Design, SEO, Branding and Digital Competitive Analysis.

Analyze the following website and return a STRICT JSON (no markdown, no comments, no text outside the JSON) with this exact structure:

{
  "business": {
    "name": "business name",
    "industry": "industry/niche",
    "tagline": "main value proposition or slogan",
    "description": "brief description of what they do (2-3 sentences)"
  },
  "design": {
    "colors": {
      "primary": "#hex",
      "secondary": "#hex",
      "accent": "#hex",
      "background": "#hex",
      "text": "#hex"
    },
    "typography": {
      "headings": "font name or style",
      "body": "font name or style"
    },
    "style": "visual style description",
    "strengths": ["strength 1", "strength 2", "strength 3"],
    "weaknesses": ["weakness 1", "weakness 2", "weakness 3"]
  },
  "scores": {
    "overall": 72,
    "design": 65,
    "seo": 70,
    "mobile": 80,
    "performance": 60,
    "content": 75,
    "trust": 68,
    "conversion": 55
  },
  "seo": {
    "title": "meta title found",
    "description": "meta description found",
    "h1Count": 2,
    "hasSchema": false,
    "hasOG": true,
    "issues": ["SEO issue 1", "SEO issue 2"]
  },
  "sections": [
    { "name": "Hero", "score": 70, "note": "brief note" },
    { "name": "Features", "score": 60, "note": "brief note" }
  ],
  "trustSignals": {
    "hasTestimonials": true,
    "hasLogos": false,
    "hasCertifications": false,
    "hasContactInfo": true,
    "hasSocialProof": false,
    "score": 45
  },
  "competitors": [
    {
      "name": "Competitor 1",
      "url": "https://...",
      "strength": "what they do well"
    }
  ],
  "recommendations": [
    {
      "priority": "${priorityValues.split('|')[0]}",
      "category": "${categoryValues}",
      "title": "Recommendation title",
      "description": "Detailed description of what to do"
    }
  ],
  "verdict": "Final verdict in 2-3 sentences. How competitive is this site and what is the main opportunity."
}

URL analyzed: ${url}
${fetchError ? `\nAccess error: ${fetchError}. Analyze based on the URL and what you can infer from the domain.` : ''}
${html ? `\nSite HTML (may be truncated):\n${html}` : '\nCould not get HTML. Analyze based on URL and domain.'}

IMPORTANT:
- Scores go from 0 to 100
- Be honest and specific in the analysis
- Recommendations must be actionable
- Suggest 3-5 real competitors from the same niche
- Return ONLY the JSON, nothing else
- Priority values MUST be one of: ${priorityValues}
- Category values MUST be one of: ${categoryValues}
- ${langInstruction}`

    // Call LLM via centralized helper (Turbo Mode + Abacus AI fallback)
    const llmData = await callLLM(session.user.id, [
      { role: 'system', content: isEnglish ? 'You are an expert web analyst. Respond ONLY with valid JSON, no markdown or explanations. ALL text content must be in English.' : 'Eres un analista web experto. Responde SOLO con JSON válido, sin markdown ni explicaciones. TODO el contenido de texto debe estar en español.' },
      { role: 'user', content: analysisPrompt },
    ], { model: 'gpt-4.1', temperature: 0.4, maxTokens: 4000 })

    const content = llmData.choices?.[0]?.message?.content || ''

    // Extract JSON from response
    let analysis
    try {
      // Try direct parse first
      analysis = JSON.parse(content)
    } catch {
      // Try extracting JSON from markdown code block
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          analysis = JSON.parse(jsonMatch[1] || jsonMatch[0])
        } catch {
          return NextResponse.json({ error: 'Error al parsear análisis', raw: content }, { status: 500 })
        }
      } else {
        return NextResponse.json({ error: 'Respuesta inválida del modelo', raw: content }, { status: 500 })
      }
    }

    return NextResponse.json({ analysis, url })
  } catch (err: any) {
    console.error('[WebIntel] Error:', err)
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}
