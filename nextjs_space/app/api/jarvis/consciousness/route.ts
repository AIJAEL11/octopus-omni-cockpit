import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, withDbRetry } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET — Load the user's persistent consciousness state
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const state = await withDbRetry(() =>
      prisma.consciousnessState.findUnique({
        where: { userId: session.user.id },
      })
    ) as any

    if (!state) {
      // Return defaults — no record yet
      return NextResponse.json({
        overallLevel: 75,
        operativa: 50,
        datos: 50,
        predictiva: 50,
        relacional: 50,
        analysisCount: 0,
        lastInsights: [],
        lastThought: null,
        evolutionLog: [],
      })
    }

    return NextResponse.json({
      overallLevel: state.overallLevel,
      operativa: state.operativa,
      datos: state.datos,
      predictiva: state.predictiva,
      relacional: state.relacional,
      analysisCount: state.analysisCount,
      lastInsights: safeJsonParse(state.lastInsights, []),
      lastThought: state.lastThought,
      evolutionLog: safeJsonParse(state.evolutionLog, []),
    })
  } catch (error) {
    console.error('[Consciousness] GET error:', error)
    return NextResponse.json({ error: 'Error loading consciousness' }, { status: 500 })
  }
}

// POST — Update consciousness state after an analysis
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const {
      overallLevel,
      operativa,
      datos,
      predictiva,
      relacional,
      insights,
      thought,
    } = body

    // Clamp values 0-100
    const clamp = (v: number, fallback: number) => {
      const n = typeof v === 'number' ? v : fallback
      return Math.max(0, Math.min(100, n))
    }

    // Load existing state for evolution log
    const existing = await withDbRetry(() =>
      prisma.consciousnessState.findUnique({
        where: { userId: session.user.id },
      })
    ) as any

    const prevLog: { date: string; level: number; event: string }[] =
      safeJsonParse((existing as any)?.evolutionLog, [])

    // Smooth accumulation: blend previous state with new (70% new, 30% old) to prevent wild swings
    const prev = {
      overallLevel: existing?.overallLevel ?? 75,
      operativa: existing?.operativa ?? 50,
      datos: existing?.datos ?? 50,
      predictiva: existing?.predictiva ?? 50,
      relacional: existing?.relacional ?? 50,
    }

    const blend = (newVal: number, oldVal: number) =>
      Math.round(newVal * 0.7 + oldVal * 0.3)

    const finalOverall = clamp(blend(overallLevel ?? 75, prev.overallLevel), 75)
    const finalOps = clamp(blend(operativa ?? 50, prev.operativa), 50)
    const finalData = clamp(blend(datos ?? 50, prev.datos), 50)
    const finalPred = clamp(blend(predictiva ?? 50, prev.predictiva), 50)
    const finalRel = clamp(blend(relacional ?? 50, prev.relacional), 50)

    // Add to evolution log (keep last 50 entries)
    const newEntry = {
      date: new Date().toISOString(),
      level: finalOverall,
      event: `Analysis #${(existing?.analysisCount ?? 0) + 1}`,
    }
    const updatedLog = [...prevLog, newEntry].slice(-50)

    const updated: any = await withDbRetry(() =>
      prisma.consciousnessState.upsert({
        where: { userId: session.user.id },
        create: {
          userId: session.user.id,
          overallLevel: finalOverall,
          operativa: finalOps,
          datos: finalData,
          predictiva: finalPred,
          relacional: finalRel,
          analysisCount: 1,
          lastInsights: JSON.stringify(insights || []),
          lastThought: thought || null,
          evolutionLog: JSON.stringify(updatedLog),
        },
        update: {
          overallLevel: finalOverall,
          operativa: finalOps,
          datos: finalData,
          predictiva: finalPred,
          relacional: finalRel,
          analysisCount: { increment: 1 },
          lastInsights: JSON.stringify(insights || []),
          lastThought: thought || null,
          evolutionLog: JSON.stringify(updatedLog),
        },
      })
    )

    return NextResponse.json({
      success: true,
      overallLevel: updated.overallLevel,
      operativa: updated.operativa,
      datos: updated.datos,
      predictiva: updated.predictiva,
      relacional: updated.relacional,
      analysisCount: updated.analysisCount,
      evolutionLog: updatedLog,
    })
  } catch (error) {
    console.error('[Consciousness] POST error:', error)
    return NextResponse.json({ error: 'Error saving consciousness' }, { status: 500 })
  }
}

function safeJsonParse(str: string | null | undefined, fallback: unknown[]) {
  if (!str) return fallback
  try {
    return JSON.parse(str)
  } catch {
    return fallback
  }
}
