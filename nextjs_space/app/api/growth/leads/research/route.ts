import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, withDbRetry } from '@/lib/prisma'
export const dynamic = 'force-dynamic'

const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY || ''
const GEMINI_MODEL = 'gemini-2.5-flash'
const LLM_API_KEY = process.env.ABACUSAI_API_KEY || ''

// ─── Gemini Web Search ─────────────────────────────────────────────────────────
async function webSearch(query: string): Promise<{ answer: string; sources: string[] }> {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Search the web for: ${query}\n\nProvide factual, concrete details: names, titles, company info, social profiles, websites, LinkedIn, any business mentions. Be thorough.` }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 3000 },
      }),
      signal: AbortSignal.timeout(25000),
    })
    if (!res.ok) throw new Error(`Gemini ${res.status}`)
    const data = await res.json()
    const candidate = data.candidates?.[0]
    const answer = (candidate?.content?.parts || []).map((p: { text?: string }) => p.text || '').join('')
    const sources: string[] = []
    for (const chunk of candidate?.groundingMetadata?.groundingChunks || []) {
      if (chunk.web?.uri) sources.push(chunk.web.uri)
    }
    return { answer, sources }
  } catch (e) {
    console.error('[LeadResearch] Gemini search failed:', e)
    return { answer: '', sources: [] }
  }
}

// ─── Domain check ──────────────────────────────────────────────────────────────
async function checkDomain(domain: string): Promise<{ exists: boolean; hasWebsite: boolean; title: string }> {
  try {
    const res = await fetch(`https://${domain}`, {
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OctopusBot/1.0)' },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    })
    const html = await res.text()
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    return { exists: true, hasWebsite: res.ok, title: titleMatch?.[1]?.trim() || '' }
  } catch {
    return { exists: false, hasWebsite: false, title: '' }
  }
}

// ─── LLM Synthesis ─────────────────────────────────────────────────────────────
async function synthesizeVerdict(leadData: Record<string, unknown>, webResults: string, domainInfo: string): Promise<string> {
  try {
    const systemPrompt = `Eres un analista de inteligencia comercial para OctopusSkills. Tu trabajo es evaluar si un lead es REAL y vale la pena contactar. Responde SIEMPRE en español. Sé directo y concreto.

Formato de respuesta:
## 🔍 Investigación: [nombre o email]

### Veredicto: [✅ REAL | ⚠️ DUDOSO | ❌ FAKE]
[Explicación de 1-2 líneas]

### 👤 Quién es
[Info sobre la persona, si se encontró]

### 🌐 Dominio: [domain]
[Info del dominio/empresa]

### 📊 Datos en tu CRM
[Resumen de cómo llegó, status, acciones]

### 💡 Recomendación
[Qué hacer: contactar, ignorar, personalizar email, etc.]`

    const userPrompt = `DATOS DEL LEAD EN CRM:\n${JSON.stringify(leadData, null, 2)}\n\nINFO DEL DOMINIO:\n${domainInfo}\n\nRESULTADOS DE BÚSQUEDA WEB:\n${webResults}\n\nAnaliza toda la información y dame tu veredicto.`

    const res = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal: AbortSignal.timeout(45000),
    })

    if (!res.ok) throw new Error(`Abacus LLM error: ${res.status}`)
    const data = await res.json()
    return data.choices?.[0]?.message?.content || 'No se pudo generar análisis.'
  } catch (e) {
    console.error('[LeadResearch] LLM synthesis failed:', e)
    return 'Error al generar análisis con IA.'
  }
}

// ─── POST /api/growth/leads/research ───────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json()
    const { email, leadId, name } = body

    if (!email && !leadId && !name) {
      return NextResponse.json({ error: 'Se requiere email, leadId o name' }, { status: 400 })
    }

    // 1. Find lead in DB
    let lead: Record<string, unknown> | null = null
    let actions: Record<string, unknown>[] = []

    const where: Record<string, unknown> = { userId: session.user.id }
    if (leadId) where.id = leadId
    else if (email) where.email = email
    else if (name) where.OR = [
      { contactName: { contains: name, mode: 'insensitive' } },
      { businessName: { contains: name, mode: 'insensitive' } },
    ]

    const dbLead = await withDbRetry(() =>
      prisma.growthLead.findFirst({ where })
    ) as any

    if (dbLead) {
      lead = {
        id: dbLead.id,
        name: dbLead.contactName || dbLead.businessName || 'Desconocido',
        email: dbLead.email,
        company: dbLead.businessName,
        phone: dbLead.phone,
        website: dbLead.website,
        city: dbLead.city,
        state: dbLead.state,
        country: dbLead.country,
        status: dbLead.status,
        tier: dbLead.leadTier,
        source: dbLead.leadSource,
        tags: dbLead.tags,
        sourceUrl: dbLead.sourceUrl,
        score: dbLead.qualificationScore,
        emailCategory: dbLead.emailCategory,
        emailBounced: dbLead.emailBounced,
        followUpCount: dbLead.followUpCount,
        createdAt: dbLead.createdAt,
        lastContactedAt: dbLead.lastContactedAt,
      }

      // Get recent actions
      const dbActions = await withDbRetry(() =>
        prisma.growthAction.findMany({
          where: { leadId: dbLead.id, userId: session.user.id },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { actionType: true, title: true, status: true, createdAt: true },
        })
      ) as any[]
      actions = dbActions || []
    }

    // 2. Extract search targets
    const targetEmail = (lead?.email as string) || email || ''
    const targetName = (lead?.name as string) || name || ''
    const domain = targetEmail ? targetEmail.split('@')[1] : ''

    // 3. Run parallel: web search + domain check
    const searchQueries: Promise<{ answer: string; sources: string[] }>[] = []
    
    if (domain) {
      searchQueries.push(webSearch(`"${domain}" company business website`))
    }
    if (targetName && targetName !== 'Desconocido' && targetName !== 'Unknown') {
      searchQueries.push(webSearch(`"${targetName}" ${domain || targetEmail}`))
    } else if (targetEmail) {
      searchQueries.push(webSearch(`"${targetEmail}"`))
    }

    const domainCheckPromise = domain ? checkDomain(domain) : Promise.resolve({ exists: false, hasWebsite: false, title: '' })

    const [domainCheck, ...searchResults] = await Promise.all([
      domainCheckPromise,
      ...searchQueries,
    ])

    // 4. Compile web findings
    const webFindings = searchResults.map(r => r.answer).filter(Boolean).join('\n\n---\n\n')
    const allSources = [...new Set(searchResults.flatMap(r => r.sources))]

    const domainInfo = domain
      ? `Dominio: ${domain}\nSitio web activo: ${domainCheck.hasWebsite ? 'SÍ' : 'NO'}\nTítulo del sitio: ${domainCheck.title || 'N/A'}`
      : 'No se proporcionó dominio'

    // 5. Synthesize with LLM
    const analysis = await synthesizeVerdict(
      { ...(lead || { email, name }), recentActions: actions },
      webFindings || 'No se encontró información en búsqueda web.',
      domainInfo
    )

    return NextResponse.json({
      success: true,
      analysis,
      leadFound: !!lead,
      lead: lead || null,
      domain: {
        name: domain,
        active: domainCheck.hasWebsite,
        title: domainCheck.title,
      },
      sources: allSources.slice(0, 5),
      actionsCount: actions.length,
    })
  } catch (error) {
    console.error('[LeadResearch] Error:', error)
    return NextResponse.json({ error: 'Error al investigar lead' }, { status: 500 })
  }
}
