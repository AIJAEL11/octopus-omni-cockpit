'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, Rocket, Crown, Zap, ArrowRight, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n-context'

type GateFeatureUI = 'leads' | 'creative' | 'iot' | 'agents' | 'api_keys' | 'brazos' | 'jarvis_premium' | 'data_export' | 'turbo_mode'

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  feature: GateFeatureUI
  current: number
  limit: number
  requiredPlan?: string
}

const featureInfo: Record<string, { icon: typeof Zap; colorFrom: string; colorTo: string }> = {
  leads: { icon: Zap, colorFrom: '#FFD700', colorTo: '#C4622D' },
  creative: { icon: Sparkles, colorFrom: '#4A90D9', colorTo: '#8B5CF6' },
  iot: { icon: Rocket, colorFrom: '#0ea5e9', colorTo: '#10b981' },
  agents: { icon: Crown, colorFrom: '#F97316', colorTo: '#EF4444' },
  api_keys: { icon: Zap, colorFrom: '#6366F1', colorTo: '#8B5CF6' },
  brazos: { icon: Rocket, colorFrom: '#14B8A6', colorTo: '#0EA5E9' },
  jarvis_premium: { icon: Crown, colorFrom: '#FFD700', colorTo: '#F97316' },
  data_export: { icon: Rocket, colorFrom: '#10B981', colorTo: '#059669' },
  turbo_mode: { icon: Zap, colorFrom: '#F59E0B', colorTo: '#EF4444' },
}

export function UpgradeModal({ isOpen, onClose, feature, current, limit, requiredPlan }: UpgradeModalProps) {
  const { t, locale } = useI18n()
  const info = featureInfo[feature] || featureInfo.leads
  const Icon = info.icon

  const titles: Record<string, Record<string, string>> = {
    leads: { es: '¡Límite de leads alcanzado!', en: 'Lead limit reached!' },
    creative: { es: '¡Límite de creaciones este mes!', en: 'Monthly creation limit reached!' },
    iot: { es: '¡Límite de dispositivos IoT!', en: 'IoT device limit reached!' },
    agents: { es: '¡Límite de agentes alcanzado!', en: 'Agent limit reached!' },
    api_keys: { es: '¡Límite de API Keys!', en: 'API Key limit reached!' },
    brazos: { es: '¡Límite de conexiones Brazos!', en: 'Brazos connection limit reached!' },
    jarvis_premium: { es: '🧠 OCTOPUS Premium requerido', en: '🧠 OCTOPUS Premium required' },
    data_export: { es: '📦 Exportación de Datos', en: '📦 Data Export' },
    turbo_mode: { es: '⚡ Turbo Mode — Plan Pro requerido', en: '⚡ Turbo Mode — Pro Plan required' },
  }

  const descriptions: Record<string, Record<string, string>> = {
    leads: {
      es: `Tu plan actual permite hasta ${limit} leads. Tienes ${current}. Actualiza para desbloquear más leads y potenciar tu Growth Engine.`,
      en: `Your current plan allows up to ${limit} leads. You have ${current}. Upgrade to unlock more leads and supercharge your Growth Engine.`,
    },
    creative: {
      es: `Tu plan permite ${limit} creaciones por mes. Ya usaste ${current}. Actualiza para crear contenido ilimitado.`,
      en: `Your plan allows ${limit} creations per month. You've used ${current}. Upgrade for unlimited creative content.`,
    },
    iot: {
      es: `Tu plan permite hasta ${limit} dispositivos IoT. Tienes ${current}. Actualiza para conectar más dispositivos.`,
      en: `Your plan allows up to ${limit} IoT devices. You have ${current}. Upgrade to connect more devices.`,
    },
    agents: {
      es: `Tu plan permite hasta ${limit} agentes personalizados. Tienes ${current}. Actualiza para crear agentes ilimitados.`,
      en: `Your plan allows up to ${limit} custom agents. You have ${current}. Upgrade for unlimited agents.`,
    },
    api_keys: {
      es: `Tu plan permite hasta ${limit} API Keys. Tienes ${current}. Actualiza para conectar más servicios.`,
      en: `Your plan allows up to ${limit} API Keys. You have ${current}. Upgrade to connect more services.`,
    },
    brazos: {
      es: `Tu plan permite hasta ${limit} conexiones Brazos. Tienes ${current}. Actualiza para conectar más servicios.`,
      en: `Your plan allows up to ${limit} Brazos connections. You have ${current}. Upgrade for more connections.`,
    },
    jarvis_premium: {
      es: 'Modo voz, generación de imágenes y búsqueda web son funciones Premium de OCTOPUS. Actualiza para desbloquear el poder completo.',
      en: 'Voice mode, image generation, and web search are OCTOPUS Premium features. Upgrade to unlock full power.',
    },
    data_export: {
      es: 'La exportación completa de datos está disponible para el plan Business. Descarga leads, proyectos, assets, agentes y más.',
      en: 'Full data export is available on the Business plan. Download leads, projects, assets, agents, and more.',
    },
    turbo_mode: {
      es: 'Turbo Mode te permite usar tu propia API key para modelos premium. Disponible desde el plan Pro.',
      en: 'Turbo Mode lets you use your own API key for premium models. Available from the Pro plan.',
    },
  }

  const lang = locale === 'es' ? 'es' : 'en'

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-2xl bg-[#1A2332] border border-white/10 overflow-hidden"
            style={{
              boxShadow: `0 12px 60px rgba(${feature === 'leads' ? '255, 215, 0' : feature === 'creative' ? '139, 92, 246' : '14, 165, 233'}, 0.15)`,
            }}
          >
            {/* Gradient top bar */}
            <div
              className="h-1.5 w-full"
              style={{ background: `linear-gradient(to right, ${info.colorFrom}, ${info.colorTo})` }}
            />

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4 text-white/50" />
            </button>

            <div className="p-8">
              {/* Icon */}
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 mx-auto"
                style={{ background: `linear-gradient(135deg, ${info.colorFrom}20, ${info.colorTo}20)` }}
              >
                <Icon className="w-8 h-8" style={{ color: info.colorFrom }} />
              </div>

              {/* Title */}
              <h3 className="text-xl font-bold text-white text-center mb-3">
                {titles[feature]?.[lang] || titles.leads[lang]}
              </h3>

              {/* Description */}
              <p className="text-sm text-white/50 text-center mb-6 leading-relaxed">
                {descriptions[feature]?.[lang] || descriptions.leads[lang]}
              </p>

              {/* Usage bar (skip for boolean features) */}
              {!['jarvis_premium', 'data_export', 'turbo_mode'].includes(feature) && limit > 0 && (
                <div className="mb-8">
                  <div className="flex items-center justify-between text-xs text-white/40 mb-2">
                    <span>{lang === 'es' ? 'Uso actual' : 'Current usage'}</span>
                    <span className="font-mono">{current}/{limit}</span>
                  </div>
                  <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, (current / Math.max(limit, 1)) * 100)}%`,
                        background: `linear-gradient(to right, ${info.colorFrom}, ${info.colorTo})`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* CTA Buttons */}
              <div className="space-y-3">
                <Link
                  href="/pricing"
                  className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-semibold text-sm text-white transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
                  style={{
                    background: `linear-gradient(to right, ${info.colorFrom}, ${info.colorTo})`,
                    color: feature === 'leads' ? '#000' : '#fff',
                  }}
                >
                  <Crown className="w-4 h-4" />
                  {lang === 'es'
                    ? `Actualizar a ${(requiredPlan || 'Pro').charAt(0).toUpperCase() + (requiredPlan || 'Pro').slice(1)}`
                    : `Upgrade to ${(requiredPlan || 'Pro').charAt(0).toUpperCase() + (requiredPlan || 'Pro').slice(1)}`
                  }
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <button
                  onClick={onClose}
                  className="w-full py-3 rounded-xl text-sm text-white/40 hover:text-white/60 hover:bg-white/5 transition-colors"
                >
                  {lang === 'es' ? 'Continuar con plan actual' : 'Continue with current plan'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
