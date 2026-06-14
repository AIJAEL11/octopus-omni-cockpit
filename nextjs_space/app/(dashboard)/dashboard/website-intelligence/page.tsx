'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Globe, Search, Loader2, ArrowRight, Zap, Eye, Shield, Smartphone,
  BarChart3, Type, Palette as PaletteIcon, TrendingUp, AlertTriangle,
  CheckCircle2, XCircle, Star, ExternalLink, Rocket, RefreshCw,
  Target, FileText, Users, Lock, ChevronDown, ChevronUp, Sparkles,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n-context'
import Link from 'next/link'
import { useEffect as useEffectReactive } from 'react'

interface Analysis {
  business: {
    name: string
    industry: string
    tagline: string
    description: string
  }
  design: {
    colors: { primary: string; secondary: string; accent: string; background: string; text: string }
    typography: { headings: string; body: string }
    style: string
    strengths: string[]
    weaknesses: string[]
  }
  scores: {
    overall: number
    design: number
    seo: number
    mobile: number
    performance: number
    content: number
    trust: number
    conversion: number
  }
  seo: {
    title: string
    description: string
    h1Count: number
    hasSchema: boolean
    hasOG: boolean
    issues: string[]
  }
  sections: { name: string; score: number; note: string }[]
  trustSignals: {
    hasTestimonials: boolean
    hasLogos: boolean
    hasCertifications: boolean
    hasContactInfo: boolean
    hasSocialProof: boolean
    score: number
  }
  competitors: { name: string; url: string; strength: string }[]
  recommendations: { priority: string; category: string; title: string; description: string }[]
  verdict: string
}

function ScoreRing({ score, size = 120, label, color }: { score: number; size?: number; label: string; color: string }) {
  const radius = (size - 12) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const scoreColor = score >= 80 ? '#22C55E' : score >= 60 ? '#F59E0B' : score >= 40 ? '#F97316' : '#EF4444'

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6} />
          <motion.circle
            cx={size/2} cy={size/2} r={radius} fill="none"
            stroke={color || scoreColor} strokeWidth={6} strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={circumference}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: 'easeOut', delay: 0.3 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-2xl font-bold text-white"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            {score}
          </motion.span>
        </div>
      </div>
      <span className="text-[10px] text-white/50 uppercase tracking-wider font-medium">{label}</span>
    </div>
  )
}

function MiniScore({ score, label, icon: Icon }: { score: number; label: string; icon: any }) {
  const bg = score >= 80 ? 'from-green-500/20 to-green-500/5' : score >= 60 ? 'from-amber-500/20 to-amber-500/5' : score >= 40 ? 'from-orange-500/20 to-orange-500/5' : 'from-red-500/20 to-red-500/5'
  const text = score >= 80 ? 'text-green-400' : score >= 60 ? 'text-amber-400' : score >= 40 ? 'text-orange-400' : 'text-red-400'
  const bar = score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-amber-500' : score >= 40 ? 'bg-orange-500' : 'bg-red-500'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-gradient-to-b ${bg} rounded-xl p-3 border border-white/5`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-3.5 h-3.5 ${text}`} />
        <span className="text-[10px] text-white/50 uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className={`text-xl font-bold ${text}`}>{score}</span>
        <span className="text-[10px] text-white/30 mb-1">/100</span>
      </div>
      <div className="w-full h-1 bg-white/5 rounded-full mt-2 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${bar}`}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1, delay: 0.5, ease: 'easeOut' }}
        />
      </div>
    </motion.div>
  )
}

function ColorSwatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="w-12 h-12 rounded-xl border border-white/10 shadow-lg"
        style={{ backgroundColor: color }}
      />
      <span className="text-[9px] font-mono text-white/40">{color}</span>
      <span className="text-[10px] text-white/60">{label}</span>
    </div>
  )
}

export default function WebsiteIntelligencePage() {
  const { t, locale } = useI18n()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [error, setError] = useState('')
  const [expandedRec, setExpandedRec] = useState<number | null>(null)
  const resultRef = useRef<HTMLDivElement>(null)
  const lastLocaleRef = useRef(locale)
  const lastScannedUrl = useRef('')

  // Auto re-scan when language changes and there are existing results
  useEffectReactive(() => {
    if (lastLocaleRef.current !== locale && analysis && lastScannedUrl.current) {
      lastLocaleRef.current = locale
      analyzeWithLocale(lastScannedUrl.current, locale)
    } else {
      lastLocaleRef.current = locale
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale])

  const analyzeWithLocale = async (targetUrl: string, lang: string) => {
    if (!targetUrl.trim()) return
    setLoading(true)
    setError('')
    setAnalysis(null)
    try {
      const res = await fetch('/api/website-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl.trim(), locale: lang }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al analizar')
      setAnalysis(data.analysis)
      lastScannedUrl.current = targetUrl.trim()
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300)
    } catch (e: any) {
      setError(e.message || 'Error al analizar el sitio')
    } finally {
      setLoading(false)
    }
  }

  const analyze = () => analyzeWithLocale(url, locale)

  const scoreColor = (s: number) => s >= 80 ? '#22C55E' : s >= 60 ? '#F59E0B' : s >= 40 ? '#F97316' : '#EF4444'
  const priorityColor = (p: string) => {
    const low = p === 'alta' || p === 'high'
    const mid = p === 'media' || p === 'medium'
    return low ? 'text-red-400 bg-red-500/10 border-red-500/20' : mid ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-green-400 bg-green-500/10 border-green-500/20'
  }
  const catIcon = (c: string) => {
    const map: Record<string, any> = { 'diseño': PaletteIcon, 'design': PaletteIcon, 'seo': Search, 'contenido': FileText, 'content': FileText, 'confianza': Shield, 'trust': Shield, 'conversión': Target, 'conversion': Target }
    return map[c] || Zap
  }

  const a = analysis

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-[#C4622D]/20 via-[#2D4A3E]/20 to-[#FFD700]/10 rounded-3xl blur-xl" />
        <div className="relative bg-gradient-to-br from-[#1A1A1A] to-[#0A0A0A] rounded-3xl p-8 border border-white/5 overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[#C4622D]/10 to-transparent rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-[#2D4A3E]/10 to-transparent rounded-full blur-3xl" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C4622D] to-[#FFD700] flex items-center justify-center">
                <Globe className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">{t('webintel.title')}</h1>
                <p className="text-white/40 text-sm">{t('webintel.subtitle')}</p>
              </div>
            </div>

            {/* URL Input */}
            <div className="mt-6 flex gap-3">
              <div className="flex-1 relative">
                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && analyze()}
                  placeholder={t('webintel.placeholder')}
                  className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-white/30 focus:outline-none focus:border-[#C4622D]/50 focus:ring-1 focus:ring-[#C4622D]/30 transition-all text-lg"
                />
              </div>
              <Button
                onClick={analyze}
                disabled={loading || !url.trim()}
                className="px-8 py-4 bg-gradient-to-r from-[#C4622D] to-[#FFD700] text-white font-bold rounded-2xl hover:opacity-90 transition-all disabled:opacity-40 h-auto text-lg"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Search className="w-5 h-5 mr-2" /> {t('webintel.analyze')}</>}
              </Button>
            </div>

            {error && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 text-red-400 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> {error}
              </motion.p>
            )}
          </div>
        </div>
      </motion.div>

      {/* Loading State */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-gradient-to-br from-[#1A1A1A] to-[#0A0A0A] rounded-3xl p-12 border border-white/5 flex flex-col items-center gap-6"
          >
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-2 border-[#C4622D]/30 border-t-[#C4622D] animate-spin" />
              <Globe className="w-8 h-8 text-[#C4622D] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-lg">{t('webintel.scanning')}</p>
              <p className="text-white/40 text-sm mt-1">{t('webintel.scanning_sub')}</p>
            </div>
            <div className="flex gap-1">
              {[0,1,2,3,4].map(i => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full bg-[#C4622D]"
                  animate={{ opacity: [0.2, 1, 0.2] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      {a && (
        <motion.div ref={resultRef} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          
          {/* Business Overview + Overall Score */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Business Card */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              className="lg:col-span-2 bg-gradient-to-br from-[#1A1A1A] to-[#0D0D0D] rounded-3xl p-6 border border-white/5 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-[#C4622D]/5 to-transparent rounded-full blur-2xl" />
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-white">{a.business.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#C4622D]/10 text-[#C4622D] border border-[#C4622D]/20">
                        {a.business.industry}
                      </span>
                      <a href={url.startsWith('http') ? url : `https://${url}`} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-white/30 hover:text-white/60 flex items-center gap-1 transition-colors">
                        {url} <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
                {a.business.tagline && (
                  <p className="text-white/70 text-sm italic mb-3">&ldquo;{a.business.tagline}&rdquo;</p>
                )}
                <p className="text-white/50 text-sm leading-relaxed">{a.business.description}</p>
              </div>
            </motion.div>

            {/* Overall Score Ring */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gradient-to-br from-[#1A1A1A] to-[#0D0D0D] rounded-3xl p-6 border border-white/5 flex flex-col items-center justify-center"
            >
              <ScoreRing score={a.scores.overall} size={140} label={t('webintel.score_general').toUpperCase()} color={scoreColor(a.scores.overall)} />
              <p className="text-xs text-white/30 mt-3 text-center">
                {a.scores.overall >= 80 ? `🟢 ${t('webintel.score_excellent')}` : a.scores.overall >= 60 ? `🟡 ${t('webintel.score_good')}` : a.scores.overall >= 40 ? `🟠 ${t('webintel.score_needs_work')}` : `🔴 ${t('webintel.score_critical')}`}
              </p>
            </motion.div>
          </div>

          {/* Score Breakdown Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <MiniScore score={a.scores.design} label={t('webintel.score_design')} icon={PaletteIcon} />
            <MiniScore score={a.scores.seo} label="SEO" icon={Search} />
            <MiniScore score={a.scores.mobile} label="Mobile" icon={Smartphone} />
            <MiniScore score={a.scores.performance} label="Speed" icon={Zap} />
            <MiniScore score={a.scores.content} label={t('webintel.score_content')} icon={FileText} />
            <MiniScore score={a.scores.trust} label={t('webintel.score_trust')} icon={Shield} />
            <MiniScore score={a.scores.conversion} label={t('webintel.score_conversion')} icon={Target} />
          </div>

          {/* Color Palette + Typography */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Colors */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-gradient-to-br from-[#1A1A1A] to-[#0D0D0D] rounded-3xl p-6 border border-white/5"
            >
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <PaletteIcon className="w-4 h-4 text-[#C4622D]" /> {t('webintel.palette')}
              </h3>
              <div className="flex justify-between">
                <ColorSwatch color={a.design.colors.primary} label="Primary" />
                <ColorSwatch color={a.design.colors.secondary} label="Secondary" />
                <ColorSwatch color={a.design.colors.accent} label="Accent" />
                <ColorSwatch color={a.design.colors.background} label="Bg" />
                <ColorSwatch color={a.design.colors.text} label="Text" />
              </div>
              <div className="mt-4 pt-4 border-t border-white/5">
                <p className="text-xs text-white/50"><span className="text-white/70 font-medium">{t('webintel.style')}:</span> {a.design.style}</p>
              </div>
            </motion.div>

            {/* Typography + Design Notes */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-gradient-to-br from-[#1A1A1A] to-[#0D0D0D] rounded-3xl p-6 border border-white/5"
            >
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Type className="w-4 h-4 text-[#FFD700]" /> {t('webintel.typography')}
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-white/40 w-16">{t('webintel.headings')}</span>
                  <span className="text-sm text-white font-medium">{a.design.typography.headings}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-white/40 w-16">{t('webintel.body')}</span>
                  <span className="text-sm text-white font-medium">{a.design.typography.body}</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-green-400 uppercase tracking-wider mb-2">✅ {t('webintel.strengths')}</p>
                  {a.design.strengths?.map((s, i) => (
                    <p key={i} className="text-xs text-white/50 mb-1">\u2022 {s}</p>
                  ))}
                </div>
                <div>
                  <p className="text-[10px] text-red-400 uppercase tracking-wider mb-2">⚠️ {t('webintel.weaknesses')}</p>
                  {a.design.weaknesses?.map((w, i) => (
                    <p key={i} className="text-xs text-white/50 mb-1">\u2022 {w}</p>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>

          {/* SEO Analysis */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-gradient-to-br from-[#1A1A1A] to-[#0D0D0D] rounded-3xl p-6 border border-white/5"
          >
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Search className="w-4 h-4 text-[#2D4A3E]" /> {t('webintel.seo_analysis')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider">{t('webintel.meta_title')}</p>
                  <p className="text-sm text-white/80 mt-1">{a.seo.title || t('webintel.not_found')}</p>
                </div>
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider">{t('webintel.meta_desc')}</p>
                  <p className="text-sm text-white/80 mt-1">{a.seo.description || t('webintel.not_found')}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex gap-3 flex-wrap">
                  <span className={`text-xs px-2 py-1 rounded-lg border ${a.seo.hasSchema ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                    {a.seo.hasSchema ? '\u2705' : '\u274c'} Schema
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-lg border ${a.seo.hasOG ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                    {a.seo.hasOG ? '\u2705' : '\u274c'} Open Graph
                  </span>
                  <span className="text-xs px-2 py-1 rounded-lg border bg-white/5 border-white/10 text-white/60">
                    H1: {a.seo.h1Count}
                  </span>
                </div>
                {a.seo.issues?.length > 0 && (
                  <div>
                    <p className="text-[10px] text-red-400 uppercase tracking-wider mb-2">{t('webintel.seo_issues')}</p>
                    {a.seo.issues.map((issue, i) => (
                      <p key={i} className="text-xs text-white/50 mb-1 flex items-start gap-1">
                        <XCircle className="w-3 h-3 text-red-400 mt-0.5 flex-shrink-0" /> {issue}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Trust Signals */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="bg-gradient-to-br from-[#1A1A1A] to-[#0D0D0D] rounded-3xl p-6 border border-white/5"
          >
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#FFD700]" /> {t('webintel.trust')}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: t('webintel.testimonials'), value: a.trustSignals.hasTestimonials },
                { label: t('webintel.client_logos'), value: a.trustSignals.hasLogos },
                { label: t('webintel.certifications'), value: a.trustSignals.hasCertifications },
                { label: t('webintel.contact_info'), value: a.trustSignals.hasContactInfo },
                { label: t('webintel.social_proof'), value: a.trustSignals.hasSocialProof },
              ].map((item, i) => (
                <div key={i} className={`rounded-xl p-3 border text-center ${item.value ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                  {item.value ? <CheckCircle2 className="w-5 h-5 text-green-400 mx-auto mb-1" /> : <XCircle className="w-5 h-5 text-red-400 mx-auto mb-1" />}
                  <p className={`text-[10px] ${item.value ? 'text-green-400' : 'text-red-400'}`}>{item.label}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Sections + Competitors */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {a.sections?.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="bg-gradient-to-br from-[#1A1A1A] to-[#0D0D0D] rounded-3xl p-6 border border-white/5"
              >
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#C4622D]" /> {t('webintel.sections')}
                </h3>
                <div className="space-y-3">
                  {a.sections.map((sec, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-16 text-right">
                        <span className={`text-sm font-bold ${sec.score >= 70 ? 'text-green-400' : sec.score >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{sec.score}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-white font-medium">{sec.name}</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/5 rounded-full mt-1 overflow-hidden">
                          <motion.div
                            className={`h-full rounded-full ${sec.score >= 70 ? 'bg-green-500' : sec.score >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${sec.score}%` }}
                            transition={{ duration: 1, delay: 0.6 + i * 0.1 }}
                          />
                        </div>
                        <p className="text-[10px] text-white/30 mt-0.5">{sec.note}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {a.competitors?.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65 }}
                className="bg-gradient-to-br from-[#1A1A1A] to-[#0D0D0D] rounded-3xl p-6 border border-white/5"
              >
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#2D4A3E]" /> {t('webintel.competitors')}
                </h3>
                <div className="space-y-3">
                  {a.competitors.map((comp, i) => (
                    <div key={i} className="bg-white/[0.02] rounded-xl p-3 border border-white/5 hover:border-[#C4622D]/20 transition-all">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-white font-medium">{comp.name}</span>
                        {comp.url && (
                          <a href={comp.url.startsWith('http') ? comp.url : `https://${comp.url}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-white/30 hover:text-[#C4622D] flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      <p className="text-xs text-white/50">{comp.strength}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {/* Recommendations */}
          {a.recommendations?.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="bg-gradient-to-br from-[#1A1A1A] to-[#0D0D0D] rounded-3xl p-6 border border-white/5"
            >
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#FFD700]" /> {t('webintel.recommendations')}
              </h3>
              <div className="space-y-2">
                {a.recommendations.map((rec, i) => {
                  const CatIcon = catIcon(rec.category)
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.7 + i * 0.1 }}
                      className="bg-white/[0.02] rounded-xl border border-white/5 overflow-hidden cursor-pointer hover:border-white/10 transition-all"
                      onClick={() => setExpandedRec(expandedRec === i ? null : i)}
                    >
                      <div className="flex items-center gap-3 p-4">
                        <CatIcon className="w-4 h-4 text-white/40 flex-shrink-0" />
                        <span className="text-sm text-white font-medium flex-1">{rec.title}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${priorityColor(rec.priority)}`}>
                          {rec.priority}
                        </span>
                        {expandedRec === i ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
                      </div>
                      <AnimatePresence>
                        {expandedRec === i && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <div className="px-4 pb-4 pt-0">
                              <p className="text-xs text-white/50 leading-relaxed">{rec.description}</p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>
          )}

          {/* Verdict + CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="relative overflow-hidden rounded-3xl"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[#C4622D] via-[#2D4A3E] to-[#1A1A1A]" />
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='https://i.ytimg.com/vi/1bYAwpPPD6U/sddefault.jpg id='n'%3E%3CfeTurbulence baseFrequency='0.7'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
            <div className="relative z-10 p-8">
              <h3 className="text-xl font-bold text-white mb-3">\ud83d\udccb {t('webintel.verdict')}</h3>
              <p className="text-white/80 text-sm leading-relaxed mb-6">{a.verdict}</p>
              <div className="flex flex-wrap gap-3">
                <Link href="/dashboard/project-builder">
                  <Button className="bg-white text-[#1A1A1A] font-bold rounded-full px-6 hover:bg-white/90 transition-all">
                    <Rocket className="w-4 h-4 mr-2" /> {t('webintel.build_better')}
                  </Button>
                </Link>
                <Button
                  onClick={() => { setUrl(''); setAnalysis(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                  className="bg-white/10 text-white font-medium rounded-full px-6 hover:bg-white/20 transition-all border border-white/10"
                >
                  <RefreshCw className="w-4 h-4 mr-2" /> {t('webintel.scan_another')}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Empty state */}
      {!loading && !a && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: Eye, title: t('webintel.feat1_title'), desc: t('webintel.feat1_desc'), color: '#C4622D' },
            { icon: BarChart3, title: t('webintel.feat2_title'), desc: t('webintel.feat2_desc'), color: '#2D4A3E' },
            { icon: Rocket, title: t('webintel.feat3_title'), desc: t('webintel.feat3_desc'), color: '#FFD700' },
          ].map((feat, i) => (
            <Card key={i} className="bg-gradient-to-br from-[#1A1A1A] to-[#0D0D0D] border-white/5 p-6 hover:border-white/10 transition-all">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: `${feat.color}15` }}>
                <feat.icon className="w-5 h-5" style={{ color: feat.color }} />
              </div>
              <h4 className="text-sm font-bold text-white mb-1">{feat.title}</h4>
              <p className="text-xs text-white/40">{feat.desc}</p>
            </Card>
          ))}
        </motion.div>
      )}
    </div>
  )
}
