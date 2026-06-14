import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { syncGitHubToGraph, syncGmailToGraph, getArmsSyncStatus, searchArmData } from '@/lib/octopus-arms-integration'

export const dynamic = 'force-dynamic'

/**
 * GET /api/octopus/arms - Estado de sincronización o búsqueda
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const armType = searchParams.get('armType')

    if (query) {
      const results = await searchArmData(session.user.id, query, armType || undefined)
      return NextResponse.json({ results })
    }

    const status = await getArmsSyncStatus(session.user.id)
    return NextResponse.json(status)
  } catch (error) {
    console.error('Arms API Error:', error)
    return NextResponse.json({ error: 'Error en Arms API' }, { status: 500 })
  }
}

/**
 * POST /api/octopus/arms - Sincronizar un brazo con el Knowledge Graph
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { armType } = body

    if (!armType || !['github', 'gmail'].includes(armType)) {
      return NextResponse.json({ error: 'armType inválido. Use: github, gmail' }, { status: 400 })
    }

    let result
    if (armType === 'github') {
      result = await syncGitHubToGraph(session.user.id)
    } else {
      result = await syncGmailToGraph(session.user.id)
    }

    return NextResponse.json({
      success: true,
      armType,
      ...result,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido'
    console.error('Arms Sync Error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
