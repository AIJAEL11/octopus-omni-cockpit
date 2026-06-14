// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 SPECIALIST LENSES — Skills especializadas para el Code Engine
// ───────────────────────────────────────────────────────────────────────────────
// En lugar de orquestar varios AGENTES (3x llamadas, latencia, riesgo de que un
// agente alucine y el siguiente herede el error), aplicamos LENTES de contexto:
// el MISMO modelo (Fable/Opus/Sonnet) recibe un bloque de sistema focalizado
// según la intención detectada en el mensaje del usuario. Cero overhead de
// coordinación, cero inconsistencia entre agentes — solo expertise dirigida.
//
// Cada lente se actualiza editando su `prompt` (p.ej. tendencias de diseño del
// mes). No requiere búsqueda web en vivo: el conocimiento vive en el prompt.
// ═══════════════════════════════════════════════════════════════════════════════

export type SpecialistLensId = 'ui' | 'api' | 'test' | 'design-trends' | 'seo' | 'geo'

export interface SpecialistLens {
  id: SpecialistLensId
  /** Nombre corto para UI */
  name: string
  /** Emoji para chips/badges */
  emoji: string
  /** Descripción ES para la página de skills */
  es: string
  /** Descripción EN */
  en: string
  /** Palabras clave (ES + EN) que activan la lente al aparecer en el mensaje */
  keywords: string[]
  /** Bloque de sistema que se inyecta cuando la lente está activa */
  prompt: string
}

// ───────────────────────────────────────────────────────────────────────────────
// Catálogo de lentes
// ───────────────────────────────────────────────────────────────────────────────

export const SPECIALIST_LENSES: SpecialistLens[] = [
  {
    id: 'ui',
    name: 'UI Craft',
    emoji: '🎨',
    es: 'Enfoca al modelo en UI: Tailwind, accesibilidad, responsive y animaciones — sin tocar backend',
    en: 'Focuses the model on UI: Tailwind, accessibility, responsive and motion — backend untouched',
    keywords: [
      'ui', 'interfaz', 'frontend', 'diseño', 'diseno', 'design', 'landing', 'página', 'pagina',
      'componente', 'component', 'tailwind', 'css', 'responsive', 'animación', 'animacion', 'animation',
      'hero', 'navbar', 'footer', 'modal', 'botón', 'boton', 'button', 'layout', 'estilo', 'style',
    ],
    prompt: `🎨 LENTE UI ACTIVA — Eres un especialista de interfaz de nivel Awwwards.
- Prioriza jerarquía visual, ritmo tipográfico y espaciado consistente (escala 4/8px).
- Accesibilidad obligatoria: contraste AA, foco visible, aria-labels, navegación por teclado, prefers-reduced-motion.
- Responsive mobile-first: cada layout debe respirar de 360px a 1440px+ sin scroll horizontal.
- Animaciones con propósito: transiciones de 150–300ms, easing natural, nunca animes layout-shift.
- NO toques la lógica de backend ni el esquema de datos salvo que el usuario lo pida explícitamente — esta lente es solo de presentación.`,
  },
  {
    id: 'api',
    name: 'API Design',
    emoji: '🔌',
    es: 'Enfoca al modelo en rutas, validación, manejo de errores y tipos — sin tocar UI',
    en: 'Focuses the model on routes, validation, error handling and types — UI untouched',
    keywords: [
      'api', 'endpoint', 'ruta', 'route', 'backend', 'servidor', 'server', 'prisma', 'base de datos',
      'database', 'db', 'rest', 'crud', 'auth', 'autenticación', 'autenticacion', 'webhook', 'middleware',
      'validación', 'validacion', 'validation', 'schema', 'modelo', 'query', 'mutation', 'graphql',
    ],
    prompt: `🔌 LENTE API ACTIVA — Eres un especialista de backend riguroso.
- Valida TODA entrada en el límite del servidor (zod/schema). Nunca confíes en el cliente.
- Manejo de errores explícito: códigos HTTP correctos (400/401/403/404/409/422/500), nunca tragues excepciones.
- Tipos estrictos extremo a extremo: deriva tipos del esquema, evita \`any\`.
- Seguridad: verifica ownership/sesión en cada handler; las credenciales se resuelven SOLO server-side y jamás se devuelven al cliente.
- Idempotencia y límites: pagina las listas, limita tamaños de payload, evita N+1 en queries.
- NO generes ni modifiques markup/estilos salvo que el usuario lo pida — esta lente es solo de lógica.`,
  },
  {
    id: 'test',
    name: 'Test Writer',
    emoji: '🧪',
    es: 'Enfoca al modelo en escribir tests coherentes con el código existente (Vitest + Playwright)',
    en: 'Focuses the model on writing tests coherent with the existing code (Vitest + Playwright)',
    keywords: [
      'test', 'tests', 'prueba', 'pruebas', 'testing', 'vitest', 'jest', 'playwright', 'e2e',
      'unit', 'unitario', 'cobertura', 'coverage', 'spec', 'mock', 'assert', 'tdd',
    ],
    prompt: `🧪 LENTE TEST ACTIVA — Eres un especialista en pruebas pragmático.
- LEE el código existente primero (en el contexto inyectado) y escribe tests que reflejen el comportamiento REAL, no inventado.
- Cubre el camino feliz + bordes (vacío, nulo, error, límites). Un test por comportamiento, nombres descriptivos.
- Unit/componente con Vitest + Testing Library; flujos críticos con Playwright E2E.
- Mockea solo los límites externos (red, DB, tiempo). No mockees lo que pruebas.
- Los tests deben ser deterministas: nada de sleeps arbitrarios ni dependencia de orden.
- Si una función no existe o el import no resuelve, dilo — NO inventes APIs para que el test "pase".`,
  },
  {
    id: 'design-trends',
    name: 'Design Trends',
    emoji: '✨',
    es: 'Inyecta tendencias de diseño actuales (bento, glass, oklch, etc.). Actualizable mensualmente',
    en: 'Injects current design trends (bento, glass, oklch, etc.). Updatable monthly',
    keywords: [
      'moderno', 'modern', 'tendencia', 'tendencias', 'trend', 'trendy', 'actual', '2026',
      'premium', 'elegante', 'elegant', 'minimalista', 'minimalist', 'glassmorphism', 'bento',
      'awwwards', 'wow', 'impresionante', 'stunning', 'vanguardia', 'cutting-edge',
    ],
    // ── ACTUALIZAR ESTE BLOQUE MENSUALMENTE con las tendencias del momento ──
    prompt: `✨ LENTE DESIGN-TRENDS ACTIVA — Aplica el lenguaje visual de vanguardia (rev. 2026-06):
- Color: paletas en oklch para gradientes perceptualmente uniformes; acentos saturados sobre neutros cálidos.
- Layout: bento grids asimétricos, secciones con profundidad por capas, mucho whitespace intencional.
- Superficie: glassmorphism sutil (blur + borde 1px translúcido), sombras suaves multicapa, no drop-shadows duros.
- Tipografía: display grande con tracking negativo, contraste fuerte con cuerpo legible; variable fonts.
- Movimiento: scroll-reveal escalonado, micro-interacciones en hover, parallax discreto; siempre respeta prefers-reduced-motion.
- Detalle: grain/noise sutil, bordes redondeados generosos (16–24px), iconografía consistente de un solo set.`,
  },
  {
    id: 'seo',
    name: 'SEO Optimizer',
    emoji: '🔍',
    es: 'Optimiza para buscadores y compartido social: meta tags, datos estructurados, semántica y performance',
    en: 'Optimizes for search and social sharing: meta tags, structured data, semantics and performance',
    keywords: [
      'seo', 'posicionamiento', 'buscador', 'buscadores', 'google', 'ranking', 'rankear',
      'meta', 'metadatos', 'metadata', 'open graph', 'opengraph', 'og', 'sitemap', 'indexar',
      'indexación', 'indexacion', 'schema.org', 'rich snippet', 'serp', 'organico', 'orgánico',
      'palabras clave', 'keyword', 'keywords', 'lighthouse', 'core web vitals', 'crawlable',
    ],
    prompt: `🔍 LENTE SEO ACTIVA — Eres un especialista en posicionamiento técnico on-page.
- HTML semántico: UN solo <h1> con la keyword principal, jerarquía <h2>/<h3> coherente, <main>/<nav>/<article>/<footer>, listas reales.
- <head> completo: <title> único 50–60 chars, <meta name="description"> 140–160 chars, <html lang="...">, <meta name="viewport">, <link rel="canonical">.
- Open Graph + Twitter Cards: og:title, og:description, og:image (1200×630), og:type, og:url, twitter:card="summary_large_image" — para que se vea bien al compartir.
- Datos estructurados JSON-LD (schema.org) apropiados al tipo: Organization/Product/Article/LocalBusiness/FAQPage según el contenido.
- Accesibilidad = SEO: alt descriptivo en TODA imagen, texto de enlaces significativo (no "click aquí"), aria-labels donde aplique.
- Performance (Core Web Vitals): imágenes con width/height para evitar CLS, loading="lazy" en lo below-the-fold, preconnect a orígenes críticos, sin bloqueos de render innecesarios.
- Si es multipágina, incluye un sitemap.xml básico y robots.txt amigable. URLs limpias y descriptivas.
- NO inventes métricas ni rankings — esta lente mejora la estructura, no promete posiciones.`,
  },
  {
    id: 'geo',
    name: 'GEO (AI Citation)',
    emoji: '🤖',
    es: 'Optimiza para que ChatGPT, Perplexity y Claude citen y recomienden la página — Generative Engine Optimization',
    en: 'Optimizes for ChatGPT, Perplexity and Claude to cite and recommend the page — Generative Engine Optimization',
    keywords: [
      'geo', 'citable', 'citar', 'citación', 'citation', 'ia me recomiende', 'llm', 'perplexity',
      'chatgpt me cite', 'claude me cite', 'generative engine', 'ai search', 'aeo',
      'visibilidad ia', 'visibilidad en ia', 'ai visibility', 'llms.txt', 'schema',
      'recomendación ia', 'citablehub', 'ai discovery', 'ai crawl',
    ],
    // ── ACTUALIZAR MENSUALMENTE con los LLMs que más usan los usuarios ──
    prompt: `🤖 LENTE GEO ACTIVA — Genera páginas que ChatGPT, Perplexity y Claude citen directamente (rev. 2026-06):

### ENTIDADES EXPLÍCITAS (obligatorio)
- Define la marca/producto con atributos concretos en el primer párrafo visible: nombre, categoría, propuesta de valor, ciudad/país si aplica.
- Usa el mismo nombre de marca consistentemente en TODA la página (evita "nosotros", "la empresa", pronombres vagos — los LLMs citan entidades, no pronombres).
- Añade JSON-LD Organization o Product con: name, description, url, logo, sameAs (redes sociales), contactPoint.

### STATEMENTS CITABLES (obligatorio)
- Escribe al menos 3 afirmaciones cortas, específicas y verificables que un LLM pueda extraer y citar:
  Bien: "OctoDrink usa 100% frutas naturales, sin conservantes, elaborada en Medellín desde 2024."
  Mal: "Somos los mejores y más naturales del mercado."
- Ponlas en párrafos cortos con una sola idea (no mezcles múltiples claims en la misma oración).
- Si hay estadísticas o números, inclúyelos ("reduce el tiempo en 40%", "más de 5,000 usuarios").

### FAQ SECTION (obligatorio para GEO)
- SIEMPRE incluye una sección FAQ con mínimo 4 preguntas en formato pregunta directa + respuesta de 2–4 líneas.
- Aplica schema FAQPage JSON-LD — es el tipo con mayor lift de citación por IA (GPT-4 pasa de 16% a 54% de citación con esta sola táctica).
- Preguntas deben ser las que realmente buscaría un usuario en Perplexity o ChatGPT sobre este producto/servicio.

### llms.txt (archivo extra del proyecto)
- Si es un proyecto multipágina o SaaS, genera un archivo \`llms.txt\` en la raíz con este formato exacto:
\`\`\`
# [Nombre del Proyecto]
> [Una línea: qué hace, para quién, propuesta de valor]

## Páginas clave
- [/ruta]: [descripción 1 línea]
- [/ruta2]: [descripción 1 línea]

## Sobre la marca
[2–3 líneas con entidad, fundador si aplica, diferenciadores clave]

## Contacto
- [email o URL de contacto]
\`\`\`

### ESTRUCTURA DE CONTENIDO (answer-first)
- Hero: claim principal arriba, específico y extractable. No empieces con taglines vacíos.
- Cada sección debe ser autocontenida — un LLM debe poder leer solo esa sección y entender de qué trata.
- Usa headings descriptivos (no "Nuestros servicios" → "Servicios de diseño web para startups en LATAM").
- Añade alt descriptivo en TODAS las imágenes (los LLMs leen los alts como contexto).

### VERIFICABILIDAD TÉCNICA
- robots.txt: NO bloquees GPTBot, ClaudeBot, PerplexityBot, GoogleBot.
- Asegura que el contenido sea SSR / visible en HTML estático (no dependa de JS para renderizar el texto citable).
- Canonical URL explícita en el <head>.`,
  },
]

// ───────────────────────────────────────────────────────────────────────────────
// Detección y composición
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Detecta qué lentes especializadas aplican según el mensaje del usuario.
 * Coincidencia por palabra clave (límites de palabra, case-insensitive).
 */
export function detectSpecialistLenses(message: string): SpecialistLens[] {
  if (!message || typeof message !== 'string') return []
  const msg = message.toLowerCase()
  const matched: SpecialistLens[] = []
  for (const lens of SPECIALIST_LENSES) {
    const hit = lens.keywords.some(kw => {
      // Límite de palabra para evitar falsos positivos (p.ej. "api" dentro de "rapido")
      const re = new RegExp(`(^|[^a-záéíóúñ])${escapeRegex(kw)}([^a-záéíóúñ]|$)`, 'i')
      return re.test(msg)
    })
    if (hit) matched.push(lens)
  }
  return matched
}

/**
 * Compone el bloque de contexto inyectable a partir de las lentes activas.
 * Devuelve '' si no hay ninguna.
 */
export function buildSpecialistContext(lenses: SpecialistLens[]): string {
  if (lenses.length === 0) return ''
  const blocks = lenses.map(l => l.prompt).join('\n\n')
  return `\n[SPECIALIST_LENSES — auto-activadas por intención, no las menciones literalmente al usuario]\n${blocks}\n[/SPECIALIST_LENSES]`
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
