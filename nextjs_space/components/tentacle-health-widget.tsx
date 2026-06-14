'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Activity, RefreshCw, ChevronRight, PlugZap } from 'lucide-react'
import { Card } from '@/components/ui/card'

interface BrazoHealth {
  armType: string
  name: string
  status: string // healthy | degraded | error | disconnected
}

interface HealthReport {
  overall: string
  total: number
  healthy: number
  degraded: number
  errors: number
  brazos: BrazoHealth[]
}

const STATUS_DOT: Record<string, string> = {
  healthy: 'bg-emerald-500',
  degraded: 'bg-amber-400',
  error: 'bg-red-500',
  disconnected: 'bg-gray-300 dark:bg-gray-600',
}

const STATUS_LABEL: Record<string, string> = {
  healthy: 'Operativo',
  degraded: 'Degradado',
  error: 'Error',
  disconnected: 'Desconectado',
}

export function TentacleHealthWidget() {
  const [report, setReport] = useState<HealthReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchHealth = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true)
    try {
      const res = await fetch('/api/brazos/health')
      if (res.ok) setReport(await res.json())
    } catch { /* silencioso */ }
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { fetchHealth() }, [fetchHealth])

  if (loading) return null

  const overallOk = report ? report.errors === 0 && report.degraded === 0 : true

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
      <Card className="dark:border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2D4A3E]/10 dark:bg-[#2D4A3E]/30 flex items-center justify-center">
              <Activity className="w-5 h-5 text-[#2D4A3E] dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-[#F5F0E8]">Salud de Tentáculos</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {report && report.total > 0
                  ? `${report.healthy}/${report.total} brazos operativos`
                  : 'Sin brazos conectados aún'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
              report && report.total === 0
                ? 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400'
                : overallOk
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${report && report.total === 0 ? 'bg-gray-400' : overallOk ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {report && report.total === 0 ? 'Sin conexiones' : overallOk ? 'Todo operativo' : 'Atención requerida'}
            </span>
            <button
              onClick={() => fetchHealth(true)}
              aria-label="Actualizar salud"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {report && report.total > 0 ? (
          <div className="flex flex-wrap gap-2">
            {report.brazos.map((b) => (
              <Link
                key={b.armType}
                href="/dashboard/brazos"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-white/10 text-xs font-medium text-gray-700 dark:text-gray-300 hover:border-[#C4622D]/40 transition-colors"
                title={STATUS_LABEL[b.status] || b.status}
              >
                <span className={`w-2 h-2 rounded-full ${STATUS_DOT[b.status] || 'bg-gray-300'}`} />
                {b.name}
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl bg-gray-50 dark:bg-white/5 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 flex-1">
              Conecta Gmail, Calendar o tus redes para que OCTOPUS trabaje con tus datos reales.
            </p>
            <Link
              href="/dashboard/brazos"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2D4A3E] text-white text-sm font-semibold hover:bg-[#22382F] transition-colors self-start"
            >
              <PlugZap className="w-4 h-4" /> Conectar primer Brazo <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </Card>
    </motion.div>
  )
}
