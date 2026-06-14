import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { OllamaArmStatus, OllamaModel, OllamaHardware, OllamaPullRequest } from '@/lib/brazos-types'

export const dynamic = 'force-dynamic'

// Helper: validate bridge token from ApiKey table (reuses existing hogar_bridge tokens)
async function validateBridgeToken(token: string) {
  if (!token) return null
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      apiKey: token,
      // Aceptar cualquier token que empiece por 'bridge' o sea de tipo hogar_bridge
      OR: [
        { serviceType: 'hogar_bridge' },
        { serviceType: 'octopus_bridge' },
      ],
    },
  })
  return apiKey?.userId || null
}

function emptyStatus(): OllamaArmStatus {
  return {
    installed: false,
    running: false,
    models: [],
    detectionMethod: 'none',
    bridgePresent: false,
  }
}

function parseStoredStatus(credentials: string): OllamaArmStatus {
  try {
    const parsed = JSON.parse(credentials)
    return {
      installed: !!parsed.installed,
      running: !!parsed.running,
      version: parsed.version,
      models: Array.isArray(parsed.models) ? parsed.models : [],
      detectionMethod: parsed.detectionMethod || 'none',
      lastSeenAt: parsed.lastSeenAt,
      bridgePresent: !!parsed.bridgePresent,
      os: parsed.os,
      hardware: parsed.hardware || undefined,
      pullQueue: Array.isArray(parsed.pullQueue) ? parsed.pullQueue : [],
    }
  } catch {
    return emptyStatus()
  }
}

// === GET — Frontend lee el estado actual de Ollama ===
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const conn = await prisma.armConnection.findFirst({
      where: { userId: session.user.id, armType: 'ollama' },
    })

    if (!conn) {
      return NextResponse.json({
        connected: false,
        status: emptyStatus(),
      })
    }

    const status = parseStoredStatus(conn.credentials)

    // Si lleva más de 2 minutos sin reportar, marcar bridge como ausente
    const lastSeen = status.lastSeenAt ? new Date(status.lastSeenAt).getTime() : 0
    const stale = Date.now() - lastSeen > 2 * 60 * 1000
    if (stale) {
      status.bridgePresent = false
      status.running = false
    }

    return NextResponse.json({
      connected: status.bridgePresent && (status.installed || status.running),
      status,
      armConnection: {
        id: conn.id,
        connectedAt: conn.connectedAt,
        updatedAt: conn.updatedAt,
      },
    })
  } catch (error) {
    console.error('[Ollama Status GET] error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// === POST — Bridge local reporta estado de Ollama ===
export async function POST(req: NextRequest) {
  try {
    let userId: string | null = null
    const token = req.headers.get('x-bridge-token') || req.nextUrl.searchParams.get('token') || ''

    if (token) {
      userId = await validateBridgeToken(token)
    } else {
      const session = await getServerSession(authOptions)
      userId = session?.user?.id || null
    }

    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))

    const installed = !!body.installed
    const running = !!body.running
    const version: string | undefined = typeof body.version === 'string' ? body.version : undefined
    const detectionMethod = ['http', 'filesystem', 'process', 'none'].includes(body.detectionMethod)
      ? body.detectionMethod
      : 'none'
    const os = ['mac', 'windows', 'linux'].includes(body.os) ? body.os : undefined

    // Parse hardware info from Bridge report
    let hardware: OllamaHardware | undefined = undefined
    if (body.hardware && typeof body.hardware === 'object') {
      hardware = {
        totalRam: typeof body.hardware.totalRam === 'number' ? body.hardware.totalRam : undefined,
        cpu: typeof body.hardware.cpu === 'string' ? body.hardware.cpu : undefined,
        cpuCores: typeof body.hardware.cpuCores === 'number' ? body.hardware.cpuCores : undefined,
        gpu: typeof body.hardware.gpu === 'string' ? body.hardware.gpu : undefined,
        gpuVram: typeof body.hardware.gpuVram === 'number' ? body.hardware.gpuVram : undefined,
      }
    }

    // Sanitize models array
    const rawModels: any[] = Array.isArray(body.models) ? body.models : []
    const models: OllamaModel[] = rawModels
      .filter((m: any) => m && typeof m.name === 'string' && m.name.length > 0)
      .slice(0, 200) // safety cap
      .map((m: any) => ({
        name: String(m.name),
        size: typeof m.size === 'number' ? m.size : undefined,
        modifiedAt: typeof m.modifiedAt === 'string' ? m.modifiedAt : undefined,
        family: typeof m.family === 'string' ? m.family : undefined,
        parameterSize: typeof m.parameterSize === 'string' ? m.parameterSize : undefined,
        quantization: typeof m.quantization === 'string' ? m.quantization : undefined,
      }))

    // Preserve existing pullQueue from stored status
    let existingPullQueue: OllamaPullRequest[] = []
    const existingConn = await prisma.armConnection.findFirst({
      where: { userId, armType: 'ollama' },
    })
    if (existingConn) {
      try {
        const prev = JSON.parse(existingConn.credentials)
        existingPullQueue = Array.isArray(prev.pullQueue) ? prev.pullQueue : []
      } catch {}
    }

    // Merge pull progress reported by Bridge
    if (Array.isArray(body.pullProgress)) {
      for (const prog of body.pullProgress) {
        const idx = existingPullQueue.findIndex((p: OllamaPullRequest) => p.id === prog.id)
        if (idx >= 0) {
          existingPullQueue[idx] = { ...existingPullQueue[idx], ...prog }
        }
      }
    }

    const status: OllamaArmStatus = {
      installed,
      running,
      version,
      models,
      detectionMethod,
      lastSeenAt: new Date().toISOString(),
      bridgePresent: true,
      os,
      hardware,
      pullQueue: existingPullQueue,
    }

    // Upsert ArmConnection con armType='ollama'
    const existing = existingConn

    // El status de la conexión es 'connected' si Ollama está instalado o corriendo
    const connStatus = installed || running ? 'connected' : 'disconnected'
    const credentials = JSON.stringify(status)

    let connection
    if (existing) {
      connection = await prisma.armConnection.update({
        where: { id: existing.id },
        data: {
          credentials,
          status: connStatus,
          connectedAt: connStatus === 'connected' ? (existing.connectedAt || new Date()) : existing.connectedAt,
          name: 'Ollama',
        },
      })
    } else {
      connection = await prisma.armConnection.create({
        data: {
          userId,
          armType: 'ollama',
          credentials,
          status: connStatus,
          connectedAt: connStatus === 'connected' ? new Date() : null,
          name: 'Ollama',
        },
      })
    }

    console.log(`[Ollama Status POST] user=${userId} installed=${installed} running=${running} models=${models.length} via=${detectionMethod} hw=${hardware ? 'yes' : 'no'}`)

    // Return pending pull commands so Bridge can execute them
    const pendingPulls = existingPullQueue.filter((p: OllamaPullRequest) => p.status === 'pending')

    return NextResponse.json({
      success: true,
      event: 'ollama_detected',
      connectionId: connection.id,
      status,
      commands: pendingPulls.length > 0 ? pendingPulls.map((p: OllamaPullRequest) => ({
        type: 'pull_model',
        id: p.id,
        model: p.model,
      })) : undefined,
    })
  } catch (error) {
    console.error('[Ollama Status POST] error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
