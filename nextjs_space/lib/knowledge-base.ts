// SISTEMA DE CONOCIMIENTO RAG 2.0 - MEMORIA INFINITA
// Permite que Octopus aprenda y mejore con cada proyecto

import { prisma } from './prisma'

// ============================================
// TIPOS
// ============================================

export type KnowledgeType = 'component' | 'pattern' | 'solution' | 'template' | 'conversation'

export interface KnowledgeContext {
  projectType?: string
  userIntent?: string
  tags?: string[]
  limit?: number
}

export interface RetrievedKnowledge {
  id: string
  type: KnowledgeType
  title: string
  content: string
  relevanceScore: number
  source?: string
}

// ============================================
// FUNCIONES DE BÚSQUEDA (RAG)
// ============================================

/**
 * Busca conocimiento relevante basado en el contexto del usuario
 * Esta es la función principal del RAG
 */
export async function retrieveRelevantKnowledge(
  query: string,
  context: KnowledgeContext = {}
): Promise<RetrievedKnowledge[]> {
  const { projectType, tags, limit = 5 } = context

  // Extraer palabras clave del query
  const keywords = extractKeywords(query)

  // Buscar en KnowledgeEntry
  const knowledgeEntries = await prisma.knowledgeEntry.findMany({
    where: {
      OR: [
        // Buscar por tags que coincidan
        { tags: { hasSome: keywords } },
        // Buscar por tipo si se especifica projectType
        ...(projectType ? [{ type: 'pattern', tags: { has: projectType } }] : []),
        // Buscar patrones exitosos
        { type: 'solution', successRate: { gte: 0.7 } },
      ],
    },
    orderBy: [
      { successRate: 'desc' },
      { useCount: 'desc' },
    ],
    take: limit,
  })

  // Buscar patrones de aprendizaje similares
  const learningPatterns = await prisma.learningPattern.findMany({
    where: {
      OR: [
        ...(projectType ? [{ projectType }] : []),
        { userIntent: { contains: keywords[0] || '', mode: 'insensitive' as const } },
      ],
      feedback: { gte: 0 }, // Solo patrones con feedback positivo
    },
    orderBy: [
      { feedback: 'desc' },
      { timesUsed: 'desc' },
    ],
    take: 3,
  })

  // Combinar y calcular relevancia
  const results: RetrievedKnowledge[] = [
    ...knowledgeEntries.map(entry => ({
      id: entry.id,
      type: entry.type as KnowledgeType,
      title: entry.title,
      content: entry.content,
      relevanceScore: calculateRelevance(query, entry.content, entry.successRate),
      source: entry.source || undefined,
    })),
    ...learningPatterns.map(pattern => ({
      id: pattern.id,
      type: 'pattern' as KnowledgeType,
      title: `Patrón: ${pattern.projectType}`,
      content: `Intent: ${pattern.userIntent}\nSolución: ${pattern.solution}\nSecciones: ${pattern.sections.join(', ')}`,
      relevanceScore: pattern.feedback > 0 ? 0.8 : 0.5,
      source: 'learning_pattern',
    })),
  ]

  // Ordenar por relevancia y retornar
  return results
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit)
}

/**
 * Busca proyectos similares exitosos
 */
export async function findSimilarProjects(
  projectType: string,
  description: string
): Promise<{ name: string; features: string[]; sections: string[] }[]> {
  const memories = await prisma.projectMemory.findMany({
    where: {
      project: {
        projectType,
        status: 'completed',
      },
      successScore: { gte: 1 },
    },
    include: {
      project: true,
    },
    orderBy: { successScore: 'desc' },
    take: 3,
  })

  return memories.map(m => ({
    name: m.project.name,
    features: m.keyFeatures,
    sections: [], // Se podría extraer del designSystem
  }))
}

// ============================================
// FUNCIONES DE APRENDIZAJE
// ============================================

/**
 * Guarda feedback del usuario sobre un mensaje
 */
export async function saveFeedback(
  messageId: string,
  rating: number,
  comment?: string
) {
  const feedback = await prisma.messageFeedback.upsert({
    where: { messageId },
    create: { messageId, rating, comment },
    update: { rating, comment },
  })

  // Si es feedback positivo, aprender de este patrón
  if (rating > 0) {
    await learnFromPositiveFeedback(messageId)
  }

  return feedback
}

/**
 * Aprende de un mensaje con feedback positivo
 */
async function learnFromPositiveFeedback(messageId: string) {
  const message = await prisma.chatMessage.findUnique({
    where: { id: messageId },
    include: {
      session: {
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 10,
          },
        },
      },
    },
  })

  if (!message || message.role !== 'assistant') return

  // Encontrar el mensaje del usuario que precedió a esta respuesta
  const messages = message.session.messages
  const messageIndex = messages.findIndex(m => m.id === messageId)
  const userMessage = messages[messageIndex - 1]

  if (!userMessage || userMessage.role !== 'user') return

  // Extraer keywords del contenido exitoso
  const keywords = extractKeywords(message.content)

  // Guardar como conocimiento
  await prisma.knowledgeEntry.create({
    data: {
      type: 'conversation',
      title: `Respuesta exitosa: ${keywords.slice(0, 3).join(', ')}`,
      content: message.content,
      tags: keywords,
      successRate: 1.0,
      source: 'user_feedback',
    },
  })
}

/**
 * Guarda un patrón de proyecto exitoso
 */
export async function saveProjectPattern(
  projectType: string,
  userIntent: string,
  solution: string,
  sections: string[]
) {
  // Buscar si ya existe un patrón similar
  const existing = await prisma.learningPattern.findFirst({
    where: {
      projectType,
      userIntent: { contains: extractKeywords(userIntent)[0] || '', mode: 'insensitive' },
    },
  })

  if (existing) {
    // Actualizar el existente
    await prisma.learningPattern.update({
      where: { id: existing.id },
      data: {
        timesUsed: { increment: 1 },
        solution,
        sections,
      },
    })
  } else {
    // Crear nuevo
    await prisma.learningPattern.create({
      data: {
        projectType,
        userIntent,
        solution,
        sections,
      },
    })
  }
}

/**
 * Crea memoria de un proyecto completado
 */
export async function createProjectMemory(
  projectId: string,
  summary: string,
  keyFeatures: string[],
  designSystem?: Record<string, any>
) {
  return prisma.projectMemory.upsert({
    where: { projectId },
    create: {
      projectId,
      summary,
      keyFeatures,
      designSystem: designSystem ? JSON.stringify(designSystem) : null,
    },
    update: {
      summary,
      keyFeatures,
      designSystem: designSystem ? JSON.stringify(designSystem) : null,
    },
  })
}

/**
 * Actualiza el score de éxito de un proyecto
 */
export async function updateProjectSuccessScore(projectId: string, delta: number) {
  return prisma.projectMemory.update({
    where: { projectId },
    data: {
      successScore: { increment: delta },
    },
  })
}

// ============================================
// FUNCIONES DE CONOCIMIENTO BASE
// ============================================

/**
 * Agrega conocimiento al sistema
 */
export async function addKnowledge(
  type: KnowledgeType,
  title: string,
  content: string,
  tags: string[],
  source?: string
) {
  return prisma.knowledgeEntry.create({
    data: {
      type,
      title,
      content,
      tags,
      source,
      successRate: 0.5, // Neutral inicialmente
    },
  })
}

/**
 * Incrementa el uso de un conocimiento
 */
export async function incrementKnowledgeUse(id: string) {
  return prisma.knowledgeEntry.update({
    where: { id },
    data: { useCount: { increment: 1 } },
  })
}

/**
 * Actualiza la tasa de éxito de un conocimiento
 */
export async function updateKnowledgeSuccess(id: string, wasSuccessful: boolean) {
  const entry = await prisma.knowledgeEntry.findUnique({ where: { id } })
  if (!entry) return

  // Calcular nueva tasa de éxito (promedio móvil)
  const newRate = entry.successRate * 0.8 + (wasSuccessful ? 0.2 : 0)

  return prisma.knowledgeEntry.update({
    where: { id },
    data: { successRate: newRate },
  })
}

// ============================================
// FUNCIONES AUXILIARES
// ============================================

/**
 * Extrae palabras clave de un texto
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
    'de', 'del', 'al', 'a', 'en', 'con', 'por', 'para',
    'que', 'y', 'o', 'pero', 'si', 'no', 'como', 'es',
    'son', 'ser', 'estar', 'tiene', 'hacer', 'quiero',
    'necesito', 'crear', 'hacer', 'the', 'a', 'an', 'is',
    'are', 'was', 'were', 'be', 'been', 'being', 'have',
    'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall',
  ])

  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remover puntuación
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .slice(0, 10) // Máximo 10 keywords
}

/**
 * Calcula relevancia simple entre query y contenido
 */
function calculateRelevance(query: string, content: string, baseScore: number): number {
  const queryWords = extractKeywords(query)
  const contentWords = new Set(extractKeywords(content))

  let matches = 0
  queryWords.forEach(word => {
    if (contentWords.has(word)) matches++
  })

  const matchRatio = queryWords.length > 0 ? matches / queryWords.length : 0
  return (matchRatio * 0.5) + (baseScore * 0.5)
}

/**
 * Formatea el conocimiento recuperado para incluir en el prompt del LLM
 */
export function formatKnowledgeForPrompt(knowledge: RetrievedKnowledge[]): string {
  if (knowledge.length === 0) return ''

  return `
=== CONOCIMIENTO RELEVANTE (de proyectos anteriores) ===
${knowledge.map((k, i) => `
[${i + 1}] ${k.title} (Relevancia: ${(k.relevanceScore * 100).toFixed(0)}%)
${k.content.slice(0, 500)}${k.content.length > 500 ? '...' : ''}
`).join('\n')}
=== FIN CONOCIMIENTO ===

Usa este conocimiento como referencia para mejorar tu respuesta.
`
}

// ============================================
// INICIALIZACIÓN DE CONOCIMIENTO BASE
// ============================================

/**
 * Inicializa el sistema con conocimiento base de los componentes cinematográficos
 */
export async function initializeBaseKnowledge() {
  const baseKnowledge = [
    {
      type: 'component' as const,
      title: 'Hero Cinematográfico',
      content: 'Hero de pantalla completa con gradiente Verde Musgo a Carbón, tipografía mixta (Sans + Serif itálica), animaciones escalonadas fade-up, textura de ruido sutil. Ideal para landing pages premium.',
      tags: ['hero', 'landing', 'cinematografico', 'premium', 'animaciones'],
    },
    {
      type: 'component' as const,
      title: 'Features Bento Grid',
      content: 'Layout estilo Bento con tarjetas de diferentes tamaños, animaciones hover con scale, indicadores de estado "ACTIVO" con pulso verde. Perfecto para mostrar características de SaaS.',
      tags: ['features', 'bento', 'grid', 'saas', 'premium'],
    },
    {
      type: 'pattern' as const,
      title: 'Paleta Cinematográfica',
      content: 'Verde Musgo #2E4036 (primario), Arcilla #CC5833 (acento), Crema #F2F0E9 (fondo), Carbón #1A1A1A (texto). Esta combinación transmite tecnología premium + boutique moderna.',
      tags: ['colores', 'paleta', 'diseño', 'premium', 'cinematografico'],
    },
    {
      type: 'pattern' as const,
      title: 'Animaciones Cinematográficas',
      content: 'Usar easing [0.22, 1, 0.36, 1] para transiciones elegantes. fadeUp con duration 0.6-0.8s, staggerChildren con delay 0.1s. Botones con efecto magnético (scale 1.02 en hover).',
      tags: ['animaciones', 'framer', 'motion', 'premium', 'transiciones'],
    },
    {
      type: 'solution' as const,
      title: 'Landing Page IA Startup',
      content: 'Combinación exitosa: navbar-floating + hero-cinematic + features-grid + stats-counter + cta-centered + footer-premium. Incluir indicadores "ACTIVO" y tipografía serif itálica para énfasis.',
      tags: ['landing', 'ia', 'startup', 'template', 'exitoso'],
    },
  ]

  for (const k of baseKnowledge) {
    const existing = await prisma.knowledgeEntry.findFirst({
      where: { title: k.title },
    })

    if (!existing) {
      await prisma.knowledgeEntry.create({
        data: {
          ...k,
          source: 'system',
          successRate: 0.8, // Conocimiento base tiene alta tasa de éxito
        },
      })
    }
  }
}
