/**
 * OCTOPUS BUBBLES — El Mapa Mental Infinito
 *
 * Memoria organizada en "burbujas" temáticas auto-clasificadas:
 * - Cada burbuja agrupa hechos, documentos y entidades de una categoría.
 * - Retrieval selectivo: solo se recupera la(s) burbuja(s) relevante(s)
 *   a la consulta → optimización de tokens.
 * - Los "hilos" (threads) conectan burbujas que comparten sujetos/keywords,
 *   mostrando la ruta de la información.
 */

import { prisma, withDbRetry } from './prisma'
import { tokenize } from './octopus-vectors'

// ============================================
// DEFINICIÓN DE BURBUJAS
// ============================================

export interface BubbleDefinition {
  id: string
  /** Categorías de SemanticMemory que viven en esta burbuja */
  categories: string[]
  /** Keywords que activan esta burbuja en una consulta (ES + EN) */
  triggers: string[]
  color: string
  labelEs: string
  labelEn: string
}

export const BUBBLE_DEFINITIONS: BubbleDefinition[] = [
  {
    id: 'identity',
    categories: ['identity', 'fact'],
    triggers: ['nombre', 'name', 'quien soy', 'who am i', 'email', 'correo', 'empresa', 'company', 'cargo', 'perfil', 'profile'],
    color: '#4A90D9',
    labelEs: 'Identidad',
    labelEn: 'Identity',
  },
  {
    id: 'business',
    categories: ['business'],
    triggers: ['negocio', 'business', 'marca', 'brand', 'producto', 'product', 'venta', 'sales', 'mercado', 'market', 'industria', 'industry', 'cliente', 'customer'],
    color: '#C4622D',
    labelEs: 'Negocio',
    labelEn: 'Business',
  },
  {
    id: 'preferences',
    categories: ['preference'],
    triggers: ['prefiero', 'prefer', 'gusta', 'like', 'estilo', 'style', 'tono', 'tone', 'idioma', 'language', 'favorito', 'favorite'],
    color: '#2D4A3E',
    labelEs: 'Preferencias',
    labelEn: 'Preferences',
  },
  {
    id: 'goals',
    categories: ['goal'],
    triggers: ['objetivo', 'goal', 'meta', 'target', 'kpi', 'quiero lograr', 'plan', 'crecer', 'growth', 'campaña', 'campaign'],
    color: '#D9A04A',
    labelEs: 'Objetivos',
    labelEn: 'Goals',
  },
  {
    id: 'projects',
    categories: ['skill', 'context'],
    triggers: ['proyecto', 'project', 'herramienta', 'tool', 'código', 'code', 'app', 'web', 'skill', 'tecnología', 'tech', 'plataforma', 'platform'],
    color: '#B0413E',
    labelEs: 'Proyectos y Herramientas',
    labelEn: 'Projects & Tools',
  },
  {
    id: 'relationships',
    categories: ['relationship'],
    triggers: ['socio', 'partner', 'competidor', 'competitor', 'equipo', 'team', 'contacto', 'contact', 'colaborador'],
    color: '#7C5CBF',
    labelEs: 'Relaciones',
    labelEn: 'Relationships',
  },
  {
    id: 'documents',
    categories: [], // se llena desde KnowledgeDocument, no desde SemanticMemory
    triggers: ['documento', 'document', 'archivo', 'file', 'pdf', 'reporte', 'report', 'manual', 'guía', 'guide', 'conocimiento', 'knowledge'],
    color: '#3E8E5A',
    labelEs: 'Documentos',
    labelEn: 'Documents',
  },
]

const FALLBACK_BUBBLE = 'projects' // categorías desconocidas caen aquí

export function bubbleForCategory(category: string): string {
  for (const b of BUBBLE_DEFINITIONS) {
    if (b.categories.includes(category)) return b.id
  }
  return FALLBACK_BUBBLE
}

// ============================================
// CLASIFICACIÓN DE CONSULTAS → BURBUJAS
// ============================================

/**
 * Decide qué burbujas son relevantes para una consulta.
 * Devuelve null si no hay señal clara (→ retrieval completo, sin filtro).
 * Esto es la optimización de tokens: solo se trae la burbuja necesaria.
 */
export function classifyQueryBubbles(query: string): string[] | null {
  const q = query.toLowerCase()
  const scores = new Map<string, number>()

  for (const bubble of BUBBLE_DEFINITIONS) {
    let score = 0
    for (const trigger of bubble.triggers) {
      if (q.includes(trigger)) score++
    }
    if (score > 0) scores.set(bubble.id, score)
  }

  if (scores.size === 0) return null

  // Burbujas con señal, ordenadas por score — máximo 3 para mantener foco
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => id)
}

/**
 * Convierte ids de burbujas a las categorías de SemanticMemory que contienen.
 * 'identity' y 'preferences' siempre se incluyen (contexto base barato).
 */
export function bubblesToCategories(bubbleIds: string[]): string[] {
  const ids = new Set([...bubbleIds, 'identity', 'preferences'])
  const categories = new Set<string>()
  for (const b of BUBBLE_DEFINITIONS) {
    if (ids.has(b.id)) b.categories.forEach(c => categories.add(c))
  }
  return [...categories]
}

// ============================================
// MAPA DE BURBUJAS (para visualización)
// ============================================

export interface BubbleItem {
  id: string
  label: string
  detail: string
  source: string // 'memory' | 'document' | 'entity'
  confidence: number
}

export interface BubbleNode {
  id: string
  labelEs: string
  labelEn: string
  color: string
  items: BubbleItem[]
}

export interface BubbleThread {
  from: string
  to: string
  /** término compartido que conecta las dos burbujas — la "ruta" del hilo */
  via: string
  strength: number
}

export interface BubblesMap {
  bubbles: BubbleNode[]
  threads: BubbleThread[]
  stats: { totalItems: number; totalBubbles: number; totalThreads: number }
}

/**
 * Construye el mapa mental completo del usuario:
 * burbujas pobladas + hilos entre burbujas que comparten términos.
 */
export async function getBubblesMap(userId: string): Promise<BubblesMap> {
  const [memories, documents] = await Promise.all([
    withDbRetry(() => prisma.semanticMemory.findMany({
      where: { userId },
      orderBy: { confidence: 'desc' },
      take: 200,
    })),
    withDbRetry(() => prisma.knowledgeDocument.findMany({
      where: { userId },
      select: { id: true, title: true, keywords: true, queryCount: true },
      orderBy: { queryCount: 'desc' },
      take: 50,
    })),
  ])

  // Inicializar burbujas vacías
  const nodes = new Map<string, BubbleNode>()
  for (const def of BUBBLE_DEFINITIONS) {
    nodes.set(def.id, {
      id: def.id,
      labelEs: def.labelEs,
      labelEn: def.labelEn,
      color: def.color,
      items: [],
    })
  }

  // Términos por burbuja (para calcular hilos)
  const bubbleTerms = new Map<string, Map<string, number>>()
  const addTerms = (bubbleId: string, text: string) => {
    if (!bubbleTerms.has(bubbleId)) bubbleTerms.set(bubbleId, new Map())
    const terms = bubbleTerms.get(bubbleId)!
    for (const token of tokenize(text)) {
      terms.set(token, (terms.get(token) || 0) + 1)
    }
  }

  // Poblar con memorias semánticas
  for (const m of memories) {
    const bubbleId = bubbleForCategory(m.category)
    nodes.get(bubbleId)!.items.push({
      id: m.id,
      label: m.predicate.replace(/_/g, ' '),
      detail: m.object,
      source: 'memory',
      confidence: m.confidence,
    })
    addTerms(bubbleId, `${m.predicate} ${m.object}`)
  }

  // Poblar burbuja de documentos
  for (const d of documents) {
    nodes.get('documents')!.items.push({
      id: d.id,
      label: d.title,
      detail: (d.keywords || []).slice(0, 5).join(', '),
      source: 'document',
      confidence: Math.min(0.5 + d.queryCount * 0.05, 1),
    })
    addTerms('documents', `${d.title} ${(d.keywords || []).join(' ')}`)
  }

  // Calcular hilos: burbujas que comparten términos
  const threads: BubbleThread[] = []
  const bubbleIds = [...bubbleTerms.keys()]
  for (let i = 0; i < bubbleIds.length; i++) {
    for (let j = i + 1; j < bubbleIds.length; j++) {
      const termsA = bubbleTerms.get(bubbleIds[i])!
      const termsB = bubbleTerms.get(bubbleIds[j])!
      let bestTerm = ''
      let shared = 0
      for (const [term, count] of termsA) {
        if (termsB.has(term)) {
          shared += count + termsB.get(term)!
          if (!bestTerm || count > (termsA.get(bestTerm) || 0)) bestTerm = term
        }
      }
      if (shared > 0) {
        threads.push({
          from: bubbleIds[i],
          to: bubbleIds[j],
          via: bestTerm,
          strength: Math.min(shared / 10, 1),
        })
      }
    }
  }

  const bubbles = [...nodes.values()]
  return {
    bubbles,
    threads,
    stats: {
      totalItems: bubbles.reduce((sum, b) => sum + b.items.length, 0),
      totalBubbles: bubbles.filter(b => b.items.length > 0).length,
      totalThreads: threads.length,
    },
  }
}
