/**
 * Embeddings Utility for ASK Octo AI RAG 2.0
 * Uses Abacus AI API for vector embeddings generation
 */

// Embedding dimension (OpenAI text-embedding-ada-002 compatible)
export const EMBEDDING_DIMENSION = 1536

/**
 * Generate embeddings for text using Abacus AI API
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await fetch(`${process.env.ABACUSAI_API_URL || 'https://api.abacus.ai'}/api/v1/embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: text.substring(0, 8000) // Limit input size
      })
    })

    if (!response.ok) {
      console.error('[Embeddings] API error:', response.status)
      return []
    }

    const data = await response.json()
    return data.data?.[0]?.embedding || []
  } catch (error) {
    console.error('[Embeddings] Error generating embedding:', error)
    return []
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  
  let dotProduct = 0
  let normA = 0
  let normB = 0
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB)
  return magnitude === 0 ? 0 : dotProduct / magnitude
}

/**
 * Find most similar documents using cosine similarity
 */
export function findSimilarDocuments<T extends { embedding?: number[] | null }>(
  queryEmbedding: number[],
  documents: T[],
  topK: number = 5,
  threshold: number = 0.3
): { document: T; similarity: number }[] {
  const scored = documents
    .filter(doc => doc.embedding && doc.embedding.length > 0)
    .map(doc => ({
      document: doc,
      similarity: cosineSimilarity(queryEmbedding, doc.embedding as number[])
    }))
    .filter(item => item.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK)
  
  return scored
}

/**
 * Prepare text for embedding (clean and normalize)
 */
export function prepareTextForEmbedding(title: string, content: string, keywords: string[] = []): string {
  const keywordStr = keywords.length > 0 ? `Keywords: ${keywords.join(', ')}` : ''
  return `${title}\n\n${content}\n\n${keywordStr}`.trim()
}
