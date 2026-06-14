'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSession } from 'next-auth/react'
import {
  Megaphone,
  ArrowLeft,
  ArrowRight,
  Globe,
  Sparkles,
  CheckCircle,
  Loader2,
  Image as ImageIcon,
  Download,
  RotateCcw,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Dna,
  Wand2,
  Check,
  X,
  RefreshCw,
  Plus,
  Trash2,
  Settings2,
  Key,
  Upload,
  Link2,
  Heart,
  FolderPlus,
  Target,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n-context'
import { AD_TEMPLATES, getCategories, type AdTemplate, type PersonalizedPrompt } from '@/lib/ad-factory-templates'
import { FeedbackModal, useFeedbackTrigger } from '@/components/feedback-modal'
import {
  IMAGE_MODELS,
  DEFAULT_IMAGE_MODEL_ID,
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  TIER_LABELS,
  groupImageModels,
  getImageModel,
  type ImageModel,
} from '@/lib/image-models'

/* ─── Types ─── */
interface GeneratedImage {
  templateId: number
  templateName: string
  imageUrl: string | null
  assetId: string | null
  status: 'pending' | 'generating' | 'done' | 'error'
  error?: string
  engine?: 'openrouter' | 'routellm'
  /** Actual OpenRouter model id used, e.g. "openai/gpt-5.4-image-2" */
  model?: string
  fallback?: boolean
}

const STEPS = ['adf.step1', 'adf.step2', 'adf.step3', 'adf.step4', 'adf.step5'] as const

const CATEGORY_KEYS: Record<string, string> = {
  all: 'adf.cat_all',
  text: 'adf.cat_text',
  'social-proof': 'adf.cat_social_proof',
  comparison: 'adf.cat_comparison',
  ugc: 'adf.cat_ugc',
  editorial: 'adf.cat_editorial',
  data: 'adf.cat_data',
  lifestyle: 'adf.cat_lifestyle',
  promo: 'adf.cat_promo',
}

export default function AdFactoryPage() {
  const { data: session } = useSession() || {}
  const { t, locale } = useI18n()
  const abortRef = useRef(false)
  const { showFeedback, setShowFeedback, feedbackFeature, feedbackLabel, triggerFeedback } = useFeedbackTrigger()

  // Wizard state
  const [step, setStep] = useState(0)

  // Step 1: Brand info
  const [brandName, setBrandName] = useState('')
  const [brandUrl, setBrandUrl] = useState('')
  const [productName, setProductName] = useState('')

  // Reference images & model
  const [refImages, setRefImages] = useState<string[]>([])
  const [refUrlInput, setRefUrlInput] = useState('')
  const [refInputMode, setRefInputMode] = useState<'upload' | 'url'>('upload')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [imageModel, setImageModel] = useState(DEFAULT_IMAGE_MODEL_ID)
  const [hasOpenRouterKey, setHasOpenRouterKey] = useState<boolean | null>(null)

  // Focus area: optional instruction telling the AI where to focus within the product/platform
  // (e.g., "the product scanner", "the main dashboard", "Dimitri the dragon card")
  const [focusArea, setFocusArea] = useState('')

  // Step 2: Brand DNA
  const [brandDNA, setBrandDNA] = useState('')
  const [dnaLoading, setDnaLoading] = useState(false)
  const [dnaError, setDnaError] = useState('')
  const [dnaExpanded, setDnaExpanded] = useState(false)

  // Step 3: Template selection
  const [selectedTemplates, setSelectedTemplates] = useState<Set<number>>(new Set())
  const [categoryFilter, setCategoryFilter] = useState('all')

  // Step 4: Personalized prompts
  const [prompts, setPrompts] = useState<PersonalizedPrompt[]>([])
  const [promptsLoading, setPromptsLoading] = useState(false)
  const [promptsError, setPromptsError] = useState('')
  const [expandedPrompt, setExpandedPrompt] = useState<number | null>(null)

  // Step 5: Image generation
  const [images, setImages] = useState<GeneratedImage[]>([])
  const [genRunning, setGenRunning] = useState(false)

  // Favorites & Save to Project
  const [selectedFavorites, setSelectedFavorites] = useState<Set<number>>(new Set())
  const [savingProject, setSavingProject] = useState(false)
  const [savedProjectName, setSavedProjectName] = useState('')

  // Lightbox
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string } | null>(null)

  const categories = getCategories()

  // Check OpenRouter key on mount
  useEffect(() => {
    fetch('/api/ad-factory/config')
      .then(r => r.json())
      .then(data => setHasOpenRouterKey(data.hasOpenRouterKey ?? false))
      .catch(() => setHasOpenRouterKey(false))
  }, [])

  // Close lightbox on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightboxImage(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  /* ─── Step 1 → 2: Analyze Brand ─── */
  const analyzeBrand = useCallback(async () => {
    setDnaLoading(true)
    setDnaError('')
    try {
      const res = await fetch('/api/ad-factory/brand-dna', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandName, brandUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error analyzing brand')
      setBrandDNA(data.brandDNA)
      // Persist Brand DNA to localStorage for Project Builder integration
      try {
        const hexMatches = (data.brandDNA as string).match(/#[0-9A-Fa-f]{6}/g) || []
        const brandDNAForStorage = {
          brandName,
          colors: {
            primary: hexMatches[0] || '#2D4A3E',
            accent: hexMatches[1] || '#C4622D',
            bg: hexMatches[2] || '#1A1A1A',
          },
          tone: 'professional',
          rawDNA: data.brandDNA,
        }
        localStorage.setItem('octopus_brand_dna', JSON.stringify(brandDNAForStorage))
      } catch {}
      setStep(1)
    } catch (err) {
      setDnaError(err instanceof Error ? err.message : 'Error')
    } finally {
      setDnaLoading(false)
    }
  }, [brandName, brandUrl])

  /* ─── Step 3 → 4: Generate Prompts ─── */
  const generatePrompts = useCallback(async () => {
    setPromptsLoading(true)
    setPromptsError('')
    try {
      const res = await fetch('/api/ad-factory/generate-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandName,
          productName,
          brandDNA,
          selectedTemplateIds: Array.from(selectedTemplates),
          referenceImages: refImages.length > 0 ? refImages : undefined,
          focusArea: focusArea.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error generating prompts')
      setPrompts(data.prompts || [])
      setStep(3)
    } catch (err) {
      setPromptsError(err instanceof Error ? err.message : 'Error')
    } finally {
      setPromptsLoading(false)
    }
  }, [brandName, productName, brandDNA, selectedTemplates, refImages, focusArea])

  /* ─── Step 5: Generate Images (sequential) ─── */
  const generateImages = useCallback(async (promptsToGen?: PersonalizedPrompt[]) => {
    const list = promptsToGen || prompts
    abortRef.current = false
    setGenRunning(true)

    // Initialize images state
    const initial: GeneratedImage[] = list.map(p => ({
      templateId: p.templateId,
      templateName: p.templateName,
      imageUrl: null,
      assetId: null,
      status: 'pending',
    }))
    setImages(initial)
    setStep(4)

    // Generate sequentially
    for (let i = 0; i < list.length; i++) {
      if (abortRef.current) break
      const p = list[i]

      setImages(prev => prev.map((img, idx) =>
        idx === i ? { ...img, status: 'generating' } : img
      ))

      try {
        const res = await fetch('/api/ad-factory/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: p.prompt,
            templateName: p.templateName,
            templateId: p.templateId,
            brandName,
            referenceImages: refImages.length > 0 ? refImages : undefined,
            imageModel,
            focusArea: focusArea.trim() || undefined,
          }),
        })
        // Handle non-JSON responses (502/504 proxy errors return HTML)
        let data: Record<string, unknown>
        const contentType = res.headers.get('content-type') || ''
        if (contentType.includes('application/json')) {
          data = await res.json()
        } else {
          const text = await res.text()
          if (res.status === 502 || res.status === 504) {
            throw new Error(locale === 'en' ? 'Timeout — generation took too long. Try another model or a simpler prompt.' : 'Timeout — la generación tardó demasiado. Intenta con otro modelo o prompt más simple.')
          }
          throw new Error(text.substring(0, 200) || `Error ${res.status}`)
        }
        if (!res.ok) throw new Error((data.error as string) || 'Generation failed')

        setImages(prev => prev.map((img, idx) =>
          idx === i ? { ...img, status: 'done' as const, imageUrl: data.imageUrl as string, assetId: data.assetId as string, engine: data.engine as GeneratedImage['engine'], model: data.model as string, fallback: data.fallback as boolean } : img
        ))
      } catch (err) {
        setImages(prev => prev.map((img, idx) =>
          idx === i ? { ...img, status: 'error', error: err instanceof Error ? err.message : 'Error' } : img
        ))
      }
    }
    setGenRunning(false)
  }, [prompts, brandName, refImages, imageModel, focusArea])

  /* ─── Retry single image ─── */
  const retrySingle = useCallback(async (index: number) => {
    const p = prompts[index]
    if (!p) return

    setImages(prev => prev.map((img, idx) =>
      idx === index ? { ...img, status: 'generating', error: undefined } : img
    ))

    try {
      const res = await fetch('/api/ad-factory/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: p.prompt,
          templateName: p.templateName,
          templateId: p.templateId,
          brandName,
          referenceImages: refImages.length > 0 ? refImages : undefined,
          imageModel,
          focusArea: focusArea.trim() || undefined,
        }),
      })
      let data: Record<string, unknown>
      const contentType = res.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        data = await res.json()
      } else {
        if (res.status === 502 || res.status === 504) {
          throw new Error(locale === 'en' ? 'Timeout — generation took too long. Try another model.' : 'Timeout — la generación tardó demasiado. Intenta con otro modelo.')
        }
        throw new Error(`Error ${res.status}`)
      }
      if (!res.ok) throw new Error((data.error as string) || 'Generation failed')

      setImages(prev => prev.map((img, idx) =>
        idx === index ? { ...img, status: 'done' as const, imageUrl: data.imageUrl as string, assetId: data.assetId as string, engine: data.engine as GeneratedImage['engine'], model: data.model as string, fallback: data.fallback as boolean } : img
      ))
    } catch (err) {
      setImages(prev => prev.map((img, idx) =>
        idx === index ? { ...img, status: 'error', error: err instanceof Error ? err.message : 'Error' } : img
      ))
    }
  }, [prompts, brandName, refImages, imageModel, focusArea])

  /* ─── Template selection helpers ─── */
  const toggleTemplate = (id: number) => {
    setSelectedTemplates(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    const filtered = categoryFilter === 'all'
      ? AD_TEMPLATES
      : AD_TEMPLATES.filter(t => t.category === categoryFilter)
    setSelectedTemplates(new Set(filtered.map(t => t.id)))
  }

  const deselectAll = () => setSelectedTemplates(new Set())

  /* ─── Reference image helpers ─── */
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const handleFiles = async (files: FileList | File[]) => {
    const MAX_REF_IMAGES = 20
    const remaining = MAX_REF_IMAGES - refImages.length
    if (remaining <= 0) return
    const toProcess = Array.from(files).slice(0, remaining)
    for (const file of toProcess) {
      if (!file.type.startsWith('image/')) continue
      if (file.size > 10 * 1024 * 1024) continue // max 10MB
      const base64 = await fileToBase64(file)
      setRefImages(prev => prev.length < MAX_REF_IMAGES ? [...prev, base64] : prev)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files)
  }

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false) }

  const addRefImageUrl = () => {
    if (refUrlInput.trim() && refImages.length < 20) {
      setRefImages(prev => [...prev, refUrlInput.trim()])
      setRefUrlInput('')
    }
  }
  const removeRefImage = (idx: number) => {
    setRefImages(prev => prev.filter((_, i) => i !== idx))
  }

  /* ─── Reset to start ─── */
  const resetAll = () => {
    abortRef.current = true
    setStep(0)
    setBrandName('')
    setBrandUrl('')
    setProductName('')
    setBrandDNA('')
    setDnaError('')
    setSelectedTemplates(new Set())
    setPrompts([])
    setPromptsError('')
    setImages([])
    setGenRunning(false)
    setRefImages([])
    setRefUrlInput('')
    setSelectedFavorites(new Set())
    setSavedProjectName('')
  }

  /* ─── Toggle favorite ─── */
  const toggleFavorite = (idx: number) => {
    setSelectedFavorites(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  /* ─── Select all done images ─── */
  const selectAllDone = () => {
    const allDone = new Set<number>()
    images.forEach((img, idx) => { if (img.status === 'done') allDone.add(idx) })
    setSelectedFavorites(allDone)
  }

  /* ─── Save favorites to project ─── */
  const saveFavoritesToProject = async () => {
    if (selectedFavorites.size === 0) return
    setSavingProject(true)
    try {
      const favoriteImages = Array.from(selectedFavorites)
        .map(idx => images[idx])
        .filter(img => img && img.status === 'done' && img.assetId)

      const res = await fetch('/api/ad-factory/save-to-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: `${brandName} - ${productName || 'Campaign'}`,
          description: `Campaña publicitaria generada con Ad Factory para ${brandName}`,
          assetIds: favoriteImages.map(img => img.assetId),
          brandName,
          productName,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error saving')
      setSavedProjectName(data.project?.name || (locale === 'en' ? 'Project' : 'Proyecto'))
      triggerFeedback('ad_factory', 'Ad Factory')
    } catch (err) {
      console.error('Error saving to project:', err)
    } finally {
      setSavingProject(false)
    }
  }

  const filteredTemplates = categoryFilter === 'all'
    ? AD_TEMPLATES
    : AD_TEMPLATES.filter(t => t.category === categoryFilter)

  const doneCount = images.filter(i => i.status === 'done').length
  const errorCount = images.filter(i => i.status === 'error').length

  if (!session) return null

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-gradient-to-br from-[#C4622D] to-[#FFD700]">
            <Megaphone className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            {t('adf.title')}
          </h1>
        </div>
        <p className="text-gray-400 text-sm md:text-base">{t('adf.subtitle')}</p>
      </motion.div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-shrink-0">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                i === step
                  ? 'bg-[#C4622D] text-white'
                  : i < step
                    ? 'bg-[#2D4A3E] text-emerald-300'
                    : 'bg-[#1A2332] text-gray-500'
              }`}>
                {i < step ? (
                  <CheckCircle className="w-3.5 h-3.5" />
                ) : (
                  <span className="w-4 h-4 flex items-center justify-center rounded-full bg-black/20 text-[10px]">{i + 1}</span>
                )}
                <span className="hidden sm:inline">{t(s)}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-6 h-0.5 ${i < step ? 'bg-[#2D4A3E]' : 'bg-[#1A2332]'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* ═══════ STEP 1: Brand Info ═══════ */}
        {step === 0 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="max-w-2xl mx-auto space-y-4"
          >
            {/* Brand info card */}
            <Card className="p-6 md:p-8 bg-[#1A2332] border-[#2D4A3E]/30">
              <div className="flex items-center gap-3 mb-6">
                <Globe className="w-5 h-5 text-[#C4622D]" />
                <h2 className="text-lg font-semibold text-white">{t('adf.step1')}</h2>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">{t('adf.brand_name')} *</label>
                  <input
                    type="text"
                    value={brandName}
                    onChange={e => setBrandName(e.target.value)}
                    placeholder={t('adf.brand_name_ph')}
                    className="w-full px-4 py-2.5 bg-[#0F1419] border border-[#2D4A3E]/50 rounded-lg text-white placeholder:text-gray-500 focus:border-[#C4622D] focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">{t('adf.brand_url')} *</label>
                  <input
                    type="url"
                    value={brandUrl}
                    onChange={e => setBrandUrl(e.target.value)}
                    placeholder={t('adf.brand_url_ph')}
                    className="w-full px-4 py-2.5 bg-[#0F1419] border border-[#2D4A3E]/50 rounded-lg text-white placeholder:text-gray-500 focus:border-[#C4622D] focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">{t('adf.product_name')}</label>
                  <input
                    type="text"
                    value={productName}
                    onChange={e => setProductName(e.target.value)}
                    placeholder={t('adf.product_name_ph')}
                    className="w-full px-4 py-2.5 bg-[#0F1419] border border-[#2D4A3E]/50 rounded-lg text-white placeholder:text-gray-500 focus:border-[#C4622D] focus:outline-none transition-colors"
                  />
                </div>
              </div>
            </Card>

            {/* Reference images card */}
            <Card className="p-6 bg-[#1A2332] border-[#2D4A3E]/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <ImageIcon className="w-5 h-5 text-[#C4622D]" />
                  <h3 className="text-sm font-semibold text-white">{t('adf.ref_images')}</h3>
                </div>
                {refImages.length > 0 && (
                  <span className="text-xs text-gray-400">{refImages.length}/20</span>
                )}
              </div>
              <p className="text-xs text-gray-400 mb-4">{t('adf.ref_images_desc')}</p>

              {/* Image previews */}
              {refImages.length > 0 && (
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 mb-4 max-h-[240px] overflow-y-auto">
                  {refImages.map((src, idx) => (
                    <div key={idx} className="relative aspect-square bg-[#0F1419] rounded-lg overflow-hidden group">
                      <img src={src} alt={`Ref ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeRefImage(idx)}
                        className="absolute top-1 right-1 p-1 bg-red-500/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload / URL toggle */}
              {refImages.length < 20 && (
                <div className="space-y-3">
                  {/* Mode tabs */}
                  <div className="flex gap-1 bg-[#0F1419] rounded-lg p-1">
                    <button
                      onClick={() => setRefInputMode('upload')}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${refInputMode === 'upload' ? 'bg-[#2D4A3E] text-white' : 'text-gray-400 hover:text-gray-300'}`}
                    >
                      <Upload className="w-3.5 h-3.5" /> {t('adf.ref_upload')}
                    </button>
                    <button
                      onClick={() => setRefInputMode('url')}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${refInputMode === 'url' ? 'bg-[#2D4A3E] text-white' : 'text-gray-400 hover:text-gray-300'}`}
                    >
                      <Link2 className="w-3.5 h-3.5" /> URL
                    </button>
                  </div>

                  {refInputMode === 'upload' ? (
                    /* Drag & drop zone */
                    <div
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onClick={() => fileInputRef.current?.click()}
                      className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${isDragging ? 'border-[#C4622D] bg-[#C4622D]/10' : 'border-[#2D4A3E]/50 hover:border-[#2D4A3E] bg-[#0F1419]/50'}`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={e => { if (e.target.files) { handleFiles(e.target.files); e.target.value = '' } }}
                      />
                      <Upload className={`w-8 h-8 mx-auto mb-2 ${isDragging ? 'text-[#C4622D]' : 'text-gray-500'}`} />
                      <p className="text-sm text-gray-300">{t('adf.ref_drag')}</p>
                      <p className="text-xs text-gray-500 mt-1">{t('adf.ref_drag_hint')}</p>
                    </div>
                  ) : (
                    /* URL input */
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={refUrlInput}
                        onChange={e => setRefUrlInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRefImageUrl() } }}
                        placeholder={t('adf.ref_paste_ph')}
                        className="flex-1 px-3 py-2 bg-[#0F1419] border border-[#2D4A3E]/50 rounded-lg text-white text-sm placeholder:text-gray-500 focus:border-[#C4622D] focus:outline-none"
                      />
                      <button
                        onClick={addRefImageUrl}
                        disabled={!refUrlInput.trim()}
                        className="px-3 py-2 bg-[#2D4A3E] hover:bg-[#2D4A3E]/80 text-white text-sm rounded-lg disabled:opacity-40 transition-colors flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> {t('adf.ref_add_url')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </Card>
            {/* Focus Area card — optional instruction telling the AI what aspect to concentrate on */}
            <Card className="p-6 bg-[#1A2332] border-[#2D4A3E]/30">
              <div className="flex items-center gap-3 mb-2">
                <Target className="w-5 h-5 text-[#C4622D]" />
                <h3 className="text-sm font-semibold text-white">{t('adf.focus_area')}</h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-500/10 text-gray-400">
                  {t('adf.optional')}
                </span>
              </div>
              <p className="text-xs text-gray-400 mb-3">{t('adf.focus_area_desc')}</p>
              <input
                type="text"
                value={focusArea}
                onChange={e => setFocusArea(e.target.value)}
                placeholder={t('adf.focus_area_ph')}
                maxLength={200}
                className="w-full px-4 py-2.5 bg-[#0F1419] border border-[#2D4A3E]/50 rounded-lg text-white placeholder:text-gray-500 focus:border-[#C4622D] focus:outline-none transition-colors"
              />
              {focusArea.length > 0 && (
                <div className="mt-2 flex items-start gap-2 text-xs text-emerald-400/90 bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2">
                  <Sparkles className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>{t('adf.focus_area_active').replace('{focus}', focusArea)}</span>
                </div>
              )}
            </Card>


            {/* Image model selector card — multi-provider grouped selector */}
            <Card className="p-6 bg-[#1A2332] border-[#2D4A3E]/30">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <Settings2 className="w-5 h-5 text-[#C4622D]" />
                  <h3 className="text-sm font-semibold text-white">{t('adf.image_model')}</h3>
                </div>
                <span className="text-xs text-gray-500">{IMAGE_MODELS.length} {t('adf.models_available')}</span>
              </div>

              {/* OpenRouter status */}
              <div className="flex items-center gap-2 mb-4">
                <Key className="w-3.5 h-3.5 text-gray-400" />
                {hasOpenRouterKey ? (
                  <span className="text-xs text-emerald-400">{t('adf.openrouter_ready')}</span>
                ) : (
                  <span className="text-xs text-amber-400">{t('adf.openrouter_missing')} — <a href="/dashboard/settings" className="underline hover:text-amber-300">{t('adf.needs_openrouter')}</a></span>
                )}
              </div>

              {/* Models grouped by provider */}
              <div className="space-y-4">
                {CATEGORY_ORDER.map(cat => {
                  const models = groupImageModels()[cat]
                  if (!models || models.length === 0) return null
                  const catMeta = CATEGORY_LABELS[cat]
                  return (
                    <div key={cat}>
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: catMeta.color }}
                        />
                        <span
                          className="text-[11px] font-semibold uppercase tracking-wider"
                          style={{ color: catMeta.color }}
                        >
                          {t(catMeta.labelKey)}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {models.map((m: ImageModel) => {
                          const isSelected = imageModel === m.id
                          const disabled = m.needsKey && !hasOpenRouterKey
                          const tierMeta = m.tier ? TIER_LABELS[m.tier] : null
                          return (
                            <button
                              key={m.id}
                              onClick={() => !disabled && setImageModel(m.id)}
                              disabled={disabled}
                              className={`p-3 rounded-lg border text-left text-xs transition-all relative group ${
                                isSelected
                                  ? 'bg-[#C4622D]/10 border-[#C4622D] text-white shadow-[0_0_16px_rgba(196,98,45,0.25)]'
                                  : disabled
                                    ? 'bg-[#0F1419]/50 border-[#2D4A3E]/20 text-gray-500 cursor-not-allowed'
                                    : 'bg-[#0F1419] border-[#2D4A3E]/30 text-gray-300 hover:border-[#C4622D]/60 hover:bg-[#1A2332]'
                              }`}
                            >
                              {/* NEW badge */}
                              {m.isNew && !disabled && (
                                <span className="absolute -top-1.5 -right-1.5 text-[9px] font-bold bg-gradient-to-r from-emerald-500 to-teal-400 text-white px-1.5 py-0.5 rounded-full shadow-md">
                                  NEW
                                </span>
                              )}
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className="text-sm">{m.emoji}</span>
                                    <span className="font-medium truncate">{t(m.labelKey)}</span>
                                    {tierMeta && (
                                      <span
                                        className="text-[9px] px-1 py-0.5 rounded font-semibold uppercase"
                                        style={{
                                          backgroundColor: `${tierMeta.color}22`,
                                          color: tierMeta.color,
                                        }}
                                      >
                                        {t(tierMeta.labelKey)}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-gray-500 leading-snug line-clamp-2">
                                    {t(m.descKey)}
                                  </p>
                                  {m.priceHint && (
                                    <span className="text-[9px] text-gray-600 mt-0.5 inline-block">
                                      {m.priceHint}
                                    </span>
                                  )}
                                </div>
                                {isSelected && <Check className="w-4 h-4 text-[#C4622D] flex-shrink-0 mt-0.5" />}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>

            {/* Analyze button */}
            {dnaError && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {dnaError}
              </div>
            )}

            <Button
              onClick={analyzeBrand}
              disabled={!brandName.trim() || !brandUrl.trim() || dnaLoading}
              className="w-full bg-gradient-to-r from-[#C4622D] to-[#E07A3A] hover:from-[#B5571F] hover:to-[#D06C2E] text-white py-3 disabled:opacity-40"
            >
              {dnaLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('adf.analyzing')}</>
              ) : (
                <><Dna className="w-4 h-4 mr-2" />{t('adf.analyze_brand')}</>
              )}
            </Button>
          </motion.div>
        )}

        {/* ═══════ STEP 2: Brand DNA ═══════ */}
        {step === 1 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="max-w-3xl mx-auto"
          >
            <Card className="p-6 md:p-8 bg-[#1A2332] border-[#2D4A3E]/30">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">{t('adf.dna_ready')}</h2>
              </div>
              <p className="text-gray-400 text-sm mb-6">{t('adf.dna_desc')}</p>

              {/* DNA document preview */}
              <div className="bg-[#0F1419] rounded-lg border border-[#2D4A3E]/30 mb-6">
                <button
                  onClick={() => setDnaExpanded(!dnaExpanded)}
                  className="w-full flex items-center justify-between p-4 text-left"
                >
                  <span className="text-sm font-medium text-gray-300">Brand DNA Document — {brandName}</span>
                  {dnaExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {dnaExpanded && (
                  <div className="px-4 pb-4 max-h-[400px] overflow-y-auto">
                    <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">{brandDNA}</pre>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => setStep(0)}
                  variant="outline"
                  className="border-[#2D4A3E] text-gray-300 hover:bg-[#2D4A3E]/20"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />{t('adf.back')}
                </Button>
                <Button
                  onClick={() => setStep(2)}
                  className="flex-1 bg-gradient-to-r from-[#C4622D] to-[#E07A3A] hover:from-[#B5571F] hover:to-[#D06C2E] text-white"
                >
                  {t('adf.select_templates')} <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </Card>
          </motion.div>
        )}

        {/* ═══════ STEP 3: Template Selection ═══════ */}
        {step === 2 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            {/* Category filters */}
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => setCategoryFilter('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  categoryFilter === 'all' ? 'bg-[#C4622D] text-white' : 'bg-[#1A2332] text-gray-400 hover:text-white'
                }`}
              >
                {t('adf.cat_all')} ({AD_TEMPLATES.length})
              </button>
              {categories.map(c => (
                <button
                  key={c.id}
                  onClick={() => setCategoryFilter(c.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    categoryFilter === c.id ? 'bg-[#C4622D] text-white' : 'bg-[#1A2332] text-gray-400 hover:text-white'
                  }`}
                >
                  {t(CATEGORY_KEYS[c.id] || c.id)} ({c.count})
                </button>
              ))}
            </div>

            {/* Select/Deselect bar */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-400">
                {selectedTemplates.size} {t('adf.selected')}
              </span>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-xs text-[#C4622D] hover:underline">
                  {t('adf.select_all')}
                </button>
                <span className="text-gray-600">|</span>
                <button onClick={deselectAll} className="text-xs text-gray-400 hover:underline">
                  {t('adf.deselect_all')}
                </button>
              </div>
            </div>

            {/* Template grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-6">
              {filteredTemplates.map(tmpl => {
                const isSelected = selectedTemplates.has(tmpl.id)
                return (
                  <button
                    key={tmpl.id}
                    onClick={() => toggleTemplate(tmpl.id)}
                    className={`relative p-4 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-[#C4622D]/10 border-[#C4622D] ring-1 ring-[#C4622D]/50'
                        : 'bg-[#1A2332] border-[#2D4A3E]/30 hover:border-[#2D4A3E]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xl flex-shrink-0">{tmpl.emoji}</span>
                      <div className="min-w-0">
                        <h3 className="text-sm font-medium text-white truncate">
                          {locale === 'es' ? tmpl.nameEs : tmpl.name}
                        </h3>
                        <p className="text-[11px] text-gray-400 mt-1 line-clamp-2">
                          {locale === 'es' ? tmpl.descriptionEs : tmpl.description}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#C4622D] flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Navigation */}
            <div className="flex gap-3">
              <Button
                onClick={() => setStep(1)}
                variant="outline"
                className="border-[#2D4A3E] text-gray-300 hover:bg-[#2D4A3E]/20"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />{t('adf.back')}
              </Button>

              {promptsError && (
                <div className="flex-1 flex items-center gap-2 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4" /> {promptsError}
                </div>
              )}

              <Button
                onClick={generatePrompts}
                disabled={selectedTemplates.size === 0 || promptsLoading}
                className="flex-1 bg-gradient-to-r from-[#C4622D] to-[#E07A3A] hover:from-[#B5571F] hover:to-[#D06C2E] text-white disabled:opacity-40"
              >
                {promptsLoading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('adf.generating_prompts')}</>
                ) : (
                  <><Wand2 className="w-4 h-4 mr-2" />{t('adf.generate_prompts')} ({selectedTemplates.size})</>
                )}
              </Button>
            </div>
          </motion.div>
        )}

        {/* ═══════ STEP 4: Personalized Prompts ═══════ */}
        {step === 3 && (
          <motion.div
            key="step4"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <Card className="p-6 md:p-8 bg-[#1A2332] border-[#2D4A3E]/30 mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">{t('adf.prompts_ready')}</h2>
              </div>
              <p className="text-gray-400 text-sm mb-6">{t('adf.prompts_desc')}</p>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {prompts.map((p, idx) => (
                  <div key={p.templateId} className="bg-[#0F1419] rounded-lg border border-[#2D4A3E]/20">
                    <button
                      onClick={() => setExpandedPrompt(expandedPrompt === idx ? null : idx)}
                      className="w-full flex items-center justify-between p-3 text-left"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium text-white truncate">{p.templateName}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#2D4A3E]/40 text-gray-400">
                          {t(CATEGORY_KEYS[p.category] || p.category)}
                        </span>
                      </div>
                      {expandedPrompt === idx ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </button>
                    {expandedPrompt === idx && (
                      <div className="px-3 pb-3">
                        <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed bg-black/20 p-3 rounded-lg max-h-[200px] overflow-y-auto">{p.prompt}</pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            <div className="flex gap-3">
              <Button
                onClick={() => setStep(2)}
                variant="outline"
                className="border-[#2D4A3E] text-gray-300 hover:bg-[#2D4A3E]/20"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />{t('adf.back')}
              </Button>
              <Button
                onClick={() => generateImages()}
                className="flex-1 bg-gradient-to-r from-[#C4622D] to-[#E07A3A] hover:from-[#B5571F] hover:to-[#D06C2E] text-white"
              >
                <ImageIcon className="w-4 h-4 mr-2" />
                {t('adf.generate_all')} ({prompts.length})
              </Button>
            </div>
          </motion.div>
        )}

        {/* ═══════ STEP 5: Image Generation & Gallery ═══════ */}
        {step === 4 && (
          <motion.div
            key="step5"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            {/* Progress bar */}
            <Card className="p-4 bg-[#1A2332] border-[#2D4A3E]/30 mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-300">
                  {genRunning ? t('adf.generating') : t('adf.images_complete')}
                </span>
                <span className="text-sm text-white font-medium">
                  {doneCount}/{images.length}
                  {errorCount > 0 && <span className="text-red-400 ml-2">({errorCount} errors)</span>}
                </span>
              </div>
              <div className="w-full bg-[#0F1419] rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-[#C4622D] to-[#FFD700] transition-all duration-500"
                  style={{ width: `${images.length > 0 ? (doneCount / images.length) * 100 : 0}%` }}
                />
              </div>
            </Card>

            {/* Fallback warning */}
            {!genRunning && images.some(i => i.fallback) && (
              <Card className="p-4 bg-yellow-500/5 border-yellow-500/20 mb-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-yellow-300 font-medium">{t('adf.fallback_title')}</p>
                    <p className="text-xs text-yellow-400/70 mt-1">{t('adf.fallback_desc')}</p>
                  </div>
                </div>
              </Card>
            )}

            {/* Image grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
              {images.map((img, idx) => (
                <Card key={idx} className="overflow-hidden bg-[#1A2332] border-[#2D4A3E]/30">
                  {/* Image area */}
                  <div className="aspect-square relative bg-[#0F1419] flex items-center justify-center">
                    {img.status === 'done' && img.imageUrl ? (
                      <>
                        <img
                          src={img.imageUrl}
                          alt={img.templateName}
                          className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setLightboxImage({ url: img.imageUrl!, name: img.templateName })}
                          onError={() => {
                            // Image URL was returned but failed to load (broken/empty/CORS) — mark as error so user can retry
                            setImages(prev => prev.map((it, i) =>
                              i === idx ? { ...it, status: 'error', error: t('adf.image_load_failed') } : it
                            ))
                          }}
                        />
                        {selectedFavorites.has(idx) && (
                          <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center shadow-lg">
                            <Heart className="w-3.5 h-3.5 text-white fill-current" />
                          </div>
                        )}
                      </>
                    ) : img.status === 'generating' ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-8 h-8 text-[#C4622D] animate-spin" />
                        <span className="text-xs text-gray-400">{t('adf.generating')}</span>
                      </div>
                    ) : img.status === 'error' ? (
                      <div className="flex flex-col items-center gap-2 p-4">
                        <AlertCircle className="w-8 h-8 text-red-400" />
                        <span className="text-xs text-red-400 text-center">{img.error}</span>
                        <button
                          onClick={() => retrySingle(idx)}
                          className="text-xs text-[#C4622D] hover:underline flex items-center gap-1 mt-1"
                        >
                          <RotateCcw className="w-3 h-3" /> {t('adf.retry')}
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <ImageIcon className="w-8 h-8 text-gray-600" />
                        <span className="text-xs text-gray-500">{t('adf.pending')}</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <h3 className="text-xs font-medium text-white truncate">{img.templateName}</h3>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                          img.status === 'done' ? 'bg-emerald-500/10 text-emerald-400'
                          : img.status === 'generating' ? 'bg-[#C4622D]/10 text-[#C4622D]'
                          : img.status === 'error' ? 'bg-red-500/10 text-red-400'
                          : 'bg-gray-500/10 text-gray-500'
                        }`}>
                          {img.status === 'done' ? t('adf.generated')
                          : img.status === 'generating' ? t('adf.generating')
                          : img.status === 'error' ? t('adf.error')
                          : t('adf.pending')}
                        </span>
                        {img.status === 'done' && img.engine && (() => {
                          // Resolve actual model metadata: prefer model returned by API, fallback to current selection
                          // API returns 'route-llm' string for RouteLLM → map it to our catalog id 'default'
                          const rawId = img.model && img.model !== 'route-llm'
                            ? img.model
                            : (img.engine === 'routellm' ? 'default' : imageModel)
                          const meta = getImageModel(rawId)
                          const catColor = meta ? CATEGORY_LABELS[meta.category].color : '#9333EA'
                          const label = meta
                            ? `${meta.emoji} ${t(meta.labelKey)}`
                            : (img.engine === 'openrouter' ? '🔌 OpenRouter' : '⚡ RouteLLM')
                          return (
                            <span
                              className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                              style={{
                                backgroundColor: `${catColor}1A`,
                                color: catColor,
                              }}
                              title={meta ? meta.id : rawId}
                            >
                              {label}
                            </span>
                          )
                        })()}
                      </div>
                      {img.status === 'done' && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(idx) }}
                            className={`transition-all ${selectedFavorites.has(idx) ? 'text-red-500 scale-110' : 'text-gray-500 hover:text-red-400'}`}
                            title={selectedFavorites.has(idx) ? (locale === 'en' ? 'Remove from favorites' : 'Quitar de favoritos') : (locale === 'en' ? 'Add to favorites' : 'Agregar a favoritos')}
                          >
                            <Heart className={`w-4 h-4 ${selectedFavorites.has(idx) ? 'fill-current' : ''}`} />
                          </button>
                          {img.imageUrl && (
                            <a
                              href={img.imageUrl}
                              download={`ad-${img.templateName}.png`}
                              className="text-gray-400 hover:text-white transition-colors"
                              title={t('adf.download')}
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* ═══════ Favorites Bar & Save to Project ═══════ */}
            {!genRunning && doneCount > 0 && (
              <Card className="p-4 bg-[#1A2332] border-[#2D4A3E]/30 mb-4">
                {savedProjectName ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                        <Check className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{t('adf.saved_to_project')}</p>
                        <p className="text-xs text-gray-400">{savedProjectName} — {selectedFavorites.size} {t('adf.images_count')}</p>
                      </div>
                    </div>
                    <Button
                      onClick={() => window.location.href = '/dashboard/projects'}
                      className="bg-[#2D4A3E] hover:bg-[#2D4A3E]/80 text-white text-xs"
                    >
                      {t('adf.view_projects')}
                    </Button>
                  </motion.div>
                ) : (
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <Heart className={`w-5 h-5 ${selectedFavorites.size > 0 ? 'text-red-500 fill-current' : 'text-gray-500'}`} />
                      <div>
                        <p className="text-sm text-white font-medium">
                          {selectedFavorites.size > 0
                            ? `${selectedFavorites.size} ${selectedFavorites.size > 1 ? t('adf.images_selected_plural') : t('adf.images_selected')}`
                            : t('adf.select_favorites')}
                        </p>
                        <p className="text-[10px] text-gray-500">{t('adf.tap_heart')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={selectAllDone}
                        className="text-xs text-[#FFD700] hover:text-[#FFD700]/80 transition-colors"
                      >
                        {t('adf.select_all')}
                      </button>
                      {selectedFavorites.size > 0 && (
                        <>
                          <button
                            onClick={() => setSelectedFavorites(new Set())}
                            className="text-xs text-gray-500 hover:text-gray-400 transition-colors"
                          >
                            {t('adf.clear')}
                          </button>
                          <Button
                            onClick={saveFavoritesToProject}
                            disabled={savingProject}
                            className="bg-gradient-to-r from-[#C4622D] to-[#FFD700] hover:opacity-90 text-white text-xs px-4"
                          >
                            {savingProject ? (
                              <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> {t('adf.saving')}</>
                            ) : (
                              <><FolderPlus className="w-3 h-3 mr-1" /> {t('adf.save_to_project')}</>
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* Bottom actions */}
            <div className="flex gap-3">
              {!genRunning && (
                <Button
                  onClick={resetAll}
                  variant="outline"
                  className="border-[#2D4A3E] text-gray-300 hover:bg-[#2D4A3E]/20"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />{t('adf.new_campaign')}
                </Button>
              )}
              {genRunning && (
                <Button
                  onClick={() => { abortRef.current = true }}
                  variant="outline"
                  className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                >
                  <X className="w-4 h-4 mr-2" /> Stop
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════ Lightbox Modal ═══════ */}
      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setLightboxImage(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative max-w-4xl max-h-[90vh] w-full"
              onClick={e => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => setLightboxImage(null)}
                className="absolute -top-10 right-0 text-white/70 hover:text-white transition-colors z-10 flex items-center gap-1 text-sm"
              >
                <X className="w-5 h-5" /> ESC
              </button>

              {/* Image */}
              <img
                src={lightboxImage.url}
                alt={lightboxImage.name}
                className="w-full h-auto max-h-[80vh] object-contain rounded-xl shadow-2xl"
              />

              {/* Bottom bar */}
              <div className="flex items-center justify-between mt-3">
                <span className="text-white text-sm font-medium">{lightboxImage.name}</span>
                <div className="flex items-center gap-2">
                  {(() => {
                    const lbIdx = images.findIndex(img => img.imageUrl === lightboxImage.url)
                    if (lbIdx === -1) return null
                    const isFav = selectedFavorites.has(lbIdx)
                    return (
                      <button
                        onClick={e => { e.stopPropagation(); toggleFavorite(lbIdx) }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${isFav ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
                      >
                        <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                        {locale === 'en' ? 'Favorite' : 'Favorita'}
                      </button>
                    )
                  })()}
                  <a
                    href={lightboxImage.url}
                    download={`ad-${lightboxImage.name}.png`}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[#C4622D] hover:bg-[#B5571F] text-white text-sm rounded-lg transition-colors"
                    onClick={e => e.stopPropagation()}
                  >
                    <Download className="w-4 h-4" /> {t('adf.download')}
                  </a>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <FeedbackModal isOpen={showFeedback} onClose={() => setShowFeedback(false)} featureUsed={feedbackFeature} featureLabel={feedbackLabel} />
    </div>
  )
}