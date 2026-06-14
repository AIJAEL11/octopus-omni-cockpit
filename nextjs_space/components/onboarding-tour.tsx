'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, ChevronLeft, X, Sparkles, ArrowRight } from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'


interface TourStep {
  targetSelector: string
  title: { es: string; en: string }
  description: { es: string; en: string }
  icon: string
}

const TOUR_STEPS: TourStep[] = [
  {
    targetSelector: '[data-tour-id="octo-guide-bubble"]',
    title: { es: '\u{1F419} Conoce a Octo — Tu Asistente IA', en: '\u{1F419} Meet Octo — Your AI Assistant' },
    description: {
      es: '¡Este es tu compañero #1! Haz clic aquí en cualquier momento para chatear con Octo. Él conoce TODA la plataforma y te guiará paso a paso. ¿No sabes cómo hacer algo? ¡Pregúntale!',
      en: 'This is your #1 companion! Click here anytime to chat with Octo. He knows the ENTIRE platform and will guide you step by step.',
    },
    icon: '\u{1F419}',
  },
  {
    targetSelector: '[data-tour-id="nav-dashboard"]',
    title: { es: '\u{1F4CA} Command Center', en: '\u{1F4CA} Command Center' },
    description: {
      es: 'Tu centro de control. Aquí ves todo de un vistazo: leads, agentes activos, assets creativos y métricas en tiempo real.',
      en: 'Your control center. See everything at a glance: leads, active agents, creative assets, and real-time metrics.',
    },
    icon: '\u{1F4CA}',
  },
  {
    targetSelector: '[data-tour-id="nav-chat"]',
    title: { es: '\u{1F3A8} Creative Studio', en: '\u{1F3A8} Creative Studio' },
    description: {
      es: 'Tu estudio creativo con IA. Genera contenido visual, textos persuasivos, scripts y assets de marketing con asistencia inteligente.',
      en: 'Your AI creative studio. Generate visual content, persuasive copy, scripts, and marketing assets with intelligent assistance.',
    },
    icon: '\u{1F3A8}',
  },
  {
    targetSelector: '[data-tour-id="nav-jarvis"]',
    title: { es: '\u{1F9E0} OCTOPUS RAG 2.0+', en: '\u{1F9E0} OCTOPUS RAG 2.0+' },
    description: {
      es: 'Tu cerebro IA con memoria. Sube documentos, conecta datos y OCTOPUS aprende de tu negocio para respuestas personalizadas.',
      en: 'Your AI brain with memory. Upload docs, connect data, and OCTOPUS learns your business for personalized answers.',
    },
    icon: '\u{1F9E0}',
  },
  {
    targetSelector: '[data-tour-id="nav-growth"]',
    title: { es: '\u{1F4C8} Growth Engine', en: '\u{1F4C8} Growth Engine' },
    description: {
      es: 'Motor de crecimiento automatizado. Genera leads, envía outreach por email y convierte prospectos en clientes — todo con IA.',
      en: 'Automated growth engine. Generate leads, send email outreach, and convert prospects into clients — all with AI.',
    },
    icon: '\u{1F4C8}',
  },
  {
    targetSelector: '[data-tour-id="nav-ad-factory"]',
    title: { es: '\u{1F4E3} Ad Factory', en: '\u{1F4E3} Ad Factory' },
    description: {
      es: 'Genera anuncios profesionales con IA. Define tu marca, elige estilo y Ad Factory crea imágenes publicitarias listas para publicar.',
      en: 'Generate professional ads with AI. Define your brand, choose style, and Ad Factory creates publish-ready ad images.',
    },
    icon: '\u{1F4E3}',
  },
  {
    targetSelector: '[data-tour-id="nav-ugc-factory"]',
    title: { es: '\u{1F3AC} UGC Factory', en: '\u{1F3AC} UGC Factory' },
    description: {
      es: 'Crea videos con avatares IA. Lip-sync, motion control y producción de contenido UGC sin cámaras ni actores.',
      en: 'Create videos with AI avatars. Lip-sync, motion control, and UGC content production — no cameras or actors needed.',
    },
    icon: '\u{1F3AC}',
  },
  {
    targetSelector: '[data-tour-id="nav-sales-agent"]',
    title: { es: '\u{1F4BC} Sales Agent', en: '\u{1F4BC} Sales Agent' },
    description: {
      es: 'Agentes de venta IA que chatean con tus visitantes 24/7. Capturan leads, califican prospectos y agendan reuniones.',
      en: 'AI sales agents that chat with your visitors 24/7. Capture leads, qualify prospects, and book meetings automatically.',
    },
    icon: '\u{1F4BC}',
  },
  {
    targetSelector: '[data-tour-id="nav-brazos"]',
    title: { es: '\u{1F9BE} Active Arms (Brazos)', en: '\u{1F9BE} Active Arms' },
    description: {
      es: 'Conecta tus servicios externos: Google Calendar, Drive, Telegram y más. OCTOPUS extiende sus brazos para automatizar tu flujo.',
      en: 'Connect external services: Google Calendar, Drive, Telegram & more. OCTOPUS extends its arms to automate your workflow.',
    },
    icon: '\u{1F9BE}',
  },
  {
    targetSelector: '[data-tour-id="nav-social-bridge"]',
    title: { es: '\u{1F309} Social Bridge', en: '\u{1F309} Social Bridge' },
    description: {
      es: 'Publica contenido en LinkedIn y otras redes desde OCTOPUS. Programa posts, analiza engagement y crece tu presencia online.',
      en: 'Publish content on LinkedIn and other networks from OCTOPUS. Schedule posts, analyze engagement, grow your presence.',
    },
    icon: '\u{1F309}',
  },
]

export function OnboardingTour() {
  const { locale } = useI18n()
  const lang = locale === 'es' ? 'es' : 'en'
  const [show, setShow] = useState(false)
  const [step, setStep] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [showWelcome, setShowWelcome] = useState(true)
  const tooltipRef = useRef<HTMLDivElement>(null)

  // Check if tour should show
  useEffect(() => {
    const checkTour = async () => {
      try {
        const res = await fetch('/api/tour')
        const data = await res.json()
        if (!data.tourCompleted) {
          setTimeout(() => setShow(true), 1500)
        }
      } catch {
        // silent
      }
    }
    checkTour()
  }, [])

  // Position the tooltip near the target element
  const updateTargetRect = useCallback(() => {
    const currentStep = TOUR_STEPS[step]
    if (!currentStep) return
    const el = document.querySelector(currentStep.targetSelector)
    if (el) {
      const rect = el.getBoundingClientRect()
      setTargetRect(rect)
      // Scroll sidebar to show element
      const sidebar = el.closest('nav')
      if (sidebar) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    } else {
      setTargetRect(null)
    }
  }, [step])

  useEffect(() => {
    if (!show || showWelcome) return
    // Small delay before positioning to let scroll finish
    const timeout = setTimeout(updateTargetRect, 200)
    const interval = setInterval(updateTargetRect, 800)
    window.addEventListener('resize', updateTargetRect)
    return () => {
      clearTimeout(timeout)
      clearInterval(interval)
      window.removeEventListener('resize', updateTargetRect)
    }
  }, [show, showWelcome, step, updateTargetRect])

  const completeTour = useCallback(async () => {
    setShow(false)
    try {
      await fetch('/api/tour', { method: 'POST' })
    } catch {
      // silent
    }
  }, [])

  const nextStep = () => {
    if (step < TOUR_STEPS.length - 1) {
      setStep(step + 1)
    } else {
      completeTour()
    }
  }

  const prevStep = () => {
    if (step > 0) setStep(step - 1)
  }

  if (!show) return null

  const currentStep = TOUR_STEPS[step]

  // Calculate tooltip position — always visible on screen
  const getTooltipStyle = (): React.CSSProperties => {
    if (!targetRect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }

    const tooltipW = 360
    const tooltipH = 220
    const pad = 16
    const vw = window.innerWidth
    const vh = window.innerHeight

    // For the bubble (bottom-right), show tooltip above-left
    const isBubble = step === 0
    if (isBubble) {
      return {
        bottom: vh - targetRect.top + pad,
        right: vw - targetRect.right + pad,
        maxWidth: Math.min(tooltipW, vw - 32),
      }
    }

    // For sidebar items — show to the right of the item
    let top = targetRect.top
    let left = targetRect.right + pad

    // Clamp top so tooltip doesn't go off bottom
    if (top + tooltipH > vh - pad) {
      top = vh - tooltipH - pad
    }
    // Clamp top so tooltip doesn't go off top
    if (top < pad) top = pad

    // If tooltip goes off right edge, show to the left
    if (left + tooltipW > vw - pad) {
      left = targetRect.left - tooltipW - pad
      if (left < pad) left = pad
    }

    return { top, left, maxWidth: Math.min(tooltipW, vw - 32) }
  }

  return (
    <AnimatePresence>
      {show && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998]"
            style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
            onClick={completeTour}
          />

          {/* Spotlight cutout on target */}
          {targetRect && !showWelcome && (
            <div
              className="fixed rounded-2xl z-[9998] pointer-events-none transition-all duration-500 ease-out"
              style={{
                top: targetRect.top - 6,
                left: targetRect.left - 6,
                width: targetRect.width + 12,
                height: targetRect.height + 12,
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.7), 0 0 40px 8px rgba(103,61,230,0.5)',
                border: '2px solid rgba(168,85,247,0.7)',
              }}
            />
          )}

          {/* Welcome Modal */}
          <AnimatePresence>
            {showWelcome && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-gradient-to-br from-[#0a1628] via-[#0f1f3d] to-[#1a2744] border border-purple-500/30 rounded-3xl p-8 max-w-lg w-full shadow-2xl shadow-purple-500/30">
                  <div className="text-center">
                    {/* Octopus Icon */}
                    <motion.div
                      animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
                      transition={{ repeat: Infinity, duration: 3 }}
                      className="text-8xl mb-5 inline-block"
                    >
                      🐙
                    </motion.div>

                    <h2 className="text-3xl font-extrabold text-white mb-3 tracking-tight">
                      {lang === 'es' ? '¡Bienvenido a OCTOPUS!' : 'Welcome to OCTOPUS!'}
                    </h2>
                    <p className="text-white/80 mb-8 text-base leading-relaxed max-w-sm mx-auto">
                      {lang === 'es'
                        ? 'Te haré un recorrido rápido de 60 segundos para que conozcas todo lo que puedes hacer con tu cockpit. ¿Listo?'
                        : "I'll give you a quick 60-second tour so you know everything your cockpit can do. Ready?"}
                    </p>
                    <div className="flex gap-4">
                      <button
                        onClick={completeTour}
                        className="flex-1 px-5 py-3.5 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all text-base font-medium border border-white/10"
                      >
                        {lang === 'es' ? 'Saltar' : 'Skip'}
                      </button>
                      <button
                        onClick={() => setShowWelcome(false)}
                        className="flex-1 px-5 py-3.5 rounded-xl bg-gradient-to-r from-[#673de6] to-[#a855f7] text-white font-bold text-base hover:shadow-lg hover:shadow-purple-500/40 transition-all flex items-center justify-center gap-2"
                      >
                        <Sparkles className="w-5 h-5" />
                        {lang === 'es' ? '¡Vamos!' : "Let's Go!"}
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tour Tooltip */}
          <AnimatePresence mode="wait">
            {!showWelcome && currentStep && (
              <motion.div
                ref={tooltipRef}
                key={step}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="fixed z-[9999]"
                style={getTooltipStyle()}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-gradient-to-br from-[#0a1628] via-[#0f1f3d] to-[#1a2744] border border-purple-500/40 rounded-2xl p-5 shadow-2xl shadow-purple-500/30 w-[340px]">
                  {/* Close */}
                  <button
                    onClick={completeTour}
                    className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  {/* Step indicator */}
                  <div className="flex items-center gap-1.5 mb-4">
                    {TOUR_STEPS.map((_, i) => (
                      <div
                        key={i}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          i === step
                            ? 'w-7 bg-[#a855f7]'
                            : i < step
                            ? 'w-3 bg-[#a855f7]/50'
                            : 'w-2 bg-white/20'
                        }`}
                      />
                    ))}
                    <span className="ml-auto text-sm font-semibold text-white/50">
                      {step + 1}/{TOUR_STEPS.length}
                    </span>
                  </div>

                  {/* Content */}
                  <h3 className="text-lg font-bold text-white mb-2">
                    {currentStep.title[lang]}
                  </h3>
                  <p className="text-white/80 text-sm leading-relaxed mb-5">
                    {currentStep.description[lang]}
                  </p>

                  {/* Navigation buttons — big and visible */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={prevStep}
                      disabled={step === 0}
                      className="flex items-center justify-center gap-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 border border-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      {lang === 'es' ? 'Anterior' : 'Back'}
                    </button>
                    <button
                      onClick={nextStep}
                      className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#673de6] to-[#a855f7] hover:from-[#7c4dff] hover:to-[#c084fc] text-white text-sm font-bold transition-all shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50"
                    >
                      {step === TOUR_STEPS.length - 1
                        ? lang === 'es'
                          ? '¡Empezar! \u{1F680}'
                          : 'Start! \u{1F680}'
                        : lang === 'es'
                        ? 'Siguiente'
                        : 'Next'}
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  )
}
