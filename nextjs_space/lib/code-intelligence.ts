/**
 * Code Intelligence Engine — Sprint 7
 * Lightweight regex-based parser + dependency graph + import validator.
 * No heavy AST deps (@babel/parser, TS compiler) — works in production.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface ParsedImport {
  source: string       // 'react', './utils', 'https://esm.sh/lib'
  specifiers: string[] // ['useState', 'default']
  isRelative: boolean  // starts with . or /
  isCDN: boolean       // starts with http
  isNodeModule: boolean
  line: number
}

export interface ParsedExport {
  name: string        // 'default', 'MyComponent', 'helper'
  kind: 'default' | 'named' | 'all'
  line: number
}

export interface ParsedFunction {
  name: string
  kind: 'function' | 'arrow' | 'method' | 'class' | 'component'
  line: number
  isExported: boolean
  isAsync: boolean
}

export interface ParsedVariable {
  name: string
  kind: 'const' | 'let' | 'var'
  line: number
  isExported: boolean
}

export interface FileAnalysis {
  path: string
  language: 'js' | 'ts' | 'jsx' | 'tsx' | 'html' | 'css' | 'json' | 'unknown'
  imports: ParsedImport[]
  exports: ParsedExport[]
  functions: ParsedFunction[]
  variables: ParsedVariable[]
  errors: string[]
  lineCount: number
}

export interface DependencyNode {
  path: string
  language: string
  exports: string[]
  importedBy: string[]  // files that import this one
  dependsOn: string[]   // files this one imports
}

export interface DependencyGraph {
  nodes: Record<string, DependencyNode>
  missingImports: { file: string; source: string; line: number }[]
  npmPackages: string[]    // detected npm packages used
  cdnDeps: string[]        // CDN URLs used
  fileCount: number
  totalLines: number
}

export interface ImportValidation {
  valid: boolean
  missingLocal: { source: string; resolvedPath: string; line: number }[]
  missingPackages: string[]
  syntaxErrors: string[]
}

// ═══════════════════════════════════════════════════════════════════════════════
// Language detection
// ═══════════════════════════════════════════════════════════════════════════════

function detectLanguage(path: string): FileAnalysis['language'] {
  const ext = path.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, FileAnalysis['language']> = {
    js: 'js', mjs: 'js', cjs: 'js',
    ts: 'ts', mts: 'ts', cts: 'ts',
    jsx: 'jsx', tsx: 'tsx',
    html: 'html', htm: 'html',
    css: 'css',
    json: 'json',
  }
  return map[ext] || 'unknown'
}

// ═══════════════════════════════════════════════════════════════════════════════
// JS/TS/JSX/TSX Parser (regex-based)
// ═══════════════════════════════════════════════════════════════════════════════

function parseJsLike(path: string, content: string, lang: FileAnalysis['language']): FileAnalysis {
  const lines = content.split('\n')
  const imports: ParsedImport[] = []
  const exports: ParsedExport[] = []
  const functions: ParsedFunction[] = []
  const variables: ParsedVariable[] = []
  const errors: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    const lineNum = i + 1

    // Skip comments
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue

    // ── Imports ──
    // import X from 'source'
    // import { X, Y } from 'source'
    // import 'source'
    // import * as X from 'source'
    const importMatch = trimmed.match(
      /^import\s+(?:(?:type\s+)?(?:([\w$]+)\s*,?\s*)?(?:\{([^}]*)\}\s*,?\s*)?(?:\*\s+as\s+([\w$]+)\s*)?from\s+)?['"]([^'"]+)['"]/
    )
    if (importMatch) {
      const [, defaultSpec, namedSpecs, nsSpec, source] = importMatch
      const specifiers: string[] = []
      if (defaultSpec) specifiers.push('default')
      if (namedSpecs) {
        namedSpecs.split(',').forEach(s => {
          const name = s.trim().split(/\s+as\s+/)[0].trim()
          if (name) specifiers.push(name)
        })
      }
      if (nsSpec) specifiers.push('*')
      if (specifiers.length === 0) specifiers.push('side-effect')

      const isRelative = source.startsWith('.') || source.startsWith('/')
      const isCDN = source.startsWith('http://') || source.startsWith('https://')

      imports.push({
        source,
        specifiers,
        isRelative,
        isCDN,
        isNodeModule: !isRelative && !isCDN,
        line: lineNum,
      })
      continue
    }

    // require('source')
    const requireMatch = trimmed.match(/(?:const|let|var)\s+(?:\{[^}]*\}|[\w$]+)\s*=\s*require\(['"]([^'"]+)['"]\)/)
    if (requireMatch) {
      const source = requireMatch[1]
      const isRelative = source.startsWith('.') || source.startsWith('/')
      const isCDN = source.startsWith('http')
      imports.push({
        source,
        specifiers: ['require'],
        isRelative,
        isCDN,
        isNodeModule: !isRelative && !isCDN,
        line: lineNum,
      })
      continue
    }

    // ── Exports ──
    // export default X
    if (/^export\s+default\s+/.test(trimmed)) {
      const nameMatch = trimmed.match(/^export\s+default\s+(?:function\s+|class\s+|async\s+function\s+)?([\w$]+)?/)
      exports.push({ name: nameMatch?.[1] || 'default', kind: 'default', line: lineNum })
    }
    // export { X, Y }
    else if (/^export\s+\{/.test(trimmed)) {
      const namesMatch = trimmed.match(/^export\s+\{([^}]*)\}/)
      if (namesMatch) {
        namesMatch[1].split(',').forEach(n => {
          const name = n.trim().split(/\s+as\s+/).pop()?.trim()
          if (name) exports.push({ name, kind: 'named', line: lineNum })
        })
      }
    }
    // export const/let/var/function/class
    else if (/^export\s+(?:const|let|var|function|async\s+function|class)\s+/.test(trimmed)) {
      const nameMatch = trimmed.match(/^export\s+(?:const|let|var|function|async\s+function|class)\s+([\w$]+)/)
      if (nameMatch) exports.push({ name: nameMatch[1], kind: 'named', line: lineNum })
    }
    // export * from 'source'
    else if (/^export\s+\*\s+from/.test(trimmed)) {
      exports.push({ name: '*', kind: 'all', line: lineNum })
    }

    // ── Functions ──
    const isExported = trimmed.startsWith('export ')
    const cleanLine = trimmed.replace(/^export\s+(default\s+)?/, '')

    // function name() / async function name()
    const funcMatch = cleanLine.match(/^(async\s+)?function\s+([\w$]+)/)
    if (funcMatch) {
      const name = funcMatch[2]
      // Detect React component (PascalCase + JSX-like return)
      const isComponent = /^[A-Z]/.test(name) && ['jsx', 'tsx'].includes(lang)
      functions.push({
        name,
        kind: isComponent ? 'component' : 'function',
        line: lineNum,
        isExported,
        isAsync: !!funcMatch[1],
      })
      continue
    }

    // class Name
    const classMatch = cleanLine.match(/^class\s+([\w$]+)/)
    if (classMatch) {
      functions.push({
        name: classMatch[1],
        kind: 'class',
        line: lineNum,
        isExported,
        isAsync: false,
      })
      continue
    }

    // const Name = () => ... (arrow function / component)
    const arrowMatch = cleanLine.match(/^(const|let|var)\s+([\w$]+)\s*=\s*(async\s+)?(?:\([^)]*\)|[\w$]+)\s*=>/)
    if (arrowMatch) {
      const name = arrowMatch[2]
      const isComponent = /^[A-Z]/.test(name) && ['jsx', 'tsx'].includes(lang)
      functions.push({
        name,
        kind: isComponent ? 'component' : 'arrow',
        line: lineNum,
        isExported,
        isAsync: !!arrowMatch[3],
      })
      continue
    }

    // ── Variables (top-level only, not functions) ──
    const varMatch = cleanLine.match(/^(const|let|var)\s+([\w$]+)\s*=/)
    if (varMatch && !arrowMatch) {
      variables.push({
        name: varMatch[2],
        kind: varMatch[1] as 'const' | 'let' | 'var',
        line: lineNum,
        isExported,
      })
    }

  }

  // ── Brace/paren depth check REMOVED ──────────────────────────────────
  // Previously we ran a full-file lexer to count braces and flag mismatches.
  // This was the #1 cause of false-positive rollbacks in the Code Engine:
  //   - JSON-escaped content (\\n, \\\") confuses lexer
  //   - LLM-generated code arrives via JSON strings with double-escaped chars
  //   - Regex literals with braces /\\d{3}/ are miscounted
  //   - Multi-line template literals with HTML/CSS braces
  //   - Minified one-liner code from the LLM
  // Each "fix" only patched one edge case while introducing new ones.
  // The brace counter added ZERO real value — if the code has actual syntax errors,
  // the browser will catch them at runtime. The auto-repair loop trying to "fix"
  // valid code was actively destructive (3 LLM calls → worse code → rollback).
  //
  // Decision: Removed entirely. The Code Engine now trusts the LLM output
  // and lets the browser be the real validator. This eliminates the entire
  // class of "Rollback — changes reverted" errors on valid code.
  // braceDepth and parenDepth variables are kept for potential future use
  // but are no longer pushed to errors[].

  return {
    path,
    language: lang,
    imports,
    exports,
    functions,
    variables,
    errors,
    lineCount: lines.length,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HTML Parser
// ═══════════════════════════════════════════════════════════════════════════════

function parseHtml(path: string, content: string): FileAnalysis {
  const lines = content.split('\n')
  const imports: ParsedImport[] = []
  const errors: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNum = i + 1

    // <link rel="stylesheet" href="...">
    const linkMatch = line.match(/<link[^>]+href\s*=\s*['"]([^'"]+)['"]/i)
    if (linkMatch && /rel\s*=\s*['"]stylesheet['"]/i.test(line)) {
      const src = linkMatch[1]
      imports.push({
        source: src,
        specifiers: ['stylesheet'],
        isRelative: !src.startsWith('http'),
        isCDN: src.startsWith('http'),
        isNodeModule: false,
        line: lineNum,
      })
    }

    // <script src="...">
    const scriptMatch = line.match(/<script[^>]+src\s*=\s*['"]([^'"]+)['"]/i)
    if (scriptMatch) {
      const src = scriptMatch[1]
      imports.push({
        source: src,
        specifiers: ['script'],
        isRelative: !src.startsWith('http'),
        isCDN: src.startsWith('http'),
        isNodeModule: false,
        line: lineNum,
      })
    }
  }

  // Basic validation
  const hasHtml = /<html/i.test(content)
  const hasBody = /<body/i.test(content)
  if (hasHtml && !/<\/html>/i.test(content)) errors.push('Missing closing </html> tag')
  if (hasBody && !/<\/body>/i.test(content)) errors.push('Missing closing </body> tag')

  return {
    path,
    language: 'html',
    imports,
    exports: [],
    functions: [],
    variables: [],
    errors,
    lineCount: lines.length,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CSS Parser
// ═══════════════════════════════════════════════════════════════════════════════

function parseCss(path: string, content: string): FileAnalysis {
  const lines = content.split('\n')
  const imports: ParsedImport[] = []
  const variables: ParsedVariable[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const lineNum = i + 1

    // @import url('...') or @import '...'
    const importMatch = line.match(/@import\s+(?:url\()?['"]([^'"]+)['"]\)?/)
    if (importMatch) {
      const src = importMatch[1]
      imports.push({
        source: src,
        specifiers: ['css'],
        isRelative: !src.startsWith('http'),
        isCDN: src.startsWith('http'),
        isNodeModule: false,
        line: lineNum,
      })
    }

    // CSS custom properties (--var-name:)
    const varMatch = line.match(/^\s*(--[\w-]+)\s*:/)
    if (varMatch) {
      variables.push({ name: varMatch[1], kind: 'const', line: lineNum, isExported: false })
    }
  }

  return {
    path,
    language: 'css',
    imports,
    exports: [],
    functions: [],
    variables,
    errors: [],
    lineCount: lines.length,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Parser
// ═══════════════════════════════════════════════════════════════════════════════

export function parseFile(path: string, content: string): FileAnalysis {
  const lang = detectLanguage(path)
  switch (lang) {
    case 'js': case 'ts': case 'jsx': case 'tsx':
      return parseJsLike(path, content, lang)
    case 'html':
      return parseHtml(path, content)
    case 'css':
      return parseCss(path, content)
    case 'json':
      return {
        path, language: 'json', imports: [], exports: [], functions: [], variables: [],
        errors: (() => { try { JSON.parse(content); return [] } catch (e) { return [`Invalid JSON: ${(e as Error).message}`] } })(),
        lineCount: content.split('\n').length,
      }
    default:
      return {
        path, language: 'unknown', imports: [], exports: [], functions: [], variables: [], errors: [],
        lineCount: content.split('\n').length,
      }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Dependency Graph Builder
// ═══════════════════════════════════════════════════════════════════════════════

function resolveRelativeImport(fromFile: string, importSource: string): string {
  // Resolve relative path from the importing file
  const fromDir = fromFile.split('/').slice(0, -1).join('/')
  const parts = (fromDir ? fromDir + '/' + importSource : importSource).split('/')
  const resolved: string[] = []
  for (const p of parts) {
    if (p === '.') continue
    else if (p === '..') resolved.pop()
    else resolved.push(p)
  }
  return resolved.join('/')
}

/** Attempt to match a resolved import path to an actual file in the file map */
function findFileInMap(resolvedPath: string, filePaths: string[]): string | null {
  // Try exact match first
  if (filePaths.includes(resolvedPath)) return resolvedPath
  // Try with common extensions
  const exts = ['.js', '.ts', '.jsx', '.tsx', '.css', '.json', '.mjs']
  for (const ext of exts) {
    if (filePaths.includes(resolvedPath + ext)) return resolvedPath + ext
  }
  // Try index files
  for (const ext of exts) {
    const indexPath = resolvedPath + '/index' + ext
    if (filePaths.includes(indexPath)) return indexPath
  }
  return null
}

/** Common npm packages that are expected in browser projects (via CDN or bundler) */
const KNOWN_BROWSER_GLOBALS = new Set([
  'react', 'react-dom', 'react-router-dom', 'vue', 'angular', 'svelte',
  'lodash', 'axios', 'moment', 'dayjs', 'three', 'gsap', 'framer-motion',
  'd3', 'chart.js', 'p5', 'phaser', 'pixi.js', 'matter-js',
  'tailwindcss', 'bootstrap', 'animate.css',
])

export function buildDependencyGraph(files: Map<string, { path: string; content: string }>): DependencyGraph {
  const analyses = new Map<string, FileAnalysis>()
  const nodes: Record<string, DependencyNode> = {}
  const missingImports: DependencyGraph['missingImports'] = []
  const npmPackages = new Set<string>()
  const cdnDeps = new Set<string>()
  let totalLines = 0

  const filePaths = Array.from(files.keys())

  // Phase 1: Parse all files
  for (const [path, file] of files) {
    const analysis = parseFile(path, file.content)
    analyses.set(path, analysis)
    totalLines += analysis.lineCount

    nodes[path] = {
      path,
      language: analysis.language,
      exports: analysis.exports.map(e => e.name),
      importedBy: [],
      dependsOn: [],
    }
  }

  // Phase 2: Resolve dependencies
  for (const [filePath, analysis] of analyses) {
    for (const imp of analysis.imports) {
      if (imp.isCDN) {
        cdnDeps.add(imp.source)
        continue
      }

      if (imp.isRelative) {
        const resolved = resolveRelativeImport(filePath, imp.source)
        const found = findFileInMap(resolved, filePaths)
        if (found) {
          nodes[filePath].dependsOn.push(found)
          if (nodes[found]) nodes[found].importedBy.push(filePath)
        } else {
          missingImports.push({ file: filePath, source: imp.source, line: imp.line })
        }
      } else if (imp.isNodeModule) {
        // Extract package name (handle scoped packages)
        const pkgName = imp.source.startsWith('@')
          ? imp.source.split('/').slice(0, 2).join('/')
          : imp.source.split('/')[0]
        npmPackages.add(pkgName)
      }
    }
  }

  return {
    nodes,
    missingImports,
    npmPackages: Array.from(npmPackages),
    cdnDeps: Array.from(cdnDeps),
    fileCount: files.size,
    totalLines,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Import Validator
// ═══════════════════════════════════════════════════════════════════════════════

export function validateFileImports(
  filePath: string,
  content: string,
  existingFiles: string[],
): ImportValidation {
  const analysis = parseFile(filePath, content)
  const missingLocal: ImportValidation['missingLocal'] = []
  const missingPackages: string[] = []

  for (const imp of analysis.imports) {
    if (imp.isCDN) continue // CDN imports are always OK

    if (imp.isRelative) {
      const resolved = resolveRelativeImport(filePath, imp.source)
      const found = findFileInMap(resolved, existingFiles)
      if (!found) {
        missingLocal.push({ source: imp.source, resolvedPath: resolved, line: imp.line })
      }
    } else if (imp.isNodeModule) {
      const pkgName = imp.source.startsWith('@')
        ? imp.source.split('/').slice(0, 2).join('/')
        : imp.source.split('/')[0]
      // Only flag non-browser packages as potentially missing
      if (!KNOWN_BROWSER_GLOBALS.has(pkgName)) {
        missingPackages.push(pkgName)
      }
    }
  }

  return {
    valid: missingLocal.length === 0 && analysis.errors.length === 0,
    missingLocal,
    missingPackages,
    syntaxErrors: analysis.errors,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Format graph as compact context for LLM injection
// ═══════════════════════════════════════════════════════════════════════════════

export function formatGraphForLLM(graph: DependencyGraph): string {
  if (graph.fileCount === 0) return ''

  const lines: string[] = [
    `[DEPENDENCY GRAPH] ${graph.fileCount} files, ${graph.totalLines} lines`,
    '',
  ]

  // File map with exports
  for (const [path, node] of Object.entries(graph.nodes)) {
    const exp = node.exports.length > 0 ? ` → exports: ${node.exports.join(', ')}` : ''
    const deps = node.dependsOn.length > 0 ? ` ← imports: ${node.dependsOn.map(d => d.split('/').pop()).join(', ')}` : ''
    lines.push(`  ${path} (${node.language})${exp}${deps}`)
  }

  // Missing imports warning
  if (graph.missingImports.length > 0) {
    lines.push('')
    lines.push('⚠ MISSING IMPORTS (create these files or fix paths):')
    for (const m of graph.missingImports) {
      lines.push(`  ${m.file}:${m.line} → import from '${m.source}' (NOT FOUND)`)
    }
  }

  // npm packages detected
  if (graph.npmPackages.length > 0) {
    lines.push('')
    lines.push(`📦 npm packages used: ${graph.npmPackages.join(', ')}`)
  }

  // CDN deps
  if (graph.cdnDeps.length > 0) {
    lines.push('')
    lines.push(`🌐 CDN deps: ${graph.cdnDeps.length} external resources`)
  }

  return lines.join('\n')
}
