'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, X, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface LimitWarning {
  label: string
  current: number
  limit: number
  color: string
  percent: number
}

export function PlanLimitToast() {
  const [warnings, setWarnings] = useState<LimitWarning[]>([])
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const checkLimits = useCallback(async () => {
    try {
      const res = await fetch('/api/plan/usage')
      if (!res.ok) return
      const data = await res.json()
      if (data.planId !== 'starter') return

      const checks: { label: string; current: number; limit: number; color: string }[] = [
        { label: 'Leads', current: data.leads.current, limit: data.leads.limit, color: '#FFD700' },
        { label: 'Creative', current: data.creative.current, limit: data.creative.limit, color: '#8B5CF6' },
        { label: 'IoT', current: data.iot.current, limit: data.iot.limit, color: '#0EA5E9' },
        { label: 'API Keys', current: data.api_keys.current, limit: data.api_keys.limit, color: '#6366F1' },
        { label: 'Brazos', current: data.brazos.current, limit: data.brazos.limit, color: '#14B8A6' },
      ]

      const approaching = checks
        .filter(c => c.limit > 0 && c.limit < 999999)
        .map(c => ({ ...c, percent: Math.round((c.current / c.limit) * 100) }))
        .filter(c => c.percent >= 80)
        .sort((a, b) => b.percent - a.percent)

      if (approaching.length > 0) {
        // Check sessionStorage to avoid spamming on every nav
        const key = 'octopus_limit_warn_' + new Date().toDateString()
        if (typeof window !== 'undefined' && sessionStorage.getItem(key)) return
        setWarnings(approaching)
        setVisible(true)
        if (typeof window !== 'undefined') sessionStorage.setItem(key, '1')
      }
    } catch {
      // Silently fail
    }
  }, [])

  useEffect(() => {
    // Delay check to avoid blocking initial render
    const timer = setTimeout(checkLimits, 3000)
    return () => clearTimeout(timer)
  }, [])

  // Auto-dismiss after 12 seconds
  useEffect(() => {
    if (visible) {
      const t = setTimeout(() => setVisible(false), 12000)
      return () => clearTimeout(t)
    }
  }, [visible])

  if (dismissed) return null

  return (
    <AnimatePresence>
      {visible && warnings.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 60, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed bottom-6 right-6 z-[9999] max-w-sm w-full"
        >
          <div className="bg-[#1A1A1A] border border-amber-500/30 rounded-2xl shadow-2xl shadow-amber-500/10 overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 pt-3 pb-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-sm font-semibold text-amber-400 flex-1">
                Acercándote al límite
              </span>
              <button
                onClick={() => { setVisible(false); setDismissed(true) }}
                className="p-1 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Warning items */}
            <div className="px-4 pb-2 space-y-2">
              {warnings.map(w => (
                <div key={w.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-white/60">{w.label}</span>
                    <span className={`text-xs font-mono ${w.percent >= 100 ? 'text-red-400' : 'text-amber-300'}`}>
                      {w.current}/{w.limit} ({w.percent}%)
                    </span>
                  </div>
                  <div className="h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, w.percent)}%` }}
                      transition={{ duration: 0.8, delay: 0.2 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: w.percent >= 100 ? '#EF4444' : w.color }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <Link href="/pricing">
              <div className="px-4 py-2.5 bg-gradient-to-r from-amber-500/10 to-[#C4622D]/10 border-t border-white/[0.06] flex items-center justify-between cursor-pointer hover:from-amber-500/20 hover:to-[#C4622D]/20 transition-colors">
                <span className="text-xs font-medium text-amber-300">Upgrade para más capacidad</span>
                <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
              </div>
            </Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
