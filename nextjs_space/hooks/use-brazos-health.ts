'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useMetrics } from '@/lib/metrics-context'

export interface BrazoHealth {
  armType: string
  name: string
  status: 'healthy' | 'degraded' | 'disconnected' | 'error'
  dbStatus: string
  issues: string[]
  suggestions: string[]
  lastChecked: string
}

export interface HealthReport {
  overall: 'healthy' | 'warning' | 'critical'
  total: number
  healthy: number
  degraded: number
  errors: number
  brazos: BrazoHealth[]
  checkedAt: string
}

const HEALTH_CHECK_INTERVAL = 5 * 60 * 1000 // 5 minutes
const NOTIFICATION_KEY = 'octopus-brazos-notified'

export function useBrazosHealth() {
  const [report, setReport] = useState<HealthReport | null>(null)
  const [loading, setLoading] = useState(false)
  const { addActivity } = useMetrics()
  const notifiedRef = useRef<Set<string>>(new Set())
  const initializedRef = useRef(false)

  // Load previously notified issues from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(NOTIFICATION_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        notifiedRef.current = new Set(parsed)
      }
    } catch { /* ignore */ }
  }, [])

  const checkHealth = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/brazos/health')
      if (!res.ok) return
      const data: HealthReport = await res.json()
      setReport(data)

      // Process notifications for new issues
      for (const brazo of data.brazos) {
        if (brazo.status === 'healthy') {
          // Clear previous notifications for this brazo if it recovered
          const recoveryKey = `recovered:${brazo.armType}`
          const hadIssue = notifiedRef.current.has(`issue:${brazo.armType}`)
          if (hadIssue && !notifiedRef.current.has(recoveryKey)) {
            addActivity(`✅ ${brazo.name} se ha recuperado y está funcionando correctamente`, 'success')
            notifiedRef.current.add(recoveryKey)
            notifiedRef.current.delete(`issue:${brazo.armType}`)
          }
          continue
        }

        // Only notify once per issue type per session
        const issueKey = `issue:${brazo.armType}`
        if (notifiedRef.current.has(issueKey)) continue

        // New issue detected!
        notifiedRef.current.add(issueKey)
        notifiedRef.current.delete(`recovered:${brazo.armType}`)

        const statusIcon = brazo.status === 'error' || brazo.status === 'disconnected' ? '❌' : '⚠️'
        const statusText = brazo.status === 'error' ? 'Error' : brazo.status === 'disconnected' ? 'Desconectado' : 'Degradado'

        addActivity(
          `${statusIcon} ${brazo.name}: ${statusText} — ${brazo.issues[0] || 'Problema detectado'}. Solución: ${brazo.suggestions[0] || 'Revisa Brazos Activos'}`,
          brazo.status === 'error' || brazo.status === 'disconnected' ? 'error' : 'warning'
        )
      }

      // Save notification state
      try {
        localStorage.setItem(NOTIFICATION_KEY, JSON.stringify([...notifiedRef.current]))
      } catch { /* ignore */ }

    } catch (err) {
      console.error('[BrazosHealth] Check failed:', err)
    } finally {
      setLoading(false)
    }
  }, [addActivity])

  // Initial check after mount + periodic polling
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    // Delay initial check by 3 seconds to not block page load
    const initialTimeout = setTimeout(() => {
      checkHealth()
    }, 3000)

    const interval = setInterval(checkHealth, HEALTH_CHECK_INTERVAL)

    return () => {
      clearTimeout(initialTimeout)
      clearInterval(interval)
    }
  }, [checkHealth])

  return { report, loading, checkHealth }
}
