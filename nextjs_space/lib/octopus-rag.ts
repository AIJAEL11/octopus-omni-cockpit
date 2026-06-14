/**
 * OCTOPUS RAG 2.0 Phase 2 - Sistema de Recuperación Aumentada de Generación
 * 
 * Implementa las 5 capas del RAG de Octopus:
 * 1. Memoria Semántica - Hechos y preferencias del usuario
 * 2. Knowledge Base - Documentos y chunks
 * 3. Semantic Vector Search - TF-IDF con cosine similarity
 * 4. Knowledge Graph - Entidades y relaciones
 * 5. Arms Integration - Datos de GitHub/Gmail
 */

import { prisma, withDbRetry } from './prisma'
import { semanticSearch, upsertSemanticVector } from './octopus-vectors'
import { buildGraphContext, processTriples, extractTriplesFromText } from './octopus-knowledge-graph'
import { searchArmData } from './octopus-arms-integration'
import { reRankResults, formatReRankedContext, logQueryResults, type RankedItem } from './octopus-reranker'
import { classifyQueryBubbles, bubblesToCategories } from './octopus-bubbles'

// ============================================
// TIPOS
// ============================================

export interface SemanticFact {
  subject: string
  predicate: string
  object: string
  category: 'preference' | 'fact' | 'skill' | 'context' | 'relationship' | 'identity' | 'business' | 'goal'
  confidence: number
}

const VALID_FACT_CATEGORIES = ['preference', 'fact', 'skill', 'context', 'relationship', 'identity', 'business', 'goal']

export interface RetrievedContext {
  memories: SemanticFact[]
  documents: {
    id: string
    title: string
    relevantChunks: string[]
  }[]
  recentTopics: string[]
}

export interface RAGResult {
  contextPrompt: string
  sourcesUsed: string[]
  confidence: number
}

// ============================================
// EXTRACCIÓN DE HECHOS SEMÁNTICOS
// ============================================

/**
 * Phase 4: LLM-based fact extraction prompt — enriched for business/marketing context
 */
const BUSINESS_FACT_EXTRACTION_PROMPT = `Eres un extractor de hechos para un CRM de marketing/ventas con IA.
Analiza el mensaje del usuario y extrae SOLO hechos claros y explícitos. NO inventes ni asumas.

Categorías de hechos a buscar:
- identity: nombre, empresa, cargo, email, teléfono
- business: industria, tipo de negocio, marca, producto/servicio, mercado objetivo
- preference: gustos, disgustos, estilo preferido, tono, idioma preferido, horarios
- goal: objetivos de negocio, metas de marketing, KPIs deseados
- context: herramientas que usa, plataformas, presupuesto, equipo, tecnologías
- relationship: clientes, socios, competidores mencionados

Predicados válidos:
identity → is_called, works_as, works_at, has_email, has_phone, job_title
business → brand_name, industry, sells, target_audience, business_type, market
preference → prefers, dislikes, tone_style, language_pref, schedule_pref
goal → wants_to, kpi_target, campaign_goal, growth_target
context → uses_tool, budget_range, team_size, platform, tech_stack
relationship → client_of, partner_of, competitor

Responde SOLO JSON válido:
{"facts": [{"subject": "user", "predicate": "...", "object": "valor concreto", "category": "...", "confidence": 0.7-1.0}]}

Si NO hay hechos claros, responde: {"facts": []}
NO extraigas hechos de preguntas genéricas o comandos de acción.

Mensaje:`

/**
 * Phase 4: LLM-based fact extraction (async, non-blocking)
 * Falls back to regex extraction if LLM fails
 */
export async function extractSemanticFactsLLM(message: string): Promise<SemanticFact[]> {
  // Skip very short messages or pure commands
  if (message.length < 15) return []
  if (/^(dale|sí|ok|listo|hazlo|genera|crea|publica|busca)\b/i.test(message.trim())) return []
  
  try {
    const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-nano',
        messages: [
          { role: 'system', content: BUSINESS_FACT_EXTRACTION_PROMPT },
          { role: 'user', content: message.substring(0, 500) },
        ],
        max_tokens: 300,
        temperature: 0.1,
      }),
    })
    
    if (!response.ok) throw new Error(`LLM ${response.status}`)
    
    const data = await response.json()
    const content = data.choices?.[0]?.message?.content?.trim() || ''
    
    // Parse JSON — handle markdown fences
    const jsonStr = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(jsonStr)
    
    if (!parsed.facts || !Array.isArray(parsed.facts)) return []
    
    return parsed.facts
      .filter((f: any) => f.subject && f.predicate && f.object && f.category && f.confidence)
      .map((f: any) => ({
        subject: String(f.subject).substring(0, 100),
        predicate: String(f.predicate).substring(0, 50),
        object: String(f.object).substring(0, 200),
        category: (VALID_FACT_CATEGORIES.includes(f.category)
          ? f.category : 'context') as SemanticFact['category'],
        confidence: Math.min(Math.max(Number(f.confidence) || 0.7, 0.5), 1.0),
      }))
  } catch (error) {
    console.log('[Phase 4] LLM fact extraction failed, falling back to regex:', error instanceof Error ? error.message : error)
    return extractSemanticFactsRegex(message)
  }
}

/**
 * Legacy regex-based extraction — used as fallback
 */
export function extractSemanticFacts(message: string): SemanticFact[] {
  return extractSemanticFactsRegex(message)
}

function extractSemanticFactsRegex(message: string): SemanticFact[] {
  const facts: SemanticFact[] = []
  const lowerMessage = message.toLowerCase()
  
  const preferencePatterns = [
    { regex: /(?:me gusta|prefiero|amo|adoro)\s+([\w\s]+)/gi, predicate: 'likes', cat: 'preference' as const },
    { regex: /(?:no me gusta|odio|detesto)\s+([\w\s]+)/gi, predicate: 'dislikes', cat: 'preference' as const },
    { regex: /(?:mi nombre es|me llamo)\s+([\w\s]+)/gi, predicate: 'is_called', cat: 'fact' as const },
    { regex: /(?:trabajo en|mi empresa es|trabajo para)\s+([\w\s]+)/gi, predicate: 'works_at', cat: 'fact' as const },
    { regex: /(?:soy|mi profesión es|trabajo como)\s+([\w\s]+)/gi, predicate: 'works_as', cat: 'fact' as const },
    { regex: /(?:mi marca es|nuestra marca|brand)\s+([\w\s]+)/gi, predicate: 'brand_name', cat: 'fact' as const },
    { regex: /(?:mi email es|mi correo es)\s+([\w@.]+)/gi, predicate: 'has_email', cat: 'fact' as const },
    { regex: /(?:vendemos|ofrecemos|nuestro producto)\s+([\w\s]+)/gi, predicate: 'sells', cat: 'context' as const },
    { regex: /(?:estoy aprendiendo|quiero aprender)\s+([\w\s]+)/gi, predicate: 'learning', cat: 'context' as const },
    { regex: /(?:mi proyecto es|estoy trabajando en)\s+([\w\s]+)/gi, predicate: 'working_on', cat: 'context' as const },
    { regex: /(?:quiero|mi objetivo es|necesito)\s+([\w\s]+)/gi, predicate: 'wants_to', cat: 'context' as const },
  ]
  
  for (const pattern of preferencePatterns) {
    const matches = message.matchAll(pattern.regex)
    for (const match of matches) {
      if (match[1] && match[1].length > 2) {
        facts.push({
          subject: 'user',
          predicate: pattern.predicate,
          object: match[1].trim().substring(0, 100),
          category: pattern.cat,
          confidence: 0.8,
        })
      }
    }
  }
  
  return facts
}

/**
 * Phase 4: Consolidate & decay memories — merge duplicates, lower confidence on stale facts
 * Run periodically (e.g., after every 10th message or on session start)
 */
export async function consolidateMemories(userId: string): Promise<{ merged: number; decayed: number; pruned: number }> {
  let merged = 0, decayed = 0, pruned = 0
  
  try {
    // 1. Find and merge duplicate facts (same subject+predicate+object)
    const allMemories = await prisma.semanticMemory.findMany({
      where: { userId },
      orderBy: { confidence: 'desc' },
    })
    
    const seen = new Map<string, string>() // key → id of highest-confidence version
    const toDelete: string[] = []
    
    for (const mem of allMemories) {
      const key = `${mem.subject}::${mem.predicate}::${mem.object.toLowerCase()}`
      if (seen.has(key)) {
        // Duplicate — boost the original, delete this one
        const originalId = seen.get(key)!
        await prisma.semanticMemory.update({
          where: { id: originalId },
          data: { 
            confidence: Math.min(1.0, mem.confidence + 0.05),
            useCount: { increment: mem.useCount },
          },
        }).catch(() => {})
        toDelete.push(mem.id)
        merged++
      } else {
        seen.set(key, mem.id)
      }
    }
    
    // 2. Decay stale memories (not used in >30 days, confidence > 0.3)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const staleResult = await prisma.semanticMemory.updateMany({
      where: {
        userId,
        lastUsed: { lt: thirtyDaysAgo },
        confidence: { gt: 0.3 },
        category: { notIn: ['fact'] }, // Never decay identity facts
      },
      data: { confidence: { decrement: 0.1 } },
    })
    decayed = staleResult.count
    
    // 3. Prune very low-confidence memories (< 0.2) and limit to 100 per user
    const lowConfidence = await prisma.semanticMemory.deleteMany({
      where: { userId, confidence: { lt: 0.2 } },
    })
    pruned = lowConfidence.count
    
    // Delete duplicates
    if (toDelete.length > 0) {
      await prisma.semanticMemory.deleteMany({
        where: { id: { in: toDelete } },
      })
      pruned += toDelete.length
    }
    
    // 4. Cap at 100 memories — keep highest confidence
    const totalCount = await prisma.semanticMemory.count({ where: { userId } })
    if (totalCount > 100) {
      const excess = await prisma.semanticMemory.findMany({
        where: { userId },
        orderBy: [{ confidence: 'asc' }, { lastUsed: 'asc' }],
        take: totalCount - 100,
        select: { id: true },
      })
      if (excess.length > 0) {
        await prisma.semanticMemory.deleteMany({
          where: { id: { in: excess.map(e => e.id) } },
        })
        pruned += excess.length
      }
    }
  } catch (error) {
    console.error('[Phase 4] Memory consolidation error:', error)
  }
  
  return { merged, decayed, pruned }
}

/**
 * Phase 4: Build a structured user profile from SemanticMemory
 * Returns a concise text block for injection into the system prompt
 */
export async function buildUserMemoryProfile(userId: string): Promise<string> {
  try {
    const memories = await withDbRetry(() => prisma.semanticMemory.findMany({
      where: { userId },
      orderBy: [{ confidence: 'desc' }, { useCount: 'desc' }],
      take: 40,
    }))
    
    if (memories.length === 0) return ''
    
    // Group by category
    const groups: Record<string, string[]> = {}
    for (const m of memories) {
      const label = formatPredicate(m.predicate)
      const entry = `${m.subject === 'user' ? '' : m.subject + ' '}${label} ${m.object}`
      const cat = m.category || 'context'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(entry)
    }
    
    const sections: string[] = []
    
    // Identity first
    const identityEntries = [...(groups['identity'] || []), ...(groups['fact'] || [])]
    if (identityEntries.length > 0) {
      sections.push(`👤 Identidad: ${identityEntries.slice(0, 8).join(' | ')}`)
    }
    if (groups['business']) {
      sections.push(`🏢 Negocio: ${groups['business'].slice(0, 6).join(' | ')}`)
    }
    if (groups['goal']) {
      sections.push(`🎯 Objetivos: ${groups['goal'].slice(0, 5).join(' | ')}`)
    }
    if (groups['preference']) {
      sections.push(`⭐ Preferencias: ${groups['preference'].slice(0, 6).join(' | ')}`)
    }
    if (groups['context']) {
      sections.push(`🔧 Contexto: ${groups['context'].slice(0, 6).join(' | ')}`)
    }
    if (groups['skill']) {
      sections.push(`💡 Skills: ${groups['skill'].slice(0, 4).join(' | ')}`)
    }
    if (groups['relationship']) {
      sections.push(`🤝 Relaciones: ${groups['relationship'].slice(0, 4).join(' | ')}`)
    }
    
    if (sections.length === 0) return ''
    
    return `\n[🧠 MEMORIA ACTIVA — ${memories.length} hechos]\n${sections.join('\n')}\n`
  } catch (error) {
    console.error('[Phase 4] Error building memory profile:', error)
    return ''
  }
}

// ============================================
// MEMORIA SEMÁNTICA
// ============================================

/**
 * Guarda hechos semánticos en la base de datos
 */
export async function saveSemanticMemories(
  userId: string,
  facts: SemanticFact[],
  source: string = 'conversation'
): Promise<number> {
  let savedCount = 0
  
  for (const fact of facts) {
    try {
      // Buscar si ya existe este hecho
      const existing = await withDbRetry(() => prisma.semanticMemory.findFirst({
        where: {
          userId,
          subject: fact.subject,
          predicate: fact.predicate,
          object: fact.object,
        }
      }))
      
      if (existing) {
        // Actualizar confianza y uso
        await withDbRetry(() => prisma.semanticMemory.update({
          where: { id: existing.id },
          data: {
            confidence: Math.min(existing.confidence + 0.1, 1.0),
            useCount: existing.useCount + 1,
            lastUsed: new Date(),
          }
        }))
      } else {
        // Crear nuevo
        await withDbRetry(() => prisma.semanticMemory.create({
          data: {
            userId,
            category: fact.category,
            subject: fact.subject,
            predicate: fact.predicate,
            object: fact.object,
            confidence: fact.confidence,
            source,
          }
        }))
        savedCount++
      }
    } catch (error) {
      console.error('Error saving semantic memory:', error)
    }
  }
  
  return savedCount
}

/**
 * Recupera memorias semánticas relevantes para una consulta
 */
export async function retrieveSemanticMemories(
  userId: string,
  query: string,
  limit: number = 10,
  categories?: string[]
): Promise<SemanticFact[]> {
  const queryLower = query.toLowerCase()
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 3)

  // Buscar memorias que coincidan con palabras clave
  // Si hay filtro de burbujas (categories), solo se recupera esa porción de memoria
  const memories = await withDbRetry(() => prisma.semanticMemory.findMany({
    where: {
      userId,
      ...(categories && categories.length > 0 ? { category: { in: categories } } : {}),
      OR: [
        ...queryWords.map(word => ({
          OR: [
            { subject: { contains: word, mode: 'insensitive' as const } },
            { object: { contains: word, mode: 'insensitive' as const } },
          ]
        })),
        // Siempre incluir preferencias del usuario
        { category: 'preference' },
        { predicate: 'is_called' },
      ]
    },
    orderBy: [
      { confidence: 'desc' },
      { useCount: 'desc' },
      { lastUsed: 'desc' },
    ],
    take: limit,
  }))
  
  // Marcar como usadas
  if (memories.length > 0) {
    await withDbRetry(() => prisma.semanticMemory.updateMany({
      where: {
        id: { in: memories.map(m => m.id) }
      },
      data: {
        lastUsed: new Date(),
        useCount: { increment: 1 }
      }
    }))
  }
  
  return memories.map(m => ({
    subject: m.subject,
    predicate: m.predicate,
    object: m.object,
    category: m.category as SemanticFact['category'],
    confidence: m.confidence,
  }))
}

// ============================================
// KNOWLEDGE BASE
// ============================================

/**
 * Divide un documento en chunks inteligentes
 */
export function chunkDocument(content: string, maxChunkSize: number = 500): string[] {
  const chunks: string[] = []
  
  // Dividir por párrafos primero
  const paragraphs = content.split(/\n\n+/)
  
  let currentChunk = ''
  
  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim())
      currentChunk = paragraph
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }
  
  return chunks
}

/**
 * Extrae palabras clave de un texto
 */
export function extractKeywords(content: string): string[] {
  const stopWords = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'en', 'con', 'por', 'para', 'que', 'es', 'son', 'y', 'o', 'a', 'the', 'is', 'are', 'and', 'or', 'to', 'of', 'in', 'for', 'on', 'with'])
  
  const words = content.toLowerCase()
    .replace(/[^a-záéíóúñ\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w))
  
  // Contar frecuencia
  const frequency: Record<string, number> = {}
  for (const word of words) {
    frequency[word] = (frequency[word] || 0) + 1
  }
  
  // Top 10 palabras más frecuentes
  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word)
}

/**
 * Busca en documentos del Knowledge Base
 */
export async function searchKnowledgeBase(
  userId: string,
  query: string,
  limit: number = 5
): Promise<{ documentId: string; title: string; chunks: string[] }[]> {
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3)
  
  if (queryWords.length === 0) return []
  
  // Buscar documentos que contengan las palabras clave
  const documents = await prisma.knowledgeDocument.findMany({
    where: {
      userId,
      OR: [
        { title: { contains: queryWords[0], mode: 'insensitive' } },
        { keywords: { hasSome: queryWords } },
      ]
    },
    include: {
      chunks: {
        orderBy: { position: 'asc' },
        take: 3,
      }
    },
    take: limit,
  })
  
  // Incrementar contador de consultas
  if (documents.length > 0) {
    await prisma.knowledgeDocument.updateMany({
      where: { id: { in: documents.map(d => d.id) } },
      data: { queryCount: { increment: 1 } }
    })
  }
  
  return documents.map(doc => ({
    documentId: doc.id,
    title: doc.title,
    chunks: doc.chunks.map(c => c.content),
  }))
}

// ============================================
// CONTEXT INJECTION & RE-RANKING
// ============================================

/**
 * Construye el contexto completo para inyectar en el prompt
 * Fase 2 Optimizada: Re-ranking unificado con BM25 + token budget
 */
export async function buildContextPrompt(
  userId: string,
  query: string,
  conversationHistory: string[] = []
): Promise<RAGResult> {
  const sourcesUsed: string[] = []
  const allItems: RankedItem[] = []

  // Bubbles: clasificar la consulta para recuperar solo las burbujas relevantes
  const activeBubbles = classifyQueryBubbles(query)
  const bubbleCategories = activeBubbles ? bubblesToCategories(activeBubbles) : undefined
  if (activeBubbles) {
    sourcesUsed.push(`bubbles:${activeBubbles.join(',')}`)
  }

  // 1. Recuperar memorias semánticas → convertir a RankedItems
  const memories = await retrieveSemanticMemories(userId, query, 10, bubbleCategories)
  
  if (memories.length > 0) {
    sourcesUsed.push('semantic_memory')
    for (const m of memories) {
      allItems.push({
        id: `mem_${m.subject}_${m.predicate}_${m.object}`.substring(0, 60),
        source: 'memory',
        text: `${m.subject} ${formatPredicate(m.predicate)} ${m.object}`,
        title: m.category === 'fact' ? 'Hecho' : m.category === 'preference' ? 'Preferencia' : m.category === 'skill' ? 'Skill' : undefined,
        rawScore: m.confidence,
        rerankedScore: 0,
      })
    }
  }
  
  // 2. Buscar en Knowledge Base → convertir a RankedItems
  const kbResults = await searchKnowledgeBase(userId, query, 5)
  
  if (kbResults.length > 0) {
    sourcesUsed.push('knowledge_base')
    for (const doc of kbResults) {
      for (const chunk of doc.chunks.slice(0, 4)) {
        allItems.push({
          id: `kb_${doc.documentId}_${allItems.length}`,
          source: 'knowledge_base',
          text: chunk.substring(0, 800),
          title: doc.title,
          rawScore: 0.7,
          rerankedScore: 0,
        })
      }
    }
  }
  
  // 3. Semantic Vector Search (Phase 2) → convertir a RankedItems
  try {
    const vectorResults = await semanticSearch(userId, query, {
      limit: 8,
      minSimilarity: 0.05,
    })
    
    if (vectorResults.length > 0) {
      sourcesUsed.push('semantic_vectors')
      for (const vr of vectorResults) {
        allItems.push({
          id: `vec_${vr.sourceType}_${vr.sourceId}`,
          source: 'semantic_vector',
          text: vr.text.substring(0, 700),
          title: vr.sourceType === 'knowledge_chunk' ? 'KB Chunk' : vr.sourceType === 'knowledge_doc' ? 'KB Doc' : vr.sourceType,
          rawScore: vr.similarity,
          rerankedScore: 0,
          metadata: { sourceType: vr.sourceType },
        })
      }
    }
  } catch (error) {
    console.error('Semantic vector search error:', error)
  }
  
  // 4. Knowledge Graph Context (Phase 2)
  try {
    const graphContext = await buildGraphContext(userId, query)
    if (graphContext) {
      sourcesUsed.push('knowledge_graph')
      allItems.push({
        id: `graph_${Date.now()}`,
        source: 'knowledge_graph',
        text: graphContext.substring(0, 1000),
        rawScore: 0.6,
        rerankedScore: 0,
      })
    }
  } catch (error) {
    console.error('Knowledge graph context error:', error)
  }
  
  // 5. Arms Data Search (Phase 2)
  try {
    const armsResults = await searchArmData(userId, query, undefined, 4)
    if (armsResults.length > 0) {
      sourcesUsed.push('arms_data')
      for (const ar of armsResults) {
        allItems.push({
          id: `arm_${ar.armType}_${allItems.length}`,
          source: 'arms_data',
          text: `[${ar.armType}/${ar.dataType}] ${ar.title}: ${ar.content.substring(0, 500)}`,
          rawScore: 0.5,
          rerankedScore: 0,
        })
      }
    }
  } catch (error) {
    console.error('Arms data search error:', error)
  }
  
  // 6. Contexto de conversación reciente
  if (conversationHistory.length > 0) {
    sourcesUsed.push('conversation_context')
    const recentTopics = conversationHistory.slice(-5).join(' ').substring(0, 800)
    allItems.push({
      id: `conv_recent`,
      source: 'conversation',
      text: `Temas recientes: ${recentTopics}`,
      rawScore: 0.4,
      rerankedScore: 0,
    })
  }
  
  // ============================================
  // RE-RANKING UNIFICADO
  // ============================================
  const reranked = reRankResults(query, allItems, {
    maxTokenBudget: 11000,
    maxItems: 20,
  })
  
  // Formatear contexto optimizado
  const contextPrompt = formatReRankedContext(reranked)
  
  // Log para mejora continua (async, no bloquea)
  if (reranked.length > 0) {
    logQueryResults(userId, query, reranked, conversationHistory.slice(-2).join(' ')).catch(() => {})
  }
  
  // Calcular confianza basada en re-ranking scores
  const avgScore = reranked.length > 0
    ? reranked.reduce((sum, r) => sum + r.rerankedScore, 0) / reranked.length
    : 0
  const confidence = Math.min(
    0.3 + (avgScore * 0.4) + (sourcesUsed.length * 0.08),
    1.0
  )
  
  return {
    contextPrompt,
    sourcesUsed,
    confidence,
  }
}

/**
 * Formatea predicados para lectura humana
 */
function formatPredicate(predicate: string): string {
  const mapping: Record<string, string> = {
    'likes': 'le gusta',
    'dislikes': 'no le gusta',
    'prefers': 'prefiere',
    'uses': 'usa',
    'is_called': 'se llama',
    'works_as': 'trabaja como',
    'works_at': 'trabaja en',
    'job_title': 'cargo:',
    'has_email': 'email:',
    'has_phone': 'tel:',
    'brand_name': 'marca:',
    'industry': 'industria:',
    'sells': 'vende/ofrece',
    'target_audience': 'audiencia:',
    'business_type': 'tipo de negocio:',
    'market': 'mercado:',
    'tone_style': 'tono preferido:',
    'language_pref': 'idioma preferido:',
    'schedule_pref': 'horario preferido:',
    'wants_to': 'quiere',
    'kpi_target': 'KPI objetivo:',
    'campaign_goal': 'meta de campaña:',
    'growth_target': 'meta de crecimiento:',
    'uses_tool': 'usa herramienta:',
    'budget_range': 'presupuesto:',
    'team_size': 'equipo:',
    'platform': 'plataforma:',
    'tech_stack': 'tech:',
    'client_of': 'cliente de',
    'partner_of': 'socio de',
    'competitor': 'competidor:',
    'learning': 'está aprendiendo',
    'working_on': 'trabaja en proyecto',
    'mentions': 'menciona',
    'uses_tech': 'conoce',
  }
  return mapping[predicate] || predicate.replace(/_/g, ' ')
}

// ============================================
// HELPERS DE ALTO NIVEL
// ============================================

/**
 * Procesa un mensaje y actualiza la memoria + Knowledge Graph + Vectors (Phase 2)
 */
export async function processMessageForMemory(
  userId: string,
  message: string,
  messageCount?: number
): Promise<{ factsExtracted: number; factsSaved: number; graphUpdated: boolean; vectorized: boolean; consolidated: boolean }> {
  // Phase 4: Use LLM-based extraction for richer facts
  const facts = await extractSemanticFactsLLM(message)
  const saved = await saveSemanticMemories(userId, facts)
  
  // Phase 4: Consolidate memories every ~20 messages
  let consolidated = false
  if (messageCount && messageCount % 20 === 0) {
    const result = await consolidateMemories(userId).catch(() => ({ merged: 0, decayed: 0, pruned: 0 }))
    if (result.merged > 0 || result.decayed > 0 || result.pruned > 0) {
      console.log(`[Phase 4] Memory consolidation: merged=${result.merged}, decayed=${result.decayed}, pruned=${result.pruned}`)
      consolidated = true
    }
  }
  
  // Phase 2: Feed Knowledge Graph
  let graphUpdated = false
  try {
    const triples = extractTriplesFromText(message)
    if (triples.length > 0) {
      await processTriples(userId, triples, 'conversation')
      graphUpdated = true
    }
  } catch (error) {
    console.error('Error feeding knowledge graph:', error)
  }
  
  // Phase 2: Index in Semantic Vectors
  let vectorized = false
  try {
    if (message.length > 20) {
      const messageId = `msg_${Date.now()}`
      await upsertSemanticVector(userId, 'conversation', messageId, message)
      vectorized = true
    }
  } catch (error) {
    console.error('Error indexing semantic vector:', error)
  }
  
  return {
    factsExtracted: facts.length,
    factsSaved: saved,
    graphUpdated,
    vectorized,
    consolidated,
  }
}

/**
 * Obtiene todas las memorias de un usuario (para debug/visualización)
 */
export async function getUserMemories(userId: string): Promise<SemanticFact[]> {
  const memories = await prisma.semanticMemory.findMany({
    where: { userId },
    orderBy: [{ category: 'asc' }, { confidence: 'desc' }],
  })
  
  return memories.map(m => ({
    subject: m.subject,
    predicate: m.predicate,
    object: m.object,
    category: m.category as SemanticFact['category'],
    confidence: m.confidence,
  }))
}
