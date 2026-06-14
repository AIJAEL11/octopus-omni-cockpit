'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Wand2,
  Upload,
  Play,
  Download,
  Mic,
  MicOff,
  Loader2,
  ImagePlus,
  X,
  Sparkles,
  Volume2,
  VolumeX,
  RotateCcw,
  ChevronDown,
  Clock,
  Zap,
  Film,
  Info,
  Megaphone,
  Building2,
  Save,
  History,
  Pencil,
  Eye,
  Copy,
  ChevronRight,
  Rocket,
  Target,
  Users,
  FileText,
  MousePointerClick,
  Flame,
  CheckCircle,
  LayoutGrid,
  Music,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n-context'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import CampaignResultsPanel, { CampaignData, CampaignVideo } from '@/components/campaign-results-panel'
import { FeedbackModal, useFeedbackTrigger } from '@/components/feedback-modal'

interface VideoModel {
  id: string
  label: string
  provider: string
  supportsEndFrame: boolean
  supportsAudio: boolean
  defaultDuration: string
}

type GenerationStatus = 'idle' | 'uploading' | 'refining' | 'enhancing' | 'generating' | 'polling' | 'completed' | 'failed'

// --- Quick Templates ---
const QUICK_TEMPLATES = [
  {
    icon: '🎯',
    labelEn: 'Problem → Solution',
    labelEs: 'Problema → Solución',
    promptEn: 'Start with a dramatic close-up showing a frustrating problem situation. Slow zoom out revealing the chaos. Quick transition with a flash of light to a clean, organized solution. The product enters from the right with a smooth slide and subtle glow. Camera slowly orbits around the product hero shot. End with a satisfying click/snap motion as everything falls into place.',
    promptEs: 'Empieza con un close-up dramático mostrando una situación frustrante. Zoom out lento revelando el caos. Transición rápida con destello de luz hacia una solución limpia y organizada. El producto entra desde la derecha con slide suave y brillo sutil. La cámara orbita lentamente alrededor del producto hero. Termina con un movimiento de clic/snap satisfactorio donde todo encaja.',
  },
  {
    icon: '📱',
    labelEn: 'Product Demo',
    labelEs: 'Demo de Producto',
    promptEn: 'Cinematic product reveal: starts with a mysterious silhouette against a gradient background. Smooth 360-degree rotation with studio lighting. Camera pushes in to highlight key features with subtle particle effects. Each feature appears with a clean pop-up animation. Pull back to show the full product in context with lifestyle elements fading in around it.',
    promptEs: 'Reveal cinematográfico del producto: empieza con silueta misteriosa contra fondo gradiente. Rotación suave 360° con iluminación de estudio. La cámara se acerca para destacar features clave con partículas sutiles. Cada feature aparece con animación pop-up limpia. Se aleja para mostrar el producto completo en contexto con elementos lifestyle apareciendo alrededor.',
  },
  {
    icon: '⚡',
    labelEn: 'Before / After',
    labelEs: 'Antes / Después',
    promptEn: 'Split-screen transformation: left side shows the dull, outdated "before" state with desaturated colors and slow, heavy movements. A golden wipe transition sweeps from left to right, revealing the vibrant, modern "after" state with energetic motion, bright colors, and dynamic camera movement. End with a satisfying side-by-side comparison with a subtle pulse effect.',
    promptEs: 'Transformación en pantalla dividida: lado izquierdo muestra el estado "antes" opaco y anticuado con colores desaturados y movimientos lentos. Una transición dorada barre de izquierda a derecha, revelando el vibrante y moderno "después" con movimiento enérgico, colores brillantes y cámara dinámica. Termina con comparación lado a lado con efecto de pulso sutil.',
  },
  {
    icon: '💡',
    labelEn: 'Emotional Story',
    labelEs: 'Historia Emocional',
    promptEn: 'Wordless emotional narrative: open with a wide establishing shot in warm golden-hour lighting. Slow dolly in on a person experiencing a moment of struggle. Time-lapse transition from darkness to dawn. Close-up of hands reaching towards the light. Camera cranes up to reveal a beautiful panoramic view. Soft lens flare and gentle floating particles create a feeling of hope and transformation.',
    promptEs: 'Narrativa emocional sin palabras: apertura con plano general en iluminación dorada del atardecer. Dolly lento hacia una persona en un momento de lucha. Transición time-lapse de oscuridad a amanecer. Close-up de manos alcanzando la luz. La cámara sube en grúa revelando una vista panorámica hermosa. Lens flare suave y partículas flotantes crean sensación de esperanza y transformación.',
  },
  {
    icon: '🚀',
    labelEn: 'Feature Highlight',
    labelEs: 'Destacar Feature',
    promptEn: 'Dynamic feature showcase: starts with a fast-paced montage of the product in action. Quick cuts with motion blur transitions. Camera locks onto the key feature with a dramatic slow-motion zoom. Holographic UI elements animate around the feature with technical precision. Data points and metrics fly in with smooth easing. End with a powerful logo reveal using kinetic typography.',
    promptEs: 'Showcase dinámico de feature: empieza con montaje rápido del producto en acción. Cortes rápidos con transiciones de motion blur. La cámara se fija en el feature clave con zoom dramático en slow-motion. Elementos UI holográficos animan alrededor del feature con precisión técnica. Datos y métricas entran con easing suave. Termina con reveal potente del logo usando tipografía cinética.',
  },
  {
    icon: '📊',
    labelEn: 'Data Visualization',
    labelEs: 'Animación de Datos',
    promptEn: 'Animated data storytelling: numbers count up from zero with smooth easing on a dark background. Bar charts grow upward with a satisfying bounce effect. Pie chart segments slide in one by one with 3D depth. A line graph draws itself across the screen with a glowing trail. Camera pulls back to reveal the complete dashboard with all metrics pulsing gently. Particle effects connect the data points.',
    promptEs: 'Storytelling de datos animado: números cuentan desde cero con easing suave sobre fondo oscuro. Gráficos de barras crecen hacia arriba con efecto bounce satisfactorio. Segmentos de gráfico circular entran uno a uno con profundidad 3D. Un gráfico de líneas se dibuja solo con estela luminosa. La cámara se aleja revelando el dashboard completo con métricas pulsando suavemente. Efectos de partículas conectan los datos.',
  },
]

// --- Emotion Selector ---
const EMOTIONS = [
  { id: 'stress', icon: '😰', labelEn: 'Stress/Pain', labelEs: 'Estrés/Dolor', promptSuffix: 'Evoke a feeling of tension, discomfort and urgency to escape the current situation.' },
  { id: 'curiosity', icon: '🤩', labelEn: 'Curiosity', labelEs: 'Curiosidad', promptSuffix: 'Spark wonder and curiosity — make the viewer lean in and want to discover more.' },
  { id: 'urgency', icon: '⏰', labelEn: 'Urgency', labelEs: 'Urgencia', promptSuffix: 'Create a sense of urgency and FOMO — time is running out, act now.' },
  { id: 'desire', icon: '😍', labelEn: 'Desire', labelEs: 'Deseo', promptSuffix: 'Trigger desire and aspiration — the viewer should crave what they see.' },
  { id: 'empowerment', icon: '💪', labelEn: 'Empowerment', labelEs: 'Empoderamiento', promptSuffix: 'Inspire confidence and empowerment — make the viewer feel strong and capable.' },
  { id: 'humor', icon: '😂', labelEn: 'Humor', labelEs: 'Humor', promptSuffix: 'Add a touch of playfulness and humor — make the viewer smile or laugh.' },
]

// --- Variation suffixes ---
const VARIATION_SUFFIXES = [
  'Focus on speed, energy and dynamic camera movements.',
  'Focus on emotion, human connection and cinematic lighting.',
  'Focus on product detail, texture close-ups and technical precision.',
]

// Encode AudioBuffer to WAV
function encodeWAV(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = 1
  const sampleRate = buffer.sampleRate
  const bitsPerSample = 16
  const samples = buffer.getChannelData(0)
  const dataSize = samples.length * (bitsPerSample / 8)
  const totalSize = 44 + dataSize
  const ab = new ArrayBuffer(totalSize)
  const view = new DataView(ab)
  const writeStr = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)) }
  writeStr(0, 'RIFF'); view.setUint32(4, totalSize - 8, true); writeStr(8, 'WAVE')
  writeStr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true); view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true)
  view.setUint16(32, numChannels * (bitsPerSample / 8), true)
  view.setUint16(34, bitsPerSample, true); writeStr(36, 'data'); view.setUint32(40, dataSize, true)
  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
    offset += 2
  }
  return ab
}

// --- History item type ---
interface HistoryItem {
  id: string
  content: string
  prompt: string
  title: string
  metadata: string
  createdAt: string
}

export default function MotionGraphicsPage() {
  const { locale } = useI18n()
  const router = useRouter()
  const es = locale === 'es'

  // State
  const [startFrame, setStartFrame] = useState<string | null>(null)
  const [endFrame, setEndFrame] = useState<string | null>(null)
  const [startFrameUrl, setStartFrameUrl] = useState<string | null>(null)
  const [endFrameUrl, setEndFrameUrl] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('')
  const [selectedModel, setSelectedModel] = useState('veo-3.1')
  const [duration, setDuration] = useState('6')
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [generateAudio, setGenerateAudio] = useState(true)
  const [showModelPicker, setShowModelPicker] = useState(false)

  const [status, setStatus] = useState<GenerationStatus>('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [refinedPrompt, setRefinedPrompt] = useState('')
  const [error, setError] = useState('')

  // New feature state
  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [variationCount, setVariationCount] = useState(1)
  const [variationResults, setVariationResults] = useState<Array<{ videoUrl: string; label: string; prompt: string }>>([])
  const [enhancedPrompt, setEnhancedPrompt] = useState('')
  const [showEnhancedPrompt, setShowEnhancedPrompt] = useState(false)
  const [isEditingEnhanced, setIsEditingEnhanced] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [savingToProject, setSavingToProject] = useState(false)

  // Campaign Mode state
  const [campaignMode, setCampaignMode] = useState(false)
  const [campaignGoal, setCampaignGoal] = useState<'leads' | 'sell' | 'audience' | 'test'>('leads')
  const [campaignAudience, setCampaignAudience] = useState('')
  const [campaignData, setCampaignData] = useState<CampaignData | null>(null)
  const [campaignStep, setCampaignStep] = useState(0) // 0=idle 1=copies 2=videos 3=polling 4=done
  const [campaignStatusMsg, setCampaignStatusMsg] = useState('')
  const campaignPollingRef = useRef<NodeJS.Timeout | null>(null)

  // Audio Factory state (Standard Mode)
  const [showAudioFactory, setShowAudioFactory] = useState(false)
  const [afVoiceScript, setAfVoiceScript] = useState('')
  const [afVoiceProfile, setAfVoiceProfile] = useState<'cinematic_male' | 'professional_female' | 'deep_tech'>('cinematic_male')
  const [afMusicStyle, setAfMusicStyle] = useState<'ambient_tech' | 'upbeat_marketing' | 'cinematic_tension' | 'none'>('ambient_tech')
  const [afGenerating, setAfGenerating] = useState(false)
  const [afAudioResult, setAfAudioResult] = useState<{ voiceUrl: string; musicUrl: string; script: string } | null>(null)
  const [afMastering, setAfMastering] = useState(false)
  const [afMasterUrl, setAfMasterUrl] = useState<string | null>(null)
  const [afError, setAfError] = useState<string | null>(null)

  // Feedback
  const { showFeedback, setShowFeedback, feedbackFeature, feedbackLabel, triggerFeedback } = useFeedbackTrigger()

  // My Videos preview & select
  const [previewVideoId, setPreviewVideoId] = useState<string | null>(null)
  const [videoLoadedFromHistory, setVideoLoadedFromHistory] = useState(false)
  const [afSaving, setAfSaving] = useState(false)
  const [afSaved, setAfSaved] = useState(false)

  const handleAfGenerateAudio = useCallback(async () => {
    setAfGenerating(true)
    setAfError(null)
    setAfAudioResult(null)
    setAfMasterUrl(null)
    try {
      const res = await fetch('/api/motion-graphics/audio-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: afVoiceScript || undefined,
          voiceProfile: afVoiceProfile,
          musicStyle: afMusicStyle,
          videoPrompt: refinedPrompt || prompt,
          generateScript: !afVoiceScript,
        }),
      })
      const result = await res.json()
      if (result.error && !result.voiceUrl) {
        setAfError(result.error)
        if (result.script && !afVoiceScript) setAfVoiceScript(result.script)
      } else {
        setAfAudioResult({ voiceUrl: result.voiceUrl, musicUrl: result.musicUrl || '', script: result.script })
        if (result.script && !afVoiceScript) setAfVoiceScript(result.script)
        console.log('[Octopus] 🎙️ Audio Factory — voice ready')
      }
    } catch { setAfError('Failed to generate audio') } finally { setAfGenerating(false) }
  }, [afVoiceScript, afVoiceProfile, afMusicStyle, refinedPrompt, prompt])

  const handleAfMaster = useCallback(async () => {
    if (!videoUrl || !afAudioResult?.voiceUrl) return
    setAfMastering(true)
    setAfError(null)
    setAfMasterUrl(null)
    try {
      const res = await fetch('/api/motion-graphics/audio-master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl, voiceUrl: afAudioResult.voiceUrl, musicUrl: afAudioResult.musicUrl || undefined }),
      })
      const result = await res.json()
      if (result.success && result.masterUrl) {
        setAfMasterUrl(result.masterUrl)
        triggerFeedback('audio_factory', 'Audio Factory Master')
        console.log('[Octopus] ✅ Master video ready')
      } else { setAfError(result.error || 'Mastering failed') }
    } catch { setAfError('Failed to generate master') } finally { setAfMastering(false) }
  }, [videoUrl, afAudioResult])

  const handleAfSaveToStudio = useCallback(async () => {
    if (!afMasterUrl) return
    setAfSaving(true)
    try {
      const res = await fetch('/api/motion-graphics/save-master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterUrl: afMasterUrl,
          voiceScript: afVoiceScript,
          voiceProfile: afVoiceProfile,
          musicStyle: afMusicStyle,
          originalVideoUrl: videoUrl || '',
          prompt: refinedPrompt || prompt,
        }),
      })
      const data = await res.json()
      if (data.success) { setAfSaved(true); console.log('[Octopus] ✅ Saved to Creative Studio') }
      else { setAfError(data.error || 'Failed to save') }
    } catch { setAfError('Failed to save to Creative Studio') } finally { setAfSaving(false) }
  }, [afMasterUrl, afVoiceScript, afVoiceProfile, afMusicStyle, videoUrl, refinedPrompt, prompt])

  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const startInputRef = useRef<HTMLInputElement>(null)
  const endInputRef = useRef<HTMLInputElement>(null)

  const [models] = useState<VideoModel[]>([
    { id: 'veo-3.1', label: 'Veo 3.1', provider: 'Google', supportsEndFrame: false, supportsAudio: true, defaultDuration: '6' },
    { id: 'veo-3.1-first-last', label: 'Veo 3.1 Start+End', provider: 'Google', supportsEndFrame: true, supportsAudio: true, defaultDuration: '6' },
    { id: 'sora-2-pro', label: 'Sora 2 Pro', provider: 'OpenAI', supportsEndFrame: false, supportsAudio: true, defaultDuration: '5' },
    { id: 'kling-3.0-pro', label: 'Kling 3.0 Pro', provider: 'Kuaishou', supportsEndFrame: false, supportsAudio: true, defaultDuration: '5' },
    { id: 'kling-2.6-pro', label: 'Kling 2.6 Pro', provider: 'Kuaishou', supportsEndFrame: false, supportsAudio: false, defaultDuration: '5' },
    { id: 'kling-2.5-turbo', label: 'Kling 2.5 Turbo', provider: 'Kuaishou', supportsEndFrame: false, supportsAudio: false, defaultDuration: '5' },
    { id: 'kling-2.1-pro', label: 'Kling 2.1 Pro', provider: 'Kuaishou', supportsEndFrame: false, supportsAudio: false, defaultDuration: '5' },
    { id: 'seedance-1.5', label: 'Seedance 1.5 Pro', provider: 'ByteDance', supportsEndFrame: true, supportsAudio: true, defaultDuration: '5' },
    { id: 'hailuo-2.3', label: 'Hailuo 2.3 Fast', provider: 'MiniMax', supportsEndFrame: false, supportsAudio: false, defaultDuration: '6' },
    { id: 'hailuo-02', label: 'Hailuo-02', provider: 'MiniMax', supportsEndFrame: false, supportsAudio: false, defaultDuration: '6' },
    { id: 'wan-2.7', label: 'Wan 2.7', provider: 'Alibaba', supportsEndFrame: false, supportsAudio: false, defaultDuration: '5' },
    { id: 'pixverse-5.6', label: 'PixVerse v5.6', provider: 'PixVerse', supportsEndFrame: false, supportsAudio: false, defaultDuration: '5' },
  ])

  const currentModel = models.find(m => m.id === selectedModel) || models[0]

  // Load last completed motion graphic on mount
  useEffect(() => {
    const loadLastResult = async () => {
      try {
        const res = await fetch('/api/motion-graphics/history?limit=1')
        if (!res.ok) return
        const data = await res.json()
        if (data.asset?.content) {
          setVideoUrl(data.asset.content)
          setStatus('completed')
          setRefinedPrompt(data.asset.prompt || '')
          setStatusMsg(es ? '¡Último motion graphic generado!' : 'Last generated motion graphic!')
        }
      } catch { /* ignore */ }
    }
    loadLastResult()
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
      if (campaignPollingRef.current) clearInterval(campaignPollingRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Upload image helper
  const uploadImage = useCallback(async (file: File): Promise<string> => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/motion-graphics/upload', { method: 'POST', body: fd })
    const data = await res.json()
    if (!res.ok || !data.url) throw new Error(data.error || 'Upload failed')
    return data.url
  }, [])

  // Handle file selection
  const handleFileSelect = useCallback(async (file: File, type: 'start' | 'end') => {
    const localUrl = URL.createObjectURL(file)
    if (type === 'start') {
      setStartFrame(localUrl)
      setStartFrameUrl(null)
    } else {
      setEndFrame(localUrl)
      setEndFrameUrl(null)
    }

    try {
      const cloudUrl = await uploadImage(file)
      if (type === 'start') setStartFrameUrl(cloudUrl)
      else setEndFrameUrl(cloudUrl)
    } catch (err) {
      console.error('Upload error:', err)
      setError(es ? 'Error al subir imagen' : 'Image upload error')
    }
  }, [uploadImage, es])

  // Voice recording
  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop()
      setIsRecording(false)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : ''
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      audioChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType })
        if (blob.size < 1000) return

        setIsTranscribing(true)
        try {
          const arrayBuf = await blob.arrayBuffer()
          const audioCtx = new AudioContext()
          const decoded = await audioCtx.decodeAudioData(arrayBuf)
          const wavBuf = encodeWAV(decoded)
          audioCtx.close()

          const bytes = new Uint8Array(wavBuf)
          let binary = ''
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
          const base64 = btoa(binary)

          const res = await fetch('/api/voice-agent/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio: base64, language: locale, format: 'wav' }),
          })
          const data = await res.json()
          if (data.transcript) {
            setPrompt(prev => prev ? `${prev} ${data.transcript}` : data.transcript)
          }
        } catch (err) {
          console.error('[MoGraph STT] Error:', err)
        } finally {
          setIsTranscribing(false)
        }
      }

      mediaRecorderRef.current = recorder
      recorder.start()
      setIsRecording(true)
    } catch (err) {
      console.error('[MoGraph STT] Mic denied:', err)
    }
  }, [isRecording, locale])

  // Poll for status
  const startPolling = useCallback((requestId: string, model: string, statusUrl: string | null, responseUrl: string | null) => {
    if (pollingRef.current) clearInterval(pollingRef.current)
    let pollCount = 0
    const maxPolls = 180 // 180 × 5s = 15 min max wait

    pollingRef.current = setInterval(async () => {
      pollCount++
      if (pollCount > maxPolls) {
        if (pollingRef.current) clearInterval(pollingRef.current)
        setStatus('failed')
        setError(es ? 'Tiempo de espera agotado (15 min). Intenta de nuevo o usa un modelo más rápido.' : 'Timeout after 15 min. Try again or use a faster model.')
        return
      }

      try {
        const res = await fetch('/api/motion-graphics/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestId, model, statusUrl, responseUrl }),
        })
        const data = await res.json()

        if (data.status === 'COMPLETED' && data.videoUrl) {
          if (pollingRef.current) clearInterval(pollingRef.current)
          setVideoUrl(data.videoUrl)
          setStatus('completed')
          setStatusMsg(es ? '¡Motion graphic listo!' : 'Motion graphic ready!')
        } else if (data.status === 'CONTENT_REJECTED') {
          // Model refused to generate media (safety/prompt incompatibility)
          if (pollingRef.current) clearInterval(pollingRef.current)
          setStatus('failed')
          setError(data.error || (es ? 'El modelo rechazó el prompt. Reformula tu descripción e intenta de nuevo.' : 'The model rejected the prompt. Rephrase your description and try again.'))
        } else if (data.status === 'COMPLETED' && !data.videoUrl) {
          if (pollingRef.current) clearInterval(pollingRef.current)
          setStatus('failed')
          setError(data.error || (es ? 'Video completado pero URL no disponible. Intenta de nuevo.' : 'Video completed but URL unavailable. Please try again.'))
        } else if (data.status === 'FAILED') {
          if (pollingRef.current) clearInterval(pollingRef.current)
          setStatus('failed')
          setError(data.error || (es ? 'Error en la generación' : 'Generation failed'))
        } else {
          const position = data.queuePosition ? ` (#${data.queuePosition})` : ''
          // Progress: ramp slowly — 95% at ~60 polls (5 min), then hold
          const pct = Math.min(Math.round((pollCount / 60) * 95), 95)
          setStatusMsg(
            es
              ? `Generando... ${pct}%${position}`
              : `Generating... ${pct}%${position}`
          )
        }
      } catch {
        // Continue polling on network errors
      }
    }, 5000)
  }, [es])

  // --- AI Prompt Enhancer ---
  const handleEnhancePrompt = useCallback(async () => {
    if (!prompt.trim()) return
    setStatus('enhancing')
    setStatusMsg(es ? 'Mejorando prompt con IA...' : 'Enhancing prompt with AI...')
    try {
      // Build the full prompt with emotion context
      let fullPrompt = prompt.trim()
      const emotion = EMOTIONS.find(e => e.id === selectedEmotion)
      if (emotion) {
        fullPrompt += `\n\nEmotional direction: ${emotion.promptSuffix}`
      }
      const res = await fetch('/api/motion-graphics/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: 'enhance-only',
          rawPrompt: fullPrompt,
          enhanceOnly: true,
          language: locale,
        }),
      })
      const data = await res.json()
      if (data.refinedPrompt) {
        setEnhancedPrompt(data.refinedPrompt)
        setShowEnhancedPrompt(true)
        setIsEditingEnhanced(false)
      }
      setStatus('idle')
      setStatusMsg('')
    } catch {
      setStatus('idle')
      setStatusMsg('')
    }
  }, [prompt, selectedEmotion, locale, es])

  // --- Generate (single or multi-variation) ---
  const submitGeneration = useCallback(async (promptToSend: string, variationLabel?: string) => {
    const res = await fetch('/api/motion-graphics/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl: startFrameUrl,
        endFrameUrl: endFrameUrl || undefined,
        rawPrompt: promptToSend,
        model: selectedModel,
        duration,
        aspectRatio,
        generateAudio,
        language: locale,
        skipRefine: !!enhancedPrompt,
        emotion: selectedEmotion || undefined,
        template: selectedTemplate || undefined,
      }),
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Generation error')
    }
    return { ...data, variationLabel }
  }, [startFrameUrl, endFrameUrl, selectedModel, duration, aspectRatio, generateAudio, locale, enhancedPrompt, selectedEmotion, selectedTemplate])

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return
    if (!startFrameUrl) {
      setError(es ? '⚠️ Sube una imagen de referencia (Start Frame) para generar el video.' : '⚠️ Upload a reference image (Start Frame) to generate the video.')
      return
    }

    setError('')
    setVideoUrl(null)
    setRefinedPrompt('')
    setVariationResults([])
    setStatus('refining')
    setStatusMsg(es ? 'Preparando generación...' : 'Preparing generation...')

    // Build final prompt: use enhanced if available, otherwise raw + emotion
    let basePrompt = enhancedPrompt || prompt.trim()
    const emotion = EMOTIONS.find(e => e.id === selectedEmotion)
    if (!enhancedPrompt && emotion) {
      basePrompt += `\n\nEmotional direction: ${emotion.promptSuffix}`
    }

    try {
      if (variationCount === 1) {
        // Single generation
        const data = await submitGeneration(basePrompt)
        setRefinedPrompt(data.refinedPrompt || basePrompt)
        setStatus('polling')
        setStatusMsg(
          es
            ? `Enviado a ${data.modelLabel}. Generando video...`
            : `Submitted to ${data.modelLabel}. Generating video...`
        )
        startPolling(data.requestId, data.model, data.statusUrl, data.responseUrl)
      } else {
        // Multi-variation: fire N requests with variation suffixes
        setStatus('generating')
        setStatusMsg(
          es
            ? `Generando ${variationCount} variaciones...`
            : `Generating ${variationCount} variations...`
        )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const promises: Promise<any>[] = []
        for (let i = 0; i < variationCount; i++) {
          const varPrompt = `${basePrompt}\n\nVariation ${i + 1}: ${VARIATION_SUFFIXES[i]}`
          promises.push(submitGeneration(varPrompt, `V${i + 1}`))
        }

        const results = await Promise.allSettled(promises)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const successResults = results.filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')

        if (successResults.length === 0) {
          setStatus('failed')
          setError(es ? 'Todas las variaciones fallaron' : 'All variations failed')
          return
        }

        // Poll each variation
        setRefinedPrompt(successResults[0].value.refinedPrompt || basePrompt)
        setStatus('polling')
        setStatusMsg(
          es
            ? `Polling ${successResults.length} variaciones...`
            : `Polling ${successResults.length} variations...`
        )

        // For multi-variation, use a custom polling approach
        const pendingVariations = successResults.map(r => ({
          requestId: r.value.requestId,
          model: r.value.model,
          statusUrl: r.value.statusUrl,
          responseUrl: r.value.responseUrl,
          label: r.value.variationLabel || 'V1',
          prompt: r.value.refinedPrompt || basePrompt,
          done: false,
          videoUrl: null as string | null,
        }))

        if (pollingRef.current) clearInterval(pollingRef.current)
        let pollCount = 0
        pollingRef.current = setInterval(async () => {
          pollCount++
          if (pollCount > 180) {
            if (pollingRef.current) clearInterval(pollingRef.current)
            setStatus('failed')
            setError(es ? 'Timeout (15 min)' : 'Timeout (15 min)')
            return
          }

          for (const v of pendingVariations) {
            if (v.done) continue
            try {
              const res = await fetch('/api/motion-graphics/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestId: v.requestId, model: v.model, statusUrl: v.statusUrl, responseUrl: v.responseUrl }),
              })
              const data = await res.json()
              if (data.status === 'COMPLETED' && data.videoUrl) {
                v.done = true
                v.videoUrl = data.videoUrl
                setVariationResults(prev => [...prev, { videoUrl: data.videoUrl, label: v.label, prompt: v.prompt }])
              } else if (data.status === 'CONTENT_REJECTED' || (data.status === 'COMPLETED' && !data.videoUrl)) {
                v.done = true
              } else if (data.status === 'FAILED') {
                v.done = true
              }
            } catch { /* continue */ }
          }

          const allDone = pendingVariations.every(v => v.done)
          const completed = pendingVariations.filter(v => v.videoUrl)
          const pct = Math.min(Math.round((pollCount / 60) * 95), 95)
          setStatusMsg(
            es
              ? `Generando variaciones... ${completed.length}/${pendingVariations.length} listas — ${pct}%`
              : `Generating variations... ${completed.length}/${pendingVariations.length} ready — ${pct}%`
          )

          if (allDone) {
            if (pollingRef.current) clearInterval(pollingRef.current)
            if (completed.length > 0) {
              setVideoUrl(completed[0].videoUrl)
              setStatus('completed')
              setStatusMsg(es ? '¡Variaciones listas!' : 'Variations ready!')
            } else {
              setStatus('failed')
              setError(es ? 'No se pudo obtener ningún video' : 'Could not retrieve any video')
            }
          }
        }, 5000)
      }
    } catch (err) {
      console.error('[MoGraph] Generate error:', err)
      setStatus('failed')
      setError(err instanceof Error ? err.message : (es ? 'Error de conexión' : 'Connection error'))
    }
  }, [startFrameUrl, endFrameUrl, prompt, enhancedPrompt, selectedModel, duration, aspectRatio, generateAudio, locale, es, startPolling, submitGeneration, variationCount, selectedEmotion, selectedTemplate])

  // Download
  const handleDownload = useCallback(async (url?: string) => {
    const target = url || videoUrl
    if (!target) return
    try {
      const res = await fetch(target)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `motion-graphic-${Date.now()}.mp4`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
    } catch {
      window.open(target, '_blank')
    }
  }, [videoUrl])

  // Save to project
  const handleSaveToProject = useCallback(async () => {
    if (!videoUrl || savingToProject) return
    setSavingToProject(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Motion Graphic — ${new Date().toLocaleDateString()}`,
          description: refinedPrompt || prompt,
          projectType: 'motion-graphic',
        }),
      })
      if (res.ok) {
        setStatusMsg(es ? '¡Guardado en Mis Proyectos!' : 'Saved to My Projects!')
      }
    } catch { /* ignore */ }
    setSavingToProject(false)
  }, [videoUrl, refinedPrompt, prompt, es, savingToProject])

  // Load history
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const res = await fetch('/api/motion-graphics/history?limit=10')
      if (res.ok) {
        const data = await res.json()
        setHistoryItems(data.assets || [])
      }
    } catch { /* ignore */ }
    setHistoryLoading(false)
  }, [])

  const handleReset = () => {
    if (pollingRef.current) clearInterval(pollingRef.current)
    setStatus('idle')
    setStatusMsg('')
    setVideoUrl(null)
    setError('')
    setRefinedPrompt('')
    setEnhancedPrompt('')
    setShowEnhancedPrompt(false)
    setVariationResults([])
    setVideoLoadedFromHistory(false)
    // Reset Audio Factory
    setShowAudioFactory(false)
    setAfVoiceScript('')
    setAfAudioResult(null)
    setAfMasterUrl(null)
    setAfError(null)
    setAfSaved(false)
  }

  // Load a video from My Videos into the result area for Audio Factory
  const handleLoadVideoFromHistory = useCallback((item: HistoryItem) => {
    // Set the video in the result area
    setVideoUrl(item.content)
    setStatus('completed')
    setVideoLoadedFromHistory(true)
    // Set prompt context
    let meta: { rawPrompt?: string; model?: string } = {}
    try { meta = JSON.parse(item.metadata || '{}') } catch { /* */ }
    setRefinedPrompt(meta.rawPrompt || item.prompt || '')
    setPrompt(meta.rawPrompt || item.prompt || '')
    // Reset Audio Factory state for fresh start
    setShowAudioFactory(true)
    setAfVoiceScript('')
    setAfAudioResult(null)
    setAfMasterUrl(null)
    setAfError(null)
    setAfSaved(false)
    // Scroll to top of result
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // --- Campaign Mode: Generate full campaign ---
  const handleGenerateCampaign = useCallback(async () => {
    if (!prompt.trim()) return

    setError('')
    setVideoUrl(null)
    setRefinedPrompt('')
    setVariationResults([])
    setCampaignData(null)
    setCampaignStep(1)
    setCampaignStatusMsg(es ? 'Generando copys, CTAs y landing...' : 'Generating copies, CTAs & landing...')

    // Build final prompt
    let basePrompt = enhancedPrompt || prompt.trim()
    const emotion = EMOTIONS.find(e => e.id === selectedEmotion)
    if (!enhancedPrompt && emotion) {
      basePrompt += `\n\nEmotional direction: ${emotion.promptSuffix}`
    }

    try {
      // Step 1: Generate ad copies, CTAs, landing via campaign API
      const campaignRes = await fetch('/api/motion-graphics/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: basePrompt,
          goal: campaignGoal,
          audience: campaignAudience,
          language: locale,
        }),
      })
      const cData = await campaignRes.json()
      if (!campaignRes.ok || !cData.success) {
        throw new Error(cData.error || 'Campaign generation failed')
      }

      // Initialize campaign data with pending videos
      const initialVideos: CampaignVideo[] = [
        { variationIndex: 0, label: es ? 'V1 — Velocidad' : 'V1 — Speed', videoUrl: null, status: 'pending', prompt: `${basePrompt}\n\nVariation 1: ${VARIATION_SUFFIXES[0]}` },
        { variationIndex: 1, label: es ? 'V2 — Emoción' : 'V2 — Emotion', videoUrl: null, status: 'pending', prompt: `${basePrompt}\n\nVariation 2: ${VARIATION_SUFFIXES[1]}` },
        { variationIndex: 2, label: es ? 'V3 — Detalle' : 'V3 — Detail', videoUrl: null, status: 'pending', prompt: `${basePrompt}\n\nVariation 3: ${VARIATION_SUFFIXES[2]}` },
      ]

      const newCampaignData: CampaignData = {
        id: cData.campaignId,
        goal: campaignGoal,
        audience: campaignAudience,
        copies: cData.copies || [],
        ctas: cData.ctas || [],
        landing: cData.landing || { headline: '', subheadline: '', bullets: [], ctaText: '', socialProof: '' },
        videos: initialVideos,
        basePrompt,
      }
      setCampaignData(newCampaignData)

      // Step 2: Ensure we have a start frame — auto-generate if missing
      let effectiveStartFrameUrl = startFrameUrl
      if (!effectiveStartFrameUrl) {
        setCampaignStep(2)
        setCampaignStatusMsg(es ? '🎨 Generando imagen inicial con IA...' : '🎨 AI-generating start frame...')
        try {
          const frameRes = await fetch('/api/motion-graphics/generate-frame', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: basePrompt.split('\n')[0], language: locale }),
          })
          const frameData = await frameRes.json()
          if (frameRes.ok && frameData.success && frameData.imageUrl) {
            const generatedUrl = frameData.imageUrl as string
            // Validate the URL is publicly accessible (HTTP)
            if (!generatedUrl.startsWith('http')) {
              console.warn('[Campaign] Generated frame URL is not HTTP, discarding:', generatedUrl.substring(0, 50))
              effectiveStartFrameUrl = null
            } else {
              effectiveStartFrameUrl = generatedUrl
              console.log('[Campaign] Auto-generated start frame (public S3):', generatedUrl.substring(0, 80))
              // Allow S3 propagation delay
              setCampaignStatusMsg(es ? '⏳ Verificando imagen...' : '⏳ Verifying image...')
              await new Promise(r => setTimeout(r, 2000))
            }
          } else {
            console.warn('[Campaign] Could not auto-generate start frame:', frameData.error)
          }
        } catch (err) {
          console.warn('[Campaign] Auto-generate frame error:', err)
        }
      }

      if (!effectiveStartFrameUrl) {
        // Truly no image available — mark videos as skipped
        setCampaignData(prev => {
          if (!prev) return prev
          const updatedVideos = prev.videos.map(v => ({ ...v, status: 'failed' as const }))
          return { ...prev, videos: updatedVideos }
        })
        setCampaignStep(4)
        setCampaignStatusMsg(es
          ? '✅ Copys, CTAs y landing listos. No se pudo generar imagen — sube una para generar videos.'
          : '✅ Copies, CTAs & landing ready. Could not generate image — upload one for videos.')
      } else {
        setCampaignStep(2)

        // Validate both frame URLs
        const validStartFrame = effectiveStartFrameUrl
        const validEndFrame = endFrameUrl && endFrameUrl.startsWith('http') ? endFrameUrl : undefined
        if (validEndFrame) {
          console.log(`[Octopus] Multi-frame handshake ready for V1/V2/V3 — start: ${validStartFrame?.substring(0, 60)}, end: ${validEndFrame.substring(0, 60)}`)
        } else {
          console.log('[Octopus] Image successfully delivered to Video Engine:', validStartFrame?.substring(0, 80))
        }
        setCampaignStatusMsg(es ? 'Copys listos ✓ Lanzando 3 videos...' : 'Copies ready ✓ Launching 3 videos...')

        // Helper to launch 3 video requests
        const launchVideos = async (startUrl: string, endUrl?: string) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const reqs: Promise<any>[] = []
          for (let i = 0; i < 3; i++) {
            const varPrompt = `${basePrompt}\n\nVariation ${i + 1}: ${VARIATION_SUFFIXES[i]}`
            reqs.push(
              fetch('/api/motion-graphics/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  imageUrl: startUrl,
                  endFrameUrl: endUrl,
                  rawPrompt: varPrompt,
                  model: selectedModel,
                  duration,
                  aspectRatio,
                  generateAudio,
                  language: locale,
                  skipRefine: true,
                  emotion: selectedEmotion || undefined,
                  template: selectedTemplate || undefined,
                }),
              }).then(r => r.json()).then(d => ({ ...d, variationIndex: i }))
                .catch(() => ({ success: false, variationIndex: i }))
            )
          }
          return Promise.all(reqs)
        }

        let videoResults = await launchVideos(validStartFrame!, validEndFrame)

        // Fallback: if all 3 failed and we used dual frames, retry with single start frame only
        const allFailed = videoResults.every(r => !r.success)
        if (allFailed && validEndFrame) {
          console.warn('[Octopus] Multi-frame attempt failed for all 3 videos. Falling back to single start frame...')
          setCampaignStatusMsg(es ? '⚠️ Reintentando con solo Start Frame...' : '⚠️ Retrying with Start Frame only...')
          await new Promise(r => setTimeout(r, 1500))
          videoResults = await launchVideos(validStartFrame!, undefined)
        }
        const pendingPolls = videoResults.filter(r => r.success).map(r => ({
          variationIndex: r.variationIndex as number,
          requestId: r.requestId as string,
          model: r.model as string,
          statusUrl: r.statusUrl as string | null,
          responseUrl: r.responseUrl as string | null,
          done: false,
          videoUrl: null as string | null,
          failed: false,
        }))

        // Update videos status to polling
        setCampaignData(prev => {
          if (!prev) return prev
          const updatedVideos = prev.videos.map(v => {
            const poll = pendingPolls.find(p => p.variationIndex === v.variationIndex)
            return poll ? { ...v, status: 'polling' as const } : { ...v, status: 'failed' as const }
          })
          return { ...prev, videos: updatedVideos }
        })
        setCampaignStep(3)
        setCampaignStatusMsg(es ? '3 videos en cola. Polling...' : '3 videos queued. Polling...')

        // Step 3: Poll all videos
        if (campaignPollingRef.current) clearInterval(campaignPollingRef.current)
        let pollCount = 0
        campaignPollingRef.current = setInterval(async () => {
          pollCount++
          if (pollCount > 180) {
            if (campaignPollingRef.current) clearInterval(campaignPollingRef.current)
            setCampaignStep(4)
            setCampaignStatusMsg(es ? 'Timeout — algunos videos pueden no haberse completado' : 'Timeout — some videos may not have completed')
            return
          }

          for (const p of pendingPolls) {
            if (p.done) continue
            try {
              const res = await fetch('/api/motion-graphics/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestId: p.requestId, model: p.model, statusUrl: p.statusUrl, responseUrl: p.responseUrl }),
              })
              const data = await res.json()
              if (data.status === 'COMPLETED' && data.videoUrl) {
                p.done = true
                p.videoUrl = data.videoUrl
                setCampaignData(prev => {
                  if (!prev) return prev
                  const updatedVideos = prev.videos.map(v =>
                    v.variationIndex === p.variationIndex
                      ? { ...v, videoUrl: data.videoUrl, status: 'completed' as const }
                      : v
                  )
                  return { ...prev, videos: updatedVideos }
                })
              } else if (data.status === 'CONTENT_REJECTED' || (data.status === 'COMPLETED' && !data.videoUrl) || data.status === 'FAILED') {
                p.done = true
                p.failed = true
                setCampaignData(prev => {
                  if (!prev) return prev
                  const updatedVideos = prev.videos.map(v =>
                    v.variationIndex === p.variationIndex ? { ...v, status: 'failed' as const, errorMsg: data.error || undefined } : v
                  )
                  return { ...prev, videos: updatedVideos }
                })
              }
            } catch { /* continue */ }
          }

          const allDone = pendingPolls.every(p => p.done)
          const completedCount = pendingPolls.filter(p => p.videoUrl).length
          const pct = Math.min(Math.round((pollCount / 60) * 95), 95)
          setCampaignStatusMsg(
            es
              ? `Videos: ${completedCount}/3 listos — ${pct}%`
              : `Videos: ${completedCount}/3 ready — ${pct}%`
          )

          if (allDone) {
            if (campaignPollingRef.current) clearInterval(campaignPollingRef.current)
            setCampaignStep(4)
            setCampaignStatusMsg(es ? '¡Campaña completa!' : 'Campaign complete!')
          }
        }, 5000)
      }

    } catch (err) {
      console.error('[Campaign] Error:', err)
      setCampaignStep(0)
      setError(err instanceof Error ? err.message : (es ? 'Error en campaña' : 'Campaign error'))
    }
  }, [startFrameUrl, endFrameUrl, prompt, enhancedPrompt, selectedModel, duration, aspectRatio, generateAudio, locale, es, campaignGoal, campaignAudience, selectedEmotion, selectedTemplate])

  const handleCampaignReset = useCallback(() => {
    if (campaignPollingRef.current) clearInterval(campaignPollingRef.current)
    setCampaignData(null)
    setCampaignStep(0)
    setCampaignStatusMsg('')
    setError('')
  }, [])

  const [regeneratingVideos, setRegeneratingVideos] = useState(false)
  const [manualFrameOverride, setManualFrameOverride] = useState<string | null>(null)
  const [uploadingManualFrame, setUploadingManualFrame] = useState(false)

  const handleManualFrameUpload = useCallback(async (file: File) => {
    setUploadingManualFrame(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/motion-graphics/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (res.ok && data.url && data.url.startsWith('http')) {
        setManualFrameOverride(data.url)
        setStartFrameUrl(data.url)
        setCampaignStatusMsg(es ? '✅ Imagen subida. Ahora pulsa "Regenerar Solo Videos".' : '✅ Image uploaded. Now click "Regenerate Videos Only".')
        console.log('[Octopus] Manual frame uploaded:', data.url)
      } else {
        setError(es ? '⚠️ Error al subir imagen' : '⚠️ Image upload failed')
      }
    } catch {
      setError(es ? '⚠️ Error al subir imagen' : '⚠️ Image upload failed')
    } finally {
      setUploadingManualFrame(false)
    }
  }, [es])

  const handleRegenerateVideos = useCallback(async () => {
    if (!campaignData || regeneratingVideos) return

    setRegeneratingVideos(true)
    setCampaignStatusMsg(es ? '🔄 Regenerando videos...' : '🔄 Regenerating videos...')

    const basePrompt = campaignData.basePrompt

    // Get or generate a start frame (with manual upload fallback)
    let imgUrl = manualFrameOverride || startFrameUrl
    if (manualFrameOverride) {
      console.log('[Octopus] Using manual frame override for regeneration:', manualFrameOverride)
      setManualFrameOverride(null)
    }
    if (!imgUrl) {
      setCampaignStatusMsg(es ? '🎨 Generando imagen inicial con IA...' : '🎨 AI-generating start frame...')
      try {
        const frameRes = await fetch('/api/motion-graphics/generate-frame', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: basePrompt.split('\n')[0], language: locale }),
        })
        const frameData = await frameRes.json()
        if (frameRes.ok && frameData.success && frameData.imageUrl) {
          imgUrl = frameData.imageUrl
        }
      } catch { /* continue */ }
    }

    // Validate the image URL is a public HTTP URL
    if (imgUrl && !imgUrl.startsWith('http')) {
      console.warn('[Octopus] Regenerate: discarding non-HTTP image URL, len=', imgUrl.length)
      imgUrl = ''
    }

    if (!imgUrl) {
      setError(es ? '⚠️ No se pudo generar la imagen. Usa "Subir imagen manual" e intenta de nuevo.' : '⚠️ Could not generate image. Use "Upload manual image" and try again.')
      setRegeneratingVideos(false)
      return
    }

    // Wait 2s for S3 propagation
    setCampaignStatusMsg(es ? '⏳ Verificando imagen...' : '⏳ Verifying image...')
    await new Promise(r => setTimeout(r, 2000))

    // Validate both frame URLs
    const validEndFrame = endFrameUrl && endFrameUrl.startsWith('http') ? endFrameUrl : undefined
    if (validEndFrame) {
      console.log(`[Octopus] Multi-frame handshake ready for V1/V2/V3 — start: ${imgUrl.substring(0, 60)}, end: ${validEndFrame.substring(0, 60)}`)
    } else {
      console.log('[Octopus] Image successfully delivered to Video Engine:', imgUrl)
    }

    // Reset video statuses to pending
    setCampaignData(prev => {
      if (!prev) return prev
      return {
        ...prev,
        videos: prev.videos.map(v => ({ ...v, status: 'pending' as const, videoUrl: null })),
      }
    })
    setCampaignStatusMsg(es ? 'Lanzando 3 videos...' : 'Launching 3 videos...')

    try {
      // Helper to launch 3 video requests
      const launchRegenVideos = async (startUrl: string, endUrl?: string) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const reqs: Promise<any>[] = []
        for (let i = 0; i < 3; i++) {
          const varPrompt = `${basePrompt}\n\nVariation ${i + 1}: ${VARIATION_SUFFIXES[i]}`
          reqs.push(
            fetch('/api/motion-graphics/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                imageUrl: startUrl,
                endFrameUrl: endUrl,
                rawPrompt: varPrompt,
                model: selectedModel,
                duration,
                aspectRatio,
                generateAudio,
                language: locale,
                skipRefine: true,
                emotion: selectedEmotion || undefined,
                template: selectedTemplate || undefined,
              }),
            }).then(r => r.json()).then(d => ({ ...d, variationIndex: i }))
              .catch(() => ({ success: false, variationIndex: i }))
          )
        }
        return Promise.all(reqs)
      }

      let videoResults = await launchRegenVideos(imgUrl, validEndFrame)

      // Fallback: if all 3 failed and we used dual frames, retry with single start frame
      const allRegenFailed = videoResults.every(r => !r.success)
      if (allRegenFailed && validEndFrame) {
        console.warn('[Octopus] Multi-frame regeneration failed. Falling back to single start frame...')
        setCampaignStatusMsg(es ? '⚠️ Reintentando con solo Start Frame...' : '⚠️ Retrying with Start Frame only...')
        await new Promise(r => setTimeout(r, 1500))
        videoResults = await launchRegenVideos(imgUrl, undefined)
      }
      const pendingPolls = videoResults.filter(r => r.success).map(r => ({
        variationIndex: r.variationIndex as number,
        requestId: r.requestId as string,
        model: r.model as string,
        statusUrl: r.statusUrl as string | null,
        responseUrl: r.responseUrl as string | null,
        done: false,
        videoUrl: null as string | null,
        failed: false,
      }))

      setCampaignData(prev => {
        if (!prev) return prev
        const updatedVideos = prev.videos.map(v => {
          const poll = pendingPolls.find(p => p.variationIndex === v.variationIndex)
          return poll ? { ...v, status: 'polling' as const } : { ...v, status: 'failed' as const }
        })
        return { ...prev, videos: updatedVideos }
      })

      // Poll for results
      if (campaignPollingRef.current) clearInterval(campaignPollingRef.current)
      let pollCount = 0
      campaignPollingRef.current = setInterval(async () => {
        pollCount++
        if (pollCount > 180) {
          if (campaignPollingRef.current) clearInterval(campaignPollingRef.current)
          setRegeneratingVideos(false)
          setCampaignStatusMsg(es ? 'Timeout' : 'Timeout')
          return
        }

        for (const p of pendingPolls) {
          if (p.done) continue
          try {
            const res = await fetch('/api/motion-graphics/status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ requestId: p.requestId, model: p.model, statusUrl: p.statusUrl, responseUrl: p.responseUrl }),
            })
            const data = await res.json()
            if (data.status === 'COMPLETED' && data.videoUrl) {
              p.done = true
              p.videoUrl = data.videoUrl
              setCampaignData(prev => {
                if (!prev) return prev
                return { ...prev, videos: prev.videos.map(v => v.variationIndex === p.variationIndex ? { ...v, videoUrl: data.videoUrl, status: 'completed' as const } : v) }
              })
            } else if (data.status === 'CONTENT_REJECTED' || data.status === 'COMPLETED' || data.status === 'FAILED') {
              p.done = true
              p.failed = true
              setCampaignData(prev => {
                if (!prev) return prev
                return { ...prev, videos: prev.videos.map(v => v.variationIndex === p.variationIndex ? { ...v, status: 'failed' as const, errorMsg: data.error || undefined } : v) }
              })
            }
          } catch { /* continue */ }
        }

        const allDone = pendingPolls.every(p => p.done)
        const completedCount = pendingPolls.filter(p => p.videoUrl).length
        setCampaignStatusMsg(es ? `Videos: ${completedCount}/3 listos` : `Videos: ${completedCount}/3 ready`)

        if (allDone) {
          if (campaignPollingRef.current) clearInterval(campaignPollingRef.current)
          setRegeneratingVideos(false)
          setCampaignStatusMsg(es ? '✅ Videos regenerados' : '✅ Videos regenerated')
        }
      }, 5000)
    } catch (err) {
      console.error('[RegenerateVideos] Error:', err)
      setError(err instanceof Error ? err.message : 'Error')
      setRegeneratingVideos(false)
    }
  }, [campaignData, regeneratingVideos, startFrameUrl, endFrameUrl, selectedModel, duration, aspectRatio, generateAudio, locale, es, selectedEmotion, selectedTemplate, manualFrameOverride])

  const isCampaignProcessing = campaignStep > 0 && campaignStep < 4
  const isProcessing = ['uploading', 'refining', 'enhancing', 'generating', 'polling'].includes(status) || isCampaignProcessing || regeneratingVideos

  return (
    <div className="min-h-screen bg-[#0F1419] p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30">
            <Wand2 className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Motion Graphics Factory</h1>
            <p className="text-sm text-white/50">
              {es ? 'Sube una imagen, describe el movimiento y crea motion graphics profesionales con IA' : 'Upload an image, describe the motion and create professional motion graphics with AI'}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Campaign Mode Toggle */}
      <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-6">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-[#1a1f2e] border border-[#2a3040]">
          <button
            onClick={() => { setCampaignMode(false); handleCampaignReset() }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              !campaignMode
                ? 'bg-violet-500/15 border border-violet-500/40 text-violet-300 shadow-lg shadow-violet-500/10'
                : 'text-[#8899aa] hover:text-[#b0bec5]'
            }`}
          >
            <Wand2 className="w-4 h-4" />
            {es ? 'Modo Estándar' : 'Standard Mode'}
          </button>
          <button
            onClick={() => setCampaignMode(true)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              campaignMode
                ? 'bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/40 text-orange-300 shadow-lg shadow-orange-500/10'
                : 'text-[#8899aa] hover:text-[#b0bec5]'
            }`}
          >
            <Flame className="w-4 h-4" />
            🔥 {es ? 'Modo Campaña' : 'Campaign Mode'}
          </button>
        </div>
        {campaignMode && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[10px] text-[#c97b3a] mt-2 text-center">
            {es
              ? '1 idea de video → 3 variaciones + 3 copys (AIDA/PAS/Curiosity) + landing + CTAs = campaña completa'
              : '1 video idea → 3 variations + 3 ad copies (AIDA/PAS/Curiosity) + landing + CTAs = full campaign'}
          </motion.p>
        )}
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* LEFT: Controls */}
        <div className="space-y-5">

          {/* Campaign Goal & Audience (only in campaign mode) */}
          {campaignMode && (
            <div className="rounded-2xl bg-[#1a1f2e] border border-[#2a3040] border-l-2 border-l-orange-500/50 p-5">
              <h3 className="text-sm font-semibold text-[#d0d0d0] mb-4 flex items-center gap-2">
                <Target className="w-4 h-4 text-orange-400" />
                {es ? 'Objetivo de Campaña' : 'Campaign Goal'}
              </h3>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {([
                  { id: 'leads' as const, icon: '🎯', labelEn: 'Generate Leads', labelEs: 'Generar Leads' },
                  { id: 'sell' as const, icon: '💰', labelEn: 'Sell a Product', labelEs: 'Vender Producto' },
                  { id: 'audience' as const, icon: '📈', labelEn: 'Grow Audience', labelEs: 'Crecer Audiencia' },
                  { id: 'test' as const, icon: '🧪', labelEn: 'Test Idea', labelEs: 'Testear Idea' },
                ]).map((g) => (
                  <button
                    key={g.id}
                    disabled={isProcessing}
                    onClick={() => setCampaignGoal(g.id)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-medium transition-all ${
                      campaignGoal === g.id
                        ? 'bg-orange-500/20 border-orange-400/50 text-orange-200 shadow-md shadow-orange-500/10'
                        : 'bg-[#151b28] border-[#2a3040] text-[#9aa0b0] hover:bg-[#1e2538] hover:border-[#3a4560] hover:text-[#c0c8d8]'
                    } disabled:opacity-50`}
                  >
                    <span className="text-base">{g.icon}</span>
                    <span>{es ? g.labelEs : g.labelEn}</span>
                  </button>
                ))}
              </div>

              <label className="text-xs text-[#9aa0b0] mb-1.5 block flex items-center gap-1">
                <Users className="w-3 h-3 text-orange-400/70" />
                {es ? '¿Para quién es esta campaña?' : 'Who is this campaign for?'}
              </label>
              <input
                type="text"
                value={campaignAudience}
                onChange={(e) => setCampaignAudience(e.target.value)}
                placeholder={es ? 'Ej: Emprendedores de 25-40 años, tech-savvy...' : 'Ex: Entrepreneurs aged 25-40, tech-savvy...'}
                disabled={isProcessing}
                className="w-full bg-[#0F1419] border border-[#2a3040] rounded-lg px-3 py-2.5 text-sm text-[#e0e0e0] placeholder-[#556070] focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 disabled:opacity-50"
              />
            </div>
          )}

          {/* Frame Upload */}
          <Card className="bg-white/[0.03] border-white/10 p-5">
            <h3 className="text-sm font-semibold text-white/80 mb-4 flex items-center gap-2">
              <ImagePlus className="w-4 h-4 text-violet-400" />
              {es ? 'Frames de Referencia' : 'Reference Frames'}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {/* Start Frame */}
              <div>
                <p className="text-xs text-white/50 mb-2">{es ? 'Frame Inicial *' : 'Start Frame *'}</p>
                <div onClick={() => startInputRef.current?.click()} className={`relative aspect-video rounded-xl border-2 border-dashed cursor-pointer transition-all overflow-hidden ${startFrame ? 'border-violet-500/50 bg-violet-500/5' : 'border-white/20 hover:border-violet-500/40 bg-white/[0.02] hover:bg-white/[0.04]'}`}>
                  {startFrame ? (
                    <>
                      <Image src={startFrame} alt="Start frame" fill className="object-cover" />
                      <button onClick={(e) => { e.stopPropagation(); setStartFrame(null); setStartFrameUrl(null) }} className="absolute top-1.5 right-1.5 p-1 bg-black/60 rounded-full hover:bg-red-500/80 transition-colors z-10"><X className="w-3 h-3 text-white" /></button>
                      {!startFrameUrl && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><Loader2 className="w-5 h-5 text-white animate-spin" /></div>}
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1"><Upload className="w-6 h-6 text-white/30" /><span className="text-[10px] text-white/30">{es ? 'Subir imagen' : 'Upload image'}</span></div>
                  )}
                </div>
                <input ref={startInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f, 'start'); e.target.value = '' }} />
              </div>
              {/* End Frame */}
              <div>
                <p className="text-xs text-white/50 mb-2 flex items-center gap-1">{es ? 'Frame Final' : 'End Frame'}<span className="text-[10px] text-white/30">({es ? 'opcional' : 'optional'})</span></p>
                <div onClick={() => endInputRef.current?.click()} className={`relative aspect-video rounded-xl border-2 border-dashed cursor-pointer transition-all overflow-hidden ${endFrame ? 'border-fuchsia-500/50 bg-fuchsia-500/5' : 'border-white/10 hover:border-fuchsia-500/30 bg-white/[0.02] hover:bg-white/[0.03]'}`}>
                  {endFrame ? (
                    <>
                      <Image src={endFrame} alt="End frame" fill className="object-cover" />
                      <button onClick={(e) => { e.stopPropagation(); setEndFrame(null); setEndFrameUrl(null) }} className="absolute top-1.5 right-1.5 p-1 bg-black/60 rounded-full hover:bg-red-500/80 transition-colors z-10"><X className="w-3 h-3 text-white" /></button>
                      {!endFrameUrl && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><Loader2 className="w-5 h-5 text-white animate-spin" /></div>}
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1"><Upload className="w-5 h-5 text-white/20" /><span className="text-[10px] text-white/20">{es ? 'Frame final' : 'End frame'}</span></div>
                  )}
                </div>
                <input ref={endInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f, 'end'); e.target.value = '' }} />
              </div>
            </div>
            {endFrame && !currentModel.supportsEndFrame && (
              <div className="mt-3 flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <Info className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-[11px] text-amber-300/80">{es ? 'Se cambiará automáticamente a Veo 3.1 Start+End para usar ambos frames.' : 'Will auto-switch to Veo 3.1 Start+End to use both frames.'}</p>
              </div>
            )}
          </Card>

          {/* ===== 1. QUICK TEMPLATES ===== */}
          <Card className="bg-white/[0.03] border-white/10 p-5">
            <h3 className="text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
              <Copy className="w-4 h-4 text-orange-400" />
              {es ? 'Plantillas Rápidas' : 'Quick Templates'}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {QUICK_TEMPLATES.map((t, i) => (
                <button
                  key={i}
                  disabled={isProcessing}
                  onClick={() => {
                    setPrompt(es ? t.promptEs : t.promptEn)
                    setSelectedTemplate(t.labelEn)
                    setEnhancedPrompt('')
                    setShowEnhancedPrompt(false)
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all text-xs ${
                    selectedTemplate === t.labelEn
                      ? 'bg-orange-500/15 border-orange-500/40 text-orange-300'
                      : 'bg-white/[0.02] border-white/10 text-white/60 hover:bg-white/[0.05] hover:border-white/20'
                  } disabled:opacity-50`}
                >
                  <span className="text-base shrink-0">{t.icon}</span>
                  <span className="truncate">{es ? t.labelEs : t.labelEn}</span>
                </button>
              ))}
            </div>
          </Card>

          {/* Prompt */}
          <Card className="bg-white/[0.03] border-white/10 p-5">
            <h3 className="text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-fuchsia-400" />
              {es ? 'Describe el Movimiento' : 'Describe the Motion'}
            </h3>
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => { setPrompt(e.target.value); setEnhancedPrompt(''); setShowEnhancedPrompt(false) }}
                placeholder={es ? 'Ej: Los elementos aparecen uno por uno con un efecto bounce suave...' : 'Ex: Elements appear one by one with a smooth bounce effect...'}
                rows={4}
                disabled={isProcessing}
                className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 resize-none disabled:opacity-50"
              />
              <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5">
                <button onClick={toggleRecording} disabled={isProcessing || isTranscribing} className={`p-2 rounded-full transition-all ${isRecording ? 'bg-red-500 hover:bg-red-600 animate-pulse' : isTranscribing ? 'bg-yellow-500/50 cursor-wait' : 'bg-white/10 hover:bg-white/20'} disabled:opacity-50`} title={es ? 'Grabar con micrófono' : 'Record with microphone'}>
                  {isTranscribing ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" /> : isRecording ? <MicOff className="w-3.5 h-3.5 text-white" /> : <Mic className="w-3.5 h-3.5 text-white/60" />}
                </button>
              </div>
            </div>
            {isRecording && <p className="text-xs text-red-400 mt-2 animate-pulse">🔴 {es ? 'Grabando... habla y describe la animación' : 'Recording... describe the animation'}</p>}

            {/* ===== 5. AI PROMPT ENHANCER BUTTON ===== */}
            {prompt.trim() && !showEnhancedPrompt && !isProcessing && (
              <button
                onClick={handleEnhancePrompt}
                className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 border border-violet-500/20 text-violet-300 hover:border-violet-500/40 transition-all text-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {es ? '✨ Mejorar prompt con IA' : '✨ Enhance prompt with AI'}
              </button>
            )}

            {/* Enhanced prompt display */}
            {showEnhancedPrompt && enhancedPrompt && (
              <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] text-violet-300/60 uppercase tracking-wider flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    {es ? 'Prompt Refinado por IA' : 'AI-Refined Prompt'}
                  </p>
                  <button onClick={() => { setIsEditingEnhanced(!isEditingEnhanced) }} className="text-[10px] text-violet-400 hover:text-violet-300 flex items-center gap-1">
                    <Pencil className="w-3 h-3" />
                    {isEditingEnhanced ? (es ? 'Listo' : 'Done') : (es ? 'Editar' : 'Edit')}
                  </button>
                </div>
                {isEditingEnhanced ? (
                  <textarea
                    value={enhancedPrompt}
                    onChange={(e) => setEnhancedPrompt(e.target.value)}
                    rows={5}
                    className="w-full bg-violet-500/5 border border-violet-500/20 rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-violet-500/40 resize-none"
                  />
                ) : (
                  <p className="text-xs text-white/50 bg-violet-500/5 border border-violet-500/15 rounded-lg p-3 leading-relaxed">{enhancedPrompt}</p>
                )}
              </motion.div>
            )}
          </Card>

          {/* ===== 2. EMOTION SELECTOR ===== */}
          <Card className="bg-white/[0.03] border-white/10 p-5">
            <h3 className="text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
              <span className="text-base">🎭</span>
              {es ? '¿Qué debe sentir el viewer?' : 'What should the viewer feel?'}
              <span className="text-[10px] text-white/30 ml-auto">{es ? 'opcional' : 'optional'}</span>
            </h3>
            <div className="flex flex-wrap gap-2">
              {EMOTIONS.map((e) => (
                <button
                  key={e.id}
                  disabled={isProcessing}
                  onClick={() => setSelectedEmotion(selectedEmotion === e.id ? null : e.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-all ${
                    selectedEmotion === e.id
                      ? 'bg-fuchsia-500/15 border-fuchsia-500/40 text-fuchsia-300 shadow-lg shadow-fuchsia-500/10'
                      : 'bg-white/[0.02] border-white/10 text-white/50 hover:bg-white/[0.05] hover:border-white/20'
                  } disabled:opacity-50`}
                >
                  <span>{e.icon}</span>
                  <span>{es ? e.labelEs : e.labelEn}</span>
                </button>
              ))}
            </div>
          </Card>

          {/* Settings */}
          <Card className="bg-white/[0.03] border-white/10 p-5">
            <h3 className="text-sm font-semibold text-white/80 mb-4 flex items-center gap-2">
              <Film className="w-4 h-4 text-cyan-400" />
              {es ? 'Configuración' : 'Settings'}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {/* Model */}
              <div className="col-span-2 relative">
                <label className="text-xs text-white/50 mb-1.5 block">{es ? 'Modelo de Video' : 'Video Model'}</label>
                <button onClick={() => setShowModelPicker(!showModelPicker)} disabled={isProcessing} className="w-full flex items-center justify-between bg-white/5 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white hover:border-violet-500/40 transition-colors disabled:opacity-50">
                  <span className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-violet-400" />
                    <span className="text-white/40 text-xs">{currentModel.provider}</span>
                    {currentModel.label}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${showModelPicker ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {showModelPicker && (
                    <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="absolute top-full left-0 right-0 mt-1 bg-[#1a1f2e] border border-white/15 rounded-lg overflow-hidden z-20 shadow-xl max-h-[340px] overflow-y-auto">
                      {(() => {
                        let lastProvider = ''
                        return models.map((m) => {
                          const showHeader = m.provider !== lastProvider
                          lastProvider = m.provider
                          return (
                            <div key={m.id}>
                              {showHeader && <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/30 bg-white/[0.02] border-t border-white/5 first:border-t-0 sticky top-0">{m.provider}</div>}
                              <button onClick={() => { setSelectedModel(m.id); setShowModelPicker(false) }} className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${m.id === selectedModel ? 'bg-violet-500/20 text-violet-300' : 'text-white/70 hover:bg-white/5'}`}>
                                <span className="flex items-center gap-2"><span className="text-xs">✦</span>{m.label}</span>
                                <div className="flex items-center gap-1.5">
                                  {m.supportsEndFrame && <span className="text-[9px] px-1.5 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-300">Start+End</span>}
                                  {m.supportsAudio && <Volume2 className="w-3 h-3 text-green-400" />}
                                </div>
                              </button>
                            </div>
                          )
                        })
                      })()}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Duration */}
              <div>
                <label className="text-xs text-white/50 mb-1.5 block flex items-center gap-1"><Clock className="w-3 h-3" />{es ? 'Duración' : 'Duration'}</label>
                <select value={duration} onChange={(e) => setDuration(e.target.value)} disabled={isProcessing} className="w-full bg-[#0F1419] border border-gray-600 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50 disabled:opacity-50">
                  <option value="4">4s</option><option value="5">5s</option><option value="6">6s</option><option value="8">8s</option>
                </select>
              </div>

              {/* Aspect Ratio */}
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">{es ? 'Aspecto' : 'Aspect Ratio'}</label>
                <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} disabled={isProcessing} className="w-full bg-[#0F1419] border border-gray-600 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50 disabled:opacity-50">
                  <option value="16:9">16:9 (Landscape)</option><option value="9:16">9:16 (Portrait)</option><option value="1:1">1:1 (Square)</option>
                </select>
              </div>

              {/* Audio toggle */}
              {currentModel.supportsAudio && (
                <div className="col-span-2">
                  <button onClick={() => setGenerateAudio(!generateAudio)} disabled={isProcessing} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all w-full ${generateAudio ? 'bg-green-500/10 border-green-500/30 text-green-300' : 'bg-white/[0.02] border-white/10 text-white/40'} disabled:opacity-50`}>
                    {generateAudio ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                    <span className="text-xs">{es ? (generateAudio ? 'Audio generado activado' : 'Sin audio') : (generateAudio ? 'Generated audio enabled' : 'No audio')}</span>
                  </button>
                </div>
              )}

              {/* ===== 3. MULTI-VARIATION TOGGLE ===== */}
              <div className="col-span-2">
                <label className="text-xs text-white/50 mb-2 block flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  {es ? 'Generar Variaciones' : 'Generate Variations'}
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3].map((n) => (
                    <button
                      key={n}
                      disabled={isProcessing}
                      onClick={() => setVariationCount(n)}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${
                        variationCount === n
                          ? 'bg-violet-500/15 border-violet-500/40 text-violet-300'
                          : 'bg-white/[0.02] border-white/10 text-white/40 hover:bg-white/[0.05]'
                      } disabled:opacity-50`}
                    >
                      {n} {n === 1 ? (es ? 'video' : 'video') : (es ? 'videos' : 'videos')}
                    </button>
                  ))}
                </div>
                {variationCount > 1 && (
                  <p className="text-[10px] text-white/30 mt-1.5">
                    {es ? `Se generarán ${variationCount} variaciones con diferentes enfoques (velocidad, emoción, detalle)` : `Will generate ${variationCount} variations with different focuses (speed, emotion, detail)`}
                  </p>
                )}
              </div>
            </div>
          </Card>

          {/* Generate Button */}
          {campaignMode ? (
            <Button
              onClick={handleGenerateCampaign}
              disabled={!prompt.trim() || isProcessing}
              className="w-full py-4 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-semibold rounded-xl shadow-lg shadow-orange-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {isCampaignProcessing ? (
                <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{campaignStatusMsg}</span>
              ) : (
                <span className="flex items-center gap-2"><Flame className="w-4 h-4" />🔥 {es ? 'Lanzar Auto Campaña' : 'Launch Auto Campaign'}</span>
              )}
            </Button>
          ) : (
            <Button onClick={handleGenerate} disabled={!prompt.trim() || isProcessing} className="w-full py-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-semibold rounded-xl shadow-lg shadow-violet-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              {isProcessing ? (
                <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{statusMsg}</span>
              ) : (
                <span className="flex items-center gap-2"><Wand2 className="w-4 h-4" />{variationCount > 1 ? (es ? `Generar ${variationCount} Variaciones` : `Generate ${variationCount} Variations`) : (es ? 'Generar Motion Graphic' : 'Generate Motion Graphic')}</span>
              )}
            </Button>
          )}

          {error && (
            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-xs text-red-300">{error}</p>
            </motion.div>
          )}
        </div>

        {/* RIGHT: Preview / Result */}
        <div className="space-y-5">

          {/* Campaign Results Panel */}
          {campaignMode && campaignData ? (
            <>
              <CampaignResultsPanel
                data={campaignData}
                es={es}
                onDownload={handleDownload}
                onSendToMarketing={(ctx) => router.push(`/dashboard/social-bridge?context=${encodeURIComponent(ctx)}`)}
                onSendToFoundry={(ctx) => router.push(`/dashboard/project-builder?hero=${encodeURIComponent(ctx)}`)}
                onSaveToProject={handleSaveToProject}
                savingToProject={savingToProject}
                onRegenerateVideos={handleRegenerateVideos}
                regeneratingVideos={regeneratingVideos}
                onManualFrameUpload={handleManualFrameUpload}
                uploadingManualFrame={uploadingManualFrame}
              />
              {campaignStep === 4 && (
                <Button onClick={handleCampaignReset} variant="outline" className="w-full border-white/20 text-white/60 hover:text-white">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  {es ? 'Nueva Campaña' : 'New Campaign'}
                </Button>
              )}
            </>
          ) : campaignMode && isCampaignProcessing ? (
            <Card className="bg-white/[0.03] border-white/10 p-5 min-h-[400px] flex flex-col items-center justify-center">
              <div className="text-center py-12">
                <div className="relative mx-auto w-20 h-20 mb-6">
                  <div className="absolute inset-0 rounded-full border-2 border-orange-500/20" />
                  <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-orange-500 animate-spin" />
                  <div className="absolute inset-3 rounded-full border-2 border-transparent border-t-red-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
                  <Flame className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-orange-400" />
                </div>
                <p className="text-sm text-white/70 mb-1">{campaignStatusMsg}</p>
                <div className="mt-4 flex items-center justify-center gap-6 text-[10px] text-white/30">
                  <span className={campaignStep >= 1 ? 'text-green-400' : ''}>
                    {campaignStep >= 2 ? '✓' : '⟳'} {es ? 'Copys' : 'Copies'}
                  </span>
                  <span className="text-white/10">→</span>
                  <span className={campaignStep >= 2 ? 'text-green-400' : ''}>
                    {campaignStep >= 3 ? '✓' : campaignStep === 2 ? '⟳' : '○'} Videos
                  </span>
                  <span className="text-white/10">→</span>
                  <span className={campaignStep >= 4 ? 'text-green-400' : ''}>
                    {campaignStep >= 4 ? '✓' : '○'} {es ? 'Listo' : 'Done'}
                  </span>
                </div>
              </div>
            </Card>
          ) : (
          <>

          <Card className="bg-white/[0.03] border-white/10 p-5 min-h-[400px] flex flex-col">
            <h3 className="text-sm font-semibold text-white/80 mb-4 flex items-center gap-2">
              <Play className="w-4 h-4 text-green-400" />
              {es ? 'Resultado' : 'Result'}
            </h3>

            <div className="flex-1 flex items-center justify-center">
              <AnimatePresence mode="wait">
                {status === 'completed' && videoUrl ? (
                  <motion.div key="video" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full">
                    {/* Multi-variation grid or single video */}
                    {variationResults.length > 1 ? (
                      <div className={`grid gap-4 ${variationResults.length === 2 ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-3'}`}>
                        {variationResults.map((v, i) => (
                          <div key={i} className="rounded-xl overflow-hidden bg-black border border-white/10">
                            <video src={v.videoUrl} controls loop className="w-full" style={{ maxHeight: '280px' }} />
                            <div className="p-2 flex items-center justify-between">
                              <span className="text-[10px] text-white/50 font-mono">{v.label}</span>
                              <button onClick={() => handleDownload(v.videoUrl)} className="p-1 hover:bg-white/10 rounded transition-colors"><Download className="w-3 h-3 text-white/50" /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="relative rounded-xl overflow-hidden bg-black">
                        <video src={videoUrl} controls autoPlay loop className="w-full rounded-xl" style={{ maxHeight: '500px' }} />
                        {videoLoadedFromHistory && (
                          <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-md bg-orange-500/80 backdrop-blur-sm text-white text-[10px] font-semibold">
                            <History className="w-3 h-3" />
                            {es ? 'Cargado de Mis Videos' : 'Loaded from My Videos'}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 mt-4">
                      <button onClick={() => handleDownload()} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition-colors">
                        <Download className="w-4 h-4" />{es ? 'Descargar' : 'Download'}
                      </button>
                      <button onClick={handleReset} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white/70 text-sm rounded-lg transition-colors">
                        <RotateCcw className="w-4 h-4" />{es ? 'Nuevo' : 'New'}
                      </button>
                    </div>

                    {/* ===== 4. PIPELINE BUTTONS ===== */}
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        onClick={() => router.push(`/dashboard/social-bridge?context=${encodeURIComponent(refinedPrompt || prompt)}`)}
                        className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-300 hover:bg-orange-500/20 transition-all text-xs"
                      >
                        <Megaphone className="w-3.5 h-3.5" />
                        {es ? 'Enviar a Marketing' : 'Send to Marketing'}
                      </button>
                      <button
                        onClick={() => router.push(`/dashboard/project-builder?hero=${encodeURIComponent(refinedPrompt || prompt)}`)}
                        className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 hover:bg-blue-500/20 transition-all text-xs"
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        {es ? 'Enviar a Foundry' : 'Send to Foundry'}
                      </button>
                      <button
                        onClick={handleSaveToProject}
                        disabled={savingToProject}
                        className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20 transition-all text-xs disabled:opacity-50"
                      >
                        {savingToProject ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        {es ? 'Guardar en Proyectos' : 'Save to Projects'}
                      </button>
                    </div>

                    {/* 🔥 AUDIO FACTORY — Standard Mode */}
                    <div className="mt-4">
                      <button
                        onClick={() => setShowAudioFactory(!showAudioFactory)}
                        className="w-full flex items-center justify-between py-3 px-4 rounded-xl bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/25 hover:border-orange-500/40 transition-all"
                      >
                        <span className="flex items-center gap-2 text-sm font-bold text-orange-300">
                          <Volume2 className="w-4 h-4" />
                          🔥 Audio Factory
                        </span>
                        <ChevronDown className={`w-4 h-4 text-orange-300/60 transition-transform ${showAudioFactory ? 'rotate-180' : ''}`} />
                      </button>

                      <AnimatePresence>
                        {showAudioFactory && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-3 p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-3">
                              <p className="text-[10px] text-white/40">{es ? 'Añade voz profesional y música a tu video' : 'Add professional voice-over & music to your video'}</p>

                              {/* Voice Script */}
                              <div>
                                <label className="text-xs text-white/50 mb-1 flex items-center gap-1"><Mic className="w-3 h-3 text-orange-400" /> {es ? 'Guión' : 'Script'} <span className="text-[9px] text-white/25">{es ? '(auto si vacío)' : '(auto if empty)'}</span></label>
                                <textarea
                                  value={afVoiceScript}
                                  onChange={e => setAfVoiceScript(e.target.value)}
                                  placeholder={es ? 'Ej: Controla tu hogar. Octopus Omni-Cockpit.' : 'e.g. Control your home. Octopus Omni-Cockpit.'}
                                  rows={2}
                                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/80 placeholder-white/20 focus:outline-none focus:border-orange-500/40 resize-none"
                                />
                              </div>

                              {/* Voice + Music */}
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-xs text-white/50 mb-1 flex items-center gap-1"><Mic className="w-3 h-3 text-violet-400" /> {es ? 'Voz' : 'Voice'}</label>
                                  <div className="space-y-1">
                                    {[
                                      { id: 'cinematic_male' as const, l: '🎬 Cinematic Male' },
                                      { id: 'professional_female' as const, l: '💼 Professional Female' },
                                      { id: 'deep_tech' as const, l: '🖥️ Deep Tech' },
                                    ].map(v => (
                                      <button key={v.id} onClick={() => setAfVoiceProfile(v.id)} className={`w-full text-left px-2 py-1.5 rounded-lg border text-[10px] transition-all ${afVoiceProfile === v.id ? 'bg-violet-500/15 border-violet-500/40 text-violet-300' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'}`}>{v.l}</button>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <label className="text-xs text-white/50 mb-1 flex items-center gap-1"><Music className="w-3 h-3 text-emerald-400" /> {es ? 'Música' : 'Music'}</label>
                                  <div className="space-y-1">
                                    {[
                                      { id: 'ambient_tech' as const, l: '🌌 Ambient Tech' },
                                      { id: 'upbeat_marketing' as const, l: '🚀 Upbeat' },
                                      { id: 'cinematic_tension' as const, l: '🎬 Cinematic' },
                                      { id: 'none' as const, l: '🔇 None' },
                                    ].map(m => (
                                      <button key={m.id} onClick={() => setAfMusicStyle(m.id)} className={`w-full text-left px-2 py-1.5 rounded-lg border text-[10px] transition-all ${afMusicStyle === m.id ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'}`}>{m.l}</button>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {/* Error */}
                              {afError && <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300">⚠️ {afError}</div>}

                              {/* Audio Result */}
                              {afAudioResult && (
                                <div className="p-3 rounded-xl bg-white/[0.03] border border-green-500/20 space-y-2">
                                  <div className="flex items-center gap-2 text-xs text-green-300"><CheckCircle className="w-3.5 h-3.5" /> {es ? 'Audio generado' : 'Audio generated'}</div>
                                  <div className="text-[10px] text-white/40">&ldquo;{afAudioResult.script}&rdquo;</div>
                                  <audio src={afAudioResult.voiceUrl} controls className="w-full h-8" />
                                </div>
                              )}

                              {/* Generate / Master buttons */}
                              {!afAudioResult ? (
                                <button onClick={handleAfGenerateAudio} disabled={afGenerating} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gradient-to-r from-orange-500/15 to-violet-500/15 border border-orange-500/30 text-orange-300 hover:from-orange-500/25 hover:to-violet-500/25 transition-all text-xs font-medium disabled:opacity-50">
                                  {afGenerating ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{es ? 'Generando voz...' : 'Generating voice...'}</> : <><Mic className="w-3.5 h-3.5" />🎙️ {es ? 'Generar Voice-over' : 'Generate Voice-over'}</>}
                                </button>
                              ) : !afMasterUrl ? (
                                <button onClick={handleAfMaster} disabled={afMastering} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/40 text-orange-200 hover:from-orange-500/30 hover:to-red-500/30 transition-all text-sm font-bold disabled:opacity-50">
                                  {afMastering ? <><Loader2 className="w-4 h-4 animate-spin" />{es ? 'Masterizando...' : 'Mastering...'}</> : <><Film className="w-4 h-4" />🎬 {es ? 'Generar Master Final' : 'Generate Final Master'}</>}
                                </button>
                              ) : null}

                              {/* Master Result */}
                              {afMasterUrl && (
                                <div className="rounded-xl overflow-hidden border border-orange-500/30 bg-black">
                                  <div className="px-3 py-2 bg-gradient-to-r from-orange-500/10 to-red-500/10 border-b border-orange-500/20 flex items-center gap-2">
                                    <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                                    <span className="text-xs font-bold text-orange-200">🎬 {es ? 'Master Final' : 'Final Master'}</span>
                                  </div>
                                  <video src={afMasterUrl} controls autoPlay className="w-full" style={{ maxHeight: '320px' }} />
                                  <div className="p-2 flex items-center justify-between bg-white/[0.03]">
                                    <span className="text-[10px] text-white/40 font-mono">master_final.mp4</span>
                                    <div className="flex items-center gap-2">
                                      <button onClick={() => handleDownload(afMasterUrl)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-300 hover:bg-orange-500/25 transition-all text-xs">
                                        <Download className="w-3 h-3" /> {es ? 'Descargar' : 'Download'}
                                      </button>
                                      <button onClick={handleAfSaveToStudio} disabled={afSaving || afSaved} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all text-xs ${afSaved ? 'bg-green-500/20 border-green-500/40 text-green-300' : 'bg-purple-500/15 border-purple-500/30 text-purple-300 hover:bg-purple-500/25'} disabled:opacity-60`}>
                                        {afSaving ? <><Loader2 className="w-3 h-3 animate-spin" /> {es ? 'Guardando...' : 'Saving...'}</> : afSaved ? <>✅ {es ? 'Guardado' : 'Saved'}</> : <>📦 {es ? 'Guardar en Studio' : 'Save to Studio'}</>}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Reset audio */}
                              {afAudioResult && (
                                <button onClick={() => { setAfAudioResult(null); setAfMasterUrl(null); setAfError(null) }} className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] text-white/40 hover:text-white/60 hover:border-white/20 transition-all">
                                  <Wand2 className="w-3 h-3" /> {es ? 'Regenerar audio' : 'Re-generate audio'}
                                </button>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                ) : isProcessing ? (
                  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-12">
                    <div className="relative mx-auto w-20 h-20 mb-6">
                      <div className="absolute inset-0 rounded-full border-2 border-violet-500/20" />
                      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-violet-500 animate-spin" />
                      <div className="absolute inset-3 rounded-full border-2 border-transparent border-t-fuchsia-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
                      <Wand2 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-violet-400" />
                    </div>
                    <p className="text-sm text-white/70 mb-1">{statusMsg}</p>
                    <p className="text-xs text-white/40">{es ? 'Los motion graphics tardan 1-3 minutos dependiendo del modelo' : 'Motion graphics take 1-3 minutes depending on the model'}</p>
                    {refinedPrompt && (
                      <div className="mt-6 max-w-md mx-auto">
                        <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">{es ? 'Prompt refinado por IA' : 'AI-refined prompt'}</p>
                        <p className="text-xs text-white/50 bg-white/[0.03] border border-white/10 rounded-lg p-3 text-left leading-relaxed">{refinedPrompt}</p>
                      </div>
                    )}
                  </motion.div>
                ) : status === 'failed' ? (
                  <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center"><X className="w-8 h-8 text-red-400" /></div>
                    <p className="text-sm text-red-300 mb-4">{error || (es ? 'Error en la generación' : 'Generation failed')}</p>
                    <Button onClick={handleReset} variant="outline" className="border-white/20 text-white/60 hover:text-white"><RotateCcw className="w-4 h-4 mr-2" />{es ? 'Reintentar' : 'Try Again'}</Button>
                  </motion.div>
                ) : (
                  <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 border border-violet-500/20 flex items-center justify-center"><Wand2 className="w-8 h-8 text-violet-400/60" /></div>
                    <p className="text-sm text-white/40 mb-2">{es ? 'Tu motion graphic aparecerá aquí' : 'Your motion graphic will appear here'}</p>
                    <p className="text-xs text-white/25 max-w-xs mx-auto">{es ? '1. Sube un frame → 2. Describe el movimiento → 3. Genera' : '1. Upload a frame → 2. Describe the motion → 3. Generate'}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Card>

          {/* ===== 6. HISTORY / GALLERY ===== */}
          <Card className="bg-white/[0.03] border-white/10 p-5">
            <button
              onClick={() => { setShowHistory(!showHistory); if (!showHistory && historyItems.length === 0) loadHistory() }}
              className="w-full flex items-center justify-between text-sm font-semibold text-white/80"
            >
              <span className="flex items-center gap-2">
                <History className="w-4 h-4 text-cyan-400" />
                {es ? 'Mis Videos' : 'My Videos'}
              </span>
              <ChevronRight className={`w-4 h-4 text-white/40 transition-transform ${showHistory ? 'rotate-90' : ''}`} />
            </button>

            <AnimatePresence>
              {showHistory && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  {historyLoading ? (
                    <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 text-white/40 animate-spin" /></div>
                  ) : historyItems.length === 0 ? (
                    <p className="py-4 text-xs text-white/30 text-center">{es ? 'No hay videos generados aún' : 'No videos generated yet'}</p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {historyItems.map((item) => {
                        let meta: { model?: string; rawPrompt?: string } = {}
                        try { meta = JSON.parse(item.metadata || '{}') } catch { /* ignore */ }
                        const isExpanded = previewVideoId === item.id
                        return (
                          <div key={item.id} className={`rounded-lg border transition-all ${isExpanded ? 'bg-white/[0.04] border-orange-500/30' : 'bg-white/[0.02] border-white/5 hover:border-white/10'}`}>
                            <div className="flex items-start gap-3 p-3">
                              {/* Clickable thumbnail for preview */}
                              <button
                                onClick={() => setPreviewVideoId(isExpanded ? null : item.id)}
                                className="w-24 h-14 rounded-lg overflow-hidden bg-black shrink-0 relative group cursor-pointer"
                              >
                                <video src={item.content} className="w-full h-full object-cover" muted preload="metadata" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <Play className="w-5 h-5 text-white" />
                                </div>
                              </button>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-white/60 line-clamp-2 leading-relaxed">{item.prompt || meta.rawPrompt || 'Motion Graphic'}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] text-white/30">{meta.model || 'unknown'}</span>
                                  <span className="text-[10px] text-white/20">•</span>
                                  <span className="text-[10px] text-white/30">{new Date(item.createdAt).toLocaleDateString()}</span>
                                </div>
                              </div>
                              <div className="flex flex-col gap-1 shrink-0">
                                <button onClick={() => handleLoadVideoFromHistory(item)} className="p-1.5 rounded bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/20 transition-colors" title={es ? 'Usar en Audio Factory' : 'Use in Audio Factory'}><Volume2 className="w-3 h-3 text-orange-400" /></button>
                                <button onClick={() => handleDownload(item.content)} className="p-1.5 rounded bg-white/5 hover:bg-white/10 transition-colors" title="Download"><Download className="w-3 h-3 text-white/50" /></button>
                                <button onClick={() => {
                                  setPrompt(meta.rawPrompt || item.prompt || '')
                                  setVideoUrl(null)
                                  setStatus('idle')
                                  setEnhancedPrompt('')
                                  setShowEnhancedPrompt(false)
                                }} className="p-1.5 rounded bg-white/5 hover:bg-white/10 transition-colors" title={es ? 'Regenerar' : 'Regenerate'}><RotateCcw className="w-3 h-3 text-white/50" /></button>
                              </div>
                            </div>

                            {/* Expanded preview */}
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                  <div className="px-3 pb-3">
                                    <div className="rounded-lg overflow-hidden bg-black">
                                      <video src={item.content} controls autoPlay className="w-full" style={{ maxHeight: '300px' }} />
                                    </div>
                                    <button
                                      onClick={() => handleLoadVideoFromHistory(item)}
                                      className="w-full mt-2 flex items-center justify-center gap-2 py-2 rounded-lg bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 text-orange-300 hover:from-orange-500/30 hover:to-red-500/30 transition-all text-xs font-semibold"
                                    >
                                      <Volume2 className="w-3.5 h-3.5" />
                                      🔥 {es ? 'Usar en Audio Factory' : 'Use in Audio Factory'}
                                    </button>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </Card>

          {/* Tips */}
          <Card className="bg-white/[0.03] border-white/10 p-5">
            <h3 className="text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-400" />
              {es ? 'Tips Pro' : 'Pro Tips'}
            </h3>
            <ul className="space-y-2">
              {(es ? [
                '🎯 Usa plantillas rápidas para empezar con prompts optimizados',
                '🎭 Selecciona una emoción para añadir dirección emocional al video',
                '✨ Usa "Mejorar prompt con IA" antes de generar para mejores resultados',
                '🔄 Genera 2-3 variaciones para comparar diferentes enfoques',
                '⚡ Veo 3.1 genera audio automático que sincroniza con el movimiento',
                '💰 Requiere API key de fal.ai — configúrala en API Hub',
              ] : [
                '🎯 Use quick templates to start with optimized prompts',
                '🎭 Select an emotion to add emotional direction to the video',
                '✨ Use "Enhance prompt with AI" before generating for better results',
                '🔄 Generate 2-3 variations to compare different approaches',
                '⚡ Veo 3.1 auto-generates audio that syncs with the movement',
                '💰 Requires fal.ai API key — configure it in API Hub',
              ]).map((tip, i) => (
                <li key={i} className="text-xs text-white/50 leading-relaxed">{tip}</li>
              ))}
            </ul>
          </Card>
          </>
          )}
        </div>
      </div>
      <FeedbackModal isOpen={showFeedback} onClose={() => setShowFeedback(false)} featureUsed={feedbackFeature} featureLabel={feedbackLabel} />
    </div>
  )
}
