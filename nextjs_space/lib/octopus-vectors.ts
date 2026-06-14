/**
 * OCTOPUS RAG 2.0 Phase 2 - Semantic Vector Search
 * 
 * Implementa búsqueda semántica basada en TF-IDF con cosine similarity
 * Sin dependencia de pgvector - todo en JavaScript
 */

import { prisma } from './prisma'

// ============================================
// TF-IDF VECTOR ENGINE
// ============================================

const STOP_WORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'en', 'con', 'por',
  'para', 'que', 'es', 'son', 'y', 'o', 'a', 'al', 'como', 'pero', 'si',
  'no', 'ser', 'estar', 'tiene', 'hacer', 'quiero', 'necesito', 'the', 'is',
  'are', 'and', 'or', 'to', 'of', 'in', 'for', 'on', 'with', 'this', 'that',
  'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'could', 'should', 'may', 'might', 'must', 'its', 'my',
  'your', 'his', 'her', 'our', 'their', 'me', 'him', 'them', 'i', 'you',
  'he', 'she', 'we', 'they', 'not', 'can', 'an', 'mi', 'tu', 'su', 'nos',
  'les', 'lo', 'se', 'te', 'muy', 'más', 'ya', 'hay', 'también', 'sin',
  'sobre', 'entre', 'cuando', 'todo', 'esta', 'así', 'porque', 'cada',
])

/**
 * Tokeniza y normaliza un texto
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-záéíóúñüa-z0-9\s.-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w))
}

/**
 * Genera bigrams para capturar frases compuestas
 */
function generateBigrams(tokens: string[]): string[] {
  const bigrams: string[] = []
  for (let i = 0; i < tokens.length - 1; i++) {
    bigrams.push(`${tokens[i]}_${tokens[i + 1]}`)
  }
  return bigrams
}

/**
 * Calcula Term Frequency (TF) de un texto
 */
export function computeTF(text: string): Record<string, number> {
  const tokens = tokenize(text)
  const bigrams = generateBigrams(tokens)
  const allTerms = [...tokens, ...bigrams]
  
  const tf: Record<string, number> = {}
  const totalTerms = allTerms.length || 1
  
  for (const term of allTerms) {
    tf[term] = (tf[term] || 0) + 1
  }
  
  // Normalizar por total de términos
  for (const term in tf) {
    tf[term] = tf[term] / totalTerms
  }
  
  return tf
}

/**
 * Calcula la norma de un vector
 */
export function vectorNorm(vector: Record<string, number>): number {
  let sum = 0
  for (const key in vector) {
    sum += vector[key] * vector[key]
  }
  return Math.sqrt(sum)
}

/**
 * Calcula cosine similarity entre dos vectores TF
 */
export function cosineSimilarity(
  vecA: Record<string, number>,
  normA: number,
  vecB: Record<string, number>,
  normB: number
): number {
  if (normA === 0 || normB === 0) return 0
  
  let dotProduct = 0
  // Iterate over the smaller vector for efficiency
  const [smaller, larger] = Object.keys(vecA).length <= Object.keys(vecB).length
    ? [vecA, vecB]
    : [vecB, vecA]
  
  for (const key in smaller) {
    if (key in larger) {
      dotProduct += smaller[key] * larger[key]
    }
  }
  
  return dotProduct / (normA * normB)
}

// ============================================
// VECTOR STORAGE & RETRIEVAL
// ============================================

/**
 * Crea o actualiza un vector semántico en la base de datos
 */
export async function upsertSemanticVector(
  userId: string,
  sourceType: string,
  sourceId: string,
  text: string
): Promise<void> {
  const vector = computeTF(text)
  const norm = vectorNorm(vector)
  
  await prisma.semanticVector.upsert({
    where: {
      id: await getVectorId(userId, sourceType, sourceId)
    },
    create: {
      userId,
      sourceType,
      sourceId,
      text,
      vector: JSON.stringify(vector),
      norm,
    },
    update: {
      text,
      vector: JSON.stringify(vector),
      norm,
      updatedAt: new Date(),
    },
  })
}

async function getVectorId(userId: string, sourceType: string, sourceId: string): Promise<string> {
  const existing = await prisma.semanticVector.findFirst({
    where: { userId, sourceType, sourceId },
    select: { id: true },
  })
  return existing?.id || 'nonexistent'
}

/**
 * Busca los vectores más similares a una consulta
 */
export async function semanticSearch(
  userId: string,
  query: string,
  options: {
    sourceTypes?: string[]
    limit?: number
    minSimilarity?: number
  } = {}
): Promise<{ sourceType: string; sourceId: string; text: string; similarity: number }[]> {
  const { sourceTypes, limit = 10, minSimilarity = 0.05 } = options
  
  const queryVector = computeTF(query)
  const queryNorm = vectorNorm(queryVector)
  
  if (queryNorm === 0) return []
  
  // Fetch all vectors for the user (filtered by source type if specified)
  const where: Record<string, unknown> = { userId }
  if (sourceTypes && sourceTypes.length > 0) {
    where.sourceType = { in: sourceTypes }
  }
  
  const vectors = await prisma.semanticVector.findMany({
    where,
    select: {
      sourceType: true,
      sourceId: true,
      text: true,
      vector: true,
      norm: true,
    },
  })
  
  // Calculate similarity for each vector
  const results = vectors
    .map(v => {
      const vec = JSON.parse(v.vector) as Record<string, number>
      const similarity = cosineSimilarity(queryVector, queryNorm, vec, v.norm)
      return {
        sourceType: v.sourceType,
        sourceId: v.sourceId,
        text: v.text,
        similarity,
      }
    })
    .filter(r => r.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
  
  return results
}

/**
 * Elimina vectores de una fuente
 */
export async function deleteVectors(
  userId: string,
  sourceType: string,
  sourceId?: string
): Promise<void> {
  const where: Record<string, unknown> = { userId, sourceType }
  if (sourceId) where.sourceId = sourceId
  
  await prisma.semanticVector.deleteMany({ where })
}
