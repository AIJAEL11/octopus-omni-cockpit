import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
// Web search is FREE for all plans — no plan gate needed

export const dynamic = 'force-dynamic'

const ABACUS_API_KEY = process.env.ABACUSAI_API_KEY || ''
const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY || ''

// Detect if user wants web search (internal function, not exported)
function detectWebSearchIntent(message: string): { isSearch: boolean; query: string } {
  const lowerMessage = message.toLowerCase()
  
  const searchPatterns = [
    /busca(?:r)?\s+(?:en\s+(?:la\s+)?(?:web|internet|google))?\s*[:"']?\s*(.+)/i,
    /busca(?:me)?\s+información\s+(?:sobre|de|acerca\s+de)?\s*(.+)/i,
    /investiga(?:r)?\s+(?:sobre|acerca\s+de)?\s*(.+)/i,
    /qué\s+(?:es|son|significa)\s+(.+)/i,
    /que\s+(?:es|son|significa)\s+(.+)/i,
    /dime\s+(?:qué|que)\s+(?:es|son)\s+(.+)/i,
    /explica(?:me)?\s+(?:qué|que)\s+(?:es|son)\s+(.+)/i,
    /search\s+(?:for\s+)?(.+)/i,
    /look\s+up\s+(.+)/i,
    /find\s+(?:information\s+)?(?:about|on)\s+(.+)/i,
    /google(?:a|ar)?\s+(.+)/i,
    /navega(?:r)?\s+(?:a|en|por)?\s*(.+)/i,
    /abre\s+(?:la\s+)?(?:página|pagina|web|sitio)\s+(?:de\s+)?(.+)/i,
    /entra\s+(?:a|en)\s+(.+)/i,
    /ve\s+a\s+(.+)/i,
    /visita\s+(.+)/i,
    /(?:cuál|cual)\s+es\s+(?:el|la)\s+(.+)/i,
    /(?:cuáles|cuales)\s+son\s+(?:los|las)\s+(.+)/i,
    /(?:cómo|como)\s+(?:funciona|se\s+hace|puedo)\s+(.+)/i,
    /noticias\s+(?:sobre|de)\s+(.+)/i,
    /últimas\s+noticias\s+(?:de|sobre)?\s*(.+)/i,
    /precio\s+(?:de|del)\s+(.+)/i,
    /clima\s+(?:en|de)\s+(.+)/i,
    /weather\s+(?:in|for)\s+(.+)/i,
  ]
  
  const explicitSearchWords = [
    'busca', 'buscar', 'investiga', 'investigar', 'google', 'googlea',
    'search', 'find', 'look up', 'navega', 'navegar', 'web', 'internet'
  ]
  
  const hasExplicitSearch = explicitSearchWords.some(word => lowerMessage.includes(word))
  
  for (const pattern of searchPatterns) {
    const match = message.match(pattern)
    if (match && match[1]) {
      return { isSearch: true, query: match[1].trim() }
    }
  }
  
  if (hasExplicitSearch) {
    let query = message
      .replace(/^(busca|buscar|investiga|investigar|google|googlea|search|find|look up|navega|navegar)\s*/i, '')
      .replace(/^(en la web|en internet|en google|for|about|on|sobre|de|acerca de)\s*/i, '')
      .trim()
    
    if (query.length > 3) {
      return { isSearch: true, query }
    }
  }
  
  return { isSearch: false, query: '' }
}

// Fetch and parse web content (fallback for direct URL access)
async function fetchWebContent(url: string): Promise<{ title: string; content: string; url: string }> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(10000)
    })
    
    if (!response.ok) throw new Error('Failed to fetch')
    
    const html = await response.text()
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : url
    
    let content = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim()
    
    content = content.substring(0, 3000)
    return { title, content, url }
  } catch (error) {
    console.error('Error fetching URL:', url, error)
    throw error
  }
}

// ============================================
// 🔥 PRIMARY: Abacus AI with Gemini Grounding
// ============================================
async function searchWithAbacusGrounding(query: string): Promise<{
  answer: string;
  results: Array<{ title: string; url: string; snippet: string }>;
  searchEngine: string;
}> {
  try {
    console.log(`[Web Search] Abacus Grounding query: "${query}"`)
    
    const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ABACUS_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [{
          role: 'user',
          content: `Busca en internet información actualizada y detallada sobre: ${query}\n\nProporciona datos reales, concretos y específicos: nombres, precios, URLs, ratings, características. Cita tus fuentes con URLs cuando sea posible. Responde en el mismo idioma de la consulta.`
        }],
        temperature: 0.3,
        max_tokens: 4096,
        extra_parameters: { grounding: true }
      }),
      signal: AbortSignal.timeout(30000)
    })
    
    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      console.error('[Web Search] Abacus API Error:', response.status, errText.substring(0, 300))
      throw new Error(`Abacus API error: ${response.status}`)
    }
    
    const data = await response.json()
    const answer = data.choices?.[0]?.message?.content || ''
    
    if (!answer) {
      throw new Error('Empty response from Abacus API')
    }
    
    // Extract URLs from the answer text as sources
    const results: Array<{ title: string; url: string; snippet: string }> = []
    const urlRegex = /https?:\/\/[^\s\)\]"'<>]+/g
    const foundUrls = answer.match(urlRegex) || []
    const seenDomains = new Set<string>()
    
    for (const url of foundUrls) {
      try {
        const domain = new URL(url).hostname
        if (!seenDomains.has(domain) && results.length < 8) {
          seenDomains.add(domain)
          results.push({
            title: domain.replace('www.', ''),
            url: url.replace(/[.,;:]+$/, ''), // Clean trailing punctuation
            snippet: ''
          })
        }
      } catch { /* invalid url */ }
    }
    
    console.log(`[Web Search] Abacus Grounding: ${answer.length} chars, ${results.length} sources`)
    
    return {
      answer,
      results,
      searchEngine: 'Octopus Web Search'
    }
  } catch (error) {
    console.error('[Web Search] Abacus Grounding error:', error)
    throw error
  }
}

// ============================================
// 🔄 FALLBACK: Google Gemini Direct API
// ============================================
async function searchWithGeminiDirect(query: string): Promise<{
  answer: string;
  results: Array<{ title: string; url: string; snippet: string }>;
  searchEngine: string;
}> {
  if (!GEMINI_API_KEY) throw new Error('No Gemini API key')
  
  try {
    console.log(`[Web Search] Gemini Direct query: "${query}"`)
    
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`
    
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Search the web and provide detailed, factual information about: ${query}\n\nProvide real data including names, addresses, phone numbers, websites, ratings, and any other concrete details you find. Be specific and cite your sources.`
          }]
        }],
        tools: [{ google_search: {} }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4096
        }
      }),
      signal: AbortSignal.timeout(30000)
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('[Web Search] Gemini Direct Error:', response.status, JSON.stringify(errorData).substring(0, 300))
      throw new Error(`Gemini API error: ${response.status}`)
    }
    
    const data = await response.json()
    const candidate = data.candidates?.[0]
    if (!candidate) throw new Error('No candidates in Gemini response')
    
    let answer = ''
    const parts = candidate.content?.parts || []
    for (const part of parts) {
      if (part.text) answer += part.text
    }
    
    const results: Array<{ title: string; url: string; snippet: string }> = []
    const groundingMetadata = candidate.groundingMetadata || {}
    const groundingChunks = groundingMetadata.groundingChunks || []
    const groundingSupports = groundingMetadata.groundingSupports || []
    
    const seenUrls = new Set<string>()
    for (const chunk of groundingChunks) {
      const web = chunk.web
      if (web?.uri && !seenUrls.has(web.uri)) {
        seenUrls.add(web.uri)
        let snippet = ''
        for (const support of groundingSupports) {
          const indices = support.groundingChunkIndices || []
          if (indices.includes(groundingChunks.indexOf(chunk))) {
            const seg = support.segment
            if (seg?.text) { snippet = seg.text.substring(0, 200); break }
          }
        }
        results.push({ title: web.title || new URL(web.uri).hostname, url: web.uri, snippet })
      }
    }
    
    console.log(`[Web Search] Gemini Direct: ${answer.length} chars, ${results.length} sources`)
    return { answer, results, searchEngine: 'Google Gemini' }
  } catch (error) {
    console.error('[Web Search] Gemini Direct error:', error)
    throw error
  }
}

// ============================================
// 🦆 LAST RESORT: DuckDuckGo HTML scraping
// ============================================
async function searchDuckDuckGoFallback(query: string): Promise<Array<{ title: string; url: string; snippet: string }>> {
  try {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: AbortSignal.timeout(15000)
    })
    
    if (!response.ok) throw new Error('Search failed')
    const html = await response.text()
    const results: Array<{ title: string; url: string; snippet: string }> = []
    const resultMatches = html.matchAll(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([^<]*(?:<[^>]+>[^<]*)*)<\/a>/gi)
    
    for (const match of resultMatches) {
      if (results.length >= 5) break
      let url = match[1]
      const uddgMatch = url.match(/uddg=([^&]+)/)
      if (uddgMatch) url = decodeURIComponent(uddgMatch[1])
      const title = match[2].replace(/<[^>]+>/g, '').trim()
      const snippet = match[3].replace(/<[^>]+>/g, '').trim()
      if (url && title && !url.includes('duckduckgo.com')) {
        results.push({ title, url, snippet })
      }
    }
    return results
  } catch (error) {
    console.error('DuckDuckGo fallback error:', error)
    return []
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { query, url } = await request.json()
    
    // If URL provided, fetch that specific page
    if (url) {
      try {
        const content = await fetchWebContent(url)
        return NextResponse.json({ success: true, type: 'page', data: content })
      } catch {
        return NextResponse.json({ success: false, error: 'No pude acceder a esa página' })
      }
    }
    
    // Search with cascade: Abacus Grounding → Gemini Direct → DuckDuckGo
    if (query) {
      // === ENGINE 1: Abacus AI with Grounding (primary — always available) ===
      if (ABACUS_API_KEY) {
        try {
          const result = await searchWithAbacusGrounding(query)
          return NextResponse.json({
            success: true,
            type: 'search',
            data: {
              query,
              results: result.results,
              geminiAnswer: result.answer,
              searchEngine: result.searchEngine,
              firstResultContent: {
                title: `Octopus Web Search: ${query}`,
                content: result.answer,
                url: 'https://octopuskills.com'
              }
            }
          })
        } catch (abacusError) {
          console.error('[Web Search] Abacus Grounding failed, trying Gemini Direct:', abacusError)
        }
      }
      
      // === ENGINE 2: Google Gemini Direct API (fallback) ===
      if (GEMINI_API_KEY) {
        try {
          const geminiResult = await searchWithGeminiDirect(query)
          return NextResponse.json({
            success: true,
            type: 'search',
            data: {
              query,
              results: geminiResult.results,
              geminiAnswer: geminiResult.answer,
              searchEngine: geminiResult.searchEngine,
              firstResultContent: {
                title: `Gemini Search: ${query}`,
                content: geminiResult.answer,
                url: 'https://gemini.google.com'
              }
            }
          })
        } catch (geminiError) {
          console.error('[Web Search] Gemini Direct failed, trying DuckDuckGo:', geminiError)
        }
      }
      
      // === ENGINE 3: DuckDuckGo HTML scraping (last resort) ===
      const results = await searchDuckDuckGoFallback(query)
      
      if (results.length === 0) {
        return NextResponse.json({
          success: true,
          type: 'search',
          data: {
            query,
            results: [],
            searchEngine: 'DuckDuckGo (fallback)',
            message: 'No encontré resultados para esa búsqueda'
          }
        })
      }
      
      let firstResultContent: { title: string; content: string; url: string } | null = null
      try {
        if (results[0]?.url) {
          firstResultContent = await fetchWebContent(results[0].url)
        }
      } catch {
        // Ignore
      }
      
      return NextResponse.json({
        success: true,
        type: 'search',
        data: {
          query,
          results,
          searchEngine: 'DuckDuckGo (fallback)',
          firstResultContent
        }
      })
    }
    
    return NextResponse.json({ error: 'Query or URL required' }, { status: 400 })
    
  } catch (error) {
    console.error('Web search error:', error)
    return NextResponse.json(
      { error: 'Error en la búsqueda web' },
      { status: 500 }
    )
  }
}
