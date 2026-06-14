'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { CheckCircle2, Circle, ChevronRight, Rocket, X } from 'lucide-react'
import { Card } from '@/components/ui/card'

interface ChecklistStep {
  id: string
  title: string
  description: string
  cta: string
  href: string
  done: boolean
}

const DISMISS_KEY = 'octopus-checklist-dismissed'

export function GettingStartedChecklist() {
  const [steps, setSteps] = useState<ChecklistStep[] | null>(null)
  const [completed, setCompleted] = useState(0)
  const [dismissed, setDismissed] = useState(true) // hidden until we know state

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        if (localStorage.getItem(DISMISS_KEY) === '1') return
        const res = await fetch('/api/onboarding/checklist')
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        if (data.allDone) return // todo completado: no molestar
        setSteps(data.steps)
        setCompleted(data.completed)
        setDismissed(false)
      } catch { /* silencioso */ }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const dismiss = () => {
    setDismissed(true)
    try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* noop */ }
  }

  if (dismissed || !steps) return null
  const total = steps.length
  const pct = Math.round((completed / total) * 100)

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
        <Card className="dark:border-white/10 relative overflow-hidden">
          <button
            onClick={dismiss}
            aria-label="Ocultar checklist"
            className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-[#C4622D]/10 dark:bg-[#C4622D]/20 flex items-center justify-center">
              <Rocket className="w-5 h-5 text-[#C4622D]" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-[#F5F0E8]">Primeros pasos con OCTOPUS</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{completed} de {total} completados</p>
            </div>
          </div>

          {/* Barra de progreso */}
          <div className="h-2 rounded-full bg-gray-100 dark:bg-white/10 my-4 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#C4622D] to-[#2D4A3E]"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`rounded-xl border p-3 transition-colors ${
                  step.done
                    ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-900/10'
                    : 'border-gray-200 dark:border-white/10 hover:border-[#C4622D]/40'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {step.done ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-300 dark:text-gray-600 mt-0.5 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold ${step.done ? 'text-emerald-700 dark:text-emerald-400 line-through' : 'text-gray-900 dark:text-[#F5F0E8]'}`}>
                      {step.title}
                    </p>
                    {!step.done && (
                      <>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">{step.description}</p>
                        <Link
                          href={step.href}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#C4622D] hover:text-[#A8501F] mt-2"
                        >
                          {step.cta} <ChevronRight className="w-3 h-3" />
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  )
}
