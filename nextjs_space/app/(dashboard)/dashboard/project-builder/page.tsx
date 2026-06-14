'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Layout, Cloud, ShoppingCart, Briefcase, BarChart, Server,
  ArrowRight, ArrowLeft, Rocket, Zap, Github, Palette, Code,
  Check, Loader2, FileCode, FolderOpen, Eye, X, Sparkles,
  Globe, Monitor, Tablet, Smartphone, RefreshCw, Download, Wand2,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PROJECT_TYPES, ProjectType, ENJAMBRE_AGENTS, Agent, INDUSTRY_TEMPLATES, IndustryTemplate } from '@/lib/project-types'
import { useMetrics } from '@/lib/metrics-context'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n-context'

const iconMap: Record<string, React.ElementType> = {
  layout: Layout, cloud: Cloud, 'shopping-cart': ShoppingCart,
  briefcase: Briefcase, 'bar-chart': BarChart, server: Server,
  github: Github, palette: Palette, code: Code,
}

interface GeneratedFile {
  name: string
  path: string
  content: string
  fileType: string
}

interface BrandDNA {
  brandName: string
  colors: { primary: string; accent: string; bg: string }
  tone: string
}

// ============================================
// MINI PREVIEW — Visual preview of template
// ============================================
function MiniPreview({ template, brandDNA }: { template: IndustryTemplate; brandDNA: BrandDNA | null }) {
  const colors = brandDNA?.colors || template.previewColors
  const name = brandDNA?.brandName || template.name
  return (
    <div className="w-full h-32 rounded-lg overflow-hidden relative" style={{ backgroundColor: colors.bg }}>
      {/* Nav bar */}
      <div className="h-4 flex items-center px-2 gap-1" style={{ backgroundColor: colors.primary + '20' }}>
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors.primary }} />
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors.accent }} />
        <div className="w-8 h-1 rounded ml-2" style={{ backgroundColor: colors.primary + '40' }} />
      </div>
      {/* Hero */}
      <div className="px-3 py-2">
        <div className="h-1.5 w-16 rounded mb-1" style={{ backgroundColor: colors.primary }} />
        <div className="h-1 w-24 rounded mb-1" style={{ backgroundColor: colors.primary + '30' }} />
        <div className="h-1 w-20 rounded mb-2" style={{ backgroundColor: colors.primary + '20' }} />
        <div className="h-3 w-12 rounded-sm" style={{ backgroundColor: colors.accent }} />
      </div>
      {/* Sections */}
      <div className="px-3 flex gap-1">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex-1 h-8 rounded-sm" style={{ backgroundColor: colors.primary + '10' }}>
            <div className="h-4 w-full rounded-sm" style={{ backgroundColor: colors.primary + '08' }} />
            <div className="h-1 w-6 mx-auto mt-1 rounded" style={{ backgroundColor: colors.primary + '20' }} />
          </div>
        ))}
      </div>
      <div className="absolute bottom-1 right-1 text-[8px] font-bold opacity-20" style={{ color: colors.primary }}>
        {template.icon}
      </div>
    </div>
  )
}

// ============================================
// LIVE PREVIEW — Full rendered HTML preview
// ============================================
function LivePreview({ html, viewMode, expanded }: { html: string; viewMode: 'desktop' | 'tablet' | 'mobile'; expanded?: boolean }) {
  const widths = { desktop: '100%', tablet: '768px', mobile: '375px' }
  const previewHeight = expanded ? '75vh' : '500px'
  return (
    <div className="flex justify-center">
      <div style={{ width: widths[viewMode], maxWidth: '100%' }} className="transition-all duration-300">
        <div className="bg-[#2a2a2a] rounded-t-xl px-3 py-1.5 flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
          </div>
          <div className="flex-1 bg-[#1a1a1a] rounded px-3 py-0.5 text-[10px] text-white/30 font-mono truncate">
            octopus-project.local
          </div>
        </div>
        <iframe
          srcDoc={html}
          className="w-full rounded-b-xl border border-white/10"
          style={{ height: previewHeight, backgroundColor: '#fff' }}
          sandbox="allow-scripts"
          title="Preview"
        />
      </div>
    </div>
  )
}

// ============================================
// MAIN PAGE
// ============================================
export default function ProjectBuilderPage() {
  const router = useRouter()
  const { t } = useI18n()
  const { addActivity } = useMetrics()
  const [step, setStep] = useState(0) // 0 = templates, 1 = name, 2 = type, 3 = summary, 4 = building, 5 = done
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [selectedType, setSelectedType] = useState<ProjectType | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<IndustryTemplate | null>(null)
  const [isBuilding, setIsBuilding] = useState(false)
  const [agents, setAgents] = useState<Agent[]>(ENJAMBRE_AGENTS)
  const [progress, setProgress] = useState(0)
  const [files, setFiles] = useState<GeneratedFile[]>([])
  const [previewFile, setPreviewFile] = useState<GeneratedFile | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [brandDNA, setBrandDNA] = useState<BrandDNA | null>(null)
  const [viewMode, setViewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [previewHtml, setPreviewHtml] = useState<string>('')
  const [generatingPreview, setGeneratingPreview] = useState(false)
  const [aiGeneratedCode, setAiGeneratedCode] = useState('')
  const [customColors, setCustomColors] = useState<{ primary: string; accent: string; bg: string }>({ primary: '#2D4A3E', accent: '#C4622D', bg: '#1A1A1A' })
  const [aiHarmonize, setAiHarmonize] = useState(false)

  const projectTypes = Object.values(PROJECT_TYPES)

  // Load Brand DNA from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('octopus_brand_dna')
      if (saved) {
        const parsed = JSON.parse(saved)
        setBrandDNA(parsed)
        if (parsed.colors) {
          setCustomColors({ primary: parsed.colors.primary, accent: parsed.colors.accent, bg: parsed.colors.bg })
        }
      }
    } catch {}
  }, [])

  // Sync customColors when template changes
  useEffect(() => {
    if (selectedTemplate?.previewColors && !brandDNA) {
      setCustomColors(selectedTemplate.previewColors)
    }
  }, [selectedTemplate, brandDNA])

  // When template is selected, auto-fill fields
  const selectTemplate = (template: IndustryTemplate) => {
    setSelectedTemplate(template)
    if (template.id !== 'blank') {
      setSelectedType(template.projectType)
      if (!projectName) setProjectName(template.name)
      if (!projectDescription) setProjectDescription(template.description)
    }
    setStep(1)
  }

  const canProceed = () => {
    if (step === 0) return selectedTemplate !== null
    if (step === 1) return projectName.trim().length >= 3
    if (step === 2) return selectedType !== null
    return true
  }

  const handleNext = () => {
    if (step < 3) setStep(step + 1)
    else startBuilding()
  }

  // Generate Live Preview HTML via LLM
  const generatePreview = useCallback(async () => {
    if (!selectedTemplate && !selectedType) return
    setGeneratingPreview(true)

    const colors = customColors
    const template = selectedTemplate
    const sections = template?.sections || ['Hero', 'Features', 'CTA', 'Footer']
    const marca = brandDNA?.brandName || projectName || 'OCTOPUS'

    const colorDirective = aiHarmonize
      ? `PALETA CROMÁTICA (MODO ARMONIZACIÓN IA):
Los colores base del cliente son: Primario ${colors.primary}, Acento ${colors.accent}, Fondo ${colors.bg}.
PERO NO los uses tal cual si son demasiado saturados o agresivos. Tu trabajo es:
• Derivar una paleta sofisticada y armónica basada en esos colores
• Reducir saturación si es necesario, crear variantes más elegantes
• Usar los colores originales solo como acentos puntuales (botones CTA, bordes hover)
• El fondo debe ser profundo y cinematográfico (casi negro, con sutil gradiente)
• Texto siempre con contraste perfecto (WCAG AAA)
• Crea al menos 5 variantes tonales de cada color para depth visual`
      : `PALETA CROMÁTICA (COLORES EXACTOS DEL CLIENTE):
• Primario: ${colors.primary} — para elementos principales, headings, enlaces
• Acento: ${colors.accent} — exclusivamente para CTAs, botones, badges y énfasis
• Fondo principal: ${colors.bg} — fondo de secciones principales
• Texto claro: #FFFFFF o #F5F0E8
• Texto sobre fondo claro: #1A1A1A
• Crea variantes con opacity (primary/10, primary/20) para fondos de tarjetas`

    try {
      const res = await fetch('/api/preview/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `IDENTIDAD: Eres el Creative Director y Lead Engineer más cotizado del mundo digital. Tus landing pages han ganado premios Awwwards, FWA y CSS Design Awards. Cada pixel que colocas tiene intención. Cada decisión tipográfica comunica poder.

MISIÓN: Construir una landing page de NIVEL ESTUDIO para "${marca}" que provoque la reacción: "Esto parece hecho por una agencia de $50K".

CONTEXTO DEL PROYECTO:
• Marca: ${marca}
• Industria: ${template?.industry || selectedType || 'tecnología / plataforma digital'}
• Propósito: ${projectDescription || template?.description || 'Plataforma premium de alta conversión'}
• Secciones: ${sections.join(', ')}

═══════════════════════════════════════
${colorDirective}
═══════════════════════════════════════

SISTEMA TIPOGRÁFICO (NO NEGOCIABLE):
• Display/Títulos: "Plus Jakarta Sans", weight 800, letter-spacing: -0.03em
• Drama/Énfasis: "Cormorant Garamond" italic, para una sola palabra clave por título que se destaque en color acento
• Body: "Inter" o system-ui, weight 400, line-height 1.7
• Importa TODAS las fuentes via Google Fonts en <head>
• Escala tipográfica: Hero h1 = clamp(3rem, 6vw, 5rem), secciones h2 = clamp(2rem, 4vw, 3.5rem)

TEXTURA Y MICRODETALLES (lo que separa amateur de profesional):
• Overlay de ruido SVG (feTurbulence) a opacity 0.025 en body — NO más
• Bordes redondeados generosos: 1.5rem a 2.5rem en contenedores
• Sombras con color: box-shadow usando el color primario a opacity 0.1
• Transiciones globales: all 0.4s cubic-bezier(0.16, 1, 0.3, 1)
• Separadores sutiles con gradientes lineales semitransparentes entre secciones

COMPONENTES (CADA UNO DEBE SER MEMORABLE):

A) NAVBAR — Píldora flotante de cristal:
   • position:fixed, top:20px, left:50%, transform:translateX(-50%), max-width:900px
   • background: rgba del fondo a 0.7 + backdrop-filter:blur(20px) + border 1px solid rgba(255,255,255,0.08)
   • border-radius:100px. Logo "${marca}" bold a la izquierda. 3-4 links. CTA botón pequeño a la derecha
   • Al scroll: sombra más pronunciada, fondo más opaco

B) HERO — 100vh, composición cinematográfica de impacto:
   • Fondo: gradiente multi-stop profundo (del color bg hacia negro, con toque sutil del primario)
   • Imagen: USA una imagen de Unsplash REAL y RELEVANTE al negocio — formato: https://images.unsplash.com/photo-1644088379091-d574269d422f?fm=jpg&q=60&w=3000&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8dGVjaG5vbG9neSUyMGJhY2tncm91bmR8ZW58MHx8MHx8fDA%3D (busca IDs reales relacionados con ${template?.industry || 'tecnología'})
   • La imagen va como background con overlay gradiente oscuro (opacity 0.6-0.8) para legibilidad
   • Titular: La frase principal en Plus Jakarta Sans 800, y UNA palabra clave en Cormorant Garamond italic + color acento
   • Subtítulo: max-width:600px, opacity 0.75, weight 400
   • CTA primario: padding generoso, border-radius:100px, fondo color acento, hover:scale(1.05) + sombra
   • CTA secundario: ghost button (border only), mismo radius
   • Badge/chip arriba del título: "🚀 Nueva versión" o similar, pill con fondo primary/10
   • Animación CSS: @keyframes fadeInUp para aparición escalonada (animation-delay: 0.1s, 0.2s, 0.3s)

C) SOCIAL PROOF — Franja de confianza:
   • Texto: "Empresas que confían en ${marca}" en uppercase, letter-spacing:0.2em, opacity:0.4, font-size:0.75rem
   • 5-6 logos SVG inline (geométricos/abstractos) en gris claro, con opacity:0.3, hover:opacity:0.7
   • Separar con línea sutil arriba y abajo

D) FEATURES — Artefactos de software vivo:
   • Grid 3 columnas (responsive a 1 col en mobile)
   • Cada tarjeta: fondo glass (rgba blanco 0.03), border 1px rgba(255,255,255,0.06), border-radius:1.5rem
   • Icono SVG de 40x40 en contenedor circular con fondo primary/10
   • Título bold, descripción 2 líneas, pequeño link "Explorar →" en color acento
   • Hover: border-color cambia a acento/30, translateY(-4px), sombra con color primario

E) MANIFIESTO — Sección de alto contraste emocional:
   • Fondo oscuro intenso (el más oscuro de la página)
   • Layout: 2 columnas. Izquierda: texto grande comparativo "Lo convencional" (tachado, gris) vs "Lo que construimos" (bold, color acento)
   • Derecha: imagen de Unsplash relevante con border-radius:2rem y sombra profunda
   • Cita en Cormorant Garamond italic grande abajo

F) TESTIMONIOS — Prueba social premium:
   • 2-3 cards con: avatar circular (usa https://i.pravatar.cc/80?img=N), nombre, cargo, empresa
   • Texto de testimonio en italic, comillas decorativas grandes en color acento opacity 0.2
   • 5 estrellas SVG en color acento
   • Layout en row, scroll horizontal en mobile

G) CTA FINAL — Cierre con urgencia elegante:
   • Gradiente diagonal del primario al acento
   • Titular grande en blanco, subtítulo, botón invertido (fondo blanco, texto primario)
   • Efecto de fondo: gradiente animado (background-size:400% + animation) o partículas CSS simples
   • Micro-urgencia: "Disponible por tiempo limitado" o "Únete a +500 profesionales"

H) FOOTER — Minimalista premium:
   • Fondo: el color más oscuro
   • border-radius arriba: 2rem (border-top-left-radius, border-top-right-radius)
   • Grid de 3-4 columnas: Marca, Producto, Compañía, Legal
   • Línea divisoria sutil, copyright abajo
   • Detalle: "🟢 Sistema Activo" con punto verde pulsante (animation: pulse)

═══════════════════════════════════════
REGLAS DE ORO (ROMPER CUALQUIERA = FRACASO):
═══════════════════════════════════════
1. Devuelve EXCLUSIVAMENTE el HTML completo: <!DOCTYPE html>.....</html>
2. NO markdown, NO comentarios, NO explicaciones, NO \`\`\`html — SOLO el código
3. Incluye <script src="https://cdn.tailwindcss.com"></script> en <head>
4. Incluye Google Fonts via <link> (Plus Jakarta Sans 400;600;800, Cormorant Garamond 400i;600i, Inter 400;500)
5. Todo CSS extra en <style> dentro de <head> (animaciones, noise overlay, gradientes)
6. Imágenes de Unsplash con URLs COMPLETAS que funcionen (https://images.unsplash.com/photo-1496171367470-9ed9a91ea931?fm=jpg&q=60&w=3000&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8OHx8cmVzcG9uc2l2ZXxlbnwwfHwwfHx8MA%3D%3D)
7. Contenido REALISTA en español — CERO lorem ipsum, CERO placeholder text
8. Responsive perfecto: mobile-first, breakpoints en sm/md/lg/xl
9. Mínimo 6 secciones completas con contenido real
10. PROHIBIDO: fondos planos sin textura, botones cuadrados, tipografía genérica, colores sin variantes
11. Cada sección debe tener un "momento wow" visual que la haga memorable
12. El resultado debe parecer un sitio REAL EN PRODUCCIÓN, no un mockup de IA`,
        }),
      })

      if (!res.ok) {
        const errBody = await res.text().catch(() => '')
        console.error('Preview API error:', res.status, errBody.substring(0, 200))
        throw new Error(`API error ${res.status}`)
      }
      const reader = res.body?.getReader()
      if (!reader) throw new Error('No reader')

      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''
      let charCount = 0
      let engineLabel = 'IA'

      // Show streaming progress in the preview
      const showProgress = (chars: number, engine: string) => {
        const engineBadge = engine.includes('openrouter') 
          ? `<span style="display:inline-block;padding:4px 12px;background:linear-gradient(135deg,#FF6B00,#FF8C38);border-radius:100px;font-size:0.7rem;font-weight:700;letter-spacing:0.05em;margin-bottom:16px">🟠 ${engine.includes('claude') ? 'CLAUDE SONNET 4.6' : engine.split('/').pop()?.toUpperCase()}</span>`
          : `<span style="display:inline-block;padding:4px 12px;background:${customColors.primary}22;border:1px solid ${customColors.primary}44;border-radius:100px;font-size:0.7rem;font-weight:600;margin-bottom:16px">⚡ ABACUS AI</span>`
        setPreviewHtml(`<!DOCTYPE html><html><head><script src="https://cdn.tailwindcss.com"><\/script><style>@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}@keyframes spin{to{transform:rotate(360deg)}}@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}</style></head><body style="background:#0a0a0a;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0"><div style="text-align:center;max-width:420px;padding:40px">${engineBadge}<div style="width:52px;height:52px;border:3px solid ${customColors.primary}33;border-top-color:${customColors.primary};border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 20px"></div><h2 style="font-size:1.2rem;color:${customColors.primary};margin-bottom:6px;font-weight:700">Construyendo Landing Page</h2><p style="opacity:0.4;font-size:0.8rem;animation:pulse 2s infinite">${chars > 0 ? Math.round(Math.min(95, chars / 100)) + '% — Escribiendo código...' : 'Inicializando motor creativo...'}</p><div style="margin-top:20px;height:5px;background:#1a1a1a;border-radius:100px;overflow:hidden"><div style="height:100%;background:linear-gradient(90deg,${customColors.primary},${customColors.accent},${customColors.primary});background-size:200% 100%;animation:shimmer 2s linear infinite;width:${Math.min(95, chars / 100)}%;transition:width 0.5s ease-out;border-radius:100px"></div></div><p style="opacity:0.2;font-size:0.7rem;margin-top:12px">${chars > 0 ? (chars / 1000).toFixed(1) + 'K caracteres generados' : ''}</p></div></body></html>`)
      }
      showProgress(0, engineLabel)

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              // Handle engine info event from server
              if (parsed.engine) {
                engineLabel = parsed.engine
                showProgress(0, engineLabel)
                continue
              }
              if (parsed.content) {
                fullText += parsed.content
                charCount += parsed.content.length
                // Update progress sparingly to avoid iframe flicker (every ~3K chars)
                if (charCount < 500 || (charCount % 3000 < 80 && charCount > 1000)) showProgress(charCount, engineLabel)
              }
            } catch {}
          }
        }
      }

      // Extract HTML from response
      let finalHtml = ''
      const htmlMatch = fullText.match(/<!DOCTYPE[\s\S]*<\/html>/i) || fullText.match(/<html[\s\S]*<\/html>/i)
      if (htmlMatch) {
        finalHtml = htmlMatch[0]
      } else if (fullText.includes('<html') || fullText.includes('<body')) {
        // LLM ran out of tokens — auto-close the HTML so it renders what was generated
        finalHtml = fullText
        if (!finalHtml.includes('</body>')) finalHtml += '\n</body>'
        if (!finalHtml.includes('</html>')) finalHtml += '\n</html>'
        console.warn('Preview: HTML was truncated, auto-closed tags. Length:', fullText.length)
      } else {
        // Try stripping markdown fences
        const stripped = fullText.replace(/^```html?\s*/i, '').replace(/```\s*$/i, '').trim()
        if (stripped.includes('<html') || stripped.includes('<!DOCTYPE')) {
          finalHtml = stripped
          if (!finalHtml.includes('</html>')) finalHtml += '\n</body>\n</html>'
        } else {
          console.error('Preview: No HTML found in LLM response, length:', fullText.length)
          throw new Error('No HTML in response')
        }
      }
      setPreviewHtml(finalHtml)
      setAiGeneratedCode(finalHtml)
    } catch (err) {
      console.error('Preview generation error:', err)
      // Fallback static preview with error messaging
      setPreviewHtml(`<!DOCTYPE html><html><head><script src="https://cdn.tailwindcss.com"><\/script></head><body style="background:#0a0a0a;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0"><div style="text-align:center;max-width:420px;padding:40px"><div style="font-size:3rem;margin-bottom:16px">⚡</div><h2 style="font-size:1.5rem;color:${customColors.primary};margin-bottom:12px">${projectName || 'Mi Proyecto'}</h2><p style="opacity:0.6;font-size:0.9rem;line-height:1.6;margin-bottom:24px">${projectDescription || 'Tu landing page está lista para ser creada'}</p><div style="padding:14px 28px;background:linear-gradient(135deg,${customColors.primary},${customColors.accent});display:inline-block;border-radius:100px;font-weight:bold;font-size:0.9rem">Reintentar Generación</div><p style="opacity:0.3;font-size:0.75rem;margin-top:16px">Si el error persiste, intenta con menos secciones</p></div></body></html>`)
    } finally {
      setGeneratingPreview(false)
    }
  }, [selectedTemplate, selectedType, projectName, projectDescription, customColors, aiHarmonize, brandDNA])

  const startBuilding = async () => {
    if (!selectedType) return
    setIsBuilding(true)
    setStep(4)
    addActivity(`Iniciando proyecto: ${projectName}`, 'info')

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName,
          description: projectDescription,
          projectType: selectedType,
        }),
      })
      const data = await res.json()
      if (data.project) setProjectId(data.project.id)
      await runEnjambre(data.project?.id)
    } catch (err) {
      console.error('Error creating project:', err)
      addActivity('Error al crear proyecto', 'error')
    }
  }

  const runEnjambre = async (projId?: string) => {
    const tasks = [
      { agent: 0, task: 'Creando estructura del proyecto...', duration: 1200 },
      { agent: 0, task: 'Configurando dependencias...', duration: 800 },
      { agent: 1, task: 'Aplicando Brand DNA...', duration: 1000 },
      { agent: 1, task: 'Diseñando componentes...', duration: 1500 },
      { agent: 2, task: 'Generando código con IA...', duration: 2500 },
      { agent: 2, task: 'Aplicando estilos responsive...', duration: 1500 },
      { agent: 2, task: 'Optimizando para producción...', duration: 1000 },
    ]

    const totalTasks = tasks.length
    let completedTasks = 0

    for (const task of tasks) {
      setAgents(prev => prev.map((a, i) =>
        i === task.agent
          ? { ...a, status: 'working' as const, currentTask: task.task, progress: 0 }
          : i < task.agent
            ? { ...a, status: 'done' as const, progress: 100 }
            : a
      ))

      const progressInterval = setInterval(() => {
        setAgents(prev => prev.map((a, i) =>
          i === task.agent && a.progress < 100
            ? { ...a, progress: Math.min(a.progress + 10, 95) }
            : a
        ))
      }, task.duration / 10)

      await new Promise(resolve => setTimeout(resolve, task.duration))
      clearInterval(progressInterval)

      completedTasks++
      const overallProgress = Math.round((completedTasks / totalTasks) * 100)
      setProgress(overallProgress)

      if (projId) {
        await fetch(`/api/projects/${projId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            progress: overallProgress,
            agentLog: {
              agentName: agents[task.agent]?.name || 'Agent',
              agentType: agents[task.agent]?.type || 'frontend',
              message: task.task.replace('...', ' completado'),
              status: 'completed',
            },
          }),
        }).catch(() => {})
      }
    }

    setAgents(prev => prev.map(a => ({ ...a, status: 'done' as const, progress: 100 })))

    // Use AI-generated code if available, otherwise generate files
    const generatedFiles = generateProjectFiles(selectedType!, aiGeneratedCode)
    setFiles(generatedFiles)

    if (projId) {
      for (const file of generatedFiles) {
        await fetch(`/api/projects/${projId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'completed',
            file: { name: file.name, path: file.path, content: file.content, fileType: file.fileType, agentId: 'frontend-agent' },
          }),
        }).catch(() => {})
      }
    }

    // Generate preview if not already generated
    if (!previewHtml && aiGeneratedCode) {
      setPreviewHtml(aiGeneratedCode)
    }

    addActivity(`Proyecto ${projectName} creado exitosamente`, 'success')
    setIsBuilding(false)
    setStep(5)
  }

  const generateProjectFiles = (type: ProjectType, aiCode?: string): GeneratedFile[] => {
    const config = PROJECT_TYPES[type]
    const colors = customColors
    const brand = brandDNA?.brandName || projectName

    const baseFiles: GeneratedFile[] = [
      {
        name: 'page.tsx',
        path: '/app/page.tsx',
        fileType: 'tsx',
        content: aiCode
          ? `// ${brand} - Generado por OCTOPUS Omni Cockpit\n// Template: ${selectedTemplate?.name || 'Custom'}\n// Brand DNA Applied\n\n${aiCode}`
          : `// ${config.name} - Generado por Octopus\nimport { Hero } from '@/components/hero'\nimport { Features } from '@/components/features'\n\nexport default function Home() {\n  return (\n    <main className="min-h-screen">\n      <Hero title="${brand}" />\n      <Features />\n    </main>\n  )\n}`,
      },
      {
        name: 'globals.css',
        path: '/app/globals.css',
        fileType: 'css',
        content: `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n:root {\n  --primary: ${colors.primary};\n  --accent: ${colors.accent};\n  --background: ${colors.bg};\n}\n\nbody {\n  font-family: 'Inter', system-ui, sans-serif;\n  background: var(--background);\n}`,
      },
      {
        name: 'layout.tsx',
        path: '/app/layout.tsx',
        fileType: 'tsx',
        content: `import './globals.css'\nimport { Inter } from 'next/font/google'\n\nconst inter = Inter({ subsets: ['latin'] })\n\nexport const metadata = {\n  title: '${brand}',\n  description: '${projectDescription || config.description}',\n}\n\nexport default function RootLayout({\n  children,\n}: {\n  children: React.ReactNode\n}) {\n  return (\n    <html lang="es">\n      <body className={inter.className}>{children}</body>\n    </html>\n  )\n}`,
      },
      {
        name: 'package.json',
        path: '/package.json',
        fileType: 'json',
        content: `{\n  "name": "${projectName.toLowerCase().replace(/\s+/g, '-')}",\n  "version": "0.1.0",\n  "private": true,\n  "scripts": {\n    "dev": "next dev",\n    "build": "next build",\n    "start": "next start"\n  },\n  "dependencies": {\n    "next": "14.0.0",\n    "react": "18.2.0",\n    "react-dom": "18.2.0"\n  }\n}`,
      },
    ]

    if (brandDNA) {
      baseFiles.push({
        name: 'brand.config.ts',
        path: '/lib/brand.config.ts',
        fileType: 'ts',
        content: `// Brand DNA Configuration - Auto-generated from Ad Factory\nexport const BRAND = {\n  name: '${brandDNA.brandName}',\n  colors: {\n    primary: '${brandDNA.colors.primary}',\n    accent: '${brandDNA.colors.accent}',\n    background: '${brandDNA.colors.bg}',\n  },\n  tone: '${brandDNA.tone || 'professional'}',\n} as const`,
      })
    }

    return baseFiles
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-[#2D4A3E] to-[#1A1A1A] rounded-3xl p-8 text-[#F5F0E8]"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <Rocket className="w-8 h-8 text-[#C4622D]" />
              Project Foundry
              {brandDNA && (
                <span className="text-xs bg-[#FFD700]/20 text-[#FFD700] px-2 py-1 rounded-full ml-2">
                  🧬 Brand DNA: {brandDNA.brandName}
                </span>
              )}
            </h1>
            <p className="text-[#F5F0E8]/80 max-w-xl">
              {step === 0
                ? 'Elige una plantilla de industria o empieza desde cero. OCTOPUS generará tu proyecto con IA.'
                : 'Crea proyectos completos con el poder del Enjambre y tu Brand DNA.'}
            </p>
          </div>
          {step > 0 && step < 4 && (
            <div className="flex items-center gap-2">
              {[1, 2, 3].map(s => (
                <div
                  key={s}
                  className={`w-3 h-3 rounded-full transition-all ${
                    s === step ? 'bg-[#C4622D] scale-125' : s < step ? 'bg-[#F5F0E8]' : 'bg-[#F5F0E8]/30'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {/* ============================================ */}
        {/* STEP 0: Template Marketplace */}
        {/* ============================================ */}
        {step === 0 && (
          <motion.div key="step0" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#1A1A1A] flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#FFD700]" />
                Plantillas por Industria
              </h2>
              <span className="text-sm text-[#1A1A1A]/50">{INDUSTRY_TEMPLATES.length} plantillas</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {INDUSTRY_TEMPLATES.map(template => (
                <motion.button
                  key={template.id}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => selectTemplate(template)}
                  className={`text-left rounded-2xl overflow-hidden border-2 transition-all hover:shadow-lg ${
                    selectedTemplate?.id === template.id
                      ? 'border-[#FFD700] shadow-[#FFD700]/20 shadow-lg'
                      : 'border-transparent hover:border-[#2D4A3E]/20'
                  }`}
                >
                  <Card className="h-full !p-0 overflow-hidden">
                    {/* Mini Preview */}
                    <MiniPreview template={template} brandDNA={brandDNA} />
                    {/* Info */}
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">{template.icon}</span>
                        <h3 className="font-bold text-[#1A1A1A] text-sm">{template.name}</h3>
                      </div>
                      <p className="text-[10px] text-[#1A1A1A]/50 mb-2">{template.industry}</p>
                      <p className="text-xs text-[#1A1A1A]/70 leading-relaxed">{template.description}</p>
                      {template.sections.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {template.sections.slice(0, 3).map(s => (
                            <span key={s} className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#2D4A3E]/8 text-[#2D4A3E]/70">{s}</span>
                          ))}
                          {template.sections.length > 3 && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#C4622D]/10 text-[#C4622D]">+{template.sections.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ============================================ */}
        {/* STEP 1: Project Name */}
        {/* ============================================ */}
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card>
              {selectedTemplate && selectedTemplate.id !== 'blank' && (
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[#2D4A3E]/10">
                  <span className="text-2xl">{selectedTemplate.icon}</span>
                  <div>
                    <p className="text-xs text-[#1A1A1A]/50">Plantilla seleccionada</p>
                    <p className="font-bold text-[#1A1A1A]">{selectedTemplate.name}</p>
                  </div>
                  {brandDNA && (
                    <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FFD700]/10">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: brandDNA.colors.primary }} />
                      <span className="text-xs text-[#FFD700] font-medium">🧬 {brandDNA.brandName}</span>
                    </div>
                  )}
                </div>
              )}
              <h2 className="text-xl font-bold text-[#1A1A1A] mb-6">{t('pb.step1_title')}</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#1A1A1A] mb-2">{t('pb.name_label')}</label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={e => setProjectName(e.target.value)}
                    placeholder={t('pb.name_placeholder')}
                    className="w-full px-4 py-3 rounded-xl border border-[#2D4A3E]/20 focus:border-[#2D4A3E] focus:ring-2 focus:ring-[#2D4A3E]/20 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1A1A1A] mb-2">{t('pb.desc_label')}</label>
                  <textarea
                    value={projectDescription}
                    onChange={e => setProjectDescription(e.target.value)}
                    placeholder={t('pb.desc_placeholder')}
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-[#2D4A3E]/20 focus:border-[#2D4A3E] focus:ring-2 focus:ring-[#2D4A3E]/20 outline-none transition-all resize-none"
                  />
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* ============================================ */}
        {/* STEP 2: Project Type */}
        {/* ============================================ */}
        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card>
              <h2 className="text-xl font-bold text-[#1A1A1A] mb-6">{t('pb.step2_title')}</h2>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {projectTypes.map(type => {
                  const Icon = iconMap[type.icon] || Zap
                  const isSelected = selectedType === type.type
                  return (
                    <motion.button
                      key={type.type}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedType(type.type)}
                      className={`p-4 rounded-2xl border-2 text-left transition-all ${
                        isSelected ? 'border-[#2D4A3E] bg-[#2D4A3E]/5' : 'border-[#2D4A3E]/10 hover:border-[#2D4A3E]/30'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: `${type.color}20` }}>
                        <Icon className="w-6 h-6" style={{ color: type.color }} />
                      </div>
                      <h3 className="font-bold text-[#1A1A1A]">{type.name}</h3>
                      <p className="text-sm text-[#1A1A1A]/60 mt-1">{type.description}</p>
                      {isSelected && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {type.features.slice(0, 3).map(f => (
                            <span key={f} className="text-xs bg-[#2D4A3E]/10 text-[#2D4A3E] px-2 py-1 rounded-full">{f}</span>
                          ))}
                        </div>
                      )}
                    </motion.button>
                  )
                })}
              </div>
            </Card>
          </motion.div>
        )}

        {/* ============================================ */}
        {/* STEP 3: Summary + Generate Preview */}
        {/* ============================================ */}
        {step === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            {/* Compact Summary Bar */}
            <Card className="!p-4">
              <div className="flex flex-wrap items-start gap-4">
                {/* Project Info - compact */}
                <div className="flex-1 min-w-[200px]">
                  <h2 className="text-base font-bold text-[#1A1A1A] mb-2">{t('pb.step3_title')}</h2>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#1A1A1A]/70">
                    <span><b>{projectName}</b></span>
                    <span className="text-[#1A1A1A]/30">|</span>
                    <span>{selectedType && PROJECT_TYPES[selectedType].name}</span>
                    {selectedTemplate && selectedTemplate.id !== 'blank' && (
                      <><span className="text-[#1A1A1A]/30">|</span><span>{selectedTemplate.icon} {selectedTemplate.name}</span></>
                    )}
                    {brandDNA && (
                      <><span className="text-[#1A1A1A]/30">|</span><span>🧬 {brandDNA.brandName}</span></>
                    )}
                  </div>
                  {projectDescription && (
                    <p className="text-[11px] text-[#1A1A1A]/50 mt-1 line-clamp-1">{projectDescription}</p>
                  )}
                </div>

                {/* Colors - inline compact */}
                <div className="flex items-center gap-3 bg-[#FFD700]/5 rounded-xl px-3 py-2 border border-[#FFD700]/15">
                  <span className="text-[10px] font-bold text-[#FFD700]">🎨</span>
                  {([['primary', 'P'], ['accent', 'A'], ['bg', 'F']] as const).map(([key, label]) => (
                    <label key={key} className="relative cursor-pointer group flex items-center gap-1">
                      <div className="w-6 h-6 rounded-md border border-white/20 group-hover:border-[#FFD700]/50 transition-all shadow-sm" style={{ backgroundColor: customColors[key] }} />
                      <span className="text-[9px] text-[#1A1A1A]/40">{label}</span>
                      <input
                        type="color"
                        value={customColors[key]}
                        onChange={(e) => setCustomColors(prev => ({ ...prev, [key]: e.target.value }))}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                    </label>
                  ))}
                  <div className="flex items-center gap-1 ml-1">
                    <div className={`w-7 h-3.5 rounded-full transition-all relative cursor-pointer ${aiHarmonize ? 'bg-[#FFD700]' : 'bg-[#1A1A1A]/15'}`}
                      onClick={() => setAiHarmonize(!aiHarmonize)}>
                      <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white shadow transition-all ${aiHarmonize ? 'left-3.5' : 'left-0.5'}`} />
                    </div>
                    <span className="text-[9px] text-[#1A1A1A]/40">✨ Armonizar</span>
                  </div>
                </div>

                {/* Agents - pill badges */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {ENJAMBRE_AGENTS.slice(0, 4).map(agent => {
                    const Icon = iconMap[agent.icon] || Zap
                    return (
                      <div key={agent.id} className="flex items-center gap-1 bg-[#C4622D]/8 rounded-full px-2 py-1" title={agent.name}>
                        <Icon className="w-3 h-3" style={{ color: agent.color }} />
                        <span className="text-[9px] font-medium text-[#1A1A1A]/70">{agent.name.split(' ')[0]}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </Card>

            {/* Full-Width Preview — DOMINANT */}
            <Card className="!p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-[#1A1A1A] text-sm flex items-center gap-2">
                    <Eye className="w-4 h-4 text-[#2D4A3E]" />
                    Vista Previa IA
                  </h3>
                  {previewHtml && (
                    <div className="flex gap-1">
                      {([['desktop', Monitor], ['tablet', Tablet], ['mobile', Smartphone]] as const).map(([mode, Icon]) => (
                        <button
                          key={mode}
                          onClick={() => setViewMode(mode)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            viewMode === mode ? 'bg-[#2D4A3E] text-white' : 'bg-[#2D4A3E]/10 text-[#2D4A3E]/60 hover:bg-[#2D4A3E]/20'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={generatePreview}
                  disabled={generatingPreview}
                  className="text-xs h-8"
                >
                  {generatingPreview ? (
                    <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Generando...</>
                  ) : previewHtml ? (
                    <><RefreshCw className="w-3 h-3 mr-1" /> Regenerar</>
                  ) : (
                    <><Wand2 className="w-3 h-3 mr-1" /> Generar Preview</>
                  )}
                </Button>
              </div>
              {previewHtml ? (
                <LivePreview html={previewHtml} viewMode={viewMode} expanded />
              ) : (
                <div className="h-[50vh] rounded-xl bg-[#1A1A1A]/5 border-2 border-dashed border-[#2D4A3E]/20 flex flex-col items-center justify-center text-center p-8">
                  <Wand2 className="w-12 h-12 text-[#2D4A3E]/20 mb-4" />
                  <p className="text-sm text-[#1A1A1A]/40 mb-1">Haz click en <b>&quot;Generar Preview&quot;</b> para ver</p>
                  <p className="text-xs text-[#1A1A1A]/30">OCTOPUS diseñará tu proyecto con IA en tiempo real</p>
                </div>
              )}
            </Card>
          </motion.div>
        )}

        {/* ============================================ */}
        {/* STEP 4: Building */}
        {/* ============================================ */}
        {(step === 4 || step === 5) && (
          <motion.div key="step4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
            <Card>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-[#1A1A1A] flex items-center gap-2">
                  <Zap className="w-6 h-6 text-[#C4622D]" />
                  {isBuilding ? t('pb.building') : t('pb.completed')}
                </h2>
                <span className="text-2xl font-bold text-[#2D4A3E]">{progress}%</span>
              </div>
              <div className="h-4 bg-[#2D4A3E]/10 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className="h-full bg-gradient-to-r from-[#2D4A3E] to-[#C4622D] rounded-full"
                />
              </div>
            </Card>

            {/* Agents Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {agents.slice(0, 3).map(agent => {
                const Icon = iconMap[agent.icon] || Zap
                return (
                  <Card key={agent.id} className="relative overflow-hidden">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${agent.status === 'working' ? 'animate-pulse' : ''}`}
                        style={{ backgroundColor: `${agent.color}20` }}>
                        <Icon className="w-6 h-6" style={{ color: agent.color }} />
                      </div>
                      <div>
                        <p className="font-bold text-[#1A1A1A]">{agent.name}</p>
                        <p className="text-xs text-[#1A1A1A]/60">
                          {agent.status === 'idle' && 'Esperando...'}
                          {agent.status === 'working' && agent.currentTask}
                          {agent.status === 'done' && '✓ Completado'}
                        </p>
                      </div>
                    </div>
                    <div className="h-2 bg-[#2D4A3E]/10 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${agent.progress}%` }}
                        className="h-full rounded-full" style={{ backgroundColor: agent.color }} />
                    </div>
                    {agent.status === 'done' && (
                      <div className="absolute top-4 right-4"><Check className="w-5 h-5 text-green-500" /></div>
                    )}
                  </Card>
                )
              })}
            </div>

            {/* Live Preview + Files when done */}
            {step === 5 && (
              <>
                {/* Live Preview */}
                {previewHtml && (
                  <Card>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-[#1A1A1A] flex items-center gap-2">
                        <Globe className="w-5 h-5 text-[#2D4A3E]" />
                        Vista Previa en Vivo
                      </h3>
                      <div className="flex gap-1">
                        {([['desktop', Monitor], ['tablet', Tablet], ['mobile', Smartphone]] as const).map(([mode, Icon]) => (
                          <button
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              viewMode === mode ? 'bg-[#2D4A3E] text-white' : 'bg-[#2D4A3E]/10 text-[#2D4A3E]/60'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </button>
                        ))}
                      </div>
                    </div>
                    <LivePreview html={previewHtml} viewMode={viewMode} />
                  </Card>
                )}

                {/* Generated Files */}
                {files.length > 0 && (
                  <Card>
                    <h3 className="font-bold text-[#1A1A1A] mb-4 flex items-center gap-2">
                      <FolderOpen className="w-5 h-5 text-[#2D4A3E]" />
                      Archivos Generados
                    </h3>
                    <div className="space-y-2">
                      {files.map((file, i) => (
                        <motion.div
                          key={file.path}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="flex items-center justify-between p-3 bg-[#2D4A3E]/5 rounded-xl"
                        >
                          <div className="flex items-center gap-3">
                            <FileCode className="w-5 h-5 text-[#2D4A3E]" />
                            <div>
                              <p className="font-medium text-[#1A1A1A]">{file.name}</p>
                              <p className="text-xs text-[#1A1A1A]/50">{file.path}</p>
                            </div>
                          </div>
                          <button onClick={() => setPreviewFile(file)} className="p-2 hover:bg-[#2D4A3E]/10 rounded-lg transition-colors">
                            <Eye className="w-4 h-4 text-[#2D4A3E]" />
                          </button>
                        </motion.div>
                      ))}
                    </div>
                    <div className="mt-6 flex gap-3">
                      <Button className="flex-1" onClick={() => router.push('/dashboard/projects')}>
                        <FolderOpen className="w-4 h-4 mr-2" /> Ver en Proyectos
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setStep(0)
                          setProjectName('')
                          setProjectDescription('')
                          setSelectedType(null)
                          setSelectedTemplate(null)
                          setFiles([])
                          setAgents(ENJAMBRE_AGENTS)
                          setProgress(0)
                          setPreviewHtml('')
                          setAiGeneratedCode('')
                        }}
                      >
                        Crear Otro
                      </Button>
                    </div>
                  </Card>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      {step > 0 && step < 4 && (
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => setStep(Math.max(0, step - 1))}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {step === 1 ? 'Plantillas' : t('pb.prev')}
          </Button>
          <Button onClick={handleNext} disabled={!canProceed()}>
            {step === 3 ? (
              <><Rocket className="w-4 h-4 mr-2" /> {t('pb.build_project')}</>
            ) : (
              <>{t('pb.next')} <ArrowRight className="w-4 h-4 ml-2" /></>
            )}
          </Button>
        </div>
      )}

      {/* File Preview Modal */}
      <AnimatePresence>
        {previewFile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setPreviewFile(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-3xl p-6 max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <FileCode className="w-6 h-6 text-[#2D4A3E]" />
                  <div>
                    <h3 className="font-bold text-[#1A1A1A]">{previewFile.name}</h3>
                    <p className="text-sm text-[#1A1A1A]/60">{previewFile.path}</p>
                  </div>
                </div>
                <button onClick={() => setPreviewFile(null)} className="p-2 hover:bg-gray-100 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <pre className="flex-1 overflow-auto bg-[#1A1A1A] text-[#F5F0E8] p-4 rounded-xl text-sm font-mono">
                {previewFile.content}
              </pre>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
