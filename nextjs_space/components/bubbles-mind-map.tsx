'use client'

/**
 * OCTOPUS Bubbles — Mapa Mental Infinito
 * Visualización radial de la memoria: burbujas por categoría conectadas
 * por hilos brillantes que muestran la ruta de la información.
 */

import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface BubbleItem {
  id: string
  label: string
  detail: string
  source: string
  confidence: number
}

interface BubbleNode {
  id: string
  labelEs: string
  labelEn: string
  color: string
  items: BubbleItem[]
}

interface BubbleThread {
  from: string
  to: string
  via: string
  strength: number
}

interface BubblesMap {
  bubbles: BubbleNode[]
  threads: BubbleThread[]
  stats: { totalItems: number; totalBubbles: number; totalThreads: number }
}

const W = 900
const H = 640
const CX = W / 2
const CY = H / 2

export default function BubblesMindMap({ locale }: { locale: 'es' | 'en' }) {
  const [map, setMap] = useState<BubblesMap | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selected, setSelected] = useState<BubbleNode | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/octopus/bubbles')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(data => { if (!cancelled) { setMap(data); setLoading(false) } })
      .catch(() => { if (!cancelled) { setError(true); setLoading(false) } })
    return () => { cancelled = true }
  }, [])

  // Posiciones radiales de las burbujas con contenido
  const layout = useMemo(() => {
    if (!map) return new Map<string, { x: number; y: number; r: number }>()
    const visible = map.bubbles.filter(b => b.items.length > 0)
    const positions = new Map<string, { x: number; y: number; r: number }>()
    const orbit = Math.min(W, H) * 0.34
    visible.forEach((b, i) => {
      const angle = (i / visible.length) * Math.PI * 2 - Math.PI / 2
      const r = 34 + Math.min(b.items.length * 2.5, 30)
      positions.set(b.id, {
        x: CX + Math.cos(angle) * orbit,
        y: CY + Math.sin(angle) * orbit,
        r,
      })
    })
    return positions
  }, [map])

  const t = (es: string, en: string) => (locale === 'en' ? en : es)

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.6, repeat: Infinity }}
          className="text-4xl"
        >
          🫧
        </motion.div>
      </div>
    )
  }

  if (error || !map) {
    return (
      <div className="flex-1 flex items-center justify-center py-20 text-[var(--text-secondary)]">
        {t('No se pudo cargar el mapa de burbujas', 'Could not load the bubbles map')}
      </div>
    )
  }

  const visibleBubbles = map.bubbles.filter(b => b.items.length > 0)

  if (visibleBubbles.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3 text-center">
        <span className="text-5xl">🫧</span>
        <p className="font-semibold text-[var(--text-primary)]">
          {t('Tu mapa mental está naciendo', 'Your mind map is being born')}
        </p>
        <p className="text-sm text-[var(--text-secondary)] max-w-md">
          {t(
            'Conversa con OCTOPUS y cada hecho, preferencia y documento se organizará aquí en burbujas conectadas.',
            'Chat with OCTOPUS and every fact, preference and document will organize itself here into connected bubbles.'
          )}
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-4">
      {/* Stats */}
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="px-3 py-1.5 rounded-full bg-[#2D4A3E]/10 text-[#2D4A3E] font-medium">
          🫧 {map.stats.totalBubbles} {t('burbujas', 'bubbles')}
        </span>
        <span className="px-3 py-1.5 rounded-full bg-[#C4622D]/10 text-[#C4622D] font-medium">
          🧠 {map.stats.totalItems} {t('recuerdos', 'memories')}
        </span>
        <span className="px-3 py-1.5 rounded-full bg-[#4A90D9]/10 text-[#4A90D9] font-medium">
          🧵 {map.threads.length} {t('hilos', 'threads')}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Mapa SVG */}
        <div className="lg:col-span-2 rounded-2xl overflow-hidden border border-[var(--border-color)] bg-[#0d1420]">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img"
            aria-label={t('Mapa mental de memoria', 'Memory mind map')}>
            <defs>
              <radialGradient id="bubble-core" cx="35%" cy="30%" r="80%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </radialGradient>
              <filter id="bubble-glow" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="8" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Hilos entre burbujas */}
            {map.threads.map((thread, i) => {
              const from = layout.get(thread.from)
              const to = layout.get(thread.to)
              if (!from || !to) return null
              const midX = (from.x + to.x) / 2 + (CX - (from.x + to.x) / 2) * 0.3
              const midY = (from.y + to.y) / 2 + (CY - (from.y + to.y) / 2) * 0.3
              const fromBubble = map.bubbles.find(b => b.id === thread.from)
              return (
                <g key={`th-${i}`}>
                  <path
                    d={`M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}`}
                    fill="none"
                    stroke={fromBubble?.color || '#4A90D9'}
                    strokeWidth={1 + thread.strength * 2.5}
                    strokeOpacity={0.25 + thread.strength * 0.4}
                    strokeDasharray="6 10"
                  >
                    <animate attributeName="stroke-dashoffset" from="64" to="0" dur={`${3 + i % 4}s`} repeatCount="indefinite" />
                  </path>
                  <text x={midX} y={midY - 4} textAnchor="middle" fontSize="9"
                    fill="#8da3c0" opacity="0.7">
                    {thread.via}
                  </text>
                </g>
              )
            })}

            {/* Hilos del centro a cada burbuja */}
            {visibleBubbles.map(b => {
              const pos = layout.get(b.id)!
              return (
                <line key={`core-${b.id}`} x1={CX} y1={CY} x2={pos.x} y2={pos.y}
                  stroke={b.color} strokeWidth="1.5" strokeOpacity="0.35" strokeDasharray="3 6">
                  <animate attributeName="stroke-dashoffset" from="36" to="0" dur="4s" repeatCount="indefinite" />
                </line>
              )
            })}

            {/* Núcleo OCTOPUS */}
            <circle cx={CX} cy={CY} r="44" fill="#C4622D" fillOpacity="0.18" filter="url(#bubble-glow)" />
            <circle cx={CX} cy={CY} r="34" fill="#1a2433" stroke="#C4622D" strokeWidth="2" />
            <text x={CX} y={CY + 9} textAnchor="middle" fontSize="26">🐙</text>

            {/* Burbujas */}
            {visibleBubbles.map(b => {
              const pos = layout.get(b.id)!
              const isSelected = selected?.id === b.id
              return (
                <g key={b.id} onClick={() => setSelected(isSelected ? null : b)} style={{ cursor: 'pointer' }}>
                  <circle cx={pos.x} cy={pos.y} r={pos.r + 8} fill={b.color} fillOpacity="0.15" filter="url(#bubble-glow)">
                    <animate attributeName="r" values={`${pos.r + 6};${pos.r + 11};${pos.r + 6}`} dur="3.5s" repeatCount="indefinite" />
                  </circle>
                  <circle cx={pos.x} cy={pos.y} r={pos.r}
                    fill="#141d2c" stroke={b.color} strokeWidth={isSelected ? 3 : 1.8} />
                  <circle cx={pos.x} cy={pos.y} r={pos.r} fill="url(#bubble-core)" />
                  <text x={pos.x} y={pos.y - 2} textAnchor="middle" fontSize="12" fontWeight="600" fill="#e8eef7">
                    {locale === 'en' ? b.labelEn : b.labelEs}
                  </text>
                  <text x={pos.x} y={pos.y + 14} textAnchor="middle" fontSize="10" fill={b.color}>
                    {b.items.length} {locale === 'en' ? 'items' : 'datos'}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        {/* Panel de detalle */}
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card,#fff)] p-4 max-h-[640px] overflow-y-auto">
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div key={selected.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: selected.color }} />
                  <h3 className="font-bold text-[var(--text-primary)]">
                    {locale === 'en' ? selected.labelEn : selected.labelEs}
                  </h3>
                  <span className="text-xs text-[var(--text-secondary)]">({selected.items.length})</span>
                </div>
                <div className="space-y-2">
                  {selected.items.map(item => (
                    <div key={item.id} className="p-2.5 rounded-xl border border-[var(--border-color)] text-sm">
                      <p className="font-medium text-[var(--text-primary)] capitalize">{item.label}</p>
                      <p className="text-[var(--text-secondary)] break-words">{item.detail}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] uppercase tracking-wide" style={{ color: selected.color }}>
                          {item.source === 'document'
                            ? t('documento', 'document')
                            : t('memoria', 'memory')}
                        </span>
                        <div className="flex-1 h-1 rounded-full bg-[var(--border-color)] overflow-hidden">
                          <div className="h-full rounded-full" style={{
                            width: `${Math.round(item.confidence * 100)}%`,
                            backgroundColor: selected.color,
                          }} />
                        </div>
                        <span className="text-[10px] text-[var(--text-secondary)]">
                          {Math.round(item.confidence * 100)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="h-full flex flex-col items-center justify-center text-center gap-2 py-16 text-[var(--text-secondary)]">
                <span className="text-3xl">👆</span>
                <p className="text-sm max-w-[220px]">
                  {t(
                    'Toca una burbuja para explorar los recuerdos que contiene',
                    'Tap a bubble to explore the memories it holds'
                  )}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
