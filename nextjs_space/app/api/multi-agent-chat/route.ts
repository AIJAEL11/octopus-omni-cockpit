import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, withDbRetry } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// ═══════════════════════════════════════════════════════════════
// MULTI-AGENT CHAT — Router + Parallel Agent Execution via Groq
// ═══════════════════════════════════════════════════════════════

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1'
const DEFAULT_GROQ_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'
const ROUTER_MODEL = 'llama-3.1-8b-instant' // Fast & cheap for routing

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface AgentInfo {
  id: string
  name: string
  systemPrompt: string
  model?: string
  temperature?: number
  icon?: string
}

// ── Decrypt API key (same as api-hub) ──
function decryptApiKey(encrypted: string): string {
  try {
    const decoded = Buffer.from(encrypted, 'base64').toString('utf-8')
    const salt = process.env.NEXTAUTH_SECRET || 'octopus-salt'
    return decoded.replace(`${salt}:`, '')
  } catch {
    return encrypted
  }
}

// ── Get user's Groq API key ──
async function getGroqKey(userId: string): Promise<string | null> {
  const record = await withDbRetry(() =>
    prisma.apiKey.findFirst({
      where: { userId, serviceType: 'groq', status: 'active' },
      select: { apiKey: true },
    })
  )
  if (!record?.apiKey) return null
  return decryptApiKey(record.apiKey)
}

// ── Get user's OpenRouter API key as fallback ──
async function getOpenRouterKey(userId: string): Promise<string | null> {
  const record = await withDbRetry(() =>
    prisma.apiKey.findFirst({
      where: { userId, serviceType: 'turbo_openrouter', status: 'active' },
      select: { apiKey: true },
    })
  )
  if (!record?.apiKey) return null
  return decryptApiKey(record.apiKey)
}

// ── Call Groq (non-streaming, for router + agent responses) ──
async function callGroq(
  apiKey: string,
  messages: ChatMessage[],
  options: { model?: string; temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  const { model = DEFAULT_GROQ_MODEL, temperature = 0.7, maxTokens = 2048 } = options
  
  const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`Groq API error ${res.status}: ${err.substring(0, 200)}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

// ── Call OpenRouter as fallback ──
async function callOpenRouter(
  apiKey: string,
  messages: ChatMessage[],
  options: { model?: string; temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  const { model = 'meta-llama/llama-3.1-8b-instruct:free', temperature = 0.7, maxTokens = 2048 } = options
  
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://octopuskills.com',
      'X-Title': 'Octopus Multi-Agent Chat',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`OpenRouter API error ${res.status}: ${err.substring(0, 200)}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

// ── Call Abacus AI as last resort ──
async function callAbacus(
  messages: ChatMessage[],
  options: { model?: string; temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  const { model = 'gpt-4.1-mini', temperature = 0.7, maxTokens = 2048 } = options
  const apiKey = process.env.ABACUSAI_API_KEY
  if (!apiKey) throw new Error('No Abacus AI API key configured')

  const res = await fetch('https://apps.abacus.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`Abacus AI error ${res.status}: ${err.substring(0, 200)}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

// ── Smart LLM call with fallback chain ──
async function callLLMWithFallback(
  userId: string,
  messages: ChatMessage[],
  options: { model?: string; temperature?: number; maxTokens?: number; groqKey?: string | null; openRouterKey?: string | null } = {}
): Promise<{ content: string; engine: string }> {
  const { groqKey, openRouterKey, ...llmOpts } = options

  // 1. Groq (fastest, free)
  if (groqKey) {
    try {
      const content = await callGroq(groqKey, messages, llmOpts)
      return { content, engine: 'groq' }
    } catch (err) {
      console.warn('[Multi-Agent] Groq failed, trying fallback:', err)
    }
  }

  // 2. OpenRouter (user's key)
  if (openRouterKey) {
    try {
      const content = await callOpenRouter(openRouterKey, messages, llmOpts)
      return { content, engine: 'openrouter' }
    } catch (err) {
      console.warn('[Multi-Agent] OpenRouter failed, trying Abacus:', err)
    }
  }

  // 3. Abacus AI (platform key)
  try {
    const content = await callAbacus(messages, llmOpts)
    return { content, engine: 'abacus' }
  } catch (err) {
    console.error('[Multi-Agent] All engines failed:', err)
    throw new Error('No LLM engine available. Configure a Groq or OpenRouter key in API Hub.')
  }
}

// ── Router: decide which agents should respond ──
async function routeToAgents(
  userMessage: string,
  agents: AgentInfo[],
  options: { groqKey?: string | null; openRouterKey?: string | null; userId: string }
): Promise<string[]> {
  // If 3 or fewer agents, skip routing — all respond
  if (agents.length <= 3) return agents.map(a => a.id)

  const agentList = agents.map(a => `- ID: "${a.id}" | Name: "${a.name}" | Role: ${a.systemPrompt.substring(0, 120)}`).join('\n')

  const routerPrompt: ChatMessage[] = [
    {
      role: 'system',
      content: `You are a message router. Given a user message and a list of specialized agents, decide which agents should respond. Pick only the most relevant agents (2-4 max). Return ONLY a JSON array of agent IDs, nothing else. Example: ["id1", "id2"]`,
    },
    {
      role: 'user',
      content: `Agents:\n${agentList}\n\nUser message: "${userMessage}"\n\nWhich agents should respond? Return JSON array of IDs only.`,
    },
  ]

  try {
    const { content } = await callLLMWithFallback(options.userId, routerPrompt, {
      model: ROUTER_MODEL,
      temperature: 0.1,
      maxTokens: 200,
      groqKey: options.groqKey,
      openRouterKey: options.openRouterKey,
    })

    // Extract JSON array from response
    const match = content.match(/\[([^\]]+)\]/)
    if (match) {
      const ids = JSON.parse(`[${match[1]}]`) as string[]
      const validIds = ids.filter(id => agents.some(a => a.id === id))
      if (validIds.length > 0) return validIds
    }
  } catch (err) {
    console.warn('[Multi-Agent Router] Failed, sending to all agents:', err)
  }

  // Fallback: all agents respond
  return agents.map(a => a.id)
}

// ── POST: Send message to multi-agent chat ──
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const userId = session.user.id
    const body = await req.json()
    const { message, agents, history = [] } = body as {
      message: string
      agents: AgentInfo[]
      history: { agentId: string; agentName: string; role: string; content: string }[]
    }

    if (!message || !agents || agents.length === 0) {
      return NextResponse.json({ error: 'message y agents son requeridos' }, { status: 400 })
    }

    if (agents.length > 11) {
      return NextResponse.json({ error: 'Máximo 11 agentes permitidos' }, { status: 400 })
    }

    // Get API keys
    const [groqKey, openRouterKey] = await Promise.all([
      getGroqKey(userId),
      getOpenRouterKey(userId),
    ])

    // Route: decide which agents respond
    const selectedIds = await routeToAgents(message, agents, { groqKey, openRouterKey, userId })
    const selectedAgents = agents.filter(a => selectedIds.includes(a.id))

    console.log(`[Multi-Agent] User: ${userId} | Agents: ${selectedAgents.map(a => a.name).join(', ')} | Engine: groq=${!!groqKey} or=${!!openRouterKey}`)

    // Build history context per agent
    const buildAgentMessages = (agent: AgentInfo): ChatMessage[] => {
      const msgs: ChatMessage[] = [
        {
          role: 'system',
          content: `${agent.systemPrompt}\n\n[CONTEXT] You are in a multi-agent conversation. Other agents may also respond. Keep your response focused on your expertise. Be concise (2-4 paragraphs max). Your name is "${agent.name}".`,
        },
      ]

      // Add recent history (last 20 messages for context)
      const recentHistory = history.slice(-20)
      for (const h of recentHistory) {
        if (h.role === 'user') {
          msgs.push({ role: 'user', content: h.content })
        } else {
          // Other agent responses become assistant context
          msgs.push({ role: 'assistant', content: `[${h.agentName}]: ${h.content}` })
        }
      }

      // Current user message
      msgs.push({ role: 'user', content: message })
      return msgs
    }

    // Execute all agents in parallel
    const results = await Promise.allSettled(
      selectedAgents.map(async (agent) => {
        const agentMessages = buildAgentMessages(agent)
        const { content, engine } = await callLLMWithFallback(userId, agentMessages, {
          temperature: agent.temperature ?? 0.7,
          maxTokens: 2048,
          groqKey,
          openRouterKey,
        })
        return { agentId: agent.id, agentName: agent.name, content, engine }
      })
    )

    // Collect responses
    const responses = results.map((result, i) => {
      if (result.status === 'fulfilled') {
        return result.value
      }
      return {
        agentId: selectedAgents[i].id,
        agentName: selectedAgents[i].name,
        content: `⚠️ Error: ${(result.reason as Error)?.message || 'No pude procesar tu mensaje'}`,
        engine: 'error',
      }
    })

    return NextResponse.json({
      responses,
      routedTo: selectedIds,
      totalAgents: agents.length,
    })
  } catch (err) {
    console.error('[Multi-Agent Chat]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error en multi-agent chat' },
      { status: 500 }
    )
  }
}
