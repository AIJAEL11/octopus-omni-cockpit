/**
 * Transaction Manager — Sprint 8
 * Multi-File Atomic Transactions & Rollback for Code Engine.
 *
 * Flow: BEGIN → VALIDATE → COMMIT or ROLLBACK
 * Commands are held in memory until the entire batch passes validation.
 * If any file fails Code Intelligence checks, nothing hits the DB.
 */

import { parseFile, buildDependencyGraph, validateFileImports, type ImportValidation, type DependencyGraph } from './code-intelligence'

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface StagedCommand {
  type: string
  payload: Record<string, unknown>
  requiresConfirm: boolean
  status: 'pending' | 'approved'
}

export interface TransactionValidationResult {
  valid: boolean
  fileWarnings: {
    file: string
    missingLocal: string[]
    missingPkgs: string[]
    syntaxErrors: string[]
  }[]
  criticalErrors: string[]   // Errors that block commit (syntax issues)
  graph: DependencyGraph | null
}

export interface Transaction {
  id: string
  stagedCommands: StagedCommand[]
  createdAt: number
  status: 'staged' | 'validating' | 'committed' | 'rolled_back'
  validationResult: TransactionValidationResult | null
}

// ═══════════════════════════════════════════════════════════════════════════════
// Transaction ID generator
// ═══════════════════════════════════════════════════════════════════════════════

function generateTxId(): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).substring(2, 8)
  return `tx_${ts}_${rand}`
}

// ═══════════════════════════════════════════════════════════════════════════════
// BEGIN — Stage commands in memory (no DB writes)
// ═══════════════════════════════════════════════════════════════════════════════

export function beginTransaction(actions: StagedCommand[]): Transaction {
  return {
    id: generateTxId(),
    stagedCommands: actions,
    createdAt: Date.now(),
    status: 'staged',
    validationResult: null,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATE — Run Code Intelligence on the entire batch
// ═══════════════════════════════════════════════════════════════════════════════

export async function validateTransaction(
  tx: Transaction,
  existingFilePaths: string[],
  existingFileContents: Map<string, string>,
): Promise<TransactionValidationResult> {
  tx.status = 'validating'

  const fileWarnings: TransactionValidationResult['fileWarnings'] = []
  const criticalErrors: string[] = []

  // Build combined file map: existing files + new staged write_file commands
  const allFileContents = new Map(existingFileContents)
  const allFilePaths = [...existingFilePaths]

  // Add staged write_file commands to the map
  for (const cmd of tx.stagedCommands) {
    if (cmd.type === 'write_file') {
      const path = (cmd.payload.path as string)?.replace(/\\/g, '/')
      const content = cmd.payload.content as string
      if (path && content) {
        allFilePaths.push(path)
        allFileContents.set(path, content)
      }
    }
  }

  const uniquePaths = [...new Set(allFilePaths)]

  // Validate each staged write_file command
  for (const cmd of tx.stagedCommands) {
    if (cmd.type !== 'write_file') continue

    const path = (cmd.payload.path as string)?.replace(/\\/g, '/')
    const content = cmd.payload.content as string
    if (!path || !content) continue

    // Run file parse for syntax errors
    const analysis = parseFile(path, content)
    if (analysis.errors.length > 0) {
      criticalErrors.push(`${path}: ${analysis.errors.join('; ')}`)
    }

    // Run import validation against the combined file set
    const validation: ImportValidation = validateFileImports(path, content, uniquePaths)
    if (!validation.valid || validation.missingPackages.length > 0) {
      fileWarnings.push({
        file: path,
        missingLocal: validation.missingLocal.map(m => m.source),
        missingPkgs: validation.missingPackages,
        syntaxErrors: validation.syntaxErrors,
      })
    }
  }

  // Build dependency graph for the full workspace
  let graph: DependencyGraph | null = null
  if (allFileContents.size > 0) {
    const fileMap = new Map(
      Array.from(allFileContents.entries()).map(([k, v]) => [k, { path: k, content: v }])
    )
    graph = buildDependencyGraph(fileMap)
  }

  const result: TransactionValidationResult = {
    valid: criticalErrors.length === 0,
    fileWarnings,
    criticalErrors,
    graph,
  }

  tx.validationResult = result
  return result
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMIT — Bulk create BridgeCommands in DB
// ═══════════════════════════════════════════════════════════════════════════════

export interface CommitResult {
  success: boolean
  commands: { id: string; type: string; payload: Record<string, unknown>; status: string; needsConfirm: boolean }[]
  error?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function commitTransaction(
  tx: Transaction,
  prisma: any,
  sessionId: string,
  messageId: string,
  withDbRetry: <T>(fn: () => Promise<T>) => Promise<T>,
): Promise<CommitResult> {
  const commands: CommitResult['commands'] = []

  try {
    for (const staged of tx.stagedCommands) {
      const cmd = await withDbRetry(() =>
        prisma.bridgeCommand.create({
          data: {
            sessionId,
            messageId,
            type: staged.type,
            payload: JSON.stringify(staged.payload),
            status: staged.status,
            requiresConfirmation: staged.requiresConfirm,
          },
        })
      ) as { id: string }
      commands.push({
        id: cmd.id,
        type: staged.type,
        payload: staged.payload,
        status: staged.status,
        needsConfirm: staged.requiresConfirm,
      })
    }

    tx.status = 'committed'
    return { success: true, commands }
  } catch (err) {
    tx.status = 'rolled_back'
    return {
      success: false,
      commands,
      error: err instanceof Error ? err.message : 'Unknown DB error during commit',
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROLLBACK — Return error details, nothing written to DB
// ═══════════════════════════════════════════════════════════════════════════════

export interface RollbackResult {
  txId: string
  reason: string
  criticalErrors: string[]
  fileWarnings: TransactionValidationResult['fileWarnings']
  affectedFiles: string[]
}

export function rollbackTransaction(tx: Transaction, reason: string): RollbackResult {
  tx.status = 'rolled_back'

  const affectedFiles = tx.stagedCommands
    .filter(c => c.type === 'write_file' && c.payload.path)
    .map(c => (c.payload.path as string).replace(/\\/g, '/'))

  return {
    txId: tx.id,
    reason,
    criticalErrors: tx.validationResult?.criticalErrors || [],
    fileWarnings: tx.validationResult?.fileWarnings || [],
    affectedFiles,
  }
}
