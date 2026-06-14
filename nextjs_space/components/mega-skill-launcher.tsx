'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Rocket,
  User,
  Mail,
  Video,
  Image as ImageIcon,
  Mic,
  FileText,
  Zap,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  ArrowRight,
  Radio,
  ExternalLink,
  ChevronDown,
  Building2,
  Target,
  Package,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'

// ─── Types ────────────────────────────────────────────────────────────────────
interface ProcessStage {
  key: string
  label: string
  icon: React.ReactNode
  progressRange: [number, number]
}

interface SSEEvent {
  type: string
  processId?: string
  data?: {
    status: string
    stage?: string
    progress?: number
    message?: string
    leadId?: string
    leadName?: string
    assetId?: string
    assetUrl?: string
    assetType?: string
    emailSent?: boolean
    error?: string
  }
  ts?: number
}

type AssetType = 'video' | 'image' | 'audio' | 'document'
type ExecutionPhase = 'idle' | 'submitting' | 'running' | 'completed' | 'error'
type Objective = 'welcome' | 'sales' | 'demo' | 'follow_up' | 'custom'

// ─── Static config (labels resolved via t() inside component) ────────────────
const OBJECTIVE_KEYS: { value: Objective; tKey: string; emoji: string }[] = [
  { value: 'sales', tKey: 'ms.obj_sales', emoji: '💰' },
  { value: 'welcome', tKey: 'ms.obj_welcome', emoji: '👋' },
  { value: 'demo', tKey: 'ms.obj_demo', emoji: '🎮' },
  { value: 'follow_up', tKey: 'ms.obj_follow_up', emoji: '🔄' },
]

const ASSET_TYPE_KEYS: { value: AssetType; tLabel: string; tDesc: string; emoji: string; icon: typeof Video; color: string }[] = [
  { value: 'video', tLabel: 'ms.video', tDesc: 'ms.video_desc', emoji: '🎬', icon: Video, color: '#FFD700' },
  { value: 'image', tLabel: 'ms.image', tDesc: 'ms.image_desc', emoji: '🖼️', icon: ImageIcon, color: '#C4622D' },
  { value: 'audio', tLabel: 'ms.audio', tDesc: 'ms.audio_desc', emoji: '🎙️', icon: Mic, color: '#8B5CF6' },
  { value: 'document', tLabel: 'ms.document', tDesc: 'ms.document_desc', emoji: '📄', icon: FileText, color: '#10B981' },
]

const PIPELINE_STAGE_KEYS: { key: string; tLabel: string; icon: React.ReactNode; progressRange: [number, number] }[] = [
  { key: 'creating_lead', tLabel: 'ms.stage_lead', icon: <User className="w-4 h-4" />, progressRange: [0, 25] },
  { key: 'generating_asset', tLabel: 'ms.stage_generating', icon: <Sparkles className="w-4 h-4" />, progressRange: [26, 75] },
  { key: 'sending_email', tLabel: 'ms.stage_email', icon: <Mail className="w-4 h-4" />, progressRange: [76, 90] },
  { key: 'done', tLabel: 'ms.stage_done', icon: <CheckCircle2 className="w-4 h-4" />, progressRange: [91, 100] },
]

// ─── Component ────────────────────────────────────────────────────────────────
export function MegaSkillLauncher() {
  const { t, locale } = useI18n()

  // Form state
  const [leadName, setLeadName] = useState('')
  const [leadEmail, setLeadEmail] = useState('')
  const [assetType, setAssetType] = useState<AssetType>('video')

  // Brand context state — Brand DNA is OPEN by default (mandatory)
  const [showBrand, setShowBrand] = useState(true)
  const [brandName, setBrandName] = useState('')
  const [brandDescription, setBrandDescription] = useState('')
  const [productDescription, setProductDescription] = useState('')
  const [brandTone, setBrandTone] = useState('')
  const [brandAudience, setBrandAudience] = useState('')
  const [objective, setObjective] = useState<Objective>('sales')

  // Execution state
  const [phase, setPhase] = useState<ExecutionPhase>('idle')
  const [processId, setProcessId] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [currentStage, setCurrentStage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [resultData, setResultData] = useState<{ assetUrl?: string; assetId?: string; emailSent?: boolean } | null>(null)

  // SSE ref
  const eventSourceRef = useRef<EventSource | null>(null)

  // Log entries for the live feed
  const [logEntries, setLogEntries] = useState<Array<{ time: string; msg: string; type: string }>>([])

  const addLog = useCallback((msg: string, type: string = 'info') => {
    const now = new Date()
    const time = now.toLocaleTimeString(locale === 'es' ? 'es' : 'en', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setLogEntries(prev => [...prev.slice(-12), { time, msg, type }])
  }, [locale])

  const currentAsset = ASSET_TYPE_KEYS.find(a => a.value === assetType) || ASSET_TYPE_KEYS[0]

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close()
    }
  }, [])

  // ─── Connect SSE ──────────────────────────────────────────────────────────
  const connectSSE = useCallback((pid: string) => {
    if (eventSourceRef.current) eventSourceRef.current.close()

    const es = new EventSource(`/api/skills/lead-to-asset/events?processId=${pid}`)
    eventSourceRef.current = es

    es.onmessage = (event) => {
      try {
        const data: SSEEvent = JSON.parse(event.data)
        if (data.type === 'heartbeat' || data.type === 'connected') return

        const d = data.data
        if (!d) return

        if (typeof d.progress === 'number') setProgress(d.progress)
        if (d.stage) setCurrentStage(d.stage)
        if (d.message) {
          setStatusMessage(d.message)
          addLog(d.message, d.status === 'error' ? 'error' : 'info')
        }

        if (data.type === 'lead_to_asset:done') {
          setPhase('completed')
          setProgress(100)
          setCurrentStage('done')
          setStatusMessage(t('ms.mission_done'))
          setResultData({ assetUrl: d.assetUrl, assetId: d.assetId, emailSent: d.emailSent })
          addLog(t('ms.pipeline_completed_log'), 'success')
          es.close()
        }

        if (data.type === 'lead_to_asset:error') {
          setPhase('error')
          setErrorMessage(d.error || t('ms.unknown_error'))
          addLog(`❌ Error: ${d.error}`, 'error')
          es.close()
        }
      } catch { /* ignore */ }
    }

    es.onerror = () => {
      if (phase === 'completed' || phase === 'error') es.close()
    }
  }, [addLog, phase, t])

  // ─── Trigger Execution ────────────────────────────────────────────────────
  const handleTrigger = async () => {
    if (!leadName.trim() || !brandName.trim()) return

    setPhase('submitting')
    setProgress(0)
    setCurrentStage('')
    setStatusMessage(t('ms.pipeline_starting'))
    setErrorMessage('')
    setResultData(null)
    setLogEntries([])
    addLog(t('ms.pipeline_firing'), 'system')

    try {
      // Brand DNA is MANDATORY — brandName is NEVER empty at this point
      const brandPayload = {
        name: brandName.trim(),
        description: brandDescription.trim() || undefined,
        productDescription: productDescription.trim() || undefined,
        tone: brandTone.trim() || undefined,
        audience: brandAudience.trim() || undefined,
      };

      const res = await fetch('/api/skills/lead-to-asset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead: { name: leadName.trim(), email: leadEmail.trim() || undefined },
          brand: brandPayload,
          objective,
          assetType,
          language: locale,
          sendEmail: !!leadEmail.trim(),
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || t('ms.start_error'))
      }

      const result = await res.json()
      setProcessId(result.processId)
      setPhase('running')
      addLog(`${t('ms.process_created')} ${result.processId}`, 'system')
      connectSSE(result.processId)

    } catch (err: unknown) {
      setPhase('error')
      const msg = err instanceof Error ? err.message : t('ms.unknown_error')
      setErrorMessage(msg)
      addLog(`❌ ${msg}`, 'error')
    }
  }

  const handleReset = () => {
    if (eventSourceRef.current) eventSourceRef.current.close()
    setPhase('idle')
    setProcessId(null)
    setProgress(0)
    setCurrentStage('')
    setStatusMessage('')
    setErrorMessage('')
    setResultData(null)
    setLogEntries([])
    setLeadName('')
    setLeadEmail('')
    // Keep brand fields — user likely wants to reuse for next lead
  }

  // ─── Get active stage index ───────────────────────────────────────────────
  const getActiveStageIndex = () => {
    if (currentStage === 'done' || phase === 'completed') return 3
    if (currentStage.includes('email') || currentStage === 'sending_email') return 2
    if (currentStage.includes('asset') || currentStage === 'generating_asset' || currentStage === 'asset_generated') return 1
    if (currentStage.includes('lead') || currentStage === 'creating_lead' || currentStage === 'lead_registered') return 0
    if (progress > 75) return 2
    if (progress > 25) return 1
    return 0
  }

  const activeStageIdx = getActiveStageIndex()
  const isRunning = phase === 'running' || phase === 'submitting'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
    >
      {/* Dark premium container — distinct from the light dashboard */}
      <div className="card-shine relative rounded-2xl bg-gradient-to-br from-[#0C1222] via-[#111B2E] to-[#0C1222] border border-[#FFD700]/10 shadow-xl shadow-[#FFD700]/5 p-5 sm:p-6">
        {/* Background glow effects */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-[#FFD700]/8 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-[#C4622D]/6 rounded-full blur-3xl" />
          {isRunning && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-[#FFD700]/5 to-transparent"
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
            />
          )}
        </div>

        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FFD700] to-[#C4622D] flex items-center justify-center shadow-lg shadow-[#FFD700]/20">
                <Rocket className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-[#F5F0E8] flex items-center gap-2">
                  {t('ms.title')}
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#FFD700]/15 text-[#FFD700] border border-[#FFD700]/20">
                    {t('ms.active')}
                  </span>
                </h3>
                <p className="text-xs text-gray-400">{t('ms.subtitle')}</p>
              </div>
            </div>
            {(phase === 'completed' || phase === 'error') && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={handleReset}
                className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-gray-300 hover:text-white transition-all border border-white/10"
              >
                {t('ms.new_execution')}
              </motion.button>
            )}
          </div>

          <AnimatePresence mode="wait">
            {/* ─── IDLE: Form ─── */}
            {phase === 'idle' && (
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {/* Inputs row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      placeholder={t('ms.lead_name')}
                      value={leadName}
                      onChange={e => setLeadName(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-[#F5F0E8] placeholder-gray-500 focus:outline-none focus:border-[#FFD700]/50 focus:ring-1 focus:ring-[#FFD700]/30 text-sm transition-all"
                    />
                  </div>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="email"
                      placeholder={t('ms.lead_email')}
                      value={leadEmail}
                      onChange={e => setLeadEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-[#F5F0E8] placeholder-gray-500 focus:outline-none focus:border-[#FFD700]/50 focus:ring-1 focus:ring-[#FFD700]/30 text-sm transition-all"
                    />
                  </div>
                </div>

                {/* Asset type pills — inline, no dropdown clipping */}
                <div className="flex flex-wrap gap-2">
                  {ASSET_TYPE_KEYS.map(opt => {
                    const isSelected = assetType === opt.value
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setAssetType(opt.value)}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all border-2 ${
                          isSelected
                            ? 'text-white shadow-lg shadow-[color:var(--sel-color)]/25 ring-1 ring-[color:var(--sel-color)]/30 scale-[1.03]'
                            : 'border-white/8 bg-white/3 text-gray-400 hover:bg-white/5 hover:text-gray-300'
                        }`}
                        style={{
                          '--sel-color': opt.color,
                          ...(isSelected ? {
                            borderColor: opt.color,
                            background: `linear-gradient(135deg, ${opt.color}33 0%, ${opt.color}18 100%)`,
                          } : {}),
                        } as React.CSSProperties}
                      >
                        <opt.icon className="w-4 h-4" style={{ color: isSelected ? opt.color : undefined }} />
                        <span>{opt.emoji} {t(opt.tLabel)}</span>
                      </button>
                    )
                  })}
                </div>

                {/* Selected type description */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/3 border border-white/5">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: currentAsset.color }} />
                  <span className="text-[11px] text-gray-400">
                    <span className="text-gray-300 font-medium">{currentAsset.emoji} {t(currentAsset.tLabel)}:</span>{' '}
                    {t(currentAsset.tDesc)}
                  </span>
                </div>

                {/* ─── Brand DNA Collapsible ─── */}
                <div className="rounded-xl border border-white/8 overflow-hidden">
                  <button
                    onClick={() => setShowBrand(!showBrand)}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-[#FFD700]" />
                      <span className="text-xs font-medium text-gray-300">
                        {t('ms.brand_dna')}
                      </span>
                      {brandName.trim() ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#FFD700]/10 text-[#FFD700] border border-[#FFD700]/20">
                          ✓ {brandName.trim()}
                        </span>
                      ) : (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/25 animate-pulse">
                          ⚠ {t('ms.required')}
                        </span>
                      )}
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${showBrand ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {showBrand && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-3.5 pb-3.5 space-y-3 border-t border-white/5 pt-3">
                          {/* Objective pills */}
                          <div>
                            <label className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-1.5 flex items-center gap-1.5">
                              <Target className="w-3 h-3" /> {t('ms.objective')}
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                              {OBJECTIVE_KEYS.map(obj => (
                                <button
                                  key={obj.value}
                                  onClick={() => setObjective(obj.value)}
                                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border ${
                                    objective === obj.value
                                      ? 'border-[#FFD700]/30 bg-[#FFD700]/10 text-[#FFD700]'
                                      : 'border-white/8 bg-white/3 text-gray-500 hover:text-gray-300 hover:bg-white/5'
                                  }`}
                                >
                                  {obj.emoji} {t(obj.tKey)}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Brand name + Product — side by side */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="relative">
                              <Building2 className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${brandName.trim() ? 'text-[#FFD700]' : 'text-red-400'}`} />
                              <input
                                type="text"
                                placeholder={t('ms.brand_name')}
                                value={brandName}
                                onChange={e => setBrandName(e.target.value)}
                                className={`w-full pl-8 pr-3 py-2 rounded-lg bg-white/5 text-[#F5F0E8] placeholder-gray-600 focus:outline-none text-xs transition-all border ${
                                  brandName.trim()
                                    ? 'border-[#FFD700]/30 focus:border-[#FFD700]/60'
                                    : 'border-red-500/40 focus:border-red-400/60'
                                }`}
                              />
                              {!brandName.trim() && (
                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-red-400">{t('ms.brand_required')}</span>
                              )}
                            </div>
                            <div className="relative">
                              <Package className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
                              <input
                                type="text"
                                placeholder={t('ms.product_placeholder')}
                                value={productDescription}
                                onChange={e => setProductDescription(e.target.value)}
                                className="w-full pl-8 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[#F5F0E8] placeholder-gray-600 focus:outline-none focus:border-[#FFD700]/40 text-xs transition-all"
                              />
                            </div>
                          </div>

                          {/* Description — full width */}
                          <textarea
                            placeholder={t('ms.brand_desc_placeholder')}
                            value={brandDescription}
                            onChange={e => setBrandDescription(e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[#F5F0E8] placeholder-gray-600 focus:outline-none focus:border-[#FFD700]/40 text-xs transition-all resize-none"
                          />

                          {/* Tone + Audience — side by side */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              placeholder={t('ms.tone_placeholder')}
                              value={brandTone}
                              onChange={e => setBrandTone(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[#F5F0E8] placeholder-gray-600 focus:outline-none focus:border-[#FFD700]/40 text-xs transition-all"
                            />
                            <input
                              type="text"
                              placeholder={t('ms.audience_placeholder')}
                              value={brandAudience}
                              onChange={e => setBrandAudience(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[#F5F0E8] placeholder-gray-600 focus:outline-none focus:border-[#FFD700]/40 text-xs transition-all"
                            />
                          </div>

                          <p className="text-[10px] text-gray-600 leading-relaxed">
                            💡 {t('ms.brand_hint')} <strong className="text-gray-400">{t('ms.brand_hint_bold')}</strong> {t('ms.brand_hint_end')}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Trigger Button */}
                <button
                  onClick={handleTrigger}
                  disabled={!leadName.trim() || !brandName.trim()}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-[#FFD700] to-[#C4622D] text-[#0C1222] hover:shadow-lg hover:shadow-[#FFD700]/25 hover:scale-[1.01] active:scale-[0.99]"
                >
                  <Zap className="w-4 h-4" />
                  {!brandName.trim() ? t('ms.trigger_blocked') : t('ms.trigger')}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}

            {/* ─── RUNNING / COMPLETED / ERROR: Pipeline Monitor ─── */}
            {phase !== 'idle' && (
              <motion.div
                key="pipeline"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {/* Stepper */}
                <div className="grid grid-cols-4 gap-1.5">
                  {PIPELINE_STAGE_KEYS.map((stage, i) => {
                    const isActive = i === activeStageIdx && isRunning
                    const isCompleted = i < activeStageIdx || phase === 'completed'
                    const isFailed = phase === 'error' && i === activeStageIdx

                    return (
                      <motion.div
                        key={stage.key}
                        className={`relative flex flex-col items-center text-center p-2.5 sm:p-3 rounded-xl transition-all ${
                          isActive ? 'bg-[#FFD700]/10 border border-[#FFD700]/30' :
                          isCompleted ? 'bg-emerald-500/10 border border-emerald-500/20' :
                          isFailed ? 'bg-red-500/10 border border-red-500/20' :
                          'bg-white/[0.03] border border-white/5'
                        }`}
                        animate={isActive ? { scale: [1, 1.02, 1] } : {}}
                        transition={isActive ? { duration: 1.5, repeat: Infinity } : {}}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1.5 ${
                          isActive ? 'bg-[#FFD700]/20 text-[#FFD700]' :
                          isCompleted ? 'bg-emerald-500/20 text-emerald-400' :
                          isFailed ? 'bg-red-500/20 text-red-400' :
                          'bg-white/5 text-gray-500'
                        }`}>
                          {isActive ? <Loader2 className="w-4 h-4 animate-spin" /> :
                           isCompleted ? <CheckCircle2 className="w-4 h-4" /> :
                           isFailed ? <AlertCircle className="w-4 h-4" /> :
                           stage.icon}
                        </div>
                        <span className={`text-[10px] sm:text-xs font-medium leading-tight ${
                          isActive ? 'text-[#FFD700]' :
                          isCompleted ? 'text-emerald-400' :
                          isFailed ? 'text-red-400' :
                          'text-gray-500'
                        }`}>
                          {t(stage.tLabel)}
                        </span>
                        {isActive && (
                          <motion.div
                            className="absolute -inset-px rounded-xl border border-[#FFD700]/40"
                            animate={{ opacity: [0.4, 0.8, 0.4] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          />
                        )}
                      </motion.div>
                    )
                  })}
                </div>

                {/* Progress Bar */}
                <div className="relative">
                  <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full relative"
                      style={{
                        background: phase === 'error'
                          ? 'linear-gradient(90deg, #EF4444, #DC2626)'
                          : phase === 'completed'
                          ? 'linear-gradient(90deg, #10B981, #34D399)'
                          : `linear-gradient(90deg, ${currentAsset.color}, #C4622D)`,
                      }}
                      initial={{ width: '0%' }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    >
                      {isRunning && (
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                          animate={{ x: ['-100%', '200%'] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                        />
                      )}
                    </motion.div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-400 truncate max-w-[80%]">
                      {statusMessage || t('ms.preparing')}
                    </span>
                    <span className={`text-xs font-bold ${
                      phase === 'completed' ? 'text-emerald-400' :
                      phase === 'error' ? 'text-red-400' :
                      'text-[#FFD700]'
                    }`}>
                      {progress}%
                    </span>
                  </div>
                </div>

                {/* Error Message */}
                {phase === 'error' && errorMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="truncate">{errorMessage}</span>
                  </motion.div>
                )}

                {/* Completion Card */}
                {phase === 'completed' && resultData && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-[#FFD700]/5 border border-emerald-500/20"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-emerald-400 text-sm">{t('ms.pipeline_completed')}</p>
                          <p className="text-[11px] text-gray-400">
                            {currentAsset.emoji} {t(currentAsset.tLabel)} · ID: {resultData.assetId?.slice(0, 8)}...
                            {resultData.emailSent && ` · ✉️ ${t('ms.email_sent')}`}
                          </p>
                        </div>
                      </div>
                      {resultData.assetUrl && (
                        <a
                          href={resultData.assetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FFD700]/10 hover:bg-[#FFD700]/20 text-[#FFD700] text-xs font-medium transition-all border border-[#FFD700]/20"
                        >
                          <ExternalLink className="w-3 h-3" />
                          {t('ms.view_asset')}
                        </a>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Live Log Feed */}
                {logEntries.length > 0 && (
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-2">
                      <Radio className="w-3 h-3 text-[#FFD700]" />
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">{t('ms.live_feed')}</span>
                      {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-[#FFD700] animate-pulse" />}
                    </div>
                    <div className="max-h-[100px] overflow-y-auto space-y-0.5 scrollbar-thin">
                      {logEntries.map((entry, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-start gap-2 text-[11px] font-mono"
                        >
                          <span className="text-gray-600 shrink-0">{entry.time}</span>
                          <span className={`${
                            entry.type === 'error' ? 'text-red-400' :
                            entry.type === 'success' ? 'text-emerald-400' :
                            entry.type === 'system' ? 'text-[#FFD700]' :
                            'text-gray-400'
                          } truncate`}>
                            {entry.msg}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
