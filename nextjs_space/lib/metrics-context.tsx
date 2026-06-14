'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface Metrics {
  tasksRunning: number
  brazosActivos: number
  skillsActive: number
  apiConnections: number
  cpuUsage: number
  ramUsage: string
  uptime: string
}

interface Activity {
  id: string
  action: string
  time: string
  type: 'info' | 'success' | 'warning' | 'error'
}

interface TurboState {
  enabled: boolean
  provider: string | null
  model: string | null
}

interface MetricsContextType {
  metrics: Metrics
  activities: Activity[]
  turbo: TurboState
  addActivity: (action: string, type?: Activity['type']) => void
  updateMetrics: (updates: Partial<Metrics>) => void
  setTurbo: (state: TurboState) => void
  toggleTurbo: () => Promise<void>
}

const defaultMetrics: Metrics = {
  tasksRunning: 0,
  brazosActivos: 0,
  skillsActive: 0,
  apiConnections: 0,
  cpuUsage: 0,
  ramUsage: '0 GB',
  uptime: '00:00:00',
}

const MetricsContext = createContext<MetricsContextType | undefined>(undefined)

const defaultTurbo: TurboState = { enabled: false, provider: null, model: null }

export function MetricsProvider({ children }: { children: ReactNode }) {
  const [metrics, setMetrics] = useState<Metrics>(defaultMetrics)
  const [activities, setActivities] = useState<Activity[]>([])
  const [turbo, setTurboState] = useState<TurboState>(defaultTurbo)
  const [startTime] = useState(Date.now())

  // Cargar estado Turbo al iniciar
  useEffect(() => {
    fetch('/api/settings/turbo')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setTurboState({
            enabled: data.turboEnabled || false,
            provider: data.turboProvider || null,
            model: data.turboModel || null,
          })
        }
      })
      .catch(() => {})
  }, [])

  // Simulate real-time metrics updates
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000)
      const hours = Math.floor(elapsed / 3600).toString().padStart(2, '0')
      const minutes = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0')
      const seconds = (elapsed % 60).toString().padStart(2, '0')

      setMetrics(prev => ({
        ...prev,
        tasksRunning: Math.floor(Math.random() * 5) + 1,
        brazosActivos: 2, // GitHub + Telegram connected
        skillsActive: 6,
        apiConnections: 4,
        cpuUsage: Math.floor(Math.random() * 30) + 10,
        ramUsage: `${(Math.random() * 1 + 2).toFixed(1)} GB`,
        uptime: `${hours}:${minutes}:${seconds}`,
      }))
    }, 1000)

    return () => clearInterval(interval)
  }, [startTime])

  // Add initial activity
  useEffect(() => {
    addActivity('Dashboard inicializado', 'success')
    addActivity('Sistema de métricas activo', 'info')
  }, [])

  const addActivity = (action: string, type: Activity['type'] = 'info') => {
    const newActivity: Activity = {
      id: Date.now().toString(),
      action,
      time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      type,
    }
    setActivities(prev => [newActivity, ...prev].slice(0, 10))
  }

  const updateMetrics = (updates: Partial<Metrics>) => {
    setMetrics(prev => ({ ...prev, ...updates }))
  }

  const setTurbo = (state: TurboState) => {
    setTurboState(state)
  }

  const toggleTurbo = async () => {
    const newEnabled = !turbo.enabled
    try {
      await fetch('/api/settings/turbo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', enabled: newEnabled }),
      })
      setTurboState(prev => ({ ...prev, enabled: newEnabled }))
      addActivity(
        newEnabled ? '⚡ Turbo Mode ACTIVADO' : '⚡ Turbo Mode desactivado',
        newEnabled ? 'success' : 'info'
      )
    } catch {
      // silently fail
    }
  }

  return (
    <MetricsContext.Provider value={{ metrics, activities, turbo, addActivity, updateMetrics, setTurbo, toggleTurbo }}>
      {children}
    </MetricsContext.Provider>
  )
}

export function useMetrics() {
  const context = useContext(MetricsContext)
  if (!context) {
    throw new Error('useMetrics must be used within MetricsProvider')
  }
  return context
}
