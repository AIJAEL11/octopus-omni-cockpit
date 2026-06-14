// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 CODE REFINER SKILL — Pre-Preview Code Validator
// Catches common LLM code generation mistakes before preview render.
// Runs instantly (no LLM call), returns actionable fixes.
// ═══════════════════════════════════════════════════════════════════════════════

import type { SkillInfo } from './index'

// ── Types ──

export interface RefinerIssue {
  severity: 'error' | 'warning' | 'info'
  rule: string
  file: string
  line?: number
  message: string
  suggestion?: string
}

export interface RefinerResult {
  issues: RefinerIssue[]
  score: number // 0-100, higher = cleaner
  summary: string
}

interface FileToCheck {
  path: string
  content: string
}

// ── Main entrypoint ──

export function analyzeCode(files: FileToCheck[]): RefinerResult {
  const issues: RefinerIssue[] = []

  for (const file of files) {
    const ext = file.path.split('.').pop()?.toLowerCase() || ''

    // Framework file guard — .tsx/.jsx/.ts/.vue/.svelte won't work in browser preview
    const frameworkExts = ['tsx', 'jsx', 'vue', 'svelte']
    if (frameworkExts.includes(ext)) {
      issues.push({
        severity: 'error',
        rule: 'framework-file-in-browser',
        file: file.path,
        message: `.${ext} files require a build toolchain (Vite/Webpack) and will NOT work in the browser preview.`,
        suggestion: `Convert to vanilla HTML + CSS + JS. Use CDN links for libraries. The workspace is a static file environment — no Node.js or npm available.`,
      })
    }

    // package.json / vite.config / tsconfig guard
    const configFiles = ['package.json', 'vite.config.ts', 'vite.config.js', 'tsconfig.json', 'tsconfig.ts', 'next.config.js', 'next.config.ts', 'nuxt.config.ts', 'webpack.config.js']
    if (configFiles.some(cf => file.path.endsWith(cf))) {
      issues.push({
        severity: 'error',
        rule: 'build-config-in-browser',
        file: file.path,
        message: `Build config files like ${file.path.split('/').pop()} are not needed — the workspace is static HTML only.`,
        suggestion: `Remove this file. Use CDN links (cdn.tailwindcss.com, esm.sh, unpkg.com) instead of npm packages.`,
      })
    }

    // Universal checks
    checkDuplicateDeclarations(file, issues)
    checkBraceBalance(file, issues)

    // HTML-specific
    if (ext === 'html' || ext === 'htm') {
      checkHtmlStructure(file, issues)
      checkBrokenAssetRefs(file, files, issues)
      checkInlineStylesAndScripts(file, issues)
    }

    // CSS-specific
    if (ext === 'css') {
      checkCssBraceBalance(file, issues)
      checkDuplicateSelectors(file, issues)
    }

    // JS/TS-specific
    if (['js', 'jsx', 'ts', 'tsx', 'mjs'].includes(ext)) {
      checkTsInBrowserCode(file, issues)
      checkBrokenImports(file, files, issues)
      checkConsoleStatements(file, issues)
    }
  }

  // Calculate score
  const errorCount = issues.filter(i => i.severity === 'error').length
  const warningCount = issues.filter(i => i.severity === 'warning').length
  const score = Math.max(0, 100 - (errorCount * 15) - (warningCount * 5))

  const summary = issues.length === 0
    ? '✅ Code is clean — no issues detected.'
    : `Found ${errorCount} error(s) and ${warningCount} warning(s) across ${files.length} file(s).`

  return { issues, score, summary }
}

// ── RULE: Duplicate declarations ──

function checkDuplicateDeclarations(file: FileToCheck, issues: RefinerIssue[]) {
  const lines = file.content.split('\n')
  const declarations = new Map<string, number>() // name → first line

  // Match: interface X, type X, enum X, class X, function X, const X, let X, var X
  const declRe = /^\s*(?:export\s+)?(?:declare\s+)?(?:interface|type|enum|class|function|const|let|var)\s+(\w+)/

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(declRe)
    if (!m) continue
    const name = m[1]
    if (declarations.has(name)) {
      issues.push({
        severity: 'error',
        rule: 'duplicate-declaration',
        file: file.path,
        line: i + 1,
        message: `"${name}" is declared again (first at line ${declarations.get(name)}).`,
        suggestion: `Remove one of the duplicate declarations of "${name}".`,
      })
    } else {
      declarations.set(name, i + 1)
    }
  }
}

// ── RULE: Brace balance ──

function checkBraceBalance(file: FileToCheck, issues: RefinerIssue[]) {
  let depth = 0
  // Skip strings and comments for accurate counting
  const stripped = file.content
    .replace(/\/\/[^\n]*/g, '')           // line comments
    .replace(/\/\*[\s\S]*?\*\//g, '')     // block comments
    .replace(/'(?:\\.|[^'\\])*'/g, '""')  // single-quoted strings
    .replace(/"(?:\\.|[^"\\])*"/g, '""')  // double-quoted strings
    .replace(/`(?:\\.|[^`\\])*`/g, '""')  // template literals

  for (const ch of stripped) {
    if (ch === '{') depth++
    else if (ch === '}') depth--
    if (depth < 0) break
  }

  if (depth !== 0) {
    issues.push({
      severity: 'error',
      rule: 'unbalanced-braces',
      file: file.path,
      message: `Unbalanced braces: depth=${depth} (${depth > 0 ? 'missing closing' : 'extra closing'} brace${Math.abs(depth) > 1 ? 's' : ''}).`,
      suggestion: depth > 0 ? 'Add missing closing brace(s) at the end of the file.' : 'Remove extra closing brace(s).',
    })
  }
}

// ── RULE: HTML structure ──

function checkHtmlStructure(file: FileToCheck, issues: RefinerIssue[]) {
  const c = file.content

  // Must have <!DOCTYPE html>
  if (!/<\!doctype\s+html/i.test(c)) {
    issues.push({
      severity: 'warning',
      rule: 'missing-doctype',
      file: file.path,
      message: 'Missing <!DOCTYPE html> declaration.',
      suggestion: 'Add <!DOCTYPE html> as the first line.',
    })
  }

  // Must have <html>, <head>, <body>
  for (const tag of ['html', 'head', 'body']) {
    if (!new RegExp(`<${tag}[\\s>]`, 'i').test(c)) {
      issues.push({
        severity: 'error',
        rule: `missing-${tag}-tag`,
        file: file.path,
        message: `Missing <${tag}> tag.`,
      })
    }
  }

  // Check for unclosed tags (simple heuristic for common ones)
  const selfClosing = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr'])
  const openTags: string[] = []
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)(?:\s[^>]*)?\/?>|<!--[\s\S]*?-->/g
  let tm: RegExpExecArray | null
  while ((tm = tagRe.exec(c)) !== null) {
    if (tm[0].startsWith('<!--')) continue // skip comments
    const tagName = tm[1]?.toLowerCase()
    if (!tagName || selfClosing.has(tagName)) continue
    if (tm[0].startsWith('</')) {
      // Closing tag
      const lastOpen = openTags.lastIndexOf(tagName)
      if (lastOpen >= 0) openTags.splice(lastOpen, 1)
    } else if (!tm[0].endsWith('/>')) {
      openTags.push(tagName)
    }
  }

  // Only report structural tags as issues
  const structural = new Set(['div', 'section', 'main', 'article', 'nav', 'header', 'footer', 'aside'])
  const unclosed = openTags.filter(t => structural.has(t))
  if (unclosed.length > 3) {
    issues.push({
      severity: 'warning',
      rule: 'unclosed-tags',
      file: file.path,
      message: `${unclosed.length} potentially unclosed structural tags: ${unclosed.slice(0, 5).join(', ')}...`,
      suggestion: 'Verify all div/section/nav tags are properly closed.',
    })
  }
}

// ── RULE: Broken asset references ──

function checkBrokenAssetRefs(file: FileToCheck, allFiles: FileToCheck[], issues: RefinerIssue[]) {
  const projectPaths = new Set(allFiles.map(f => f.path))
  // Find src="..." and href="..." references to local files
  const refRe = /(?:src|href)=["']([^"']+)["']/g
  let rm: RegExpExecArray | null
  while ((rm = refRe.exec(file.content)) !== null) {
    const ref = rm[1]
    // Skip absolute URLs, data URIs, anchors, CDN links
    if (/^(https?:|data:|#|mailto:|tel:|\/\/)/i.test(ref)) continue
    // Resolve relative to project dir
    const dir = file.path.includes('/') ? file.path.replace(/\/[^/]+$/, '') : ''
    const resolved = ref.startsWith('./') ? `${dir}/${ref.slice(2)}` : ref.startsWith('/') ? ref.slice(1) : `${dir}/${ref}`
    const normalized = resolved.replace(/\/+/g, '/').replace(/^\//, '')
    if (!projectPaths.has(normalized) && !projectPaths.has(ref)) {
      // Not in project files — might be generated later or CDN
      if (!/\.(css|js|png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf|eot)$/i.test(ref)) continue
      issues.push({
        severity: 'warning',
        rule: 'broken-asset-ref',
        file: file.path,
        message: `References "${ref}" which is not in the project files.`,
        suggestion: 'Either include this file in the project or use a CDN URL.',
      })
    }
  }
}

// ── RULE: Inline styles/scripts in HTML (Octopus convention: separate files) ──

function checkInlineStylesAndScripts(file: FileToCheck, issues: RefinerIssue[]) {
  // Check for <style> blocks (small ones are OK for critical CSS)
  const styleBlocks = file.content.match(/<style[^>]*>[\s\S]{200,}?<\/style>/gi)
  if (styleBlocks && styleBlocks.length > 0) {
    issues.push({
      severity: 'warning',
      rule: 'inline-styles',
      file: file.path,
      message: `${styleBlocks.length} large inline <style> block(s) found (≥200 chars each).`,
      suggestion: 'Move styles to a separate style.css file.',
    })
  }

  // Check for <script> blocks (ignore small ones like config)
  const scriptBlocks = file.content.match(/<script(?!\s+src)[^>]*>[\s\S]{200,}?<\/script>/gi)
  if (scriptBlocks && scriptBlocks.length > 0) {
    issues.push({
      severity: 'warning',
      rule: 'inline-scripts',
      file: file.path,
      message: `${scriptBlocks.length} large inline <script> block(s) found (≥200 chars each).`,
      suggestion: 'Move scripts to a separate script.js file.',
    })
  }
}

// ── RULE: CSS brace balance ──

function checkCssBraceBalance(file: FileToCheck, issues: RefinerIssue[]) {
  const stripped = file.content
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
    .replace(/'(?:\\.|[^'\\])*'/g, '""')
    .replace(/"(?:\\.|[^"\\])*"/g, '""')

  let depth = 0
  for (const ch of stripped) {
    if (ch === '{') depth++
    else if (ch === '}') depth--
  }

  if (depth !== 0) {
    issues.push({
      severity: 'error',
      rule: 'css-unbalanced-braces',
      file: file.path,
      message: `CSS has unbalanced braces (depth=${depth}).`,
      suggestion: 'Check for missing or extra closing braces in CSS rules.',
    })
  }
}

// ── RULE: Duplicate CSS selectors ──

function checkDuplicateSelectors(file: FileToCheck, issues: RefinerIssue[]) {
  const stripped = file.content.replace(/\/\*[\s\S]*?\*\//g, '')
  const selectorRe = /^([^{}@\n][^{]*?)\s*\{/gm
  const seen = new Map<string, number>()
  let sm: RegExpExecArray | null
  const linesBefore = stripped.split('\n')

  while ((sm = selectorRe.exec(stripped)) !== null) {
    const selector = sm[1].trim()
    if (!selector || selector.startsWith('@')) continue
    // Find approximate line number
    const charsBefore = stripped.substring(0, sm.index)
    const lineNum = charsBefore.split('\n').length

    if (seen.has(selector)) {
      issues.push({
        severity: 'warning',
        rule: 'duplicate-css-selector',
        file: file.path,
        line: lineNum,
        message: `Selector "${selector.substring(0, 60)}" appears again (first at line ${seen.get(selector)}).`,
        suggestion: 'Merge duplicate selectors to avoid specificity conflicts.',
      })
    } else {
      seen.set(selector, lineNum)
    }
  }
}

// ── RULE: TypeScript syntax in browser code ──

function checkTsInBrowserCode(file: FileToCheck, issues: RefinerIssue[]) {
  const ext = file.path.split('.').pop()?.toLowerCase() || ''
  // Only flag .js files that contain TS syntax
  if (ext !== 'js' && ext !== 'mjs') return

  const tsPatterns = [
    { re: /:\s*(string|number|boolean|any|void|never|unknown|Record|Array)\b/m, desc: 'type annotation' },
    { re: /\binterface\s+\w+\s*\{/m, desc: 'interface declaration' },
    { re: /\btype\s+\w+\s*=/m, desc: 'type alias' },
    { re: /\benum\s+\w+\s*\{/m, desc: 'enum declaration' },
    { re: /as\s+(string|number|boolean|any|\w+Type|\w+Interface)\b/m, desc: '"as" type cast' },
    { re: /<\w+>\(/, desc: 'generic type parameter' },
  ]

  for (const { re, desc } of tsPatterns) {
    if (re.test(file.content)) {
      issues.push({
        severity: 'error',
        rule: 'ts-in-browser',
        file: file.path,
        message: `TypeScript ${desc} found in .js file — browsers can't parse this.`,
        suggestion: 'Either rename to .ts/.tsx or remove TypeScript syntax.',
      })
      break // One TS warning is enough
    }
  }
}

// ── RULE: Broken imports (relative files that don't exist in project) ──

function checkBrokenImports(file: FileToCheck, allFiles: FileToCheck[], issues: RefinerIssue[]) {
  const projectPaths = new Set(allFiles.map(f => f.path))
  const importRe = /^import\s+.+\s+from\s+['"]([^'"]+)['"]/gm
  let im: RegExpExecArray | null
  while ((im = importRe.exec(file.content)) !== null) {
    const target = im[1]
    // Only check relative imports
    if (!target.startsWith('.') && !target.startsWith('/')) continue
    // Resolve path
    const dir = file.path.includes('/') ? file.path.replace(/\/[^/]+$/, '') : ''
    const base = target.startsWith('./') ? `${dir}/${target.slice(2)}` : target.startsWith('/') ? target.slice(1) : `${dir}/${target}`
    const normalized = base.replace(/\/+/g, '/').replace(/^\//, '')
    // Check with and without common extensions
    const candidates = [normalized]
    if (!/\.[a-zA-Z]+$/.test(normalized)) {
      candidates.push(`${normalized}.js`, `${normalized}.ts`, `${normalized}.tsx`, `${normalized}.jsx`, `${normalized}/index.js`, `${normalized}/index.ts`)
    }
    if (!candidates.some(c => projectPaths.has(c))) {
      issues.push({
        severity: 'warning',
        rule: 'broken-import',
        file: file.path,
        message: `Import "${target}" not found in project files.`,
        suggestion: 'Verify the import path or add the missing file.',
      })
    }
  }
}

// ── RULE: Console statements (info-level) ──

function checkConsoleStatements(file: FileToCheck, issues: RefinerIssue[]) {
  const count = (file.content.match(/console\.(log|warn|error|info|debug|trace)\s*\(/g) || []).length
  if (count > 5) {
    issues.push({
      severity: 'info',
      rule: 'excessive-console',
      file: file.path,
      message: `${count} console statements found — consider cleanup for production.`,
    })
  }
}

// ── Skill Info Export ──

export const CODE_REFINER_SKILL_INFO: SkillInfo = {
  id: 'code-refiner',
  name: '🔧 Code Refiner',
  description: 'Valida código generado antes de preview — detecta errores de TS, HTML roto, imports faltantes',
  capabilities: [
    'Detección de declaraciones duplicadas',
    'Balance de llaves (JS/CSS)',
    'Validación de estructura HTML',
    'Detección de TypeScript en archivos .js',
    'Imports rotos y assets faltantes',
    'Score de calidad 0-100',
  ],
  status: 'active',
}
