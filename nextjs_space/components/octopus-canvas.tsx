'use client'

/**
 * OCTOPUS CANVAS — Panel lateral con el proyecto renderizado en vivo
 *
 * - Vista previa (iframe servido por /api/canvas/preview) + código por archivo
 * - Verificación: el preview inyecta un colector de errores (postMessage);
 *   el panel los agrega y los reporta al chat para auto-corrección
 * - Deploy: Octopus Hosting (URL pública), GitHub (brazo), Hostinger (brazo)
 * - Deploy History: URLs desplegadas persistidas por proyecto (localStorage)
 * - Project Library: cajón de proyectos para navegar/cambiar de proyecto
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, RefreshCw, ExternalLink, Download, Code2, Eye,
  FileCode, Loader2, Monitor, Smartphone, Rocket,
  CheckCircle2, AlertTriangle, Copy, Check, Github, Globe, ScanEye,
  FolderOpen, Clock, Trash2, ChevronDown, ChevronUp, Link2, Search,
  FolderClosed, Plus, BarChart3, Send, CopyPlus,
} from 'lucide-react'
import type { CanvasFile } from '@/lib/octopus-canvas'

export interface CanvasLog {
  kind: string
  message: string
}

interface DeployRecord {
  target: 'octopus' | 'github' | 'hostinger'
  url?: string | null
  label: string
  deployedAt: string
  siteId?: string | null
}

interface CanvasProject {
  id: string
  name: string
  updatedAt: string
  _count: { files: number }
}

interface Props {
  projectId: string
  title: string
  files: CanvasFile[]
  /** Cambia para forzar recarga del iframe tras cada iteración */
  refreshKey: number
  locale: 'es' | 'en'
  onClose: () => void
  /** Errores recogidos del preview tras cargar (para auto-corrección en el chat) */
  onLogs?: (logs: CanvasLog[]) => void
  /** 👁️ Visión: captura real vía Bridge + análisis visual en el chat */
  onVision?: () => Promise<void>
  /** Cambiar de proyecto desde la biblioteca */
  onSwitchProject?: (projectId: string) => void
  /** Nuevo proyecto vacío */
  onNewProject?: () => void
  /** Clonar sitio externo: URL → captura Bridge → LLM replica diseño */
  onCloneUrl?: (url: string) => Promise<void>
}

type DeployTarget = 'octopus' | 'github' | 'hostinger'
interface DeployState {
  loading: DeployTarget | null
  result: { target: DeployTarget; url?: string | null; message?: string; zipFallbackUrl?: string | null } | null
  error: string | null
}

// — localStorage helpers (deploy history per projectId) —
const DEPLOY_KEY = (id: string) => `octopus_canvas_deploys_${id}`

function loadDeployHistory(projectId: string): DeployRecord[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(DEPLOY_KEY(projectId)) || '[]')
  } catch { return [] }
}

function saveDeployHistory(projectId: string, records: DeployRecord[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(DEPLOY_KEY(projectId), JSON.stringify(records.slice(0, 20)))
}

// — Icon helpers for deploy target —
function TargetIcon({ target, size = 13 }: { target: DeployTarget; size?: number }) {
  if (target === 'octopus') return <span style={{ fontSize: size }}>🐙</span>
  if (target === 'github') return <Github size={size} />
  return <Globe size={size} />
}

const TARGET_LABEL: Record<DeployTarget, string> = {
  octopus: 'Octopus',
  github: 'GitHub',
  hostinger: 'Hostinger',
}

export function OctopusCanvas({ projectId, title, files, refreshKey, locale, onClose, onLogs, onVision, onSwitchProject, onNewProject, onCloneUrl }: Props) {
  const es = locale === 'es'
  const [tab, setTab] = useState<'preview' | 'code'>('preview')
  const [activeFile, setActiveFile] = useState(files[0]?.path || 'index.html')
  const [iframeLoading, setIframeLoading] = useState(true)
  const [mobile, setMobile] = useState(false)
  const [logs, setLogs] = useState<CanvasLog[]>([])
  const [verifyState, setVerifyState] = useState<'checking' | 'ok' | 'errors'>('checking')
  const [showDeploy, setShowDeploy] = useState(false)
  const [deploy, setDeploy] = useState<DeployState>({ loading: null, result: null, error: null })
  const [visionRunning, setVisionRunning] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const logsRef = useRef<CanvasLog[]>([])
  const reportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // — Deploy history (persisted in localStorage) —
  const [deployHistory, setDeployHistory] = useState<DeployRecord[]>([])
  const [showHistory, setShowHistory] = useState(false)

  // — Clone URL popover —
  const [showClone, setShowClone] = useState(false)
  const [cloneUrl, setCloneUrl] = useState('')
  const [cloneRunning, setCloneRunning] = useState(false)
  const [cloneError, setCloneError] = useState<string | null>(null)

  // — Publicar como plantilla (marketplace) —
  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState<string | null>(null)

  // — Digest —
  const [digestLoading, setDigestLoading] = useState(false)
  const [digestResult, setDigestResult] = useState<{ ok: boolean; msg: string } | null>(null)

  // — Analytics for Octopus deploys —
  const [analyticsOpen, setAnalyticsOpen] = useState<string | null>(null) // siteId
  const [analyticsData, setAnalyticsData] = useState<{ totalViews: number; topPage?: string; errors: number } | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)

  // — Project Library drawer —
  const [showLibrary, setShowLibrary] = useState(false)
  const [libProjects, setLibProjects] = useState<CanvasProject[]>([])
  const [libLoading, setLibLoading] = useState(false)
  const [libSearch, setLibSearch] = useState('')

  // /index.html explícito: Next hace 308 en rutas con barra final, lo que
  // rompería la resolución de rutas relativas (./styles.css) del proyecto
  const previewUrl = `/api/canvas/preview/${projectId}/index.html?v=${refreshKey}`

  // Cargar historial de deploys al montar y al cambiar de proyecto
  useEffect(() => {
    setDeployHistory(loadDeployHistory(projectId))
    setShowHistory(false)
  }, [projectId])

  // Reiniciar verificación con cada render nuevo
  useEffect(() => {
    setIframeLoading(true)
    setLogs([])
    logsRef.current = []
    setVerifyState('checking')
  }, [refreshKey, projectId])

  useEffect(() => {
    if (!files.find(f => f.path === activeFile) && files[0]) setActiveFile(files[0].path)
  }, [files, activeFile])

  // Escuchar el colector de errores del iframe
  const scheduleReport = useCallback(() => {
    if (reportTimerRef.current) clearTimeout(reportTimerRef.current)
    reportTimerRef.current = setTimeout(() => {
      const collected = logsRef.current
      setVerifyState(collected.length === 0 ? 'ok' : 'errors')
      onLogs?.(collected)
    }, 2200)
  }, [onLogs])

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const d = e.data
      if (!d || typeof d !== 'object') return
      if (d.type === 'octopus-canvas-log' && d.message) {
        const entry = { kind: String(d.kind || 'js'), message: String(d.message) }
        logsRef.current = [...logsRef.current, entry].slice(0, 30)
        setLogs(logsRef.current)
        scheduleReport()
      } else if (d.type === 'octopus-canvas-ready') {
        scheduleReport()
      }
    }
    window.addEventListener('message', onMessage)
    return () => {
      window.removeEventListener('message', onMessage)
      if (reportTimerRef.current) clearTimeout(reportTimerRef.current)
    }
  }, [scheduleReport])

  async function runDeploy(target: DeployTarget) {
    setDeploy({ loading: target, result: null, error: null })
    try {
      const res = await fetch('/api/canvas/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, target }),
      })
      const data = await res.json()
      if (data.success) {
        setDeploy({
          loading: null,
          result: { target, url: data.url, zipFallbackUrl: data.zipFallbackUrl, message: data.method === 'zip_ready' ? (es ? 'API no disponible — descarga el ZIP y súbelo a tu hosting' : 'API unavailable — download ZIP and upload to your hosting') : undefined },
          error: null,
        })
        // Persist in deploy history
        if (data.url) {
          const record: DeployRecord = {
            target,
            url: data.url,
            label: TARGET_LABEL[target],
            deployedAt: new Date().toISOString(),
            siteId: target === 'octopus' ? (data.siteId || null) : null,
          }
          const updated = [record, ...deployHistory.filter(r => r.url !== data.url)]
          setDeployHistory(updated)
          saveDeployHistory(projectId, updated)
          setShowHistory(true)
        }
      } else {
        const msg = data.error === 'github_not_connected'
          ? (es ? 'Conecta GitHub en Brazos Activos' : 'Connect GitHub in Active Arms')
          : data.error === 'hostinger_not_connected'
            ? (es ? 'Conecta Hostinger en Brazos Activos' : 'Connect Hostinger in Active Arms')
            : (data.message || data.error || 'Error')
        setDeploy({ loading: null, result: null, error: msg })
      }
    } catch {
      setDeploy({ loading: null, result: null, error: es ? 'Error de conexión' : 'Connection error' })
    }
  }

  async function runClone() {
    if (!cloneUrl.trim() || cloneRunning) return
    setCloneRunning(true)
    setCloneError(null)
    try {
      await onCloneUrl?.(cloneUrl.trim())
      setShowClone(false)
      setCloneUrl('')
    } catch (e: unknown) {
      setCloneError(e instanceof Error ? e.message : (es ? 'Error al clonar' : 'Clone error'))
    } finally {
      setCloneRunning(false)
    }
  }

  async function publishTemplate() {
    if (publishing) return
    setPublishing(true)
    setPublishResult(null)
    try {
      const res = await fetch('/api/canvas/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish', projectId, category: 'general' }),
      })
      const data = await res.json()
      if (data.success) {
        setPublishResult(data.updated
          ? (es ? '✅ Plantilla actualizada en el marketplace' : '✅ Template updated in the marketplace')
          : (es ? '✅ Publicada — gana créditos por cada fork' : '✅ Published — earn credits per fork'))
      } else {
        setPublishResult(`⚠️ ${data.error || 'Error'}`)
      }
    } catch {
      setPublishResult(es ? '⚠️ Error de conexión' : '⚠️ Connection error')
    } finally {
      setPublishing(false)
      setTimeout(() => setPublishResult(null), 5000)
    }
  }

  async function sendDigest(siteId: string) {
    setDigestLoading(true)
    setDigestResult(null)
    try {
      const res = await fetch('/api/sites/digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId }),
      })
      const data = await res.json()
      if (data.success) {
        setDigestResult({ ok: true, msg: es ? `Resumen enviado por ${data.channel}` : `Summary sent via ${data.channel}` })
      } else if (data.error === 'no_channel') {
        setDigestResult({ ok: false, msg: es ? 'Conecta Telegram/WhatsApp en Brazos Activos' : 'Connect Telegram/WhatsApp in Active Arms' })
      } else {
        setDigestResult({ ok: false, msg: data.message || data.error || 'Error' })
      }
    } catch {
      setDigestResult({ ok: false, msg: es ? 'Error de conexión' : 'Connection error' })
    } finally {
      setDigestLoading(false)
      setTimeout(() => setDigestResult(null), 5000)
    }
  }

  async function loadAnalytics(siteId: string) {
    if (analyticsOpen === siteId) { setAnalyticsOpen(null); return }
    setAnalyticsOpen(siteId)
    setAnalyticsLoading(true)
    setAnalyticsData(null)
    try {
      const res = await fetch(`/api/hosted-sites/analytics?siteId=${siteId}&period=7d`)
      const data = await res.json()
      if (data.success) {
        const topPage = data.topPages?.[0]?.path
        // Errors are stored in views with path starting with __error_
        // We can't query them from this endpoint but we show views at minimum
        setAnalyticsData({ totalViews: data.totalViews, topPage, errors: 0 })
      }
    } catch { /* ignore */ } finally {
      setAnalyticsLoading(false)
    }
  }

  async function loadLibrary() {
    setLibLoading(true)
    try {
      const res = await fetch('/api/canvas')
      const data = await res.json()
      setLibProjects(data.projects || [])
    } catch {
      setLibProjects([])
    } finally {
      setLibLoading(false)
    }
  }

  function openLibrary() {
    setShowLibrary(true)
    loadLibrary()
  }

  async function deleteProject(pid: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(es ? '¿Eliminar este proyecto?' : 'Delete this project?')) return
    try {
      await fetch(`/api/canvas?projectId=${pid}`, { method: 'DELETE' })
      setLibProjects(prev => prev.filter(p => p.id !== pid))
    } catch { /* ignore */ }
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url)
    setCopied(url)
    setTimeout(() => setCopied(null), 1500)
  }

  const current = files.find(f => f.path === activeFile)
  const filteredProjects = libProjects.filter(p =>
    p.name.toLowerCase().includes(libSearch.toLowerCase())
  )

  return (
    <motion.aside
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 260 }}
      className="fixed right-0 top-0 bottom-0 z-40 w-full md:w-[46%] md:min-w-[420px] flex flex-col bg-white dark:bg-[#0d1420] border-l border-black/10 dark:border-white/10 shadow-2xl"
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-black/10 dark:border-white/10 flex-shrink-0 flex-wrap">
        <div className="hidden sm:flex items-center gap-1.5 mr-1">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
        </div>

        {/* Project library button */}
        <button
          onClick={openLibrary}
          title={es ? 'Biblioteca de proyectos' : 'Project library'}
          className="p-1.5 rounded-lg opacity-60 hover:opacity-100 hover:bg-purple-500/10 hover:text-purple-400 transition-colors"
        >
          <FolderOpen size={15} />
        </button>

        <span className="text-sm font-semibold truncate flex-1 min-w-0">🎨 {title}</span>

        {/* Verification chip */}
        {verifyState === 'checking' && (
          <span className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 flex-shrink-0">
            <Loader2 size={11} className="animate-spin" /> {es ? 'Verificando' : 'Checking'}
          </span>
        )}
        {verifyState === 'ok' && (
          <span className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 flex-shrink-0">
            <CheckCircle2 size={11} /> {es ? '0 errores' : '0 errors'}
          </span>
        )}
        {verifyState === 'errors' && (
          <span className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 flex-shrink-0" title={logs.map(l => l.message).join('\n')}>
            <AlertTriangle size={11} /> {logs.length} {es ? 'error(es)' : 'error(s)'}
          </span>
        )}

        {/* Tabs */}
        <div className="flex items-center rounded-lg border border-black/10 dark:border-white/10 overflow-hidden text-xs flex-shrink-0">
          <button
            onClick={() => setTab('preview')}
            className={`flex items-center gap-1 px-2.5 py-1.5 transition-colors ${tab === 'preview' ? 'bg-purple-500/15 text-purple-500' : 'opacity-60 hover:opacity-100'}`}
          >
            <Eye size={13} /> {es ? 'Vista' : 'Preview'}
          </button>
          <button
            onClick={() => setTab('code')}
            className={`flex items-center gap-1 px-2.5 py-1.5 transition-colors ${tab === 'code' ? 'bg-purple-500/15 text-purple-500' : 'opacity-60 hover:opacity-100'}`}
          >
            <Code2 size={13} /> {es ? 'Código' : 'Code'}
          </button>
        </div>

        {/* Deploy dropdown */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowDeploy(o => !o)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs font-semibold shadow hover:shadow-purple-500/30 transition-shadow"
          >
            <Rocket size={13} /> Deploy
          </button>
          <AnimatePresence>
            {showDeploy && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#141c2c] shadow-2xl p-2 z-50"
              >
                <DeployOption
                  icon={<span className="text-base">🐙</span>}
                  label={es ? 'Publicar en OCTOPUS' : 'Publish on OCTOPUS'}
                  desc={es ? 'URL pública al instante' : 'Instant public URL'}
                  loading={deploy.loading === 'octopus'}
                  onClick={() => runDeploy('octopus')}
                />
                <DeployOption
                  icon={<Github size={16} />}
                  label="GitHub"
                  desc={es ? 'Crea repo y sube el código' : 'Create repo and push code'}
                  loading={deploy.loading === 'github'}
                  onClick={() => runDeploy('github')}
                />
                <DeployOption
                  icon={<Globe size={16} />}
                  label="Hostinger"
                  desc={es ? 'A tu dominio conectado' : 'To your connected domain'}
                  loading={deploy.loading === 'hostinger'}
                  onClick={() => runDeploy('hostinger')}
                />
                <div className="my-1 border-t border-black/10 dark:border-white/10" />
                <DeployOption
                  icon={<span className="text-base">🧬</span>}
                  label={es ? 'Publicar como plantilla' : 'Publish as template'}
                  desc={es ? 'Comunidad — gana créditos por fork' : 'Community — earn credits per fork'}
                  loading={publishing}
                  onClick={publishTemplate}
                />
                {publishResult && (
                  <div className="mt-1 px-2.5 py-2 rounded-lg bg-purple-500/10 text-purple-400 text-[11px]">
                    {publishResult}
                  </div>
                )}

                {deploy.error && (
                  <div className="mt-1 px-2.5 py-2 rounded-lg bg-red-500/10 text-red-400 text-[11px]">
                    {deploy.error}
                  </div>
                )}
                {deploy.result && (
                  <div className="mt-1 px-2.5 py-2 rounded-lg bg-emerald-500/10 text-[11px] space-y-1">
                    <div className="flex items-center gap-1 text-emerald-400 font-medium">
                      <CheckCircle2 size={12} /> {es ? '¡Desplegado!' : 'Deployed!'}
                    </div>
                    {deploy.result.url && (
                      <div className="flex items-center gap-1">
                        <a href={deploy.result.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline truncate flex-1">
                          {deploy.result.url.replace(/^https?:\/\//, '')}
                        </a>
                        <button onClick={() => copyUrl(deploy.result!.url!)}>
                          {copied === deploy.result.url ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} className="opacity-60" />}
                        </button>
                      </div>
                    )}
                    {deploy.result.message && <p className="opacity-70">{deploy.result.message}</p>}
                    {deploy.result.zipFallbackUrl && (
                      <a href={deploy.result.zipFallbackUrl} className="text-blue-400 underline">
                        {es ? 'Descargar ZIP' : 'Download ZIP'}
                      </a>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 👁️ Visión vía Bridge */}
        {onVision && (
          <button
            onClick={async () => { setVisionRunning(true); try { await onVision() } finally { setVisionRunning(false) } }}
            disabled={visionRunning}
            title={es ? 'Visión: captura real vía Bridge y análisis visual' : 'Vision: real capture via Bridge and visual review'}
            className="p-1.5 rounded-lg opacity-60 hover:opacity-100 hover:bg-purple-500/10 hover:text-purple-400 transition-colors disabled:opacity-40 flex-shrink-0"
          >
            {visionRunning ? <Loader2 size={15} className="animate-spin" /> : <ScanEye size={15} />}
          </button>
        )}

        {/* 🌐 Clonar sitio externo */}
        {onCloneUrl && (
          <div className="relative flex-shrink-0">
            <button
              onClick={() => { setShowClone(o => !o); setCloneError(null) }}
              title={es ? 'Clonar diseño de otro sitio' : 'Clone design from another site'}
              className="p-1.5 rounded-lg opacity-60 hover:opacity-100 hover:bg-purple-500/10 hover:text-purple-400 transition-colors"
            >
              <CopyPlus size={15} />
            </button>
            <AnimatePresence>
              {showClone && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#141c2c] shadow-2xl p-3 z-50"
                >
                  <p className="text-xs font-semibold mb-1">{es ? '🌐 Clonar diseño de sitio' : '🌐 Clone site design'}</p>
                  <p className="text-[11px] opacity-50 mb-2">{es ? 'El Bridge captura el sitio y OCTOPUS replica su diseño en un nuevo proyecto.' : 'Bridge captures the site and OCTOPUS replicates its design as a new project.'}</p>
                  <div className="flex items-center gap-2">
                    <input
                      value={cloneUrl}
                      onChange={e => setCloneUrl(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && runClone()}
                      placeholder="https://ejemplo.com"
                      className="flex-1 bg-black/5 dark:bg-white/10 rounded-lg px-2.5 py-1.5 text-xs outline-none placeholder:opacity-40"
                      autoFocus
                    />
                    <button
                      onClick={runClone}
                      disabled={!cloneUrl.trim() || cloneRunning}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs font-semibold disabled:opacity-50"
                    >
                      {cloneRunning ? <Loader2 size={12} className="animate-spin" /> : <CopyPlus size={12} />}
                      {es ? 'Clonar' : 'Clone'}
                    </button>
                  </div>
                  {cloneError && <p className="mt-2 text-[11px] text-red-400">{cloneError}</p>}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Mobile / Desktop toggle */}
        {tab === 'preview' && (
          <button
            onClick={() => setMobile(m => !m)}
            title={es ? 'Vista móvil/escritorio' : 'Mobile/desktop view'}
            className="p-1.5 rounded-lg opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition-colors hidden sm:block flex-shrink-0"
          >
            {mobile ? <Monitor size={15} /> : <Smartphone size={15} />}
          </button>
        )}

        <button
          onClick={() => setIframeLoading(true)}
          title={es ? 'Recargar' : 'Reload'}
          className="p-1.5 rounded-lg opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex-shrink-0"
        >
          <RefreshCw size={15} className={iframeLoading ? 'animate-spin' : ''} />
        </button>
        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={es ? 'Abrir en pestaña' : 'Open in tab'}
          className="p-1.5 rounded-lg opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex-shrink-0"
        >
          <ExternalLink size={15} />
        </a>
        <a
          href={`/api/canvas/download/${projectId}`}
          title={es ? 'Descargar ZIP (listo para desplegar)' : 'Download ZIP (deploy-ready)'}
          className="p-1.5 rounded-lg opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex-shrink-0"
        >
          <Download size={15} />
        </a>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg opacity-60 hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 transition-colors flex-shrink-0"
        >
          <X size={16} />
        </button>
      </div>

      {/* ── Deployed URLs bar ── */}
      {deployHistory.length > 0 && (
        <div className="border-b border-black/10 dark:border-white/10 flex-shrink-0">
          <button
            onClick={() => setShowHistory(h => !h)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <Link2 size={11} className="text-purple-400 flex-shrink-0" />
            <span className="flex-1 text-left font-medium">
              {es ? `${deployHistory.length} URL(s) desplegadas` : `${deployHistory.length} deployed URL(s)`}
            </span>
            {showHistory ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
          <AnimatePresence>
            {showHistory && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="px-3 pb-2 flex flex-col gap-1">
                  {deployHistory.map((rec, i) => (
                    <div key={i} className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="w-5 h-5 rounded flex items-center justify-center bg-black/5 dark:bg-white/10 flex-shrink-0">
                          <TargetIcon target={rec.target} size={11} />
                        </span>
                        <span className="opacity-50 flex-shrink-0">{rec.label}</span>
                        {rec.url ? (
                          <a
                            href={rec.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:underline truncate flex-1"
                          >
                            {rec.url.replace(/^https?:\/\//, '')}
                          </a>
                        ) : (
                          <span className="opacity-40 flex-1 truncate">{es ? 'sin URL' : 'no URL'}</span>
                        )}
                        <span className="opacity-40 flex-shrink-0 hidden sm:inline">
                          {new Date(rec.deployedAt).toLocaleDateString()}
                        </span>
                        {rec.url && (
                          <button
                            onClick={() => copyUrl(rec.url!)}
                            className="opacity-50 hover:opacity-100 transition-opacity flex-shrink-0"
                          >
                            {copied === rec.url ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                          </button>
                        )}
                        {/* Stats + Digest only for Octopus deploys */}
                        {rec.target === 'octopus' && rec.siteId && (
                          <>
                            <button
                              onClick={() => loadAnalytics(rec.siteId!)}
                              title={es ? 'Ver estadísticas' : 'View stats'}
                              className="opacity-50 hover:opacity-100 transition-opacity flex-shrink-0"
                            >
                              <BarChart3 size={11} />
                            </button>
                            <button
                              onClick={() => sendDigest(rec.siteId!)}
                              disabled={digestLoading}
                              title={es ? 'Enviar resumen por WhatsApp/Telegram' : 'Send summary via WhatsApp/Telegram'}
                              className="opacity-50 hover:opacity-100 transition-opacity flex-shrink-0 disabled:opacity-30"
                            >
                              {digestLoading ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                            </button>
                          </>
                        )}
                      </div>
                      {/* Analytics mini widget */}
                      {rec.target === 'octopus' && rec.siteId && analyticsOpen === rec.siteId && (
                        <div className="ml-7 pl-2 border-l border-purple-500/20 text-[10px] py-1">
                          {analyticsLoading ? (
                            <span className="opacity-40"><Loader2 size={10} className="animate-spin inline mr-1" />{es ? 'Cargando…' : 'Loading…'}</span>
                          ) : analyticsData ? (
                            <div className="flex flex-wrap gap-3 opacity-70">
                              <span>👁 <strong>{analyticsData.totalViews}</strong> {es ? 'visitas (7d)' : 'views (7d)'}</span>
                              {analyticsData.topPage && <span>📄 {analyticsData.topPage}</span>}
                            </div>
                          ) : (
                            <span className="opacity-40">{es ? 'Sin datos' : 'No data'}</span>
                          )}
                        </div>
                      )}
                      {/* Digest result */}
                      {digestResult && rec.target === 'octopus' && (
                        <div className={`ml-7 text-[10px] ${digestResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                          {digestResult.ok ? <CheckCircle2 size={10} className="inline mr-1" /> : <AlertTriangle size={10} className="inline mr-1" />}
                          {digestResult.msg}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Body ── */}
      <div
        className="flex-1 min-h-0 relative bg-neutral-100 dark:bg-black/40"
        onClick={() => showDeploy && setShowDeploy(false)}
      >
        {tab === 'preview' ? (
          <div className="absolute inset-0 flex items-center justify-center p-0">
            {iframeLoading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white/60 dark:bg-black/60 backdrop-blur-sm pointer-events-none">
                <Loader2 className="animate-spin text-purple-500" size={22} />
                <span className="text-xs opacity-60">{es ? 'Renderizando…' : 'Rendering…'}</span>
              </div>
            )}
            <iframe
              key={`${projectId}-${refreshKey}-${iframeLoading ? 'r' : 's'}`}
              src={previewUrl}
              onLoad={() => setIframeLoading(false)}
              sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
              className={`bg-white transition-all duration-300 ${
                mobile
                  ? 'w-[390px] h-[92%] rounded-[2rem] border-8 border-black/80 shadow-2xl'
                  : 'w-full h-full border-0'
              }`}
              title={title}
            />
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col">
            <div className="flex items-center gap-1 px-2 py-1.5 border-b border-black/10 dark:border-white/10 overflow-x-auto flex-shrink-0">
              {files.map(f => (
                <button
                  key={f.path}
                  onClick={() => setActiveFile(f.path)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-colors ${
                    activeFile === f.path
                      ? 'bg-purple-500/15 text-purple-500'
                      : 'opacity-60 hover:opacity-100'
                  }`}
                >
                  <FileCode size={12} /> {f.path}
                </button>
              ))}
            </div>
            <pre className="flex-1 overflow-auto p-4 text-xs leading-relaxed font-mono text-emerald-700 dark:text-emerald-300/90 whitespace-pre-wrap break-words">
              {current?.content || ''}
            </pre>
          </div>
        )}

        {/* ── Project Library Drawer (overlay inside the panel) ── */}
        <AnimatePresence>
          {showLibrary && (
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 280 }}
              className="absolute inset-0 z-20 flex flex-col bg-white dark:bg-[#0d1420] border-r border-black/10 dark:border-white/10"
            >
              {/* Library header */}
              <div className="flex items-center gap-2 px-3 py-3 border-b border-black/10 dark:border-white/10 flex-shrink-0">
                <FolderOpen size={16} className="text-purple-400 flex-shrink-0" />
                <span className="text-sm font-semibold flex-1">{es ? 'Proyectos Canvas' : 'Canvas Projects'}</span>
                {onNewProject && (
                  <button
                    onClick={() => { setShowLibrary(false); onNewProject() }}
                    title={es ? 'Nuevo proyecto' : 'New project'}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors text-xs font-medium"
                  >
                    <Plus size={13} /> {es ? 'Nuevo' : 'New'}
                  </button>
                )}
                <button
                  onClick={() => setShowLibrary(false)}
                  className="p-1.5 rounded-lg opacity-60 hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Search */}
              <div className="px-3 py-2 border-b border-black/10 dark:border-white/10 flex-shrink-0">
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-black/5 dark:bg-white/5 text-sm">
                  <Search size={13} className="opacity-50 flex-shrink-0" />
                  <input
                    value={libSearch}
                    onChange={e => setLibSearch(e.target.value)}
                    placeholder={es ? 'Buscar proyecto…' : 'Search project…'}
                    className="flex-1 bg-transparent outline-none text-xs placeholder:opacity-40"
                    autoFocus
                  />
                </div>
              </div>

              {/* Project list */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {libLoading ? (
                  <div className="flex items-center justify-center h-24 opacity-50">
                    <Loader2 size={18} className="animate-spin" />
                  </div>
                ) : filteredProjects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-24 gap-1 opacity-40 text-xs">
                    <FolderClosed size={22} />
                    {es ? 'Sin proyectos aún' : 'No projects yet'}
                  </div>
                ) : filteredProjects.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setShowLibrary(false); onSwitchProject?.(p.id) }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors group ${
                      p.id === projectId
                        ? 'bg-purple-500/10 border border-purple-500/30'
                        : 'hover:bg-black/5 dark:hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center flex-shrink-0 text-sm">
                      🎨
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium truncate">{p.name}</div>
                      <div className="flex items-center gap-2 text-[10px] opacity-50 mt-0.5">
                        <span>{p._count.files} {es ? 'archivo(s)' : 'file(s)'}</span>
                        <Clock size={9} />
                        <span>{new Date(p.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    {p.id === projectId && (
                      <span className="text-[10px] text-purple-400 font-medium flex-shrink-0">{es ? 'Activo' : 'Active'}</span>
                    )}
                    <button
                      onClick={(e) => deleteProject(p.id, e)}
                      title={es ? 'Eliminar' : 'Delete'}
                      className="opacity-0 group-hover:opacity-60 hover:!opacity-100 p-1 rounded hover:bg-red-500/10 hover:text-red-400 transition-all flex-shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  </button>
                ))}
              </div>

              {/* Library footer */}
              <div className="px-3 py-2 border-t border-black/10 dark:border-white/10 flex-shrink-0 flex items-center justify-between text-[11px]">
                <span className="opacity-40">{filteredProjects.length} {es ? 'proyecto(s)' : 'project(s)'}</span>
                <a href="/dashboard/canvas-templates" className="text-purple-400 hover:underline flex items-center gap-1">
                  🧬 {es ? 'Plantillas de la comunidad' : 'Community templates'}
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Footer ── */}
      <div className="px-3 py-1.5 border-t border-black/10 dark:border-white/10 flex items-center justify-between text-[11px] opacity-50 flex-shrink-0">
        <span>{files.length} {es ? 'archivo(s)' : 'file(s)'}</span>
        <span>{es ? 'Itera por chat: "hazlo azul", "agrega login"…' : 'Iterate via chat: "make it blue", "add login"…'}</span>
      </div>
    </motion.aside>
  )
}

function DeployOption({ icon, label, desc, loading, onClick }: {
  icon: React.ReactNode; label: string; desc: string; loading: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left disabled:opacity-60"
    >
      <span className="w-7 h-7 rounded-lg bg-black/5 dark:bg-white/10 flex items-center justify-center flex-shrink-0">
        {loading ? <Loader2 size={14} className="animate-spin" /> : icon}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-medium">{label}</span>
        <span className="block text-[10px] opacity-50 truncate">{desc}</span>
      </span>
    </button>
  )
}

/** Botón flotante para reabrir el Canvas cuando está cerrado */
export function CanvasReopenChip({ title, locale, onClick }: { title: string; locale: 'es' | 'en'; onClick: () => void }) {
  return (
    <AnimatePresence>
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        onClick={onClick}
        className="fixed bottom-24 right-4 z-30 flex items-center gap-2 px-3.5 py-2 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs font-medium shadow-lg hover:shadow-purple-500/30 transition-shadow"
      >
        <Eye size={14} />
        {locale === 'es' ? 'Ver' : 'View'} {title.slice(0, 24)}
      </motion.button>
    </AnimatePresence>
  )
}
