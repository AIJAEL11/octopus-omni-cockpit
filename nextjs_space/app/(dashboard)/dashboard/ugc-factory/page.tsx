'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSession } from 'next-auth/react'
import {
  Video,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  CheckCircle,
  Loader2,
  Image as ImageIcon,
  Download,
  RotateCcw,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Upload,
  Link2,
  Key,
  Play,
  Mic,
  Film,
  Wand2,
  Trash2,
  RefreshCw,
  Zap,
  Globe,
  Settings2,
  Check,
  Palette,
  CheckCircle2,
  AlertTriangle,
  Camera,
  Lightbulb,
  Heart,
  Edit3,
  Rocket,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n-context'
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
import {
  CINEMATIC_PRESETS,
  CAMERA_ANGLES,
  LIGHTING_SETUPS,
  MOOD_VIBES,
  getVideoPresets,
  getProductMockupPresets,
  type CinematicPreset,
} from '@/lib/cinematic-presets'

/* ─── Types ─── */
interface UgcKeys {
  ugc_kling_ak: { configured: boolean; maskedKey: string; status: string }
  ugc_kling_sk: { configured: boolean; maskedKey: string; status: string }
  ugc_elevenlabs: { configured: boolean; maskedKey: string; status: string }
  ugc_fal: { configured: boolean; maskedKey: string; status: string }
}

const STEPS = ['ugc.step1', 'ugc.step2', 'ugc.step3', 'ugc.step4_seedance', 'ugc.step5_final'] as const

const STEP_COLORS = [
  'from-purple-500 to-pink-500',
  'from-orange-500 to-amber-500',
  'from-blue-500 to-cyan-500',
  'from-green-500 to-emerald-500',
  'from-yellow-500 to-amber-500',
]

const STEP_ICONS = [Film, Upload, Wand2, Zap, CheckCircle]

const AVATAR_PRESETS = [
  { id: 'auto', labelKey: 'ugc.avatar_auto', emoji: '✨', desc: '' },
  { id: 'young_woman', labelKey: 'ugc.avatar_young_woman', emoji: '👩', desc: 'A young woman in her 20s, fresh and natural look, casual style' },
  { id: 'young_man', labelKey: 'ugc.avatar_young_man', emoji: '👨', desc: 'A young man in his 20s, clean-cut, approachable style' },
  { id: 'mature_woman', labelKey: 'ugc.avatar_mature_woman', emoji: '👩‍💼', desc: 'A woman in her 30s-40s, professional and elegant look' },
  { id: 'mature_man', labelKey: 'ugc.avatar_mature_man', emoji: '🧔', desc: 'A man in his 30s-40s, confident, well-groomed' },
  { id: 'latina', labelKey: 'ugc.avatar_latina', emoji: '💃', desc: 'A Latina woman, warm skin tone, dark hair, vibrant and expressive' },
  { id: 'athletic', labelKey: 'ugc.avatar_athletic', emoji: '💪', desc: 'An athletic, fit person with a sporty, energetic look' },
  { id: 'custom', labelKey: 'ugc.avatar_custom', emoji: '🎨', desc: '' },
]

const SEEDANCE_RESOLUTIONS = [
  { id: '480p', label: '480p — Rápido', cost: '~$0.25' },
  { id: '720p', label: '720p — Recomendado', cost: '~$0.52' },
  { id: '1080p', label: '1080p — Alta Calidad', cost: '~$1.20' },
]

/**
 * Seedance Models — exposed via fal.ai.
 * Each model has its own duration/feature matrix.
 */
type SeedanceModelId = 'seedance_1_5_pro' | 'seedance_2_0' | 'seedance_2_0_fast'

interface SeedanceModelSpec {
  id: SeedanceModelId
  label: string
  subtitle: string
  durations: number[]          // seconds allowed by the model
  defaultDuration: number
  costHint: string             // short cost hint per model
  tagline: string              // short tagline for UI
  badge?: string               // e.g. 'NEW', 'PRO'
  badgeColor?: string
}

const SEEDANCE_MODELS: SeedanceModelSpec[] = [
  {
    id: 'seedance_1_5_pro',
    label: 'Seedance 1.5 Pro',
    subtitle: 'Estable · lip sync probado',
    durations: [5, 8, 10, 12],
    defaultDuration: 10,
    costHint: '~$0.52 / 10s (720p)',
    tagline: 'Calidad cinematográfica con audio + lip sync sincronizado',
  },
  {
    id: 'seedance_2_0',
    label: 'Seedance 2.0 Pro',
    subtitle: 'Multi-shot · physics realista',
    durations: [4, 6, 8, 10, 12, 15],
    defaultDuration: 10,
    costHint: '~$0.65 / 10s (720p)',
    tagline: 'Next-gen: multi-shot, cámara director-level, hasta 15s',
    badge: 'NEW',
    badgeColor: 'from-amber-400 to-orange-500',
  },
  {
    id: 'seedance_2_0_fast',
    label: 'Seedance 2.0 Fast',
    subtitle: 'Barato · render rápido',
    durations: [4, 6, 8, 10, 12, 15],
    defaultDuration: 8,
    costHint: '~$0.30 / 10s (720p)',
    tagline: 'Mismo motor 2.0, optimizado para velocidad y costo',
    badge: 'FAST',
    badgeColor: 'from-cyan-400 to-blue-500',
  },
]

const getSeedanceModel = (id: string): SeedanceModelSpec =>
  SEEDANCE_MODELS.find(m => m.id === id) || SEEDANCE_MODELS[0]

export default function UgcFactoryPage() {
  const { data: session } = useSession() || {}
  const { t, locale } = useI18n()

  // ─── Session persistence helper ───
  const SS_KEY = 'ugc_factory_state_v2'
  const loadSaved = () => {
    if (typeof window === 'undefined') return null
    try {
      const raw = sessionStorage.getItem(SS_KEY)
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  }
  const saved = useRef(loadSaved()).current

  const [step, setStep] = useState(saved?.step ?? 0)

  // Step 0: Inspiration video
  const [videoUrl, setVideoUrl] = useState(saved?.videoUrl ?? '')
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoPreviewUrl, setVideoPreviewUrl] = useState(saved?.videoPreviewUrl ?? '')
  const [frameDescription, setFrameDescription] = useState(saved?.frameDescription ?? '')
  const [firstFrameUrl, setFirstFrameUrl] = useState(saved?.firstFrameUrl ?? '')
  const [extracting, setExtracting] = useState(false)

  // Step 1: Product images
  const [productImages, setProductImages] = useState<string[]>(saved?.productImages ?? [])
  const [productUrlInput, setProductUrlInput] = useState('')

  // Step 2: AI Model generation
  const [styleMode, setStyleMode] = useState<'realistic' | 'stylized'>(saved?.styleMode ?? 'realistic')
  const [avatarType, setAvatarType] = useState(saved?.avatarType ?? 'auto')
  const [customPrompt, setCustomPrompt] = useState(saved?.customPrompt ?? '')
  const [backgroundPrompt, setBackgroundPrompt] = useState(saved?.backgroundPrompt ?? '')
  const [imageModel, setImageModel] = useState<string>(saved?.imageModel ?? DEFAULT_IMAGE_MODEL_ID)
  const [hasOpenRouterKey, setHasOpenRouterKey] = useState<boolean | null>(null)
  const [generatedModelUrl, setGeneratedModelUrl] = useState(saved?.generatedModelUrl ?? '')
  const [generatingModel, setGeneratingModel] = useState(false)
  // Model actually used for the generation (returned by API) — used to show provenance badge
  const [generatedModelEngine, setGeneratedModelEngine] = useState<string>(saved?.generatedModelEngine ?? '')
  const [generatedModelId, setGeneratedModelId] = useState<string>(saved?.generatedModelId ?? '')

  // Skip Inspiration mode flag — when true, user goes straight to Cinematic Director
  const [skipInspiration, setSkipInspiration] = useState<boolean>(saved?.skipInspiration ?? false)

  // Step 3: Seedance — video + audio + lip sync in one
  const [script, setScript] = useState(saved?.script ?? '')
  // Auto-fill script with AI: optional business context + style
  const [bizContext, setBizContext] = useState(saved?.bizContext ?? '')
  const [scriptStyle, setScriptStyle] = useState<string>(saved?.scriptStyle ?? 'viral')
  const [generatingScript, setGeneratingScript] = useState(false)

  // ─── Cinematic Director state (only used when skipInspiration === true) ───
  const [cineTab, setCineTab] = useState<'presets' | 'custom' | 'review'>(saved?.cineTab ?? 'presets')
  const [selectedPresetId, setSelectedPresetId] = useState<string>(saved?.selectedPresetId ?? '')
  const [cineCamera, setCineCamera] = useState<string>(saved?.cineCamera ?? 'static_locked')
  const [cineLighting, setCineLighting] = useState<string>(saved?.cineLighting ?? 'studio_softbox')
  const [cineMood, setCineMood] = useState<string>(saved?.cineMood ?? 'epic_heroic')
  const [cineBrandName, setCineBrandName] = useState<string>(saved?.cineBrandName ?? '')
  const [cineProductDesc, setCineProductDesc] = useState<string>(saved?.cineProductDesc ?? '')
  const [cinematicPrompt, setCinematicPrompt] = useState<string>(saved?.cinematicPrompt ?? '')
  const [generatingCinematicPrompt, setGeneratingCinematicPrompt] = useState(false)
  // Separate dialogue field: what the avatar SAYS (lip sync) — independent of the visual cinematic prompt
  const [dialogue, setDialogue] = useState<string>(saved?.dialogue ?? '')
  const [generatingDialogue, setGeneratingDialogue] = useState(false)
  const [seedanceModel, setSeedanceModel] = useState<SeedanceModelId>(saved?.seedanceModel ?? 'seedance_1_5_pro')
  const [seedanceRes, setSeedanceRes] = useState(saved?.seedanceRes ?? '720p')
  const [seedanceDur, setSeedanceDur] = useState(saved?.seedanceDur ?? 10)
  const [seedanceLang, setSeedanceLang] = useState(saved?.seedanceLang ?? 'es')
  const [seedanceRequestId, setSeedanceRequestId] = useState(saved?.seedanceRequestId ?? '')
  const [seedanceStatusUrl, setSeedanceStatusUrl] = useState(saved?.seedanceStatusUrl ?? '')
  const [seedanceResponseUrl, setSeedanceResponseUrl] = useState(saved?.seedanceResponseUrl ?? '')
  const [seedanceStatus, setSeedanceStatus] = useState(saved?.seedanceStatus ?? '')
  const [seedanceVideoUrl, setSeedanceVideoUrl] = useState(saved?.seedanceVideoUrl ?? '')
  const [submittingSeedance, setSubmittingSeedance] = useState(false)

  // Persist state to sessionStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const state = {
        step, videoUrl, videoPreviewUrl, frameDescription, firstFrameUrl,
        productImages, styleMode, avatarType, customPrompt, backgroundPrompt, imageModel,
        generatedModelUrl, generatedModelEngine, generatedModelId,
        skipInspiration,
        cineTab, selectedPresetId, cineCamera, cineLighting, cineMood,
        cineBrandName, cineProductDesc, cinematicPrompt, dialogue,
        script, bizContext, scriptStyle,
        seedanceModel, seedanceRes, seedanceDur, seedanceLang,
        seedanceRequestId, seedanceStatusUrl, seedanceResponseUrl, seedanceStatus, seedanceVideoUrl,
      }
      sessionStorage.setItem(SS_KEY, JSON.stringify(state))
    } catch { /* quota exceeded, ignore */ }
  }, [step, videoUrl, videoPreviewUrl, frameDescription, firstFrameUrl,
      productImages, styleMode, avatarType, customPrompt, backgroundPrompt, imageModel,
      generatedModelUrl, generatedModelEngine, generatedModelId,
      skipInspiration,
      cineTab, selectedPresetId, cineCamera, cineLighting, cineMood,
      cineBrandName, cineProductDesc, cinematicPrompt, dialogue,
      script, bizContext, scriptStyle,
      seedanceModel, seedanceRes, seedanceDur, seedanceLang,
      seedanceRequestId, seedanceStatusUrl, seedanceResponseUrl, seedanceStatus, seedanceVideoUrl])

  // When the model changes, clamp the duration to what the model allows.
  useEffect(() => {
    const spec = getSeedanceModel(seedanceModel)
    if (!spec.durations.includes(seedanceDur)) {
      setSeedanceDur(spec.defaultDuration)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedanceModel])

  // When skipInspiration is enabled, auto-promote to Seedance 2.0 Pro (multi-shot, 15s max).
  useEffect(() => {
    if (skipInspiration && seedanceModel === 'seedance_1_5_pro') {
      setSeedanceModel('seedance_2_0')
      setSeedanceDur(15)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipInspiration])

  // When a preset is selected, auto-apply its recommended model and duration.
  useEffect(() => {
    if (!selectedPresetId) return
    const preset = CINEMATIC_PRESETS.find(p => p.id === selectedPresetId)
    if (!preset || preset.duration === null) return
    if (preset.recommendedModel === 'seedance_2_0' || preset.recommendedModel === 'seedance_2_0_fast') {
      setSeedanceModel(preset.recommendedModel)
    }
    // Clamp duration to model
    const spec = getSeedanceModel(preset.recommendedModel === 'static_image' ? seedanceModel : preset.recommendedModel)
    const targetDur = preset.duration
    if (spec.durations.includes(targetDur)) {
      setSeedanceDur(targetDur)
    } else {
      // Find closest allowed duration
      const closest = spec.durations.reduce((prev, curr) =>
        Math.abs(curr - targetDur) < Math.abs(prev - targetDur) ? curr : prev
      , spec.durations[0])
      setSeedanceDur(closest)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPresetId])

  // Check OpenRouter key on mount (shared with Ad Factory)
  useEffect(() => {
    fetch('/api/ad-factory/config')
      .then(r => r.json())
      .then(data => setHasOpenRouterKey(!!data.hasOpenRouterKey))
      .catch(() => setHasOpenRouterKey(false))
  }, [])

  // Resume Seedance polling if we had a job in progress
  useEffect(() => {
    if (seedanceRequestId && seedanceStatus === 'processing' && !seedanceVideoUrl) {
      startSeedancePolling(seedanceRequestId, seedanceStatusUrl, seedanceResponseUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // API Keys
  const [keysOpen, setKeysOpen] = useState(false)
  const [ugcKeys, setUgcKeys] = useState<UgcKeys | null>(null)
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({ ugc_kling_ak: '', ugc_kling_sk: '', ugc_elevenlabs: '', ugc_fal: '' })
  const [savingKey, setSavingKey] = useState('')

  // Error
  const [error, setError] = useState('')

  // Refs
  const videoInputRef = useRef<HTMLInputElement>(null)
  const productInputRef = useRef<HTMLInputElement>(null)
  const seedancePollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ─── Load API Keys ───
  const loadKeys = useCallback(async () => {
    try {
      const res = await fetch('/api/ugc-factory/keys')
      if (!res.ok) return
      const data = await res.json()
      const map: Record<string, { configured: boolean; maskedKey: string; status: string }> = {}
      for (const k of data.keys) {
        map[k.serviceType] = { configured: k.configured, maskedKey: k.maskedKey, status: k.status }
      }
      setUgcKeys(map as unknown as UgcKeys)
    } catch {}
  }, [])

  useEffect(() => { loadKeys() }, [loadKeys])

  // ─── Save API Key ───
  const saveKey = async (serviceType: string) => {
    const val = keyInputs[serviceType]
    if (!val.trim()) return
    setSavingKey(serviceType)
    try {
      const res = await fetch('/api/ugc-factory/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', serviceType, apiKey: val.trim() }),
      })
      if (res.ok) {
        setKeyInputs(prev => ({ ...prev, [serviceType]: '' }))
        loadKeys()
      }
    } catch {}
    setSavingKey('')
  }

  const deleteKey = async (serviceType: string) => {
    try {
      await fetch('/api/ugc-factory/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', serviceType }),
      })
      loadKeys()
    } catch {}
  }

  // ─── Step 0: Extract First Frame ───
  const [dragOverVideo, setDragOverVideo] = useState(false)

  const processVideoFile = (file: File) => {
    // Validación básica: debe ser video, máx 50MB (alineado con el texto del UI)
    if (!file.type.startsWith('video/')) {
      setError('El archivo debe ser un video (MP4, MOV, WebM)')
      return
    }
    const MAX_SIZE = 50 * 1024 * 1024 // 50MB
    if (file.size > MAX_SIZE) {
      setError(`El video excede el tamaño máximo (50MB). Tu archivo: ${(file.size / 1024 / 1024).toFixed(1)}MB`)
      return
    }
    setError('')
    setVideoFile(file)
    const url = URL.createObjectURL(file)
    setVideoPreviewUrl(url)
    setVideoUrl('')
  }

  const handleVideoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    processVideoFile(file)
    if (videoInputRef.current) videoInputRef.current.value = ''
  }

  const handleVideoDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverVideo(false)
    // 1) Archivos soltados desde el sistema
    const files = e.dataTransfer.files
    if (files.length > 0) {
      processVideoFile(files[0])
      return
    }
    // 2) URLs soltadas desde otra pestaña (drag del video/link)
    const droppedUrl =
      e.dataTransfer.getData('text/uri-list') ||
      e.dataTransfer.getData('text/plain')
    if (droppedUrl && droppedUrl.trim().startsWith('http')) {
      handleVideoUrl(droppedUrl.trim())
    }
  }

  const handleVideoUrl = (url: string) => {
    setVideoUrl(url)
    if (url.trim()) {
      setVideoPreviewUrl(url)
      setVideoFile(null)
    }
  }

  const extractFrame = async () => {
    setExtracting(true)
    setError('')
    try {
      let frameDataUrl = firstFrameUrl
      if (videoPreviewUrl && !frameDataUrl) {
        try {
          const video = document.createElement('video')
          video.crossOrigin = 'anonymous'
          video.src = videoPreviewUrl
          video.muted = true
          video.preload = 'auto'
          await new Promise<void>((resolve, reject) => {
            video.onloadeddata = () => resolve()
            video.onerror = () => reject(new Error('Video load failed'))
            setTimeout(() => resolve(), 8000)
          })
          video.currentTime = 0.1
          await new Promise<void>(resolve => {
            video.onseeked = () => resolve()
            setTimeout(() => resolve(), 3000)
          })
          const canvas = document.createElement('canvas')
          canvas.width = video.videoWidth || 720
          canvas.height = video.videoHeight || 1280
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            frameDataUrl = canvas.toDataURL('image/jpeg', 0.85)
            setFirstFrameUrl(frameDataUrl)
          }
        } catch (canvasErr) {
          console.warn('Canvas frame extraction failed:', canvasErr)
        }
      }

      const imageToAnalyze = frameDataUrl || videoUrl
      if (!imageToAnalyze) {
        setError('No se pudo extraer el frame. Sube el video o pega una URL directa al archivo.')
        setExtracting(false)
        return
      }

      const res = await fetch('/api/ugc-factory/extract-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl: imageToAnalyze }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errData.error || 'Error analyzing frame')
      }

      const data = await res.json()
      setFrameDescription(data.frameDescription)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error extracting frame')
    }
    setExtracting(false)
  }

  // ─── Step 1: Product Images ───
  const [dragOverProduct, setDragOverProduct] = useState(false)

  const processProductFiles = (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      const reader = new FileReader()
      reader.onload = (ev) => {
        const url = ev.target?.result as string
        if (url) setProductImages(prev => prev.length < 3 ? [...prev, url] : prev)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleProductFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    processProductFiles(files)
    if (productInputRef.current) productInputRef.current.value = ''
  }

  const handleProductDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverProduct(false)
    if (productImages.length >= 3) return
    const files = e.dataTransfer.files
    if (files.length > 0) processProductFiles(files)
    const droppedUrl = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')
    if (droppedUrl && droppedUrl.startsWith('http') && productImages.length < 3) {
      setProductImages(prev => prev.length < 3 ? [...prev, droppedUrl.trim()] : prev)
    }
  }

  const addProductUrl = () => {
    if (productUrlInput.trim() && productImages.length < 3) {
      setProductImages(prev => [...prev, productUrlInput.trim()])
      setProductUrlInput('')
    }
  }

  const removeProductImage = (idx: number) => {
    setProductImages(prev => prev.filter((_, i) => i !== idx))
  }

  // ─── Step 2: Generate AI Model ───
  const generateModel = async () => {
    setGeneratingModel(true)
    setError('')
    try {
      const avatarPreset = AVATAR_PRESETS.find(a => a.id === avatarType)
      const avatarDesc = avatarType === 'custom' ? customPrompt : (avatarPreset?.desc || '')

      const res = await fetch('/api/ugc-factory/generate-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frameDescription,
          firstFrameUrl: firstFrameUrl || undefined,
          productImages,
          avatarType,
          avatarDescription: avatarDesc || undefined,
          customPrompt: customPrompt || undefined,
          backgroundPrompt: backgroundPrompt || undefined,
          imageModel,
          styleMode,
          skipInspiration,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errData.error || 'Error generating model')
      }

      const data = await res.json()
      setGeneratedModelUrl(data.imageUrl)
      setGeneratedModelEngine(data.engine || '')
      setGeneratedModelId(data.model || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error generating model')
    }
    setGeneratingModel(false)
  }

  // ─── Step 3: Seedance — Generate Video + Audio + Lip Sync ───
  const generateSeedanceVideo = async () => {
    setSubmittingSeedance(true)
    setError('')
    try {
      // In Cinematic Director mode: cinematicPrompt = visual directions, dialogue = speech (lip sync)
      // In normal mode: script = both visual + dialogue (legacy behavior)
      const effectivePrompt = skipInspiration && cinematicPrompt.trim() ? cinematicPrompt : script
      const effectiveDialogue = skipInspiration ? (dialogue.trim() || script.trim()) : undefined
      const res = await fetch('/api/ugc-factory/seedance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: generatedModelUrl,
          prompt: effectivePrompt,
          dialogue: effectiveDialogue,
          duration: seedanceDur,
          resolution: seedanceRes,
          language: seedanceLang,
          model: seedanceModel,
          locale, // UI language for any user-facing error messages
        }),
      })

      if (!res.ok) {
        const unknownMsg = locale === 'es' ? 'Error desconocido' : 'Unknown error'
        const startMsg = locale === 'es' ? 'Error iniciando Seedance' : 'Error starting Seedance'
        const errData = await res.json().catch(() => ({ error: unknownMsg }))
        throw new Error(errData.error || startMsg)
      }

      const data = await res.json()
      setSeedanceRequestId(data.requestId)
      setSeedanceStatusUrl(data.statusUrl || '')
      setSeedanceResponseUrl(data.responseUrl || '')
      setSeedanceStatus('processing')
      startSeedancePolling(data.requestId, data.statusUrl || '', data.responseUrl || '', seedanceModel)
    } catch (err) {
      const fallback = locale === 'es' ? 'Error con Seedance' : 'Error with Seedance'
      setError(err instanceof Error ? err.message : fallback)
    }
    setSubmittingSeedance(false)
  }

  const startSeedancePolling = (requestId: string, sUrl?: string, rUrl?: string, modelId?: string) => {
    if (seedancePollRef.current) clearInterval(seedancePollRef.current)
    seedancePollRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/ugc-factory/seedance-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestId,
            statusUrl: sUrl || undefined,
            responseUrl: rUrl || undefined,
            model: modelId,
            locale, // UI language for any user-facing error messages
          }),
        })
        if (!res.ok) return
        const data = await res.json()
        setSeedanceStatus(data.status)
        if (data.status === 'completed') {
          setSeedanceVideoUrl(data.videoUrl || '')
          if (seedancePollRef.current) clearInterval(seedancePollRef.current)
        } else if (data.status === 'failed' || data.status === 'canceled') {
          const fallback = locale === 'es'
            ? 'La generación del video de Seedance falló. Inténtalo de nuevo.'
            : 'Seedance video generation failed. Please try again.'
          setError(data.error || fallback)
          if (seedancePollRef.current) clearInterval(seedancePollRef.current)
        }
      } catch {}
    }, 8000) // Poll every 8 seconds
  }

  // ─── Auto-fill script with AI ───
  const generateScriptAuto = async () => {
    setError('')
    setGeneratingScript(true)
    try {
      // Topic preference: business context > frame description (truncated) > undefined (fallback to OCTOPUS)
      const topic = bizContext.trim() || (frameDescription ? frameDescription.substring(0, 200).trim() : '')
      const res = await fetch('/api/ugc-factory/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic || undefined,
          style: scriptStyle,
          language: seedanceLang,
          duration: seedanceDur,
        }),
      })
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(txt || (locale === 'es' ? 'Error al generar guión' : 'Error generating script'))
      }
      const data = await res.json()
      if (data?.script) {
        setScript(data.script)
      } else {
        throw new Error(locale === 'es' ? 'Respuesta vacía del generador' : 'Empty response from generator')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : (locale === 'es' ? 'Error al generar guión' : 'Error generating script'))
    } finally {
      setGeneratingScript(false)
    }
  }

  // ─── Cinematic Director: Generate prompt from preset or custom config ───
  const generateCinematicPrompt = async (mode: 'preset' | 'custom') => {
    setError('')
    setGeneratingCinematicPrompt(true)
    try {
      const body: Record<string, unknown> = {
        mode,
        brandName: cineBrandName.trim() || 'BRAND',
        productDescription: cineProductDesc.trim() || (bizContext.trim() || 'product'),
        avatarDescription: customPrompt.trim() || 'a confident person',
        language: seedanceLang,
        duration: seedanceDur,
        productImageCount: productImages.length,
      }
      if (mode === 'preset') {
        if (!selectedPresetId) {
          throw new Error(locale === 'es' ? 'Selecciona un preset primero' : 'Select a preset first')
        }
        body.presetId = selectedPresetId
      } else {
        body.customConfig = { cameraId: cineCamera, lightingId: cineLighting, moodId: cineMood }
      }

      const res = await fetch('/api/ugc-factory/cinematic-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(txt || (locale === 'es' ? 'Error generando prompt cinemático' : 'Error generating cinematic prompt'))
      }
      const data = await res.json()
      if (data?.prompt) {
        setCinematicPrompt(data.prompt)
        // Do NOT mirror into script — the cinematic prompt is the VISUAL directions.
        // The script/dialogue field is for what the avatar SAYS (lip sync).
        // Auto-jump to Review tab so user can edit
        setCineTab('review')
      } else {
        throw new Error(locale === 'es' ? 'Respuesta vacía del director' : 'Empty response from director')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : (locale === 'es' ? 'Error generando prompt' : 'Error generating prompt'))
    } finally {
      setGeneratingCinematicPrompt(false)
    }
  }

  // ─── Clear only inspiration video & extracted frame (keeps everything else intact) ───
  const clearInspiration = () => {
    setVideoUrl('')
    setVideoFile(null)
    setVideoPreviewUrl('')
    setFrameDescription('')
    setFirstFrameUrl('')
    setError('')
    if (videoInputRef.current) videoInputRef.current.value = ''
  }

  // ─── Reset ───
  const resetAll = () => {
    setStep(0)
    setVideoUrl('')
    setVideoFile(null)
    setVideoPreviewUrl('')
    setFrameDescription('')
    setFirstFrameUrl('')
    setProductImages([])
    setProductUrlInput('')
    setCustomPrompt('')
    setBackgroundPrompt('')
    setGeneratedModelUrl('')
    setScript('')
    setDialogue('')
    setBizContext('')
    setScriptStyle('viral')
    setSeedanceRes('720p')
    setSeedanceDur(5)
    setSeedanceLang('es')
    setSeedanceRequestId('')
    setSeedanceStatusUrl('')
    setSeedanceResponseUrl('')
    setSeedanceStatus('')
    setSeedanceVideoUrl('')
    setSkipInspiration(false)
    setCineTab('presets')
    setSelectedPresetId('')
    setCineCamera('static_locked')
    setCineLighting('studio_softbox')
    setCineMood('epic_heroic')
    setCineBrandName('')
    setCineProductDesc('')
    setCinematicPrompt('')
    setError('')
    if (seedancePollRef.current) clearInterval(seedancePollRef.current)
    try { sessionStorage.removeItem(SS_KEY) } catch {}
  }

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (seedancePollRef.current) clearInterval(seedancePollRef.current)
    }
  }, [])

  // Final video URL
  const finalVideoUrl = seedanceVideoUrl

  // ─── Can proceed checks ───
  const canGoNext = () => {
    switch (step) {
      case 0: return skipInspiration ? true : !!frameDescription
      case 1: return productImages.length > 0
      case 2: return !!generatedModelUrl
      case 3: return !!seedanceVideoUrl
      default: return false
    }
  }

  // ─── Key service info (simplified — only fal.ai needed now) ───
  const KEY_SERVICES = [
    { type: 'ugc_fal', nameKey: 'ugc.fal_key', descKey: 'ugc.fal_desc', color: 'text-emerald-400', icon: Zap, placeholder: 'fal_key_...' },
    { type: 'ugc_kling_ak', nameKey: 'ugc.kling_key', descKey: 'ugc.kling_desc', color: 'text-green-400', icon: Play, placeholder: 'Access Key (AC8Y9ry...)' },
    { type: 'ugc_kling_sk', nameKey: 'ugc.kling_key', descKey: 'ugc.kling_desc', color: 'text-green-300', icon: Key, placeholder: 'Secret Key', customName: 'Kling AI — Secret Key' },
    { type: 'ugc_elevenlabs', nameKey: 'ugc.elevenlabs_key', descKey: 'ugc.elevenlabs_desc', color: 'text-pink-400', icon: Mic, placeholder: 'API Key...' },
  ]

  return (
    <div className="min-h-screen bg-[#0F1419] p-4 md:p-6">
      {/* Header */}
      <div className="max-w-5xl mx-auto mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Video className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{t('ugc.title')}</h1>
              <p className="text-sm text-gray-400">{t('ugc.subtitle')}</p>
            </div>
          </div>

          {/* API Keys Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setKeysOpen(!keysOpen)}
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            <Key className="w-4 h-4 mr-2" />
            API Keys
            {keysOpen ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
          </Button>
        </div>

        {/* Seedance Badge */}
        <div className="mt-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
            <Zap className="w-3 h-3" />
            Powered by {getSeedanceModel(seedanceModel).label}
          </span>
          <span className="text-xs text-gray-500">{t('ugc.seedance_tagline')}</span>
        </div>

        {/* API Keys Panel */}
        <AnimatePresence>
          {keysOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <Card className="mt-4 p-4 bg-[#1A2332] border-gray-700">
                <h3 className="text-sm font-semibold text-white mb-3">{t('ugc.api_keys_title')}</h3>
                <p className="text-xs text-gray-400 mb-4">{t('ugc.api_keys_desc')}</p>
                <div className="space-y-3">
                  {KEY_SERVICES.map(svc => {
                    const keyData = ugcKeys?.[svc.type as keyof UgcKeys]
                    const Icon = svc.icon
                    const displayName = ('customName' in svc && svc.customName) ? svc.customName : t(svc.nameKey)
                    return (
                      <div key={svc.type} className={`flex items-center gap-3 p-3 rounded-lg bg-[#0F1419] ${svc.type === 'ugc_fal' ? 'ring-1 ring-emerald-500/30' : ''}`}>
                        <Icon className={`w-5 h-5 ${svc.color}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white">{displayName}</span>
                            {svc.type === 'ugc_fal' && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">PRINCIPAL</span>
                            )}
                            {keyData?.configured ? (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                                {t('ugc.key_configured')}
                              </span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
                                {t('ugc.key_missing')}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">{t(svc.descKey)}</p>
                          {keyData?.configured && (
                            <p className="text-xs text-gray-500 font-mono mt-1">{keyData.maskedKey}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="password"
                            placeholder={keyData?.configured ? 'Replace...' : (svc.placeholder || 'Paste API key...')}
                            value={keyInputs[svc.type] || ''}
                            onChange={e => setKeyInputs(prev => ({ ...prev, [svc.type]: e.target.value }))}
                            className="w-48 text-xs px-3 py-1.5 rounded-md bg-[#1A2332] border border-gray-600 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                          />
                          <Button
                            size="sm"
                            onClick={() => saveKey(svc.type)}
                            disabled={!keyInputs[svc.type]?.trim() || savingKey === svc.type}
                            className="text-xs bg-purple-600 hover:bg-purple-700 text-white"
                          >
                            {savingKey === svc.type ? <Loader2 className="w-3 h-3 animate-spin" /> : t('ugc.key_save')}
                          </Button>
                          {keyData?.configured && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteKey(svc.type)}
                              className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Stepper */}
      <div className="max-w-5xl mx-auto mb-6">
        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => {
            const Icon = STEP_ICONS[i]
            const isActive = i === step
            const isDone = i < step
            return (
              <button
                key={s}
                onClick={() => isDone ? setStep(i) : undefined}
                className={`flex-1 flex items-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? `bg-gradient-to-r ${STEP_COLORS[i]} text-white shadow-lg`
                    : isDone
                    ? 'bg-gray-800 text-green-400 cursor-pointer hover:bg-gray-700'
                    : 'bg-gray-800/50 text-gray-500'
                }`}
              >
                {isDone ? (
                  <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                ) : (
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                )}
                <span className="hidden md:inline truncate">{t(s)}</span>
                <span className="md:hidden">{i + 1}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="max-w-5xl mx-auto mb-4"
          >
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{error}</span>
              <button onClick={() => setError('')} className="hover:text-red-300">
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Step Content */}
      <div className="max-w-5xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {/* ═══ STEP 0: Upload Inspiration Video ═══ */}
            {step === 0 && (
              <Card className="p-6 bg-[#1A2332] border-gray-700">
                {/* ─── DUAL-PATH SELECTOR: Inspiration Video vs Skip → Cinematic Director ─── */}
                <div className="mb-5">
                  <div className="grid sm:grid-cols-2 gap-3">
                    {/* PATH A: With inspiration video */}
                    <button
                      type="button"
                      onClick={() => setSkipInspiration(false)}
                      className={`text-left p-4 rounded-xl border transition-all ${
                        !skipInspiration
                          ? 'border-purple-500 bg-purple-500/10 ring-1 ring-purple-500/40'
                          : 'border-gray-700 bg-[#0F1419] hover:border-gray-500'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">🎬</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-sm font-bold ${!skipInspiration ? 'text-purple-300' : 'text-gray-200'}`}>
                              {t('ugc.path_inspiration_title')}
                            </span>
                            {!skipInspiration && <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />}
                          </div>
                          <p className="text-xs text-gray-400 leading-snug">
                            {t('ugc.path_inspiration_desc')}
                          </p>
                        </div>
                      </div>
                    </button>

                    {/* PATH B: Skip → Cinematic Director (NEW) */}
                    <button
                      type="button"
                      onClick={() => {
                        // Auto-clear inspiration video & frame so old memory doesn't bleed into the new flow
                        clearInspiration()
                        setSkipInspiration(true)
                      }}
                      className={`text-left p-4 rounded-xl border transition-all relative ${
                        skipInspiration
                          ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/40'
                          : 'border-gray-700 bg-[#0F1419] hover:border-gray-500'
                      }`}
                    >
                      <span className="absolute -top-1.5 -right-1.5 text-[9px] font-bold bg-gradient-to-r from-amber-400 to-orange-500 text-black px-1.5 py-0.5 rounded-md shadow-md">
                        NEW
                      </span>
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">🚀</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-sm font-bold ${skipInspiration ? 'text-amber-300' : 'text-gray-200'}`}>
                              {t('ugc.path_director_title')}
                            </span>
                            {skipInspiration && <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />}
                          </div>
                          <p className="text-xs text-gray-400 leading-snug">
                            {t('ugc.path_director_desc')}
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {skipInspiration ? (
                  /* ─── SKIP MODE: Cinematic Director intro splash ─── */
                  <div className="rounded-xl bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-yellow-500/10 border border-amber-500/30 p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Rocket className="w-5 h-5 text-amber-400" />
                      <h2 className="text-lg font-bold text-amber-300">{t('ugc.director_intro_title')}</h2>
                    </div>
                    <p className="text-sm text-gray-300 mb-4 leading-relaxed">{t('ugc.director_intro_desc')}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
                      <div className="p-2.5 rounded-lg bg-[#0F1419] border border-gray-700">
                        <div className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold mb-0.5">
                          {t('ugc.director_step_1_title')}
                        </div>
                        <div className="text-[11px] text-gray-300 leading-snug">
                          {t('ugc.director_step_1_desc')}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-[#0F1419] border border-gray-700">
                        <div className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold mb-0.5">
                          {t('ugc.director_step_2_title')}
                        </div>
                        <div className="text-[11px] text-gray-300 leading-snug">
                          {t('ugc.director_step_2_desc')}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-[#0F1419] border border-gray-700">
                        <div className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold mb-0.5">
                          {t('ugc.director_step_3_title')}
                        </div>
                        <div className="text-[11px] text-gray-300 leading-snug">
                          {t('ugc.director_step_3_desc')}
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() => setStep(1)}
                      className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-bold py-3"
                    >
                      <Rocket className="w-4 h-4 mr-2" />
                      {t('ugc.director_start_btn')}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                ) : (
                  /* ─── STANDARD MODE: Inspiration video upload (original) ─── */
                  <>

                <div className="flex items-center gap-2 mb-4">
                  <Film className="w-5 h-5 text-purple-400" />
                  <h2 className="text-lg font-bold text-white">{t('ugc.upload_video')}</h2>
                </div>
                <p className="text-sm text-gray-400 mb-6">{t('ugc.upload_video_desc')}</p>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Upload area */}
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">{t('ugc.or_paste_url')}</label>
                    <div className="flex gap-2 mb-4">
                      <input
                        type="text"
                        value={videoUrl}
                        onChange={e => handleVideoUrl(e.target.value)}
                        placeholder={t('ugc.paste_url_ph')}
                        className="flex-1 text-sm px-3 py-2 rounded-lg bg-[#0F1419] border border-gray-600 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-gray-600 text-gray-300"
                        onClick={() => videoUrl && setVideoPreviewUrl(videoUrl)}
                      >
                        <Link2 className="w-4 h-4" />
                      </Button>
                    </div>

                    <div
                      onClick={() => videoInputRef.current?.click()}
                      onDrop={handleVideoDrop}
                      onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragOverVideo(true) }}
                      onDragEnter={e => { e.preventDefault(); e.stopPropagation(); setDragOverVideo(true) }}
                      onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setDragOverVideo(false) }}
                      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                        dragOverVideo
                          ? 'border-purple-400 bg-purple-500/10 scale-[1.02] shadow-[0_0_30px_rgba(168,85,247,0.25)]'
                          : 'border-gray-600 hover:border-purple-500/50'
                      }`}
                    >
                      <Upload className={`w-8 h-8 mx-auto mb-2 transition-colors ${dragOverVideo ? 'text-purple-300' : 'text-gray-500'}`} />
                      <p className={`text-sm transition-colors ${dragOverVideo ? 'text-purple-200 font-medium' : 'text-gray-400'}`}>
                        {dragOverVideo ? 'Suelta el video aquí' : t('ugc.upload_video')}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">{t('ugc.upload_video_hint')}</p>
                    </div>
                    <input
                      ref={videoInputRef}
                      type="file"
                      accept="video/mp4,video/mov,video/webm,video/*"
                      className="hidden"
                      onChange={handleVideoFile}
                    />

                    {videoPreviewUrl && (
                      <div className="mt-4 space-y-2">
                        <Button
                          onClick={extractFrame}
                          disabled={extracting}
                          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                        >
                          {extracting ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('ugc.extracting')}</>
                          ) : (
                            <><Sparkles className="w-4 h-4 mr-2" /> {t('ugc.extract_frame')}</>
                          )}
                        </Button>
                        <Button
                          onClick={clearInspiration}
                          variant="outline"
                          size="sm"
                          className="w-full border-red-500/40 bg-red-500/5 text-red-300 hover:bg-red-500/15 hover:text-red-200"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1.5" /> {t('ugc.clear_inspiration_btn')}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Preview */}
                  <div>
                    {videoPreviewUrl ? (
                      <div className="space-y-4">
                        <video
                          src={videoPreviewUrl}
                          controls
                          className="w-full rounded-xl border border-gray-700 max-h-[300px] object-contain bg-black"
                        />
                        {firstFrameUrl && (
                          <div>
                            <p className="text-xs text-gray-400 mb-1">{t('ugc.frame_extracted')}</p>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={firstFrameUrl} alt="First frame" className="w-full rounded-lg border border-gray-700" />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full rounded-xl bg-[#0F1419] border border-gray-700">
                        <div className="text-center p-8">
                          <Film className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                          <p className="text-sm text-gray-500">{t('ugc.preview')}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Frame Description */}
                {frameDescription && (
                  <div className="mt-6 p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span className="text-sm font-medium text-green-400">{t('ugc.frame_extracted')}</span>
                      </div>
                      <Button
                        onClick={clearInspiration}
                        variant="outline"
                        size="sm"
                        className="border-red-500/40 bg-red-500/5 text-red-300 hover:bg-red-500/15 hover:text-red-200 h-7 px-2 text-[11px]"
                      >
                        <Trash2 className="w-3 h-3 mr-1" /> {t('ugc.clear_inspiration_short')}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-300 whitespace-pre-wrap max-h-32 overflow-y-auto">{frameDescription}</p>
                  </div>
                )}
                  </>
                )}
              </Card>
            )}

            {/* ═══ STEP 1: Product Images ═══ */}
            {step === 1 && (
              <Card className="p-6 bg-[#1A2332] border-gray-700">
                <div className="flex items-center gap-2 mb-4">
                  <ImageIcon className="w-5 h-5 text-orange-400" />
                  <h2 className="text-lg font-bold text-white">{t('ugc.product_images')}</h2>
                </div>
                <p className="text-sm text-gray-400 mb-6">{t('ugc.product_images_desc')}</p>

                {/* Cinematic Director progress banner */}
                {skipInspiration && (
                  <div className="mb-5 p-3 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 flex items-start gap-2.5">
                    <Rocket className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-[12px] leading-relaxed">
                      <span className="font-semibold text-amber-300">{t('ugc.cine_progress_step1_title')}</span>
                      <span className="text-amber-100/70"> · {t('ugc.cine_progress_step1_desc')}</span>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={productUrlInput}
                    onChange={e => setProductUrlInput(e.target.value)}
                    placeholder="https://graphicdesigneye.com/images/group-bundle-shots.jpg"
                    className="flex-1 text-sm px-3 py-2 rounded-lg bg-[#0F1419] border border-gray-600 text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
                    onKeyDown={e => e.key === 'Enter' && addProductUrl()}
                  />
                  <Button
                    size="sm"
                    onClick={addProductUrl}
                    disabled={!productUrlInput.trim() || productImages.length >= 3}
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    <Link2 className="w-4 h-4 mr-1" /> Add URL
                  </Button>
                </div>

                <div
                  onClick={() => productImages.length < 3 && productInputRef.current?.click()}
                  onDrop={handleProductDrop}
                  onDragOver={e => { e.preventDefault(); e.stopPropagation(); if (productImages.length < 3) setDragOverProduct(true) }}
                  onDragEnter={e => { e.preventDefault(); e.stopPropagation(); if (productImages.length < 3) setDragOverProduct(true) }}
                  onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setDragOverProduct(false) }}
                  className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                    productImages.length >= 3
                      ? 'border-gray-700 opacity-50'
                      : dragOverProduct
                        ? 'border-orange-400 bg-orange-500/10'
                        : 'border-gray-600 cursor-pointer hover:border-orange-500/50'
                  }`}
                >
                  <Upload className={`w-6 h-6 mx-auto mb-2 ${dragOverProduct ? 'text-orange-400' : 'text-gray-500'}`} />
                  <p className="text-sm text-gray-400">
                    {productImages.length >= 3
                      ? t('ugc.max_images')
                      : dragOverProduct
                        ? t('ugc.drop_here')
                        : t('ugc.drag_or_click')}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">JPG, PNG, WebP · {productImages.length}/3</p>
                </div>
                <input
                  ref={productInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleProductFile}
                />

                {productImages.length > 0 && (
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    {productImages.map((img, idx) => (
                      <div key={idx} className="relative group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img}
                          alt={`Product ${idx + 1}`}
                          className="w-full aspect-square object-cover rounded-lg border border-gray-700"
                        />
                        <button
                          onClick={() => removeProductImage(idx)}
                          className="absolute top-1 right-1 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {/* ═══ STEP 2: Generate AI Model ═══ */}
            {step === 2 && (
              <Card className="p-6 bg-[#1A2332] border-gray-700">
                <div className="flex items-center gap-2 mb-4">
                  <Wand2 className="w-5 h-5 text-blue-400" />
                  <h2 className="text-lg font-bold text-white">{t('ugc.generate_model')}</h2>
                </div>
                <p className="text-sm text-gray-400 mb-6">{t('ugc.model_desc')}</p>

                {/* Cinematic Director progress banner */}
                {skipInspiration && (
                  <div className="mb-5 p-3.5 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 flex items-start gap-2.5">
                    <Rocket className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-[12px] leading-relaxed flex-1">
                      <div className="font-semibold text-amber-300 mb-0.5">
                        {t('ugc.cine_progress_step2_title')}
                      </div>
                      <p className="text-amber-100/70">
                        {t('ugc.cine_progress_step2_desc')}
                      </p>
                    </div>
                    {generatedModelUrl && (
                      <Button
                        size="sm"
                        onClick={() => setStep(3)}
                        className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold whitespace-nowrap shrink-0"
                      >
                        <Rocket className="w-3.5 h-3.5 mr-1.5" /> {t('ugc.cine_advance_btn')}
                      </Button>
                    )}
                  </div>
                )}

                {/* Style Mode selector — Realistic vs Stylized */}
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Palette className="w-4 h-4 text-[#C4622D]" />
                    <label className="text-xs text-gray-300 font-medium">{t('ugc.style_mode_label')}</label>
                  </div>
                  <p className="text-[11px] text-gray-500 mb-3 leading-relaxed">{t('ugc.style_mode_desc')}</p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {/* REALISTIC card */}
                    <button
                      type="button"
                      onClick={() => setStyleMode('realistic')}
                      className={`text-left p-4 rounded-xl border transition-all ${
                        styleMode === 'realistic'
                          ? 'border-[#C4622D] bg-[#C4622D]/10 ring-1 ring-[#C4622D]/40'
                          : 'border-gray-700 bg-[#0F1419] hover:border-gray-500'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">🎬</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-sm font-bold ${styleMode === 'realistic' ? 'text-[#E8895A]' : 'text-gray-200'}`}>
                              {t('ugc.style_realistic_title')}
                            </span>
                            {styleMode === 'realistic' && (
                              <CheckCircle2 className="w-4 h-4 text-[#C4622D] shrink-0" />
                            )}
                          </div>
                          <div className={`text-[10px] uppercase tracking-wide font-semibold mb-1.5 ${
                            styleMode === 'realistic' ? 'text-[#C4622D]' : 'text-gray-500'
                          }`}>
                            {t('ugc.style_realistic_badge')}
                          </div>
                          <p className="text-xs text-gray-400 leading-snug">
                            {t('ugc.style_realistic_desc')}
                          </p>
                        </div>
                      </div>
                    </button>

                    {/* STYLIZED card */}
                    <button
                      type="button"
                      onClick={() => setStyleMode('stylized')}
                      className={`text-left p-4 rounded-xl border transition-all ${
                        styleMode === 'stylized'
                          ? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/40'
                          : 'border-gray-700 bg-[#0F1419] hover:border-gray-500'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">🎨</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-sm font-bold ${styleMode === 'stylized' ? 'text-emerald-300' : 'text-gray-200'}`}>
                              {t('ugc.style_stylized_title')}
                            </span>
                            {styleMode === 'stylized' && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            )}
                          </div>
                          <div className={`text-[10px] uppercase tracking-wide font-semibold mb-1.5 ${
                            styleMode === 'stylized' ? 'text-emerald-400' : 'text-gray-500'
                          }`}>
                            {t('ugc.style_stylized_badge')}
                          </div>
                          <p className="text-xs text-gray-400 leading-snug">
                            {t('ugc.style_stylized_desc')}
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* Warning banner about fal.ai content policy */}
                  <div className="mt-3 p-3 rounded-lg bg-amber-500/8 border border-amber-500/30 flex gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-[11px] leading-relaxed">
                      <span className="font-semibold text-amber-300">{t('ugc.style_warning_title')}: </span>
                      <span className="text-amber-100/80">{t('ugc.style_warning_body')}</span>
                    </div>
                  </div>
                </div>

                {/* Avatar selector */}
                <div className="mb-5">
                  <label className="text-xs text-gray-400 mb-2 block">{t('ugc.choose_avatar')}</label>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {AVATAR_PRESETS.map(a => (
                      <button
                        key={a.id}
                        onClick={() => setAvatarType(a.id)}
                        className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-xs transition-all ${
                          avatarType === a.id
                            ? 'border-blue-500 bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30'
                            : 'border-gray-700 bg-[#0F1419] text-gray-400 hover:border-gray-500 hover:text-gray-200'
                        }`}
                      >
                        <span className="text-xl">{a.emoji}</span>
                        <span className="text-[10px] leading-tight text-center">{t(a.labelKey)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">
                        {avatarType === 'custom' ? t('ugc.custom_avatar_label') : t('ugc.prompt_label')}
                      </label>
                      <textarea
                        value={customPrompt}
                        onChange={e => setCustomPrompt(e.target.value)}
                        placeholder={avatarType === 'custom' ? t('ugc.custom_avatar_ph') : t('ugc.prompt_ph')}
                        rows={3}
                        className="w-full text-sm px-3 py-2 rounded-lg bg-[#0F1419] border border-gray-600 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none resize-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">{t('ugc.background_label')}</label>
                      <textarea
                        value={backgroundPrompt}
                        onChange={e => setBackgroundPrompt(e.target.value)}
                        placeholder={t('ugc.background_ph')}
                        rows={2}
                        className="w-full text-sm px-3 py-2 rounded-lg bg-[#0F1419] border border-gray-600 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none resize-none"
                      />
                    </div>

                    {/* Image model selector — multi-provider grouped UI */}
                    <div>
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <Settings2 className="w-4 h-4 text-[#C4622D]" />
                          <label className="text-xs text-gray-300 font-medium">{t('ugc.image_model')}</label>
                        </div>
                        <span className="text-[10px] text-gray-500">{IMAGE_MODELS.length} {t('ugc.models_available')}</span>
                      </div>

                      {/* OpenRouter status */}
                      <div className="flex items-center gap-2 mb-3">
                        <Key className="w-3 h-3 text-gray-400" />
                        {hasOpenRouterKey ? (
                          <span className="text-[11px] text-emerald-400">{t('ugc.openrouter_ready')}</span>
                        ) : (
                          <span className="text-[11px] text-amber-400">
                            {t('ugc.openrouter_missing')} — <a href="/dashboard/settings" className="underline hover:text-amber-300">{t('ugc.needs_openrouter')}</a>
                          </span>
                        )}
                      </div>

                      {/* Models grouped by provider */}
                      <div className="space-y-3">
                        {CATEGORY_ORDER.map(cat => {
                          const modelsInCat = groupImageModels()[cat]
                          if (!modelsInCat || modelsInCat.length === 0) return null
                          const catMeta = CATEGORY_LABELS[cat]
                          return (
                            <div key={cat}>
                              <div className="flex items-center gap-2 mb-1.5">
                                <span
                                  className="inline-block w-1.5 h-1.5 rounded-full"
                                  style={{ backgroundColor: catMeta.color }}
                                />
                                <span
                                  className="text-[10px] font-semibold uppercase tracking-wider"
                                  style={{ color: catMeta.color }}
                                >
                                  {t(catMeta.labelKey)}
                                </span>
                              </div>
                              <div className="grid grid-cols-1 gap-1.5">
                                {modelsInCat.map((m: ImageModel) => {
                                  const isSelected = imageModel === m.id
                                  const disabled = m.needsKey && !hasOpenRouterKey
                                  const tierMeta = m.tier ? TIER_LABELS[m.tier] : null
                                  return (
                                    <button
                                      key={m.id}
                                      type="button"
                                      onClick={() => !disabled && setImageModel(m.id)}
                                      disabled={disabled}
                                      className={`p-2.5 rounded-lg border text-left text-xs transition-all relative group ${
                                        isSelected
                                          ? 'bg-[#C4622D]/10 border-[#C4622D] text-white shadow-[0_0_12px_rgba(196,98,45,0.2)]'
                                          : disabled
                                            ? 'bg-[#0F1419]/50 border-[#2D4A3E]/20 text-gray-500 cursor-not-allowed'
                                            : 'bg-[#0F1419] border-gray-700 text-gray-300 hover:border-[#C4622D]/60 hover:bg-[#1A2332]'
                                      }`}
                                    >
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
                                        {isSelected && <Check className="w-3.5 h-3.5 text-[#C4622D] flex-shrink-0 mt-0.5" />}
                                      </div>
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <Button
                      onClick={generateModel}
                      disabled={generatingModel}
                      className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white"
                    >
                      {generatingModel ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('ugc.generating_model')}</>
                      ) : (
                        <><Wand2 className="w-4 h-4 mr-2" /> {t('ugc.generate_model')}</>
                      )}
                    </Button>
                  </div>

                  <div>
                    {generatedModelUrl ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-400" />
                            <span className="text-sm font-medium text-green-400">{t('ugc.model_ready')}</span>
                          </div>
                          {(() => {
                            const usedId = generatedModelId && generatedModelId !== 'route-llm' ? generatedModelId : 'default'
                            const usedMeta = getImageModel(usedId)
                            if (!usedMeta) return null
                            return (
                              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#0F1419] border border-[#2D4A3E]/50 text-gray-400">
                                <span>{usedMeta.emoji}</span>
                                <span className="font-medium text-gray-300">{t(usedMeta.labelKey)}</span>
                              </span>
                            )
                          })()}
                        </div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={generatedModelUrl}
                          alt="AI Model"
                          className="w-full rounded-xl border border-gray-700"
                          onError={() => {
                            setError(t('ugc.model_load_failed'))
                            setGeneratedModelUrl('')
                          }}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={generateModel}
                          disabled={generatingModel}
                          className="border-gray-600 text-gray-300 hover:bg-gray-800"
                        >
                          <RefreshCw className="w-3.5 h-3.5 mr-1" /> {t('ugc.regenerate')}
                        </Button>
                      </div>
                    ) : generatingModel ? (
                      <div className="flex flex-col items-center justify-center h-full rounded-xl bg-[#0F1419] border border-gray-700 p-8">
                        <Loader2 className="w-10 h-10 text-blue-400 animate-spin mb-3" />
                        <p className="text-sm text-gray-400">{t('ugc.generating_model')}</p>
                        <p className="text-xs text-gray-500 mt-1">30-60 {t('ugc.seconds')}...</p>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full rounded-xl bg-[#0F1419] border border-gray-700">
                        <div className="text-center p-8">
                          <Wand2 className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                          <p className="text-sm text-gray-500">{t('ugc.preview')}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {/* ═══ STEP 3: Seedance — Video + Audio + Lip Sync ═══ */}
            {step === 3 && (
              <Card className="p-6 bg-[#1A2332] border-gray-700">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-lg font-bold text-white">{t('ugc.step4_seedance')}</h2>
                </div>
                <p className="text-sm text-gray-400 mb-6">{t('ugc.seedance_desc')}</p>

                {!ugcKeys?.ugc_fal?.configured && (
                  <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    <span>{t('ugc.fal_missing_warn')}</span>
                    <Button size="sm" onClick={() => setKeysOpen(true)} className="ml-auto bg-yellow-600 hover:bg-yellow-700 text-white text-xs">
                      <Key className="w-3 h-3 mr-1" /> {t('ugc.key_configure')}
                    </Button>
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Controls */}
                  <div className="space-y-4">
                    {/* ─── CINEMATIC DIRECTOR PANEL (only when skipInspiration === true) ─── */}
                    {skipInspiration && (
                      <div className="rounded-xl border border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-yellow-500/5 p-3 space-y-3">
                        <div className="flex items-center gap-2">
                          <Rocket className="w-4 h-4 text-amber-400" />
                          <span className="text-sm font-bold text-amber-300">{t('ugc.cinematic_director_title')}</span>
                        </div>
                        <p className="text-[11px] text-gray-400 leading-snug">{t('ugc.cinematic_director_desc')}</p>

                        {/* Brand + Product context (shared between presets and custom) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-gray-400 mb-1 block uppercase tracking-wide">
                              {t('ugc.cine_brand_label')}
                            </label>
                            <input
                              type="text"
                              value={cineBrandName}
                              onChange={e => setCineBrandName(e.target.value)}
                              placeholder={t('ugc.cine_brand_ph')}
                              className="w-full text-xs px-3 py-2 rounded-lg bg-[#0F1419] border border-gray-700 text-white placeholder-gray-600 focus:border-amber-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-400 mb-1 block uppercase tracking-wide">
                              {t('ugc.cine_product_label')}
                            </label>
                            <input
                              type="text"
                              value={cineProductDesc}
                              onChange={e => setCineProductDesc(e.target.value)}
                              placeholder={t('ugc.cine_product_ph')}
                              className="w-full text-xs px-3 py-2 rounded-lg bg-[#0F1419] border border-gray-700 text-white placeholder-gray-600 focus:border-amber-500 focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* TABS */}
                        <div className="flex gap-1 bg-[#0F1419] p-1 rounded-lg border border-gray-800">
                          {[
                            { id: 'presets' as const, label: t('ugc.cine_tab_presets'), icon: Film },
                            { id: 'custom' as const, label: t('ugc.cine_tab_custom'), icon: Settings2 },
                            { id: 'review' as const, label: t('ugc.cine_tab_review'), icon: Edit3 },
                          ].map(tab => {
                            const Icon = tab.icon
                            const isActive = cineTab === tab.id
                            return (
                              <button
                                key={tab.id}
                                onClick={() => setCineTab(tab.id)}
                                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                                  isActive
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                                }`}
                              >
                                <Icon className="w-3 h-3" />
                                <span>{tab.label}</span>
                              </button>
                            )
                          })}
                        </div>

                        {/* TAB 1: PRESETS */}
                        {cineTab === 'presets' && (
                          <div className="space-y-3">
                            {/* Video presets section */}
                            <div>
                              <div className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold mb-1.5">
                                {t('ugc.cine_video_presets')}
                              </div>
                              <div className="grid grid-cols-1 gap-1.5 max-h-72 overflow-y-auto pr-1">
                                {getVideoPresets().map(preset => {
                                  const isSelected = selectedPresetId === preset.id
                                  return (
                                    <button
                                      key={preset.id}
                                      onClick={() => setSelectedPresetId(preset.id)}
                                      className={`text-left p-2.5 rounded-lg border transition-all ${
                                        isSelected
                                          ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/30'
                                          : 'border-gray-700 bg-[#0F1419] hover:border-gray-500'
                                      }`}
                                    >
                                      <div className="flex items-start gap-2">
                                        <span className="text-xl shrink-0 leading-tight">{preset.emoji}</span>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                            <span className={`text-[12px] font-semibold ${isSelected ? 'text-amber-300' : 'text-gray-200'}`}>
                                              {preset.name}
                                            </span>
                                            {preset.duration !== null && (
                                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-mono">
                                                {preset.duration}s
                                              </span>
                                            )}
                                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">
                                              {preset.aspect}
                                            </span>
                                          </div>
                                          <p className="text-[10px] text-gray-400 leading-snug line-clamp-2">{preset.description}</p>
                                          <p className="text-[9px] text-amber-400/70 mt-1 italic">{preset.vibe}</p>
                                        </div>
                                      </div>
                                    </button>
                                  )
                                })}
                              </div>
                            </div>

                            {/* Product mockup section */}
                            <details className="group">
                              <summary className="cursor-pointer text-[10px] uppercase tracking-wider text-amber-400 font-semibold flex items-center gap-1.5 hover:text-amber-300">
                                <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" />
                                {t('ugc.cine_product_presets')} ({getProductMockupPresets().length})
                              </summary>
                              <div className="grid grid-cols-1 gap-1.5 mt-2 max-h-56 overflow-y-auto pr-1">
                                {getProductMockupPresets().map(preset => {
                                  const isSelected = selectedPresetId === preset.id
                                  return (
                                    <button
                                      key={preset.id}
                                      onClick={() => setSelectedPresetId(preset.id)}
                                      className={`text-left p-2.5 rounded-lg border transition-all ${
                                        isSelected
                                          ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/30'
                                          : 'border-gray-700 bg-[#0F1419] hover:border-gray-500'
                                      }`}
                                    >
                                      <div className="flex items-start gap-2">
                                        <span className="text-xl shrink-0 leading-tight">{preset.emoji}</span>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                            <span className={`text-[12px] font-semibold ${isSelected ? 'text-amber-300' : 'text-gray-200'}`}>
                                              {preset.name}
                                            </span>
                                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400">
                                              {t('ugc.cine_static_label')}
                                            </span>
                                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">
                                              {preset.aspect}
                                            </span>
                                          </div>
                                          <p className="text-[10px] text-gray-400 leading-snug line-clamp-2">{preset.description}</p>
                                          <p className="text-[9px] text-amber-400/70 mt-1 italic">{preset.vibe}</p>
                                        </div>
                                      </div>
                                    </button>
                                  )
                                })}
                              </div>
                            </details>

                            {/* Generate button */}
                            <Button
                              onClick={() => generateCinematicPrompt('preset')}
                              disabled={!selectedPresetId || generatingCinematicPrompt}
                              className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-bold text-xs"
                            >
                              {generatingCinematicPrompt ? (
                                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> {t('ugc.cine_generating')}</>
                              ) : (
                                <><Sparkles className="w-3.5 h-3.5 mr-1.5" /> {t('ugc.cine_generate_from_preset')}</>
                              )}
                            </Button>
                          </div>
                        )}

                        {/* TAB 2: CUSTOM BUILDER */}
                        {cineTab === 'custom' && (
                          <div className="space-y-3">
                            {/* Camera */}
                            <div>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <Camera className="w-3 h-3 text-amber-400" />
                                <label className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold">
                                  {t('ugc.cine_camera')}
                                </label>
                              </div>
                              <div className="grid grid-cols-2 gap-1.5">
                                {CAMERA_ANGLES.map(c => {
                                  const isActive = cineCamera === c.id
                                  return (
                                    <button
                                      key={c.id}
                                      onClick={() => setCineCamera(c.id)}
                                      className={`text-left p-2 rounded-lg border text-[10px] transition-all ${
                                        isActive
                                          ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                                          : 'border-gray-700 bg-[#0F1419] text-gray-400 hover:border-gray-500'
                                      }`}
                                    >
                                      <div className="flex items-center gap-1 font-semibold">
                                        <span>{c.emoji}</span>
                                        <span>{c.label}</span>
                                      </div>
                                      <div className="text-[9px] text-gray-500 mt-0.5">{c.hint}</div>
                                    </button>
                                  )
                                })}
                              </div>
                            </div>

                            {/* Lighting */}
                            <div>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <Lightbulb className="w-3 h-3 text-amber-400" />
                                <label className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold">
                                  {t('ugc.cine_lighting')}
                                </label>
                              </div>
                              <div className="grid grid-cols-2 gap-1.5">
                                {LIGHTING_SETUPS.map(l => {
                                  const isActive = cineLighting === l.id
                                  return (
                                    <button
                                      key={l.id}
                                      onClick={() => setCineLighting(l.id)}
                                      className={`text-left p-2 rounded-lg border text-[10px] transition-all ${
                                        isActive
                                          ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                                          : 'border-gray-700 bg-[#0F1419] text-gray-400 hover:border-gray-500'
                                      }`}
                                    >
                                      <div className="flex items-center gap-1 font-semibold">
                                        <span>{l.emoji}</span>
                                        <span>{l.label}</span>
                                      </div>
                                      <div className="text-[9px] text-gray-500 mt-0.5">{l.hint}</div>
                                    </button>
                                  )
                                })}
                              </div>
                            </div>

                            {/* Mood */}
                            <div>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <Heart className="w-3 h-3 text-amber-400" />
                                <label className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold">
                                  {t('ugc.cine_mood')}
                                </label>
                              </div>
                              <div className="grid grid-cols-2 gap-1.5">
                                {MOOD_VIBES.map(m => {
                                  const isActive = cineMood === m.id
                                  return (
                                    <button
                                      key={m.id}
                                      onClick={() => setCineMood(m.id)}
                                      className={`text-left p-2 rounded-lg border text-[10px] transition-all ${
                                        isActive
                                          ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                                          : 'border-gray-700 bg-[#0F1419] text-gray-400 hover:border-gray-500'
                                      }`}
                                    >
                                      <div className="flex items-center gap-1 font-semibold">
                                        <span>{m.emoji}</span>
                                        <span>{m.label}</span>
                                      </div>
                                      <div className="text-[9px] text-gray-500 mt-0.5">{m.hint}</div>
                                    </button>
                                  )
                                })}
                              </div>
                            </div>

                            {/* Generate button */}
                            <Button
                              onClick={() => generateCinematicPrompt('custom')}
                              disabled={generatingCinematicPrompt}
                              className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-bold text-xs"
                            >
                              {generatingCinematicPrompt ? (
                                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> {t('ugc.cine_generating')}</>
                              ) : (
                                <><Sparkles className="w-3.5 h-3.5 mr-1.5" /> {t('ugc.cine_generate_custom')}</>
                              )}
                            </Button>
                          </div>
                        )}

                        {/* TAB 3: REVIEW & EDIT */}
                        {cineTab === 'review' && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5">
                              <Edit3 className="w-3 h-3 text-amber-400" />
                              <label className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold">
                                {t('ugc.cine_review_label')}
                              </label>
                            </div>
                            <p className="text-[10px] text-gray-500 leading-snug">{t('ugc.cine_review_hint')}</p>
                            <textarea
                              value={cinematicPrompt}
                              onChange={e => {
                                setCinematicPrompt(e.target.value)
                              }}
                              placeholder={t('ugc.cine_review_ph')}
                              rows={14}
                              className="w-full text-[11px] font-mono px-3 py-2 rounded-lg bg-[#0F1419] border border-gray-700 text-gray-200 placeholder-gray-600 focus:border-amber-500 focus:outline-none resize-none leading-relaxed"
                            />
                            <div className="flex items-center justify-between text-[10px] text-gray-500">
                              <span>{cinematicPrompt.length} {t('ugc.chars')}</span>
                              {cinematicPrompt && (
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(cinematicPrompt)
                                  }}
                                  className="text-amber-400 hover:text-amber-300"
                                >
                                  📋 {t('ugc.cine_copy')}
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Script — with AI auto-fill */}
                    <div className="space-y-3">
                      {/* Auto-fill panel — hidden when skipInspiration mode is on (we use Cinematic Director instead) */}
                      {!skipInspiration && (
                      <div className="rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-pink-500/10 p-3 space-y-2.5">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-purple-400" />
                          <span className="text-xs font-semibold text-purple-300">{t('ugc.script_auto_title')}</span>
                        </div>

                        {/* Business / product context (optional) */}
                        <div>
                          <label className="text-[10px] text-gray-400 mb-1 block uppercase tracking-wide">
                            {t('ugc.biz_context_label')}
                          </label>
                          <input
                            type="text"
                            value={bizContext}
                            onChange={e => setBizContext(e.target.value)}
                            placeholder={t('ugc.biz_context_ph')}
                            className="w-full text-xs px-3 py-2 rounded-lg bg-[#0F1419] border border-gray-700 text-white placeholder-gray-600 focus:border-purple-500 focus:outline-none"
                          />
                        </div>

                        {/* Style picker + button */}
                        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
                          <div className="flex-1">
                            <label className="text-[10px] text-gray-400 mb-1 block uppercase tracking-wide">
                              {t('ugc.script_style_label')}
                            </label>
                            <select
                              value={scriptStyle}
                              onChange={e => setScriptStyle(e.target.value)}
                              className="w-full text-xs px-3 py-2 rounded-lg bg-[#0F1419] border border-gray-700 text-white focus:border-purple-500 focus:outline-none"
                            >
                              <option value="viral">🔥 {t('ugc.script_style_viral')}</option>
                              <option value="profesional">💼 {t('ugc.script_style_profesional')}</option>
                              <option value="divertido">😂 {t('ugc.script_style_divertido')}</option>
                              <option value="cinematic">🎬 {t('ugc.script_style_cinematic')}</option>
                              <option value="testimonial">⭐ {t('ugc.script_style_testimonial')}</option>
                              <option value="meme">🤪 {t('ugc.script_style_meme')}</option>
                              <option value="motivacional">💪 {t('ugc.script_style_motivacional')}</option>
                              <option value="educativo">🎓 {t('ugc.script_style_educativo')}</option>
                            </select>
                          </div>
                          <Button
                            onClick={generateScriptAuto}
                            disabled={generatingScript}
                            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs px-4 py-2 h-auto whitespace-nowrap"
                          >
                            {generatingScript ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                {t('ugc.script_auto_generating')}
                              </>
                            ) : (
                              <>
                                <Wand2 className="w-3.5 h-3.5 mr-1.5" />
                                {script.trim() ? t('ugc.script_auto_btn_regen') : t('ugc.script_auto_btn')}
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                      )}

                      {/* Script / Dialogue textarea */}
                      {skipInspiration ? (
                        /* ── Cinematic Director mode: separate DIALOGUE field ── */
                        <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <Mic className="w-4 h-4 text-emerald-400" />
                            <label className="text-xs font-semibold text-emerald-300">{t('ugc.dialogue_label')}</label>
                          </div>
                          <p className="text-[10px] text-gray-400 leading-snug">{t('ugc.dialogue_hint')}</p>
                          <textarea
                            value={dialogue}
                            onChange={e => setDialogue(e.target.value)}
                            placeholder={t('ugc.dialogue_ph')}
                            rows={4}
                            className="w-full text-sm px-3 py-2 rounded-lg bg-[#0F1419] border border-emerald-600/50 text-white placeholder-gray-500 focus:border-emerald-400 focus:outline-none resize-none"
                          />
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] text-gray-500">{dialogue.length} {t('ugc.chars')} · ~{Math.ceil(Math.max(dialogue.length, 1) / 15)}s</p>
                            <Button
                              onClick={async () => {
                                setGeneratingDialogue(true)
                                try {
                                  const res = await fetch('/api/ugc-factory/generate-script', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      topic: cineBrandName.trim() + ' ' + cineProductDesc.trim(),
                                      style: scriptStyle || 'viral',
                                      language: seedanceLang,
                                    }),
                                  })
                                  const data = await res.json()
                                  if (data?.script) setDialogue(data.script)
                                } catch { /* ignore */ }
                                setGeneratingDialogue(false)
                              }}
                              disabled={generatingDialogue}
                              size="sm"
                              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-[10px] px-3 py-1 h-auto"
                            >
                              {generatingDialogue ? (
                                <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> {t('ugc.script_auto_generating')}</>
                              ) : (
                                dialogue.trim() ? t('ugc.dialogue_auto_btn_regen') : t('ugc.dialogue_auto_btn')
                              )}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        /* ── Normal mode: classic script textarea ── */
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">{t('ugc.script_label')}</label>
                          <textarea
                            value={script}
                            onChange={e => setScript(e.target.value)}
                            placeholder={t('ugc.script_ph')}
                            rows={5}
                            className="w-full text-sm px-3 py-2 rounded-lg bg-[#0F1419] border border-gray-600 text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none resize-none"
                          />
                          <p className="text-xs text-gray-500 mt-1">{script.length} {t('ugc.chars')} · ~{Math.ceil(script.length / 15)}s</p>
                        </div>
                      )}
                    </div>

                    {/* Language */}
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">{t('ugc.language')}</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'es', label: '🇪🇸 Español', flag: '🇪🇸' },
                          { id: 'en', label: '🇺🇸 English', flag: '🇺🇸' },
                          { id: 'pt', label: '🇧🇷 Português', flag: '🇧🇷' },
                        ].map(l => (
                          <button
                            key={l.id}
                            onClick={() => setSeedanceLang(l.id)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors ${
                              seedanceLang === l.id
                                ? 'bg-emerald-600/20 border border-emerald-500 text-emerald-400'
                                : 'bg-[#0F1419] border border-gray-600 text-gray-400 hover:border-gray-500'
                            }`}
                          >
                            <Globe className="w-3 h-3" />
                            <span>{l.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Style Mode reminder hint */}
                    <div className={`p-2.5 rounded-lg border flex items-start gap-2 ${
                      styleMode === 'realistic'
                        ? 'bg-[#C4622D]/10 border-[#C4622D]/40'
                        : 'bg-emerald-500/10 border-emerald-500/40'
                    }`}>
                      <span className="text-base shrink-0 leading-tight">
                        {styleMode === 'realistic' ? '🎬' : '🎨'}
                      </span>
                      <div className="text-[11px] leading-snug">
                        <span className={`font-semibold ${styleMode === 'realistic' ? 'text-[#E8895A]' : 'text-emerald-300'}`}>
                          {styleMode === 'realistic' ? t('ugc.style_realistic_title') : t('ugc.style_stylized_title')}
                        </span>
                        <span className="text-gray-400"> — </span>
                        <span className="text-gray-300">
                          {styleMode === 'realistic' ? t('ugc.style_realistic_badge') : t('ugc.style_stylized_badge')}
                        </span>
                      </div>
                    </div>

                    {/* Seedance Model Selector — NEW */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs text-gray-400 block">Modelo Seedance</label>
                        <span className="text-[10px] text-gray-500">
                          {getSeedanceModel(seedanceModel).tagline}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {SEEDANCE_MODELS.map(m => {
                          const isActive = seedanceModel === m.id
                          return (
                            <button
                              key={m.id}
                              onClick={() => setSeedanceModel(m.id)}
                              className={`relative p-3 rounded-xl text-left transition-all border ${
                                isActive
                                  ? 'bg-emerald-600/15 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                                  : 'bg-[#0F1419] border-gray-600 hover:border-gray-500'
                              }`}
                            >
                              {m.badge && (
                                <span className={`absolute -top-1.5 -right-1.5 text-[8px] font-bold px-1.5 py-0.5 rounded-md text-black bg-gradient-to-r ${m.badgeColor ?? 'from-white to-gray-200'}`}>
                                  {m.badge}
                                </span>
                              )}
                              <div className={`text-[11px] font-semibold ${isActive ? 'text-emerald-300' : 'text-white'}`}>
                                {m.label}
                              </div>
                              <div className={`text-[10px] mt-0.5 ${isActive ? 'text-emerald-500/80' : 'text-gray-500'}`}>
                                {m.subtitle}
                              </div>
                              <div className={`text-[10px] mt-1.5 font-mono ${isActive ? 'text-emerald-400' : 'text-gray-400'}`}>
                                {m.costHint}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Resolution + Duration */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">{t('ugc.resolution')}</label>
                        <select
                          value={seedanceRes}
                          onChange={e => setSeedanceRes(e.target.value)}
                          className="w-full text-sm px-3 py-2 rounded-lg bg-[#0F1419] border border-gray-600 text-white focus:border-emerald-500 focus:outline-none"
                        >
                          {SEEDANCE_RESOLUTIONS.map(r => (
                            <option key={r.id} value={r.id}>{r.label} ({r.cost})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">
                          {t('ugc.duration')}
                          <span className="text-[10px] text-gray-500 ml-1">
                            (máx {Math.max(...getSeedanceModel(seedanceModel).durations)}s)
                          </span>
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {getSeedanceModel(seedanceModel).durations.map(d => (
                            <button
                              key={d}
                              onClick={() => setSeedanceDur(d)}
                              className={`flex-1 min-w-[44px] px-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                                seedanceDur === d
                                  ? 'bg-emerald-600/20 border border-emerald-500 text-emerald-400'
                                  : 'bg-[#0F1419] border border-gray-600 text-gray-400 hover:border-gray-500'
                              }`}
                            >
                              {d}s
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Generate button */}
                    <Button
                      onClick={generateSeedanceVideo}
                      disabled={submittingSeedance || seedanceStatus === 'processing' || !(skipInspiration ? (cinematicPrompt.trim() || dialogue.trim()) : script.trim()) || !ugcKeys?.ugc_fal?.configured}
                      className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white py-3"
                    >
                      {submittingSeedance || seedanceStatus === 'processing' ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('ugc.seedance_processing_with')} {getSeedanceModel(seedanceModel).label}...</>
                      ) : (
                        <><Zap className="w-4 h-4 mr-2" /> {t('ugc.generate_video_btn')}</>
                      )}
                    </Button>

                    {/* Cost estimate */}
                    <div className="p-3 rounded-lg bg-[#0F1419] border border-gray-700">
                      <p className="text-xs text-gray-400">
                        💰 {t('ugc.cost_estimate')}: <span className="text-emerald-400 font-medium">
                          {SEEDANCE_RESOLUTIONS.find(r => r.id === seedanceRes)?.cost || '~$0.52'} / {seedanceDur}s video
                        </span>
                      </p>
                      <p className="text-xs text-gray-500 mt-1">{t('ugc.seedance_includes')}</p>
                    </div>
                  </div>

                  {/* Preview / Result */}
                  <div>
                    {seedanceVideoUrl ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-400" />
                          <span className="text-sm font-medium text-green-400">{t('ugc.video_generated')}</span>
                        </div>
                        <video src={seedanceVideoUrl} controls className="w-full rounded-xl border border-gray-700" />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setSeedanceVideoUrl(''); setSeedanceRequestId(''); setSeedanceStatusUrl(''); setSeedanceResponseUrl(''); setSeedanceStatus('') }}
                          className="border-gray-600 text-gray-300 hover:bg-gray-800"
                        >
                          <RefreshCw className="w-3.5 h-3.5 mr-1" /> {t('ugc.regenerate')}
                        </Button>
                      </div>
                    ) : seedanceStatus === 'processing' ? (
                      <div className="flex flex-col items-center justify-center h-full rounded-xl bg-[#0F1419] border border-gray-700 p-8">
                        <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mb-3" />
                        <p className="text-sm text-gray-400">{t('ugc.seedance_processing_with')} {getSeedanceModel(seedanceModel).label}...</p>
                        <p className="text-xs text-gray-500 mt-1">{getSeedanceModel(seedanceModel).label} · ~1-3 min</p>
                        <div className="mt-3 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-xs text-emerald-400">ID: {seedanceRequestId?.slice(0, 12)}...</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Show the AI model image as context */}
                        {generatedModelUrl && (
                          <div>
                            <p className="text-xs text-gray-400 font-medium mb-2">{t('ugc.ai_model')}</p>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={generatedModelUrl} alt="AI Model" className="w-full rounded-xl border border-gray-700 max-h-[300px] object-contain" />
                          </div>
                        )}
                        <div className="flex items-center justify-center rounded-xl bg-[#0F1419] border border-gray-700 p-6">
                          <div className="text-center">
                            <Zap className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">{t('ugc.seedance_ready_hint')}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {/* ═══ STEP 4: Final Video ═══ */}
            {step === 4 && (
              <Card className="p-6 bg-[#1A2332] border-gray-700">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-500 to-amber-500 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">{t('ugc.video_ready')}</h2>
                  <p className="text-gray-400 mt-1">{t('ugc.video_ready_desc')}</p>
                </div>

                {finalVideoUrl ? (
                  <div className="max-w-md mx-auto space-y-4">
                    <video src={finalVideoUrl} controls className="w-full rounded-xl border border-gray-700 shadow-2xl" />
                    <div className="flex gap-3">
                      <a
                        href={finalVideoUrl}
                        download="ugc-video.mp4"
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-700 hover:to-amber-700 text-white font-medium transition-colors"
                      >
                        <Download className="w-5 h-5" />
                        {t('ugc.download_video')}
                      </a>
                      <Button
                        variant="outline"
                        onClick={resetAll}
                        className="border-gray-600 text-gray-300 hover:bg-gray-800 px-6"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        {t('ugc.new_video')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-8">
                    <p className="text-gray-400">{t('ugc.no_video_yet')}</p>
                  </div>
                )}

                {/* Pipeline summary */}
                <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: t('ugc.inspiration_video'), icon: Film, done: !!videoPreviewUrl, color: 'text-purple-400' },
                    { label: t('ugc.your_product'), icon: ImageIcon, done: productImages.length > 0, color: 'text-orange-400' },
                    { label: t('ugc.ai_model'), icon: Wand2, done: !!generatedModelUrl, color: 'text-blue-400' },
                    { label: 'Seedance Video', icon: Zap, done: !!seedanceVideoUrl, color: 'text-emerald-400' },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-3 rounded-lg bg-[#0F1419] border border-gray-700">
                      {item.done ? (
                        <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                      ) : (
                        <item.icon className={`w-4 h-4 ${item.color} flex-shrink-0`} />
                      )}
                      <span className="text-xs text-gray-300 truncate">{item.label}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <Button
            variant="outline"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('ugc.back')}
          </Button>

          {step < 4 && (
            <Button
              onClick={() => setStep(Math.min(4, step + 1))}
              disabled={!canGoNext()}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
            >
              {t('ugc.next')}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}