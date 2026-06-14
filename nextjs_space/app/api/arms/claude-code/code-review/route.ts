/**
 * AI Code Review API Route
 * POST /api/arms/claude-code/code-review
 * Body: { sessionId: string }
 * Collects all session files and sends them to LLM for review.
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { callLLM } from '@/lib/turbo-llm'

const CODE_REVIEW_SYSTEM = `You are a senior code reviewer. Analyze the provided code files and give a concise review.

Format your response as JSON:
{
  "score": 85,
  "summary": "One-line overall assessment",
  "issues": [
    { "severity": "critical|warning|info", "file": "filename", "line": "~line or section", "message": "Description" }
  ],
  "highlights": ["Good thing 1", "Good thing 2"],
  "suggestion": "Top priority improvement"
}

Rules:
- score: 0-100 (100 = perfect)
- Max 8 issues, prioritize critical ones
- Max 3 highlights
- Be concise — each message under 100 chars
- Focus on: bugs, security, performance, best practices
- If code is HTML/CSS/JS frontend: check accessibility, XSS, responsive design
- If code is backend/API: check auth, validation, error handling, SQL injection
- Respond ONLY with valid JSON, no markdown fences`

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { sessionId } = body

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId es requerido' }, { status: 400 })
    }

    // Collect session files
    const commands = await prisma.bridgeCommand.findMany({
      where: {
        sessionId,
        type: 'write_file',
        status: { in: ['completed', 'approved', 'executing'] },
      },
      orderBy: { createdAt: 'asc' },
    })

    if (commands.length === 0) {
      return NextResponse.json({ error: 'No hay archivos para revisar' }, { status: 400 })
    }

    // Build file map (last write wins)
    const fileMap = new Map<string, string>()
    for (const cmd of commands) {
      try {
        const payload = JSON.parse(cmd.payload as string)
        const path = (payload.path || payload.filePath || '').replace(/\\/g, '/').replace(/^\/+/, '')
        const content = payload.content || ''
        if (path && content) fileMap.set(path, content)
      } catch { /* skip malformed */ }
    }

    if (fileMap.size === 0) {
      return NextResponse.json({ error: 'No hay archivos válidos' }, { status: 400 })
    }

    // Build code summary for LLM (cap at ~60K chars to stay under token limits)
    let codeBlock = ''
    let totalChars = 0
    const MAX_CHARS = 60000
    const fileList: string[] = []

    for (const [path, content] of fileMap.entries()) {
      const entry = `\n--- FILE: ${path} ---\n${content}\n`
      if (totalChars + entry.length > MAX_CHARS) {
        fileList.push(`${path} (skipped — review limit)`)
        continue
      }
      codeBlock += entry
      totalChars += entry.length
      fileList.push(path)
    }

    console.log(`[CodeReview] Reviewing ${fileList.length} files for session ${sessionId}`)

    const result = await callLLM(session.user.id, [
      { role: 'system', content: CODE_REVIEW_SYSTEM },
      { role: 'user', content: `Review these ${fileList.length} files:\n${codeBlock}` },
    ], {
      temperature: 0.3,
      maxTokens: 2000,
    })

    const raw = result.choices?.[0]?.message?.content || ''

    // Parse JSON response
    try {
      // Strip markdown fences if present
      const cleaned = raw.replace(/^```json\n?/i, '').replace(/\n?```$/i, '').trim()
      const review = JSON.parse(cleaned)
      return NextResponse.json({
        success: true,
        review,
        filesReviewed: fileList.length,
        engine: result.engine || 'Abacus AI',
      })
    } catch {
      // LLM didn't return valid JSON — return raw text
      return NextResponse.json({
        success: true,
        review: {
          score: 70,
          summary: raw.slice(0, 200),
          issues: [],
          highlights: [],
          suggestion: 'Could not parse structured review',
        },
        filesReviewed: fileList.length,
        engine: result.engine || 'Abacus AI',
      })
    }
  } catch (err) {
    console.error('[CodeReview] Error:', err)
    return NextResponse.json({ error: 'Error en code review' }, { status: 500 })
  }
}
