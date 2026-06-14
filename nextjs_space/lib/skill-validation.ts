// ═══════════════════════════════════════════════════════════════
// SKILL CODE VALIDATION — Anti-humo
// Detecta si el código de una skill es realmente ejecutable o si es
// pseudo-código decorativo (p.ej. una API de navegador inventada que
// el Octopus Bridge no entiende). Usado por los flujos de create_skill
// para que OCTOPUS sea honesto sobre lo que creó.
// ═══════════════════════════════════════════════════════════════

const PSEUDO_BROWSER_PATTERNS: RegExp[] = [
  /\bbrowser\.(goto|click|type|upload|fill|press|waitFor|screenshot|select)\b/i,
  /\bpage\.(goto|click|type|fill|waitForSelector)\b/i,
  /:has-text\(/i,
  /\bpuppeteer\b/i,
  /\bplaywright\b/i,
  /\bselenium\b/i,
]

export interface SkillCodeAssessment {
  executable: boolean
  reason?: string
}

export function assessSkillCode(code: string | null | undefined): SkillCodeAssessment {
  const trimmed = (code || '').trim()
  if (!trimmed) {
    return { executable: false, reason: 'no tiene código (solo metadata/descripción)' }
  }
  if (PSEUDO_BROWSER_PATTERNS.some((p) => p.test(trimmed))) {
    return {
      executable: false,
      reason:
        'usa pseudo-código de navegador (browser.*/page.*/has-text/puppeteer) que el Octopus Bridge NO puede ejecutar tal cual',
    }
  }
  return { executable: true }
}
