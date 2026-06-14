/**
 * Dependency Resolution Engine — Sprint 9 (FINAL)
 * Scans all imports in a transaction batch, resolves external packages via CDN,
 * auto-injects <script>/<link> tags into HTML files, and generates a lock file.
 *
 * Flow: SCAN → RESOLVE → INJECT → LOCK
 * Integrates with Transaction Manager (Sprint 8) — runs between VALIDATE and COMMIT.
 */

import { parseFile, type FileAnalysis, type ParsedImport } from './code-intelligence'
import { type StagedCommand } from './transaction-manager'

// ═══════════════════════════════════════════════════════════════════════════════
// CDN Registry — Popular packages mapped to CDN URLs
// ═══════════════════════════════════════════════════════════════════════════════

export interface CDNEntry {
  name: string
  version: string
  js?: string          // UMD/IIFE script URL
  esm?: string         // ES module URL (esm.sh)
  css?: string         // Stylesheet URL
  globalVar?: string   // window.X global name (for UMD)
  category: 'framework' | 'ui' | '3d' | 'animation' | 'utility' | 'data-viz' | 'game' | 'media'
}

const CDN_REGISTRY: Record<string, CDNEntry> = {
  // ── Frameworks ──
  'react': {
    name: 'React', version: '18.3.1',
    js: 'https://unpkg.com/react@18/umd/react.production.min.js',
    esm: 'https://esm.sh/react@18',
    globalVar: 'React', category: 'framework',
  },
  'react-dom': {
    name: 'ReactDOM', version: '18.3.1',
    js: 'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
    esm: 'https://esm.sh/react-dom@18',
    globalVar: 'ReactDOM', category: 'framework',
  },
  'vue': {
    name: 'Vue.js', version: '3.4.27',
    js: 'https://unpkg.com/vue@3/dist/vue.global.prod.js',
    esm: 'https://esm.sh/vue@3',
    globalVar: 'Vue', category: 'framework',
  },
  'alpine': {
    name: 'Alpine.js', version: '3.14.3',
    js: 'https://unpkg.com/alpinejs@3/dist/cdn.min.js',
    category: 'framework',
  },
  'alpinejs': {
    name: 'Alpine.js', version: '3.14.3',
    js: 'https://unpkg.com/alpinejs@3/dist/cdn.min.js',
    category: 'framework',
  },
  'svelte': {
    name: 'Svelte', version: '4.2.18',
    esm: 'https://esm.sh/svelte@4',
    category: 'framework',
  },
  'preact': {
    name: 'Preact', version: '10.22.1',
    js: 'https://unpkg.com/preact@10/dist/preact.umd.js',
    esm: 'https://esm.sh/preact@10',
    globalVar: 'preact', category: 'framework',
  },
  'htmx.org': {
    name: 'htmx', version: '1.9.12',
    js: 'https://unpkg.com/htmx.org@1/dist/htmx.min.js',
    category: 'framework',
  },

  // ── 3D / WebGL ──
  'three': {
    name: 'Three.js', version: '0.168.0',
    js: 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r168/three.min.js',
    esm: 'https://esm.sh/three@0.168.0',
    globalVar: 'THREE', category: '3d',
  },
  'babylonjs': {
    name: 'Babylon.js', version: '7.25.1',
    js: 'https://cdn.babylonjs.com/babylon.js',
    category: '3d',
  },
  'aframe': {
    name: 'A-Frame', version: '1.6.0',
    js: 'https://aframe.io/releases/1.6.0/aframe.min.js',
    globalVar: 'AFRAME', category: '3d',
  },
  'p5': {
    name: 'p5.js', version: '1.10.0',
    js: 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.10.0/p5.min.js',
    globalVar: 'p5', category: '3d',
  },

  // ── Animation ──
  'gsap': {
    name: 'GSAP', version: '3.12.5',
    js: 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js',
    globalVar: 'gsap', category: 'animation',
  },
  'animejs': {
    name: 'Anime.js', version: '3.2.2',
    js: 'https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.2/anime.min.js',
    globalVar: 'anime', category: 'animation',
  },
  'anime': {
    name: 'Anime.js', version: '3.2.2',
    js: 'https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.2/anime.min.js',
    globalVar: 'anime', category: 'animation',
  },
  'framer-motion': {
    name: 'Framer Motion', version: '11.11.1',
    esm: 'https://esm.sh/framer-motion@11',
    category: 'animation',
  },
  'lottie-web': {
    name: 'Lottie', version: '5.12.2',
    js: 'https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js',
    globalVar: 'lottie', category: 'animation',
  },

  // ── UI / CSS ──
  'tailwindcss': {
    name: 'Tailwind CSS', version: '3.4.10',
    js: 'https://cdn.tailwindcss.com',
    category: 'ui',
  },
  'bootstrap': {
    name: 'Bootstrap', version: '5.3.3',
    css: 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
    js: 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
    category: 'ui',
  },
  'bulma': {
    name: 'Bulma', version: '1.0.2',
    css: 'https://cdn.jsdelivr.net/npm/bulma@1.0.2/css/bulma.min.css',
    category: 'ui',
  },
  'animate.css': {
    name: 'Animate.css', version: '4.1.1',
    css: 'https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css',
    category: 'ui',
  },
  'daisyui': {
    name: 'DaisyUI', version: '4.12.10',
    css: 'https://cdn.jsdelivr.net/npm/daisyui@4/dist/full.min.css',
    category: 'ui',
  },
  'font-awesome': {
    name: 'Font Awesome', version: '6.6.0',
    css: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css',
    category: 'ui',
  },
  '@fortawesome/fontawesome-free': {
    name: 'Font Awesome', version: '6.6.0',
    css: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css',
    category: 'ui',
  },

  // ── Data Visualization ──
  'd3': {
    name: 'D3.js', version: '7.9.0',
    js: 'https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js',
    esm: 'https://esm.sh/d3@7',
    globalVar: 'd3', category: 'data-viz',
  },
  'chart.js': {
    name: 'Chart.js', version: '4.4.4',
    js: 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.4/chart.umd.js',
    globalVar: 'Chart', category: 'data-viz',
  },
  'plotly.js': {
    name: 'Plotly', version: '2.35.2',
    js: 'https://cdn.plot.ly/plotly-2.35.2.min.js',
    globalVar: 'Plotly', category: 'data-viz',
  },
  'apexcharts': {
    name: 'ApexCharts', version: '3.52.0',
    js: 'https://cdn.jsdelivr.net/npm/apexcharts@3/dist/apexcharts.min.js',
    css: 'https://cdn.jsdelivr.net/npm/apexcharts@3/dist/apexcharts.css',
    globalVar: 'ApexCharts', category: 'data-viz',
  },
  'echarts': {
    name: 'ECharts', version: '5.5.1',
    js: 'https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js',
    globalVar: 'echarts', category: 'data-viz',
  },

  // ── Utility ──
  'lodash': {
    name: 'Lodash', version: '4.17.21',
    js: 'https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js',
    globalVar: '_', category: 'utility',
  },
  'axios': {
    name: 'Axios', version: '1.7.7',
    js: 'https://cdnjs.cloudflare.com/ajax/libs/axios/1.7.7/axios.min.js',
    globalVar: 'axios', category: 'utility',
  },
  'dayjs': {
    name: 'Day.js', version: '1.11.13',
    js: 'https://cdnjs.cloudflare.com/ajax/libs/dayjs/1.11.13/dayjs.min.js',
    globalVar: 'dayjs', category: 'utility',
  },
  'moment': {
    name: 'Moment.js', version: '2.30.1',
    js: 'https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.30.1/moment.min.js',
    globalVar: 'moment', category: 'utility',
  },
  'marked': {
    name: 'Marked', version: '14.1.2',
    js: 'https://cdn.jsdelivr.net/npm/marked@14/marked.min.js',
    globalVar: 'marked', category: 'utility',
  },
  'uuid': {
    name: 'UUID', version: '10.0.0',
    esm: 'https://esm.sh/uuid@10',
    category: 'utility',
  },
  'sweetalert2': {
    name: 'SweetAlert2', version: '11.12.4',
    js: 'https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.all.min.js',
    css: 'https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css',
    globalVar: 'Swal', category: 'ui',
  },
  'sortablejs': {
    name: 'SortableJS', version: '1.15.3',
    js: 'https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.15.3/Sortable.min.js',
    globalVar: 'Sortable', category: 'utility',
  },

  // ── Game Engines ──
  'phaser': {
    name: 'Phaser', version: '3.85.2',
    js: 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.min.js',
    globalVar: 'Phaser', category: 'game',
  },
  'pixi.js': {
    name: 'PixiJS', version: '8.4.1',
    js: 'https://cdnjs.cloudflare.com/ajax/libs/pixi.js/8.4.1/pixi.min.js',
    globalVar: 'PIXI', category: 'game',
  },
  'matter-js': {
    name: 'Matter.js', version: '0.20.0',
    js: 'https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.20.0/matter.min.js',
    globalVar: 'Matter', category: 'game',
  },
  'kaboom': {
    name: 'Kaboom', version: '3000.1.17',
    js: 'https://unpkg.com/kaboom@3000/dist/kaboom.js',
    globalVar: 'kaboom', category: 'game',
  },

  // ── Media ──
  'howler': {
    name: 'Howler.js', version: '2.2.4',
    js: 'https://cdnjs.cloudflare.com/ajax/libs/howler/2.2.4/howler.min.js',
    globalVar: 'Howl', category: 'media',
  },
  'tone': {
    name: 'Tone.js', version: '15.0.4',
    js: 'https://cdnjs.cloudflare.com/ajax/libs/tone/15.0.4/Tone.js',
    esm: 'https://esm.sh/tone@15',
    globalVar: 'Tone', category: 'media',
  },
  'plyr': {
    name: 'Plyr', version: '3.7.8',
    js: 'https://cdn.plyr.io/3.7.8/plyr.js',
    css: 'https://cdn.plyr.io/3.7.8/plyr.css',
    globalVar: 'Plyr', category: 'media',
  },
}

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface ResolvedDependency {
  packageName: string
  displayName: string
  version: string
  cdnJs?: string
  cdnEsm?: string
  cdnCss?: string
  globalVar?: string
  category: string
  source: 'cdn_registry' | 'esm_fallback'
  injectedInto?: string  // path of HTML file where this was injected
}

export interface DependencyScanResult {
  /** All npm packages detected across batch files */
  detectedPackages: string[]
  /** Packages resolved via CDN registry */
  resolved: ResolvedDependency[]
  /** Packages NOT in our registry (esm.sh fallback used) */
  unresolved: string[]
  /** Whether this is a browser-only project (no package.json) */
  isBrowserProject: boolean
  /** Package names that need Bridge npm install (Node.js projects only) */
  needsInstall: string[]
  /** Files modified (HTML with injected CDN tags) */
  modifiedFiles: { path: string; content: string }[]
  /** Lock file content (if generated) */
  lockFileContent: string | null
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCAN — Detect all npm/external dependencies in the batch
// ═══════════════════════════════════════════════════════════════════════════════

export function scanDependencies(
  stagedCommands: StagedCommand[],
  existingFileContents: Map<string, string>,
): DependencyScanResult {
  const detectedPackages = new Set<string>()
  const allWriteFiles = new Map<string, string>()
  let hasPackageJson = false
  let hasHtmlFile = false

  // Collect all write_file contents
  for (const cmd of stagedCommands) {
    if (cmd.type !== 'write_file') continue
    const path = (cmd.payload.path as string)?.replace(/\\/g, '/')
    const content = cmd.payload.content as string
    if (!path || !content) continue
    allWriteFiles.set(path, content)
    if (path.endsWith('/package.json') || path === 'package.json') hasPackageJson = true
    if (/\.html?$/i.test(path)) hasHtmlFile = true
  }

  // Also check existing files for HTML and package.json
  for (const [path] of existingFileContents) {
    if (path.endsWith('/package.json') || path === 'package.json') hasPackageJson = true
    if (/\.html?$/i.test(path)) hasHtmlFile = true
  }

  const isBrowserProject = !hasPackageJson && hasHtmlFile

  // Parse all JS/TS files to detect imports
  const allFiles = new Map([...existingFileContents, ...allWriteFiles])
  for (const [path, content] of allFiles) {
    const analysis = parseFile(path, content)
    for (const imp of analysis.imports) {
      if (imp.isNodeModule && !imp.isCDN) {
        // Extract package name (handle scoped packages)
        const pkgName = imp.source.startsWith('@')
          ? imp.source.split('/').slice(0, 2).join('/')
          : imp.source.split('/')[0]
        detectedPackages.add(pkgName)
      }
    }
  }

  // Resolve packages
  const resolved: ResolvedDependency[] = []
  const unresolved: string[] = []

  for (const pkg of detectedPackages) {
    const entry = CDN_REGISTRY[pkg]
    if (entry) {
      resolved.push({
        packageName: pkg,
        displayName: entry.name,
        version: entry.version,
        cdnJs: entry.js,
        cdnEsm: entry.esm,
        cdnCss: entry.css,
        globalVar: entry.globalVar,
        category: entry.category,
        source: 'cdn_registry',
      })
    } else {
      // ESM.sh fallback — works for most npm packages
      resolved.push({
        packageName: pkg,
        displayName: pkg,
        version: 'latest',
        cdnEsm: `https://esm.sh/${pkg}`,
        category: 'utility',
        source: 'esm_fallback',
      })
      unresolved.push(pkg)
    }
  }

  // For Node.js projects, detect which packages might need npm install
  const needsInstall: string[] = []
  if (hasPackageJson) {
    // Check if package.json already lists the dependency
    const pkgJsonContent = allWriteFiles.get('package.json') || existingFileContents.get('package.json')
    if (pkgJsonContent) {
      try {
        const pkgJson = JSON.parse(pkgJsonContent)
        const allDeps = { ...pkgJson.dependencies, ...pkgJson.devDependencies }
        for (const pkg of detectedPackages) {
          if (!allDeps[pkg]) needsInstall.push(pkg)
        }
      } catch {}
    }
  }

  // Auto-inject CDN tags into HTML files (browser projects only)
  const modifiedFiles: DependencyScanResult['modifiedFiles'] = []
  if (isBrowserProject && resolved.length > 0) {
    for (const [path, content] of allWriteFiles) {
      if (!/\.html?$/i.test(path)) continue
      const injected = injectCDNIntoHTML(content, resolved)
      if (injected.modified) {
        modifiedFiles.push({ path, content: injected.html })
        // Mark which deps were injected into this file
        for (const dep of injected.injectedDeps) {
          const r = resolved.find(d => d.packageName === dep)
          if (r) r.injectedInto = path
        }
      }
    }
  }

  // Generate lock file
  const lockFileContent = resolved.length > 0
    ? generateLockFile(resolved)
    : null

  return {
    detectedPackages: Array.from(detectedPackages),
    resolved,
    unresolved,
    isBrowserProject,
    needsInstall,
    modifiedFiles,
    lockFileContent,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CDN Injection — Auto-add <script>/<link> tags to HTML
// ═══════════════════════════════════════════════════════════════════════════════

function injectCDNIntoHTML(
  html: string,
  deps: ResolvedDependency[],
): { html: string; modified: boolean; injectedDeps: string[] } {
  const injectedDeps: string[] = []
  const cssToInject: string[] = []
  const jsToInject: string[] = []

  for (const dep of deps) {
    // Skip if already present in the HTML
    const lowerHtml = html.toLowerCase()
    const alreadyHasCss = dep.cdnCss && lowerHtml.includes(dep.cdnCss.toLowerCase())
    const alreadyHasJs = dep.cdnJs && lowerHtml.includes(dep.cdnJs.toLowerCase())
    const alreadyHasEsm = dep.cdnEsm && lowerHtml.includes(dep.cdnEsm.toLowerCase())
    // Also check for the package name in any CDN URL
    const alreadyHasAny = lowerHtml.includes(`/${dep.packageName}@`) || lowerHtml.includes(`/${dep.packageName}/`)

    if (alreadyHasCss && (alreadyHasJs || alreadyHasEsm || !dep.cdnJs)) continue
    if (alreadyHasJs || alreadyHasEsm || alreadyHasAny) {
      // JS already included — just check CSS
      if (dep.cdnCss && !alreadyHasCss) {
        cssToInject.push(`  <link rel="stylesheet" href="${dep.cdnCss}"> <!-- ${dep.displayName} -->`)
        injectedDeps.push(dep.packageName)
      }
      continue
    }

    // Inject CSS
    if (dep.cdnCss) {
      cssToInject.push(`  <link rel="stylesheet" href="${dep.cdnCss}"> <!-- ${dep.displayName} -->`)
    }
    // Inject JS (prefer UMD for browser projects, fallback to ESM)
    if (dep.cdnJs) {
      jsToInject.push(`  <script src="${dep.cdnJs}"></script> <!-- ${dep.displayName} v${dep.version} -->`)
    } else if (dep.cdnEsm) {
      jsToInject.push(`  <script type="module" src="${dep.cdnEsm}"></script> <!-- ${dep.displayName} (ESM) -->`)
    }
    injectedDeps.push(dep.packageName)
  }

  if (cssToInject.length === 0 && jsToInject.length === 0) {
    return { html, modified: false, injectedDeps: [] }
  }

  let modified = html

  // Insert CSS before </head> or before first <script> or after <head>
  if (cssToInject.length > 0) {
    const cssBlock = `\n  <!-- 🐙 Octopus: Auto-resolved CSS dependencies -->\n${cssToInject.join('\n')}\n`
    if (/<\/head>/i.test(modified)) {
      modified = modified.replace(/<\/head>/i, `${cssBlock}</head>`)
    } else if (/<head[^>]*>/i.test(modified)) {
      modified = modified.replace(/<head([^>]*)>/i, `<head$1>${cssBlock}`)
    }
  }

  // Insert JS before </body> or at end
  if (jsToInject.length > 0) {
    const jsBlock = `\n  <!-- 🐙 Octopus: Auto-resolved JS dependencies -->\n${jsToInject.join('\n')}\n`
    if (/<\/body>/i.test(modified)) {
      // Insert BEFORE any existing <script> tags near </body>, or before </body>
      // We want CDN deps to load BEFORE user's scripts
      const bodyCloseIdx = modified.search(/<\/body>/i)
      // Find the first <script that is NOT a CDN (user's script)
      const beforeBody = modified.substring(0, bodyCloseIdx)
      const lastScriptIdx = beforeBody.lastIndexOf('<script')
      if (lastScriptIdx > -1 && !beforeBody.substring(lastScriptIdx).includes('cdn') && !beforeBody.substring(lastScriptIdx).includes('esm.sh')) {
        // Insert before user's last script block
        const userScriptBlockStart = beforeBody.lastIndexOf('\n', lastScriptIdx)
        modified = modified.substring(0, userScriptBlockStart) + jsBlock + modified.substring(userScriptBlockStart)
      } else {
        modified = modified.replace(/<\/body>/i, `${jsBlock}</body>`)
      }
    } else {
      modified += jsBlock
    }
  }

  return { html: modified, modified: true, injectedDeps }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Lock File Generator — octopus.lock
// ═══════════════════════════════════════════════════════════════════════════════

function generateLockFile(deps: ResolvedDependency[]): string {
  const lines: string[] = [
    '# octopus.lock — Auto-generated by Octopus Dependency Resolver',
    `# Generated: ${new Date().toISOString()}`,
    `# Total dependencies: ${deps.length}`,
    '',
  ]

  // Group by category
  const byCategory = new Map<string, ResolvedDependency[]>()
  for (const d of deps) {
    const cat = d.category
    if (!byCategory.has(cat)) byCategory.set(cat, [])
    byCategory.get(cat)!.push(d)
  }

  for (const [cat, catDeps] of byCategory) {
    lines.push(`[${cat}]`)
    for (const d of catDeps) {
      lines.push(`${d.packageName}=${d.version}`)
      if (d.cdnJs) lines.push(`  cdn_js=${d.cdnJs}`)
      if (d.cdnEsm) lines.push(`  cdn_esm=${d.cdnEsm}`)
      if (d.cdnCss) lines.push(`  cdn_css=${d.cdnCss}`)
      if (d.globalVar) lines.push(`  global=${d.globalVar}`)
      lines.push(`  source=${d.source}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

// ═══════════════════════════════════════════════════════════════════════════════
// Apply resolved dependencies to staged commands
// ═══════════════════════════════════════════════════════════════════════════════

export function applyDependencyResolution(
  stagedCommands: StagedCommand[],
  scanResult: DependencyScanResult,
): { updatedCommands: StagedCommand[]; addedCommands: StagedCommand[] } {
  const updatedCommands = [...stagedCommands]
  const addedCommands: StagedCommand[] = []

  // Update HTML files with injected CDN tags
  for (const mod of scanResult.modifiedFiles) {
    const idx = updatedCommands.findIndex(
      c => c.type === 'write_file' && (c.payload.path as string)?.replace(/\\/g, '/') === mod.path
    )
    if (idx !== -1) {
      updatedCommands[idx] = {
        ...updatedCommands[idx],
        payload: { ...updatedCommands[idx].payload, content: mod.content },
      }
    }
  }

  // Add lock file as a write_file command
  if (scanResult.lockFileContent) {
    // Determine project root from existing commands
    const firstWriteFile = stagedCommands.find(c => c.type === 'write_file')
    const projectRoot = firstWriteFile
      ? (firstWriteFile.payload.path as string).split('/').slice(0, -1).join('/')
      : ''
    const lockPath = projectRoot ? `${projectRoot}/octopus.lock` : 'octopus.lock'

    addedCommands.push({
      type: 'write_file',
      payload: { action: 'write_file', path: lockPath, content: scanResult.lockFileContent },
      requiresConfirm: false,
      status: 'approved',
    })
  }

  // For Node.js projects, add npm install commands
  if (scanResult.needsInstall.length > 0) {
    const pkgList = scanResult.needsInstall.join(' ')
    addedCommands.push({
      type: 'execute_cmd',
      payload: { action: 'execute_cmd', command: `npm install ${pkgList}` },
      requiresConfirm: true,  // npm install requires user confirmation
      status: 'pending',
    })
  }

  return { updatedCommands, addedCommands }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Format scan result for SSE event payload
// ═══════════════════════════════════════════════════════════════════════════════

export function formatScanForSSE(scan: DependencyScanResult): {
  totalDetected: number
  resolved: { name: string; version: string; cdn: string; category: string }[]
  unresolvedCount: number
  isBrowser: boolean
  injectedFiles: string[]
  hasLockFile: boolean
  needsInstall: string[]
} {
  return {
    totalDetected: scan.detectedPackages.length,
    resolved: scan.resolved.map(r => ({
      name: r.displayName,
      version: r.version,
      cdn: r.cdnJs || r.cdnEsm || r.cdnCss || '',
      category: r.category,
    })),
    unresolvedCount: scan.unresolved.length,
    isBrowser: scan.isBrowserProject,
    injectedFiles: scan.modifiedFiles.map(f => f.path),
    hasLockFile: !!scan.lockFileContent,
    needsInstall: scan.needsInstall,
  }
}
