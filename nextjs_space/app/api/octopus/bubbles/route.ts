import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getBubblesMap } from '@/lib/octopus-bubbles'

export const dynamic = 'force-dynamic'

/**
 * GET /api/octopus/bubbles — Mapa mental de burbujas del usuario
 * Devuelve burbujas pobladas (memorias + documentos) y los hilos que las conectan.
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const map = await getBubblesMap(session.user.id)
    return NextResponse.json(map)
  } catch (error) {
    console.error('Bubbles API Error:', error)
    return NextResponse.json({ error: 'Error obteniendo el mapa de burbujas' }, { status: 500 })
  }
}
