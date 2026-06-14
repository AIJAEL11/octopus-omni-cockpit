'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Star, X, Send, Sparkles, MessageSquare, Zap, Megaphone, TrendingUp } from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'

// ============================================
// CONTEXT-AWARE FEEDBACK CONFIGURATION
// ============================================
type FeedbackType = 'emotion' | 'usability' | 'results'

interface FeedbackContext {
  feedbackType: FeedbackType
  icon: typeof Star
  titleEs: string
  titleEn: string
  subtitleEs: string
  subtitleEn: string
  placeholderEs: string
  placeholderEn: string
  ratingLabelsEs: string[]
  ratingLabelsEn: string[]
  contextQuestionEs?: string
  contextQuestionEn?: string
}

const FEEDBACK_CONTEXTS: Record<string, FeedbackContext> = {
  // Motion Graphics / Audio Factory → EMOTION (Wow Score)
  audio_factory: {
    feedbackType: 'emotion',
    icon: Zap,
    titleEs: '¿Qué tan wow fue esta generación?',
    titleEn: 'How wow was this generation?',
    subtitleEs: 'Tu reacción emocional nos ayuda a calibrar la IA',
    subtitleEn: 'Your emotional reaction helps us calibrate the AI',
    placeholderEs: '¿Qué sentiste al ver el resultado? ¿Te sorprendió?',
    placeholderEn: 'What did you feel seeing the result? Were you surprised?',
    ratingLabelsEs: ['', 'Meh 😐', 'Okay 🤔', 'Bien 😊', 'Wow 🤩', '¡INCREÍBLE! 🔥'],
    ratingLabelsEn: ['', 'Meh 😐', 'Okay 🤔', 'Nice 😊', 'Wow 🤩', 'AMAZING! 🔥'],
  },
  motion_graphics: {
    feedbackType: 'emotion',
    icon: Zap,
    titleEs: '¿Qué tan wow fue este video?',
    titleEn: 'How wow was this video?',
    subtitleEs: 'Tu reacción emocional nos ayuda a calibrar la IA',
    subtitleEn: 'Your emotional reaction helps us calibrate the AI',
    placeholderEs: '¿Qué sentiste al ver el resultado? ¿Te sorprendió?',
    placeholderEn: 'What did you feel seeing the result? Were you surprised?',
    ratingLabelsEs: ['', 'Meh 😐', 'Okay 🤔', 'Bien 😊', 'Wow 🤩', '¡INCREÍBLE! 🔥'],
    ratingLabelsEn: ['', 'Meh 😐', 'Okay 🤔', 'Nice 😊', 'Wow 🤩', 'AMAZING! 🔥'],
  },
  // Ad Factory → USABILITY (Publish Score)
  ad_factory: {
    feedbackType: 'usability',
    icon: Megaphone,
    titleEs: '¿Publicarías este anuncio?',
    titleEn: 'Would you publish this ad?',
    subtitleEs: '¿Está listo para lanzar o necesita más trabajo?',
    subtitleEn: 'Is it ready to launch or needs more work?',
    placeholderEs: '¿Qué ajustarías antes de publicar?',
    placeholderEn: 'What would you adjust before publishing?',
    ratingLabelsEs: ['', 'Ni loco 🚫', 'Con cambios 🔧', 'Casi listo 🎯', 'Sí, lo publicaría 📢', '¡YA LO PUBLIQUÉ! 🚀'],
    ratingLabelsEn: ['', 'No way 🚫', 'Needs work 🔧', 'Almost there 🎯', "Yes, I'd publish 📢", 'ALREADY DID! 🚀'],
    contextQuestionEs: '¿Para qué plataforma es este anuncio?',
    contextQuestionEn: 'Which platform is this ad for?',
  },
  // Growth Engine → RESULTS (Success Score)
  growth_engine: {
    feedbackType: 'results',
    icon: TrendingUp,
    titleEs: '¿Octopus genera resultados reales?',
    titleEn: 'Is Octopus generating real results?',
    subtitleEs: 'Tu feedback directo impacta nuestras prioridades',
    subtitleEn: 'Your direct feedback impacts our priorities',
    placeholderEs: '¿Qué resultados concretos has visto? Leads, ventas, engagement...',
    placeholderEn: 'What concrete results have you seen? Leads, sales, engagement...',
    ratingLabelsEs: ['', 'Sin resultados 📉', 'Poco impacto 😕', 'Resultados moderados 📊', 'Buenos resultados 💰', '¡ROI brutal! 🏆'],
    ratingLabelsEn: ['', 'No results 📉', 'Low impact 😕', 'Moderate results 📊', 'Good results 💰', 'Killer ROI! 🏆'],
    contextQuestionEs: '¿Cuánto tiempo llevas usando Growth Engine?',
    contextQuestionEn: 'How long have you been using Growth Engine?',
  },
}

// Default fallback context
const DEFAULT_CONTEXT: FeedbackContext = {
  feedbackType: 'emotion',
  icon: MessageSquare,
  titleEs: 'Califica esta experiencia',
  titleEn: 'Rate this experience',
  subtitleEs: 'Tu opinión nos ayuda a mejorar OCTOPUS',
  subtitleEn: 'Your feedback helps us improve OCTOPUS',
  placeholderEs: 'Cuéntanos más (opcional)...',
  placeholderEn: 'Tell us more (optional)...',
  ratingLabelsEs: ['', 'Malo', 'Regular', 'Bueno', 'Muy bueno', '¡Excelente!'],
  ratingLabelsEn: ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent!'],
}

// ============================================
// FEEDBACK MODAL COMPONENT
// ============================================
interface FeedbackModalProps {
  isOpen: boolean
  onClose: () => void
  featureUsed?: string
  featureLabel?: string
}

export function FeedbackModal({ isOpen, onClose, featureUsed, featureLabel }: FeedbackModalProps) {
  const { locale } = useI18n()
  const es = locale === 'es'
  const [rating, setRating] = useState(0)
  const [hoveredStar, setHoveredStar] = useState(0)
  const [comment, setComment] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Get context-aware configuration
  const ctx = FEEDBACK_CONTEXTS[featureUsed || ''] || DEFAULT_CONTEXT
  const IconComponent = ctx.icon

  const handleSubmit = useCallback(async () => {
    if (rating === 0) return
    setSubmitting(true)
    try {
      await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          comment: comment.trim() || null,
          featureUsed,
          feedbackType: ctx.feedbackType,
          isPublic,
        }),
      })
      setSubmitted(true)
      setTimeout(() => { onClose(); setSubmitted(false); setRating(0); setComment('') }, 2000)
    } catch { /* silent */ } finally { setSubmitting(false) }
  }, [rating, comment, featureUsed, ctx.feedbackType, isPublic, onClose])

  const ratingLabels = es ? ctx.ratingLabelsEs : ctx.ratingLabelsEn

  // Color based on feedback type
  const typeColors: Record<FeedbackType, { from: string; to: string }> = {
    emotion: { from: '#FFD700', to: '#C4622D' },
    usability: { from: '#8B5CF6', to: '#6D28D9' },
    results: { from: '#10B981', to: '#059669' },
  }
  const colors = typeColors[ctx.feedbackType]

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="relative w-full max-w-md bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 shadow-2xl"
          >
            <button onClick={onClose} className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>

            {submitted ? (
              <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="text-center py-8">
                <Sparkles className="w-12 h-12 text-[#FFD700] mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">
                  {es ? '¡Gracias por tu feedback!' : 'Thanks for your feedback!'}
                </h3>
                <p className="text-white/60 text-sm">
                  {ctx.feedbackType === 'results' && rating <= 2
                    ? (es ? '⚡ Tu feedback ha sido marcado como PRIORIDAD ALTA. Lo revisaremos de inmediato.'
                         : '⚡ Your feedback has been flagged as HIGH PRIORITY. We\'ll review it immediately.')
                    : (es ? 'Tu opinión impulsa mejoras reales en OCTOPUS' : 'Your feedback drives real improvements in OCTOPUS')}
                </p>
              </motion.div>
            ) : (
              <>
                {/* Header with context-aware icon and title */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${colors.from}, ${colors.to})` }}>
                    <IconComponent className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      {es ? ctx.titleEs : ctx.titleEn}
                    </h3>
                    <p className="text-xs text-white/50">
                      {featureLabel && <span className="mr-2">{featureLabel}</span>}
                      {es ? ctx.subtitleEs : ctx.subtitleEn}
                    </p>
                  </div>
                </div>

                {/* Feedback type badge */}
                <div className="flex justify-center mb-4">
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${colors.from}20`, color: colors.from }}>
                    {ctx.feedbackType === 'emotion' ? (es ? '🎬 Wow Score' : '🎬 Wow Score')
                      : ctx.feedbackType === 'usability' ? (es ? '📢 Publish Score' : '📢 Publish Score')
                      : (es ? '💰 Success Score' : '💰 Success Score')}
                  </span>
                </div>

                {/* Stars */}
                <div className="flex items-center justify-center gap-2 mb-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onMouseEnter={() => setHoveredStar(n)}
                      onMouseLeave={() => setHoveredStar(0)}
                      onClick={() => setRating(n)}
                      className="transition-transform hover:scale-110"
                    >
                      <Star
                        className={`w-10 h-10 transition-colors ${
                          n <= (hoveredStar || rating)
                            ? 'fill-current'
                            : 'text-white/20'
                        }`}
                        style={n <= (hoveredStar || rating) ? { color: colors.from } : undefined}
                      />
                    </button>
                  ))}
                </div>
                <p className="text-center text-sm text-white/60 mb-6 h-5">
                  {ratingLabels[hoveredStar || rating] || ''}
                </p>

                {/* Comment (context-aware placeholder) */}
                {rating > 0 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <textarea
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      placeholder={es ? ctx.placeholderEs : ctx.placeholderEn}
                      className="w-full h-24 bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm placeholder-white/30 resize-none focus:outline-none focus:border-[#FFD700]/40"
                      maxLength={2000}
                    />

                    {/* Priority warning for negative results feedback */}
                    {ctx.feedbackType === 'results' && rating <= 2 && (
                      <div className="mt-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <p className="text-xs text-red-400">
                          ⚡ {es ? 'Este feedback será escalado como prioridad alta a nuestro equipo' : 'This feedback will be escalated as high priority to our team'}
                        </p>
                      </div>
                    )}

                    {/* Public toggle */}
                    <label className="flex items-center gap-2 mt-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isPublic}
                        onChange={e => setIsPublic(e.target.checked)}
                        className="w-4 h-4 rounded border-white/20 bg-white/10 accent-[#FFD700]"
                      />
                      <span className="text-xs text-white/50">
                        {es ? 'Mostrar en público (anónimo)' : 'Show publicly (anonymous)'}
                      </span>
                    </label>

                    {/* Submit */}
                    <button
                      onClick={handleSubmit}
                      disabled={submitting || rating === 0}
                      className="w-full mt-4 py-3 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      style={{ background: `linear-gradient(135deg, ${colors.from}, ${colors.to})` }}
                    >
                      {submitting ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <><Send className="w-4 h-4" /> {es ? 'Enviar Feedback' : 'Submit Feedback'}</>
                      )}
                    </button>
                  </motion.div>
                )}
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Hook to trigger feedback modal after generation events
export function useFeedbackTrigger() {
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackFeature, setFeedbackFeature] = useState<string>('')
  const [feedbackLabel, setFeedbackLabel] = useState<string>('')

  const triggerFeedback = useCallback((feature: string, label: string) => {
    // Only show ~30% of the time to avoid being annoying
    if (Math.random() < 0.3) {
      setTimeout(() => {
        setFeedbackFeature(feature)
        setFeedbackLabel(label)
        setShowFeedback(true)
      }, 2000)
    }
  }, [])

  return { showFeedback, setShowFeedback, feedbackFeature, feedbackLabel, triggerFeedback }
}
