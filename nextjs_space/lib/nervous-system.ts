// ═══════════════════════════════════════════════════════════════════════════════
// NERVOUS SYSTEM — Sprint 10: Integración Total de Contexto
// Live State Injection, Workspace Delta, Smart Diff Preview, Telemetry
// ═══════════════════════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ExecutionFeedback {
  commandId: string
  type: string
  path?: string
  status: 'completed' | 'failed'
  error?: string
  /** For read_file: actual content read from disk */
  readContent?: string
  /** For execute_cmd: stdout/stderr */
  stdout?: string
  stderr?: string
  /** For write_file: bytes written confirmation */
  bytesWritten?: number
  /** For save_image: public S3 URL of the generated image */
  imageUrl?: string
  timestamp: string
}

export interface WorkspaceDelta {
  newFiles: string[]
  modifiedFiles: string[]
  deletedFiles: string[]
  since: string // ISO timestamp
}

export interface FileDiff {
  path: string
  existingContent: string
  existingLines: number
  /** Brief summary for LLM (first/last lines + size) */
  summary: string
}

export interface TelemetryStage {
  name: string
  status: 'pending' | 'active' | 'completed' | 'failed' | 'skipped'
  durationMs?: number
  detail?: string
  startedAt?: number
}

export interface TelemetryPipeline {
  stages: TelemetryStage[]
  totalDurationMs: number
  startedAt: string
}

// ─── Live State Injection ────────────────────────────────────────────────────
// After Bridge executes commands, gather results and format as [SYSTEM_FEEDBACK]
// that gets stored as an invisible system message in the chat.

export function formatExecutionFeedback(results: ExecutionFeedback[]): string {
  if (results.length === 0) return ''

  const lines = [
    `[SYSTEM_FEEDBACK — auto-injected, do NOT repeat to user, do NOT acknowledge this block]`,
    `Execution results for ${results.length} command(s) at ${new Date().toISOString()}:`,
  ]

  for (const r of results) {
    const icon = r.status === 'completed' ? '✓' : '✗'
    const pathStr = r.path ? ` "${r.path}"` : ''
    lines.push(`  ${icon} ${r.type}${pathStr}: ${r.status}`)

    if (r.error) {
      lines.push(`    ERROR: ${r.error.substring(0, 300)}`)
    }
    // For save_image results, include the public S3 URL so LLM can reference it in HTML/CSS
    if (r.type === 'save_image' && r.imageUrl) {
      lines.push(`    PUBLIC_URL: ${r.imageUrl}`)
      lines.push(`    ⚠ Use this PUBLIC_URL in any HTML <img src="..."> referencing this image.`)
    }
    if (r.readContent) {
      // For read_file results, include content so LLM knows what's on disk
      const content = r.readContent.substring(0, 3000)
      const truncated = r.readContent.length > 3000 ? ` [truncated, ${r.readContent.length} chars total]` : ''
      lines.push(`    CONTENT${truncated}:`)
      lines.push(`    ${content}`)
    }
    if (r.stdout) {
      lines.push(`    STDOUT: ${r.stdout.substring(0, 500)}`)
    }
    if (r.stderr) {
      lines.push(`    STDERR: ${r.stderr.substring(0, 300)}`)
    }
  }

  lines.push(`[END_SYSTEM_FEEDBACK]`)
  return lines.join('\n')
}

// Gather execution results for commands in a given message
export async function gatherExecutionResults(
  prisma: PrismaClient,
  sessionId: string,
  messageId: string,
): Promise<ExecutionFeedback[]> {
  const cmds = await prisma.bridgeCommand.findMany({
    where: {
      sessionId,
      messageId,
      status: { in: ['completed', 'failed'] },
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, type: true, payload: true, status: true, result: true, error: true, updatedAt: true },
  })

  return cmds.map(cmd => {
    let payload: Record<string, unknown> = {}
    try { payload = JSON.parse(cmd.payload as string) } catch {}
    let result: Record<string, unknown> = {}
    if (cmd.result) {
      try { result = typeof cmd.result === 'string' ? JSON.parse(cmd.result) : cmd.result as Record<string, unknown> } catch {}
    }

    const fb: ExecutionFeedback = {
      commandId: cmd.id,
      type: cmd.type,
      path: payload.path as string | undefined,
      status: cmd.status as 'completed' | 'failed',
      error: cmd.error || undefined,
      timestamp: cmd.updatedAt.toISOString(),
    }

    // Extract read_file content from result
    if (cmd.type === 'read_file' && result.content) {
      fb.readContent = String(result.content)
    }
    // Extract execute_cmd stdout/stderr
    if (cmd.type === 'execute_cmd') {
      if (result.stdout) fb.stdout = String(result.stdout)
      if (result.stderr) fb.stderr = String(result.stderr)
    }

    return fb
  })
}

// ─── Workspace Delta ─────────────────────────────────────────────────────────
// Computes what changed in workspace since a given timestamp

export async function getWorkspaceDelta(
  prisma: PrismaClient,
  userId: string,
  since: Date,
): Promise<WorkspaceDelta> {
  const changes = await prisma.fileChangeEvent.findMany({
    where: {
      userId,
      detectedAt: { gte: since },
    },
    orderBy: { detectedAt: 'asc' },
    select: { eventType: true, filePath: true },
  })

  const newFiles: string[] = []
  const modifiedFiles: string[] = []
  const deletedFiles: string[] = []
  const seen = new Set<string>()

  // Process in reverse so latest event per file wins
  for (let i = changes.length - 1; i >= 0; i--) {
    const c = changes[i]
    if (seen.has(c.filePath)) continue
    seen.add(c.filePath)
    if (c.eventType === 'create') newFiles.push(c.filePath)
    else if (c.eventType === 'modify') modifiedFiles.push(c.filePath)
    else if (c.eventType === 'delete') deletedFiles.push(c.filePath)
  }

  return { newFiles, modifiedFiles, deletedFiles, since: since.toISOString() }
}

export function formatWorkspaceDelta(delta: WorkspaceDelta): string {
  const parts: string[] = []
  if (delta.newFiles.length === 0 && delta.modifiedFiles.length === 0 && delta.deletedFiles.length === 0) {
    return '' // No changes, skip injection
  }

  parts.push(`[WORKSPACE_DELTA — changes since ${delta.since}, auto-injected]`)
  if (delta.newFiles.length > 0) parts.push(`  NEW: ${delta.newFiles.slice(0, 20).join(', ')}`)
  if (delta.modifiedFiles.length > 0) parts.push(`  MODIFIED: ${delta.modifiedFiles.slice(0, 20).join(', ')}`)
  if (delta.deletedFiles.length > 0) parts.push(`  DELETED: ${delta.deletedFiles.slice(0, 20).join(', ')}`)
  parts.push(`[END_WORKSPACE_DELTA]`)
  return parts.join('\n')
}

// ─── Smart Diff Preview ──────────────────────────────────────────────────────
// Before write_file, reads existing file content from previous commands
// and generates a brief context summary for the LLM

export function buildFileDiffs(
  stagedPaths: string[],
  existingFileContents: Map<string, string>,
): FileDiff[] {
  const diffs: FileDiff[] = []

  for (const path of stagedPaths) {
    const existing = existingFileContents.get(path)
    if (!existing) continue // New file, no diff needed

    const lines = existing.split('\n')
    const lineCount = lines.length

    // Build summary: first 5 lines + last 3 lines + metrics
    const head = lines.slice(0, 5).map((l, i) => `  ${i + 1}| ${l}`).join('\n')
    const tail = lineCount > 8 ? lines.slice(-3).map((l, i) => `  ${lineCount - 2 + i}| ${l}`).join('\n') : ''
    const ellipsis = lineCount > 8 ? `  ... (${lineCount - 8} lines omitted) ...\n` : ''

    const summary = [
      `File: "${path}" (${lineCount} lines, ${existing.length} chars)`,
      `Current content preview:`,
      head,
      ellipsis,
      tail,
    ].filter(Boolean).join('\n')

    diffs.push({
      path,
      existingContent: existing,
      existingLines: lineCount,
      summary,
    })
  }

  return diffs
}

export function formatDiffsForLLM(diffs: FileDiff[]): string {
  if (diffs.length === 0) return ''

  const lines = [
    `[EXISTING_FILES — auto-injected, these files already exist in the workspace]`,
    `You are about to overwrite ${diffs.length} existing file(s). Review their current content:`,
    '',
  ]

  for (const d of diffs) {
    lines.push(d.summary)
    lines.push('')
  }

  lines.push(`IMPORTANT: Merge your changes carefully. Do not lose existing functionality.`)
  lines.push(`[END_EXISTING_FILES]`)
  return lines.join('\n')
}

// ─── Telemetry Pipeline ──────────────────────────────────────────────────────
// Track each stage of the Code Engine pipeline for the Nervous System Monitor

const PIPELINE_STAGES = [
  'llm',        // LLM generating response
  'parse',      // Parsing actions from response
  'validate',   // Code Intelligence validation
  'deps',       // Dependency resolution
  'snapshot',   // Phoenix Protocol: Pre-execution snapshot
  'commit',     // Transaction commit to DB
  'bridge',     // Bridge execution
  'verify',     // Phoenix Protocol: Post-execution integrity
  'feedback',   // Feedback injection
] as const

export type PipelineStageId = typeof PIPELINE_STAGES[number]

export function createTelemetryPipeline(): TelemetryPipeline {
  return {
    stages: PIPELINE_STAGES.map(name => ({
      name,
      status: 'pending' as const,
    })),
    totalDurationMs: 0,
    startedAt: new Date().toISOString(),
  }
}

export function updateTelemetryStage(
  pipeline: TelemetryPipeline,
  stageId: PipelineStageId,
  status: TelemetryStage['status'],
  detail?: string,
): TelemetryPipeline {
  const now = Date.now()
  const updated = { ...pipeline, stages: pipeline.stages.map(s => ({ ...s })) }
  const stage = updated.stages.find(s => s.name === stageId)
  if (stage) {
    if (status === 'active' && !stage.startedAt) {
      stage.startedAt = now
    }
    if ((status === 'completed' || status === 'failed') && stage.startedAt) {
      stage.durationMs = now - stage.startedAt
    }
    stage.status = status
    if (detail) stage.detail = detail
  }
  updated.totalDurationMs = now - new Date(updated.startedAt).getTime()
  return updated
}

export function formatTelemetryForSSE(pipeline: TelemetryPipeline): Record<string, unknown> {
  return {
    stages: pipeline.stages.map(s => ({
      name: s.name,
      status: s.status,
      durationMs: s.durationMs,
      detail: s.detail,
    })),
    totalDurationMs: pipeline.totalDurationMs,
  }
}
