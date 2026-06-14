import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, withDbRetry } from '@/lib/prisma'
import { checkPlanGate } from '@/lib/plan-gate'

export const dynamic = 'force-dynamic'

// GET — list all agents for current user
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const agents = await withDbRetry(() =>
      prisma.customAgent.findMany({
        where: { userId: session.user.id },
        orderBy: { updatedAt: 'desc' },
      })
    )

    return NextResponse.json({ agents })
  } catch (err) {
    console.error('[Agent Factory GET]', err)
    return NextResponse.json({ error: 'Error al cargar agentes' }, { status: 500 })
  }
}

// POST — create a new agent
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const { name, description, model, category, systemPrompt, icon, temperature, isActive } = body

    if (!name || !systemPrompt) {
      return NextResponse.json({ error: 'name y systemPrompt son requeridos' }, { status: 400 })
    }

    // Server-side plan gate: enforce maxAgents limit
    const gate = await checkPlanGate(session.user.id, 'agents')
    if (!gate.allowed) {
      return NextResponse.json(
        {
          error: `Has alcanzado el límite de ${gate.limit} agentes de tu plan ${gate.planId}. Actualiza tu plan para crear más agentes.`,
          upgradeRequired: gate.upgradeRequired,
          current: gate.current,
          limit: gate.limit,
        },
        { status: 403 }
      )
    }

    const agent = await withDbRetry(() =>
      prisma.customAgent.create({
        data: {
          userId: session.user.id,
          name,
          description: description || '',
          model: model || 'gpt-4.1',
          category: category || 'custom',
          systemPrompt,
          icon: icon || '🤖',
          temperature: temperature ?? 0.7,
          isActive: isActive !== false,
        },
      })
    )

    return NextResponse.json({ agent })
  } catch (err) {
    console.error('[Agent Factory POST]', err)
    return NextResponse.json({ error: 'Error al crear agente' }, { status: 500 })
  }
}

// PATCH — update an agent
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'id requerido' }, { status: 400 })
    }

    // Verify ownership
    const existing = await withDbRetry(() =>
      prisma.customAgent.findFirst({
        where: { id, userId: session.user.id },
      })
    )

    if (!existing) {
      return NextResponse.json({ error: 'Agente no encontrado' }, { status: 404 })
    }

    const allowedFields = ['name', 'description', 'model', 'category', 'systemPrompt', 'icon', 'temperature', 'isActive']
    const data: Record<string, unknown> = {}
    for (const key of allowedFields) {
      if (updates[key] !== undefined) data[key] = updates[key]
    }

    const agent = await withDbRetry(() =>
      prisma.customAgent.update({
        where: { id },
        data,
      })
    )

    return NextResponse.json({ agent })
  } catch (err) {
    console.error('[Agent Factory PATCH]', err)
    return NextResponse.json({ error: 'Error al actualizar agente' }, { status: 500 })
  }
}

// DELETE — delete an agent
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id requerido' }, { status: 400 })
    }

    // Verify ownership
    const existing = await withDbRetry(() =>
      prisma.customAgent.findFirst({
        where: { id, userId: session.user.id },
      })
    )

    if (!existing) {
      return NextResponse.json({ error: 'Agente no encontrado' }, { status: 404 })
    }

    await withDbRetry(() =>
      prisma.customAgent.delete({ where: { id } })
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Agent Factory DELETE]', err)
    return NextResponse.json({ error: 'Error al eliminar agente' }, { status: 500 })
  }
}
