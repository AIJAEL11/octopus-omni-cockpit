'use client'

/**
 * 🔌 MCP SERVER — Conecta Claude Code (y cualquier cliente MCP) a OCTOPUS
 *
 * Expone /api/mcp (Model Context Protocol, Streamable HTTP). Con el token
 * de esta página, Claude Code puede crear proyectos Canvas, desplegarlos en
 * Octopus Hosting, leer analíticas de producción y forkear plantillas —
 * todo limitado a TU cuenta. El poder de OCTOPUS, desde la terminal.
 */

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Plug, Copy, Check, Eye, EyeOff, Terminal, ShieldCheck, Loader2,
  FolderOpen, FileCode, Plus, Rocket, Globe, BarChart3, LayoutTemplate,
  GitFork, Sparkles, MessageSquare, Zap, Server, FolderGit2, PlayCircle, ScanSearch,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'

interface McpInfo {
  token: string
  endpoint: string
  claudeCodeCommand: string
}

const TOOLS = [
  { icon: FolderOpen, name: 'list_projects', es: 'Lista tus proyectos del Canvas', en: 'List your Canvas projects' },
  { icon: FileCode, name: 'get_project', es: 'Lee todos los archivos de un proyecto', en: 'Read every file of a project' },
  { icon: Plus, name: 'create_project', es: 'Crea un proyecto web nuevo desde archivos', en: 'Create a new web project from files' },
  { icon: FileCode, name: 'update_files', es: 'Modifica archivos de un proyecto existente', en: 'Update files of an existing project' },
  { icon: Rocket, name: 'deploy_project', es: 'Publica en Octopus Hosting → URL pública', en: 'Publish to Octopus Hosting → public URL' },
  { icon: Globe, name: 'list_sites', es: 'Lista tus sitios publicados', en: 'List your live sites' },
  { icon: BarChart3, name: 'site_analytics', es: 'Visitas + errores JS reales (7 días)', en: 'Views + real JS errors (7 days)' },
  { icon: LayoutTemplate, name: 'search_templates', es: 'Explora el marketplace de plantillas', en: 'Browse the template marketplace' },
  { icon: GitFork, name: 'fork_template', es: 'Fork de una plantilla a tu Canvas', en: 'Fork a template into your Canvas' },
  // Code Engine — IDE full-stack con backend real
  { icon: Plus, name: 'ce_create_session', es: 'Crea una sesión full-stack del Code Engine', en: 'Create a full-stack Code Engine session' },
  { icon: FolderGit2, name: 'ce_list_sessions', es: 'Lista tus sesiones del Code Engine', en: 'List your Code Engine sessions' },
  { icon: FileCode, name: 'ce_get_files', es: 'Lee los archivos de una sesión', en: 'Read a session’s files' },
  { icon: Server, name: 'ce_write_files', es: 'Escribe código (incl. package.json) en la sesión', en: 'Write code (incl. package.json) to the session' },
  { icon: PlayCircle, name: 'ce_runtime_url', es: 'URL del runtime en vivo (Node.js en el navegador)', en: 'Live runtime URL (Node.js in the browser)' },
  { icon: Rocket, name: 'ce_deploy', es: 'Despliega la sesión → URL pública', en: 'Deploy the session → public URL' },
  { icon: Sparkles, name: 'ce_scaffold_saas', es: 'Inyecta un SaaS full-stack funcional (Next.js + Prisma + Auth + Stripe)', en: 'Inject a working full-stack SaaS (Next.js + Prisma + Auth + Stripe)' },
  { icon: ScanSearch, name: 'ce_generate_tests', es: 'Inyecta tests ejecutables (Vitest + Testing Library + Playwright) y cablea npm test', en: 'Inject runnable tests (Vitest + Testing Library + Playwright) and wire npm test' },
  { icon: Server, name: 'ce_deploy_vps', es: 'Despliega al VPS propio (Hostinger/SSH) y corre con PM2 — backend full-stack real', en: 'Deploy to your own VPS (Hostinger/SSH) and run with PM2 — real full-stack backend' },
]

export default function McpServerPage() {
  const { locale } = useI18n()
  const es = locale !== 'en'

  const [info, setInfo] = useState<McpInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [showToken, setShowToken] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/mcp/token')
      .then(r => r.json())
      .then(d => { if (d.token) setInfo(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function copy(key: string, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(c => (c === key ? null : c)), 2000)
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Plug className="text-emerald-500" size={24} />
          MCP Server
        </h1>
        <p className="text-sm opacity-60 mt-1">
          {es
            ? 'Conecta Claude Code (CLI/IDE), Claude Desktop o cualquier cliente MCP a tu cuenta de OCTOPUS. Desde la terminal podrán crear proyectos Canvas, desplegarlos con URL pública, leer analíticas de producción y forkear plantillas.'
            : 'Connect Claude Code (CLI/IDE), Claude Desktop or any MCP client to your OCTOPUS account. From the terminal they can build Canvas projects, deploy them to a public URL, read production analytics and fork templates.'}
        </p>
      </div>

      {/* Paso 1 — Comando de conexión */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/[0.03] p-5 mb-4"
      >
        <h2 className="text-sm font-semibold flex items-center gap-2 mb-1">
          <Terminal size={15} className="text-emerald-500" />
          {es ? '1 · Conecta Claude Code (un solo comando)' : '1 · Connect Claude Code (one command)'}
        </h2>
        <p className="text-xs opacity-50 mb-3">
          {es
            ? 'Pégalo en tu terminal (requiere Claude Code instalado: npm i -g @anthropic-ai/claude-code).'
            : 'Paste it in your terminal (requires Claude Code: npm i -g @anthropic-ai/claude-code).'}
        </p>
        {info ? (
          <div className="relative group">
            <pre className="text-[11px] leading-relaxed bg-black/90 text-emerald-300 rounded-xl p-3 pr-12 overflow-x-auto whitespace-pre-wrap break-all font-mono">
              {info.claudeCodeCommand}
            </pre>
            <button
              onClick={() => copy('cmd', info.claudeCodeCommand)}
              className="absolute top-2 right-2 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              title={es ? 'Copiar comando' : 'Copy command'}
            >
              {copied === 'cmd' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
          </div>
        ) : (
          <p className="text-xs text-red-500">{es ? 'Error cargando el token. Recarga la página.' : 'Error loading token. Reload the page.'}</p>
        )}
      </motion.div>

      {/* Paso 2 — Token + endpoint (otros clientes MCP) */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/[0.03] p-5 mb-4"
      >
        <h2 className="text-sm font-semibold flex items-center gap-2 mb-1">
          <Plug size={15} className="text-emerald-500" />
          {es ? '2 · Otros clientes MCP (endpoint + token)' : '2 · Other MCP clients (endpoint + token)'}
        </h2>
        <p className="text-xs opacity-50 mb-3">
          {es
            ? 'Transporte HTTP. Cabecera: Authorization: Bearer <token>. Funciona con Claude Desktop, Cursor y cualquier cliente compatible.'
            : 'HTTP transport. Header: Authorization: Bearer <token>. Works with Claude Desktop, Cursor and any compatible client.'}
        </p>
        {info && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wide opacity-40 w-16 shrink-0">Endpoint</span>
              <code className="flex-1 text-[11px] bg-black/5 dark:bg-white/5 rounded-lg px-3 py-2 font-mono truncate">{info.endpoint}</code>
              <button
                onClick={() => copy('ep', info.endpoint)}
                className="p-2 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              >
                {copied === 'ep' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} className="opacity-60" />}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wide opacity-40 w-16 shrink-0">Token</span>
              <code className="flex-1 text-[11px] bg-black/5 dark:bg-white/5 rounded-lg px-3 py-2 font-mono truncate">
                {showToken ? info.token : '•'.repeat(28) + info.token.slice(-6)}
              </code>
              <button
                onClick={() => setShowToken(s => !s)}
                className="p-2 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                title={showToken ? (es ? 'Ocultar' : 'Hide') : (es ? 'Mostrar' : 'Show')}
              >
                {showToken ? <EyeOff size={13} className="opacity-60" /> : <Eye size={13} className="opacity-60" />}
              </button>
              <button
                onClick={() => copy('tk', info.token)}
                className="p-2 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              >
                {copied === 'tk' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} className="opacity-60" />}
              </button>
            </div>
          </div>
        )}
        <div className="flex items-start gap-2 mt-3 text-[11px] opacity-50">
          <ShieldCheck size={13} className="shrink-0 mt-0.5 text-emerald-500" />
          <p>
            {es
              ? 'El token da acceso SOLO a tus proyectos Canvas, sitios y plantillas. No expone credenciales de brazos ni datos de otros usuarios. Trátalo como una contraseña.'
              : 'The token grants access ONLY to your Canvas projects, sites and templates. It never exposes arm credentials or other users\' data. Treat it like a password.'}
          </p>
        </div>
      </motion.div>

      {/* Paso 3 — Pruébalo */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5 mb-6"
      >
        <h2 className="text-sm font-semibold flex items-center gap-2 mb-2">
          <MessageSquare size={15} className="text-emerald-500" />
          {es ? '3 · Pídeselo a Claude Code' : '3 · Ask Claude Code'}
        </h2>
        <div className="space-y-1.5 text-[12px] font-mono opacity-80">
          <p>» {es ? 'crea una landing para mi cafetería con octopus y despliégala' : 'build a landing page for my coffee shop with octopus and deploy it'}</p>
          <p>» {es ? 'arma un SaaS Next.js + Prisma en el Code Engine y dame la URL del runtime' : 'build a Next.js + Prisma SaaS in the Code Engine and give me the runtime URL'}</p>
          <p>» {es ? 'haz un scaffold de SaaS con auth y pagos Stripe, luego ábrelo en el runtime' : 'scaffold a SaaS with auth and Stripe payments, then open it in the runtime'}</p>
          <p>» {es ? 'genera tests para mi proyecto del Code Engine y déjalos listos con npm test' : 'generate tests for my Code Engine project and wire them up with npm test'}</p>
          <p>» {es ? '¿qué errores JS tiene mi sitio en producción esta semana?' : 'any JS errors on my live site this week?'}</p>
          <p>» {es ? 'busca una plantilla SaaS en el marketplace y forkéala' : 'find a SaaS template in the marketplace and fork it'}</p>
        </div>
      </motion.div>

      {/* Catálogo de herramientas */}
      <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
        <Sparkles size={15} className="text-emerald-500" />
        {es ? '18 herramientas expuestas' : '18 exposed tools'}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {TOOLS.map((t, i) => (
          <motion.div
            key={t.name}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 + i * 0.03 }}
            className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/[0.03] p-3"
          >
            <div className="flex items-center gap-2 mb-1">
              <t.icon size={14} className="text-emerald-500 shrink-0" />
              <code className="text-[11px] font-semibold truncate">{t.name}</code>
            </div>
            <p className="text-[11px] opacity-50">{es ? t.es : t.en}</p>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
