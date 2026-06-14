'use client'

import React, { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Rocket, Target, Users, FileText, MousePointerClick, Flame,
  CheckCircle, LayoutGrid, Download, Megaphone, Building2,
  Save, Copy, Loader2, ChevronDown, Play, Upload,
  Volume2, Mic, Music, Wand2, Film, Sparkles,
} from 'lucide-react'

export interface CampaignCopy {
  framework: string
  headline: string
  body: string
  cta: string
}

export interface CampaignLanding {
  headline?: string
  subheadline?: string
  bullets?: string[]
  ctaText?: string
  socialProof?: string | { quote?: string; name?: string; role?: string }
  // New richer fields from context-aware API
  heroHeadline?: string
  heroSubheadline?: string
  painPoints?: string[]
  benefits?: string[]
  urgencyElement?: string
  primaryCta?: string
}

export interface CampaignVideo {
  variationIndex: number
  label: string
  videoUrl: string | null
  status: 'pending' | 'polling' | 'completed' | 'failed'
  prompt: string
}

export interface CampaignData {
  id?: string
  goal: string
  audience: string
  copies: CampaignCopy[]
  ctas: Array<string | { text: string; subtext?: string; urgency?: string }>
  landing: CampaignLanding
  videos: CampaignVideo[]
  basePrompt: string
}

interface CampaignResultsPanelProps {
  data: CampaignData
  es: boolean
  onDownload: (url: string) => void
  onSendToMarketing: (context: string) => void
  onSendToFoundry: (context: string) => void
  onSaveToProject: () => void
  savingToProject: boolean
  onRegenerateVideos?: () => void
  regeneratingVideos?: boolean
  onManualFrameUpload?: (file: File) => void
  uploadingManualFrame?: boolean
}

const GOAL_LABELS: Record<string, { en: string; es: string; icon: React.ReactNode }> = {
  leads: { en: 'Generate Leads', es: 'Generar Leads', icon: <Target className="w-4 h-4" /> },
  sell: { en: 'Sell a Product', es: 'Vender Producto', icon: <Rocket className="w-4 h-4" /> },
  audience: { en: 'Grow Audience', es: 'Crecer Audiencia', icon: <Users className="w-4 h-4" /> },
  test: { en: 'Test Idea', es: 'Testear Idea', icon: <Flame className="w-4 h-4" /> },
}

const FRAMEWORK_COLORS: Record<string, string> = {
  'AIDA': 'from-violet-500/20 to-violet-600/10 border-violet-500/30',
  'PAS': 'from-fuchsia-500/20 to-fuchsia-600/10 border-fuchsia-500/30',
  'Curiosity Hook': 'from-amber-500/20 to-amber-600/10 border-amber-500/30',
}

export default function CampaignResultsPanel({
  data,
  es,
  onDownload,
  onSendToMarketing,
  onSendToFoundry,
  onSaveToProject,
  savingToProject,
  onRegenerateVideos,
  regeneratingVideos,
  onManualFrameUpload,
  uploadingManualFrame,
}: CampaignResultsPanelProps) {
  const manualFrameInputRef = React.useRef<HTMLInputElement>(null)
  const [activeVariation, setActiveVariation] = useState(0)
  const [expandedCopy, setExpandedCopy] = useState<number | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  // Audio Factory state
  const [voiceScript, setVoiceScript] = useState('')
  const [voiceProfile, setVoiceProfile] = useState<'cinematic_male' | 'professional_female' | 'deep_tech'>('cinematic_male')
  const [musicStyle, setMusicStyle] = useState<'ambient_tech' | 'upbeat_marketing' | 'cinematic_tension' | 'none'>('ambient_tech')
  const [generatingAudio, setGeneratingAudio] = useState(false)
  const [audioResult, setAudioResult] = useState<{ voiceUrl: string; musicUrl: string; script: string } | null>(null)
  const [masteringVideo, setMasteringVideo] = useState(false)
  const [masterUrl, setMasterUrl] = useState<string | null>(null)
  const [audioError, setAudioError] = useState<string | null>(null)
  const masterVideoRef = useRef<HTMLVideoElement>(null)

  const goalInfo = GOAL_LABELS[data.goal] || GOAL_LABELS.leads
  const completedVideos = data.videos.filter(v => v.status === 'completed' && v.videoUrl)
  const pendingVideos = data.videos.filter(v => v.status === 'polling' || v.status === 'pending')

  // Auto-fill script from campaign hook
  const autoHook = data.copies?.[2]?.headline || data.copies?.[0]?.headline || ''

  const handleCopyText = (text: string, index: number) => {
    navigator.clipboard.writeText(text)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  const handleGenerateAudio = useCallback(async () => {
    setGeneratingAudio(true)
    setAudioError(null)
    setAudioResult(null)
    setMasterUrl(null)

    try {
      const res = await fetch('/api/motion-graphics/audio-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: voiceScript || undefined,
          voiceProfile,
          musicStyle,
          videoPrompt: data.basePrompt,
          campaignHook: autoHook,
          generateScript: !voiceScript,
        }),
      })

      const result = await res.json()
      if (result.error && !result.voiceUrl) {
        setAudioError(result.error)
        // Still populate script if generated
        if (result.script && !voiceScript) setVoiceScript(result.script)
      } else {
        setAudioResult({
          voiceUrl: result.voiceUrl,
          musicUrl: result.musicUrl || '',
          script: result.script,
        })
        if (result.script && !voiceScript) setVoiceScript(result.script)
        console.log('[Octopus] 🎙️ Audio Factory — voice generated:', result.voiceUrl?.substring(0, 60))
      }
    } catch (err) {
      console.error('[AudioFactory] Error:', err)
      setAudioError('Failed to generate audio')
    } finally {
      setGeneratingAudio(false)
    }
  }, [voiceScript, voiceProfile, musicStyle, data.basePrompt, autoHook])

  const handleGenerateMaster = useCallback(async () => {
    const selectedVideo = data.videos[activeVariation]
    if (!selectedVideo?.videoUrl || !audioResult?.voiceUrl) return

    setMasteringVideo(true)
    setAudioError(null)
    setMasterUrl(null)

    try {
      console.log('[Octopus] 🎬 Audio Factory — mastering V' + (activeVariation + 1) + '...')
      const res = await fetch('/api/motion-graphics/audio-master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: selectedVideo.videoUrl,
          voiceUrl: audioResult.voiceUrl,
          musicUrl: audioResult.musicUrl || undefined,
        }),
      })

      const result = await res.json()
      if (result.success && result.masterUrl) {
        setMasterUrl(result.masterUrl)
        console.log('[Octopus] ✅ Master video ready:', result.masterUrl)
      } else {
        setAudioError(result.error || 'Mastering failed')
      }
    } catch (err) {
      console.error('[AudioFactory-Master] Error:', err)
      setAudioError('Failed to generate master video')
    } finally {
      setMasteringVideo(false)
    }
  }, [data.videos, activeVariation, audioResult])

  return (
    <div className="space-y-5">
      {/* Campaign Header */}
      <div className="rounded-2xl bg-gradient-to-br from-[#1a1535] to-[#1f1535] border border-violet-500/20 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30">
              <Rocket className="w-5 h-5 text-violet-300" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                🔥 {es ? 'Campaña Automática' : 'Auto Campaign'}
              </h3>
              <p className="text-[10px] text-[#7a8090] mt-0.5">
                {es ? 'Tu campaña completa generada por IA' : 'Your complete AI-generated campaign'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 rounded-full bg-violet-500/20 border border-violet-500/30 text-[10px] text-violet-300 flex items-center gap-1">
              {goalInfo.icon}
              {es ? goalInfo.es : goalInfo.en}
            </span>
          </div>
        </div>
        {data.audience && (
          <div className="flex items-center gap-2 text-xs text-[#8890a0]">
            <Users className="w-3 h-3" />
            <span>{es ? 'Audiencia:' : 'Audience:'} {data.audience}</span>
          </div>
        )}

        {/* Progress indicator */}
        <div className="mt-4 grid grid-cols-5 gap-2">
          {[
            { icon: <Play className="w-3 h-3" />, label: es ? 'Videos' : 'Videos', done: completedVideos.length > 0, count: `${completedVideos.length}/3` },
            { icon: <Volume2 className="w-3 h-3" />, label: 'Audio', done: !!masterUrl, count: masterUrl ? '✓' : (audioResult ? '½' : '...') },
            { icon: <FileText className="w-3 h-3" />, label: es ? 'Copys' : 'Ad Copies', done: data.copies.length > 0, count: `${data.copies.length}` },
            { icon: <MousePointerClick className="w-3 h-3" />, label: 'CTAs', done: data.ctas.length > 0, count: `${data.ctas.length}` },
            { icon: <LayoutGrid className="w-3 h-3" />, label: 'Landing', done: !!(data.landing?.headline || data.landing?.heroHeadline), count: (data.landing?.headline || data.landing?.heroHeadline) ? '✓' : '...' },
          ].map((item, i) => (
            <div key={i} className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-center ${
              item.done
                ? 'bg-green-500/10 border-green-500/20'
                : 'bg-[#151b28] border-[#2a3040]'
            }`}>
              <div className={item.done ? 'text-green-400' : 'text-[#606878]'}>{item.icon}</div>
              <span className={`text-[9px] ${item.done ? 'text-green-300' : 'text-[#606878]'}`}>{item.label}</span>
              <span className={`text-[10px] font-mono ${item.done ? 'text-green-400' : 'text-[#4a5260]'}`}>{item.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Video Variations */}
      <div className="rounded-2xl bg-[#1a1f2e] border border-[#2a3040] p-5">
        <h3 className="text-sm font-semibold text-[#d0d0d0] mb-3 flex items-center gap-2">
          <Play className="w-4 h-4 text-green-400" />
          {es ? '3 Variaciones de Video' : '3 Video Variations'}
        </h3>

        {/* Variation tabs */}
        <div className="flex gap-2 mb-4">
          {data.videos.map((v, i) => (
            <button
              key={i}
              onClick={() => setActiveVariation(i)}
              className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                activeVariation === i
                  ? 'bg-violet-500/15 border-violet-500/40 text-violet-300'
                  : 'bg-[#151b28] border-[#2a3040] text-[#7a8090] hover:bg-[#1e2538]'
              }`}
            >
              {v.status === 'completed' && v.videoUrl ? (
                <CheckCircle className="w-3 h-3 text-green-400" />
              ) : v.status === 'polling' || v.status === 'pending' ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <span className="w-3 h-3 rounded-full bg-red-500/50" />
              )}
              V{i + 1}
            </button>
          ))}
        </div>

        {/* Active variation video */}
        {data.videos[activeVariation] && (
          <div className="rounded-xl overflow-hidden bg-black border border-[#2a3040]">
            {data.videos[activeVariation].status === 'completed' && data.videos[activeVariation].videoUrl ? (
              <>
                <video
                  key={data.videos[activeVariation].videoUrl}
                  src={data.videos[activeVariation].videoUrl!}
                  controls
                  autoPlay
                  loop
                  className="w-full"
                  style={{ maxHeight: '320px' }}
                />
                <div className="p-2 flex items-center justify-between bg-[#151b28]">
                  <span className="text-[10px] text-[#7a8090] font-mono">{data.videos[activeVariation].label}</span>
                  <button
                    onClick={() => onDownload(data.videos[activeVariation].videoUrl!)}
                    className="p-1.5 rounded bg-[#1a2030] hover:bg-[#252d3d] transition-colors"
                  >
                    <Download className="w-3 h-3 text-[#8890a0]" />
                  </button>
                </div>
              </>
            ) : data.videos[activeVariation].status === 'polling' || data.videos[activeVariation].status === 'pending' ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 rounded-full border-2 border-violet-500/20" />
                  <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-violet-500 animate-spin" />
                </div>
                <p className="text-xs text-[#7a8090]">
                  {es ? `Generando V${activeVariation + 1}...` : `Generating V${activeVariation + 1}...`}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <span className="text-[#4a5260] text-2xl">✕</span>
                <p className="text-xs text-[#606878]">{es ? 'Generación fallida' : 'Generation failed'}</p>
              </div>
            )}
          </div>
        )}

        {/* Pending videos indicator */}
        {pendingVideos.length > 0 && (
          <div className="mt-3 flex items-center gap-2 p-2 rounded-lg bg-violet-500/5 border border-violet-500/15">
            <Loader2 className="w-3 h-3 text-violet-400 animate-spin" />
            <p className="text-[10px] text-violet-300/60">
              {es
                ? `${pendingVideos.length} video(s) aún generándose...`
                : `${pendingVideos.length} video(s) still generating...`}
            </p>
          </div>
        )}

        {/* Regenerate Videos button + Manual Upload — show when some/all videos failed and not currently regenerating */}
        {onRegenerateVideos && completedVideos.length < 3 && pendingVideos.length === 0 && (
          <div className="mt-3 space-y-2">
            <button
              onClick={onRegenerateVideos}
              disabled={regeneratingVideos || uploadingManualFrame}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gradient-to-r from-orange-500/15 to-red-500/15 border border-orange-500/30 text-orange-300 hover:from-orange-500/25 hover:to-red-500/25 transition-all text-xs font-medium disabled:opacity-50"
            >
              {regeneratingVideos ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" />{es ? 'Regenerando videos...' : 'Regenerating videos...'}</>
              ) : (
                <><Play className="w-3.5 h-3.5" />🔥 {es ? 'Regenerar Solo Videos' : 'Regenerate Videos Only'}</>
              )}
            </button>
            {onManualFrameUpload && (
              <>
                <input
                  ref={manualFrameInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) onManualFrameUpload(file)
                    e.target.value = ''
                  }}
                />
                <button
                  onClick={() => manualFrameInputRef.current?.click()}
                  disabled={regeneratingVideos || uploadingManualFrame}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-[#1a2235] border border-[#2a3040] text-[#8899aa] hover:text-[#c0c0c0] hover:border-[#3a4050] transition-all text-xs font-medium disabled:opacity-50"
                >
                  {uploadingManualFrame ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" />{es ? 'Subiendo imagen...' : 'Uploading image...'}</>
                  ) : (
                    <><Upload className="w-3.5 h-3.5" />{es ? '📷 Subir imagen manual (Plan B)' : '📷 Upload manual image (Plan B)'}</>
                  )}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* 🔥 AUDIO FACTORY */}
      {completedVideos.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-br from-[#1a1525] to-[#1a1f2e] border border-orange-500/20 p-5">
          <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-orange-500/30 to-red-500/30">
              <Volume2 className="w-4 h-4 text-orange-300" />
            </div>
            🔥 Audio Factory
          </h3>
          <p className="text-[10px] text-[#7a8090] mb-4 ml-9">
            {es ? 'Añade voz profesional y música a tu video' : 'Add professional voice-over & music to your video'}
          </p>

          {/* Voice-over Script */}
          <div className="mb-3">
            <label className="text-xs text-[#8890a0] mb-1.5 flex items-center gap-1.5">
              <Mic className="w-3 h-3 text-orange-400" />
              {es ? 'Guión del Voice-over' : 'Voice-over Script'}
              <span className="text-[9px] text-[#556068]">{es ? '(auto-generado si vacío)' : '(auto-generated if empty)'}</span>
            </label>
            <div className="relative">
              <textarea
                value={voiceScript}
                onChange={e => setVoiceScript(e.target.value)}
                placeholder={autoHook || (es ? 'Ej: Controla tu hogar. Comanda tu negocio. Octopus Omni-Cockpit.' : 'e.g. Control your home, command your business. Octopus Omni-Cockpit.')}
                rows={2}
                className="w-full bg-[#151b28] border border-[#2a3040] rounded-lg px-3 py-2 text-xs text-[#d0d0d0] placeholder-[#4a5260] focus:outline-none focus:border-orange-500/40 resize-none"
              />
              {!voiceScript && autoHook && (
                <button
                  onClick={() => setVoiceScript(autoHook)}
                  className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded bg-orange-500/10 border border-orange-500/20 text-[9px] text-orange-300 hover:bg-orange-500/20 transition-colors"
                >
                  <Wand2 className="w-2.5 h-2.5 inline mr-1" />
                  {es ? 'Usar Hook' : 'Use Hook'}
                </button>
              )}
            </div>
          </div>

          {/* Voice Selection + Music Style */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-[#8890a0] mb-1.5 flex items-center gap-1.5">
                <Mic className="w-3 h-3 text-violet-400" />
                {es ? 'Voz' : 'Voice'}
              </label>
              <div className="space-y-1.5">
                {([
                  { id: 'cinematic_male' as const, label: '🎬 Cinematic Male', desc: 'Deep, dramatic' },
                  { id: 'professional_female' as const, label: '💼 Professional Female', desc: 'Confident, clear' },
                  { id: 'deep_tech' as const, label: '🖥️ Deep Tech', desc: 'Narrator voice' },
                ]).map(v => (
                  <button
                    key={v.id}
                    onClick={() => setVoiceProfile(v.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-[10px] transition-all ${
                      voiceProfile === v.id
                        ? 'bg-violet-500/15 border-violet-500/40 text-violet-300'
                        : 'bg-[#151b28] border-[#2a3040] text-[#7a8090] hover:bg-[#1e2538]'
                    }`}
                  >
                    <span className="font-medium">{v.label}</span>
                    <span className="text-[#556068] ml-1">{v.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-[#8890a0] mb-1.5 flex items-center gap-1.5">
                <Music className="w-3 h-3 text-emerald-400" />
                {es ? 'Música de Fondo' : 'Background Music'}
              </label>
              <div className="space-y-1.5">
                {([
                  { id: 'ambient_tech' as const, label: '🌌 Ambient Tech', desc: 'Atmospheric' },
                  { id: 'upbeat_marketing' as const, label: '🚀 Upbeat Marketing', desc: 'Energetic' },
                  { id: 'cinematic_tension' as const, label: '🎬 Cinematic Tension', desc: 'Dramatic' },
                  { id: 'none' as const, label: '🔇 None', desc: 'Voice only' },
                ]).map(m => (
                  <button
                    key={m.id}
                    onClick={() => setMusicStyle(m.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-[10px] transition-all ${
                      musicStyle === m.id
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-[#151b28] border-[#2a3040] text-[#7a8090] hover:bg-[#1e2538]'
                    }`}
                  >
                    <span className="font-medium">{m.label}</span>
                    <span className="text-[#556068] ml-1">{m.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Audio Error */}
          {audioError && (
            <div className="mb-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300">
              ⚠️ {audioError}
            </div>
          )}

          {/* Audio Result Preview */}
          {audioResult && (
            <div className="mb-3 p-3 rounded-xl bg-[#151b28] border border-green-500/20 space-y-2">
              <div className="flex items-center gap-2 text-xs text-green-300">
                <CheckCircle className="w-3.5 h-3.5" />
                {es ? 'Audio generado' : 'Audio generated'}
              </div>
              <div className="text-[10px] text-[#7a8090]">
                <span className="text-[#556068]">{es ? 'Guión:' : 'Script:'}</span> &ldquo;{audioResult.script}&rdquo;
              </div>
              {/* Voice preview */}
              <audio src={audioResult.voiceUrl} controls className="w-full h-8" style={{ filter: 'hue-rotate(45deg)' }} />
            </div>
          )}

          {/* Generate Audio Button */}
          {!audioResult && (
            <button
              onClick={handleGenerateAudio}
              disabled={generatingAudio}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gradient-to-r from-orange-500/15 to-violet-500/15 border border-orange-500/30 text-orange-300 hover:from-orange-500/25 hover:to-violet-500/25 transition-all text-xs font-medium disabled:opacity-50"
            >
              {generatingAudio ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" />{es ? 'Generando voz con IA...' : 'Generating AI voice-over...'}</>
              ) : (
                <><Mic className="w-3.5 h-3.5" />🎙️ {es ? 'Generar Voice-over' : 'Generate Voice-over'}</>
              )}
            </button>
          )}

          {/* Master Video Button */}
          {audioResult && !masterUrl && (
            <button
              onClick={handleGenerateMaster}
              disabled={masteringVideo || !completedVideos.length}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/40 text-orange-200 hover:from-orange-500/30 hover:to-red-500/30 transition-all text-sm font-bold disabled:opacity-50"
            >
              {masteringVideo ? (
                <><Loader2 className="w-4 h-4 animate-spin" />{es ? 'Masterizando V' + (activeVariation + 1) + '...' : 'Mastering V' + (activeVariation + 1) + '...'}</>
              ) : (
                <><Film className="w-4 h-4" />🎬 {es ? 'Generar Master Final (Video + Audio)' : 'Generate Final Master (Video + Audio)'}</>
              )}
            </button>
          )}

          {/* Master Result */}
          {masterUrl && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 rounded-xl overflow-hidden border border-orange-500/30 bg-[#0d1117]"
            >
              <div className="px-3 py-2 bg-gradient-to-r from-orange-500/10 to-red-500/10 border-b border-orange-500/20 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-xs font-bold text-orange-200">
                  🎬 {es ? 'Master Final — V' + (activeVariation + 1) + ' + Audio' : 'Final Master — V' + (activeVariation + 1) + ' + Audio'}
                </span>
              </div>
              <video
                ref={masterVideoRef}
                key={masterUrl}
                src={masterUrl}
                controls
                autoPlay
                className="w-full"
                style={{ maxHeight: '320px' }}
              />
              <div className="p-2 flex items-center justify-between bg-[#151b28]">
                <span className="text-[10px] text-[#7a8090] font-mono">master_final.mp4</span>
                <button
                  onClick={() => onDownload(masterUrl)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-300 hover:bg-orange-500/25 transition-all text-xs"
                >
                  <Download className="w-3 h-3" />
                  {es ? 'Descargar Master' : 'Download Master'}
                </button>
              </div>
            </motion.div>
          )}

          {/* Re-generate audio */}
          {audioResult && (
            <button
              onClick={() => { setAudioResult(null); setMasterUrl(null); setAudioError(null) }}
              className="mt-2 w-full flex items-center justify-center gap-2 py-1.5 rounded-lg bg-[#1a2030] border border-[#2a3040] text-[10px] text-[#7a8090] hover:text-[#c0c0c0] hover:border-[#3a4050] transition-all"
            >
              <Wand2 className="w-3 h-3" />
              {es ? 'Regenerar audio' : 'Re-generate audio'}
            </button>
          )}
        </div>
      )}

      {/* Ad Copies */}
      <div className="rounded-2xl bg-[#1a1f2e] border border-[#2a3040] p-5">
        <h3 className="text-sm font-semibold text-[#d0d0d0] mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-fuchsia-400" />
          {es ? '3 Ad Copies (AIDA • PAS • Curiosity)' : '3 Ad Copies (AIDA • PAS • Curiosity)'}
        </h3>

        <div className="space-y-3">
          {data.copies.map((copy, i) => {
            const colorClass = FRAMEWORK_COLORS[copy.framework] || FRAMEWORK_COLORS['AIDA']
            const isExpanded = expandedCopy === i
            const fullText = `${copy.headline}\n\n${copy.body}\n\n${copy.cta}`

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`rounded-xl border bg-gradient-to-br p-4 ${colorClass}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#9aa0b0]">
                    {copy.framework}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleCopyText(fullText, i)}
                      className="p-1 rounded hover:bg-[#252d3d] transition-colors"
                      title={es ? 'Copiar' : 'Copy'}
                    >
                      {copiedIndex === i ? (
                        <CheckCircle className="w-3 h-3 text-green-400" />
                      ) : (
                        <Copy className="w-3 h-3 text-[#7a8090]" />
                      )}
                    </button>
                    <button
                      onClick={() => setExpandedCopy(isExpanded ? null : i)}
                      className="p-1 rounded hover:bg-[#252d3d] transition-colors"
                    >
                      <ChevronDown className={`w-3 h-3 text-[#7a8090] transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>

                <h4 className="text-sm font-semibold text-white mb-1">{copy.headline}</h4>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <p className="text-xs text-[#9aa0b0] leading-relaxed mt-2 whitespace-pre-line">{copy.body}</p>
                      <div className="mt-3 pt-3 border-t border-[#2a3040]">
                        <p className="text-xs font-semibold text-violet-300">{copy.cta}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {!isExpanded && (
                  <p className="text-[10px] text-[#606878] mt-1 line-clamp-1">{copy.body}</p>
                )}
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* CTAs */}
      <div className="rounded-2xl bg-[#1a1f2e] border border-[#2a3040] p-5">
        <h3 className="text-sm font-semibold text-[#d0d0d0] mb-3 flex items-center gap-2">
          <MousePointerClick className="w-4 h-4 text-amber-400" />
          {es ? 'CTAs Sugeridos' : 'Suggested CTAs'}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {data.ctas.map((cta, i) => {
            const ctaText = typeof cta === 'string' ? cta : cta.text
            const ctaSub = typeof cta === 'object' ? cta.subtext : undefined
            const ctaUrgency = typeof cta === 'object' ? cta.urgency : undefined
            const urgencyColor = ctaUrgency === 'high' ? 'border-red-500/30 from-red-500/10 to-orange-500/10' : ctaUrgency === 'medium' ? 'border-amber-500/30 from-amber-500/10 to-orange-500/10' : 'border-amber-500/20 from-amber-500/10 to-orange-500/10'
            return (
              <button
                key={i}
                onClick={() => handleCopyText(ctaSub ? `${ctaText} — ${ctaSub}` : ctaText, 100 + i)}
                className={`flex flex-col items-start gap-1 px-3 py-2.5 rounded-lg bg-gradient-to-r ${urgencyColor} hover:border-amber-500/40 transition-all group text-left`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs text-amber-200 font-medium">{ctaText}</span>
                  {copiedIndex === 100 + i ? (
                    <CheckCircle className="w-3 h-3 text-green-400 shrink-0" />
                  ) : (
                    <Copy className="w-3 h-3 text-[#4a5260] group-hover:text-[#7a8090] shrink-0" />
                  )}
                </div>
                {ctaSub && <span className="text-[10px] text-[#606878]">{ctaSub}</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Landing Page Concept */}
      {(data.landing?.headline || data.landing?.heroHeadline) && (() => {
        const L = data.landing
        const headline = L.heroHeadline || L.headline || ''
        const subheadline = L.heroSubheadline || L.subheadline || ''
        const ctaLabel = L.primaryCta || L.ctaText || 'Get Started'
        const painPoints = L.painPoints || []
        const benefits = L.benefits || L.bullets || []
        const socialProof = typeof L.socialProof === 'object' && L.socialProof
          ? L.socialProof
          : typeof L.socialProof === 'string'
            ? { quote: L.socialProof, name: '', role: '' }
            : null
        const urgency = L.urgencyElement || ''

        const fullText = [
          `Headline: ${headline}`,
          `Subheadline: ${subheadline}`,
          painPoints.length > 0 ? `Pain Points:\n${painPoints.map(p => `• ${p}`).join('\n')}` : '',
          benefits.length > 0 ? `Benefits:\n${benefits.map(b => `• ${b}`).join('\n')}` : '',
          `CTA: ${ctaLabel}`,
          socialProof?.quote ? `Testimonial: "${socialProof.quote}" — ${socialProof.name || ''}, ${socialProof.role || ''}` : '',
          urgency ? `Urgency: ${urgency}` : '',
        ].filter(Boolean).join('\n')

        return (
          <div className="rounded-2xl bg-[#1a1f2e] border border-[#2a3040] p-5">
            <h3 className="text-sm font-semibold text-[#d0d0d0] mb-3 flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-cyan-400" />
              {es ? 'Concepto de Landing Page' : 'Landing Page Concept'}
            </h3>

            <div className="rounded-xl bg-gradient-to-br from-[#1e2538] to-[#131822] border border-[#2a3040] p-5">
              {/* Hero */}
              <div className="text-center mb-5">
                <h2 className="text-lg font-bold text-white mb-1">{headline}</h2>
                <p className="text-xs text-[#8890a0]">{subheadline}</p>
              </div>

              {/* Pain Points */}
              {painPoints.length > 0 && (
                <div className="mb-4">
                  <p className="text-[10px] uppercase tracking-wider text-red-400/60 mb-2 font-semibold">
                    {es ? '😰 Puntos de dolor' : '😰 Pain Points'}
                  </p>
                  <div className="space-y-1.5">
                    {painPoints.map((p, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-red-400/60 text-xs mt-0.5">✕</span>
                        <span className="text-xs text-[#8890a0]">{p}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Benefits */}
              {benefits.length > 0 && (
                <div className="mb-4">
                  <p className="text-[10px] uppercase tracking-wider text-green-400/60 mb-2 font-semibold">
                    {es ? '✨ Beneficios' : '✨ Benefits'}
                  </p>
                  <div className="space-y-1.5">
                    {benefits.map((b, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <CheckCircle className="w-3 h-3 text-green-400 mt-0.5 shrink-0" />
                        <span className="text-xs text-[#9aa0b0]">{b}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CTA */}
              <div className="text-center mb-4">
                <div className="inline-block px-6 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-sm font-semibold">
                  {ctaLabel}
                </div>
              </div>

              {/* Urgency */}
              {urgency && (
                <p className="text-[10px] text-amber-400/60 text-center mb-3">⏰ {urgency}</p>
              )}

              {/* Social Proof */}
              {socialProof?.quote && (
                <div className="border-t border-[#222838] pt-3 mt-3">
                  <p className="text-xs text-[#7a8090] italic text-center">&ldquo;{socialProof.quote}&rdquo;</p>
                  {(socialProof.name || socialProof.role) && (
                    <p className="text-[10px] text-[#556068] text-center mt-1">
                      — {socialProof.name}{socialProof.role ? `, ${socialProof.role}` : ''}
                    </p>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => handleCopyText(fullText, 200)}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-[#1a2030] border border-[#2a3040] hover:bg-[#252d3d] transition-all text-xs text-[#8890a0]"
            >
              {copiedIndex === 200 ? <CheckCircle className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
              {copiedIndex === 200 ? (es ? '¡Copiado!' : 'Copied!') : (es ? 'Copiar concepto' : 'Copy concept')}
            </button>
          </div>
        )
      })()}

      {/* One-Click Actions */}
      <div className="rounded-2xl bg-[#1a1f2e] border border-[#2a3040] p-5">
        <h3 className="text-sm font-semibold text-[#d0d0d0] mb-3 flex items-center gap-2">
          <Rocket className="w-4 h-4 text-violet-400" />
          {es ? 'Acciones Rápidas' : 'Quick Actions'}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            onClick={() => onSendToMarketing(data.basePrompt)}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-300 hover:bg-orange-500/20 transition-all text-xs"
          >
            <Megaphone className="w-3.5 h-3.5" />
            {es ? 'Enviar a Marketing' : 'Send to Marketing'}
          </button>
          <button
            onClick={() => onSendToFoundry(data.basePrompt)}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 hover:bg-blue-500/20 transition-all text-xs"
          >
            <Building2 className="w-3.5 h-3.5" />
            {es ? 'Enviar a Foundry' : 'Send to Foundry'}
          </button>
          <button
            onClick={onSaveToProject}
            disabled={savingToProject}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20 transition-all text-xs disabled:opacity-50"
          >
            {savingToProject ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {es ? 'Guardar Campaña' : 'Save Campaign'}
          </button>
          {completedVideos.length > 0 && (
            <button
              onClick={() => completedVideos.forEach(v => v.videoUrl && onDownload(v.videoUrl))}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-300 hover:bg-green-500/20 transition-all text-xs"
            >
              <Download className="w-3.5 h-3.5" />
              {es ? `Descargar ${completedVideos.length} Videos` : `Download ${completedVideos.length} Videos`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
