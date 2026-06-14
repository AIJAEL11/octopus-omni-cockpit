'use client'

/**
 * NUEVA CARA — Home chat-first estilo Gemini/Claude
 *
 * El chat ES la casa: el usuario pide y OCTOPUS trae las herramientas
 * a la mesa (crea skills, agentes, MCPs, páginas web... solo).
 * El cockpit clásico con métricas vive ahora en /dashboard/cockpit.
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowUp, LayoutGrid, X, Gauge } from 'lucide-react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n-context'

interface ModuleDef {
  emoji: string
  nameEs: string
  nameEn: string
  href: string
  group: string
}

const MODULES: ModuleDef[] = [
  // Crear
  { emoji: '🎨', nameEs: 'Estudio Creativo', nameEn: 'Creative Studio', href: '/dashboard/chat', group: 'create' },
  { emoji: '💻', nameEs: 'Code Engine', nameEn: 'Code Engine', href: '/dashboard/claude-code', group: 'create' },
  { emoji: '🎬', nameEs: 'UGC Factory', nameEn: 'UGC Factory', href: '/dashboard/ugc-factory', group: 'create' },
  { emoji: '✨', nameEs: 'Motion Graphics', nameEn: 'Motion Graphics', href: '/dashboard/motion-graphics', group: 'create' },
  { emoji: '📣', nameEs: 'Ad Factory', nameEn: 'Ad Factory', href: '/dashboard/ad-factory', group: 'create' },
  { emoji: '📦', nameEs: 'Mis Proyectos', nameEn: 'My Projects', href: '/dashboard/projects', group: 'create' },
  { emoji: '🧬', nameEs: 'Plantillas Comunidad', nameEn: 'Community Templates', href: '/dashboard/canvas-templates', group: 'create' },
  // Vender
  { emoji: '📈', nameEs: 'Growth Engine', nameEn: 'Growth Engine', href: '/dashboard/growth', group: 'sell' },
  { emoji: '💬', nameEs: 'Sales Agent', nameEn: 'Sales Agent', href: '/dashboard/sales-agent', group: 'sell' },
  { emoji: '🎙️', nameEs: 'Voice Agent', nameEn: 'Voice Agent', href: '/dashboard/voice-agent', group: 'sell' },
  { emoji: '🧾', nameEs: 'Facturación', nameEn: 'Invoices', href: '/dashboard/invoices', group: 'sell' },
  { emoji: '📅', nameEs: 'Agenda', nameEn: 'Calendar', href: '/dashboard/calendar', group: 'sell' },
  { emoji: '🔭', nameEs: 'Web Intelligence', nameEn: 'Web Intelligence', href: '/dashboard/website-intelligence', group: 'sell' },
  // Automatizar
  { emoji: '🔗', nameEs: 'Automatización', nameEn: 'Automation', href: '/dashboard/automation', group: 'automate' },
  { emoji: '📡', nameEs: 'Omnicanal', nameEn: 'Omnichannel', href: '/dashboard/channels', group: 'automate' },
  { emoji: '🖥️', nameEs: 'Browser Automation', nameEn: 'Browser Automation', href: '/dashboard/browser-automation', group: 'automate' },
  { emoji: '🛠️', nameEs: 'Skill Factory', nameEn: 'Skill Factory', href: '/dashboard/skill-factory', group: 'automate' },
  { emoji: '🤖', nameEs: 'Agent Factory', nameEn: 'Agent Factory', href: '/dashboard/agent-factory', group: 'automate' },
  { emoji: '👥', nameEs: 'Multi-Agente', nameEn: 'Multi-Agent', href: '/dashboard/multi-agent-chat', group: 'automate' },
  // Sistema
  { emoji: '🏠', nameEs: 'Hogar Inteligente', nameEn: 'Smart Home', href: '/dashboard/hogar', group: 'system' },
  { emoji: '🦾', nameEs: 'Brazos Activos', nameEn: 'Active Arms', href: '/dashboard/brazos', group: 'system' },
  { emoji: '🧠', nameEs: 'Ollama Chat', nameEn: 'Ollama Chat', href: '/dashboard/ollama-chat', group: 'system' },
  { emoji: '🔑', nameEs: 'API Hub', nameEn: 'API Hub', href: '/dashboard/api-hub', group: 'system' },
  { emoji: '🔌', nameEs: 'MCP Server', nameEn: 'MCP Server', href: '/dashboard/mcp-server', group: 'system' },
  { emoji: '📋', nameEs: 'Tareas', nameEn: 'Tasks', href: '/dashboard/tasks', group: 'system' },
  { emoji: '⚙️', nameEs: 'Ajustes', nameEn: 'Settings', href: '/dashboard/settings', group: 'system' },
]

const GROUPS = [
  { id: 'create', labelEs: '🎨 Crear', labelEn: '🎨 Create' },
  { id: 'sell', labelEs: '💰 Vender', labelEn: '💰 Sell' },
  { id: 'automate', labelEs: '⚡ Automatizar', labelEn: '⚡ Automate' },
  { id: 'system', labelEs: '🐙 Sistema', labelEn: '🐙 System' },
]

export default function ChatFirstHome() {
  const router = useRouter()
  const { data: session } = useSession() || {}
  const { locale } = useI18n()
  const es = locale !== 'en'

  const [query, setQuery] = useState('')
  const [showModules, setShowModules] = useState(false)
  const [greeting, setGreeting] = useState('')

  const firstName = (session?.user?.name || '').split(' ')[0] || ''

  useEffect(() => {
    const h = new Date().getHours()
    if (es) setGreeting(h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches')
    else setGreeting(h < 12 ? 'Good morning' : h < 19 ? 'Good afternoon' : 'Good evening')
  }, [es])

  function ask(text: string) {
    const q = text.trim()
    if (!q) return
    router.push(`/dashboard/jarvis?q=${encodeURIComponent(q)}`)
  }

  const suggestions = es
    ? [
        { emoji: '🌐', text: 'Créame una página web para mi negocio' },
        { emoji: '🖼️', text: 'Genera una imagen de un pulpo astronauta' },
        { emoji: '📊', text: 'Dame un reporte de mi pipeline de ventas' },
        { emoji: '💡', text: 'Enciende las luces de la sala' },
        { emoji: '🛠️', text: 'Créame una skill que publique en LinkedIn cada lunes' },
        { emoji: '🔍', text: 'Investiga a mi competencia' },
      ]
    : [
        { emoji: '🌐', text: 'Build me a website for my business' },
        { emoji: '🖼️', text: 'Generate an image of an astronaut octopus' },
        { emoji: '📊', text: 'Give me a report on my sales pipeline' },
        { emoji: '💡', text: 'Turn on the living room lights' },
        { emoji: '🛠️', text: 'Create a skill that posts to LinkedIn every Monday' },
        { emoji: '🔍', text: 'Research my competitors' },
      ]

  return (
    <div className="relative min-h-full flex flex-col items-center justify-center px-4 py-12 overflow-hidden">

      {/* Ambient glow background */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="w-[700px] h-[700px] rounded-full bg-gradient-to-br from-purple-600/15 via-blue-500/10 to-transparent blur-3xl" />
      </div>

      {/* Cockpit shortcut (top-right) */}
      <Link
        href="/dashboard/cockpit"
        className="absolute top-4 right-4 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-black/10 dark:border-white/10 opacity-60 hover:opacity-100 transition-opacity"
      >
        <Gauge size={13} />
        {es ? 'Cockpit clásico' : 'Classic cockpit'}
      </Link>

      <div className="relative z-10 w-full max-w-2xl flex flex-col items-center">

        {/* Logo + greeting */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="text-5xl mb-4">🐙</div>
          <h1 className="text-3xl md:text-4xl font-semibold">
            <span className="bg-gradient-to-r from-purple-500 via-blue-500 to-emerald-400 bg-clip-text text-transparent">
              {greeting}{firstName ? `, ${firstName}` : ''}
            </span>
          </h1>
          <p className="mt-2 text-sm opacity-50">
            {es
              ? 'Pídeme lo que sea — yo creo las herramientas y las traigo a la mesa'
              : 'Ask me anything — I build the tools and bring them to the table'}
          </p>
        </motion.div>

        {/* Big input */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="w-full"
        >
          <div className="flex items-center gap-2 w-full rounded-full border border-black/10 dark:border-white/15 bg-white/70 dark:bg-white/5 backdrop-blur-md shadow-lg px-5 py-2 focus-within:border-purple-500/50 focus-within:shadow-purple-500/10 transition-all">
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') ask(query) }}
              placeholder={es ? 'Pídele a OCTOPUS…' : 'Ask OCTOPUS…'}
              className="flex-1 bg-transparent py-2.5 text-base focus:outline-none placeholder:opacity-40"
            />
            <button
              onClick={() => ask(query)}
              disabled={!query.trim()}
              className="p-2.5 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 text-white disabled:opacity-30 transition-opacity flex-shrink-0"
            >
              <ArrowUp size={17} />
            </button>
          </div>
        </motion.div>

        {/* Suggestion chips */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="flex flex-wrap justify-center gap-2 mt-6"
        >
          {suggestions.map(s => (
            <button
              key={s.text}
              onClick={() => ask(s.text)}
              className="text-xs px-3.5 py-2 rounded-full border border-black/10 dark:border-white/10 bg-white/40 dark:bg-white/5 hover:border-purple-500/40 hover:bg-purple-500/5 transition-colors"
            >
              {s.emoji} {s.text}
            </button>
          ))}
        </motion.div>

        {/* Modules launcher toggle */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          onClick={() => setShowModules(o => !o)}
          className="mt-10 flex items-center gap-2 text-xs opacity-50 hover:opacity-90 transition-opacity"
        >
          {showModules ? <X size={14} /> : <LayoutGrid size={14} />}
          {showModules
            ? (es ? 'Ocultar módulos' : 'Hide modules')
            : (es ? 'Explorar toda la plataforma' : 'Explore the full platform')}
        </motion.button>

        {/* Modules grid */}
        <AnimatePresence>
          {showModules && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="w-full overflow-hidden"
            >
              <div className="mt-6 space-y-5 pb-4">
                {GROUPS.map(group => (
                  <div key={group.id}>
                    <p className="text-xs font-medium opacity-40 uppercase tracking-wider mb-2">
                      {es ? group.labelEs : group.labelEn}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {MODULES.filter(m => m.group === group.id).map(m => (
                        <Link
                          key={m.href}
                          href={m.href}
                          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-black/5 dark:border-white/5 bg-white/40 dark:bg-white/5 hover:border-purple-500/30 hover:bg-purple-500/5 transition-colors text-sm"
                        >
                          <span className="text-lg">{m.emoji}</span>
                          <span className="truncate">{es ? m.nameEs : m.nameEn}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
