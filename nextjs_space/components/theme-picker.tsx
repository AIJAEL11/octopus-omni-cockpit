'use client'

/**
 * ThemePicker — 5 swatches para personalizar el look de OCTOPUS.
 * Cream (default) | Dark | Terminal | Ocean | Hermes
 */

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme, THEMES } from '@/lib/theme-context'
import { useI18n } from '@/lib/i18n-context'
import { Paintbrush } from 'lucide-react'

export function ThemePicker() {
  const { theme, setTheme } = useTheme()
  const { locale } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const current = THEMES.find(t => t.id === theme) ?? THEMES[0]

  return (
    <div ref={ref} className="relative flex-shrink-0">
      {/* Trigger */}
      <motion.button
        onClick={() => setOpen(o => !o)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all bg-[var(--bg-primary)] border-[var(--border-color)] hover:bg-[var(--hover-bg)]"
        title={locale === 'en' ? 'Theme' : 'Tema'}
      >
        {/* Active swatch */}
        <span
          className="w-4 h-4 rounded-full border border-black/20 flex-shrink-0 ring-2 ring-[var(--accent-primary,#4A90D9)]/40"
          style={{ backgroundColor: current.swatch }}
        />
        <Paintbrush className="w-3.5 h-3.5 text-[var(--text-muted)]" />
      </motion.button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.14 }}
            className="absolute right-0 top-full mt-2 z-[9999] min-w-[180px] rounded-2xl border border-[var(--border-color)] bg-[var(--bg-elevated,#fff)] shadow-xl shadow-black/20 overflow-hidden"
          >
            <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
              {locale === 'en' ? 'Theme' : 'Tema'}
            </p>
            <div className="p-2 space-y-0.5">
              {THEMES.map(t => {
                const active = t.id === theme
                return (
                  <button
                    key={t.id}
                    onClick={() => { setTheme(t.id); setOpen(false) }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all ${
                      active
                        ? 'bg-[var(--accent-primary,#4A90D9)]/15 text-[var(--text-primary)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
                    }`}
                  >
                    {/* Swatch */}
                    <span
                      className={`w-5 h-5 rounded-full border flex-shrink-0 transition-all ${
                        active ? 'ring-2 ring-[var(--accent-primary,#4A90D9)] ring-offset-1 ring-offset-[var(--bg-elevated,#fff)]' : 'border-black/20'
                      }`}
                      style={{ backgroundColor: t.swatch }}
                    />
                    <span className="font-medium flex-1 text-left">
                      {locale === 'en' ? t.labelEn : t.labelEs}
                    </span>
                    {t.isDark && (
                      <span className="text-[9px] opacity-50 uppercase tracking-wide">dark</span>
                    )}
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
