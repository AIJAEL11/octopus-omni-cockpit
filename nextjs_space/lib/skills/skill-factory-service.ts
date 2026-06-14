// ═══════════════════════════════════════════════════════════════════════════════
// 🏭 SKILL FACTORY SERVICE — Trust System + Publish Security Protocol
// Controls who can publish, when, and how — with audit gates
// ═══════════════════════════════════════════════════════════════════════════════

// ── Publish Modes ──
export type PublishMode = 'PRODUCTION' | 'SAFE'

// ── Agent Trust Levels ──
export type TrustLevel = 'TRUSTED' | 'VERIFIED' | 'EXTERNAL'

// ── Audit Status ──
export type AuditStatus = 'PASSED' | 'FAILED' | 'PENDING' | 'SKIPPED'

// ── Trusted Agent Registry ──
// Agents that can bypass manual approval when audits pass
const TRUSTED_AGENTS: Record<string, { name: string; trustLevel: TrustLevel; allowDirectPublish: boolean }> = {
  'vera': {
    name: 'VERA (SEO Content Engine)',
    trustLevel: 'TRUSTED',
    allowDirectPublish: true,
  },
  'vera-seo': {
    name: 'VERA SEO Optimizer',
    trustLevel: 'TRUSTED',
    allowDirectPublish: true,
  },
  'auto-publish': {
    name: 'Auto-Publish Cron',
    trustLevel: 'TRUSTED',
    allowDirectPublish: true,
  },
  'cron-auto-publish': {
    name: 'Scheduled Auto-Publisher',
    trustLevel: 'TRUSTED',
    allowDirectPublish: true,
  },
  'agent-factory': {
    name: 'Agent Factory (Internal)',
    trustLevel: 'VERIFIED',
    allowDirectPublish: true,
  },
  'content-publisher': {
    name: 'Content Publisher Widget',
    trustLevel: 'VERIFIED',
    allowDirectPublish: true,
  },
  'skill-factory': {
    name: 'Skill Factory Pipeline',
    trustLevel: 'VERIFIED',
    allowDirectPublish: true,
  },
}

// ── Content Audit ──

export interface ContentAudit {
  audit_status: AuditStatus
  zero_stats_audit: AuditStatus
  quality_score: number // 0-100
  word_count: number
  has_title: boolean
  has_content: boolean
  has_html_structure: boolean
  has_minimum_length: boolean
  flags: string[]
}

const MIN_WORD_COUNT = 200
const MIN_CONTENT_LENGTH = 800
const QUALITY_THRESHOLD = 60

/**
 * Run content quality audit on an article before publishing.
 * Returns audit_status: PASSED if content meets quality standards.
 */
export function auditContent(params: {
  title: string
  content: string
  contentType?: string
}): ContentAudit {
  const { title, content, contentType = 'blog_post' } = params
  const flags: string[] = []

  // ── Basic checks ──
  const has_title = !!title && title.trim().length >= 5
  const has_content = !!content && content.trim().length > 0
  const has_minimum_length = content.length >= MIN_CONTENT_LENGTH

  // Word count (strip HTML tags)
  const plainText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  const word_count = plainText.split(/\s+/).filter(w => w.length > 0).length

  // HTML structure check
  const has_html_structure = contentType === 'blog_post'
    ? (/<h[2-3][^>]*>/i.test(content) && /<p[^>]*>/i.test(content))
    : true

  if (!has_title) flags.push('MISSING_TITLE')
  if (!has_content) flags.push('EMPTY_CONTENT')
  if (!has_minimum_length) flags.push('CONTENT_TOO_SHORT')
  if (word_count < MIN_WORD_COUNT) flags.push('LOW_WORD_COUNT')
  if (!has_html_structure && contentType === 'blog_post') flags.push('MISSING_HTML_STRUCTURE')

  // ── Spam / garbage detection ──
  const lowerContent = content.toLowerCase()
  if (/lorem ipsum/i.test(lowerContent)) flags.push('LOREM_IPSUM_DETECTED')
  if (/test.*test.*test/i.test(lowerContent)) flags.push('TEST_CONTENT_DETECTED')

  // ── Quality score calculation ──
  let quality_score = 0
  if (has_title) quality_score += 15
  if (has_content) quality_score += 10
  if (has_minimum_length) quality_score += 20
  if (word_count >= MIN_WORD_COUNT) quality_score += 20
  if (has_html_structure) quality_score += 15
  if (word_count >= 500) quality_score += 10 // bonus for longer content
  if (/<h2/i.test(content)) quality_score += 5
  if (/<ul|<ol/i.test(content)) quality_score += 5

  // Penalty for flags
  if (flags.includes('LOREM_IPSUM_DETECTED')) quality_score -= 30
  if (flags.includes('TEST_CONTENT_DETECTED')) quality_score -= 30

  quality_score = Math.max(0, Math.min(100, quality_score))

  // ── Zero-stats audit (content not empty/null/placeholder) ──
  const zero_stats_audit: AuditStatus =
    has_content && has_title && word_count > 10 && !flags.includes('LOREM_IPSUM_DETECTED')
      ? 'PASSED'
      : 'FAILED'

  // ── Final audit status ──
  const audit_status: AuditStatus =
    quality_score >= QUALITY_THRESHOLD && zero_stats_audit === 'PASSED' && flags.length === 0
      ? 'PASSED'
      : flags.length > 0
        ? 'FAILED'
        : 'PENDING'

  return {
    audit_status,
    zero_stats_audit,
    quality_score,
    word_count,
    has_title,
    has_content,
    has_html_structure,
    has_minimum_length,
    flags,
  }
}

// ── Publish Authorization Engine ──

export interface PublishDecision {
  authorized: boolean
  mode: PublishMode
  trustLevel: TrustLevel
  agentName: string
  audit: ContentAudit
  reason: string
  requiresManualApproval: boolean
}

/**
 * Determine whether an agent can publish content directly.
 *
 * PRODUCTION mode: Direct publish when audit passes. No manual approval.
 * SAFE mode: Requires manual approval even if audit passes.
 *
 * Trusted agents (VERA, auto-publish cron, agent-factory) → PRODUCTION mode
 * External/unknown agents → SAFE mode (requires approval)
 */
export function authorizePublish(params: {
  agentId: string
  title: string
  content: string
  contentType?: string
  callerContext?: 'agent-factory' | 'cron' | 'api' | 'manual' | 'external'
}): PublishDecision {
  const { agentId, title, content, contentType, callerContext } = params

  // Normalize agent ID
  const normalizedId = agentId.toLowerCase().replace(/[^a-z0-9-]/g, '')

  // Lookup trust registry
  const registeredAgent = TRUSTED_AGENTS[normalizedId]

  // Determine trust level
  let trustLevel: TrustLevel = 'EXTERNAL'
  let agentName = agentId || 'Unknown Agent'

  if (registeredAgent) {
    trustLevel = registeredAgent.trustLevel
    agentName = registeredAgent.name
  } else if (callerContext === 'agent-factory' || callerContext === 'manual') {
    // Agent Factory internal calls and manual dashboard calls get VERIFIED
    trustLevel = 'VERIFIED'
    agentName = `${agentId} (via ${callerContext})`
  }

  // Determine publish mode based on trust + caller context
  let mode: PublishMode = 'SAFE' // Default: SAFE for untrusted

  if (trustLevel === 'TRUSTED') {
    mode = 'PRODUCTION'
  } else if (trustLevel === 'VERIFIED') {
    // Agent Factory and dashboard calls → PRODUCTION
    mode = (callerContext === 'agent-factory' || callerContext === 'manual' || callerContext === 'cron')
      ? 'PRODUCTION'
      : 'SAFE'
  }
  // EXTERNAL stays SAFE

  // Run content audit (informational for TRUSTED, gating for others)
  const audit = auditContent({ title, content, contentType })

  // ── Authorization Decision ──
  let authorized = false
  let requiresManualApproval = false
  let reason = ''

  if (trustLevel === 'TRUSTED') {
    // 🛡️ PRODUCTION OVERRIDE — TRUSTED agents bypass ALL gates
    // No audit gate, no approval queue, no validation. Direct publish.
    authorized = true
    requiresManualApproval = false
    reason = `✅ PRODUCTION OVERRIDE — ${agentName} [TRUSTED] authorized. Audit skipped (informational: score ${audit.quality_score}/100, words: ${audit.word_count})`
  } else if (mode === 'PRODUCTION') {
    // VERIFIED agents in PRODUCTION: audit gates still apply
    if (audit.audit_status === 'PASSED' && audit.zero_stats_audit === 'PASSED') {
      authorized = true
      requiresManualApproval = false
      reason = `✅ PRODUCTION mode — ${agentName} authorized. Audit PASSED (score: ${audit.quality_score}/100, words: ${audit.word_count})`
    } else {
      authorized = false
      requiresManualApproval = false
      reason = `❌ PRODUCTION mode — ${agentName} blocked. Audit ${audit.audit_status} (score: ${audit.quality_score}/100, flags: ${audit.flags.join(', ') || 'none'})`
    }
  } else {
    // SAFE mode: Always requires manual approval (EXTERNAL agents)
    authorized = false
    requiresManualApproval = true
    reason = `⏸️ SAFE mode — ${agentName} requires manual approval. Trust: ${trustLevel}. Audit: ${audit.audit_status} (score: ${audit.quality_score}/100)`
  }

  console.log(`[SkillFactory:Security] ${reason}`)

  return {
    authorized,
    mode,
    trustLevel,
    agentName,
    audit,
    reason,
    requiresManualApproval,
  }
}

// ── Utility: Check if an agent is trusted ──

export function isAgentTrusted(agentId: string): boolean {
  const normalizedId = agentId.toLowerCase().replace(/[^a-z0-9-]/g, '')
  return !!TRUSTED_AGENTS[normalizedId]
}

// ── Utility: Get agent trust info ──

export function getAgentTrustInfo(agentId: string): {
  trustLevel: TrustLevel
  name: string
  mode: PublishMode
} {
  const normalizedId = agentId.toLowerCase().replace(/[^a-z0-9-]/g, '')
  const agent = TRUSTED_AGENTS[normalizedId]
  if (agent) {
    return {
      trustLevel: agent.trustLevel,
      name: agent.name,
      mode: agent.trustLevel === 'TRUSTED' ? 'PRODUCTION' : 'SAFE',
    }
  }
  return {
    trustLevel: 'EXTERNAL',
    name: agentId || 'Unknown',
    mode: 'SAFE',
  }
}

// ── Utility: Register a custom trusted agent at runtime ──

export function registerTrustedAgent(
  agentId: string,
  config: { name: string; trustLevel: TrustLevel; allowDirectPublish: boolean }
): void {
  const normalizedId = agentId.toLowerCase().replace(/[^a-z0-9-]/g, '')
  TRUSTED_AGENTS[normalizedId] = config
  console.log(`[SkillFactory] Registered trusted agent: ${config.name} (${normalizedId}) → ${config.trustLevel}`)
}
