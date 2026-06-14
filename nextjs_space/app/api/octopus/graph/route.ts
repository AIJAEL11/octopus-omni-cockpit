import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUserGraph, traverseGraph, findRelatedEntities, processTriples, extractTriplesFromText } from '@/lib/octopus-knowledge-graph'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/octopus/graph - Obtener el Knowledge Graph del usuario
 * Query params: ?entity=name (opcional, para traversar desde una entidad)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const entity = searchParams.get('entity')
    const query = searchParams.get('q')

    if (entity) {
      const result = await traverseGraph(session.user.id, entity, 2)
      return NextResponse.json(result)
    }

    if (query) {
      const entities = await findRelatedEntities(session.user.id, query, 15)
      return NextResponse.json({ entities })
    }

    const graph = await getUserGraph(session.user.id)
    return NextResponse.json(graph)
  } catch (error) {
    console.error('Graph API Error:', error)
    return NextResponse.json({ error: 'Error obteniendo el grafo' }, { status: 500 })
  }
}

/**
 * POST /api/octopus/graph - Agregar triples manualmente o desde texto
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { text, triples } = body

    if (text) {
      const extracted = extractTriplesFromText(text)
      if (extracted.length > 0) {
        const result = await processTriples(session.user.id, extracted, 'manual')
        return NextResponse.json({ success: true, ...result, triplesExtracted: extracted.length })
      }
      return NextResponse.json({ success: true, entitiesCreated: 0, relationsCreated: 0, triplesExtracted: 0 })
    }

    if (triples && Array.isArray(triples)) {
      const result = await processTriples(session.user.id, triples, 'manual')
      return NextResponse.json({ success: true, ...result })
    }

    return NextResponse.json({ error: 'Se requiere text o triples' }, { status: 400 })
  } catch (error) {
    console.error('Graph POST Error:', error)
    return NextResponse.json({ error: 'Error procesando triples' }, { status: 500 })
  }
}

/**
 * DELETE /api/octopus/graph - Eliminar entidad o todo el grafo
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const entityId = searchParams.get('entityId')
    const clearAll = searchParams.get('clearAll')

    if (clearAll === 'true') {
      await prisma.graphRelation.deleteMany({ where: { userId: session.user.id } })
      await prisma.graphEntity.deleteMany({ where: { userId: session.user.id } })
      return NextResponse.json({ success: true, message: 'Grafo eliminado completamente' })
    }

    if (entityId) {
      await prisma.graphRelation.deleteMany({
        where: {
          userId: session.user.id,
          OR: [{ subjectId: entityId }, { objectId: entityId }],
        },
      })
      await prisma.graphEntity.delete({ where: { id: entityId } })
      return NextResponse.json({ success: true, message: 'Entidad eliminada' })
    }

    return NextResponse.json({ error: 'Se requiere entityId o clearAll' }, { status: 400 })
  } catch (error) {
    console.error('Graph DELETE Error:', error)
    return NextResponse.json({ error: 'Error eliminando del grafo' }, { status: 500 })
  }
}
