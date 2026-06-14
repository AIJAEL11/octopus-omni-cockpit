/**
 * OCTOPUS RAG 2.0 Phase 2 - Knowledge Graph
 * 
 * Implementa un grafo de conocimiento para almacenar y traversar
 * relaciones entre entidades extraídas de conversaciones, documentos y brazos
 */

import { prisma } from './prisma'

// ============================================
// TIPOS
// ============================================

export type EntityType = 'person' | 'technology' | 'project' | 'company' | 'concept' | 'tool' | 'language' | 'framework'

export type RelationType = 
  | 'uses' | 'knows' | 'works_at' | 'works_on' 
  | 'created' | 'depends_on' | 'related_to' 
  | 'part_of' | 'likes' | 'dislikes' | 'learning' | 'collaborates_with'

export interface GraphNode {
  id: string
  name: string
  type: EntityType
  mentions: number
  properties?: Record<string, unknown>
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  predicate: RelationType
  weight: number
  sourceName?: string
  targetName?: string
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  stats: {
    totalNodes: number
    totalEdges: number
    topEntities: { name: string; mentions: number }[]
  }
}

export interface ExtractedTriple {
  subject: { name: string; type: EntityType }
  predicate: RelationType
  object: { name: string; type: EntityType }
  context?: string
}

// ============================================
// ENTITY MANAGEMENT
// ============================================

/**
 * Crea o actualiza una entidad en el grafo
 */
export async function upsertEntity(
  userId: string,
  name: string,
  entityType: EntityType,
  properties?: Record<string, unknown>
): Promise<string> {
  const normalizedName = name.toLowerCase().trim()
  
  try {
    const entity = await prisma.graphEntity.upsert({
      where: {
        userId_name_entityType: {
          userId,
          name: normalizedName,
          entityType,
        }
      },
      create: {
        userId,
        name: normalizedName,
        entityType,
        properties: properties ? JSON.stringify(properties) : null,
      },
      update: {
        mentions: { increment: 1 },
        lastSeen: new Date(),
        properties: properties ? JSON.stringify(properties) : undefined,
      },
    })
    return entity.id
  } catch (error) {
    console.error('Error upserting entity:', error)
    throw error
  }
}

/**
 * Crea una relación entre dos entidades
 */
export async function createRelation(
  userId: string,
  subjectId: string,
  predicate: RelationType,
  objectId: string,
  options: { weight?: number; source?: string; context?: string } = {}
): Promise<void> {
  const { weight = 1.0, source = 'conversation', context } = options
  
  // Check if relation already exists
  const existing = await prisma.graphRelation.findFirst({
    where: {
      userId,
      subjectId,
      predicate,
      objectId,
    },
  })
  
  if (existing) {
    // Strengthen existing relation
    await prisma.graphRelation.update({
      where: { id: existing.id },
      data: {
        weight: Math.min(existing.weight + 0.2, 5.0),
        updatedAt: new Date(),
      },
    })
  } else {
    await prisma.graphRelation.create({
      data: {
        userId,
        subjectId,
        predicate,
        objectId,
        weight,
        source,
        context,
      },
    })
  }
}

// ============================================
// TRIPLE EXTRACTION (LLM-powered)
// ============================================

/**
 * Extrae triples (sujeto-predicado-objeto) de un texto usando reglas
 * Más rápido que LLM, se usa como primera pasada
 */
export function extractTriplesFromText(text: string): ExtractedTriple[] {
  const triples: ExtractedTriple[] = []
  const lowerText = text.toLowerCase()
  
  // Patrones de relaciones
  const patterns: {
    regex: RegExp
    predicate: RelationType
    subjectType: EntityType
    objectType: EntityType
  }[] = [
    // Persona -> usa -> Tecnología
    { regex: /(?:yo )?(?:uso|utilizo|trabajo con|programo (?:en|con))\s+([\w.#+]+)/gi, predicate: 'uses', subjectType: 'person', objectType: 'technology' },
    // Persona -> trabaja en -> Empresa/Proyecto
    { regex: /(?:trabajo|laboro)\s+(?:en|para)\s+([\w\s]+?)(?:\.|,|$)/gi, predicate: 'works_at', subjectType: 'person', objectType: 'company' },
    // Persona -> trabaja en proyecto -> Proyecto
    { regex: /(?:mi proyecto|estoy (?:haciendo|trabajando en|construyendo|desarrollando))\s+(?:es\s+)?([\w\s]+?)(?:\.|,|$)/gi, predicate: 'works_on', subjectType: 'person', objectType: 'project' },
    // Persona -> le gusta -> Cosa
    { regex: /(?:me gusta|prefiero|amo|adoro|me encanta)\s+([\w\s]+?)(?:\.|,|$)/gi, predicate: 'likes', subjectType: 'person', objectType: 'concept' },
    // Persona -> no le gusta -> Cosa
    { regex: /(?:no me gusta|odio|detesto)\s+([\w\s]+?)(?:\.|,|$)/gi, predicate: 'dislikes', subjectType: 'person', objectType: 'concept' },
    // Persona -> conoce/sabe -> Tecnología
    { regex: /(?:sé|conozco|domino|manejo)\s+([\w\s.#+]+?)(?:\.|,|$)/gi, predicate: 'knows', subjectType: 'person', objectType: 'technology' },
    // Persona -> está aprendiendo -> Tecnología
    { regex: /(?:estoy aprendiendo|quiero aprender|me interesa aprender)\s+([\w\s.#+]+?)(?:\.|,|$)/gi, predicate: 'learning', subjectType: 'person', objectType: 'technology' },
    // Tecnología -> depende de -> Tecnología
    { regex: /([\w.#+]+)\s+(?:depende de|requiere|necesita|usa)\s+([\w.#+]+)/gi, predicate: 'depends_on', subjectType: 'technology', objectType: 'technology' },
    // Persona -> creó -> Proyecto
    { regex: /(?:yo )?(?:creé|hice|construí|desarrollé)\s+([\w\s]+?)(?:\.|,|$)/gi, predicate: 'created', subjectType: 'person', objectType: 'project' },
  ]
  
  // Detectar tecnologías y lenguajes mencionados
  const techKeywords: { name: string; type: EntityType }[] = [
    { name: 'python', type: 'language' }, { name: 'javascript', type: 'language' },
    { name: 'typescript', type: 'language' }, { name: 'java', type: 'language' },
    { name: 'rust', type: 'language' }, { name: 'go', type: 'language' },
    { name: 'c++', type: 'language' }, { name: 'c#', type: 'language' },
    { name: 'php', type: 'language' }, { name: 'ruby', type: 'language' },
    { name: 'swift', type: 'language' }, { name: 'kotlin', type: 'language' },
    { name: 'react', type: 'framework' }, { name: 'vue', type: 'framework' },
    { name: 'angular', type: 'framework' }, { name: 'next.js', type: 'framework' },
    { name: 'nextjs', type: 'framework' }, { name: 'node', type: 'framework' },
    { name: 'django', type: 'framework' }, { name: 'flask', type: 'framework' },
    { name: 'fastapi', type: 'framework' }, { name: 'express', type: 'framework' },
    { name: 'docker', type: 'tool' }, { name: 'kubernetes', type: 'tool' },
    { name: 'aws', type: 'tool' }, { name: 'gcp', type: 'tool' },
    { name: 'azure', type: 'tool' }, { name: 'git', type: 'tool' },
    { name: 'github', type: 'tool' }, { name: 'postgres', type: 'tool' },
    { name: 'postgresql', type: 'tool' }, { name: 'mongodb', type: 'tool' },
    { name: 'redis', type: 'tool' }, { name: 'prisma', type: 'tool' },
    { name: 'tailwind', type: 'framework' }, { name: 'figma', type: 'tool' },
  ]
  
  // Extract pattern-based triples
  for (const pattern of patterns) {
    const matches = text.matchAll(pattern.regex)
    for (const match of matches) {
      const objectName = match[1]?.trim()
      if (objectName && objectName.length > 2 && objectName.length < 60) {
        triples.push({
          subject: { name: 'user', type: pattern.subjectType },
          predicate: pattern.predicate,
          object: { name: objectName, type: pattern.objectType },
          context: text.substring(0, 200),
        })
      }
    }
  }
  
  // Extract technology mentions as implicit "mentions" relations
  for (const tech of techKeywords) {
    if (lowerText.includes(tech.name)) {
      // Only add if not already captured by patterns
      const alreadyCaptured = triples.some(
        t => t.object.name.toLowerCase() === tech.name
      )
      if (!alreadyCaptured) {
        triples.push({
          subject: { name: 'user', type: 'person' },
          predicate: 'knows',
          object: { name: tech.name, type: tech.type },
          context: `Mentioned ${tech.name} in conversation`,
        })
      }
    }
  }
  
  return triples
}

/**
 * Prompt para extracción de triples con LLM (para procesamiento más profundo)
 */
export const TRIPLE_EXTRACTION_PROMPT = `Analiza el siguiente texto y extrae triples de conocimiento (sujeto-relación-objeto).

Tipos de entidades válidos: person, technology, project, company, concept, tool, language, framework
Tipos de relaciones válidos: uses, knows, works_at, works_on, created, depends_on, related_to, part_of, likes, dislikes, learning, collaborates_with

Responde SOLO en JSON:
{
  "triples": [
    {
      "subject": {"name": "...", "type": "..."},
      "predicate": "...",
      "object": {"name": "...", "type": "..."}
    }
  ]
}

Si no hay triples relevantes: {"triples": []}

Texto:
`

// ============================================
// GRAPH PROCESSING
// ============================================

/**
 * Procesa triples y los guarda en el Knowledge Graph
 */
export async function processTriples(
  userId: string,
  triples: ExtractedTriple[],
  source: string = 'conversation'
): Promise<{ entitiesCreated: number; relationsCreated: number }> {
  let entitiesCreated = 0
  let relationsCreated = 0
  
  for (const triple of triples) {
    try {
      const subjectId = await upsertEntity(
        userId,
        triple.subject.name,
        triple.subject.type
      )
      entitiesCreated++
      
      const objectId = await upsertEntity(
        userId,
        triple.object.name,
        triple.object.type
      )
      entitiesCreated++
      
      await createRelation(
        userId,
        subjectId,
        triple.predicate,
        objectId,
        { source, context: triple.context }
      )
      relationsCreated++
    } catch (error) {
      console.error('Error processing triple:', error)
    }
  }
  
  return { entitiesCreated, relationsCreated }
}

// ============================================
// GRAPH QUERIES
// ============================================

/**
 * Obtiene el grafo completo de un usuario
 */
export async function getUserGraph(userId: string): Promise<GraphData> {
  const entities = await prisma.graphEntity.findMany({
    where: { userId },
    orderBy: { mentions: 'desc' },
  })
  
  const relations = await prisma.graphRelation.findMany({
    where: { userId },
    include: {
      subject: { select: { name: true } },
      object: { select: { name: true } },
    },
  })
  
  const nodes: GraphNode[] = entities.map(e => ({
    id: e.id,
    name: e.name,
    type: e.entityType as EntityType,
    mentions: e.mentions,
    properties: e.properties ? JSON.parse(e.properties) : undefined,
  }))
  
  const edges: GraphEdge[] = relations.map(r => ({
    id: r.id,
    source: r.subjectId,
    target: r.objectId,
    predicate: r.predicate as RelationType,
    weight: r.weight,
    sourceName: r.subject.name,
    targetName: r.object.name,
  }))
  
  const topEntities = entities
    .slice(0, 10)
    .map(e => ({ name: e.name, mentions: e.mentions }))
  
  return {
    nodes,
    edges,
    stats: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      topEntities,
    },
  }
}

/**
 * Traversa el grafo desde una entidad para encontrar conexiones relevantes
 */
export async function traverseGraph(
  userId: string,
  entityName: string,
  depth: number = 2
): Promise<{ entities: GraphNode[]; relations: GraphEdge[] }> {
  const visited = new Set<string>()
  const resultEntities: GraphNode[] = []
  const resultRelations: GraphEdge[] = []
  
  // Find starting entity
  const startEntity = await prisma.graphEntity.findFirst({
    where: {
      userId,
      name: { contains: entityName.toLowerCase(), mode: 'insensitive' },
    },
  })
  
  if (!startEntity) return { entities: [], relations: [] }
  
  // BFS traversal
  const queue: { id: string; currentDepth: number }[] = [
    { id: startEntity.id, currentDepth: 0 }
  ]
  
  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current.id) || current.currentDepth > depth) continue
    visited.add(current.id)
    
    // Get entity
    const entity = await prisma.graphEntity.findUnique({
      where: { id: current.id },
    })
    
    if (entity) {
      resultEntities.push({
        id: entity.id,
        name: entity.name,
        type: entity.entityType as EntityType,
        mentions: entity.mentions,
        properties: entity.properties ? JSON.parse(entity.properties) : undefined,
      })
    }
    
    if (current.currentDepth < depth) {
      // Get outgoing relations
      const outRelations = await prisma.graphRelation.findMany({
        where: { subjectId: current.id },
        include: {
          subject: { select: { name: true } },
          object: { select: { name: true } },
        },
      })
      
      for (const rel of outRelations) {
        resultRelations.push({
          id: rel.id,
          source: rel.subjectId,
          target: rel.objectId,
          predicate: rel.predicate as RelationType,
          weight: rel.weight,
          sourceName: rel.subject.name,
          targetName: rel.object.name,
        })
        if (!visited.has(rel.objectId)) {
          queue.push({ id: rel.objectId, currentDepth: current.currentDepth + 1 })
        }
      }
      
      // Get incoming relations
      const inRelations = await prisma.graphRelation.findMany({
        where: { objectId: current.id },
        include: {
          subject: { select: { name: true } },
          object: { select: { name: true } },
        },
      })
      
      for (const rel of inRelations) {
        resultRelations.push({
          id: rel.id,
          source: rel.subjectId,
          target: rel.objectId,
          predicate: rel.predicate as RelationType,
          weight: rel.weight,
          sourceName: rel.subject.name,
          targetName: rel.object.name,
        })
        if (!visited.has(rel.subjectId)) {
          queue.push({ id: rel.subjectId, currentDepth: current.currentDepth + 1 })
        }
      }
    }
  }
  
  return { entities: resultEntities, relations: resultRelations }
}

/**
 * Busca entidades relacionadas con un query
 */
export async function findRelatedEntities(
  userId: string,
  query: string,
  limit: number = 10
): Promise<GraphNode[]> {
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)
  
  if (queryWords.length === 0) return []
  
  const entities = await prisma.graphEntity.findMany({
    where: {
      userId,
      OR: queryWords.map(word => ({
        name: { contains: word, mode: 'insensitive' as const },
      })),
    },
    orderBy: [{ mentions: 'desc' }],
    take: limit,
  })
  
  return entities.map(e => ({
    id: e.id,
    name: e.name,
    type: e.entityType as EntityType,
    mentions: e.mentions,
    properties: e.properties ? JSON.parse(e.properties) : undefined,
  }))
}

/**
 * Genera un resumen del grafo de conocimiento para inyectar en el prompt
 */
export async function buildGraphContext(
  userId: string,
  query: string
): Promise<string> {
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)
  if (queryWords.length === 0) return ''
  
  // Find related entities
  const relatedEntities = await findRelatedEntities(userId, query, 5)
  
  if (relatedEntities.length === 0) return ''
  
  // Get relations for found entities
  const entityIds = relatedEntities.map(e => e.id)
  const relations = await prisma.graphRelation.findMany({
    where: {
      userId,
      OR: [
        { subjectId: { in: entityIds } },
        { objectId: { in: entityIds } },
      ],
    },
    include: {
      subject: { select: { name: true, entityType: true } },
      object: { select: { name: true, entityType: true } },
    },
    take: 20,
  })
  
  if (relations.length === 0) return ''
  
  const predicateMap: Record<string, string> = {
    'uses': 'usa',
    'knows': 'conoce',
    'works_at': 'trabaja en',
    'works_on': 'trabaja en',
    'created': 'creó',
    'depends_on': 'depende de',
    'related_to': 'relacionado con',
    'part_of': 'parte de',
    'likes': 'le gusta',
    'dislikes': 'no le gusta',
    'learning': 'está aprendiendo',
    'collaborates_with': 'colabora con',
  }
  
  let context = '[KNOWLEDGE GRAPH]\n'
  context += 'Relaciones conocidas del usuario:\n'
  
  const seen = new Set<string>()
  for (const rel of relations) {
    const key = `${rel.subject.name}-${rel.predicate}-${rel.object.name}`
    if (seen.has(key)) continue
    seen.add(key)
    
    const pred = predicateMap[rel.predicate] || rel.predicate
    context += `- ${rel.subject.name} ${pred} ${rel.object.name}\n`
  }
  
  return context
}
