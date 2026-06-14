'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ImageIcon,
  Film,
  Type,
  Sparkles,
  Loader2,
  Download,
  Trash2,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Filter,
  BarChart3,
  Palette,
  Wand2,
  Instagram,
  Facebook,
  Twitter,
  Mail,
  Globe,
  Layers,
  RefreshCw,
  Zap,
  Link2,
  AlertTriangle,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Play,
  FolderOpen,
  Share2,
  Send,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n-context'
import { usePlanGate } from '@/hooks/use-plan-gate'
import { UpgradeModal } from '@/components/upgrade-modal'

// ============================================
// ESTUDIO CREATIVO — Los Creativos de OCTOPUS 🐙
// ============================================

type CreativeType = 'image' | 'video' | 'copy'
type TabType = 'crear' | 'galeria'
type PlatformType = 'instagram' | 'facebook' | 'twitter' | 'email' | 'general'
type FormatType = 'post' | 'story' | 'reel' | 'banner' | 'thumbnail' | 'email-header'

interface CreativeAsset {
  id: string
  type: CreativeType | string
  title: string
  content: string
  thumbnail?: string
  platform?: string
  format?: string
  status?: string
  tags?: string
  prompt?: string
  createdAt: string
  frames?: string[]
  isRealVideo?: boolean
  projectId?: string | null
  project?: { id: string; name: string } | null
}

interface ProjectFolder {
  projectId: string | null
  projectName: string | null
  count: number
}

interface GalleryStats {
  images: number
  videos: number
  copies: number
  total: number
}

interface ApiCapability {
  type: string
  label: string
  available: boolean
  engine: string
  engineLabel: string
  externalApis: Array<{
    serviceType: string
    name: string
    status: string
    icon: string
  }>
}

interface CapabilitiesSummary {
  totalActive: number
  totalCapabilities: number
  builtInActive: boolean
  externalActive: number
  externalTotal: number
}

const PLATFORMS: { id: PlatformType; label: string; icon: typeof Instagram }[] = [
  { id: 'instagram', label: 'Instagram', icon: Instagram },
  { id: 'facebook', label: 'Facebook', icon: Facebook },
  { id: 'twitter', label: 'Twitter/X', icon: Twitter },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'general', label: 'General', icon: Globe },
]

const FORMATS: Record<PlatformType, { id: FormatType; label: string }[]> = {
  instagram: [
    { id: 'post', label: 'Post (1:1)' },
    { id: 'story', label: 'Story (9:16)' },
    { id: 'reel', label: 'Reel (9:16)' },
  ],
  facebook: [
    { id: 'post', label: 'Post (1.91:1)' },
    { id: 'reel', label: 'Reel (9:16)' },
    { id: 'banner', label: 'Cover' },
  ],
  twitter: [
    { id: 'post', label: 'Post (16:9)' },
    { id: 'reel', label: 'Reel (9:16)' },
  ],
  email: [
    { id: 'email-header', label: 'Header' },
  ],
  general: [
    { id: 'post', label: 'creative.square' },
    { id: 'reel', label: 'creative.reel' },
    { id: 'banner', label: 'creative.banner' },
    { id: 'thumbnail', label: 'creative.thumbnail' },
  ],
}

const STYLE_OPTIONS = [
  'Profesional y corporativo',
  'Vibrante y colorido',
  'Minimalista y limpio',
  'Retro / Vintage',
  'Futurista / Tech',
  'Artístico / Ilustración',
  'Fotorrealista',
  'Neon / Cyberpunk',
]

const AGENT_LABELS: Record<string, { emoji: string; nameKey: string; color: string }> = {
  image: { emoji: '🎨', nameKey: 'creative.agent_image', color: '#C4622D' },
  video: { emoji: '🎬', nameKey: 'creative.agent_video', color: '#4A90D9' },
  copy: { emoji: '✍️', nameKey: 'creative.agent_copy', color: '#2D4A3E' },
  uploaded_image: { emoji: '📤', nameKey: 'creative.agent_uploaded', color: '#8B7355' },
}

const AGENT_FALLBACK = { emoji: '📁', nameKey: 'creative.agent_file', color: '#888888' }

export default function EstudioCreativoPage() {
  const [activeTab, setActiveTab] = useState<TabType>('crear')
  const { t } = useI18n()
  const { upgradeModal, closeUpgradeModal, handlePlanError } = usePlanGate()
  const [selectedType, setSelectedType] = useState<CreativeType | null>(null)
  const [prompt, setPrompt] = useState('')
  const [platform, setPlatform] = useState<PlatformType>('general')
  const [format, setFormat] = useState<FormatType>('post')
  const [style, setStyle] = useState('')
  const [videoMode, setVideoMode] = useState<'slideshow' | 'ai'>('slideshow')
  const [videoModel, setVideoModel] = useState<string>('kling-2.6-pro')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationResult, setGenerationResult] = useState<CreativeAsset | null>(null)
  const [error, setError] = useState('')

  // API Capabilities state
  const [capabilities, setCapabilities] = useState<ApiCapability[]>([])
  const [capSummary, setCapSummary] = useState<CapabilitiesSummary | null>(null)
  const [capLoading, setCapLoading] = useState(true)

  // Galería state
  const [assets, setAssets] = useState<CreativeAsset[]>([])
  const [stats, setStats] = useState<GalleryStats>({ images: 0, videos: 0, copies: 0, total: 0 })
  const [filterType, setFilterType] = useState<CreativeType | 'all'>('all')
  const [projectFilter, setProjectFilter] = useState<string | null>(null) // null=todos, 'none'=sin proyecto, o projectId
  const [projectFolders, setProjectFolders] = useState<ProjectFolder[]>([])
  const [isLoadingGallery, setIsLoadingGallery] = useState(false)
  const [previewAsset, setPreviewAsset] = useState<CreativeAsset | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [videoFrameIndex, setVideoFrameIndex] = useState(0)
  const [lightboxImage, setLightboxImage] = useState<{ src: string; title: string } | null>(null)

  // Cargar capacidades desde API Hub
  useEffect(() => {
    const loadCapabilities = async () => {
      try {
        const res = await fetch('/api/creative/capabilities')
        if (res.ok) {
          const data = await res.json()
          setCapabilities(data.capabilities || [])
          setCapSummary(data.summary || null)
        }
      } catch (e) {
        console.error('Error loading capabilities:', e)
      } finally {
        setCapLoading(false)
      }
    }
    loadCapabilities()
  }, [])

  // Helper: obtener capacidad por tipo
  const getCapability = useCallback((type: CreativeType): ApiCapability | undefined => {
    return capabilities.find(c => c.type === type)
  }, [capabilities])

  const loadGallery = useCallback(async () => {
    setIsLoadingGallery(true)
    try {
      const params = new URLSearchParams()
      if (filterType !== 'all') params.set('type', filterType)
      if (projectFilter) params.set('projectId', projectFilter)
      params.set('limit', '50')
      const res = await fetch(`/api/creative/gallery?${params}`)
      if (res.ok) {
        const data = await res.json()
        setAssets(data.assets || [])
        setStats(data.stats || { images: 0, videos: 0, copies: 0, total: 0 })
        if (data.projectFolders) setProjectFolders(data.projectFolders)
      }
    } catch (e) {
      console.error('Error loading gallery:', e)
    } finally {
      setIsLoadingGallery(false)
    }
  }, [filterType, projectFilter])

  useEffect(() => {
    loadGallery()
  }, [loadGallery])

  const handleGenerate = async () => {
    if (!selectedType || !prompt.trim()) return
    setIsGenerating(true)
    setError('')
    setGenerationResult(null)

    try {
      const res = await fetch('/api/creative/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedType,
          prompt: prompt.trim(),
          platform,
          format,
          style: style || undefined,
          videoMode: selectedType === 'video' ? videoMode : undefined,
          videoModel: selectedType === 'video' && videoMode === 'ai' ? videoModel : undefined,
        }),
      })

      if (!res.ok) {
        if (await handlePlanError(res, 'creative')) return
        const data = await res.json().catch(() => ({ error: 'Error' }))
        setError(data.error || t('creative.gen_error'))
        return
      }

      const data = await res.json()
      setGenerationResult(data.asset)
      loadGallery() // Refrescar galería
    } catch (e) {
      console.error('Generation error:', e)
      setError(t('creative.conn_error'))
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/creative/gallery?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setAssets(prev => prev.filter(a => a.id !== id))
        setStats(prev => ({ ...prev, total: prev.total - 1 }))
        if (previewAsset?.id === id) setPreviewAsset(null)
      }
    } catch (e) {
      console.error('Delete error:', e)
    }
  }

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const resetForm = () => {
    setSelectedType(null)
    setPrompt('')
    setPlatform('general')
    setFormat('post')
    setStyle('')
    setGenerationResult(null)
    setError('')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F0E8] via-[#F2F0E9] to-[#EDE8E0] p-6">
      {/* Header */}
      <div className="mb-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-2"
        >
          <div className="w-12 h-12 bg-gradient-to-br from-[#C4622D] to-[#2D4A3E] rounded-2xl flex items-center justify-center">
            <Palette className="w-6 h-6 text-[#F5F0E8]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A1A]">{t('creative.title')}</h1>
            <p className="text-sm text-[#1A1A1A]/60">{t('creative.subtitle')}</p>
          </div>
        </motion.div>

        {/* Stats Bar + API Status */}
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-wrap items-center gap-3 mt-4"
        >
          <div className="flex items-center gap-2 bg-white/60 backdrop-blur-sm px-4 py-2 rounded-xl">
            <BarChart3 className="w-4 h-4 text-[#C4622D]" />
            <span className="text-sm font-medium text-[#1A1A1A]">
              {stats.total} {t('creative.creations')}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-[#1A1A1A]/60">
            <span className="flex items-center gap-1"><ImageIcon className="w-3.5 h-3.5" />{stats.images} {t('creative.imgs')}</span>
            <span className="flex items-center gap-1"><Film className="w-3.5 h-3.5" />{stats.videos} {t('creative.videos')}</span>
            <span className="flex items-center gap-1"><Type className="w-3.5 h-3.5" />{stats.copies} {t('creative.copies')}</span>
          </div>

          {/* API Status indicator */}
          {!capLoading && capSummary && (
            <Link href="/dashboard/api-hub" className="ml-auto">
              <div className="flex items-center gap-2 bg-white/60 backdrop-blur-sm px-3 py-2 rounded-xl hover:bg-white/80 transition-all cursor-pointer group">
                <Zap className={`w-3.5 h-3.5 ${capSummary.builtInActive ? 'text-emerald-500' : 'text-amber-500'}`} />
                <span className="text-xs font-medium text-[#1A1A1A]/70 group-hover:text-[#1A1A1A]">
                  {capSummary.totalActive}/{capSummary.totalCapabilities} {t('creative.engines_active')}
                </span>
                {capSummary.externalActive > 0 && (
                  <span className="text-xs text-[#4A90D9] font-medium">
                    +{capSummary.externalActive} APIs
                  </span>
                )}
                <Link2 className="w-3 h-3 text-[#1A1A1A]/30 group-hover:text-[#C4622D] transition-all" />
              </div>
            </Link>
          )}
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 mt-5">
          {[
            { id: 'crear' as TabType, label: t('creative.tab_create'), icon: Wand2 },
            { id: 'galeria' as TabType, label: t('creative.tab_gallery'), icon: Layers },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-300 ${
                activeTab === tab.id
                  ? 'bg-[#2D4A3E] text-[#F5F0E8] shadow-lg shadow-[#2D4A3E]/20'
                  : 'bg-white/50 text-[#1A1A1A]/60 hover:bg-white/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'crear' ? (
          <motion.div
            key="crear"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <CrearTab
              selectedType={selectedType}
              setSelectedType={setSelectedType}
              prompt={prompt}
              setPrompt={setPrompt}
              platform={platform}
              setPlatform={setPlatform}
              format={format}
              setFormat={setFormat}
              style={style}
              setStyle={setStyle}
              videoMode={videoMode}
              setVideoMode={setVideoMode}
              videoModel={videoModel}
              setVideoModel={setVideoModel}
              isGenerating={isGenerating}
              generationResult={generationResult}
              error={error}
              onGenerate={handleGenerate}
              onReset={resetForm}
              onCopyText={handleCopyText}
              copiedId={copiedId}
              getCapability={getCapability}
              onOpenLightbox={(src, title) => setLightboxImage({ src, title })}
            />
          </motion.div>
        ) : (
          <motion.div
            key="galeria"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <GaleriaTab
              assets={assets}
              isLoading={isLoadingGallery}
              filterType={filterType}
              setFilterType={setFilterType}
              projectFilter={projectFilter}
              setProjectFilter={setProjectFilter}
              projectFolders={projectFolders}
              onPreview={setPreviewAsset}
              onDelete={handleDelete}
              onCopyText={handleCopyText}
              copiedId={copiedId}
              onRefresh={loadGallery}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewAsset && (
          <PreviewModal
            asset={previewAsset}
            onClose={() => { setPreviewAsset(null); setVideoFrameIndex(0) }}
            onDelete={handleDelete}
            onCopyText={handleCopyText}
            copiedId={copiedId}
            videoFrameIndex={videoFrameIndex}
            setVideoFrameIndex={setVideoFrameIndex}
            onOpenLightbox={(src, title) => setLightboxImage({ src, title })}
          />
        )}
      </AnimatePresence>

      {/* Lightbox — Vista completa de la imagen */}
      <AnimatePresence>
        {lightboxImage && (
          <ImageLightbox
            src={lightboxImage.src}
            title={lightboxImage.title}
            onClose={() => setLightboxImage(null)}
          />
        )}
      </AnimatePresence>

      {/* Plan Upgrade Modal */}
      <UpgradeModal
        isOpen={upgradeModal.isOpen}
        onClose={closeUpgradeModal}
        feature={upgradeModal.feature}
        current={upgradeModal.current}
        limit={upgradeModal.limit}
        requiredPlan={upgradeModal.requiredPlan}
      />
    </div>
  )
}

// ============================================
// TAB: CREAR
// ============================================
function CrearTab({
  selectedType, setSelectedType,
  prompt, setPrompt,
  platform, setPlatform,
  format, setFormat,
  style, setStyle,
  videoMode, setVideoMode,
  videoModel, setVideoModel,
  isGenerating, generationResult, error,
  onGenerate, onReset, onCopyText, copiedId,
  getCapability, onOpenLightbox,
}: {
  selectedType: CreativeType | null
  setSelectedType: (t: CreativeType | null) => void
  prompt: string
  setPrompt: (s: string) => void
  platform: PlatformType
  setPlatform: (p: PlatformType) => void
  format: FormatType
  setFormat: (f: FormatType) => void
  style: string
  setStyle: (s: string) => void
  videoMode: 'slideshow' | 'ai'
  setVideoMode: (m: 'slideshow' | 'ai') => void
  videoModel: string
  setVideoModel: (m: string) => void
  isGenerating: boolean
  generationResult: CreativeAsset | null
  error: string
  onGenerate: () => void
  onReset: () => void
  onCopyText: (text: string, id: string) => void
  copiedId: string | null
  getCapability: (type: CreativeType) => ApiCapability | undefined
  onOpenLightbox: (src: string, title: string) => void
}) {
  const { t } = useI18n()
  // Si no hay tipo seleccionado, mostrar selector de agentes
  if (!selectedType) {
    return (
      <div className="space-y-6">
        <p className="text-[#1A1A1A]/70 text-sm">{t('creative.choose_agent')}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(Object.entries(AGENT_LABELS).filter(([type]) => ['image', 'video', 'copy'].includes(type)) as [CreativeType, typeof AGENT_LABELS['image']][]).map(
            ([type, agent]) => {
              const cap = getCapability(type)
              const isAvailable = !cap || cap.available // si no cargó aún, asumir disponible

              return (
                <motion.div
                  key={type}
                  whileHover={{ scale: isAvailable ? 1.02 : 1, y: isAvailable ? -2 : 0 }}
                  whileTap={{ scale: isAvailable ? 0.98 : 1 }}
                >
                  <Card
                    className={`p-6 cursor-pointer border-2 border-transparent bg-white/70 backdrop-blur-sm transition-all duration-300 ${
                      isAvailable ? 'hover:border-[#C4622D]/30' : 'opacity-60'
                    }`}
                    onClick={() => isAvailable && setSelectedType(type)}
                  >
                    <div className="text-4xl mb-3">{agent.emoji}</div>
                    <h3 className="text-lg font-bold text-[#1A1A1A] mb-1">{t(agent.nameKey)}</h3>
                    <p className="text-sm text-[#1A1A1A]/60">
                      {type === 'image' && t('creative.desc_image')}
                      {type === 'video' && t('creative.desc_video')}
                      {type === 'copy' && t('creative.desc_copy')}
                    </p>

                    {/* Motor activo / API status */}
                    {cap && (
                      <div className="mt-3 flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${cap.available ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        <span className="text-xs text-[#1A1A1A]/50">
                          {cap.engineLabel}
                        </span>
                        {cap.externalApis.length > 0 && (
                          <span className="text-xs text-[#4A90D9]/70 ml-1">
                            +{cap.externalApis.length} API{cap.externalApis.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    )}

                    {isAvailable ? (
                      <div
                        className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                        style={{ backgroundColor: agent.color }}
                      >
                        <Sparkles className="w-3 h-3" />
                        {type === 'image' ? t('creative.create_image') : type === 'video' ? t('creative.create_video') : t('creative.create_copy')}
                      </div>
                    ) : (
                      <Link href="/dashboard/api-hub">
                        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-100 text-amber-700">
                          <AlertTriangle className="w-3 h-3" />
                          {t('creative.configure_api')}
                        </div>
                      </Link>
                    )}
                  </Card>
                </motion.div>
              )
            }
          )}
        </div>

        {/* Inspiración rápida */}
        <div className="mt-8">
          <p className="text-xs text-[#1A1A1A]/40 mb-3 uppercase tracking-wider font-semibold">{t('creative.quick_ideas')}</p>
          <div className="flex flex-wrap gap-2">
            {[
              t('creative.idea_1'),
              t('creative.idea_2'),
              t('creative.idea_3'),
              t('creative.idea_4'),
            ].map((idea, i) => (
              <button
                key={i}
                onClick={() => {
                  const typeMap: CreativeType[] = ['image', 'image', 'copy', 'video']
                  setSelectedType(typeMap[i])
                  setPrompt(idea.replace(/^[^\s]+\s/, ''))
                }}
                className="px-3 py-2 bg-white/50 hover:bg-white/80 rounded-xl text-sm text-[#1A1A1A]/70 hover:text-[#1A1A1A] transition-all"
              >
                {idea}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const currentAgent = (selectedType && AGENT_LABELS[selectedType]) || AGENT_FALLBACK
  const currentCap = getCapability(selectedType)

  return (
    <div className="space-y-6">
      {/* Agent header con botón volver */}
      <div className="flex items-center gap-3">
        <button
          onClick={onReset}
          className="p-2 rounded-xl bg-white/50 hover:bg-white/80 transition-all text-[#1A1A1A]/60 hover:text-[#1A1A1A]"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-3xl">{currentAgent.emoji}</div>
        <div>
          <h2 className="text-lg font-bold text-[#1A1A1A]">{t(currentAgent.nameKey)}</h2>
          <div className="flex items-center gap-2">
            <p className="text-xs text-[#1A1A1A]/50">{t('creative.tentacle_active')}</p>
            {currentCap && (
              <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                <Zap className="w-3 h-3" />
                {currentCap.engineLabel}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Form */}
      <Card className="p-6 bg-white/70 backdrop-blur-sm border-0">
        {/* Prompt */}
        <div className="mb-5">
          <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">
            {t('creative.what_create')}
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t('creative.placeholder')}
            rows={3}
            className="w-full px-4 py-3 bg-[#F5F0E8]/50 border border-[#1A1A1A]/10 rounded-xl text-[#1A1A1A] placeholder:text-[#1A1A1A]/30 focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30 focus:border-[#C4622D]/50 resize-none transition-all"
          />
        </div>

        {/* Plataforma */}
        <div className="mb-5">
          <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">{t('creative.platform')}</label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map(p => {
              const Icon = p.icon
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setPlatform(p.id)
                    const firstFormat = FORMATS[p.id]?.[0]
                    if (firstFormat) setFormat(firstFormat.id)
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                    platform === p.id
                      ? 'bg-[#2D4A3E] text-[#F5F0E8]'
                      : 'bg-[#F5F0E8]/60 text-[#1A1A1A]/60 hover:bg-[#F5F0E8]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {p.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Formato (solo para image/video) */}
        {selectedType !== 'copy' && (
          <div className="mb-5">
            <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">{t('creative.format')}</label>
            <div className="flex flex-wrap gap-2">
              {(FORMATS[platform] || []).map(f => (
                <button
                  key={f.id}
                  onClick={() => setFormat(f.id)}
                  className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                    format === f.id
                      ? 'bg-[#C4622D] text-white'
                      : 'bg-[#F5F0E8]/60 text-[#1A1A1A]/60 hover:bg-[#F5F0E8]'
                  }`}
                >
                  {f.label.startsWith('creative.') ? t(f.label) : f.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Modo de video (solo para video) */}
        {selectedType === 'video' && (
          <div className="mb-5">
            <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">{t('creative.gen_mode')}</label>
            <div className="grid grid-cols-2 gap-3">
              {/* Slideshow — gratis */}
              <button
                onClick={() => setVideoMode('slideshow')}
                className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                  videoMode === 'slideshow'
                    ? 'border-[#2D4A3E] bg-[#2D4A3E]/5'
                    : 'border-[#1A1A1A]/10 bg-white/50 hover:border-[#1A1A1A]/20'
                }`}
              >
                <div className="text-2xl mb-1">📽️</div>
                <div className="font-semibold text-sm text-[#1A1A1A]">{t('creative.slideshow')}</div>
                <div className="text-xs text-[#1A1A1A]/50 mt-0.5">{t('creative.slideshow_desc')}</div>
                <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                  {t('creative.free')}
                </span>
              </button>
              {/* Video IA — Kling 2.6 Pro */}
              <button
                onClick={() => setVideoMode('ai')}
                className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                  videoMode === 'ai'
                    ? 'border-[#C4622D] bg-[#C4622D]/5'
                    : 'border-[#1A1A1A]/10 bg-white/50 hover:border-[#1A1A1A]/20'
                }`}
              >
                <div className="text-2xl mb-1">🎬</div>
                <div className="font-semibold text-sm text-[#1A1A1A]">{t('creative.video_ai')}</div>
                <div className="text-xs text-[#1A1A1A]/50 mt-0.5">Kling 2.6 Pro — {t('creative.video_ai_desc')}</div>
                <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                  {t('creative.premium')}
                </span>
              </button>
            </div>
            {videoMode === 'ai' && (
              <div className="mt-3 space-y-2">
                <label className="block text-xs font-semibold text-[#1A1A1A]/70 mb-1">{t('creative.video_model')}</label>
                <div className="max-h-[320px] overflow-y-auto space-y-2 pr-1">
                {[
                  { id: 'wan-2.7', name: 'Wan 2.7', desc: t('creative.model_desc_wan'), price: '~$0.05/s', badge: t('creative.badge_budget'), badgeColor: 'bg-emerald-100 text-emerald-700' },
                  { id: 'hailuo-2.3', name: 'Hailuo 2.3', desc: t('creative.model_desc_hailuo'), price: '~$0.35', badge: t('creative.badge_fast'), badgeColor: 'bg-sky-100 text-sky-700' },
                  { id: 'kling-2.6-pro', name: 'Kling 2.6 Pro', desc: t('creative.model_desc_26'), price: '~$0.35/5s', badge: t('creative.economic'), badgeColor: 'bg-emerald-100 text-emerald-700' },
                  { id: 'kling-v3-pro', name: 'Kling V3 Pro', desc: t('creative.model_desc_v3'), price: '~$0.56/5s', badge: t('creative.popular'), badgeColor: 'bg-blue-100 text-blue-700' },
                  { id: 'seedance-2', name: 'Seedance 2', desc: t('creative.model_desc_seedance'), price: '~$0.26', badge: t('creative.badge_cinema'), badgeColor: 'bg-amber-100 text-amber-700' },
                  { id: 'veo-3.1-fast', name: 'Veo 3.1 Fast', desc: t('creative.model_desc_veo_fast'), price: '~$0.50/5s', badge: t('creative.badge_fast'), badgeColor: 'bg-sky-100 text-sky-700' },
                  { id: 'veo-3.1', name: 'Veo 3.1', desc: t('creative.model_desc_veo'), price: '~$2.00/5s', badge: t('creative.badge_4k'), badgeColor: 'bg-violet-100 text-violet-700' },
                  { id: 'kling-o3-pro', name: 'Kling O3 Pro', desc: t('creative.model_desc_o3'), price: '~$1.00/5s', badge: t('creative.pro'), badgeColor: 'bg-purple-100 text-purple-700' },
                ].map(model => (
                  <button
                    key={model.id}
                    onClick={() => setVideoModel(model.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border-2 text-left transition-all ${
                      videoModel === model.id
                        ? 'border-[#C4622D] bg-[#C4622D]/5'
                        : 'border-[#1A1A1A]/10 bg-white/50 hover:border-[#1A1A1A]/20'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-[#1A1A1A]">{model.name}</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${model.badgeColor}`}>{model.badge}</span>
                      </div>
                      <p className="text-[11px] text-[#1A1A1A]/50 mt-0.5">{model.desc}</p>
                    </div>
                    <span className="text-xs font-mono text-[#C4622D] font-semibold ml-2 whitespace-nowrap">{model.price}</span>
                  </button>
                ))}
                </div>
                <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-[11px] text-amber-800">
                    🔑 {t('creative.api_key_info')} <a href="/dashboard/api-hub" className="font-bold underline hover:text-amber-900">API Hub</a>
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Estilo (solo para image) */}
        {selectedType === 'image' && (
          <div className="mb-5">
            <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">{t('creative.style')}</label>
            <div className="flex flex-wrap gap-2">
              {STYLE_OPTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => setStyle(style === s ? '' : s)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    style === s
                      ? 'bg-[#4A90D9] text-white'
                      : 'bg-[#F5F0E8]/60 text-[#1A1A1A]/60 hover:bg-[#F5F0E8]'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Botón generar */}
        <Button
          onClick={onGenerate}
          disabled={isGenerating || !prompt.trim()}
          className="w-full py-3 rounded-xl font-semibold text-white transition-all"
          style={{ backgroundColor: isGenerating ? '#999' : (selectedType === 'video' && videoMode === 'ai' ? '#C4622D' : currentAgent.color) }}
        >
          {isGenerating ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              {selectedType === 'video' && videoMode === 'ai'
                ? t('creative.generating_video')
                : `${currentAgent.emoji} ${t(currentAgent.nameKey)} ${t('creative.working')}`}
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              {selectedType === 'video' && videoMode === 'ai'
                ? t('creative.generate_video')
                : t('creative.generate')}
            </span>
          )}
        </Button>
      </Card>

      {/* Resultado de generación */}
      <AnimatePresence>
        {generationResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="p-6 bg-white/80 backdrop-blur-sm border-2 border-[#C4622D]/20">
              <div className="flex items-center gap-2 mb-4">
                <Check className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-[#1A1A1A]">{t('creative.content_generated')}</span>
              </div>
              <ResultPreview
                asset={generationResult}
                onCopyText={onCopyText}
                copiedId={copiedId}
                onOpenLightbox={onOpenLightbox}
              />
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ============================================
// TAB: GALERÍA
// ============================================
function GaleriaTab({
  assets, isLoading, filterType, setFilterType,
  projectFilter, setProjectFilter, projectFolders,
  onPreview, onDelete, onCopyText, copiedId, onRefresh,
}: {
  assets: CreativeAsset[]
  isLoading: boolean
  filterType: CreativeType | 'all'
  setFilterType: (f: CreativeType | 'all') => void
  projectFilter: string | null
  setProjectFilter: (p: string | null) => void
  projectFolders: ProjectFolder[]
  onPreview: (a: CreativeAsset) => void
  onDelete: (id: string) => void
  onCopyText: (text: string, id: string) => void
  copiedId: string | null
  onRefresh: () => void
}) {
  const { t } = useI18n()
  const filterOptions: { id: CreativeType | 'all'; label: string; icon: typeof ImageIcon }[] = [
    { id: 'all', label: t('creative.filter_all'), icon: Layers },
    { id: 'image', label: t('creative.filter_images'), icon: ImageIcon },
    { id: 'video', label: t('creative.filter_videos'), icon: Film },
    { id: 'copy', label: t('creative.filter_copies'), icon: Type },
  ]

  // Solo mostrar carpetas si hay al menos un proyecto con assets
  const hasProjectFolders = projectFolders.some(f => f.projectId !== null)

  return (
    <div className="space-y-5">
      {/* Carpetas de proyecto */}
      {hasProjectFolders && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-[#1A1A1A]/40 uppercase tracking-wider">{t('creative.projects')}</h4>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setProjectFilter(null)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                projectFilter === null
                  ? 'bg-[#C4622D] text-white shadow-md'
                  : 'bg-white/60 text-[#1A1A1A]/60 hover:bg-white/90'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              {t('creative.all_projects')}
            </button>
            {projectFolders
              .filter(f => f.projectId !== null)
              .map(folder => (
                <button
                  key={folder.projectId}
                  onClick={() => setProjectFilter(folder.projectId!)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                    projectFilter === folder.projectId
                      ? 'bg-[#2D4A3E] text-[#F5F0E8] shadow-md'
                      : 'bg-white/60 text-[#1A1A1A]/60 hover:bg-white/90'
                  }`}
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  {folder.projectName || t('creative.project')}
                  <span className="text-xs opacity-70 ml-1">({folder.count})</span>
                </button>
              ))}
            {projectFolders.some(f => f.projectId === null) && (
              <button
                onClick={() => setProjectFilter('none')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                  projectFilter === 'none'
                    ? 'bg-[#1A1A1A]/80 text-white shadow-md'
                    : 'bg-white/60 text-[#1A1A1A]/40 hover:bg-white/90'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                {t('creative.no_project')}
                <span className="text-xs opacity-70 ml-1">({projectFolders.find(f => f.projectId === null)?.count || 0})</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Filtros de tipo */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[#1A1A1A]/40" />
          {filterOptions.map(f => {
            const Icon = f.icon
            return (
              <button
                key={f.id}
                onClick={() => setFilterType(f.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                  filterType === f.id
                    ? 'bg-[#2D4A3E] text-[#F5F0E8]'
                    : 'bg-white/50 text-[#1A1A1A]/60 hover:bg-white/80'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {f.label}
              </button>
            )
          })}
        </div>
        <button
          onClick={onRefresh}
          className="p-2 rounded-xl bg-white/50 hover:bg-white/80 transition-all text-[#1A1A1A]/40 hover:text-[#1A1A1A]"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Grid de assets */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#C4622D]" />
        </div>
      ) : assets.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">🎨</div>
          <p className="text-[#1A1A1A]/50 text-sm">
            {projectFilter ? t('creative.no_creations_project') : t('creative.no_creations')}
          </p>
          {projectFilter && (
            <button
              onClick={() => setProjectFilter(null)}
              className="mt-3 text-sm text-[#C4622D] hover:underline"
            >
              {t('creative.view_all')}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {assets.map((asset, i) => (
            <motion.div
              key={asset.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <AssetCard
                asset={asset}
                onPreview={() => onPreview(asset)}
                onDelete={() => onDelete(asset.id)}
                onCopyText={onCopyText}
                copiedId={copiedId}
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================
// ASSET CARD
// ============================================
function AssetCard({
  asset, onPreview, onDelete, onCopyText, copiedId,
}: {
  asset: CreativeAsset
  onPreview: () => void
  onDelete: () => void
  onCopyText: (text: string, id: string) => void
  copiedId: string | null
}) {
  const { t } = useI18n()
  const agent = AGENT_LABELS[asset.type] || AGENT_FALLBACK

  return (
    <Card className="overflow-hidden bg-white/70 backdrop-blur-sm border-0 hover:shadow-lg transition-all duration-300 group">
      {/* Preview area */}
      <div
        className="relative cursor-pointer"
        onClick={onPreview}
      >
        {(asset.type === 'image' || asset.type === 'uploaded_image') ? (
          <div className="aspect-square bg-[#F5F0E8] relative overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={asset.content}
              alt={asset.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = ''
                ;(e.target as HTMLImageElement).style.display = 'none'
              }}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
              <Eye className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-all" />
            </div>
          </div>
        ) : asset.type === 'video' ? (
          <div className="aspect-video bg-gradient-to-br from-[#4A90D9]/10 to-[#2D4A3E]/10 relative overflow-hidden">
            {asset.thumbnail ? (
              <>  {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset.thumbnail} alt={asset.title} className="w-full h-full object-cover" />
              </>
            ) : asset.content && asset.content.startsWith('http') ? (
              <video
                src={asset.content}
                muted
                playsInline
                preload="metadata"
                className="w-full h-full object-cover pointer-events-none"
                onLoadedData={(e) => {
                  const vid = e.target as HTMLVideoElement
                  vid.currentTime = 0.1
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <Film className="w-10 h-10 text-[#4A90D9]/40" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
              <Play className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-all drop-shadow-lg" fill="white" />
            </div>
            <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-lg">
              🎬 Video
            </div>
          </div>
        ) : (
          <div className="p-4 bg-gradient-to-br from-[#2D4A3E]/5 to-[#C4622D]/5 min-h-[120px]">
            <p className="text-sm text-[#1A1A1A]/70 line-clamp-4">
              {asset.content}
            </p>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold" style={{ color: agent.color }}>
            {agent.emoji} {asset.type === 'image' ? t('creative.image_label') : asset.type === 'video' ? t('creative.video_label') : t('creative.copy_label')}
          </span>
          <div className="flex items-center gap-1.5">
            {asset.project?.name && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#2D4A3E]/10 text-[#2D4A3E]/70 font-medium truncate max-w-[100px]">
                📁 {asset.project.name}
              </span>
            )}
            {asset.platform && asset.platform !== 'general' && (
              <span className="text-xs text-[#1A1A1A]/40 capitalize">{asset.platform}</span>
            )}
          </div>
        </div>
        <p className="text-sm font-medium text-[#1A1A1A] truncate">{asset.title}</p>
        <div className="flex items-center gap-1 mt-2">
          <button
            onClick={onPreview}
            className="p-1.5 rounded-lg bg-[#F5F0E8]/60 hover:bg-[#F5F0E8] text-[#1A1A1A]/40 hover:text-[#1A1A1A] transition-all"
            title={t('creative.view_detail')}
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          {asset.type === 'image' && asset.content && (
            <button
              onClick={(e) => { e.stopPropagation(); downloadBase64Image(asset.content, asset.title) }}
              className="p-1.5 rounded-lg bg-[#F5F0E8]/60 hover:bg-[#2D4A3E] text-[#1A1A1A]/40 hover:text-white transition-all"
              title={t('creative.download_image')}
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
          {asset.type === 'video' && asset.content && (
            <button
              onClick={(e) => { e.stopPropagation(); downloadVideoFromUrl(asset.content, asset.title) }}
              className="p-1.5 rounded-lg bg-[#F5F0E8]/60 hover:bg-[#2D4A3E] text-[#1A1A1A]/40 hover:text-white transition-all"
              title={t('creative.download_video')}
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
          {asset.type === 'copy' && (
            <button
              onClick={() => onCopyText(asset.content, asset.id)}
              className="p-1.5 rounded-lg bg-[#F5F0E8]/60 hover:bg-[#F5F0E8] text-[#1A1A1A]/40 hover:text-[#1A1A1A] transition-all"
              title={t('creative.copy_text')}
            >
              {copiedId === asset.id ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          )}
          {(asset.type === 'image' || asset.type === 'video' || asset.type === 'copy') && (
            <Link
              href={buildSocialBridgeUrl(asset)}
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 rounded-lg bg-[#F5F0E8]/60 hover:bg-[#C4622D]/10 text-[#1A1A1A]/40 hover:text-[#C4622D] transition-all"
              title={t('creative.send_social_bridge')}
            >
              <Share2 className="w-3.5 h-3.5" />
            </Link>
          )}
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg bg-[#F5F0E8]/60 hover:bg-red-50 text-[#1A1A1A]/40 hover:text-red-500 transition-all ml-auto"
            title={t('creative.delete')}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </Card>
  )
}

// ============================================
// RESULT PREVIEW (inline en crear tab)
// ============================================
function ResultPreview({
  asset, onCopyText, copiedId, onOpenLightbox,
}: {
  asset: CreativeAsset
  onCopyText: (text: string, id: string) => void
  copiedId: string | null
  onOpenLightbox: (src: string, title: string) => void
}) {
  const { t } = useI18n()
  if (asset.type === 'image') {
    return (
      <div className="space-y-3">
        <div
          className="rounded-xl overflow-hidden bg-[#F5F0E8] cursor-pointer relative group"
          onClick={() => onOpenLightbox(asset.content, asset.title)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset.content} alt={asset.title} className="w-full max-h-[500px] object-contain" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
            <Maximize2 className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-all drop-shadow-lg" />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-[#1A1A1A]/40">{t('creative.saved_auto')}</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenLightbox(asset.content, asset.title)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F5F0E8] hover:bg-[#F5F0E8]/80 text-[#1A1A1A]/60 hover:text-[#1A1A1A] text-xs font-medium transition-all"
              title={t('creative.enlarge')}
            >
              <Maximize2 className="w-3.5 h-3.5" /> {t('creative.enlarge')}
            </button>
            <button
              onClick={() => downloadBase64Image(asset.content, asset.title)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2D4A3E] text-white text-xs font-medium hover:bg-[#2D4A3E]/80 transition-all"
              title={t('creative.download_image')}
            >
              <Download className="w-3.5 h-3.5" /> {t('creative.download')}
            </button>
            <Link
              href={buildSocialBridgeUrl(asset)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C4622D]/10 text-[#C4622D] text-xs font-medium hover:bg-[#C4622D]/20 transition-all"
              title={t('creative.send_social_bridge')}
            >
              <Share2 className="w-3.5 h-3.5" /> Social Bridge
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (asset.type === 'video') {
    // Video real MP4 — content es la URL del video
    const isRealVideo = asset.isRealVideo || (asset.content && asset.content.startsWith('http') && !asset.content.startsWith('['))
    if (isRealVideo) {
      return (
        <div className="space-y-3">
          <div className="rounded-xl overflow-hidden bg-black max-h-[500px] flex items-center justify-center">
            <video
              src={asset.content}
              controls
              playsInline
              className="w-full max-h-[500px] object-contain"
              poster={asset.thumbnail || undefined}
            >
              {t('creative.video_not_supported')}
            </video>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#1A1A1A]/40">{t('creative.video_mp4_ai')}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => downloadVideoFromUrl(asset.content, asset.title)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2D4A3E] text-white text-xs font-medium hover:bg-[#2D4A3E]/80 transition-all"
                title={t('creative.download_video')}
              >
                <Download className="w-3.5 h-3.5" /> {t('creative.download_mp4')}
              </button>
              <Link
                href={buildSocialBridgeUrl(asset)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C4622D]/10 text-[#C4622D] text-xs font-medium hover:bg-[#C4622D]/20 transition-all"
                title={t('creative.send_social_bridge')}
              >
                <Share2 className="w-3.5 h-3.5" /> Social Bridge
              </Link>
            </div>
          </div>
        </div>
      )
    }
    // Fallback: frames estáticos (contenido antiguo)
    const frames: string[] = asset.frames || []
    return (
      <div className="space-y-3">
        <p className="text-sm text-[#1A1A1A]/60">{frames.length} {t('creative.frames_generated')}</p>
        <div className="grid grid-cols-2 gap-2">
          {frames.map((frame, i) => (
            <div key={i} className="rounded-xl overflow-hidden bg-[#F5F0E8] aspect-[9/16]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={frame} alt={`Frame ${i + 1}`} className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Copy
  return (
    <div className="space-y-3">
      <div className="p-4 bg-[#F5F0E8]/50 rounded-xl">
        <pre className="whitespace-pre-wrap text-sm text-[#1A1A1A] font-sans">{asset.content}</pre>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onCopyText(asset.content, asset.id)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#2D4A3E] text-white text-sm font-medium hover:bg-[#2D4A3E]/80 transition-all"
        >
          {copiedId === asset.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copiedId === asset.id ? t('creative.copied') : t('creative.copy_text')}
        </button>
        <Link
          href={buildSocialBridgeUrl(asset)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#C4622D]/10 text-[#C4622D] text-sm font-medium hover:bg-[#C4622D]/20 transition-all"
        >
          <Share2 className="w-4 h-4" /> Social Bridge
        </Link>
      </div>
    </div>
  )
}

// ============================================
// PREVIEW MODAL
// ============================================
function PreviewModal({
  asset, onClose, onDelete, onCopyText, copiedId,
  videoFrameIndex, setVideoFrameIndex, onOpenLightbox,
}: {
  asset: CreativeAsset
  onClose: () => void
  onDelete: (id: string) => void
  onCopyText: (text: string, id: string) => void
  copiedId: string | null
  videoFrameIndex: number
  setVideoFrameIndex: (i: number) => void
  onOpenLightbox: (src: string, title: string) => void
}) {
  const { t } = useI18n()
  const agent = AGENT_LABELS[asset.type] || AGENT_FALLBACK
  const isRealVideo = asset.type === 'video' && (asset.isRealVideo || (asset.content && asset.content.startsWith('http') && !asset.content.startsWith('[')))
  let frames: string[] = []
  if (asset.type === 'video' && !isRealVideo) {
    try {
      frames = JSON.parse(asset.content)
    } catch {
      frames = []
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#1A1A1A]/10">
          <div className="flex items-center gap-2">
            <span className="text-xl">{agent.emoji}</span>
            <div>
              <h3 className="font-bold text-[#1A1A1A]">{asset.title}</h3>
              <p className="text-xs text-[#1A1A1A]/40">
                {asset.platform && `${asset.platform}`}
                {asset.format && ` · ${asset.format}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[#F5F0E8] transition-all">
            <X className="w-5 h-5 text-[#1A1A1A]/40" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {asset.type === 'image' && (
            <div
              className="rounded-xl overflow-hidden bg-[#F5F0E8] cursor-pointer relative group"
              onClick={() => onOpenLightbox(asset.content, asset.title)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset.content} alt={asset.title} className="w-full object-contain max-h-[60vh]" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all flex items-center justify-center">
                <Maximize2 className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-all drop-shadow-lg" />
              </div>
            </div>
          )}

          {asset.type === 'video' && isRealVideo && (
            <div className="rounded-xl overflow-hidden bg-black max-h-[60vh] flex items-center justify-center">
              <video
                src={asset.content}
                controls
                autoPlay
                playsInline
                className="w-full max-h-[60vh] object-contain"
                poster={asset.thumbnail || undefined}
              >
                {t('creative.video_not_supported')}
              </video>
            </div>
          )}

          {asset.type === 'video' && !isRealVideo && frames.length > 0 && (
            <div className="space-y-3">
              <div className="rounded-xl overflow-hidden bg-[#F5F0E8] aspect-[9/16] max-h-[50vh] mx-auto w-fit">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={frames[videoFrameIndex]} alt={`Frame ${videoFrameIndex + 1}`} className="h-full object-contain" />
              </div>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setVideoFrameIndex(Math.max(0, videoFrameIndex - 1))}
                  disabled={videoFrameIndex === 0}
                  className="p-2 rounded-xl bg-[#F5F0E8] hover:bg-[#2D4A3E] hover:text-white disabled:opacity-30 transition-all text-[#1A1A1A]"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm font-medium text-[#1A1A1A]">
                  Frame {videoFrameIndex + 1} / {frames.length}
                </span>
                <button
                  onClick={() => setVideoFrameIndex(Math.min(frames.length - 1, videoFrameIndex + 1))}
                  disabled={videoFrameIndex === frames.length - 1}
                  className="p-2 rounded-xl bg-[#F5F0E8] hover:bg-[#2D4A3E] hover:text-white disabled:opacity-30 transition-all text-[#1A1A1A]"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {asset.type === 'copy' && (
            <div className="p-4 bg-[#F5F0E8]/50 rounded-xl">
              <pre className="whitespace-pre-wrap text-sm text-[#1A1A1A] font-sans">{asset.content}</pre>
            </div>
          )}
        </div>

        {/* Prompt info */}
        {asset.prompt && (
          <div className="px-4 pb-2">
            <p className="text-xs text-[#1A1A1A]/30 mb-1">{t('creative.prompt_used')}</p>
            <p className="text-xs text-[#1A1A1A]/50 italic">{asset.prompt}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 p-4 border-t border-[#1A1A1A]/10">
          {asset.type === 'image' && asset.content && (
            <>
              <button
                onClick={() => onOpenLightbox(asset.content, asset.title)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F5F0E8] text-[#1A1A1A] text-sm font-medium hover:bg-[#F5F0E8]/80 transition-all"
              >
                <Maximize2 className="w-4 h-4" /> {t('creative.enlarge')}
              </button>
              <button
                onClick={() => downloadBase64Image(asset.content, asset.title)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2D4A3E] text-white text-sm font-medium hover:bg-[#2D4A3E]/80 transition-all"
              >
                <Download className="w-4 h-4" /> {t('creative.download')}
              </button>
            </>
          )}
          {asset.type === 'video' && asset.content && (
            <button
              onClick={() => downloadVideoFromUrl(asset.content, asset.title)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2D4A3E] text-white text-sm font-medium hover:bg-[#2D4A3E]/80 transition-all"
            >
              <Download className="w-4 h-4" /> {t('creative.download_mp4')}
            </button>
          )}
          {asset.type === 'copy' && (
            <button
              onClick={() => onCopyText(asset.content, asset.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2D4A3E] text-white text-sm font-medium hover:bg-[#2D4A3E]/80 transition-all"
            >
              {copiedId === asset.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedId === asset.id ? t('creative.copied') : t('creative.copy_text')}
            </button>
          )}
          <Link
            href={buildSocialBridgeUrl(asset)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#C4622D]/10 text-[#C4622D] text-sm font-medium hover:bg-[#C4622D]/20 transition-all"
          >
            <Share2 className="w-4 h-4" /> Social Bridge
          </Link>
          <button
            onClick={() => { onDelete(asset.id); onClose() }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 transition-all ml-auto"
          >
            <Trash2 className="w-4 h-4" /> {t('creative.delete')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}


// ============================================
// HELPER: Descargar imagen base64
// ============================================
function downloadVideoFromUrl(url: string, title: string) {
  try {
    const safeName = title.replace(/[^a-zA-Z0-9_\- ]/g, '').trim() || 'video'
    const a = document.createElement('a')
    a.href = url
    a.download = `${safeName}.mp4`
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } catch (err) {
    console.error('Error al descargar video:', err)
  }
}

function downloadBase64Image(dataUri: string, title: string) {
  try {
    // Extraer tipo mime y datos base64
    const match = dataUri.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) return

    const mimeType = match[1]
    const base64Data = match[2]
    const extension = mimeType.split('/')[1] || 'png'

    // Convertir base64 a Uint8Array
    const byteChars = atob(base64Data)
    const byteArray = new Uint8Array(byteChars.length)
    for (let i = 0; i < byteChars.length; i++) {
      byteArray[i] = byteChars.charCodeAt(i)
    }

    // Crear blob y disparar descarga
    const blob = new Blob([byteArray], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    // Limpiar el título para nombre de archivo
    const safeName = title.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s-_]/g, '').trim().replace(/\s+/g, '_') || 'imagen'
    a.download = `${safeName}.${extension}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Error al descargar imagen:', err)
  }
}

// ============================================
// HELPER: Enviar asset a Social Bridge
// ============================================
function buildSocialBridgeUrl(asset: CreativeAsset): string {
  const params = new URLSearchParams()
  // Media URL
  if (asset.type === 'image' || asset.type === 'video') {
    params.set('mediaUrl', asset.content)
  }
  // Content type mapping
  if (asset.type === 'image') {
    params.set('contentType', 'image')
  } else if (asset.type === 'video') {
    params.set('contentType', 'video')
  } else if (asset.type === 'copy') {
    params.set('content', asset.content)
    params.set('contentType', 'text')
  }
  // Source identifier
  params.set('source', 'estudio_creativo')
  // Asset title for reference
  if (asset.title) params.set('title', asset.title)
  return `/dashboard/social-bridge?${params.toString()}`
}

// ============================================
// LIGHTBOX — Vista completa de la imagen
// ============================================
function ImageLightbox({
  src, title, onClose,
}: {
  src: string
  title: string
  onClose: () => void
}) {
  const [zoom, setZoom] = useState(1)
  const minZoom = 0.5
  const maxZoom = 3

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, maxZoom))
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, minZoom))
  const handleResetZoom = () => setZoom(1)

  // Cerrar con Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === '+' || e.key === '=') handleZoomIn()
      if (e.key === '-') handleZoomOut()
      if (e.key === '0') handleResetZoom()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex flex-col"
      onClick={onClose}
    >
      {/* Barra superior */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-black/40"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <h3 className="text-white font-medium text-sm truncate max-w-[300px]">{title}</h3>
          <span className="text-white/40 text-xs">{Math.round(zoom * 100)}%</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            disabled={zoom <= minZoom}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 transition-all"
            title="Alejar (−)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleResetZoom}
            className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-all"
            title="Restablecer zoom (0)"
          >
            100%
          </button>
          <button
            onClick={handleZoomIn}
            disabled={zoom >= maxZoom}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 transition-all"
            title="Acercar (+)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="w-px h-6 bg-white/20 mx-1" />
          <button
            onClick={(e) => { e.stopPropagation(); downloadBase64Image(src, title) }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#2D4A3E] hover:bg-[#2D4A3E]/80 text-white text-xs font-medium transition-all"
            title="Descargar"
          >
            <Download className="w-4 h-4" /> Descargar
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/10 hover:bg-red-500/50 text-white transition-all"
            title="Cerrar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Imagen centrada con zoom */}
      <div
        className="flex-1 flex items-center justify-center overflow-auto p-4"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ transform: `scale(${zoom})`, transition: 'transform 0.2s ease-out' }}
          className="origin-center"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={title}
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
            draggable={false}
          />
        </div>
      </div>

      {/* Hint en la parte inferior */}
      <div className="text-center pb-3">
        <p className="text-white/30 text-xs">
          Esc para cerrar · +/− para zoom · Clic fuera para cerrar
        </p>
      </div>
    </motion.div>
  )
}