import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserMemories, saveSemanticMemories, SemanticFact } from '@/lib/octopus-rag'

export const dynamic = 'force-dynamic'

// GET: Obtener memorias semánticas del usuario
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const memories = await getUserMemories(session.user.id)

    // Agrupar por categoría
    const grouped = {
      facts: memories.filter(m => m.category === 'fact'),
      preferences: memories.filter(m => m.category === 'preference'),
      skills: memories.filter(m => m.category === 'skill'),
      context: memories.filter(m => m.category === 'context'),
      relationships: memories.filter(m => m.category === 'relationship'),
    }

    return NextResponse.json({
      memories,
      grouped,
      total: memories.length,
    })
  } catch (error) {
    console.error('Error fetching memories:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST: Añadir memoria manualmente
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { fact }: { fact: SemanticFact } = body

    if (!fact || !fact.subject || !fact.predicate || !fact.object) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    const saved = await saveSemanticMemories(session.user.id, [fact], 'manual')

    return NextResponse.json({
      success: true,
      saved,
    })
  } catch (error) {
    console.error('Error saving memory:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE: Eliminar una memoria
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const memoryId = searchParams.get('id')
    const clearAll = searchParams.get('clearAll') === 'true'

    if (clearAll) {
      // Eliminar todas las memorias del usuario
      await prisma.semanticMemory.deleteMany({
        where: { userId: session.user.id }
      })
      return NextResponse.json({ success: true, message: 'Todas las memorias eliminadas' })
    }

    if (!memoryId) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    // Verificar propiedad
    const memory = await prisma.semanticMemory.findFirst({
      where: {
        id: memoryId,
        userId: session.user.id,
      }
    })

    if (!memory) {
      return NextResponse.json({ error: 'Memoria no encontrada' }, { status: 404 })
    }

    await prisma.semanticMemory.delete({
      where: { id: memoryId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting memory:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
