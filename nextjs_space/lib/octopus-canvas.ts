/**
 * OCTOPUS CANVAS — Proyectos completos renderizados en vivo dentro del chat
 *
 * Filosofía Lovable/Bolt pero agnóstica al modelo: el contrato es PURO TEXTO
 * (bloques de archivo), así CUALQUIER LLM (Claude, GPT, DeepSeek, Llama local
 * vía Ollama...) puede construir y desplegar un proyecto completo sin
 * depender de tool-calling nativo del proveedor.
 *
 * Contrato de formato que emite el modelo:
 *   <<<CANVAS title="Mi SaaS">>>          ← título (opcional, primera vez)
 *   ```file:index.html
 *   ...contenido COMPLETO del archivo...
 *   ```
 *   ```file:styles.css
 *   ...
 *   ```
 *
 * Sin dependencias de prisma/server — importable desde cliente y servidor.
 */

import { PREMIUM_DESIGN_SYSTEM } from './premium-design-system'

export interface CanvasFile {
  path: string
  content: string
}

export interface ParsedCanvas {
  title: string | null
  files: CanvasFile[]
  /** Texto del mensaje sin los bloques de archivo (lo que se muestra en el chat) */
  cleaned: string
}

/* ──────────────────────────────────────────────────────────────────────────
 * Detección de intención de construcción (ES/EN)
 * ────────────────────────────────────────────────────────────────────────── */

const BUILD_VERBS = /(crea(?:me|r)?|cr[eé]ame|hazme|haz|constr[uú]ye(?:me)?|genera(?:me)?|arma(?:me)?|dise[ñn]a(?:me)?|desarrolla(?:me)?|build|create|make|generate|design|develop|code)/i
const ARTIFACT_NOUNS = /(p[aá]gina\s+web|sitio\s+web|website|web\s*app|webapp|landing(?:\s*page)?|portfolio|portafolio|tienda(?:\s+(?:online|en\s*l[ií]nea|virtual))?|e-?commerce|dashboard|panel\s+de|aplicaci[oó]n|app\b|saas|formulario|juego|game|calculadora|calculator|blog|cv\b|curriculum|men[uú]\s+digital|invitaci[oó]n|quiz|encuesta|prototipo|prototype|mockup|interfaz|ui\b)/i

export function detectCanvasIntent(message: string): boolean {
  if (!message || message.length < 8) return false
  return BUILD_VERBS.test(message) && ARTIFACT_NOUNS.test(message)
}

/* ──────────────────────────────────────────────────────────────────────────
 * Prompt de sistema para el modo Canvas
 * ────────────────────────────────────────────────────────────────────────── */

export function buildCanvasPrompt(existing?: { title: string; files: { path: string }[] } | null): string {
  const base = `
## 🎨 MODO CANVAS — CONSTRUCCIÓN DE PROYECTOS WEB EN VIVO

El usuario pide construir algo web (página, app, SaaS, juego, dashboard...).
Tu proyecto se renderiza EN VIVO en un panel junto al chat. Reglas del contrato:

### FORMATO DE SALIDA (OBLIGATORIO)
1. Primera línea del proyecto: \`<<<CANVAS title="Título corto del proyecto">>>\`
2. Cada archivo en su propio bloque cercado así (la ruta va en el mismo renglón que las comillas):
\`\`\`file:index.html
<!DOCTYPE html>
...contenido COMPLETO...
\`\`\`
3. Después de los archivos, escribe 2-4 líneas resumiendo qué construiste y sugiriendo mejoras.

### REGLAS DE INGENIERÍA
- **index.html SIEMPRE** es el punto de entrada.
- Multi-archivo: separa \`styles.css\`, \`app.js\`, páginas extra (\`about.html\`), datos (\`data.json\`). Enlázalos con rutas RELATIVAS (\`./styles.css\`).
- **Archivos COMPLETOS**: nunca uses "..." ni "// resto igual". Cada bloque file: reemplaza el archivo entero.
- CDNs permitidos: Tailwind (\`<script src="https://cdn.tailwindcss.com"></script>\`), React UMD + Babel standalone, Chart.js, Three.js, fuentes de Google. Sin npm/build steps.
- Para SaaS completos: usa localStorage como base de datos, rutas hash (#/dashboard), y estructura el JS en módulos claros. Auth simulada con localStorage está bien — déjalo comentado en el código.
- Diseño SIEMPRE de ALTA GAMA: aplica el SISTEMA DE DISEÑO PREMIUM de abajo (§11–§14). Nivel agencia $100K, calidad Awwwards — no demo.
- Imágenes: usa https://picsum.photos o SVG inline. Nunca rutas locales inexistentes.

### ITERACIÓN
Si el usuario pide cambios sobre un proyecto existente, re-emite SOLO los archivos que cambian (completos), sin el tag <<<CANVAS>>> a menos que cambie el título. Los demás archivos se conservan.

═══════════════════════════════════════════════════════════════════════════════
SISTEMA DE DISEÑO PREMIUM (mismo de alta gama que entrega el Code Engine)
Adáptalo al contrato Canvas: en vez de \`write_file\`, emite los recipes dentro de
tus bloques \`\`\`file: (CSS en styles.css o <style>, animaciones con CSS/JS vanilla
o Tailwind por CDN). Las recetas de tokens, glass, motion, componentes y responsive
aplican IGUAL en HTML/CSS estático.
═══════════════════════════════════════════════════════════════════════════════

${PREMIUM_DESIGN_SYSTEM}`

  if (existing && existing.files.length > 0) {
    return base + `

### 📦 PROYECTO ACTIVO EN EL CANVAS
Título: "${existing.title}"
Archivos actuales: ${existing.files.map(f => f.path).join(', ')}
El usuario está iterando sobre ESTE proyecto. Modifica lo que pida re-emitiendo los archivos afectados completos.`
  }

  return base
}

/* ──────────────────────────────────────────────────────────────────────────
 * Parser de bloques de archivo
 * ────────────────────────────────────────────────────────────────────────── */

const TITLE_RE = /<<<CANVAS\s+title="([^"]{1,120})"\s*>>>/
// ```file:ruta  ó  ```file: ruta  — termina en ``` al inicio de línea
const FILE_BLOCK_RE = /```file:\s*([^\n`]+)\n([\s\S]*?)```/g

/** Sanea una ruta de archivo: relativa, sin .., sin / inicial */
export function sanitizeCanvasPath(raw: string): string | null {
  const p = raw.trim().replace(/^\.?\//, '').replace(/\\/g, '/')
  if (!p || p.length > 180) return null
  if (p.includes('..') || p.startsWith('/') || /[<>:"|?*\0]/.test(p)) return null
  if (!/^[\w\-./ ]+$/.test(p)) return null
  return p
}

export function parseCanvasFiles(text: string): ParsedCanvas {
  const files: CanvasFile[] = []
  let title: string | null = null

  const titleMatch = text.match(TITLE_RE)
  if (titleMatch) title = titleMatch[1].trim()

  let cleaned = text
  let m: RegExpExecArray | null
  FILE_BLOCK_RE.lastIndex = 0
  while ((m = FILE_BLOCK_RE.exec(text)) !== null) {
    const path = sanitizeCanvasPath(m[1])
    const content = m[2]
    if (path && content.trim().length > 0) {
      // Último bloque gana si el modelo repite una ruta
      const idx = files.findIndex(f => f.path === path)
      if (idx >= 0) files[idx] = { path, content }
      else files.push({ path, content })
    }
  }

  cleaned = cleaned
    .replace(FILE_BLOCK_RE, '')
    .replace(TITLE_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return { title, files, cleaned }
}

/** Quita bloques de archivo (incluso incompletos durante streaming) para display */
export function stripCanvasBlocksForDisplay(text: string): string {
  return text
    .replace(FILE_BLOCK_RE, '📄 *(archivo generado)*\n')
    .replace(/```file:[^\n]*\n[\s\S]*$/, '⚙️ *(generando archivos...)*')
    .replace(TITLE_RE, '')
}

/** Content-Type por extensión para servir el preview */
export function contentTypeFor(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = {
    html: 'text/html; charset=utf-8',
    htm: 'text/html; charset=utf-8',
    css: 'text/css; charset=utf-8',
    js: 'application/javascript; charset=utf-8',
    mjs: 'application/javascript; charset=utf-8',
    json: 'application/json; charset=utf-8',
    svg: 'image/svg+xml',
    txt: 'text/plain; charset=utf-8',
    md: 'text/plain; charset=utf-8',
    xml: 'application/xml',
    webmanifest: 'application/manifest+json',
  }
  return map[ext] || 'text/plain; charset=utf-8'
}
