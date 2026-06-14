import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { chunkDocument, extractKeywords } from '@/lib/octopus-rag'
import { upsertSemanticVector, deleteVectors } from '@/lib/octopus-vectors'
import { extractTriplesFromText, processTriples } from '@/lib/octopus-knowledge-graph'

export const dynamic = 'force-dynamic'

// GET: Obtener documentos del Knowledge Base
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const searchQuery = searchParams.get('q')

    // Si hay query de búsqueda, hacer búsqueda inteligente
    if (searchQuery) {
      const documents = await prisma.knowledgeDocument.findMany({
        where: { userId: session.user.id },
        include: {
          chunks: {
            orderBy: { position: 'asc' },
          },
        },
      })

      // Buscar en chunks con scoring simple
      const queryLower = searchQuery.toLowerCase()
      const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2)

      const results = documents.map(doc => {
        const matchingChunks = doc.chunks
          .map(chunk => {
            const chunkLower = chunk.content.toLowerCase()
            let score = 0
            for (const word of queryWords) {
              if (chunkLower.includes(word)) score += 1
            }
            // Bonus for title match
            if (doc.title.toLowerCase().includes(queryLower)) score += 2
            // Bonus for keyword match
            for (const kw of doc.keywords) {
              if (queryWords.includes(kw.toLowerCase())) score += 0.5
            }
            return { ...chunk, score }
          })
          .filter(c => c.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3)

        const docScore = matchingChunks.reduce((sum, c) => sum + c.score, 0)
        return {
          id: doc.id,
          title: doc.title,
          contentType: doc.contentType,
          summary: doc.summary,
          keywords: doc.keywords,
          relevantChunks: matchingChunks.map(c => c.content),
          score: docScore,
        }
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)

      return NextResponse.json({ documents: results, query: searchQuery })
    }

    // Listado normal
    const documents = await prisma.knowledgeDocument.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        contentType: true,
        summary: true,
        keywords: true,
        queryCount: true,
        createdAt: true,
        _count: {
          select: { chunks: true }
        }
      }
    })

    return NextResponse.json({
      documents: documents.map(d => ({
        ...d,
        chunkCount: d._count.chunks,
      }))
    })
  } catch (error) {
    console.error('Error fetching knowledge base:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST: Añadir documento al Knowledge Base (con indexación vectorial y grafo)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { title, content, contentType = 'text' } = body

    if (!title || !content) {
      return NextResponse.json({ error: 'Título y contenido requeridos' }, { status: 400 })
    }

    // Extraer palabras clave
    const keywords = extractKeywords(content)

    // Dividir en chunks inteligentes
    const contentChunks = chunkDocument(content, 500)

    // Generar resumen extractivo (primeras oraciones significativas)
    const sentences = content.split(/[.!?]+/).filter((s: string) => s.trim().length > 20)
    const summary = sentences.slice(0, 3).join('. ').substring(0, 300) + (content.length > 300 ? '...' : '')

    // Crear documento con chunks
    const document = await prisma.knowledgeDocument.create({
      data: {
        userId: session.user.id,
        title,
        content,
        contentType,
        summary,
        keywords,
        chunks: {
          create: contentChunks.map((chunk, index) => ({
            content: chunk,
            position: index,
            relevanceScore: 0.5,
          }))
        }
      },
      include: {
        chunks: true,
      }
    })

    // === PHASE 2: Indexar chunks como vectores semánticos ===
    let vectorsIndexed = 0
    try {
      for (const chunk of document.chunks) {
        if (chunk.content.length > 20) {
          await upsertSemanticVector(
            session.user.id,
            'knowledge_chunk',
            chunk.id,
            `[${title}] ${chunk.content}`
          )
          vectorsIndexed++
        }
      }
      // También indexar el documento completo (título + resumen)
      await upsertSemanticVector(
        session.user.id,
        'knowledge_doc',
        document.id,
        `${title}: ${summary}`
      )
    } catch (error) {
      console.error('Error indexing KB vectors:', error)
    }

    // === PHASE 2: Extraer tripletas para el grafo de conocimiento ===
    let triplesExtracted = 0
    try {
      const triples = extractTriplesFromText(content)
      if (triples.length > 0) {
        await processTriples(session.user.id, triples, `kb:${document.id}`)
        triplesExtracted = triples.length
      }
    } catch (error) {
      console.error('Error extracting KB triples:', error)
    }

    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        title: document.title,
        chunkCount: document.chunks.length,
        keywords: document.keywords,
        vectorsIndexed,
        triplesExtracted,
      }
    })
  } catch (error) {
    console.error('Error adding to knowledge base:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE: Eliminar documento del Knowledge Base
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('id')

    if (!documentId) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    // Verificar propiedad
    const document = await prisma.knowledgeDocument.findFirst({
      where: {
        id: documentId,
        userId: session.user.id,
      }
    })

    if (!document) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
    }

    // Limpiar vectores semánticos de los chunks
    try {
      const chunks = await prisma.knowledgeChunk.findMany({
        where: { documentId },
        select: { id: true },
      })
      for (const chunk of chunks) {
        await deleteVectors(session.user.id, 'knowledge_chunk', chunk.id)
      }
      await deleteVectors(session.user.id, 'knowledge_doc', documentId)
    } catch (error) {
      console.error('Error cleaning up KB vectors:', error)
    }

    // Eliminar (cascada eliminará chunks)
    await prisma.knowledgeDocument.delete({
      where: { id: documentId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting from knowledge base:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
