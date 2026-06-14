'use client'

/**
 * 🧬 MARKETPLACE DE PLANTILLAS — galería de la comunidad Canvas
 *
 * Plantillas publicadas por usuarios. Un click → fork a TU canvas y la
 * personalizas por chat ("ponle mi logo y mis precios"). Quien publica
 * gana créditos por cada fork (efecto red comunidad).
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Search, Loader2, GitFork, Zap, User, FileCode, Trash2,
  LayoutTemplate, Sparkles,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'

interface Template {
  id: string
  name: string
  description: string
  author: string
  category: string
  forks: number
  credits: number
  files: number
  updatedAt: string
  isMine: boolean
}

const CATEGORIES = [
  { id: 'all', es: 'Todas', en: 'All' },
  { id: 'landing', es: 'Landing', en: 'Landing' },
  { id: 'saas', es: 'SaaS', en: 'SaaS' },
  { id: 'portfolio', es: 'Portafolio', en: 'Portfolio' },
  { id: 'ecommerce', es: 'Tienda', en: 'Store' },
  { id: 'dashboard', es: 'Dashboard', en: 'Dashboard' },
  { id: 'general', es: 'General', en: 'General' },
]

export default function CanvasTemplatesPage() {
  const router = useRouter()
  const { locale } = useI18n()
  const es = locale !== 'en'

  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [forking, setForking] = useState<string | null>(null)
  const [onlyMine, setOnlyMine] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (category !== 'all') params.set('category', category)
      if (onlyMine) params.set('mine', '1')
      const res = await fetch(`/api/canvas/templates?${params}`)
      const data = await res.json()
      setTemplates(data.templates || [])
    } catch {
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }, [search, category, onlyMine])

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [load, search])

  async function fork(templateId: string) {
    setForking(templateId)
    try {
      const res = await fetch('/api/canvas/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fork', templateId }),
      })
      const data = await res.json()
      if (data.success && data.projectId) {
        // Abrir en el Canvas del chat — el jarvis carga ?canvas= al montar
        router.push(`/dashboard/jarvis?canvas=${data.projectId}`)
      }
    } catch { /* ignore */ } finally {
      setForking(null)
    }
  }

  async function unpublish(templateId: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(es ? '¿Despublicar esta plantilla?' : 'Unpublish this template?')) return
    await fetch(`/api/canvas/templates?templateId=${templateId}`, { method: 'DELETE' })
    setTemplates(prev => prev.filter(t => t.id !== templateId))
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <LayoutTemplate className="text-purple-500" size={24} />
          {es ? 'Plantillas de la Comunidad' : 'Community Templates'}
        </h1>
        <p className="text-sm opacity-60 mt-1">
          {es
            ? 'Abre cualquier plantilla en tu Canvas con un click y personalízala por chat. Publica las tuyas y gana créditos por cada fork.'
            : 'Open any template in your Canvas with one click and customize it via chat. Publish yours and earn credits per fork.'}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/5 dark:bg-white/5 flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="opacity-50" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={es ? 'Buscar plantillas…' : 'Search templates…'}
            className="flex-1 bg-transparent outline-none text-sm placeholder:opacity-40"
          />
        </div>
        {CATEGORIES.map(c => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              category === c.id
                ? 'bg-purple-500/15 text-purple-500 border border-purple-500/30'
                : 'bg-black/5 dark:bg-white/5 opacity-60 hover:opacity-100 border border-transparent'
            }`}
          >
            {es ? c.es : c.en}
          </button>
        ))}
        <button
          onClick={() => setOnlyMine(m => !m)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
            onlyMine
              ? 'bg-blue-500/15 text-blue-500 border border-blue-500/30'
              : 'bg-black/5 dark:bg-white/5 opacity-60 hover:opacity-100 border border-transparent'
          }`}
        >
          <User size={11} /> {es ? 'Mías' : 'Mine'}
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={24} className="animate-spin text-purple-500" />
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-2 opacity-50">
          <Sparkles size={28} />
          <p className="text-sm">
            {es
              ? 'Aún no hay plantillas. ¡Publica la primera desde tu Canvas (botón Deploy → Publicar como plantilla)!'
              : 'No templates yet. Publish the first one from your Canvas (Deploy button → Publish as template)!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {templates.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="group rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/[0.03] overflow-hidden hover:border-purple-500/40 hover:shadow-lg hover:shadow-purple-500/5 transition-all"
            >
              {/* Live thumbnail */}
              <div className="relative h-40 bg-neutral-100 dark:bg-black/40 overflow-hidden">
                <iframe
                  src={`/api/canvas/preview/${t.id}/index.html`}
                  sandbox="allow-same-origin"
                  loading="lazy"
                  className="w-[200%] h-[200%] origin-top-left scale-50 pointer-events-none border-0 bg-white"
                  title={t.name}
                  tabIndex={-1}
                />
                <div className="absolute inset-0" /> {/* bloquea interacción */}
                {t.isMine && (
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-blue-500/90 text-white text-[10px] font-medium">
                    {es ? 'Tuya' : 'Yours'}
                  </span>
                )}
                <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] capitalize">
                  {t.category}
                </span>
              </div>

              {/* Info */}
              <div className="p-3">
                <h3 className="text-sm font-semibold truncate">{t.name}</h3>
                {t.description && (
                  <p className="text-[11px] opacity-50 line-clamp-2 mt-0.5">{t.description}</p>
                )}
                <div className="flex items-center gap-3 mt-2 text-[10px] opacity-50">
                  <span className="flex items-center gap-1"><User size={9} /> {t.author}</span>
                  <span className="flex items-center gap-1"><FileCode size={9} /> {t.files}</span>
                  <span className="flex items-center gap-1"><GitFork size={9} /> {t.forks}</span>
                  {t.credits > 0 && (
                    <span className="flex items-center gap-1 text-amber-500"><Zap size={9} /> {t.credits}</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => fork(t.id)}
                    disabled={forking === t.id}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs font-semibold shadow hover:shadow-purple-500/30 transition-shadow disabled:opacity-60"
                  >
                    {forking === t.id ? <Loader2 size={12} className="animate-spin" /> : <GitFork size={12} />}
                    {es ? 'Abrir en mi Canvas' : 'Open in my Canvas'}
                  </button>
                  {t.isMine && (
                    <button
                      onClick={(e) => unpublish(t.id, e)}
                      title={es ? 'Despublicar' : 'Unpublish'}
                      className="p-1.5 rounded-lg opacity-40 hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 transition-all"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
