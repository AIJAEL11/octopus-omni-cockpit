// JARVIS Eyes - Sistema de introspección y auto-mejora
// Permite a JARVIS ver su propio código y el sistema

export interface FileInfo {
  path: string
  content: string
  size: number
  modified: Date
  lines: number
}

export interface SearchResult {
  file: string
  line: number
  content: string
}

export interface SystemAnalysis {
  prompts: { file: string; description: string }
  actions: { file: string; description: string }
  intelligence: { file: string; description: string }
  capabilities: string[]
  improvements: string[]
}

// Funciones para usar desde el cliente (JARVIS page)
export async function introspectStructure(): Promise<{
  success: boolean
  structure?: {
    name: string
    version: string
    modules: { name: string; path: string; file: string }[]
    coreLibs: { name: string; file: string; description: string }[]
    apis: { name: string; path: string; method: string }[]
  }
}> {
  const res = await fetch('/api/jarvis/introspect?action=structure')
  return res.json()
}

export async function readFile(filePath: string): Promise<{
  success: boolean
  file?: FileInfo
  error?: string
}> {
  const res = await fetch(`/api/jarvis/introspect?action=read&file=${encodeURIComponent(filePath)}`)
  return res.json()
}

export async function listDirectory(dirPath: string): Promise<{
  success: boolean
  files?: { name: string; isDirectory: boolean; path: string }[]
  error?: string
}> {
  const res = await fetch(`/api/jarvis/introspect?action=list&file=${encodeURIComponent(dirPath)}`)
  return res.json()
}

export async function searchInCode(query: string, files?: string[]): Promise<{
  success: boolean
  results?: SearchResult[]
  query?: string
}> {
  const res = await fetch('/api/jarvis/introspect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'search', query, files })
  })
  return res.json()
}

export async function analyzeSelf(): Promise<{
  success: boolean
  analysis?: SystemAnalysis
}> {
  const res = await fetch('/api/jarvis/introspect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'analyze-self' })
  })
  return res.json()
}

export async function getSystemStats(): Promise<{
  success: boolean
  stats?: {
    totalModules: number
    totalApis: number
    coreLibs: number
    jarvisFiles: string[]
  }
}> {
  const res = await fetch('/api/jarvis/introspect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'stats' })
  })
  return res.json()
}

// Formato para mostrar código en el chat
export function formatCodeForChat(file: FileInfo): string {
  const preview = file.content.slice(0, 2000)
  const truncated = file.content.length > 2000
  
  return `📄 **${file.path}**
📊 ${file.lines} líneas | ${(file.size / 1024).toFixed(1)} KB

\`\`\`typescript
${preview}${truncated ? '\n// ... (truncado)' : ''}
\`\`\``
}

export function formatSearchResults(results: SearchResult[]): string {
  if (results.length === 0) return 'No se encontraron resultados.'
  
  const grouped: Record<string, SearchResult[]> = {}
  results.forEach(r => {
    if (!grouped[r.file]) grouped[r.file] = []
    grouped[r.file].push(r)
  })
  
  let output = `🔍 **${results.length} coincidencias encontradas:**\n\n`
  
  for (const [file, matches] of Object.entries(grouped)) {
    output += `📄 **${file}**\n`
    matches.slice(0, 5).forEach(m => {
      output += `  L${m.line}: \`${m.content.slice(0, 80)}${m.content.length > 80 ? '...' : ''}\`\n`
    })
    if (matches.length > 5) {
      output += `  ... y ${matches.length - 5} más\n`
    }
    output += '\n'
  }
  
  return output
}

export function formatAnalysis(analysis: SystemAnalysis): string {
  return `🧠 **Auto-Análisis de OCTOPUS**

📝 **Mis Archivos Principales:**
- Prompts: \`${analysis.prompts.file}\` - ${analysis.prompts.description}
- Acciones: \`${analysis.actions.file}\` - ${analysis.actions.description}
- Inteligencia: \`${analysis.intelligence.file}\` - ${analysis.intelligence.description}

✅ **Mis Capacidades Actuales:**
${analysis.capabilities.map(c => `- ${c}`).join('\n')}

🚀 **Mejoras Recientes:**
${analysis.improvements.map(i => `- ${i}`).join('\n')}`
}
