'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send,
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  ExternalLink,
  RefreshCw,
  Settings,
  Zap,
  FileText,
  TrendingUp,
  AlertCircle,
  ChevronRight,
  Radio
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n-context'
import Link from 'next/link'

interface PublishLog {
  id: string
  agentId: string
  title: string
  slug: string
  publishedUrl: string | null
  status: string
  contentType: string
  error: string | null
  duration: number | null
  createdAt: string
}

interface PublishStats {
  total: number
  published: number
  errors: number
}

interface EndpointInfo {
  baseUrl: string | null
  status: string
  usageCount: number
  lastUsed: string | null
}

const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string; labelEn: string }> = {
  published: {
    icon: <CheckCircle className="w-3.5 h-3.5" />,
    color: 'text-emerald-400',
    label: 'Publicado',
    labelEn: 'Published'
  },
  publishing: {
    icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
    color: 'text-blue-400',
    label: 'Publicando...',
    labelEn: 'Publishing...'
  },
  error: {
    icon: <XCircle className="w-3.5 h-3.5" />,
    color: 'text-red-400',
    label: 'Error',
    labelEn: 'Error'
  },
  draft: {
    icon: <FileText className="w-3.5 h-3.5" />,
    color: 'text-gray-400',
    label: 'Borrador',
    labelEn: 'Draft'
  }
}

export function ContentPublishWidget() {
  const { t, locale } = useI18n()
  const [logs, setLogs] = useState<PublishLog[]>([])
  const [stats, setStats] = useState<PublishStats>({ total: 0, published: 0, errors: 0 })
  const [configured, setConfigured] = useState(false)
  const [endpoint, setEndpoint] = useState<EndpointInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [showQuickPublish, setShowQuickPublish] = useState(false)
  const [quickTitle, setQuickTitle] = useState('')
  const [quickContent, setQuickContent] = useState('')

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const res = await fetch('/api/skills/content-publish?limit=5')
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs || [])
        setStats(data.stats || { total: 0, published: 0, errors: 0 })
        setConfigured(data.configured)
        setEndpoint(data.endpoint)
      }
    } catch (err) {
      console.error('ContentPublishWidget fetch error:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(() => fetchData(), 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleQuickPublish = async () => {
    if (!quickTitle.trim() || !quickContent.trim()) return
    setPublishing(true)
    try {
      const res = await fetch('/api/skills/content-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: quickTitle,
          content: quickContent,
          contentType: 'blog_post',
          agentId: 'manual'
        })
      })
      const data = await res.json()
      if (data.success) {
        setQuickTitle('')
        setQuickContent('')
        setShowQuickPublish(false)
        fetchData(true)
      } else {
        alert(data.error || 'Error al publicar')
      }
    } catch {
      alert('Error de conexión')
    } finally {
      setPublishing(false)
    }
  }

  const isEs = locale === 'es'
  const successRate = stats.total > 0 ? Math.round((stats.published / stats.total) * 100) : 0

  if (loading) {
    return (
      <Card className="p-4 bg-gray-900/50 border-gray-800/50">
        <div className="flex items-center gap-2 animate-pulse">
          <div className="w-8 h-8 rounded-lg bg-gray-800" />
          <div className="flex-1">
            <div className="h-4 w-32 bg-gray-800 rounded" />
            <div className="h-3 w-48 bg-gray-800 rounded mt-1" />
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="bg-gray-900/50 border-gray-800/50 overflow-hidden">
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 flex items-center justify-center">
              <Radio className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Content Publisher</h3>
              <p className="text-[11px] text-gray-400">
                {configured
                  ? (isEs ? 'Endpoint conectado' : 'Endpoint connected')
                  : (isEs ? 'Sin configurar' : 'Not configured')}
                {configured && endpoint?.baseUrl && (
                  <span className="ml-1 text-sky-400/60">• {new URL(endpoint.baseUrl).hostname}</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-gray-500 hover:text-white"
              onClick={() => fetchData(true)}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Link href="/dashboard/api-hub">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-500 hover:text-white">
                <Settings className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Quick Stats */}
        {configured && stats.total > 0 && (
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="bg-gray-800/50 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-white">{stats.total}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Total</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-emerald-400">{stats.published}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">{isEs ? 'Éxito' : 'Success'}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-sky-400">{successRate}%</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Rate</p>
            </div>
          </div>
        )}
      </div>

      {/* Not configured state */}
      {!configured && (
        <div className="px-4 pb-4">
          <div className="bg-sky-500/10 border border-sky-500/20 rounded-lg p-3 text-center">
            <AlertCircle className="w-5 h-5 text-sky-400 mx-auto mb-1" />
            <p className="text-xs text-gray-300 mb-2">
              {isEs
                ? 'Configura tu endpoint en API Hub para empezar a publicar contenido automáticamente.'
                : 'Configure your endpoint in API Hub to start publishing content automatically.'}
            </p>
            <Link href="/dashboard/api-hub">
              <Button size="sm" className="h-7 text-xs bg-sky-500 hover:bg-sky-600 text-white">
                <Settings className="w-3 h-3 mr-1" />
                {isEs ? 'Configurar Endpoint' : 'Configure Endpoint'}
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Recent Logs */}
      {configured && logs.length > 0 && (
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">
              {isEs ? 'Publicaciones Recientes' : 'Recent Publications'}
            </p>
            {configured && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] text-sky-400 hover:text-sky-300 px-2"
                onClick={() => setShowQuickPublish(!showQuickPublish)}
              >
                <Zap className="w-3 h-3 mr-1" />
                {isEs ? 'Publicar' : 'Publish'}
              </Button>
            )}
          </div>

          {/* Quick Publish Form */}
          <AnimatePresence>
            {showQuickPublish && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mb-2"
              >
                <div className="bg-gray-800/70 rounded-lg p-3 space-y-2 border border-gray-700/50">
                  <input
                    type="text"
                    placeholder={isEs ? 'Título del artículo...' : 'Article title...'}
                    value={quickTitle}
                    onChange={(e) => setQuickTitle(e.target.value)}
                    className="w-full bg-gray-900/50 border border-gray-700 rounded px-2.5 py-1.5 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-sky-500/50"
                  />
                  <textarea
                    placeholder={isEs ? 'Contenido o resumen...' : 'Content or summary...'}
                    value={quickContent}
                    onChange={(e) => setQuickContent(e.target.value)}
                    rows={3}
                    className="w-full bg-gray-900/50 border border-gray-700 rounded px-2.5 py-1.5 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-sky-500/50 resize-none"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-sky-500 hover:bg-sky-600 text-white flex-1"
                      onClick={handleQuickPublish}
                      disabled={publishing || !quickTitle.trim() || !quickContent.trim()}
                    >
                      {publishing ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Send className="w-3 h-3 mr-1" />
                      )}
                      {publishing ? (isEs ? 'Publicando...' : 'Publishing...') : (isEs ? 'Publicar Ahora' : 'Publish Now')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-gray-400"
                      onClick={() => setShowQuickPublish(false)}
                    >
                      {isEs ? 'Cancelar' : 'Cancel'}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Log List */}
          <div className="space-y-1">
            {logs.map((log) => {
              const config = statusConfig[log.status] || statusConfig.draft
              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 py-1.5 group"
                >
                  <span className={config.color}>{config.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white truncate">{log.title}</p>
                    <div className="flex items-center gap-2 text-[10px] text-gray-500">
                      <span>{new Date(log.createdAt).toLocaleDateString(isEs ? 'es' : 'en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      {log.duration && <span>• {log.duration}ms</span>}
                      {log.agentId !== 'manual' && (
                        <span className="text-purple-400/70">• {log.agentId}</span>
                      )}
                    </div>
                  </div>
                  {log.publishedUrl && (
                    <a
                      href={log.publishedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <ExternalLink className="w-3 h-3 text-gray-500 hover:text-sky-400" />
                    </a>
                  )}
                  {log.error && (
                    <span title={log.error} className="cursor-help">
                      <AlertCircle className="w-3 h-3 text-red-400/70" />
                    </span>
                  )}
                </motion.div>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty state when configured but no logs */}
      {configured && logs.length === 0 && (
        <div className="px-4 pb-4">
          <div className="text-center py-4">
            <Send className="w-6 h-6 text-gray-600 mx-auto mb-1" />
            <p className="text-xs text-gray-500">
              {isEs ? 'No hay publicaciones aún' : 'No publications yet'}
            </p>
            <Button
              size="sm"
              className="h-7 text-xs bg-sky-500 hover:bg-sky-600 text-white mt-2"
              onClick={() => setShowQuickPublish(true)}
            >
              <Zap className="w-3 h-3 mr-1" />
              {isEs ? 'Primera Publicación' : 'First Publication'}
            </Button>
          </div>
        </div>
      )}

      {/* Footer */}
      {configured && stats.total > 0 && (
        <div className="px-4 py-2 border-t border-gray-800/50">
          <Link href="/dashboard/skill-factory">
            <Button variant="ghost" size="sm" className="h-6 text-[11px] text-gray-500 hover:text-white w-full justify-between p-0">
              <span className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                {isEs ? 'Ver todos los logs' : 'View all logs'}
              </span>
              <ChevronRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>
      )}
    </Card>
  )
}
