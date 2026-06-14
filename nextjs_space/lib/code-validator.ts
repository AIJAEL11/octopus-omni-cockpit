// ═══════════════════════════════════════════════════════════════════════════════
// CODE VALIDATOR — Auto-Repair Loop (Fase 1)
// Detects syntax errors in generated code and uses the LLM to auto-repair them.
// Up to MAX_REPAIR_ATTEMPTS before giving up.
// ═══════════════════════════════════════════════════════════════════════════════

import { parseFile } from './code-intelligence'
import { callLLM } from './turbo-llm'
import type { StagedCommand } from './transaction-manager'

const MAX_REPAIR_ATTEMPTS = 3

export interface RepairResult {
  repaired: boolean
  attempts: number
  repairedCommands: StagedCommand[]
  /** Human-readable log of each attempt for telemetry/SSE */
  log: RepairAttemptLog[]
}

export interface RepairAttemptLog {
  attempt: number
  file: string
  errors: string[]
  fixed: boolean
}

/**
 * Attempt to auto-repair syntax errors in staged write_file commands.
 * Returns the repaired commands (or originals if nothing needed fixing / couldn't fix).
 */
export async function autoRepairSyntaxErrors(
  stagedCommands: StagedCommand[],
  criticalErrors: string[],
  userId: string | null,
): Promise<RepairResult> {
  const log: RepairAttemptLog[] = []
  let currentCommands = [...stagedCommands]

  // Parse which files have errors
  const brokenFiles = new Map<string, string[]>() // path → error messages
  for (const err of criticalErrors) {
    // Error format: "path/to/file.js: Unmatched braces: depth=3"
    const colonIdx = err.indexOf(': ')
    if (colonIdx > 0) {
      const filePath = err.substring(0, colonIdx)
      const errorMsg = err.substring(colonIdx + 2)
      const existing = brokenFiles.get(filePath) || []
      existing.push(errorMsg)
      brokenFiles.set(filePath, existing)
    }
  }

  if (brokenFiles.size === 0) {
    return { repaired: false, attempts: 0, repairedCommands: currentCommands, log }
  }

  for (let attempt = 1; attempt <= MAX_REPAIR_ATTEMPTS; attempt++) {
    let allFixed = true

    for (const [filePath, errors] of brokenFiles) {
      // Find the staged command for this file
      const cmdIdx = currentCommands.findIndex(
        c => c.type === 'write_file' && (c.payload.path as string)?.replace(/\\/g, '/') === filePath
      )
      if (cmdIdx === -1) continue

      const cmd = currentCommands[cmdIdx]
      const content = cmd.payload.content as string
      if (!content) continue

      // Determine file type for the repair prompt
      const ext = filePath.split('.').pop()?.toLowerCase() || ''
      const langLabel = ext === 'js' ? 'JavaScript' : ext === 'ts' ? 'TypeScript' : ext === 'css' ? 'CSS' : ext === 'html' ? 'HTML' : ext

      // Build the repair prompt
      const repairPrompt = buildRepairPrompt(filePath, content, errors, langLabel)

      try {
        const llmResponse = await callLLM(userId, [
          { role: 'system', content: REPAIR_SYSTEM_PROMPT },
          { role: 'user', content: repairPrompt },
        ], {
          model: 'claude-sonnet-4-20250514',
          temperature: 0.1,
          maxTokens: 8000,
        })

        const responseText = llmResponse?.choices?.[0]?.message?.content || ''

        // Extract the repaired code from the response
        const repairedContent = extractCode(responseText, ext)

        if (repairedContent && repairedContent.length > content.length * 0.5) {
          // Re-validate the repaired content
          const analysis = parseFile(filePath, repairedContent)
          if (analysis.errors.length === 0) {
            // Success — update the staged command
            currentCommands[cmdIdx] = {
              ...cmd,
              payload: { ...cmd.payload, content: repairedContent },
            }
            brokenFiles.delete(filePath)
            log.push({ attempt, file: filePath, errors, fixed: true })
            console.log(`[CodeValidator] ✅ Repaired ${filePath} on attempt ${attempt}`)
          } else {
            // Still broken — update errors for next attempt
            brokenFiles.set(filePath, analysis.errors)
            log.push({ attempt, file: filePath, errors: analysis.errors, fixed: false })
            allFixed = false
            console.log(`[CodeValidator] ⚠️ ${filePath} still has errors after attempt ${attempt}: ${analysis.errors.join('; ')}`)
          }
        } else {
          // LLM returned empty or suspiciously short response
          log.push({ attempt, file: filePath, errors: ['Repair response too short or empty'], fixed: false })
          allFixed = false
          console.log(`[CodeValidator] ❌ ${filePath} repair response too short on attempt ${attempt}`)
        }
      } catch (err) {
        console.error(`[CodeValidator] LLM repair error for ${filePath}:`, err)
        log.push({ attempt, file: filePath, errors: [`LLM error: ${(err as Error).message}`], fixed: false })
        allFixed = false
      }
    }

    if (allFixed || brokenFiles.size === 0) {
      return { repaired: true, attempts: attempt, repairedCommands: currentCommands, log }
    }
  }

  // Exhausted all attempts — some files still broken
  return {
    repaired: brokenFiles.size === 0,
    attempts: MAX_REPAIR_ATTEMPTS,
    repairedCommands: currentCommands,
    log,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROMPTS
// ═══════════════════════════════════════════════════════════════════════════════

const REPAIR_SYSTEM_PROMPT = `You are a code repair specialist. You receive code files with syntax errors and must fix them.

Rules:
1. ONLY fix syntax errors (unmatched braces, parentheses, missing semicolons, unclosed strings/templates)
2. Do NOT add new features or change logic
3. If code appears truncated (abruptly ends mid-function), complete the remaining functions with minimal placeholder logic and proper closing braces
4. Preserve ALL existing functionality — do not remove or rewrite working code
5. Return ONLY the complete fixed file content inside a code block
6. The output must be the COMPLETE file — do not use comments like "// rest of code..." or ellipsis`

function buildRepairPrompt(path: string, content: string, errors: string[], lang: string): string {
  return `Fix the syntax errors in this ${lang} file.

**File:** \`${path}\`

**Errors detected:**
${errors.map(e => `- ${e}`).join('\n')}

**Current code (with errors):**
\`\`\`${lang.toLowerCase()}
${content}
\`\`\`

Return the COMPLETE fixed file inside a single code block. Fix only the syntax issues — do not change logic or add features.`
}

// ═══════════════════════════════════════════════════════════════════════════════
// CODE EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════════

function extractCode(response: string, ext: string): string | null {
  if (!response) return null

  // Try to extract from code block
  const langAliases = {
    js: ['javascript', 'js'],
    ts: ['typescript', 'ts'],
    css: ['css'],
    html: ['html'],
  } as Record<string, string[]>

  const aliases = langAliases[ext] || [ext]

  // Try each alias
  for (const alias of aliases) {
    const regex = new RegExp('```' + alias + '\\s*\\n([\\s\\S]*?)\\n```', 'i')
    const match = response.match(regex)
    if (match?.[1]) return match[1].trim()
  }

  // Try generic code block
  const genericMatch = response.match(/```\s*\n([\s\S]*?)\n```/)
  if (genericMatch?.[1]) return genericMatch[1].trim()

  // If response looks like raw code (no markdown), return as-is
  if (!response.includes('```') && (response.includes('{') || response.includes('<'))) {
    return response.trim()
  }

  return null
}
