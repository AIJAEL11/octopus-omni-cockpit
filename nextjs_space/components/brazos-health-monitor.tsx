'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useMetrics } from '@/lib/metrics-context'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, X, ExternalLink, RefreshCw } from 'lucide-react'

interface BrazoHealth {
  armType: string
  name: string
  status: string
  dbStatus: string
  issues: string[]
  suggestions: string[]
}

interface HealthReport {
  overall: string
  total: number
  healthy: number
  degraded: number
  errors: number
  brazos: BrazoHealth[]
}

interface HealthAlert {
  id: string
  brazo: BrazoHealth
  dismissed: boolean
}

const HEALTH_CHECK_INTERVAL = 5 * 60 * 1000 // 5 minutes
const NOTIFIED_KEY = 'octopus-health-notified'

export function BrazosHealthMonitor() {
  const [alerts, setAlerts] = useState<HealthAlert[]>([])
  const { addActivity } = useMetrics()
  const initializedRef = useRef(false)
  const notifiedRef = useRef<Set<string>>(new Set())

  // Load previously notified
  useEffect(() => {
    try {
      const saved = localStorage.getItem(NOTIFIED_KEY)
      if (saved) notifiedRef.current = new Set(JSON.parse(saved))
    } catch { /* ignore */ }
  }, [])

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/brazos/health')
      if (!res.ok) return
      const data: HealthReport = await res.json()

      const newAlerts: HealthAlert[] = []

      for (const brazo of data.brazos) {
        if (brazo.status === 'healthy') {
          // Recovery notification
          const issueKey = `issue:${brazo.armType}`
          if (notifiedRef.current.has(issueKey)) {
            addActivity(`\u2705 ${brazo.name} se ha recuperado y funciona correctamente`, 'success')
            notifiedRef.current.delete(issueKey)
          }
          continue
        }

        const issueKey = `issue:${brazo.armType}`
        if (!notifiedRef.current.has(issueKey)) {
          notifiedRef.current.add(issueKey)

          const statusIcon = brazo.status === 'error' || brazo.status === 'disconnected' ? '\u274c' : '\u26a0\ufe0f'
          const statusLabel = brazo.status === 'error' ? 'Error' 
            : brazo.status === 'disconnected' ? 'Desconectado' 
            : 'Degradado'

          // Add to activity feed
          addActivity(
            `${statusIcon} ${brazo.name}: ${statusLabel} \u2014 ${brazo.issues[0] || 'Problema detectado'}`,
            brazo.status === 'error' || brazo.status === 'disconnected' ? 'error' : 'warning'
          )

          // Show toast alert
          newAlerts.push({
            id: `${brazo.armType}-${Date.now()}`,
            brazo,
            dismissed: false,
          })
        }
      }

      if (newAlerts.length > 0) {
        setAlerts(prev => [...prev, ...newAlerts])
      }

      // Persist
      try {
        localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...notifiedRef.current]))
      } catch { /* ignore */ }
    } catch {
      // Silently fail health checks
    }
  }, [addActivity])

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    const timeout = setTimeout(checkHealth, 4000)
    const interval = setInterval(checkHealth, HEALTH_CHECK_INTERVAL)
    return () => {
      clearTimeout(timeout)
      clearInterval(interval)
    }
  }, [checkHealth])

  const dismissAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id))
  }

  // Auto-dismiss after 15 seconds
  useEffect(() => {
    if (alerts.length === 0) return
    const timeout = setTimeout(() => {
      setAlerts(prev => prev.slice(1))
    }, 15000)
    return () => clearTimeout(timeout)
  }, [alerts])

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 max-w-md" style={{ pointerEvents: 'none' }}>
      <AnimatePresence mode="popLayout">
        {alerts.map(alert => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="rounded-xl shadow-2xl border overflow-hidden"
            style={{ 
              pointerEvents: 'auto',
              background: alert.brazo.status === 'error' || alert.brazo.status === 'disconnected' 
                ? 'linear-gradient(135deg, #1a0505 0%, #2d0a0a 100%)'
                : 'linear-gradient(135deg, #1a1505 0%, #2d1f0a 100%)',
              borderColor: alert.brazo.status === 'error' || alert.brazo.status === 'disconnected'
                ? 'rgba(239, 68, 68, 0.3)'
                : 'rgba(245, 158, 11, 0.3)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <AlertTriangle 
                  className={`w-5 h-5 ${
                    alert.brazo.status === 'error' || alert.brazo.status === 'disconnected'
                      ? 'text-red-400' 
                      : 'text-amber-400'
                  }`} 
                />
                <span className="font-semibold text-white text-sm">
                  {alert.brazo.name}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  alert.brazo.status === 'error' || alert.brazo.status === 'disconnected'
                    ? 'bg-red-500/20 text-red-300'
                    : 'bg-amber-500/20 text-amber-300'
                }`}>
                  {alert.brazo.status === 'error' ? 'Error' 
                    : alert.brazo.status === 'disconnected' ? 'Desconectado'
                    : 'Degradado'}
                </span>
              </div>
              <button 
                onClick={() => dismissAlert(alert.id)}
                className="text-white/40 hover:text-white/80 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Issues */}
            <div className="px-4 pb-2">
              {alert.brazo.issues.map((issue, i) => (
                <p key={i} className="text-sm text-white/70 flex items-start gap-2">
                  <span className="text-white/30 mt-0.5">•</span>
                  {issue}
                </p>
              ))}
            </div>

            {/* Suggestions */}
            {alert.brazo.suggestions.length > 0 && (
              <div className="px-4 pb-3">
                <p className="text-xs text-white/40 mb-1">💡 Soluci\u00f3n:</p>
                {alert.brazo.suggestions.map((sug, i) => (
                  <p key={i} className="text-xs text-emerald-300/80">{sug}</p>
                ))}
              </div>
            )}

            {/* Action button */}
            <div className="px-4 pb-3 flex gap-2">
              <a
                href="/dashboard/brazos"
                className="flex items-center gap-1 text-xs bg-white/10 hover:bg-white/20 text-white/80 px-3 py-1.5 rounded-lg transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Ir a Brazos
              </a>
              <button
                onClick={() => {
                  dismissAlert(alert.id)
                  // Reset notified so it can re-check
                  notifiedRef.current.delete(`issue:${alert.brazo.armType}`)
                  try {
                    localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...notifiedRef.current]))
                  } catch { /* ignore */ }
                  checkHealth()
                }}
                className="flex items-center gap-1 text-xs bg-white/10 hover:bg-white/20 text-white/80 px-3 py-1.5 rounded-lg transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Reintentar
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
