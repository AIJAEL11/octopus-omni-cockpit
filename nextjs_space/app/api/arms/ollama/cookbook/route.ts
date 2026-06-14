import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { CookbookModel, OllamaArmStatus, OllamaPullRequest } from '@/lib/brazos-types'

export const dynamic = 'force-dynamic'

// ============================================
// COOKBOOK API — Model Catalog + Pull Management
// ============================================

// Curated model catalog with hardware requirements
const MODEL_CATALOG: CookbookModel[] = [
  // === LIGHTWEIGHT (4-8 GB RAM) ===
  {
    id: 'llama3.2-1b',
    name: 'Llama 3.2 1B',
    ollamaTag: 'llama3.2:1b',
    description: 'Ultra-lightweight Meta model. Perfect for quick tasks and low-resource machines.',
    category: 'chat',
    family: 'llama',
    parameterSize: '1B',
    minRamGB: 4,
    recommendedRamGB: 6,
    diskSizeGB: 1.3,
    quantization: 'Q4_K_M',
    highlights: ['Ultra fast', 'Runs on anything', 'Good for simple tasks'],
    tier: 'lightweight',
  },
  {
    id: 'llama3.2-3b',
    name: 'Llama 3.2 3B',
    ollamaTag: 'llama3.2:3b',
    description: 'Compact Meta model. Great balance of speed and quality for everyday use.',
    category: 'chat',
    family: 'llama',
    parameterSize: '3B',
    minRamGB: 4,
    recommendedRamGB: 8,
    diskSizeGB: 2.0,
    quantization: 'Q4_K_M',
    highlights: ['Fast responses', 'Low resource usage', 'Multilingual'],
    tier: 'lightweight',
  },
  {
    id: 'gemma3-1b',
    name: 'Gemma 3 1B',
    ollamaTag: 'gemma3:1b',
    description: 'Google\'s lightest model. Surprisingly capable for its size.',
    category: 'chat',
    family: 'gemma',
    parameterSize: '1B',
    minRamGB: 4,
    recommendedRamGB: 6,
    diskSizeGB: 1.0,
    quantization: 'Q4_K_M',
    highlights: ['Google quality', 'Tiny footprint', 'Good reasoning'],
    tier: 'lightweight',
  },
  {
    id: 'qwen3-1.7b',
    name: 'Qwen 3 1.7B',
    ollamaTag: 'qwen3:1.7b',
    description: 'Alibaba\'s compact model with hybrid thinking capabilities.',
    category: 'chat',
    family: 'qwen',
    parameterSize: '1.7B',
    minRamGB: 4,
    recommendedRamGB: 6,
    diskSizeGB: 1.4,
    quantization: 'Q4_K_M',
    highlights: ['Hybrid thinking', 'Multilingual', 'Fast'],
    tier: 'lightweight',
  },
  {
    id: 'nomic-embed',
    name: 'Nomic Embed Text',
    ollamaTag: 'nomic-embed-text',
    description: 'High-performance text embedding model for RAG and semantic search.',
    category: 'embedding',
    family: 'nomic',
    parameterSize: '137M',
    minRamGB: 4,
    recommendedRamGB: 4,
    diskSizeGB: 0.3,
    quantization: 'F16',
    highlights: ['Embeddings', 'RAG ready', 'Tiny size'],
    tier: 'lightweight',
  },
  // === STANDARD (8-16 GB RAM) ===
  {
    id: 'llama3.2-8b',
    name: 'Llama 3.1 8B',
    ollamaTag: 'llama3.1:8b',
    description: 'Meta\'s flagship 8B model. Excellent all-rounder for chat, writing, and reasoning.',
    category: 'chat',
    family: 'llama',
    parameterSize: '8B',
    minRamGB: 8,
    recommendedRamGB: 12,
    diskSizeGB: 4.7,
    quantization: 'Q4_K_M',
    highlights: ['Great all-rounder', 'Strong reasoning', 'Tool use support'],
    tier: 'standard',
  },
  {
    id: 'gemma3-4b',
    name: 'Gemma 3 4B',
    ollamaTag: 'gemma3:4b',
    description: 'Google\'s 4B model with vision capabilities. Can analyze images.',
    category: 'vision',
    family: 'gemma',
    parameterSize: '4B',
    minRamGB: 8,
    recommendedRamGB: 10,
    diskSizeGB: 3.3,
    quantization: 'Q4_K_M',
    highlights: ['Vision capable', 'Image analysis', 'Multimodal'],
    tier: 'standard',
  },
  {
    id: 'qwen3-8b',
    name: 'Qwen 3 8B',
    ollamaTag: 'qwen3:8b',
    description: 'Alibaba\'s 8B with dual thinking modes. Toggle deep reasoning on/off.',
    category: 'reasoning',
    family: 'qwen',
    parameterSize: '8B',
    minRamGB: 8,
    recommendedRamGB: 12,
    diskSizeGB: 4.9,
    quantization: 'Q4_K_M',
    highlights: ['Dual thinking modes', 'Strong reasoning', 'Multilingual'],
    tier: 'standard',
  },
  {
    id: 'deepseek-r1-8b',
    name: 'DeepSeek R1 8B',
    ollamaTag: 'deepseek-r1:8b',
    description: 'DeepSeek\'s reasoning specialist. Shows its chain of thought process.',
    category: 'reasoning',
    family: 'deepseek',
    parameterSize: '8B',
    minRamGB: 8,
    recommendedRamGB: 12,
    diskSizeGB: 4.9,
    quantization: 'Q4_K_M',
    highlights: ['Chain of thought', 'Math/logic expert', 'Transparent reasoning'],
    tier: 'standard',
  },
  {
    id: 'qwen-coder-7b',
    name: 'Qwen 2.5 Coder 7B',
    ollamaTag: 'qwen2.5-coder:7b',
    description: 'Purpose-built for coding. Excels at code generation, debugging, and review.',
    category: 'code',
    family: 'qwen',
    parameterSize: '7B',
    minRamGB: 8,
    recommendedRamGB: 12,
    diskSizeGB: 4.7,
    quantization: 'Q4_K_M',
    highlights: ['Code specialist', '92+ languages', 'Code completion'],
    tier: 'standard',
  },
  {
    id: 'mistral-7b',
    name: 'Mistral 7B',
    ollamaTag: 'mistral:7b',
    description: 'Mistral AI\'s efficient 7B model. Fast and capable with great English performance.',
    category: 'chat',
    family: 'mistral',
    parameterSize: '7B',
    minRamGB: 8,
    recommendedRamGB: 12,
    diskSizeGB: 4.1,
    quantization: 'Q4_K_M',
    highlights: ['Very fast', 'Efficient architecture', 'Strong English'],
    tier: 'standard',
  },
  {
    id: 'phi4-14b',
    name: 'Phi-4 14B',
    ollamaTag: 'phi4:14b',
    description: 'Microsoft\'s reasoning-focused model. Punches well above its weight class.',
    category: 'reasoning',
    family: 'phi',
    parameterSize: '14B',
    minRamGB: 12,
    recommendedRamGB: 16,
    diskSizeGB: 9.1,
    quantization: 'Q4_K_M',
    highlights: ['Strong reasoning', 'Math expert', 'Microsoft research'],
    tier: 'standard',
  },
  {
    id: 'gemma3-12b',
    name: 'Gemma 3 12B',
    ollamaTag: 'gemma3:12b',
    description: 'Google\'s 12B powerhouse with vision. Best multimodal model in its class.',
    category: 'vision',
    family: 'gemma',
    parameterSize: '12B',
    minRamGB: 12,
    recommendedRamGB: 16,
    diskSizeGB: 8.1,
    quantization: 'Q4_K_M',
    highlights: ['Vision + text', 'Image understanding', 'Strong coding'],
    tier: 'standard',
  },
  // === HEAVY (16-32 GB RAM) ===
  {
    id: 'qwen3-30b',
    name: 'Qwen 3 30B A3B',
    ollamaTag: 'qwen3:30b-a3b',
    description: 'MoE architecture — 30B total but only 3B active. Fast like a small model, smart like a big one.',
    category: 'chat',
    family: 'qwen',
    parameterSize: '30B (3B active)',
    minRamGB: 16,
    recommendedRamGB: 20,
    diskSizeGB: 18.5,
    quantization: 'Q4_K_M',
    highlights: ['MoE efficiency', 'Big brain, small footprint', 'Hybrid thinking'],
    tier: 'heavy',
  },
  {
    id: 'devstral-24b',
    name: 'Devstral 24B',
    ollamaTag: 'devstral:24b',
    description: 'Mistral\'s dedicated coding agent. Built for agentic software engineering.',
    category: 'code',
    family: 'mistral',
    parameterSize: '24B',
    minRamGB: 16,
    recommendedRamGB: 24,
    diskSizeGB: 14.8,
    quantization: 'Q4_K_M',
    highlights: ['Agentic coding', 'SWE-bench top tier', 'Code review'],
    tier: 'heavy',
  },
  {
    id: 'gemma3-27b',
    name: 'Gemma 3 27B',
    ollamaTag: 'gemma3:27b',
    description: 'Google\'s largest open model. Vision + text powerhouse approaching GPT-4 level.',
    category: 'vision',
    family: 'gemma',
    parameterSize: '27B',
    minRamGB: 20,
    recommendedRamGB: 32,
    diskSizeGB: 17.2,
    quantization: 'Q4_K_M',
    highlights: ['Near GPT-4 quality', 'Full multimodal', 'Excellent coding'],
    tier: 'heavy',
  },
  {
    id: 'qwen-coder-32b',
    name: 'Qwen 2.5 Coder 32B',
    ollamaTag: 'qwen2.5-coder:32b',
    description: 'Top-tier local coding model. Rivals GPT-4 for code generation.',
    category: 'code',
    family: 'qwen',
    parameterSize: '32B',
    minRamGB: 24,
    recommendedRamGB: 32,
    diskSizeGB: 19.8,
    quantization: 'Q4_K_M',
    highlights: ['GPT-4 level coding', 'Full-stack capable', 'Code review'],
    tier: 'heavy',
  },
  {
    id: 'deepseek-r1-32b',
    name: 'DeepSeek R1 32B',
    ollamaTag: 'deepseek-r1:32b',
    description: 'DeepSeek\'s mid-size reasoning model. Visible chain of thought with strong math.',
    category: 'reasoning',
    family: 'deepseek',
    parameterSize: '32B',
    minRamGB: 24,
    recommendedRamGB: 32,
    diskSizeGB: 19.8,
    quantization: 'Q4_K_M',
    highlights: ['Deep reasoning', 'Math proofs', 'Chain of thought'],
    tier: 'heavy',
  },
  // === EXTREME (32+ GB RAM) ===
  {
    id: 'llama3.1-70b',
    name: 'Llama 3.1 70B',
    ollamaTag: 'llama3.1:70b',
    description: 'Meta\'s 70B flagship. Among the best open-source models available.',
    category: 'chat',
    family: 'llama',
    parameterSize: '70B',
    minRamGB: 48,
    recommendedRamGB: 64,
    diskSizeGB: 40.0,
    quantization: 'Q4_K_M',
    highlights: ['Near frontier quality', 'Tool use', 'Multilingual'],
    tier: 'extreme',
  },
  {
    id: 'deepseek-r1-70b',
    name: 'DeepSeek R1 70B',
    ollamaTag: 'deepseek-r1:70b',
    description: 'Full DeepSeek R1 reasoning engine. PhD-level math and science.',
    category: 'reasoning',
    family: 'deepseek',
    parameterSize: '70B',
    minRamGB: 48,
    recommendedRamGB: 64,
    diskSizeGB: 43.0,
    quantization: 'Q4_K_M',
    highlights: ['PhD-level reasoning', 'Math olympiad', 'Full chain of thought'],
    tier: 'extreme',
  },
]

// Helper to get user's Ollama connection status
async function getOllamaStatus(userId: string): Promise<{ conn: any; status: OllamaArmStatus | null }> {
  const conn = await prisma.armConnection.findFirst({
    where: { userId, armType: 'ollama' },
  })
  if (!conn) return { conn: null, status: null }
  try {
    const status = JSON.parse(conn.credentials) as OllamaArmStatus
    return { conn, status }
  } catch {
    return { conn, status: null }
  }
}

// === GET — Returns model catalog + user hardware + installed models ===
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { status } = await getOllamaStatus(session.user.id)
    const installedModels = status?.models?.map(m => m.name) || []
    const hardware = status?.hardware || null
    const pullQueue = status?.pullQueue || []
    const os = status?.os || null

    // Annotate catalog models with install status and compatibility
    const ramGB = hardware?.totalRam ? hardware.totalRam / (1024 * 1024 * 1024) : null

    const catalog = MODEL_CATALOG.map(model => {
      const isInstalled = installedModels.some(name =>
        name === model.ollamaTag ||
        name.startsWith(model.ollamaTag.split(':')[0] + ':') ||
        name === model.ollamaTag.split(':')[0]
      )
      const activePull = pullQueue.find(p => p.model === model.ollamaTag && (p.status === 'pending' || p.status === 'downloading'))

      let compatibility: 'perfect' | 'possible' | 'heavy' | 'unknown' = 'unknown'
      if (ramGB !== null) {
        if (ramGB >= model.recommendedRamGB) compatibility = 'perfect'
        else if (ramGB >= model.minRamGB) compatibility = 'possible'
        else compatibility = 'heavy'
      }

      return {
        ...model,
        isInstalled,
        compatibility,
        activePull: activePull || null,
      }
    })

    return NextResponse.json({
      catalog,
      hardware,
      os,
      ramGB: ramGB ? Math.round(ramGB * 10) / 10 : null,
      installedCount: installedModels.length,
      bridgePresent: status?.bridgePresent || false,
      ollamaRunning: status?.running || false,
      pullQueue,
    })
  } catch (error) {
    console.error('[Cookbook GET] error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// === POST — Trigger model pull or update pull status ===
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { action } = body

    if (action === 'pull') {
      // Queue a model pull
      const { model } = body
      if (!model || typeof model !== 'string') {
        return NextResponse.json({ error: 'Model tag required' }, { status: 400 })
      }

      // Validate model is in catalog
      const catalogModel = MODEL_CATALOG.find(m => m.ollamaTag === model)
      if (!catalogModel) {
        return NextResponse.json({ error: 'Model not in catalog' }, { status: 400 })
      }

      const { conn, status } = await getOllamaStatus(session.user.id)
      if (!conn || !status) {
        return NextResponse.json({ error: 'Ollama connection not found. Bridge required.' }, { status: 400 })
      }

      if (!status.bridgePresent) {
        return NextResponse.json({ error: 'Bridge is not connected' }, { status: 400 })
      }

      // Check if already pulling this model
      const existingPull = (status.pullQueue || []).find(
        (p: OllamaPullRequest) => p.model === model && (p.status === 'pending' || p.status === 'downloading')
      )
      if (existingPull) {
        return NextResponse.json({ error: 'Already downloading this model', pullId: existingPull.id }, { status: 409 })
      }

      // Check if already installed
      const isInstalled = (status.models || []).some(
        (m: any) => m.name === model || m.name.startsWith(model.split(':')[0] + ':') || m.name === model.split(':')[0]
      )
      if (isInstalled) {
        return NextResponse.json({ error: 'Model already installed' }, { status: 409 })
      }

      // Create pull request
      const pullId = 'pull_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
      const pullRequest: OllamaPullRequest = {
        id: pullId,
        model,
        status: 'pending',
        startedAt: new Date().toISOString(),
      }

      const updatedQueue = [...(status.pullQueue || []), pullRequest]
      const updatedStatus = { ...status, pullQueue: updatedQueue }

      await prisma.armConnection.update({
        where: { id: conn.id },
        data: { credentials: JSON.stringify(updatedStatus) },
      })

      console.log(`[Cookbook] Pull queued: ${model} pullId=${pullId} user=${session.user.id}`)

      return NextResponse.json({
        success: true,
        pullId,
        model,
        message: `Pull queued for ${catalogModel.name}. Bridge will start downloading on next poll.`,
      })
    }

    if (action === 'cancel_pull') {
      const { pullId } = body
      if (!pullId) {
        return NextResponse.json({ error: 'pullId required' }, { status: 400 })
      }

      const { conn, status } = await getOllamaStatus(session.user.id)
      if (!conn || !status) {
        return NextResponse.json({ error: 'Connection not found' }, { status: 400 })
      }

      const updatedQueue = (status.pullQueue || []).map((p: OllamaPullRequest) =>
        p.id === pullId && (p.status === 'pending' || p.status === 'downloading')
          ? { ...p, status: 'failed' as const, error: 'Cancelled by user' }
          : p
      )
      const updatedStatus = { ...status, pullQueue: updatedQueue }

      await prisma.armConnection.update({
        where: { id: conn.id },
        data: { credentials: JSON.stringify(updatedStatus) },
      })

      return NextResponse.json({ success: true, message: 'Pull cancelled' })
    }

    if (action === 'clear_completed') {
      // Remove completed/failed pulls from queue
      const { conn, status } = await getOllamaStatus(session.user.id)
      if (!conn || !status) {
        return NextResponse.json({ error: 'Connection not found' }, { status: 400 })
      }

      const updatedQueue = (status.pullQueue || []).filter(
        (p: OllamaPullRequest) => p.status === 'pending' || p.status === 'downloading'
      )
      const updatedStatus = { ...status, pullQueue: updatedQueue }

      await prisma.armConnection.update({
        where: { id: conn.id },
        data: { credentials: JSON.stringify(updatedStatus) },
      })

      return NextResponse.json({ success: true, message: 'Cleared completed pulls' })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('[Cookbook POST] error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
