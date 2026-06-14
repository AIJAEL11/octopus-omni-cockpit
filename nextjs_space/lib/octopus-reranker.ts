/**
 * OCTOPUS RAG 2.0 - Re-Ranking & Context Optimization Engine
 * 
 * Implementa:
 * - BM25-like scoring para unificar resultados de múltiples fuentes
 * - Token budget management para no exceder el contexto
 * - Deduplicación semántica entre resultados
 * - Query logging para mejora continua
 */

import { prisma } from './prisma'

// ============================================
// TIPOS
// ============================================

export type SourceType = 'memory' | 'knowledge_base' | 'semantic_vector' | 'knowledge_graph' | 'arms_data' | 'conversation'

export interface RankedItem {
  id: string
  source: SourceType
  text: string
  title?: string
  rawScore: number     // Score original de la fuente
  rerankedScore: number // Score normalizado después de re-ranking
  metadata?: Record<string, unknown>
}

export interface ReRankConfig {
  maxTokenBudget?: number   // ~chars * 0.25 = tokens aprox
  maxItems?: number
  sourceWeights?: Partial<Record<SourceType, number>>
  diversityPenalty?: number  // Penalización por resultados similares
  recencyBoost?: boolean
}

const DEFAULT_CONFIG: Required<ReRankConfig> = {
  maxTokenBudget: 11000,   // ~11000 tokens de contexto máximo (número mágico 🐙)
  maxItems: 20,
  sourceWeights: {
    memory: 1.2,           // Las memorias del usuario son muy relevantes
    knowledge_base: 1.0,   // Documentos subidos por el usuario
    semantic_vector: 0.9,  // Búsqueda TF-IDF
    knowledge_graph: 0.85, // Grafo de conocimiento
    arms_data: 0.7,        // Datos de GitHub/Gmail
    conversation: 0.6,     // Contexto de conversación reciente
  },
  diversityPenalty: 0.15,
  recencyBoost: true,
}

// ============================================
// BM25-LIKE SCORING
// ============================================

const STOP_WORDS_ES = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'en', 'con', 'por',
  'para', 'que', 'es', 'son', 'y', 'o', 'a', 'al', 'como', 'pero', 'si',
  'no', 'mi', 'tu', 'su', 'se', 'lo', 'le', 'les', 'nos', 'muy', 'más',
  'the', 'is', 'are', 'and', 'or', 'to', 'of', 'in', 'for', 'on', 'with',
  'this', 'that', 'was', 'were', 'be', 'have', 'has', 'had', 'do', 'does',
])

function tokenizeForBM25(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-záéíóúñüa-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS_ES.has(w))
}

/**
 * Calcula BM25 score entre query y documento
 * k1 controla saturación de term frequency
 * b controla normalización de longitud del documento
 */
function bm25Score(
  queryTokens: string[],
  docTokens: string[],
  avgDocLen: number,
  k1: number = 1.5,
  b: number = 0.75
): number {
  const docLen = docTokens.length
  if (docLen === 0 || queryTokens.length === 0) return 0

  // Term frequency in document
  const tf: Record<string, number> = {}
  for (const token of docTokens) {
    tf[token] = (tf[token] || 0) + 1
  }

  let score = 0
  const uniqueQueryTerms = new Set(queryTokens)

  for (const term of uniqueQueryTerms) {
    const termFreq = tf[term] || 0
    if (termFreq === 0) continue

    // BM25 formula (sin IDF global, usamos peso uniforme)
    const numerator = termFreq * (k1 + 1)
    const denominator = termFreq + k1 * (1 - b + b * (docLen / avgDocLen))
    score += numerator / denominator
  }

  // Normalizar por número de query terms
  return score / uniqueQueryTerms.size
}

// ============================================
// DEDUPLICACIÓN SEMÁNTICA
// ============================================

/**
 * Calcula similitud Jaccard entre dos textos tokenizados
 */
function jaccardSimilarity(tokensA: string[], tokensB: string[]): number {
  const setA = new Set(tokensA)
  const setB = new Set(tokensB)
  let intersection = 0
  for (const t of setA) {
    if (setB.has(t)) intersection++
  }
  const union = setA.size + setB.size - intersection
  return union === 0 ? 0 : intersection / union
}

/**
 * Elimina resultados duplicados o muy similares
 */
function deduplicateResults(items: RankedItem[], threshold: number = 0.6): RankedItem[] {
  const kept: RankedItem[] = []
  const tokenCache: string[][] = []

  for (const item of items) {
    const tokens = tokenizeForBM25(item.text)
    let isDuplicate = false

    for (let i = 0; i < kept.length; i++) {
      const similarity = jaccardSimilarity(tokens, tokenCache[i])
      if (similarity >= threshold) {
        isDuplicate = true
        // Mantener el de mayor score
        if (item.rerankedScore > kept[i].rerankedScore) {
          kept[i] = item
          tokenCache[i] = tokens
        }
        break
      }
    }

    if (!isDuplicate) {
      kept.push(item)
      tokenCache.push(tokens)
    }
  }

  return kept
}

// ============================================
// RE-RANKING PRINCIPAL
// ============================================

/**
 * Re-rankea y filtra resultados de múltiples fuentes RAG
 * Unifica scores, aplica diversidad, respeta token budget
 */
export function reRankResults(
  query: string,
  items: RankedItem[],
  config: ReRankConfig = {}
): RankedItem[] {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const sourceWeights = { ...DEFAULT_CONFIG.sourceWeights, ...cfg.sourceWeights }

  if (items.length === 0) return []

  const queryTokens = tokenizeForBM25(query)

  // Calcular longitud promedio de documentos
  const allDocTokens = items.map(item => tokenizeForBM25(item.text))
  const avgDocLen = allDocTokens.reduce((sum, t) => sum + t.length, 0) / items.length

  // 1. Calcular BM25 score para cada item
  const scored = items.map((item, idx) => {
    const docTokens = allDocTokens[idx]
    const bm25 = bm25Score(queryTokens, docTokens, avgDocLen)

    // Combinar: BM25 (40%) + rawScore original (40%) + sourceWeight (20%)
    const weight = sourceWeights[item.source] || 0.5
    const combinedScore = (bm25 * 0.4) + (item.rawScore * 0.4) + (weight * 0.2)

    return {
      ...item,
      rerankedScore: combinedScore,
    }
  })

  // 2. Ordenar por score
  scored.sort((a, b) => b.rerankedScore - a.rerankedScore)

  // 3. Aplicar diversity penalty (MMR-like)
  if (cfg.diversityPenalty > 0) {
    for (let i = 1; i < scored.length; i++) {
      for (let j = 0; j < i; j++) {
        const sim = jaccardSimilarity(
          tokenizeForBM25(scored[i].text),
          tokenizeForBM25(scored[j].text)
        )
        if (sim > 0.3) {
          scored[i].rerankedScore *= (1 - cfg.diversityPenalty * sim)
        }
      }
    }
    // Re-sort after penalties
    scored.sort((a, b) => b.rerankedScore - a.rerankedScore)
  }

  // 4. Deduplicar
  const deduplicated = deduplicateResults(scored)

  // 5. Aplicar token budget
  const selected: RankedItem[] = []
  let tokenCount = 0
  const charsPerToken = 4 // Aproximación

  for (const item of deduplicated) {
    if (selected.length >= cfg.maxItems) break

    const itemTokens = Math.ceil(item.text.length / charsPerToken)
    if (tokenCount + itemTokens > cfg.maxTokenBudget) {
      // Intentar truncar si es valioso
      if (item.rerankedScore > 0.3 && selected.length < 3) {
        const maxChars = (cfg.maxTokenBudget - tokenCount) * charsPerToken
        if (maxChars > 100) {
          item.text = item.text.substring(0, maxChars) + '...'
          selected.push(item)
          break
        }
      }
      continue
    }

    // Solo incluir items con score mínimo relevante
    if (item.rerankedScore < 0.05 && selected.length >= 3) continue

    selected.push(item)
    tokenCount += itemTokens
  }

  return selected
}

// ============================================
// FORMATEO DE CONTEXTO OPTIMIZADO
// ============================================

/**
 * Formatea los resultados re-rankeados en un prompt de contexto optimizado
 */
export function formatReRankedContext(items: RankedItem[]): string {
  if (items.length === 0) return ''

  const sections: Record<string, RankedItem[]> = {}

  for (const item of items) {
    if (!sections[item.source]) sections[item.source] = []
    sections[item.source].push(item)
  }

  const sourceLabels: Record<string, string> = {
    memory: '🧠 MEMORIA DEL USUARIO',
    knowledge_base: '📚 KNOWLEDGE BASE',
    semantic_vector: '🔍 BÚSQUEDA SEMÁNTICA',
    knowledge_graph: '🕸️ GRAFO DE CONOCIMIENTO',
    arms_data: '🦾 DATOS DE BRAZOS',
    conversation: '💬 CONTEXTO RECIENTE',
  }

  // Ordenar secciones por máximo score en cada una
  const sectionOrder = Object.entries(sections)
    .sort((a, b) => {
      const maxA = Math.max(...a[1].map(i => i.rerankedScore))
      const maxB = Math.max(...b[1].map(i => i.rerankedScore))
      return maxB - maxA
    })

  const parts: string[] = []

  for (const [source, sectionItems] of sectionOrder) {
    const label = sourceLabels[source] || source.toUpperCase()
    parts.push(`[${label}]`)

    for (const item of sectionItems) {
      const confidence = Math.round(item.rerankedScore * 100)
      if (item.title) {
        parts.push(`• ${item.title} (${confidence}%): ${item.text}`)
      } else {
        parts.push(`• ${item.text} (${confidence}%)`)
      }
    }
  }

  return parts.join('\n') + '\n\n---\n'
}

// ============================================
// QUERY LOGGING
// ============================================

/**
 * Registra una consulta y sus resultados para mejora continua
 */
export async function logQueryResults(
  userId: string,
  query: string,
  results: RankedItem[],
  conversationContext?: string
): Promise<void> {
  try {
    await prisma.queryHistory.create({
      data: {
        userId,
        query,
        context: conversationContext || null,
        resultsUsed: results.map(r => `${r.source}:${r.id}`),
      },
    })

    // Limitar historial a últimas 200 consultas por usuario
    const count = await prisma.queryHistory.count({ where: { userId } })
    if (count > 200) {
      const oldest = await prisma.queryHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        take: count - 200,
        select: { id: true },
      })
      await prisma.queryHistory.deleteMany({
        where: { id: { in: oldest.map(o => o.id) } },
      })
    }
  } catch (error) {
    console.error('Error logging query results:', error)
  }
}

/**
 * Analiza el historial de queries para detectar temas frecuentes
 * Útil para boosting de temas recurrentes
 */
export async function getFrequentTopics(
  userId: string,
  limit: number = 10
): Promise<{ term: string; count: number }[]> {
  try {
    const recentQueries = await prisma.queryHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { query: true },
    })

    const termCounts: Record<string, number> = {}
    for (const q of recentQueries) {
      const tokens = tokenizeForBM25(q.query)
      for (const t of tokens) {
        termCounts[t] = (termCounts[t] || 0) + 1
      }
    }

    return Object.entries(termCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([term, count]) => ({ term, count }))
  } catch {
    return []
  }
}
