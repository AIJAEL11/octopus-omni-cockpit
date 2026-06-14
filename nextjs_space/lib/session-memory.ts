// ═══════════════════════════════════════════════════════════════════════════════
// SESSION MEMORY ENGINE — Persistent cross-session context for Code Engine
// "Octopus remembers what you built yesterday."
// ═══════════════════════════════════════════════════════════════════════════════

import { prisma, withDbRetry } from '@/lib/prisma'
import { callLLM } from '@/lib/turbo-llm'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SessionMemoryData {
  id: string
  sessionId: string
  summary: string
  filesCreated: string[]
  decisions: string[]
  stackUsed: string[]
  userPreferences: string[]
  tags: string[]
  messageCount: number
  commandCount: number
  createdAt: Date
  sessionTitle: string
}

export interface MemoryContext {
  memories: SessionMemoryData[]
  injectedPrompt: string
  totalSessions: number
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SUMMARY_SYSTEM_PROMPT = `You are a session summarizer for Octopus Code Engine — an AI coding assistant.
Your job: extract a structured memory from a coding session conversation.

Output ONLY valid JSON with this exact structure (no markdown, no fences, no commentary):
{
  "summary": "2-3 sentence narrative of what was built/discussed",
  "filesCreated": ["list of file paths created or modified"],
  "decisions": ["key technical decisions made, e.g. 'chose React over Vue', 'used Tailwind for styling'"],
  "stackUsed": ["technologies/frameworks/libraries used, e.g. 'React', 'Node.js', 'Tailwind CSS'"],
  "userPreferences": ["noted user preferences, e.g. 'prefers dark mode', 'wants Spanish UI', 'likes minimal code'"],
  "tags": ["searchable keywords: project name, tech stack, features, patterns, e.g. 'dashboard', 'api', 'authentication'"]
}

Rules:
- Be concise but capture ALL important technical context
- Focus on WHAT was built, WHY decisions were made, and HOW (stack/approach)
- Tags should be lowercase, single words or short phrases
- If the session was just a question with no building, still summarize the topic discussed
- Maximum 8 items per array
- Write summary in the user's language (detect from messages)`

const RELEVANCE_SYSTEM_PROMPT = `You are a memory relevance scorer for Octopus Code Engine.
Given a user's new message and a list of past session memories, score each memory's relevance (0-100).

Output ONLY valid JSON array with scores:
[{"id": "memory_id", "score": 85, "reason": "brief reason"}]

Scoring criteria:
- 90-100: Directly continues the same project/task
- 70-89: Related technology or similar project type
- 40-69: Tangentially related (same domain/stack)
- 0-39: Unrelated

Only include memories with score >= 40.`

// ─── Generate Summary ────────────────────────────────────────────────────────

/**
 * Generate a structured memory summary for a completed code session.
 * Called when user starts a NEW session (summarizes the PREVIOUS one).
 */
export async function generateSessionMemory(sessionId: string, userId: string): Promise<SessionMemoryData | null> {
  try {
    // Check if already summarized
    const existing = await prisma.sessionMemory.findUnique({ where: { sessionId } })
    if (existing) {
      console.log(`[SessionMemory] Session ${sessionId} already summarized`)
      return parseMemoryRecord(existing)
    }

    // Fetch session with messages and commands
    const session = await prisma.codeSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        messages: {
          where: { status: 'completed', role: { not: 'system' } },
          orderBy: { createdAt: 'asc' },
          take: 30, // cap to avoid token explosion
          select: { role: true, content: true },
        },
        _count: { select: { messages: true, commands: true } },
      },
    })

    if (!session || session.messages.length < 2) {
      console.log(`[SessionMemory] Session ${sessionId} too short to summarize (${session?.messages.length || 0} msgs)`)
      return null
    }

    // Build conversation transcript for LLM
    const transcript = session.messages.map(m => {
      const label = m.role === 'user' ? 'USER' : 'ASSISTANT'
      // Truncate very long messages (code blocks) to save tokens
      const content = m.content.length > 2000 ? m.content.slice(0, 1800) + '\n[...truncated]' : m.content
      return `${label}: ${content}`
    }).join('\n\n')

    // Call LLM to generate structured summary
    const llmResponse = await callLLM(userId, [
      { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
      { role: 'user', content: `Session title: "${session.title}"\nModel used: ${session.model}\nMessages: ${session._count.messages}\nCommands executed: ${session._count.commands}\n\n--- CONVERSATION ---\n${transcript}` },
    ], { model: 'gpt-4.1-mini', maxTokens: 1000, temperature: 0.2 })

    // Parse LLM JSON response
    let parsed: {
      summary?: string
      filesCreated?: string[]
      decisions?: string[]
      stackUsed?: string[]
      userPreferences?: string[]
      tags?: string[]
    }
    try {
      const text = llmResponse?.choices?.[0]?.message?.content || ''
      // Strip markdown fences if present
      const clean = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '').trim()
      parsed = JSON.parse(clean)
    } catch (parseErr) {
      console.error(`[SessionMemory] Failed to parse LLM summary:`, parseErr)
      // Fallback: create minimal summary
      parsed = {
        summary: `Session "${session.title}" with ${session._count.messages} messages and ${session._count.commands} commands.`,
        filesCreated: [],
        decisions: [],
        stackUsed: [],
        userPreferences: [],
        tags: [session.title.toLowerCase().split(' ').slice(0, 3).join('-')],
      }
    }

    // Store in database
    const memory: any = await withDbRetry(() =>
      prisma.sessionMemory.create({
        data: {
          userId,
          sessionId,
          summary: parsed.summary || `Session: ${session.title}`,
          filesCreated: JSON.stringify(parsed.filesCreated || []),
          decisions: JSON.stringify(parsed.decisions || []),
          stackUsed: JSON.stringify(parsed.stackUsed || []),
          userPreferences: JSON.stringify(parsed.userPreferences || []),
          tags: JSON.stringify(parsed.tags || []),
          messageCount: session._count.messages,
          commandCount: session._count.commands,
        },
      })
    )

    // Mark session as summarized
    await prisma.codeSession.update({
      where: { id: sessionId },
      data: { summarized: true },
    }).catch(() => {})

    console.log(`[SessionMemory] Generated memory for session ${sessionId}: "${parsed.summary?.slice(0, 80)}..."`)
    return {
      ...parseMemoryRecord(memory),
      sessionTitle: session.title,
    }
  } catch (err) {
    console.error(`[SessionMemory] Error generating memory for session ${sessionId}:`, err)
    return null
  }
}

// ─── Retrieve Relevant Memories ──────────────────────────────────────────────

/**
 * Retrieve the most relevant session memories for a user's new message.
 * Strategy: Fetch recent memories → LLM scores relevance → return top matches.
 * For first message (empty), returns most recent memories as "continuing" context.
 */
export async function retrieveRelevantMemories(
  userId: string,
  userMessage: string,
  excludeSessionId?: string,
): Promise<MemoryContext> {
  try {
    // Fetch recent memories (last 20)
    const recentMemories = await prisma.sessionMemory.findMany({
      where: {
        userId,
        ...(excludeSessionId ? { sessionId: { not: excludeSessionId } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        session: { select: { title: true } },
      },
    })

    if (recentMemories.length === 0) {
      return { memories: [], injectedPrompt: '', totalSessions: 0 }
    }

    const allMemories = recentMemories.map(m => ({
      ...parseMemoryRecord(m),
      sessionTitle: m.session.title,
    }))

    // If no specific message, return the 3 most recent as general context
    if (!userMessage || userMessage.trim().length < 5) {
      const top = allMemories.slice(0, 3)
      return {
        memories: top,
        injectedPrompt: buildMemoryPrompt(top),
        totalSessions: recentMemories.length,
      }
    }

    // Quick keyword match first (fast path, no LLM call)
    const keywords = userMessage.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    const keywordMatched = allMemories.filter(m => {
      const searchable = [m.summary, ...m.tags, ...m.filesCreated, ...m.stackUsed, ...m.decisions, m.sessionTitle].join(' ').toLowerCase()
      return keywords.some(kw => searchable.includes(kw))
    })

    // If strong keyword matches, skip LLM scoring
    if (keywordMatched.length > 0 && keywordMatched.length <= 5) {
      const top = keywordMatched.slice(0, 3)
      console.log(`[SessionMemory] Keyword match: ${top.length} memories for "${userMessage.slice(0, 50)}..."`)
      return {
        memories: top,
        injectedPrompt: buildMemoryPrompt(top),
        totalSessions: recentMemories.length,
      }
    }

    // LLM relevance scoring for ambiguous cases
    try {
      const memorySummaries = allMemories.slice(0, 10).map(m => ({
        id: m.id,
        title: m.sessionTitle,
        summary: m.summary,
        tags: m.tags.join(', '),
        stack: m.stackUsed.join(', '),
        files: m.filesCreated.slice(0, 5).join(', '),
      }))

      const llmResponse = await callLLM(userId, [
        { role: 'system', content: RELEVANCE_SYSTEM_PROMPT },
        { role: 'user', content: `User's new message: "${userMessage}"\n\nPast sessions:\n${JSON.stringify(memorySummaries, null, 2)}` },
      ], { model: 'gpt-4.1-mini', maxTokens: 500, temperature: 0.1 })

      const text = llmResponse?.choices?.[0]?.message?.content || '[]'
      const clean = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '').trim()
      const scores: Array<{ id: string; score: number }> = JSON.parse(clean)

      const relevantIds = new Set(scores.filter(s => s.score >= 40).sort((a, b) => b.score - a.score).slice(0, 3).map(s => s.id))
      const top = allMemories.filter(m => relevantIds.has(m.id))

      if (top.length > 0) {
        console.log(`[SessionMemory] LLM scoring: ${top.length} relevant memories for "${userMessage.slice(0, 50)}..."`)
        return {
          memories: top,
          injectedPrompt: buildMemoryPrompt(top),
          totalSessions: recentMemories.length,
        }
      }
    } catch (llmErr) {
      console.warn(`[SessionMemory] LLM scoring failed, falling back to recency:`, llmErr)
    }

    // Fallback: return most recent
    const top = allMemories.slice(0, 2)
    return {
      memories: top,
      injectedPrompt: buildMemoryPrompt(top),
      totalSessions: recentMemories.length,
    }
  } catch (err) {
    console.error(`[SessionMemory] Error retrieving memories:`, err)
    return { memories: [], injectedPrompt: '', totalSessions: 0 }
  }
}

// ─── Summarize Unsummarized Sessions ─────────────────────────────────────────

/**
 * Background job: summarize the user's most recent unsummarized session.
 * Called lazily when user opens Code Engine or starts a new session.
 */
export async function summarizeRecentSessions(userId: string): Promise<number> {
  const unsummarized = await prisma.codeSession.findMany({
    where: {
      userId,
      summarized: false,
      messages: { some: { role: 'user', status: 'completed' } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 3, // summarize up to 3 at a time
    select: { id: true },
  })

  let count = 0
  for (const s of unsummarized) {
    const result = await generateSessionMemory(s.id, userId)
    if (result) count++
  }
  return count
}

// ─── Get All Memories for User ───────────────────────────────────────────────

/**
 * Fetch all session memories for a user (for the /memory endpoint).
 */
export async function getUserMemories(userId: string, limit = 20): Promise<SessionMemoryData[]> {
  const memories = await prisma.sessionMemory.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      session: { select: { title: true } },
    },
  })

  return memories.map(m => ({
    ...parseMemoryRecord(m),
    sessionTitle: m.session.title,
  }))
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseMemoryRecord(m: {
  id: string
  sessionId: string
  summary: string
  filesCreated: string
  decisions: string
  stackUsed: string
  userPreferences: string
  tags: string
  messageCount: number
  commandCount: number
  createdAt: Date
}): SessionMemoryData {
  return {
    id: m.id,
    sessionId: m.sessionId,
    summary: m.summary,
    filesCreated: safeJsonParse(m.filesCreated),
    decisions: safeJsonParse(m.decisions),
    stackUsed: safeJsonParse(m.stackUsed),
    userPreferences: safeJsonParse(m.userPreferences),
    tags: safeJsonParse(m.tags),
    messageCount: m.messageCount,
    commandCount: m.commandCount,
    createdAt: m.createdAt,
    sessionTitle: '',
  }
}

function safeJsonParse(json: string): string[] {
  try { return JSON.parse(json) } catch { return [] }
}

/**
 * Build the memory context block to inject into the LLM system prompt.
 */
function buildMemoryPrompt(memories: SessionMemoryData[]): string {
  if (memories.length === 0) return ''

  const blocks = memories.map((m, i) => {
    const parts = [`Session ${i + 1}: "${m.sessionTitle}"`]
    parts.push(`  Summary: ${m.summary}`)
    if (m.filesCreated.length > 0) parts.push(`  Files: ${m.filesCreated.join(', ')}`)
    if (m.decisions.length > 0) parts.push(`  Decisions: ${m.decisions.join('; ')}`)
    if (m.stackUsed.length > 0) parts.push(`  Stack: ${m.stackUsed.join(', ')}`)
    if (m.userPreferences.length > 0) parts.push(`  Preferences: ${m.userPreferences.join('; ')}`)
    return parts.join('\n')
  })

  return [
    '',
    '[SESSION MEMORY — auto-injected from previous sessions, do NOT repeat verbatim to user]',
    'You have context from the user\'s previous coding sessions. Use this to maintain continuity.',
    'If the user references past work, connect it to these memories naturally.',
    '',
    ...blocks,
  ].join('\n')
}
