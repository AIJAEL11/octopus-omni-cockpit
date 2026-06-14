import { callLLM } from '@/lib/turbo-llm'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, withDbRetry } from '@/lib/prisma'
import { 
  JARVIS_SYSTEM_PROMPT, 
  buildSystemContext, 
  parseJarvisResponse, 
  extractConsciousnessFromResponse,
  PreviousConsciousness 
} from '@/lib/jarvis-core'

export const dynamic = 'force-dynamic'

// Helper to safely parse JSON strings
function safeJsonParse(str: string | null | undefined, fallback: unknown[]) {
  if (!str) return fallback
  try { return JSON.parse(str) } catch { return fallback }
}

// POST - Analizar el sistema y obtener recomendaciones de JARVIS
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { agents, skills, mcps, recentActivities, metrics, projectHistory, userMessage } = body

    // Load previous consciousness state for accumulation
    let previousConsciousness: PreviousConsciousness | null = null
    try {
      const existing: any = await withDbRetry(() =>
        prisma.consciousnessState.findUnique({
          where: { userId: session.user.id },
        })
      )
      if (existing) {
        previousConsciousness = {
          overallLevel: existing.overallLevel,
          dimensions: {
            operativa: existing.operativa,
            datos: existing.datos,
            predictiva: existing.predictiva,
            relacional: existing.relacional,
          },
          analysisCount: existing.analysisCount,
          lastInsights: safeJsonParse(existing.lastInsights, []) as string[],
        }
      }
    } catch (e) {
      console.warn('[JARVIS] Could not load previous consciousness, continuing fresh:', e)
    }

    // Construir contexto del sistema (now includes previous consciousness)
    const systemContext = buildSystemContext({
      agents: agents || [],
      skills: skills || [],
      mcps: mcps || [],
      recentActivities: recentActivities || [],
      metrics: metrics || {},
      projectHistory: projectHistory || [],
      previousConsciousness,
    })

    // Construir mensajes para el LLM
    const messages = [
      { role: 'system', content: JARVIS_SYSTEM_PROMPT },
      { role: 'user', content: systemContext },
    ]

    // Si hay un mensaje específico del usuario, agregarlo
    if (userMessage) {
      messages.push({ role: 'user', content: `Solicitud del usuario: ${userMessage}` })
    }

    // Llamar al LLM via centralized helper (Turbo Mode + Abacus AI fallback)
    const data = await callLLM(session.user.id as string, messages, { model: 'gpt-4.1', temperature: 0.7, maxTokens: 8000 })
    const jarvisResponse = data.choices?.[0]?.message?.content || ''

    // Parsear la respuesta de JARVIS
    const analysis = parseJarvisResponse(jarvisResponse)

    if (!analysis) {
      return NextResponse.json({
        success: false,
        error: 'No se pudo analizar la respuesta de JARVIS',
        rawResponse: jarvisResponse,
      })
    }

    // Extract and persist consciousness (fire-and-forget, non-blocking)
    const consciousnessData = extractConsciousnessFromResponse(jarvisResponse)
    if (consciousnessData) {
      persistConsciousness(session.user.id, consciousnessData).catch(e =>
        console.error('[JARVIS] Failed to persist consciousness:', e)
      )
    }

    return NextResponse.json({
      success: true,
      analysis,
      rawResponse: jarvisResponse,
      // Include consciousness data in response for frontend
      consciousness: consciousnessData ? {
        overallLevel: consciousnessData.overallLevel,
        dimensions: consciousnessData.dimensions,
      } : null,
    })

  } catch (error) {
    console.error('JARVIS Error:', error)
    return NextResponse.json(
      { error: 'Error interno de JARVIS' },
      { status: 500 }
    )
  }
}

// Persist consciousness to DB with smooth blending
async function persistConsciousness(
  userId: string, 
  data: { overallLevel: number; dimensions: { operativa: number; datos: number; predictiva: number; relacional: number }; thought: string; insights: string[] }
) {
  const existing: any = await withDbRetry(() =>
    prisma.consciousnessState.findUnique({ where: { userId } })
  )

  const prevLog: { date: string; level: number; event: string }[] =
    safeJsonParse(existing?.evolutionLog, []) as { date: string; level: number; event: string }[]

  const prev = {
    overallLevel: existing?.overallLevel ?? 75,
    operativa: existing?.operativa ?? 50,
    datos: existing?.datos ?? 50,
    predictiva: existing?.predictiva ?? 50,
    relacional: existing?.relacional ?? 50,
  }

  // Smooth blend: 70% new evaluation, 30% accumulated history
  const blend = (newVal: number, oldVal: number) =>
    Math.round(Math.max(0, Math.min(100, newVal * 0.7 + oldVal * 0.3)))

  const final = {
    overallLevel: blend(data.overallLevel, prev.overallLevel),
    operativa: blend(data.dimensions.operativa, prev.operativa),
    datos: blend(data.dimensions.datos, prev.datos),
    predictiva: blend(data.dimensions.predictiva, prev.predictiva),
    relacional: blend(data.dimensions.relacional, prev.relacional),
  }

  const newEntry = {
    date: new Date().toISOString(),
    level: final.overallLevel,
    event: `Analysis #${(existing?.analysisCount ?? 0) + 1}`,
  }
  const updatedLog = [...prevLog, newEntry].slice(-50)

  await withDbRetry(() =>
    prisma.consciousnessState.upsert({
      where: { userId },
      create: {
        userId,
        ...final,
        analysisCount: 1,
        lastInsights: JSON.stringify(data.insights || []),
        lastThought: data.thought || null,
        evolutionLog: JSON.stringify(updatedLog),
      },
      update: {
        ...final,
        analysisCount: { increment: 1 },
        lastInsights: JSON.stringify(data.insights || []),
        lastThought: data.thought || null,
        evolutionLog: JSON.stringify(updatedLog),
      },
    })
  )
}

// GET - Obtener estado actual de JARVIS (now includes persistent consciousness)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Load persistent consciousness
    let consciousness: {
      overallLevel: number
      operativa: number
      datos: number
      predictiva: number
      relacional: number
      analysisCount: number
      lastThought: string | null
      evolutionLog: unknown[]
    } | null = null
    try {
      const state: any = await withDbRetry(() =>
        prisma.consciousnessState.findUnique({
          where: { userId: session.user.id },
        })
      )
      if (state) {
        consciousness = {
          overallLevel: state.overallLevel,
          operativa: state.operativa,
          datos: state.datos,
          predictiva: state.predictiva,
          relacional: state.relacional,
          analysisCount: state.analysisCount,
          lastThought: state.lastThought,
          evolutionLog: safeJsonParse(state.evolutionLog, []),
        }
      }
    } catch (e) {
      console.warn('[JARVIS] Could not load consciousness in GET:', e)
    }

    const jarvisState = {
      isActive: true,
      lastThought: consciousness?.lastThought || 'Analizando el ecosistema Octopus...',
      currentFocus: 'Optimización del sistema',
      consciousnessLevel: consciousness?.overallLevel ?? 75,
      systemHealth: 'good',
      version: '2.0.0',
      // New persistent consciousness data
      consciousness: consciousness ? {
        overallLevel: consciousness.overallLevel,
        operativa: consciousness.operativa,
        datos: consciousness.datos,
        predictiva: consciousness.predictiva,
        relacional: consciousness.relacional,
        analysisCount: consciousness.analysisCount,
        evolutionLog: consciousness.evolutionLog,
      } : null,
    }

    return NextResponse.json(jarvisState)

  } catch (error) {
    console.error('JARVIS Status Error:', error)
    return NextResponse.json(
      { error: 'Error al obtener estado de JARVIS' },
      { status: 500 }
    )
  }
}
