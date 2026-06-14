import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { 
  retrieveRelevantKnowledge, 
  saveFeedback, 
  addKnowledge,
  initializeBaseKnowledge,
  KnowledgeType 
} from '@/lib/knowledge-base'

export const dynamic = 'force-dynamic'

// GET - Recuperar conocimiento relevante (RAG)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const query = searchParams.get('query')
    const projectType = searchParams.get('projectType') || undefined
    const limit = parseInt(searchParams.get('limit') || '5')

    if (!query) {
      return NextResponse.json({ error: 'Query requerido' }, { status: 400 })
    }

    const knowledge = await retrieveRelevantKnowledge(query, {
      projectType,
      limit,
    })

    return NextResponse.json({ knowledge })
  } catch (error) {
    console.error('Error retrieving knowledge:', error)
    return NextResponse.json(
      { error: 'Error al recuperar conocimiento' },
      { status: 500 }
    )
  }
}

// POST - Agregar conocimiento o dar feedback
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const { action } = body

    switch (action) {
      case 'feedback': {
        const { messageId, rating, comment } = body
        if (!messageId || rating === undefined) {
          return NextResponse.json(
            { error: 'messageId y rating requeridos' },
            { status: 400 }
          )
        }
        const feedback = await saveFeedback(messageId, rating, comment)
        return NextResponse.json({ success: true, feedback })
      }

      case 'add_knowledge': {
        const { type, title, content, tags } = body
        if (!type || !title || !content) {
          return NextResponse.json(
            { error: 'type, title y content requeridos' },
            { status: 400 }
          )
        }
        const entry = await addKnowledge(
          type as KnowledgeType,
          title,
          content,
          tags || [],
          'user'
        )
        return NextResponse.json({ success: true, entry })
      }

      case 'initialize': {
        await initializeBaseKnowledge()
        return NextResponse.json({ success: true, message: 'Base de conocimiento inicializada' })
      }

      default:
        return NextResponse.json(
          { error: 'Acción no válida' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error in knowledge API:', error)
    return NextResponse.json(
      { error: 'Error en la API de conocimiento' },
      { status: 500 }
    )
  }
}
