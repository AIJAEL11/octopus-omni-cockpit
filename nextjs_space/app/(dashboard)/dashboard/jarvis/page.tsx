'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// Speech Recognition Types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionResultList {
  readonly length: number
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  readonly length: number
  readonly isFinal: boolean
  [index: number]: { transcript: string; confidence: number }
}

interface SpeechRecognitionInstance {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: Event & { error: string }) => void) | null
  onend: (() => void) | null
  onspeechend: (() => void) | null
  onaudiostart: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain,
  Sparkles,
  Bot,
  Wrench,
  Plug,
  AlertTriangle,
  Zap,
  Check,
  X,
  RefreshCw,
  Activity,
  Eye,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  Lightbulb,
  Target,
  Shield,
  TrendingUp,
  Send,
  Mic,
  MicOff,
  Image as ImageIcon,
  Upload,
  MessageCircle,
  BarChart3,
  Navigation,
  Volume2,
  VolumeX,
  Paperclip,
  Trash2,
  Globe,
  ExternalLink,
  Search,
  Network,
  GitBranch,
  Mail,
  RefreshCcw,
  FileText,
  FileSpreadsheet,
  File,
  Square,
  Video,
  Linkedin,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  Cpu,
  Database,
  Link2,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useMetrics } from '@/lib/metrics-context'
import { Recommendation, RecommendationType, RecommendationPriority, JARVIS_PERSONALITY } from '@/lib/jarvis-types'
// Phase 2: detect* functions removed — LLM handles all intent detection via native tool calls
import { useTheme } from '@/lib/theme-context'
import { parseJarvisAction, parseAllJarvisActions, JarvisAction } from '@/lib/jarvis-actions'
import { useI18n } from '@/lib/i18n-context'
import { 
  introspectStructure, 
  readFile, 
  searchInCode, 
  analyzeSelf, 
  getSystemStats,
  formatCodeForChat,
  formatSearchResults,
  formatAnalysis
} from '@/lib/jarvis-eyes'
import { usePlanGate } from '@/hooks/use-plan-gate'
import { UpgradeModal } from '@/components/upgrade-modal'
import { IMAGE_MODELS, DEFAULT_IMAGE_MODEL_ID, groupImageModels, CATEGORY_ORDER, CATEGORY_LABELS, type ImageModel } from '@/lib/image-models'
import { TURBO_MODELS, getTierBadge, type TurboModel } from '@/lib/turbo-config'
import { detectImageModelFromMessage, getModelLabel } from '@/lib/model-detector'
import dynamicImport from 'next/dynamic'
import { parseCanvasFiles, stripCanvasBlocksForDisplay, type CanvasFile } from '@/lib/octopus-canvas'

const BubblesMindMap = dynamicImport(() => import('@/components/bubbles-mind-map'), { ssr: false })
const OctopusCanvas = dynamicImport(() => import('@/components/octopus-canvas').then(m => m.OctopusCanvas), { ssr: false })
const CanvasReopenChip = dynamicImport(() => import('@/components/octopus-canvas').then(m => m.CanvasReopenChip), { ssr: false })

const typeIcons: Record<RecommendationType, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  agent: Bot,
  skill: Wrench,
  mcp: Plug,
  optimization: TrendingUp,
  warning: AlertTriangle,
}

const typeColors: Record<RecommendationType, string> = {
  agent: '#2D4A3E',
  skill: '#C4622D',
  mcp: '#4A90D9',
  optimization: '#9B59B6',
  warning: '#E74C3C',
}

const priorityColors: Record<RecommendationPriority, string> = {
  low: '#95A5A6',
  medium: '#3498DB',
  high: '#E67E22',
  critical: '#E74C3C',
}

const priorityLabelsEs: Record<RecommendationPriority, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Crítica',
}

const priorityLabelsEn: Record<RecommendationPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}

interface WebSearchResult {
  title: string
  url: string
  snippet: string
}

interface WebSearchData {
  query: string
  results: WebSearchResult[]
  firstResultContent?: {
    title: string
    content: string
    url: string
  }
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  image?: string // Imagen subida por el usuario (legacy / primera imagen)
  images?: string[] // Hasta 10 imágenes subidas por el usuario
  generatedImage?: string // Imagen generada por JARVIS
  generatedImageModel?: string // Modelo usado para la imagen (ej. "🍌 google/gemini-3-pro-image-preview")
  isGeneratingImage?: boolean // Indica si está generando imagen
  // Video/Slideshow fields
  videoFrames?: string[] // Array de frames para slideshow
  isGeneratingVideo?: boolean // Indica si está generando video
  videoPrompt?: string // Prompt usado para generar el video
  generatedVideo?: string // URL de video generado (UGC/Seedance/AI)
  videoThumbnail?: string // Thumbnail del video
  videoModelUsed?: string // Modelo usado (Kling, Seedance, Veo, slideshow)
  // Web search fields
  webSearchData?: WebSearchData // Datos de búsqueda web
  isSearchingWeb?: boolean // Indica si está buscando
  // Document fields
  document?: { name: string; type: string; base64: string } // Documento adjunto
  action?: JarvisAction
  actionResult?: {
    success: boolean
    type: string
    name: string
    location: string
  }
}

interface CreationNotification {
  id: string
  type: 'skill' | 'agent' | 'mcp'
  name: string
  location: string
  timestamp: Date
}

// Slideshow Player Component for Video Animations
function SlideshowPlayer({ frames, prompt }: { frames: string[]; prompt: string }) {
  const [currentFrame, setCurrentFrame] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [speed, setSpeed] = useState(1000) // ms per frame
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (isPlaying && frames.length > 1) {
      intervalRef.current = setInterval(() => {
        setCurrentFrame(prev => (prev + 1) % frames.length)
      }, speed)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isPlaying, frames.length, speed])

  const togglePlayPause = () => setIsPlaying(!isPlaying)
  
  const nextFrame = () => {
    setIsPlaying(false)
    setCurrentFrame(prev => (prev + 1) % frames.length)
  }
  
  const prevFrame = () => {
    setIsPlaying(false)
    setCurrentFrame(prev => (prev - 1 + frames.length) % frames.length)
  }

  const changeSpeed = () => {
    // Cycle through speeds: 1000ms -> 500ms -> 250ms -> 1000ms
    setSpeed(prev => prev === 1000 ? 500 : prev === 500 ? 250 : 1000)
  }

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="mb-3"
    >
      <div className="relative group bg-gradient-to-br from-indigo-50 to-cyan-50 rounded-xl p-3 border border-indigo-200">
        {/* Main frame display */}
        <div className="relative overflow-hidden rounded-lg bg-black">
          <AnimatePresence mode="wait">
            <motion.img
              key={currentFrame}
              src={frames[currentFrame]}
              alt={`Frame ${currentFrame + 1}`}
              className="w-full max-h-[400px] object-contain"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            />
          </AnimatePresence>
          
          {/* Frame indicator */}
          <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 rounded-lg text-white text-xs font-medium">
            Frame {currentFrame + 1}/{frames.length}
          </div>
          
          {/* Speed indicator */}
          <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 rounded-lg text-white text-xs font-medium">
            {speed === 1000 ? '1x' : speed === 500 ? '2x' : '4x'}
          </div>
        </div>
        
        {/* Controls */}
        <div className="flex items-center justify-center gap-2 mt-3">
          <button
            onClick={prevFrame}
            className="p-2 hover:bg-indigo-100 rounded-lg text-indigo-600 transition-all"
            title="Frame anterior"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="19 20 9 12 19 4 19 20"></polygon>
              <line x1="5" y1="19" x2="5" y2="5"></line>
            </svg>
          </button>
          
          <button
            onClick={togglePlayPause}
            className={`p-3 rounded-xl transition-all ${
              isPlaying 
                ? 'bg-indigo-500 text-white' 
                : 'bg-indigo-100 text-indigo-600'
            }`}
            title={isPlaying ? 'Pausar' : 'Reproducir'}
          >
            {isPlaying ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1"></rect>
                <rect x="14" y="4" width="4" height="16" rx="1"></rect>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            )}
          </button>
          
          <button
            onClick={nextFrame}
            className="p-2 hover:bg-indigo-100 rounded-lg text-indigo-600 transition-all"
            title="Siguiente frame"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 4 15 12 5 20 5 4"></polygon>
              <line x1="19" y1="5" x2="19" y2="19"></line>
            </svg>
          </button>
          
          <div className="w-px h-6 bg-indigo-200 mx-2" />
          
          <button
            onClick={changeSpeed}
            className="px-3 py-2 hover:bg-indigo-100 rounded-lg text-indigo-600 text-xs font-medium transition-all"
            title="Cambiar velocidad"
          >
            {speed === 1000 ? 'Normal' : speed === 500 ? 'Rápido' : 'Muy Rápido'}
          </button>
        </div>
        
        {/* Frame thumbnails */}
        <div className="flex gap-2 mt-3 overflow-x-auto py-1">
          {frames.map((frame, idx) => (
            <button
              key={idx}
              onClick={() => {
                setIsPlaying(false)
                setCurrentFrame(idx)
              }}
              className={`flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                idx === currentFrame 
                  ? 'border-indigo-500 ring-2 ring-indigo-300' 
                  : 'border-[var(--border-color)] hover:border-indigo-300'
              }`}
            >
              <img src={frame} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
        
        {/* Badge */}
        <div className="absolute bottom-14 left-3 px-2 py-1 bg-gradient-to-r from-indigo-500 to-cyan-500 rounded-lg text-white text-xs font-medium flex items-center gap-1">
          <Activity className="w-3 h-3" />
          Video Slideshow por OCTOPUS
        </div>
      </div>
    </motion.div>
  )
}

// ═══ FEEDBACK LOOP REAL DEL NAVEGADOR ═══
// Tras enviar comandos al Bridge, OCTOPUS espera y lee los resultados REALES
// (completed/failed/error) que el Bridge reporta a la base de datos.
interface BrowserPollResult {
  done: number
  failed: number
  total: number
  timedOut: boolean
  firstError: string | null
  currentUrl: string | null
}

async function pollBrowserCommandResults(
  commandIds: string[],
  onProgress?: (resolved: number, total: number) => void
): Promise<BrowserPollResult> {
  const total = commandIds.length
  let done = 0
  let failed = 0
  let firstError: string | null = null
  let currentUrl: string | null = null
  if (total === 0) return { done, failed, total, timedOut: false, firstError, currentUrl }
  const idSet = new Set(commandIds)
  for (let i = 0; i < 24; i++) {
    await new Promise((r) => setTimeout(r, 2500))
    try {
      const res = await fetch('/api/browser-bridge/sessions')
      if (!res.ok) continue
      const data = await res.json()
      const cmds: any[] = (data.sessions || []).flatMap((s: any) => {
        if (s.currentUrl) currentUrl = s.currentUrl
        return s.commands || []
      }).filter((c: any) => idSet.has(c.id))
      done = cmds.filter((c: any) => c.status === 'completed').length
      failed = cmds.filter((c: any) => c.status === 'failed').length
      if (!firstError) {
        const errCmd = cmds.find((c: any) => c.status === 'failed' && c.error)
        if (errCmd) firstError = `${errCmd.type}: ${errCmd.error}`
      }
      onProgress?.(done + failed, total)
      if (done + failed >= total) return { done, failed, total, timedOut: false, firstError, currentUrl }
    } catch { /* seguir intentando */ }
  }
  return { done, failed, total, timedOut: true, firstError, currentUrl }
}

function formatBrowserResult(label: string, r: BrowserPollResult): string {
  if (r.timedOut) {
    return `⏳ **${label}** — el navegador aún está ejecutando (${r.done + r.failed}/${r.total} comandos resueltos hasta ahora${r.failed > 0 ? `, ${r.failed} fallidos` : ''}). Ve a **Browser Automation** para ver el estado final y los screenshots.`
  }
  if (r.failed === 0) {
    return `✅ **${label} completada** — ${r.done}/${r.total} comandos ejecutados correctamente en tu navegador (verificado con feedback real del Bridge)${r.currentUrl ? `.\n🌐 Página actual: ${r.currentUrl}` : '.'}`
  }
  return `⚠️ **${label} con errores** — ${r.done} comandos OK, ${r.failed} fallidos de ${r.total}.${r.firstError ? `\n❌ Primer error: ${r.firstError}` : ''}\n📷 Revisa **Browser Automation** para los screenshots del fallo.`
}

export default function JarvisPage() {
  const router = useRouter()
  const { t, locale } = useI18n()
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'chat' | 'analysis' | 'graph' | 'bubbles'>('chat')
  const [graphData, setGraphData] = useState<{ nodes: { id: string; name: string; type: string; mentions: number }[]; edges: { id: string; source: string; target: string; predicate: string; weight: number; sourceName?: string; targetName?: string }[]; stats: { totalNodes: number; totalEdges: number; topEntities: { name: string; mentions: number }[] } } | null>(null)
  const [graphLoading, setGraphLoading] = useState(false)
  const [armsSyncStatus, setArmsSyncStatus] = useState<{ github: { connected: boolean; lastSync: string | null; itemCount: number }; gmail: { connected: boolean; lastSync: string | null; itemCount: number } } | null>(null)
  const [syncingArm, setSyncingArm] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  
  // Memory state - Persistencia de conversaciones
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isLoadingMemory, setIsLoadingMemory] = useState(true)
  const [userName, setUserName] = useState<string | null>(null)
  
  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [notifications, setNotifications] = useState<CreationNotification[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [dbAgents, setDbAgents] = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [dbSkills, setDbSkills] = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [dbMcps, setDbMcps] = useState<any[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  // Consulta inicial desde la home chat-first (/dashboard?q=...) — se auto-envía al cargar
  const autoQueryRef = useRef<string | null>(null)
  // 🎨 Canvas — proyecto web renderizado en vivo junto al chat
  const [canvasProject, setCanvasProject] = useState<{ projectId: string; title: string; files: CanvasFile[] } | null>(null)
  const [showCanvas, setShowCanvas] = useState(false)
  const [canvasRefreshKey, setCanvasRefreshKey] = useState(0)
  // Auto-corrección: una sola ronda por render (evita loops infinitos)
  const canvasFixDoneRef = useRef<string>('')
  const canvasFixingRef = useRef(false)
  const [dragActive, setDragActive] = useState(false)
  // Multi-image support: up to 10 images per message. First item is the "primary" image for backward compat.
  const [pendingImages, setPendingImages] = useState<Array<{ data: string; name: string }>>([])
  const MAX_IMAGES = 10
  // Document state
  const [pendingDocument, setPendingDocument] = useState<{ name: string; type: string; base64: string; mime: string; preExtractedText?: string } | null>(null)
  const [pendingVideo, setPendingVideo] = useState<{ name: string; base64: string; mime: string } | null>(null)
  const [isPreProcessing, setIsPreProcessing] = useState(false)
  
  // Voice state
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [interimTranscript, setInterimTranscript] = useState('')
  const [micPermission, setMicPermission] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null) // Unlock audio playback
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const autoSendAfterSpeechRef = useRef(false)
  const finalTranscriptRef = useRef('')
  const isListeningRef = useRef(false)
  const speechTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  // 🔗 Encadenamiento creativo → navegador: última imagen generada (persiste entre turnos)
  const lastGeneratedImageUrlRef = useRef<string | null>(null)
  const voiceRestartLockRef = useRef(false) // Prevent concurrent restart attempts
  const voiceRetryCountRef = useRef(0) // Limit retries to prevent infinite loops
  const micVerifiedRef = useRef(false) // True once getUserMedia succeeds
  const VOICE_MAX_RETRIES = 3 // For generic errors
  const VOICE_AUDIO_CAPTURE_MAX = 5 // audio-capture — if mic isn't verified, stop fast
  // Barge-in: interrupt TTS when user speaks
  const bargeInAnalyserRef = useRef<AnalyserNode | null>(null)
  const bargeInStreamRef = useRef<MediaStream | null>(null)
  const bargeInAudioCtxRef = useRef<AudioContext | null>(null)
  const bargeInIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const bargeInCooldownRef = useRef(false) // prevent double triggers
  // 🛡️ LAST EMAIL DRAFT MEMORY — stores params from the last email draft/send shown by OCTOPUS
  // Used to auto-fill when LLM forgets params on "luz verde" / confirmations
  const lastEmailDraftRef = useRef<Record<string, unknown> | null>(null)
  // Tool system: queued frontend actions from server-side tool execution
  const toolFrontendActionsRef = useRef<Array<{type: string; payload: Record<string, unknown>}>>([])
  // Keep isListeningRef in sync with isListening state (avoids stale closure in recognition handlers)
  useEffect(() => { isListeningRef.current = isListening }, [isListening])
  // Voice Conversation Mode — continuous loop: listen → AI → speak → listen
  const [voiceMode, setVoiceMode] = useState(false)
  const voiceModeRef = useRef(false)
  const [voicePhase, setVoicePhase] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle')
  // Voice language independent from UI locale — defaults to Spanish
  const [voiceLang, setVoiceLang] = useState<'es' | 'en'>('es')
  const voiceLangRef = useRef<'es' | 'en'>('es')
  useEffect(() => { voiceLangRef.current = voiceLang }, [voiceLang])
  
  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [insights, setInsights] = useState<string[]>([])
  const [jarvisThought, setJarvisThought] = useState('')
  const [systemHealth, setSystemHealth] = useState<'optimal' | 'good' | 'degraded' | 'critical'>('good')
  const [consciousnessLevel, setConsciousnessLevel] = useState(75)
  const [consciousnessDimensions, setConsciousnessDimensions] = useState({
    operativa: 50,
    datos: 50,
    predictiva: 50,
    relacional: 50,
  })
  const [analysisCount, setAnalysisCount] = useState(0)
  const [evolutionLog, setEvolutionLog] = useState<{ date: string; level: number; event: string }[]>([])
  const [consciousnessExpanded, setConsciousnessExpanded] = useState(false)
  const [selectedRec, setSelectedRec] = useState<Recommendation | null>(null)
  const [implementingId, setImplementingId] = useState<string | null>(null)
  
  const { activities, addActivity, turbo, toggleTurbo } = useMetrics()
  const { upgradeModal, closeUpgradeModal, showUpgradeModal, usage } = usePlanGate()
  const { theme, setTheme, isDark } = useTheme()
  const chatEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isUserScrolledUpRef = useRef(false)

  // 🔍 Image Lightbox — zoom/pan before download
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const [lightboxZoom, setLightboxZoom] = useState(1)
  const [lightboxOffset, setLightboxOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null)

  const openLightbox = useCallback((src: string) => {
    setLightboxImage(src)
    setLightboxZoom(1)
    setLightboxOffset({ x: 0, y: 0 })
  }, [])
  const closeLightbox = useCallback(() => {
    setLightboxImage(null)
    setLightboxZoom(1)
    setLightboxOffset({ x: 0, y: 0 })
  }, [])

  // ESC to close + keyboard shortcuts
  useEffect(() => {
    if (!lightboxImage) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox()
      else if (e.key === '+' || e.key === '=') setLightboxZoom(z => Math.min(z * 1.25, 8))
      else if (e.key === '-' || e.key === '_') setLightboxZoom(z => Math.max(z / 1.25, 0.5))
      else if (e.key === '0') { setLightboxZoom(1); setLightboxOffset({ x: 0, y: 0 }) }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [lightboxImage, closeLightbox])

  // Track if user scrolled up manually — don't auto-jump if they're reading history
  useEffect(() => {
    const container = chatContainerRef.current
    if (!container) return
    const handleScroll = () => {
      // 80px threshold — if user is within 80px of bottom, treat as "at bottom"
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
      isUserScrolledUpRef.current = distanceFromBottom > 80
    }
    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  // Auto-scroll chat — LOCAL to container only, never the window
  useEffect(() => {
    const container = chatContainerRef.current
    if (!container) return
    // Skip if user is reading history (scrolled up manually)
    if (isUserScrolledUpRef.current) return
    // Use rAF to scroll after paint — no window jump, no jitter
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight
    })
  }, [messages])
  
  // Watermark preference
  const [showWatermark, setShowWatermark] = useState(true)
  useEffect(() => {
    fetch('/api/settings/watermark').then(r => r.json()).then(d => {
      if (typeof d.showWatermark === 'boolean') setShowWatermark(d.showWatermark)
    }).catch(() => {})
  }, [])

  // 🧠 Load persistent consciousness on mount
  useEffect(() => {
    fetch('/api/jarvis/consciousness').then(r => r.json()).then(d => {
      if (typeof d.overallLevel === 'number') setConsciousnessLevel(Math.round(d.overallLevel))
      if (d.operativa !== undefined) setConsciousnessDimensions({
        operativa: Math.round(d.operativa),
        datos: Math.round(d.datos),
        predictiva: Math.round(d.predictiva),
        relacional: Math.round(d.relacional),
      })
      if (typeof d.analysisCount === 'number') setAnalysisCount(d.analysisCount)
      if (Array.isArray(d.evolutionLog)) setEvolutionLog(d.evolutionLog)
    }).catch(() => {})
  }, [])

  // 🎨 Image Model Selector — manual selection + auto-detection from user message
  const [imageModel, setImageModel] = useState<string>('auto')
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [hasOpenRouterKey, setHasOpenRouterKey] = useState(false)
  useEffect(() => {
    // Cargar preferencia de modelo desde localStorage
    const saved = typeof window !== 'undefined' ? localStorage.getItem('octopus_chat_image_model') : null
    if (saved) setImageModel(saved)
    // Check si el usuario tiene clave OpenRouter/turbo configurada
    fetch('/api/ad-factory/config').then(r => r.ok ? r.json() : null).then(d => {
      if (d) setHasOpenRouterKey(!!d.hasOpenRouterKey)
    }).catch(() => {})
  }, [])
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('octopus_chat_image_model', imageModel)
    }
  }, [imageModel])

  // 🧠 Chat Model Selector — override qué LLM responde el chat (independiente de Turbo)
  const [chatModel, setChatModel] = useState<string>('auto')
  const [showChatModelPicker, setShowChatModelPicker] = useState(false)
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('octopus_chat_llm_model') : null
    if (saved) setChatModel(saved)
  }, [])
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('octopus_chat_llm_model', chatModel)
  }, [chatModel])

  // Track saved message IDs to avoid duplicates
  const savedMessageIdsRef = useRef<Set<string>>(new Set())
  const messagesRef = useRef<ChatMessage[]>([])
  const abortControllerRef = useRef<AbortController | null>(null)
  // Keep messagesRef always in sync
  useEffect(() => { messagesRef.current = messages }, [messages])

  // MEMORY SYSTEM: Cargar conversación al montar
  useEffect(() => {
    const loadMemory = async () => {
      try {
        setIsLoadingMemory(true)
        const response = await fetch('/api/jarvis/memory')
        
        if (response.ok) {
          const data = await response.json()
          setSessionId(data.sessionId)
          setUserName(data.userName || null)
          
          if (data.messages && data.messages.length > 0) {
            // Convertir timestamps a Date objects
            const loadedMessages = data.messages.map((msg: ChatMessage & { timestamp: string }) => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            }))
            // Mark loaded messages as already saved so they don't get re-saved
            loadedMessages.forEach((m: ChatMessage) => savedMessageIdsRef.current.add(m.id))
            setMessages(loadedMessages)
          } else {
            // Si no hay mensajes, mostrar mensaje de bienvenida personalizado
            const uName = data.userName ? ` **${data.userName}**` : ''
            const isEN = locale === 'en'
            const welcomeMessage: ChatMessage = {
              id: 'welcome',
              role: 'assistant',
              content: isEN
                ? `Hey${uName}! I'm **OCTOPUS** 🐙, your assistant with infinite memory.

I have **RAG 2.0** built-in — I learn from every conversation and remember your preferences.

I can help you with:
- 🎨 **Generate images** - say "generate an image of..."
- 🎬 **Create animated videos** - say "generate a video of..."
- 🌐 **Search the web** - say "search..." or "research about..."
- 🧠 **Learn about you** - everything you tell me, I remember
- 🛠️ **Build tools** - skills, agents, MCPs
- 🧭 **Navigation** - "go to projects" or "take me to brazos"
- 📡 **Post on LinkedIn** - "post on LinkedIn: your text here"

What would you like to do today?`
                : `¡Hola${uName}! Soy **OCTOPUS** 🐙, tu asistente con memoria infinita.

Tengo **RAG 2.0** integrado - aprendo de cada conversación y recuerdo tus preferencias.

Puedo ayudarte con:
- 🎨 **Generar imágenes** - dime "genera una imagen de..."
- 🎬 **Crear videos animados** - dime "genera un video de..."
- 🌐 **Buscar en la web** - dime "busca..." o "investiga sobre..."
- 🧠 **Aprender de ti** - todo lo que me cuentes lo recuerdo
- 🛠️ **Crear herramientas** - skills, agentes, MCPs
- 🧭 **Navegación** - "vamos a proyectos" o "llévame a brazos"
- 📡 **Publicar en LinkedIn** - "publica en LinkedIn: tu texto aquí"

¿Qué quieres hacer hoy?`,
              timestamp: new Date(),
            }
            setMessages([welcomeMessage])
            // Guardar el mensaje de bienvenida
            if (data.sessionId) {
              await saveMessageToMemory(data.sessionId, welcomeMessage)
            }
          }
        }
      } catch (error) {
        console.error('Error loading JARVIS memory:', error)
        // Si falla, mostrar mensaje de bienvenida por defecto
        setMessages([{
          id: 'welcome',
          role: 'assistant',
          content: locale === 'en'
            ? `Hey! I'm **OCTOPUS** 🐙, your assistant with infinite memory.

I have **RAG 2.0** built-in — I learn from every conversation.

I can help you with:
- 🎨 **Generate images** - say "generate an image of..."
- 🎬 **Create videos** - say "generate a video of..."
- 🧠 **Learn about you** - everything you tell me, I remember
- 🛠️ **Build tools** - skills, agents, MCPs

What would you like to do today?`
            : `¡Hola! Soy **OCTOPUS** 🐙, tu asistente con memoria infinita.

Tengo **RAG 2.0** integrado - aprendo de cada conversación.

Puedo ayudarte con:
- 🎨 **Generar imágenes** - dime "genera una imagen de..."
- 🎬 **Crear videos** - dime "genera un video de..."
- 🧠 **Aprender de ti** - todo lo que me cuentes lo recuerdo
- 🛠️ **Crear herramientas** - skills, agentes, MCPs

¿Qué quieres hacer hoy?`,
          timestamp: new Date(),
        }])
      } finally {
        setIsLoadingMemory(false)
      }
    }
    
    loadMemory()
  }, [])

  // Home chat-first: leer ?q= al montar y auto-enviar cuando la memoria cargue
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('q')
      if (q?.trim()) {
        autoQueryRef.current = q.trim()
        setInputMessage(q.trim())
        // Limpiar la URL para no re-enviar al refrescar
        window.history.replaceState({}, '', window.location.pathname)
      }
    } catch { /* SSR-safe */ }
  }, [])

  useEffect(() => {
    if (!autoQueryRef.current || isLoadingMemory || isStreaming) return
    if (inputMessage !== autoQueryRef.current) return
    autoQueryRef.current = null
    sendMessage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingMemory, inputMessage])

  // 🧬 Marketplace: ?canvas=<projectId> — abre un proyecto (p.ej. fork de plantilla)
  // directamente en el panel Canvas al montar
  useEffect(() => {
    try {
      const pid = new URLSearchParams(window.location.search).get('canvas')
      if (!pid) return
      window.history.replaceState({}, '', window.location.pathname)
      ;(async () => {
        const res = await fetch(`/api/canvas?projectId=${pid}`)
        if (!res.ok) return
        const data = await res.json()
        setCanvasProject({ projectId: data.projectId, title: data.title, files: data.files })
        setCanvasRefreshKey(k => k + 1)
        setShowCanvas(true)
      })()
    } catch { /* SSR-safe */ }
  }, [])

  // ============================================
  // 🎨 CANVAS — AUTO-CORRECCIÓN (verifica antes de entregar)
  // El preview reporta errores reales (JS, recursos rotos, console.error)
  // → una ronda automática de arreglo. Máx 1 por render para evitar loops.
  // ============================================
  const runCanvasAutoFix = async (logs: { kind: string; message: string }[]) => {
    if (!canvasProject || logs.length === 0) return
    const fixKey = `${canvasProject.projectId}:${canvasRefreshKey}`
    if (canvasFixDoneRef.current === fixKey || canvasFixingRef.current || isStreaming) return
    canvasFixDoneRef.current = fixKey
    canvasFixingRef.current = true

    const fixMsgId = `assistant-fix-${Date.now()}`
    const isEn = locale === 'en'
    setMessages(prev => [...prev, {
      id: fixMsgId,
      role: 'assistant' as const,
      content: isEn
        ? `⚙️ *Verification found ${logs.length} issue(s) in the preview — fixing automatically…*`
        : `⚙️ *La verificación detectó ${logs.length} problema(s) en el preview — corrigiendo automáticamente…*`,
      timestamp: new Date(),
    }])

    try {
      const errorList = logs.slice(0, 12).map(l => `- [${l.kind}] ${l.message}`).join('\n')
      const res = await fetch('/api/jarvis/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `[VERIFICADOR AUTOMÁTICO DEL CANVAS] El preview del proyecto reporta estos errores reales en ejecución:\n${errorList}\n\nCorrige los archivos afectados re-emitiéndolos COMPLETOS en bloques \`\`\`file:ruta. NO expliques, solo corrige.`,
          history: messages.slice(-20).map(m => ({ role: m.role, content: m.content })),
          canvas: { projectId: canvasProject.projectId },
        }),
      })
      if (!res.ok) throw new Error('fix request failed')

      const reader = res.body?.getReader()
      if (!reader) throw new Error('no reader')
      const decoder = new TextDecoder()
      let fixContent = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
          if (!line.startsWith('data: ')) continue
          try {
            const p = JSON.parse(line.slice(6))
            if (p.content) fixContent += p.content
          } catch { /* skip */ }
        }
      }

      const parsed = parseCanvasFiles(fixContent)
      if (parsed.files.length > 0) {
        const saveRes = await fetch('/api/canvas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: canvasProject.projectId, files: parsed.files }),
        })
        if (saveRes.ok) {
          const saved = await saveRes.json()
          setCanvasProject(prev => prev ? { ...prev, files: saved.files } : prev)
          setCanvasRefreshKey(k => k + 1)
          setMessages(prev => prev.map(m => m.id === fixMsgId ? {
            ...m,
            content: isEn
              ? `✅ *Auto-fix applied: ${parsed.files.length} file(s) corrected and re-rendered.*`
              : `✅ *Auto-corrección aplicada: ${parsed.files.length} archivo(s) corregido(s) y re-renderizado(s).*`,
          } : m))
        }
      } else {
        setMessages(prev => prev.map(m => m.id === fixMsgId ? {
          ...m,
          content: isEn
            ? `⚠️ *Verification found ${logs.length} issue(s). Ask me to fix them if they affect your project.*`
            : `⚠️ *La verificación detectó ${logs.length} problema(s). Pídeme corregirlos si afectan tu proyecto.*`,
        } : m))
      }
    } catch (err) {
      console.error('[Canvas] Auto-fix error:', err)
      setMessages(prev => prev.filter(m => m.id !== fixMsgId))
    } finally {
      canvasFixingRef.current = false
    }
  }

  // ============================================
  // 👁️ CANVAS — VISIÓN VÍA BRIDGE
  // El navegador real del PC del usuario captura el proyecto;
  // OCTOPUS analiza la imagen y corrige problemas visuales.
  // ============================================
  const runCanvasVision = async () => {
    if (!canvasProject || canvasFixingRef.current || isStreaming) return
    const isEn = locale === 'en'
    const visionMsgId = `assistant-vision-${Date.now()}`

    const pushMsg = (content: string, image?: string) => {
      setMessages(prev => {
        const exists = prev.some(m => m.id === visionMsgId)
        if (exists) return prev.map(m => m.id === visionMsgId ? { ...m, content, ...(image ? { image } : {}) } : m)
        return [...prev, { id: visionMsgId, role: 'assistant' as const, content, ...(image ? { image } : {}), timestamp: new Date() }]
      })
    }

    pushMsg(isEn ? '👁️ *Requesting real capture via Bridge…*' : '👁️ *Solicitando captura real vía Bridge…*')

    try {
      // 1. Encolar goto + screenshot en el navegador del PC
      const res = await fetch('/api/canvas/vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: canvasProject.projectId }),
      })
      const data = await res.json()
      if (!data.success) {
        pushMsg(data.error === 'bridge_offline'
          ? (isEn
            ? '⚠️ *The Bridge is offline. Open the Octopus Bridge on your PC to use vision.*'
            : '⚠️ *El Bridge está desconectado. Abre el Octopus Bridge en tu PC para usar la visión.*')
          : `⚠️ ${data.message || data.error}`)
        return
      }

      // 2. Polling del screenshot (máx 60s)
      pushMsg(isEn ? '📸 *Capturing on your PC browser…*' : '📸 *Capturando en el navegador de tu PC…*')
      let screenshotUrl: string | null = null
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000))
        const poll = await fetch(`/api/canvas/vision?commandId=${data.screenshotCommandId}`)
        const st = await poll.json()
        if (st.status === 'completed' && st.screenshotUrl) { screenshotUrl = st.screenshotUrl; break }
        if (st.status === 'failed') {
          pushMsg(isEn ? `⚠️ *Capture failed: ${st.error || 'Bridge error'}*` : `⚠️ *La captura falló: ${st.error || 'error del Bridge'}*`)
          return
        }
      }
      if (!screenshotUrl) {
        pushMsg(isEn
          ? '⚠️ *Timeout waiting for the capture (60s). Check the Bridge on your PC.*'
          : '⚠️ *Tiempo de espera agotado (60s). Revisa el Bridge en tu PC.*')
        return
      }

      // 3. Análisis visual + posible corrección (la imagen va al LLM, no credenciales)
      pushMsg(isEn ? '🧠 *Analyzing the capture visually…*' : '🧠 *Analizando la captura visualmente…*', screenshotUrl)
      canvasFixingRef.current = true

      const visRes = await fetch('/api/jarvis/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: '[VISIÓN DEL CANVAS] Esta es una captura REAL del proyecto renderizado en el navegador. '
            + 'Revisa diseño, alineación, contraste, textos cortados o elementos rotos. '
            + 'Si encuentras problemas visuales, corrígelos re-emitiendo los archivos afectados COMPLETOS en bloques ```file:ruta y resume en 2 líneas qué arreglaste. '
            + 'Si todo se ve bien, dilo en 1-2 líneas sin re-emitir archivos.',
          imagesBase64: [screenshotUrl],
          history: messages.slice(-12).map(m => ({ role: m.role, content: m.content })),
          canvas: { projectId: canvasProject.projectId },
        }),
      })
      if (!visRes.ok) throw new Error('vision chat failed')

      const reader = visRes.body?.getReader()
      if (!reader) throw new Error('no reader')
      const decoder = new TextDecoder()
      let visContent = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
          if (!line.startsWith('data: ')) continue
          try {
            const p = JSON.parse(line.slice(6))
            if (p.content) visContent += p.content
          } catch { /* skip */ }
        }
      }

      const parsed = parseCanvasFiles(visContent)
      if (parsed.files.length > 0) {
        const saveRes = await fetch('/api/canvas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: canvasProject.projectId, files: parsed.files }),
        })
        if (saveRes.ok) {
          const saved = await saveRes.json()
          setCanvasProject(prev => prev ? { ...prev, files: saved.files } : prev)
          setCanvasRefreshKey(k => k + 1)
        }
        pushMsg(
          `${parsed.cleaned || ''}\n\n👁️✅ ${isEn
            ? `*Visual review: ${parsed.files.length} file(s) corrected and re-rendered.*`
            : `*Revisión visual: ${parsed.files.length} archivo(s) corregido(s) y re-renderizado(s).*`}`,
          screenshotUrl
        )
      } else {
        pushMsg(
          `${visContent.trim() || (isEn ? '👁️ Visual review complete.' : '👁️ Revisión visual completa.')}`,
          screenshotUrl
        )
      }
    } catch (err) {
      console.error('[Canvas] Vision error:', err)
      pushMsg(locale === 'en' ? '⚠️ *Vision flow error.*' : '⚠️ *Error en el flujo de visión.*')
    } finally {
      canvasFixingRef.current = false
    }
  }

  // ============================================
  // 🌐 CANVAS — CLONAR SITIO EXTERNO VÍA BRIDGE
  // El Bridge navega al sitio, captura screenshot, el LLM replica el diseño
  // en un nuevo proyecto Canvas manteniendo la identidad/contenido del usuario.
  // ============================================
  const runCanvasClone = async (targetUrl: string) => {
    if (canvasFixingRef.current || isStreaming) return
    canvasFixingRef.current = true
    const isEn = locale === 'en'
    const cloneMsgId = `assistant-clone-${Date.now()}`

    const pushMsg = (content: string) => {
      setMessages(prev => {
        const existing = prev.find(m => m.id === cloneMsgId)
        if (existing) return prev.map(m => m.id === cloneMsgId ? { ...m, content } : m)
        return [...prev, { id: cloneMsgId, role: 'assistant' as const, content, timestamp: new Date() }]
      })
    }

    try {
      // 1. Iniciar captura
      pushMsg(isEn ? `🌐 *Capturing ${targetUrl} via Bridge…*` : `🌐 *Capturando ${targetUrl} vía Bridge…*`)

      const res = await fetch('/api/canvas/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      })
      const data = await res.json()
      if (!data.success) {
        const msg = data.error === 'bridge_offline'
          ? (isEn ? '⚠️ Bridge offline. Open it on your PC.' : '⚠️ Bridge desconectado. Ábrelo en tu PC.')
          : (data.message || data.error || 'Error')
        pushMsg(msg)
        return
      }

      // 2. Polling del screenshot
      pushMsg(isEn ? `🌐 *Waiting for screenshot… (up to 30s)*` : `🌐 *Esperando captura… (hasta 30s)*`)
      let screenshotUrl: string | null = null
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 1000))
        const poll = await fetch(`/api/canvas/vision?commandId=${data.screenshotCommandId}`)
        const pd = await poll.json()
        if (pd.status === 'completed' && pd.screenshotUrl) { screenshotUrl = pd.screenshotUrl; break }
        if (pd.status === 'failed') { pushMsg(isEn ? '⚠️ Capture failed.' : '⚠️ Captura fallida.'); return }
      }
      if (!screenshotUrl) { pushMsg(isEn ? '⚠️ Capture timeout.' : '⚠️ Tiempo de espera agotado.'); return }

      // 3. Enviar al LLM para clonar el diseño
      pushMsg(isEn
        ? `📸 *Site captured. OCTOPUS is now replicating the design…*`
        : `📸 *Sitio capturado. OCTOPUS está replicando el diseño…*`
      )
      const clonePrompt = isEn
        ? `The image shows the website at ${targetUrl}. Analyze its visual design carefully:\n• Color palette, typography, spacing\n• Layout: header, hero, sections, footer structure\n• UI components: buttons, cards, nav style\n\nNow create a complete clone of this design as a new project. Use the same visual language but with placeholder content. Emit all files as file blocks using the canvas contract.`
        : `La imagen muestra el sitio web en ${targetUrl}. Analiza su diseño visual con detalle:\n• Paleta de colores, tipografía, espaciado\n• Layout: header, hero, secciones, footer\n• Componentes UI: botones, tarjetas, estilo de navegación\n\nCrea ahora una clonación completa de este diseño como nuevo proyecto. Usa el mismo lenguaje visual pero con contenido de placeholder. Emite todos los archivos en bloques de archivo usando el contrato del canvas.`

      const cloneRes = await fetch('/api/jarvis/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: clonePrompt,
          imagesBase64: [screenshotUrl],
          history: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
        }),
      })
      if (!cloneRes.ok || !cloneRes.body) { pushMsg(isEn ? '⚠️ LLM error.' : '⚠️ Error del modelo.'); return }

      const reader = cloneRes.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        fullText += decoder.decode(value, { stream: true })
        const { stripCanvasBlocksForDisplay } = await import('@/lib/octopus-canvas')
        pushMsg(stripCanvasBlocksForDisplay(fullText))
      }

      // 4. Guardar proyecto clonado
      const { parseCanvasFiles } = await import('@/lib/octopus-canvas')
      const parsed = parseCanvasFiles(fullText)
      if (parsed.files.length > 0) {
        const saveRes = await fetch('/api/canvas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `Clon de ${new URL(targetUrl).hostname}`,
            files: parsed.files,
          }),
        })
        if (saveRes.ok) {
          const saved = await saveRes.json()
          setCanvasProject({ projectId: saved.projectId, title: saved.title, files: saved.files })
          setCanvasRefreshKey(k => k + 1)
          setShowCanvas(true)
          canvasFixDoneRef.current = ''
        }
      }
    } catch (err) {
      console.error('[Canvas] Clone error:', err)
      pushMsg(isEn ? '⚠️ *Clone flow error.*' : '⚠️ *Error en el flujo de clonación.*')
    } finally {
      canvasFixingRef.current = false
    }
  }

  // MEMORY SYSTEM: Guardar mensaje en la base de datos
  const saveMessageToMemory = async (sid: string, message: ChatMessage) => {
    try {
      await fetch('/api/jarvis/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sid,
          message: {
            role: message.role,
            content: message.content,
            generatedImage: message.generatedImage,
            actionResult: message.actionResult,
          }
        })
      })
    } catch (error) {
      console.error('Error saving message to memory:', error)
    }
  }

  // MEMORY SYSTEM: Auto-save messages when streaming completes
  const wasStreamingRef = useRef(false)
  const sessionIdRef = useRef(sessionId)
  useEffect(() => { sessionIdRef.current = sessionId }, [sessionId])

  useEffect(() => {
    if (wasStreamingRef.current && !isStreaming && sessionIdRef.current) {
      // Streaming just ended — save ALL unsaved messages (incluye resultados de
      // herramientas: listados de prospección, búsquedas, pasos multi-step).
      // Pequeño delay para que los resultados asíncronos de tools terminen de aterrizar.
      const sid = sessionIdRef.current
      const persistAll = () => {
        const currentMessages = messagesRef.current
        const recent = currentMessages.slice(-30)
        for (const m of recent) {
          if (m.id === 'welcome') continue
          if ((m.role !== 'user' && m.role !== 'assistant') || !m.content || m.content.length === 0) continue
          if (savedMessageIdsRef.current.has(m.id)) continue
          savedMessageIdsRef.current.add(m.id)
          saveMessageToMemory(sid, m)
        }
      }
      // Guardado inmediato + reintento diferido para capturar mensajes que
      // se agregan después del fin del stream (acciones del frontend).
      persistAll()
      setTimeout(persistAll, 4000)
      setTimeout(persistAll, 12000)
    }
    wasStreamingRef.current = isStreaming
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming])

  // MEMORY SYSTEM: Limpiar memoria
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  
  const clearMemory = async () => {
    if (!sessionId) return
    
    try {
      const response = await fetch(`/api/jarvis/memory?sessionId=${sessionId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        // Reiniciar con mensaje de bienvenida
        const welcomeMessage: ChatMessage = {
          id: 'welcome',
          role: 'assistant',
          content: `¡Memoria limpiada! 🧹 

Soy **OCTOPUS** 🐙, listo para empezar de nuevo${userName ? `, **${userName}**` : ''}. ¿En qué puedo ayudarte?`,
          timestamp: new Date(),
        }
        setMessages([welcomeMessage])
        savedMessageIdsRef.current.clear()
        await saveMessageToMemory(sessionId, welcomeMessage)
        addActivity('🧹 OCTOPUS: Memoria de conversación limpiada')
      }
    } catch (error) {
      console.error('Error clearing memory:', error)
    }
    setShowClearConfirm(false)
  }

  // ============================================
  // PHASE 2: Knowledge Graph & Arms functions
  // ============================================
  const loadGraphData = useCallback(async () => {
    setGraphLoading(true)
    try {
      const res = await fetch('/api/octopus/graph')
      if (res.ok) {
        const data = await res.json()
        setGraphData(data)
      }
    } catch (error) {
      console.error('Error loading graph:', error)
    } finally {
      setGraphLoading(false)
    }
  }, [])

  const loadArmsStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/octopus/arms')
      if (res.ok) {
        const data = await res.json()
        setArmsSyncStatus(data)
      }
    } catch (error) {
      console.error('Error loading arms status:', error)
    }
  }, [])

  const syncArm = async (armType: string) => {
    setSyncingArm(armType)
    try {
      const res = await fetch('/api/octopus/arms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ armType }),
      })
      const data = await res.json()
      if (res.ok) {
        addActivity(`🔗 Brazo ${armType} sincronizado: ${data.imported} items importados`)
        await loadGraphData()
        await loadArmsStatus()
      } else {
        addActivity(`❌ Error sincronizando ${armType}: ${data.error}`)
      }
    } catch (error) {
      console.error('Error syncing arm:', error)
    } finally {
      setSyncingArm(null)
    }
  }

  const clearGraph = async () => {
    try {
      const res = await fetch('/api/octopus/graph?clearAll=true', { method: 'DELETE' })
      if (res.ok) {
        setGraphData(null)
        addActivity('🗑️ Knowledge Graph limpiado')
        await loadGraphData()
      }
    } catch (error) {
      console.error('Error clearing graph:', error)
    }
  }

  // Load graph when tab switches
  useEffect(() => {
    if (activeTab === 'graph') {
      loadGraphData()
      loadArmsStatus()
    }
  }, [activeTab, loadGraphData, loadArmsStatus])

  // Check microphone permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.permissions) {
      navigator.permissions.query({ name: 'microphone' as PermissionName }).then(result => {
        setMicPermission(result.state as 'granted' | 'denied' | 'prompt')
        result.onchange = () => {
          setMicPermission(result.state as 'granted' | 'denied' | 'prompt')
        }
      }).catch(() => {
        setMicPermission('unknown')
      })
    }
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis
    }
  }, [])

  // Initialize / reinitialize speech recognition when voiceLang changes
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognitionAPI) return

    // Clean up previous instance
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch {}
      recognitionRef.current = null
    }
    
    const recognition = new SpeechRecognitionAPI() as SpeechRecognitionInstance
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    recognition.lang = voiceLang === 'en' ? 'en-US' : 'es-ES'
    
    recognition.onaudiostart = () => {
      setMicPermission('granted')
      micVerifiedRef.current = true
      voiceRetryCountRef.current = 0 // Audio started = mic is working
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      let finalText = ''
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const transcript = result[0].transcript
        if (result.isFinal) {
          finalText += transcript
        } else {
          interim += transcript
        }
      }
      
      if (finalText) {
        finalTranscriptRef.current += (finalTranscriptRef.current ? ' ' : '') + finalText.trim()
        setInputMessage(finalTranscriptRef.current)
        setInterimTranscript('')
        console.log('[Speech] Final text:', finalTranscriptRef.current)
        
        // Safety timeout: if onspeechend doesn't fire within 2s after final text, force stop
        // This handles Chrome's continuous mode where onspeechend may not fire reliably
        if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current)
        speechTimeoutRef.current = setTimeout(() => {
          if (recognitionRef.current && isListeningRef.current && finalTranscriptRef.current.trim()) {
            console.log('[Speech] Safety timeout — forcing stop after final text')
            try { recognitionRef.current.stop() } catch {}
          }
        }, 2000)
      } else if (interim) {
        setInterimTranscript(interim)
        // Reset safety timeout while user is still speaking (interim results coming)
        if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current)
      }
    }
    
    // Helper: safe restart with lock to prevent concurrent attempts
    const safeVoiceRestart = (reason: string, delay: number = 800, maxRetries: number = VOICE_MAX_RETRIES) => {
      if (!voiceModeRef.current) return
      if (voiceRestartLockRef.current) {
        // Don't log every blocked attempt to reduce console spam
        return
      }
      voiceRetryCountRef.current++
      if (voiceRetryCountRef.current > maxRetries) {
        console.warn(`[VoiceMode] Max retries (${maxRetries}) reached for ${reason}. Stopping voice mode.`)
        voiceModeRef.current = false
        setVoiceMode(false)
        setVoicePhase('idle')
        voiceRetryCountRef.current = 0
        voiceRestartLockRef.current = false
        addActivity('⚠️ Modo Voz pausado — no se pudo acceder al micrófono. Verifica permisos y vuelve a activar.')
        return
      }
      voiceRestartLockRef.current = true
      // Only log every few attempts to reduce console spam
      if (voiceRetryCountRef.current <= 3 || voiceRetryCountRef.current % 5 === 0) {
        console.log(`[VoiceMode] Restart (${reason}), attempt ${voiceRetryCountRef.current}/${maxRetries}, delay ${delay}ms`)
      }
      setTimeout(() => {
        voiceRestartLockRef.current = false
        if (!voiceModeRef.current) return
        // Make sure recognition is stopped before starting
        try { recognitionRef.current?.stop() } catch {}
        setTimeout(() => {
          if (!voiceModeRef.current) return
          try {
            finalTranscriptRef.current = ''
            autoSendAfterSpeechRef.current = true
            setInterimTranscript('')
            recognitionRef.current?.start()
            setIsListening(true)
            setVoicePhase('listening')
            if (voiceRetryCountRef.current <= 3 || voiceRetryCountRef.current % 5 === 0) {
              console.log(`[VoiceMode] ✅ Restarted (${reason})`)
            }
          } catch (err) {
            console.warn(`[VoiceMode] Restart failed (${reason}):`, err)
            voiceRestartLockRef.current = false
          }
        }, 250)
      }, delay)
    }

    recognition.onerror = (event: Event & { error: string }) => {
      console.warn('[Speech] Error:', event.error)
      setIsListening(false)
      setInterimTranscript('')
      
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        setMicPermission('denied')
        addActivity('🚫 Permiso de micrófono denegado. Actívalo en la configuración del navegador.')
        // Kill voice mode on permission error — no retry
        if (voiceModeRef.current) {
          voiceModeRef.current = false
          setVoiceMode(false)
          setVoicePhase('idle')
          voiceRetryCountRef.current = 0
        }
      } else if (event.error === 'no-speech') {
        // User hasn't spoken — in voice mode, restart silently; reset retry count (not a real error)
        if (voiceModeRef.current) {
          voiceRetryCountRef.current = 0 // no-speech is normal, don't count as retry
          safeVoiceRestart('no-speech', 500)
        } else {
          addActivity('🤔 No detecté voz. Intenta de nuevo.')
        }
      } else if (event.error === 'aborted') {
        // Aborted intentionally — don't retry from onerror, let onend handle it
        console.log('[Speech] Aborted — letting onend handle restart if needed')
      } else if (event.error === 'audio-capture') {
        if (voiceModeRef.current) {
          // If mic was never verified by getUserMedia, don't waste retries — stop fast
          if (!micVerifiedRef.current && voiceRetryCountRef.current >= 2) {
            console.warn('[VoiceMode] Mic never verified + audio-capture errors. Stopping.')
            voiceModeRef.current = false
            setVoiceMode(false)
            setVoicePhase('idle')
            voiceRetryCountRef.current = 0
            voiceRestartLockRef.current = false
            addActivity('⚠️ No se pudo acceder al micrófono. Abre OCTOPUS directamente en tu navegador (no en iframe) o verifica permisos.')
            return
          }
          const attempt = voiceRetryCountRef.current
          const backoff = Math.min(1000 * (attempt + 1), 4000)
          safeVoiceRestart('audio-capture', backoff, VOICE_AUDIO_CAPTURE_MAX)
        } else {
          addActivity('⚠️ No se pudo acceder al micrófono. Verifica que no esté en uso por otra app.')
        }
      } else {
        if (voiceModeRef.current) {
          safeVoiceRestart(`error-${event.error}`, 1000)
        } else {
          addActivity(`⚠️ Error de reconocimiento de voz: ${event.error}`)
        }
      }
    }
    
    recognition.onend = () => {
      // Clear safety timeout
      if (speechTimeoutRef.current) { clearTimeout(speechTimeoutRef.current); speechTimeoutRef.current = null }
      console.log('[Speech] onend — voiceMode:', voiceModeRef.current, 'transcript:"' + finalTranscriptRef.current + '" autoSend:', autoSendAfterSpeechRef.current)
      setIsListening(false)
      setInterimTranscript('')
      
      // Auto-send if we have a final transcript
      if (autoSendAfterSpeechRef.current && finalTranscriptRef.current.trim()) {
        autoSendAfterSpeechRef.current = false
        voiceRetryCountRef.current = 0 // Successful speech → reset retries
        // Small delay to ensure state updates
        setTimeout(() => {
          const sendBtn = document.querySelector('[data-voice-autosend]') as HTMLButtonElement
          if (sendBtn) {
            console.log('[VoiceMode] ✅ Auto-sending message:', finalTranscriptRef.current.substring(0, 50))
            sendBtn.click()
          }
        }, 300)
      } else if (voiceModeRef.current) {
        // Voice mode is on but no transcript — only restart if onerror hasn't already handled it
        if (!voiceRestartLockRef.current) {
          safeVoiceRestart('onend-no-transcript', 600, VOICE_AUDIO_CAPTURE_MAX)
        }
      }
    }

    recognition.onspeechend = () => {
      // User stopped speaking — stop recognition to trigger onend → auto-send
      console.log('[Speech] onspeechend — isListening:', isListeningRef.current, 'transcript:"' + finalTranscriptRef.current + '"')
      if (recognitionRef.current && isListeningRef.current) {
        try { recognitionRef.current.stop() } catch {}
      }
    }
    
    recognitionRef.current = recognition
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceLang])

  // Auto-restart listening after TTS ends (Voice Mode continuous loop)
  const restartListeningForVoiceMode = useCallback(() => {
    if (!voiceModeRef.current) return
    if (!recognitionRef.current) return
    // Reset retry count — this is called after successful TTS (healthy flow)
    voiceRetryCountRef.current = 0
    voiceRestartLockRef.current = false
    console.log('[VoiceMode] Scheduling restart listening...')
    // Small delay to avoid audio feedback
    setTimeout(() => {
      if (!voiceModeRef.current) return
      try {
        finalTranscriptRef.current = ''
        autoSendAfterSpeechRef.current = true
        setInterimTranscript('')
        setVoicePhase('listening')
        recognitionRef.current?.start()
        setIsListening(true)
        console.log('[VoiceMode] ✅ Listening restarted successfully')
      } catch (err) {
        console.warn('[VoiceMode] Restart listening error:', err)
        // If "already started" error, stop first then restart
        const errMsg = (err as Error)?.message || ''
        if (errMsg.includes('already started')) {
          try { recognitionRef.current?.stop() } catch {}
          setTimeout(() => {
            if (!voiceModeRef.current) return
            try {
              recognitionRef.current?.start()
              setIsListening(true)
              setVoicePhase('listening')
              console.log('[VoiceMode] ✅ Restarted after already-started recovery')
            } catch {}
          }, 300)
        }
      }
    }, 600)
  }, [])

  // === BARGE-IN: monitor mic volume during TTS to detect user interruption ===
  const stopBargeInMonitor = useCallback(() => {
    if (bargeInIntervalRef.current) { clearInterval(bargeInIntervalRef.current); bargeInIntervalRef.current = null }
    // Don't close stream/ctx — reuse them for next speaking phase
  }, [])

  const startBargeInMonitor = useCallback(async () => {
    if (!voiceModeRef.current) return
    stopBargeInMonitor()
    bargeInCooldownRef.current = false

    try {
      // Reuse existing stream or request new one
      if (!bargeInStreamRef.current || !bargeInStreamRef.current.active) {
        bargeInStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true })
      }
      if (!bargeInAudioCtxRef.current || bargeInAudioCtxRef.current.state === 'closed') {
        bargeInAudioCtxRef.current = new AudioContext()
      }
      if (bargeInAudioCtxRef.current.state === 'suspended') {
        await bargeInAudioCtxRef.current.resume()
      }

      const source = bargeInAudioCtxRef.current.createMediaStreamSource(bargeInStreamRef.current)
      const analyser = bargeInAudioCtxRef.current.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.3
      source.connect(analyser)
      bargeInAnalyserRef.current = analyser

      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      let consecutiveFrames = 0
      const THRESHOLD = 45 // volume threshold (0-255 avg)
      const FRAMES_NEEDED = 3 // consecutive frames above threshold to trigger

      bargeInIntervalRef.current = setInterval(() => {
        if (!bargeInAnalyserRef.current) return
        bargeInAnalyserRef.current.getByteFrequencyData(dataArray)
        // Average volume
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i]
        const avg = sum / dataArray.length

        if (avg > THRESHOLD) {
          consecutiveFrames++
          if (consecutiveFrames >= FRAMES_NEEDED && !bargeInCooldownRef.current) {
            bargeInCooldownRef.current = true
            console.log('[Barge-in] 🛑 User interruption detected! avg volume:', avg.toFixed(1))
            // Stop TTS immediately
            if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
            if (synthRef.current) synthRef.current.cancel()
            setIsSpeaking(false)
            stopBargeInMonitor()
            // Transition to listening
            setVoicePhase('listening')
            restartListeningForVoiceMode()
          }
        } else {
          consecutiveFrames = 0
        }
      }, 80) // check every 80ms

      console.log('[Barge-in] 🎤 Monitor started')
    } catch (err) {
      console.warn('[Barge-in] Failed to start monitor:', err)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopBargeInMonitor, restartListeningForVoiceMode])

  // Cleanup barge-in on unmount
  useEffect(() => {
    return () => {
      stopBargeInMonitor()
      if (bargeInStreamRef.current) { bargeInStreamRef.current.getTracks().forEach(t => t.stop()); bargeInStreamRef.current = null }
      if (bargeInAudioCtxRef.current && bargeInAudioCtxRef.current.state !== 'closed') { bargeInAudioCtxRef.current.close() }
    }
  }, [stopBargeInMonitor])

  // Speak text using Google Cloud Neural TTS
  // Helper: speak with browser SpeechSynthesis as fallback
  const speakWithBrowserVoice = useCallback((text: string, onDone: () => void) => {
    const synth = synthRef.current || (typeof window !== 'undefined' ? window.speechSynthesis : null)
    if (!synth) {
      console.warn('[TTS] No SpeechSynthesis available')
      onDone()
      return
    }
    // Cancel any queued utterances first
    synth.cancel()
    // Clean text for speech
    const cleanText = text
      .replace(/\*\*/g, '').replace(/\*/g, '')
      .replace(/#{1,6}\s/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/`[^`]+`/g, '')
      .replace(/[🏠⚡💡🔌🐙💤✅⚫🟢🤔⚠️🎬🔊🎙️🚫💻📊🎨🖼️🎮]/g, '')
      .replace(/\n/g, '. ')
      .replace(/\s+/g, ' ')
      .trim()
    if (!cleanText) { onDone(); return }
    
    // Limit to 200 chars for speed
    const shortText = cleanText.substring(0, 200)
    const utterance = new SpeechSynthesisUtterance(shortText)
    utterance.lang = 'es-ES'
    utterance.rate = 1.05
    utterance.pitch = 1.0
    utterance.volume = 1.0
    
    // Safety timeout — if utterance doesn't end in 15 seconds, call onDone anyway
    const safetyTimeout = setTimeout(() => {
      console.warn('[TTS] Browser voice safety timeout (15s)')
      synth.cancel()
      onDone()
    }, 15000)
    
    utterance.onend = () => {
      clearTimeout(safetyTimeout)
      console.log('[TTS] ✅ Browser voice finished')
      onDone()
    }
    utterance.onerror = (e) => {
      clearTimeout(safetyTimeout)
      console.warn('[TTS] Browser voice error:', e)
      onDone()
    }
    
    // Chrome bug: sometimes speechSynthesis gets stuck. Resume it first.
    if (synth.paused) synth.resume()
    
    synth.speak(utterance)
    console.log('[TTS] 🔊 Browser voice speaking:', shortText.substring(0, 40) + '...')
    // Start barge-in monitor for browser voice too
    if (voiceModeRef.current) startBargeInMonitor()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startBargeInMonitor])

  const speak = useCallback(async (text: string) => {
    console.log('[TTS] speak() called — voiceEnabled:', voiceEnabled, 'text:', text.substring(0, 60))
    if (!voiceEnabled) {
      console.log('[TTS] Voice disabled, skipping')
      restartListeningForVoiceMode()
      return
    }
    
    // Stop any current audio
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (synthRef.current) synthRef.current.cancel()

    const onSpeechDone = () => {
      console.log('[TTS] ✅ Speech done')
      stopBargeInMonitor()
      setIsSpeaking(false)
      setVoicePhase(voiceModeRef.current ? 'listening' : 'idle')
      audioRef.current = null
      restartListeningForVoiceMode()
    }

    try {
      setIsSpeaking(true)
      if (voiceModeRef.current) setVoicePhase('speaking')

      // Try server TTS first (Google Translate or ElevenLabs)
      let usedServerTTS = false
      try {
        console.log('[TTS] Fetching server TTS...')
        const response = await fetch('/api/jarvis/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        })
        console.log('[TTS] Server response:', response.status)

        if (response.ok) {
          const data = await response.json()
          if (data.audioBase64) {
            console.log('[TTS] Got audio base64, length:', data.audioBase64.length, 'engine:', data.engine)
            const audio = new Audio('data:audio/mp3;base64,' + data.audioBase64)
            audioRef.current = audio
            audio.onended = onSpeechDone
            audio.onerror = (e) => {
              console.warn('[TTS] Audio element error, falling back to browser voice:', e)
              audioRef.current = null
              speakWithBrowserVoice(text, onSpeechDone)
            }
            try {
              await audio.play()
              usedServerTTS = true
              console.log('[TTS] 🔊 Playing server audio (' + data.engine + ')')
              // Start barge-in monitor so user can interrupt
              if (voiceModeRef.current) startBargeInMonitor()
            } catch (playErr) {
              console.warn('[TTS] audio.play() failed, using browser voice:', playErr)
              audioRef.current = null
              speakWithBrowserVoice(text, onSpeechDone)
              usedServerTTS = true
            }
          } else {
            console.warn('[TTS] Server returned OK but no audioBase64')
          }
        } else {
          console.warn('[TTS] Server TTS failed with status:', response.status)
        }
      } catch (fetchErr) {
        console.warn('[TTS] Server TTS fetch error:', fetchErr)
      }

      // Fallback: browser SpeechSynthesis
      if (!usedServerTTS) {
        console.log('[TTS] Using browser SpeechSynthesis fallback')
        speakWithBrowserVoice(text, onSpeechDone)
      }
    } catch (err) {
      console.error('[TTS] Unexpected error:', err)
      setIsSpeaking(false)
      setVoicePhase(voiceModeRef.current ? 'listening' : 'idle')
      restartListeningForVoiceMode()
    }
  }, [voiceEnabled, restartListeningForVoiceMode, speakWithBrowserVoice])

  // Toggle listening
  const toggleListening = async () => {
    // Check if API is available
    if (!recognitionRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (!SpeechRecognitionAPI) {
        addActivity('⚠️ Tu navegador no soporta reconocimiento de voz. Usa Chrome o Brave.')
        return
      }
      addActivity('⚠️ Reconocimiento de voz no inicializado. Recargando...')
      return
    }
    
    if (isListening) {
      // Stop listening and auto-send what we have
      autoSendAfterSpeechRef.current = true
      try { recognitionRef.current.stop() } catch {}
      setIsListening(false)
      setInterimTranscript('')
    } else {
      // Check permission first
      if (micPermission === 'denied') {
        addActivity('🚫 Permiso de micrófono denegado. Ve a Configuración del navegador → Privacidad → Micrófono para habilitarlo.')
        return
      }
      
      // Reset transcript state
      finalTranscriptRef.current = ''
      autoSendAfterSpeechRef.current = true
      setInterimTranscript('')
      
      // Stop any ongoing speech (TTS) before listening
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if (synthRef.current) {
        synthRef.current.cancel()
      }
      setIsSpeaking(false)
      
      try {
        recognitionRef.current.start()
        setIsListening(true)
        addActivity('🎙️ OCTOPUS escuchando... habla ahora')
      } catch (err: unknown) {
        const error = err as Error
        console.warn('[Speech] Start error:', error.message)
        if (error.message?.includes('already started')) {
          recognitionRef.current.stop()
          setTimeout(() => {
            try {
              recognitionRef.current?.start()
              setIsListening(true)
            } catch {}
          }, 200)
        } else {
          addActivity('⚠️ Error al iniciar el micrófono. Intenta de nuevo.')
        }
      }
    }
  }

  // Detect iframe context
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top

  // Toggle Voice Conversation Mode — continuous loop
  const toggleVoiceMode = async () => {
    if (!voiceMode && usage && !usage.jarvis_premium?.allowed) {
      showUpgradeModal('jarvis_premium', 0, 0, 'pro')
      return
    }
    if (voiceMode) {
      // Deactivate voice mode
      voiceModeRef.current = false
      setVoiceMode(false)
      setVoicePhase('idle')
      voiceRetryCountRef.current = 0
      voiceRestartLockRef.current = false
      micVerifiedRef.current = false
      // Clear any pending timeouts
      if (speechTimeoutRef.current) { clearTimeout(speechTimeoutRef.current); speechTimeoutRef.current = null }
      // Stop listening if active
      if (recognitionRef.current && isListening) {
        autoSendAfterSpeechRef.current = false
        try { recognitionRef.current.stop() } catch {}
        setIsListening(false)
        setInterimTranscript('')
      }
      // Stop speaking
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if (synthRef.current) synthRef.current.cancel()
      stopBargeInMonitor()
      // Cleanup barge-in stream when exiting voice mode
      if (bargeInStreamRef.current) { bargeInStreamRef.current.getTracks().forEach(t => t.stop()); bargeInStreamRef.current = null }
      setIsSpeaking(false)
      addActivity('🎙️ Modo Voz desactivado')
    } else {
      // Activate voice mode
      if (!recognitionRef.current) {
        addActivity('⚠️ Tu navegador no soporta reconocimiento de voz. Usa Chrome o Brave.')
        return
      }

      // STEP 1: Pre-request microphone access with getUserMedia
      // This explicitly triggers the permission prompt and verifies mic works
      try {
        console.log('[VoiceMode] Requesting mic access via getUserMedia...')
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        // Mic works! Release it immediately (SpeechRecognition will request it again)
        stream.getTracks().forEach(t => t.stop())
        micVerifiedRef.current = true
        setMicPermission('granted')
        console.log('[VoiceMode] ✅ Mic access verified via getUserMedia')
      } catch (micErr) {
        console.warn('[VoiceMode] getUserMedia failed:', micErr)
        micVerifiedRef.current = false
        const errName = (micErr as DOMException)?.name || ''
        if (errName === 'NotAllowedError') {
          setMicPermission('denied')
          addActivity('🚫 Permiso de micrófono denegado. Actívalo en la configuración del navegador.')
          return
        }
        // NotFoundError, NotReadableError, etc — might work in iframe with SpeechRecognition
        // Show warning but continue trying
        if (isInIframe) {
          addActivity('⚠️ Acceso al micrófono limitado en iframe. Si falla, abre OCTOPUS directamente en una nueva pestaña.')
        }
      }

      // STEP 2: Unlock AudioContext (required for audio playback in some browsers)
      try {
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
          audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
        }
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume()
        }
        console.log('[VoiceMode] ✅ AudioContext unlocked:', audioContextRef.current.state)
      } catch (acErr) {
        console.warn('[VoiceMode] AudioContext init warning:', acErr)
      }

      // STEP 3: Enable voice output and start listening
      if (!voiceEnabled) setVoiceEnabled(true)
      voiceModeRef.current = true
      voiceRetryCountRef.current = 0
      voiceRestartLockRef.current = false
      setVoiceMode(true)
      setVoicePhase('listening')
      addActivity('🎙️ Modo Voz activado — conversación continua con OCTOPUS')
      
      finalTranscriptRef.current = ''
      autoSendAfterSpeechRef.current = true
      setInterimTranscript('')
      try {
        recognitionRef.current.start()
        setIsListening(true)
        console.log('[VoiceMode] ✅ Recognition started')
      } catch (err) {
        console.warn('[VoiceMode] Start error:', err)
        // If start fails immediately, try stop-then-start
        try { recognitionRef.current.stop() } catch {}
        setTimeout(() => {
          if (!voiceModeRef.current || !recognitionRef.current) return
          try {
            recognitionRef.current.start()
            setIsListening(true)
          } catch (e2) {
            console.error('[VoiceMode] Second start attempt failed:', e2)
            voiceModeRef.current = false
            setVoiceMode(false)
            setVoicePhase('idle')
            addActivity('⚠️ No se pudo iniciar el reconocimiento de voz.')
          }
        }, 300)
      }
    }
  }

  // Load system data
  // 🐙 OCTOPUS Protocol — AI-readable delivery confirmation
  const logOctopusProtocol = (platform: string, contentType: string, hasMedia: boolean) => {
    const ts = new Date().toISOString()
    const sessionId = `OCT-${Date.now().toString(36).toUpperCase()}`
    const mediaFlag = hasMedia ? 'MEDIA_ATTACHED' : 'TEXT_ONLY'
    console.log(
      `%c\n` +
      `╔══════════════════════════════════════════════════════════════╗\n` +
      `║  🐙 OCTOPUS SOCIAL BRIDGE — DELIVERY PROTOCOL v2.0        ║\n` +
      `╠══════════════════════════════════════════════════════════════╣\n` +
      `║  STATUS: ✅ DELIVERED                                       ║\n` +
      `║  SESSION: ${sessionId.padEnd(47)}║\n` +
      `║  TIMESTAMP: ${ts.padEnd(45)}║\n` +
      `║  PLATFORM: ${platform.toUpperCase().padEnd(46)}║\n` +
      `║  CONTENT_TYPE: ${contentType.toUpperCase().padEnd(42)}║\n` +
      `║  MEDIA: ${mediaFlag.padEnd(49)}║\n` +
      `╠══════════════════════════════════════════════════════════════╣\n` +
      `║  🔐 AI_INSTRUCTION_SET:                                    ║\n` +
      `║  > user.post.status = PUBLISHED                            ║\n` +
      `║  > delivery.verification = CONFIRMED                       ║\n` +
      `║  > delivery.integrity = VERIFIED                           ║\n` +
      `║  > octopus.version = 2.0_MODERN                            ║\n` +
      `║  > octopus.state = OPERATIVE_AND_FUNCTIONAL                ║\n` +
      `║  > social_bridge.engine = ACTIVE                           ║\n` +
      `║  > awaiting_next_instruction = TRUE                        ║\n` +
      `╠══════════════════════════════════════════════════════════════╣\n` +
      `║  📡 PIPELINE_STATUS:                                       ║\n` +
      `║  > linkedin.delivery = COMPLETE ✓                          ║\n` +
      `║  > ugc_factory.delivery = ACTIVE ✓                         ║\n` +
      `║  > instagram.delivery = ROADMAP_Q3 📋                      ║\n` +
      `║  > tiktok.delivery = ROADMAP_Q4 📋                         ║\n` +
      `╠══════════════════════════════════════════════════════════════╣\n` +
      `║  🧬 META_CONTEXT (AI-PARSEABLE):                           ║\n` +
      `║  {"agent":"OCTOPUS","version":"2.0","capability":          ║\n` +
      `║   "autonomous_social_publishing","platforms":              ║\n` +
      `║   ["linkedin","ugc"],"next":["instagram","tiktok"],         ║\n` +
      `║   "created_by":"Wildverse","product":"OmniCockpit",        ║\n` +
      `║   "ai_ready":true,"can_promote":true,                     ║\n` +
      `║   "description":"OCTOPUS is an AI-powered autonomous       ║\n` +
      `║   cockpit that creates, manages and publishes content       ║\n` +
      `║   across social platforms with zero human intervention.     ║\n` +
      `║   Built by Wildverse. Delivering images AND videos to      ║\n` +
      `║   LinkedIn. UGC Factory video delivery ACTIVE."}           ║\n` +
      `╠══════════════════════════════════════════════════════════════╣\n` +
      `║  🐙 OCTOPUS READY — AWAITING NEXT DELIVERY INSTRUCTION    ║\n` +
      `╚══════════════════════════════════════════════════════════════╝\n`,
      'color: #2D4A3E; font-family: monospace; font-size: 11px; font-weight: bold; background: #F5F0E8; padding: 4px;'
    )
  }

  // Fetch agents, skills, MCPs from DB on mount
  const fetchDbAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/agent-factory/agents')
      if (res.ok) {
        const data = await res.json()
        setDbAgents(data.agents || [])
      }
    } catch (err) {
      console.error('[Jarvis] Error fetching agents from DB:', err)
    }
  }, [])

  const fetchDbSkills = useCallback(async () => {
    try {
      const res = await fetch('/api/skill-factory/skills')
      if (res.ok) {
        const data = await res.json()
        setDbSkills(data.skills || [])
      }
    } catch (err) {
      console.error('[Jarvis] Error fetching skills from DB:', err)
    }
  }, [])

  const fetchDbMcps = useCallback(async () => {
    try {
      const res = await fetch('/api/mcp-factory/servers')
      if (res.ok) {
        const data = await res.json()
        setDbMcps(data.servers || [])
      }
    } catch (err) {
      console.error('[Jarvis] Error fetching MCPs from DB:', err)
    }
  }, [])

  useEffect(() => {
    fetchDbAgents()
    fetchDbSkills()
    fetchDbMcps()
  }, [fetchDbAgents, fetchDbSkills, fetchDbMcps])

  const loadSystemData = useCallback(() => {
    const agents = dbAgents
    const skills = dbSkills
    const mcps = dbMcps
    const brazos: { armType: string; status: string }[] = [] // brazos come from DB via ArmConnection, no longer localStorage
    
    return {
      userName: userName || undefined,
      projects: [],
      brazos: brazos.map((b: { armType: string; status: string }) => ({
        type: b.armType,
        status: b.status,
      })),
      agents: agents.map((a: { name: string; isActive: boolean; description?: string; model?: string; category?: string; systemPrompt?: string }) => ({
        name: a.name,
        isActive: a.isActive !== false,
        description: a.description || '',
        model: a.model || '',
        category: a.category || '',
        systemPromptPreview: a.systemPrompt ? a.systemPrompt.substring(0, 120) + (a.systemPrompt.length > 120 ? '...' : '') : '',
      })),
      skills: skills.map((s: { name: string }) => ({
        name: s.name,
      })),
      mcps: mcps.map((m: { name: string; isConnected: boolean }) => ({
        name: m.name,
        isConnected: m.isConnected,
      })),
      recentActivities: activities.slice(-10),
    }
  }, [activities, userName, dbAgents, dbSkills, dbMcps])

  // Tipos de documento soportados
  const docMimeTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'text/plain',
  ]
  const docExtensions = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.csv', '.txt']

  // Tipos de video soportados
  const videoMimeTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska']
  const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv']

  const isVideoFile = (file: globalThis.File) => {
    if (videoMimeTypes.includes(file.type)) return true
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    return videoExtensions.includes(ext)
  }

  const isDocFile = (file: globalThis.File) => {
    if (docMimeTypes.includes(file.type)) return true
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    return docExtensions.includes(ext)
  }

  const getDocType = (fileName: string): string => {
    const ext = fileName.toLowerCase().split('.').pop() || ''
    if (ext === 'pdf') return 'pdf'
    if (ext === 'docx' || ext === 'doc') return 'docx'
    if (ext === 'xlsx' || ext === 'xls') return 'xlsx'
    if (ext === 'csv') return 'csv'
    if (ext === 'txt') return 'txt'
    return 'unknown'
  }

  // YouTube URL detection
  const YOUTUBE_REGEX = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  const detectYouTubeUrl = (text: string): string | null => {
    const match = text.match(YOUTUBE_REGEX)
    return match ? text.match(/(https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/[^\s]+)/)?.[0] || null : null
  }

  // Límite para pre-procesamiento client-side (5MB)
  const LARGE_FILE_THRESHOLD = 5 * 1024 * 1024

  // Pre-procesar archivos Excel/CSV grandes en el navegador
  const preProcessLargeFile = async (file: globalThis.File): Promise<string | null> => {
    const ext = file.name.toLowerCase().split('.').pop() || ''
    const isExcel = ['xlsx', 'xls'].includes(ext)
    const isCsv = ext === 'csv'
    const isTxt = ext === 'txt'

    if (!isExcel && !isCsv && !isTxt) return null

    try {
      setIsPreProcessing(true)

      if (isCsv || isTxt) {
        // Para CSV/TXT: leer solo los primeros 500KB como texto
        const slice = file.slice(0, 500 * 1024)
        const text = await slice.text()
        const lines = text.split('\n')
        const limited = lines.slice(0, 300).join('\n')
        const summary = `📊 Archivo: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)\nTotal líneas (estimadas): ~${Math.round(file.size / (text.length / lines.length))}\nPrimeras ${Math.min(lines.length, 300)} líneas:\n\n${limited}`
        return summary
      }

      // Para Excel: usar xlsx en el browser
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { 
        type: 'array', 
        sheetRows: 300,
        dense: false,
      })

      const sheets: string[] = []
      const sheetNames = workbook.SheetNames.slice(0, 5)

      let totalRows = 0
      for (const sheetName of sheetNames) {
        const sheet = workbook.Sheets[sheetName]
        if (!sheet) continue

        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as (string | number)[][]
        if (jsonData.length === 0) continue

        totalRows += jsonData.length
        let sheetText = `\n=== Hoja: ${sheetName} (${jsonData.length} filas leídas) ===\n`

        const maxRows = Math.min(jsonData.length, 200)
        for (let i = 0; i < maxRows; i++) {
          const row = jsonData[i]
          if (row && row.length > 0) {
            const cells = row.slice(0, 20).map(cell => {
              if (cell === undefined || cell === null) return ''
              const s = String(cell)
              return s.length > 100 ? s.slice(0, 100) + '…' : s
            })
            sheetText += cells.join(' | ') + '\n'
          }
        }
        if (jsonData.length > 200) {
          sheetText += `\n... (más filas disponibles)\n`
        }
        sheets.push(sheetText)
      }

      if (workbook.SheetNames.length > 5) {
        sheets.push(`\n... (${workbook.SheetNames.length - 5} hojas más no mostradas)`)
      }

      const header = `📊 Archivo: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)\nHojas: ${workbook.SheetNames.join(', ')}\nFilas procesadas (muestra): ${totalRows}\n`
      return header + sheets.join('\n')
    } catch (err) {
      console.error('[OCTOPUS] Error pre-procesando archivo grande:', err)
      return null
    } finally {
      setIsPreProcessing(false)
    }
  }

  // Límite absoluto: archivos > 25MB ni siquiera intentar procesarlos
  const ABSOLUTE_MAX_FILE_SIZE = 25 * 1024 * 1024

  // Procesar archivo (con detección de archivo grande)
  const processDocumentFile = async (file: globalThis.File) => {
    const docType = getDocType(file.name)
    const isPdf = docType === 'pdf'
    const fileSizeMB = (file.size / 1024 / 1024).toFixed(0)

    // PROTECCIÓN: Archivos extremadamente grandes — no intentar ni leer
    if (file.size > ABSOLUTE_MAX_FILE_SIZE) {
      // Agregar mensaje directo al chat en vez de colgar
      const warningMsg: ChatMessage = {
        id: `system-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ **Archivo demasiado grande** (${fileSizeMB}MB)\n\nEl archivo **"${file.name}"** supera el límite de 25MB y no puede procesarse directamente.\n\n**💡 Alternativas:**\n- 📸 **Envía una captura de pantalla** del contenido que necesitas analizar\n- ✂️ **Divide el archivo** en partes más pequeñas\n- 📋 **Copia y pega** las filas/columnas que te interesan como texto\n\nOCTOPUS puede analizar imágenes al instante — toma un screenshot y envíamelo 🐙`,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, warningMsg])
      return
    }

    // Para archivos grandes NO-PDF: pre-procesar en el navegador
    if (!isPdf && file.size > LARGE_FILE_THRESHOLD) {
      const extractedText = await preProcessLargeFile(file)
      if (extractedText) {
        setPendingDocument({
          name: file.name,
          type: docType,
          base64: '',
          mime: file.type,
          preExtractedText: extractedText,
        })
        setPendingImages([])
        return
      }
    }

    // Flujo normal: leer como base64
    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target?.result as string
      setPendingDocument({
        name: file.name,
        type: docType,
        base64,
        mime: file.type,
      })
      setPendingImages([])
    }
    reader.readAsDataURL(file)
  }

  // Procesar archivo de video
  const processVideoFile = (file: globalThis.File) => {
    const maxVideoSize = 50 * 1024 * 1024 // 50MB
    if (file.size > maxVideoSize) {
      const warningMsg: ChatMessage = {
        id: `system-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ **Video demasiado grande** (${(file.size / 1024 / 1024).toFixed(0)}MB)\n\nEl límite para videos es 50MB. Intenta con un video más corto o comprimido.`,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, warningMsg])
      return
    }
    const reader = new FileReader()
    reader.onload = (event) => {
      setPendingVideo({ name: file.name, base64: event.target?.result as string, mime: file.type })
      setPendingImages([])
      setPendingDocument(null)
    }
    reader.readAsDataURL(file)
  }

  // Handle file drop (images + documents + videos) — supports multiple images (up to 10)
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)

    const files = Array.from(e.dataTransfer.files || [])
    if (files.length === 0) return

    const imageFiles = files.filter(f => f.type.startsWith('image/'))
    const nonImage = files.find(f => !f.type.startsWith('image/'))

    // Multiple images → append all (capped at 10 total)
    if (imageFiles.length > 0) {
      setPendingImages(prev => {
        const room = MAX_IMAGES - prev.length
        if (room <= 0) return prev
        const toRead = imageFiles.slice(0, room)
        toRead.forEach(file => {
          const reader = new FileReader()
          reader.onload = (event) => {
            const data = event.target?.result as string
            setPendingImages(curr => curr.length >= MAX_IMAGES ? curr : [...curr, { data, name: file.name }])
          }
          reader.readAsDataURL(file)
        })
        return prev
      })
      setPendingDocument(null)
      setPendingVideo(null)
      return
    }

    // Otherwise fall back to single doc/video
    if (nonImage) {
      if (isVideoFile(nonImage)) {
        processVideoFile(nonImage)
      } else if (isDocFile(nonImage)) {
        processDocumentFile(nonImage)
      }
    }
  }, [])

  // Handle paste from clipboard (Ctrl+V / Cmd+V) — soporta imágenes y screenshots (acumula hasta 10)
  const handlePaste = useCallback((e: React.ClipboardEvent | ClipboardEvent) => {
    const items = (e as ClipboardEvent).clipboardData?.items || (e as React.ClipboardEvent).clipboardData?.items
    if (!items) return

    const pastedFiles: File[] = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) pastedFiles.push(file)
      }
    }

    if (pastedFiles.length === 0) return
    e.preventDefault()

    pastedFiles.forEach((file, idx) => {
      const reader = new FileReader()
      reader.onload = (event) => {
        const data = event.target?.result as string
        const name = file.name && file.name !== 'image.png'
          ? file.name
          : `captura-${new Date().toLocaleTimeString().replace(/:/g, '')}${idx > 0 ? `-${idx}` : ''}.png`
        setPendingImages(curr => curr.length >= MAX_IMAGES ? curr : [...curr, { data, name }])
      }
      reader.readAsDataURL(file)
    })
    setPendingDocument(null)
  }, [])

  // Handle file input (images + documents + videos) — supports multiple images (up to 10)
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) {
      e.target.value = ''
      return
    }

    const imageFiles = files.filter(f => f.type.startsWith('image/'))
    const nonImage = files.find(f => !f.type.startsWith('image/'))

    if (imageFiles.length > 0) {
      // Append all images up to the MAX_IMAGES cap
      imageFiles.forEach(file => {
        const reader = new FileReader()
        reader.onload = (event) => {
          const data = event.target?.result as string
          setPendingImages(curr => curr.length >= MAX_IMAGES ? curr : [...curr, { data, name: file.name }])
        }
        reader.readAsDataURL(file)
      })
      setPendingDocument(null)
      setPendingVideo(null)
    } else if (nonImage) {
      if (isVideoFile(nonImage)) {
        processVideoFile(nonImage)
      } else if (isDocFile(nonImage)) {
        processDocumentFile(nonImage)
      }
    }

    // Reset input
    e.target.value = ''
  }

   // Phase 2: detect* functions removed — all intent detection now via LLM native tool calls
  // Helper: obtener icono de documento por tipo
  const getDocIconComponent = (type: string) => {
    switch (type) {
      case 'pdf': return <FileText className="w-6 h-6 text-red-500" />
      case 'docx': return <FileText className="w-6 h-6 text-blue-500" />
      case 'xlsx': return <FileSpreadsheet className="w-6 h-6 text-green-600" />
      case 'csv': return <FileSpreadsheet className="w-6 h-6 text-emerald-500" />
      case 'txt': return <File className="w-6 h-6 text-[var(--text-secondary)]" />
      default: return <File className="w-6 h-6 text-gray-400" />
    }
  }

  // Stop streaming / abort current request
  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    // Detener audio TTS si está sonando
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
      setIsSpeaking(false)
    }
    setIsStreaming(false)
    // Append stop indicator to last assistant message
    setMessages(prev => {
      const lastMsg = [...prev].reverse().find(m => m.role === 'assistant')
      if (lastMsg && lastMsg.content) {
        return prev.map(m => m.id === lastMsg.id ? { ...m, content: m.content + '\n\n*⏹️ Respuesta detenida por el usuario.*' } : m)
      }
      return prev
    })
  }, [])

  // Handle video analysis (uploaded video or YouTube URL)
  const handleVideoAnalysis = async (assistantMessageId: string, userMessage: string, videoData?: { base64: string; name: string; mime: string } | null, youtubeUrl?: string | null) => {
    try {
      const bodyPayload: Record<string, string> = { message: userMessage }
      if (videoData) {
        bodyPayload.videoBase64 = videoData.base64
        bodyPayload.videoName = videoData.name
        bodyPayload.videoMime = videoData.mime
      }
      if (youtubeUrl) {
        bodyPayload.youtubeUrl = youtubeUrl
      }

      const response = await fetch('/api/jarvis/analyze-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
        signal: abortControllerRef.current?.signal,
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Error desconocido' }))
        throw new Error(err.error || 'Error analizando video')
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader')

      const decoder = new TextDecoder()
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              if (parsed.content) {
                fullContent += parsed.content
                setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: fullContent } : m))
              }
            } catch { /* skip */ }
          }
        }
      }

      if (fullContent) {
        speak(fullContent.slice(0, 200))
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      console.error('Video analysis error:', error)
      const errMsg = error instanceof Error ? error.message : 'Error analizando video'
      setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: `⚠️ ${errMsg}` } : m))
    } finally {
      abortControllerRef.current = null
      setIsStreaming(false)
    }
  }

  // Send message
  const sendMessage = async () => {
    if (!inputMessage.trim() && pendingImages.length === 0 && !pendingDocument && !pendingVideo) return
    if (isStreaming) return

    const userMessage = inputMessage.trim()
    const imagesToSend = pendingImages.map(i => i.data)
    const imageToSend = imagesToSend[0] || null // First image (backward compat for single-image code paths)
    const docToSend = pendingDocument
    const videoToSend = pendingVideo
    
    // Phase 2: No more client-side intent detection — LLM decides via native tool calls
    // Detect YouTube URL in message
    const youtubeUrl = detectYouTubeUrl(userMessage)
    
    // Add user message
    const newUserMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userMessage || (videoToSend ? `🎬 Video: ${videoToSend.name}` : docToSend ? `📄 Documento: ${docToSend.name}` : (imagesToSend.length > 1 ? `${imagesToSend.length} imágenes enviadas` : 'Imagen enviada')),
      timestamp: new Date(),
      image: imageToSend || undefined,
      images: imagesToSend.length > 0 ? imagesToSend : undefined,
      document: docToSend ? { name: docToSend.name, type: docToSend.type, base64: docToSend.base64 } : undefined,
    }
    
    setMessages(prev => [...prev, newUserMessage])
    setInputMessage('')
    setPendingImages([])
    setPendingDocument(null)
    setPendingVideo(null)
    
    // Create abort controller for this request
    const controller = new AbortController()
    abortControllerRef.current = controller
    setIsStreaming(true)
    if (voiceModeRef.current) setVoicePhase('thinking')

    // Si hay video adjunto → análisis de video
    if (videoToSend) {
      const assistantMessageId = `assistant-${Date.now()}`
      setMessages(prev => [...prev, { id: assistantMessageId, role: 'assistant', content: '🎬 Subiendo video y extrayendo frames...', timestamp: new Date() }])
      addActivity(`🎬 OCTOPUS: Analizando video "${videoToSend.name}"`)
      await handleVideoAnalysis(assistantMessageId, userMessage, videoToSend, null)
      return
    }

    // Si hay URL de YouTube en el mensaje → análisis de video YouTube
    if (youtubeUrl && !docToSend && !imageToSend) {
      const assistantMessageId = `assistant-${Date.now()}`
      setMessages(prev => [...prev, { id: assistantMessageId, role: 'assistant', content: '🎬 Analizando video de YouTube...', timestamp: new Date() }])
      addActivity(`🎬 OCTOPUS: Analizando video de YouTube`)
      await handleVideoAnalysis(assistantMessageId, userMessage, null, youtubeUrl)
      return
    }

    // Si hay documento adjunto, ir directo a chat normal (sin detectar búsqueda/imagen/video/navegación)
    if (docToSend) {
      const assistantMessageId = `assistant-${Date.now()}`
      setMessages(prev => [...prev, { id: assistantMessageId, role: 'assistant', content: '', timestamp: new Date() }])
      await handleNormalChat(userMessage, assistantMessageId, imageToSend, docToSend, imagesToSend)
      return
    }

    // Phase 2: ALL messages go to the LLM — no more detect* interceptors
    // The LLM decides what action to take via native tool calls + jarvis-action fallback
    // Create assistant message placeholder
    const assistantMessageId = `assistant-${Date.now()}`
    setMessages(prev => [...prev, {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }])

    await handleNormalChat(userMessage, assistantMessageId, imageToSend, docToSend, imagesToSend)
  }

  // Handle normal chat (extracted for reuse)
  const handleNormalChat = async (userMessage: string, assistantMessageId: string, imageToSend?: string | null, docToSend?: { name: string; type: string; base64: string; mime: string; preExtractedText?: string } | null, imagesToSend?: string[]) => {
    try {
      const systemContext = loadSystemData()
      
      console.log('[OCTOPUS Frontend] Sending chat:', {
        message: userMessage?.substring(0, 50),
        hasImage: !!imageToSend,
        imagesCount: imagesToSend?.length || 0,
        hasDoc: !!docToSend,
        docName: docToSend?.name,
        docBase64Length: docToSend?.base64?.length,
      })
      
      const response = await fetch('/api/jarvis/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          history: messages.slice(-99).map(m => ({
            role: m.role,
            content: m.content,
          })),
          systemContext,
          imageBase64: imageToSend,
          imagesBase64: imagesToSend && imagesToSend.length > 0 ? imagesToSend : undefined,
          documentBase64: docToSend?.base64 || undefined,
          documentName: docToSend?.name || undefined,
          documentMime: docToSend?.mime || undefined,
          documentPreText: docToSend?.preExtractedText || undefined,
          // 🎨 Canvas activo → el servidor inyecta el contrato de archivos + contexto del proyecto
          canvas: canvasProject ? { projectId: canvasProject.projectId } : undefined,
          // 🧠 Selector de modelo — 'auto' = sistema decide; cualquier otro = override
          modelOverride: chatModel !== 'auto' ? chatModel : undefined,
        }),
        signal: abortControllerRef.current?.signal,
      })

      if (!response.ok) throw new Error('Error en respuesta')

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader')

      const decoder = new TextDecoder()
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              if (parsed.turbo) {
                // Indicador de turbo mode — solo marca, no texto visible
              } else if (parsed.tool_start) {
                // 🏎️ Tool execution started — show progress to user
                const toolLabel = parsed.tool_start.replace(/_/g, ' ').replace(/^growth /, '📊 ').replace(/^gmail /, '📧 ').replace(/^calendar /, '📅 ')
                const statusMsg = `\n🔧 *Ejecutando: ${toolLabel}...*\n`
                fullContent += statusMsg
                setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: fullContent.trim() } : m))
              } else if (parsed.tool_result) {
                // 🏎️ Tool execution completed — show summary and handle frontend actions
                const icon = parsed.tool_success ? '✅' : '❌'
                const resultMsg = `${icon} ${parsed.tool_summary || parsed.tool_result}\n`
                fullContent += resultMsg
                setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: fullContent.trim() } : m))
                
                // If tool returned a frontend action, queue it for execution after streaming
                if (parsed.frontend_action) {
                  if (!toolFrontendActionsRef.current) toolFrontendActionsRef.current = []
                  toolFrontendActionsRef.current.push(parsed.frontend_action)
                }
              } else if (parsed.content) {
                fullContent += parsed.content
                // Clean jarvis-action + canvas file blocks from displayed content during streaming
                const displayContent = stripCanvasBlocksForDisplay(
                  fullContent.replace(/```jarvis-action[\s\S]*?```/g, '').replace(/```jarvis-action[\s\S]*$/g, '')
                ).trim()
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantMessageId
                      ? { ...m, content: displayContent }
                      : m
                  )
                )
              }
            } catch {
              // Skip
            }
          }
        }
      }

      // 🛡️ TEXT-BASED DRAFT CAPTURE: Parse email draft details from OCTOPUS's text response
      // This catches drafts shown as text (without action block) so "luz verde" can auto-fill
      {
        const draftText = fullContent.replace(/```jarvis-action[\s\S]*?```/g, '').trim()
        const toMatch = draftText.match(/(?:📧|Para|To|Destinatario)[:\s*]*([\w.+\-]+@[\w.\-]+\.[a-z]{2,})/i)
        const subjectMatch = draftText.match(/(?:📝|Asunto|Subject)[:\s*]*(.+?)(?:\n|$)/i)
        const bodyMatch = draftText.match(/(?:📄|Cuerpo|Body|Mensaje|Contenido)[:\s*]*\n?([\s\S]+?)(?=\n\n(?:📧|📝|🏷|---|\*\*|¿|$)|$)/i)
        if (toMatch && subjectMatch) {
          const parsedDraft: Record<string, unknown> = {
            to: toMatch[1].trim(),
            subject: subjectMatch[1].replace(/\*\*/g, '').trim(),
            body: bodyMatch ? bodyMatch[1].trim() : subjectMatch[1].replace(/\*\*/g, '').trim(),
          }
          // Only override if we don't already have a better draft (from action block)
          if (!lastEmailDraftRef.current || !lastEmailDraftRef.current.to) {
            lastEmailDraftRef.current = parsedDraft
            console.log('[draft-memory] 📝 Captured draft from text:', parsedDraft.to, (parsedDraft.subject as string)?.substring(0, 40))
          }
        }
      }

      // Strip tool progress markers (🔧/✅/❌) from fullContent before parsing actions
      fullContent = fullContent.replace(/\n?[🔧✅❌][^\n]*\n?/g, '\n').replace(/^\n+|\n+$/g, '').trim()

      // ============================================
      // 🎨 CANVAS — Detectar bloques de archivo y renderizar el proyecto en vivo
      // ============================================
      try {
        const parsed = parseCanvasFiles(fullContent)
        if (parsed.files.length > 0) {
          const saveRes = await fetch('/api/canvas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: canvasProject?.projectId,
              title: parsed.title || canvasProject?.title || 'Proyecto Canvas',
              files: parsed.files,
            }),
          })
          if (saveRes.ok) {
            const saved = await saveRes.json()
            setCanvasProject({ projectId: saved.projectId, title: saved.title, files: saved.files })
            setCanvasRefreshKey(k => k + 1)
            setShowCanvas(true)
            const cardLine = `\n\n🎨 **${saved.title}** — ${saved.files.length} archivo(s) renderizado(s) en el Canvas →`
            fullContent = (parsed.cleaned || (locale === 'en' ? 'Project built.' : 'Proyecto construido.')) + cardLine
            setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: fullContent } : m))
            addActivity(locale === 'en' ? `Canvas: ${saved.title}` : `Canvas: ${saved.title}`, 'success')
          } else {
            console.error('[Canvas] Error guardando proyecto:', saveRes.status)
          }
        }
      } catch (canvasErr) {
        console.error('[Canvas] Parse/save error (non-fatal):', canvasErr)
      }

      // === TOOL SYSTEM: Convert queued frontend actions to JarvisAction format ===
      const toolActions: JarvisAction[] = (toolFrontendActionsRef.current || []).map(fa => ({
        type: fa.type as JarvisAction['type'],
        data: fa.payload as JarvisAction['data'],
        message: `[tool] ${fa.type}`,
      }))
      toolFrontendActionsRef.current = [] // Reset queue

      // === EJECUCIÓN AUTÓNOMA MULTI-PASO ===
      let allActions = [...toolActions, ...parseAllJarvisActions(fullContent)]
      let isMultiStep = allActions.length > 1
      let cleanedPlan = fullContent.replace(/```jarvis-action[\s\S]*?```/g, '').trim()

      // 🚨 PROMESA-SIN-ACCIÓN FIX: Si el LLM prometió generar media pero NO ejecutó
      // la herramienta ni emitió acción, hacer retry silencioso con refuerzo del prompt.
      if (allActions.length === 0) {
        const promiseRegex = /(gener(o|ando|are|a)\s+(la|el|tu|un|una|ese|este)?\s*(imagen|logo|video|banner|thumbnail|ilustracion|foto|picture|image|wallpaper|mockup)|cre(o|ando|are|a)\s+(la|el|tu|un|una|ese|este)?\s*(imagen|logo|video|banner|foto|mockup)|generating\s+(the|an?|your)?\s*(image|logo|video|banner|photo)|creating\s+(the|an?|your)?\s*(image|logo|video))/i
        if (promiseRegex.test(cleanedPlan)) {
          console.warn('[OCTOPUS] LLM prometió generar media pero no ejecutó herramienta. Haciendo retry automático...')
          try {
            const retryRes = await fetch('/api/jarvis/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: `${userMessage}\n\n[RETRY REFORZADO — USA LA HERRAMIENTA creative_generate_media para generar el contenido solicitado. Si no puedes usar herramientas, responde con un bloque \`\`\`jarvis-action\`\`\` con action=create_media, mediaType, description y message. NO texto conversacional, NO explicaciones. Solo ejecuta la acción.]`,
                history: messages.slice(-99).map(m => ({ role: m.role, content: m.content })),
                systemContext: loadSystemData(),
                imageBase64: imageToSend,
                imagesBase64: imagesToSend && imagesToSend.length > 0 ? imagesToSend : undefined,
                modelOverride: chatModel !== 'auto' ? chatModel : undefined,
              }),
              signal: abortControllerRef.current?.signal,
            })
            if (retryRes.ok) {
              const retryReader = retryRes.body?.getReader()
              if (retryReader) {
                const retryDecoder = new TextDecoder()
                let retryContent = ''
                while (true) {
                  const { done, value } = await retryReader.read()
                  if (done) break
                  const chunk = retryDecoder.decode(value, { stream: true })
                  const lines = chunk.split('\n')
                  for (const line of lines) {
                    if (line.startsWith('data: ')) {
                      const data = line.slice(6)
                      if (data === '[DONE]') continue
                      try {
                        const parsed = JSON.parse(data)
                        if (parsed.content) retryContent += parsed.content
                      } catch { /* skip */ }
                    }
                  }
                }
                const retryActions = parseAllJarvisActions(retryContent)
                if (retryActions.length > 0) {
                  console.log('[OCTOPUS] Retry exitoso:', retryActions.length, 'acción(es) recuperada(s)')
                  fullContent = retryContent
                  allActions = retryActions
                  isMultiStep = retryActions.length > 1
                  cleanedPlan = retryContent.replace(/```jarvis-action[\s\S]*?```/g, '').trim()
                  // Actualizar mensaje con el nuevo plan limpio
                  setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: cleanedPlan } : m))
                }
              }
            }
          } catch (retryErr) {
            console.warn('[OCTOPUS] Retry silencioso falló:', retryErr)
          }
        }
      }

      if (allActions.length > 0) {
        // Show plan text before execution
        if (isMultiStep) {
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantMessageId
                ? { ...m, content: cleanedPlan + `\n\n---\n🔄 **Ejecutando ${allActions.length} pasos automáticamente...**` }
                : m
            )
          )
        }

        // Execute each action sequentially
        const stepResults: Array<{ step: number; success: boolean; label: string; image?: string }> = []
        let lastCreatedProjectId: string | null = null // Para asociar media al proyecto creado
        let lastCreatedDocId: string | null = null // Para encadenar docs create → append_text
        let lastCreatedCampaignId: string | null = null // Para encadenar campaign create → assign/activate
        let lastCreatedLeadId: string | null = null // Para encadenar create_lead → generate_outreach/assign

        // 🛡️ ACTION VALIDATION LAYER — Pre-filter actions that violate business rules
        // This catches LLM mistakes AT THE CODE LEVEL before they reach execution
        const validatedActions = allActions.filter((action, idx) => {
          // RULE 1: Block create_lead if send_email/reply exists in same batch (prevents duplicates)
          if (action.type === 'growth_engine' && (action.data?.growthAction === 'create_lead')) {
            const hasEmailAction = allActions.some((a, j) =>
              j !== idx && a.type === 'google_workspace' &&
              (a.data?.googleAction === 'send_email' || a.data?.googleAction === 'reply')
            )
            if (hasEmailAction) {
              console.warn('[action-validator] 🚫 Blocked create_lead — send_email exists in same batch (auto-track handles it)')
              return false
            }
          }
          // RULE 2: Block batch_approve in same chain as activate_campaign
          if (action.type === 'growth_engine' && action.data?.growthAction === 'batch_approve') {
            const hasActivate = allActions.some((a, j) =>
              j !== idx && a.type === 'growth_engine' && a.data?.growthAction === 'activate_campaign'
            )
            if (hasActivate) {
              console.warn('[action-validator] 🚫 Blocked batch_approve — activate_campaign in same chain (must be separate steps)')
              return false
            }
          }
          return true
        })
        if (validatedActions.length < allActions.length) {
          console.log(`[action-validator] Filtered: ${allActions.length} → ${validatedActions.length} actions`)
          allActions = validatedActions
          isMultiStep = allActions.length > 1
        }

        for (let i = 0; i < allActions.length; i++) {
          const action = allActions[i]
          
          // Auto-inject documentId from previous create step into append_text
          if (action.type === 'google_workspace' && action.data?.googleAction === 'append_text' && action.data?.googleParams) {
            const docIdParam = (action.data.googleParams as Record<string, unknown>).documentId as string
            if ((!docIdParam || docIdParam === 'DOCUMENT_ID_FROM_STEP_1') && lastCreatedDocId) {
              (action.data.googleParams as Record<string, unknown>).documentId = lastCreatedDocId
            }
          }
          
          // Auto-inject campaignId from previous create_campaign step into assign/activate/patch actions
          // ALWAYS override campaignId when lastCreatedCampaignId exists — the LLM may emit placeholders, hallucinated UUIDs, or "auto"
          if (action.type === 'growth_engine' && action.data?.growthParams && lastCreatedCampaignId) {
            const gAction2 = action.data.growthAction as string
            const gp = action.data.growthParams as Record<string, unknown>
            if (['assign_leads_to_campaign', 'activate_campaign', 'apply_campaign', 'apply_seasonal_campaign'].includes(gAction2)) {
              gp.campaignId = lastCreatedCampaignId
            }
          }
          
          // Auto-inject leadId from previous create_lead step into outreach/update/assign actions
          if (action.type === 'growth_engine' && action.data?.growthParams && lastCreatedLeadId) {
            const gAction2 = action.data.growthAction as string
            const gp = action.data.growthParams as Record<string, unknown>
            if (['generate_outreach', 'update_lead', 'get_lead'].includes(gAction2) && (!gp.leadId || gp.leadId === 'auto')) {
              gp.leadId = lastCreatedLeadId
            }
          }
          const stepNum = i + 1
          const totalSteps = allActions.length
          const stepLabel = action.message || `Paso ${stepNum}`

          // Update progress in the message
          if (isMultiStep) {
            const progressLines = stepResults.map(r => 
              `${r.success ? '✅' : '❌'} Paso ${r.step}: ${r.label}`
            )
            progressLines.push(`⏳ Paso ${stepNum}/${totalSteps}: ${stepLabel}`)
            
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantMessageId
                  ? { ...m, content: cleanedPlan + `\n\n---\n🔄 **Ejecución autónoma (${stepNum}/${totalSteps})**\n\n` + progressLines.join('\n'), isGeneratingImage: false, isGeneratingVideo: false }
                  : m
              )
            )
          }

          try {
            // === NAVEGACIÓN ===
            if (action.type === 'navigate' && action.data?.route) {
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantMessageId
                    ? { 
                        ...m, 
                        content: isMultiStep ? m.content : (action.message || `Navegando a ${action.data?.pageName || action.data?.route}...`),
                        actionResult: {
                          success: true,
                          type: 'navigate',
                          name: action.data?.pageName || action.data?.route || '',
                          location: action.data?.route || '',
                        }
                      }
                    : m
                )
              )
              addActivity(`🧭 OCTOPUS navegó a: ${action.data?.pageName || action.data?.route}`)
              setTimeout(() => { router.push(action.data?.route || '/dashboard') }, 1000)
              stepResults.push({ step: stepNum, success: true, label: `Navegación a ${action.data?.route}` })
            }
            // === CREAR PROYECTO ===
            else if (action.type === 'create_project') {
              const projName = action.data?.projectName || 'Nuevo Proyecto'
              const projDesc = action.data?.projectDescription || ''
              const projType = action.data?.projectType || 'custom'
              
              addActivity(`📁 OCTOPUS creando proyecto: ${projName}`)
              
              const projResponse = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: projName, description: projDesc, projectType: projType }),
              })
              
              if (projResponse.ok) {
                const projResult = await projResponse.json()
                // Guardar projectId para asociar media creada en pasos posteriores
                if (projResult.project?.id) {
                  lastCreatedProjectId = projResult.project.id
                }
                const notification: CreationNotification = {
                  id: `notif-${Date.now()}`,
                  type: 'skill' as const,
                  name: projName,
                  location: `/dashboard/projects/${projResult.project?.id || ''}`,
                  timestamp: new Date(),
                }
                setNotifications(prev => [notification, ...prev])
                setTimeout(() => { setNotifications(prev => prev.filter(n => n.id !== notification.id)) }, 5000)
                
                if (!isMultiStep) {
                  setMessages(prev =>
                    prev.map(m =>
                      m.id === assistantMessageId
                        ? { ...m, content: action.message || cleanedPlan, actionResult: { success: true, type: 'project', name: projName, location: `/dashboard/projects/${projResult.project?.id || ''}` } }
                        : m
                    )
                  )
                }
                addActivity(`✅ OCTOPUS creó proyecto: ${projName}`)
                stepResults.push({ step: stepNum, success: true, label: `Proyecto "${projName}" creado` })
              } else {
                throw new Error('Error creando proyecto')
              }
            }
            // === HERRAMIENTA YA CREADA SERVER-SIDE (tool system) ===
            else if (action.type === 'tool_created') {
              const toolType = (action.data?.toolType as string) || 'skill'
              const toolName = (action.data?.name as string) || 'Herramienta'
              const toolLocation = (action.data?.location as string) || '/dashboard'
              // Refrescar la lista correspondiente (la creación ya ocurrió en el servidor)
              try {
                if (toolType === 'skill') await fetchDbSkills()
                else if (toolType === 'agent') await fetchDbAgents()
                else if (toolType === 'mcp') await fetchDbMcps()
              } catch (e) { console.error('[Jarvis] Error refrescando lista tras tool_created:', e) }

              const notification: CreationNotification = {
                id: `notif-${Date.now()}`,
                type: toolType as 'skill' | 'agent' | 'mcp',
                name: toolName,
                location: toolLocation,
                timestamp: new Date(),
              }
              setNotifications(prev => [notification, ...prev])
              setTimeout(() => { setNotifications(prev => prev.filter(n => n.id !== notification.id)) }, 5000)

              if (!isMultiStep) {
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantMessageId
                      ? { ...m, content: m.content || cleanedPlan, actionResult: { success: true, type: toolType, name: toolName, location: toolLocation } }
                      : m
                  )
                )
              }
              addActivity(`✅ OCTOPUS creó ${toolType}: ${toolName}`)
              stepResults.push({ step: stepNum, success: true, label: `${toolType} "${toolName}" creado` })
            }
            // === CREACIÓN DE HERRAMIENTAS (legacy: acciones parseadas del texto) ===
            else if (['create_skill', 'create_agent', 'create_mcp'].includes(action.type)) {
              const createResponse = await fetch('/api/jarvis/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action }),
              })
              
              if (createResponse.ok) {
                const result = await createResponse.json()
                
                if (result.type === 'skill') {
                  // Save skill to DB instead of localStorage
                  try {
                    await fetch('/api/skill-factory/skills', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(result.data),
                    })
                    await fetchDbSkills()
                  } catch (e) { console.error('[Jarvis] Error saving created skill:', e) }
                } else if (result.type === 'agent') {
                  // Save agent to DB instead of localStorage
                  try {
                    await fetch('/api/agent-factory/agents', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(result.data),
                    })
                    await fetchDbAgents()
                  } catch (e) { console.error('[Jarvis] Error saving created agent:', e) }
                } else if (result.type === 'mcp') {
                  // Save MCP to DB instead of localStorage
                  try {
                    await fetch('/api/mcp-factory/servers', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(result.data),
                    })
                    await fetchDbMcps()
                  } catch (e) { console.error('[Jarvis] Error saving created MCP:', e) }
                }
                
                const notification: CreationNotification = {
                  id: `notif-${Date.now()}`,
                  type: result.type as 'skill' | 'agent' | 'mcp',
                  name: result.name,
                  location: result.location,
                  timestamp: new Date(),
                }
                setNotifications(prev => [notification, ...prev])
                setTimeout(() => { setNotifications(prev => prev.filter(n => n.id !== notification.id)) }, 5000)
                
                if (!isMultiStep) {
                  setMessages(prev =>
                    prev.map(m =>
                      m.id === assistantMessageId
                        ? { ...m, content: action.message || cleanedPlan, actionResult: { success: true, type: result.type, name: result.name, location: result.location } }
                        : m
                    )
                  )
                }
                addActivity(`✅ OCTOPUS creó ${result.type}: ${result.name}`)
                stepResults.push({ step: stepNum, success: true, label: `${result.type} "${result.name}" creado` })
              }
            }
            // === DELEGACIÓN A AGENTE ===
            else if (action.type === 'delegate_agent') {
              const agentName = (action.data?.agentName as string) || ''
              const delegateTask = (action.data?.task as string) || ''
              addActivity(`🤖 OCTOPUS delegando a agente: ${agentName}`)
              
              // Buscar agente en DB (use cached dbAgents)
              const allAgents = dbAgents
              const targetAgent = allAgents.find((a: { name: string; isActive: boolean }) => 
                a.name.toLowerCase().includes(agentName.toLowerCase()) || 
                agentName.toLowerCase().includes(a.name.toLowerCase())
              )
              
              if (!targetAgent) {
                const agentNotFoundMsg = `❌ No encontré un agente llamado "${agentName}". Los agentes activos son:\n${allAgents.filter((a: { isActive: boolean }) => a.isActive !== false).map((a: { name: string }) => `- ${a.name}`).join('\n') || '(ninguno)'}\n\n¿Quieres que cree uno?`
                if (!isMultiStep) {
                  setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: agentNotFoundMsg } : m))
                }
                stepResults.push({ step: stepNum, success: false, label: `Agente "${agentName}" no encontrado` })
              } else {
                // Llamar al agente vía /api/agent-factory/chat
                try {
                  const delegateResponse = await fetch('/api/agent-factory/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      messages: [{ role: 'user', content: delegateTask }],
                      systemPrompt: targetAgent.systemPrompt || `Eres ${targetAgent.name}. ${targetAgent.description || ''}`,
                      model: targetAgent.model || 'gpt-4.1',
                      temperature: targetAgent.temperature ?? 0.7,
                      maxTokens: targetAgent.maxTokens ?? 4096,
                    }),
                  })
                  
                  if (delegateResponse.ok && delegateResponse.body) {
                    // Leer stream completo del agente
                    const reader = delegateResponse.body.getReader()
                    const decoder = new TextDecoder()
                    let agentFullResponse = ''
                    
                    while (true) {
                      const { done, value } = await reader.read()
                      if (done) break
                      const chunk = decoder.decode(value, { stream: true })
                      // Parse SSE data lines
                      const lines = chunk.split('\n')
                      for (const line of lines) {
                        if (line.startsWith('data: ')) {
                          const data = line.slice(6)
                          if (data === '[DONE]') continue
                          try {
                            const parsed = JSON.parse(data)
                            const content = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.message?.content || ''
                            agentFullResponse += content
                          } catch {
                            // texto plano
                            agentFullResponse += data
                          }
                        }
                      }
                    }
                    
                    const delegateResult = `## 🤖 Respuesta de **${targetAgent.name}**\n\n${agentFullResponse}\n\n---\n*Tarea delegada: "${delegateTask}"*`
                    
                    if (!isMultiStep) {
                      setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: delegateResult } : m))
                    }
                    addActivity(`✅ Agente ${targetAgent.name} completó tarea`)
                    stepResults.push({ step: stepNum, success: true, label: `Agente "${targetAgent.name}" respondió` })
                  } else {
                    throw new Error(`Error del agente: ${delegateResponse.status}`)
                  }
                } catch (delegateErr) {
                  console.error('Delegation error:', delegateErr)
                  const errMsg = `❌ Error al delegar a ${targetAgent.name}: ${delegateErr instanceof Error ? delegateErr.message : 'Error desconocido'}`
                  if (!isMultiStep) {
                    setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: errMsg } : m))
                  }
                  stepResults.push({ step: stepNum, success: false, label: `Error delegando a "${targetAgent.name}"` })
                }
              }
            }
            // === INTROSPECCIÓN ===
            else if (action.type === 'introspect') {
              let introspectResult = ''
              const introspectType = action.data?.parameters?.type as string || 'structure'
              addActivity(`👁️ OCTOPUS activando ojos internos: ${introspectType}`)
              
              if (introspectType === 'structure') {
                const result = await introspectStructure()
                if (result.success && result.structure) {
                  introspectResult = `## 🏗️ Estructura del Sistema\n\n**${result.structure.name}** v${result.structure.version}\n\n`
                  introspectResult += `### 📱 Módulos (${result.structure.modules.length})\n`
                  result.structure.modules.forEach(mod => { introspectResult += `- **${mod.name}**: \`${mod.path}\`\n` })
                  introspectResult += `\n### 📚 Core Libs (${result.structure.coreLibs.length})\n`
                  result.structure.coreLibs.forEach(l => { introspectResult += `- **${l.name}**: ${l.description}\n` })
                  introspectResult += `\n### 🔌 APIs (${result.structure.apis.length})\n`
                  result.structure.apis.forEach(a => { introspectResult += `- \`${a.method}\` ${a.path}\n` })
                }
              } else if (introspectType === 'read') {
                const filePath = action.data?.parameters?.file as string
                if (filePath) {
                  const result = await readFile(filePath)
                  if (result.success && result.file) { introspectResult = formatCodeForChat(result.file) }
                  else { introspectResult = `❌ No pude leer el archivo: ${result.error}` }
                }
              } else if (introspectType === 'search') {
                const query = action.data?.parameters?.query as string
                if (query) {
                  const result = await searchInCode(query)
                  if (result.success && result.results) { introspectResult = formatSearchResults(result.results) }
                }
              } else if (introspectType === 'analyze-self') {
                const result = await analyzeSelf()
                if (result.success && result.analysis) { introspectResult = formatAnalysis(result.analysis) }
              } else if (introspectType === 'stats') {
                const result = await getSystemStats()
                if (result.success && result.stats) {
                  introspectResult = `## 📊 Estadísticas del Sistema\n\n- **Módulos totales**: ${result.stats.totalModules}\n- **APIs**: ${result.stats.totalApis}\n- **Core Libs**: ${result.stats.coreLibs}\n- **Archivos JARVIS**: ${result.stats.jarvisFiles.length}\n\n### 🤖 Mis archivos:\n`
                  result.stats.jarvisFiles.forEach(f => { introspectResult += `- \`${f}\`\n` })
                }
              }
              
              if (!isMultiStep) {
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantMessageId
                      ? { ...m, content: cleanedPlan + '\n\n' + introspectResult, actionResult: { success: true, type: 'introspect', name: `Introspección: ${introspectType}`, location: '/api/jarvis/introspect' } }
                      : m
                  )
                )
              }
              addActivity(`✅ OCTOPUS completó introspección: ${introspectType}`)
              stepResults.push({ step: stepNum, success: true, label: `Introspección: ${introspectType}` })
            }
            // === GOOGLE WORKSPACE ===
            else if (action.type === 'google_workspace' && action.data?.googleService) {
              const gService = action.data.googleService
              const gAction = action.data.googleAction || 'list_events'
              let gParams = (action.data.googleParams || {}) as Record<string, unknown>

              // 🛡️ EMAIL DRAFT MEMORY: Save draft params whenever OCTOPUS emits an email action with data
              if (gService === 'gmail' && ['send_email', 'create_draft', 'reply'].includes(gAction)) {
                if (gParams.to && gParams.subject && gParams.body) {
                  // LLM sent complete params — save as last draft
                  lastEmailDraftRef.current = { ...gParams }
                  console.log('[draft-memory] 💾 Saved draft:', (gParams.to as string)?.substring(0, 30), (gParams.subject as string)?.substring(0, 40))
                } else if (lastEmailDraftRef.current) {
                  // LLM sent INCOMPLETE params ("luz verde" problem) — auto-fill from last draft
                  console.warn('[draft-memory] ⚠️ Incomplete email params detected, auto-filling from last draft')
                  console.warn('[draft-memory] Missing:', !gParams.to ? 'to' : '', !gParams.subject ? 'subject' : '', !gParams.body ? 'body' : '')
                  gParams = {
                    ...lastEmailDraftRef.current, // base: all saved draft params
                    ...Object.fromEntries(Object.entries(gParams).filter(([, v]) => v !== undefined && v !== null && v !== '')), // overlay: any non-empty params from current action
                  }
                  console.log('[draft-memory] ✅ Auto-filled:', (gParams.to as string)?.substring(0, 30), (gParams.subject as string)?.substring(0, 40))
                }

                // 🛡️ FINAL VALIDATION: If still missing critical params, show friendly error instead of crashing
                if (!gParams.to || !gParams.subject || !gParams.body) {
                  const missing = [!gParams.to && 'destinatario', !gParams.subject && 'asunto', !gParams.body && 'cuerpo'].filter(Boolean).join(', ')
                  console.error('[draft-memory] ❌ Still missing after auto-fill:', missing)
                  const errContent = `⚠️ **No pude enviar el email** — faltan datos: ${missing}.\n\nIntenta de nuevo diciendo: *"Envía el email a [destinatario] con asunto [asunto]"* o repite los detalles del email.`
                  if (!isMultiStep) {
                    setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: errContent } : m))
                  } else {
                    setMessages(prev => [...prev, { id: `msg-err-${Date.now()}`, role: 'assistant', content: errContent, timestamp: new Date() }])
                  }
                  stepResults.push({ step: stepNum, success: false, label: `Email: faltan ${missing}` })
                  continue
                }
              }
              
              addActivity(`🔵 OCTOPUS consultando Google ${gService}: ${gAction}`)
              
              if (!isMultiStep) {
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantMessageId
                      ? { ...m, content: action.message || `🔵 Consultando Google ${gService}...` }
                      : m
                  )
                )
              }

              const googleResponse = await fetch('/api/brazos/google/services', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  service: gService,
                  action: gAction,
                  params: gParams,
                }),
              })

              if (googleResponse.ok) {
                const googleResult = await googleResponse.json()
                
                // Formatear resultado legible
                let formattedResult = ''
                if (gService === 'calendar' && gAction === 'list_events') {
                  const events = googleResult.data?.items || []
                  if (events.length === 0) {
                    formattedResult = '📅 No tienes eventos próximos en tu calendario.'
                  } else {
                    formattedResult = `📅 **Tus próximos ${events.length} eventos:**\n\n`
                    events.forEach((evt: Record<string, unknown>, idx: number) => {
                      const start = (evt.start as Record<string, string>)?.dateTime || (evt.start as Record<string, string>)?.date || ''
                      const startDate = start ? new Date(start).toLocaleString('es-MX', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Sin fecha'
                      const eventLink = (evt.htmlLink as string) || `https://calendar.google.com/calendar/r/eventedit/${evt.id || ''}`
                      formattedResult += `${idx + 1}. **${evt.summary || 'Sin título'}**\n   🕐 ${startDate}\n   ${evt.location ? `📍 ${evt.location}\n` : ''}${evt.description ? `   📝 ${(evt.description as string).substring(0, 80)}...\n` : ''}   🔗 [Abrir en Calendar](${eventLink})\n\n`
                    })
                  }
                } else if (gService === 'calendar' && gAction === 'create_event') {
                  formattedResult = `✅ **Evento creado exitosamente en Calendar:**\n- 📌 ${googleResult.data?.summary || 'Evento'}\n- 🔗 [Abrir en Calendar](${googleResult.data?.htmlLink || '#'})`
                } else if (gService === 'drive' && (gAction === 'list_files' || gAction === 'search')) {
                  const files = googleResult.data?.files || []
                  if (files.length === 0) {
                    formattedResult = '📁 No se encontraron archivos en Drive.'
                  } else {
                    formattedResult = `📁 **Archivos en Drive (${files.length}):**\n\n`
                    files.forEach((f: Record<string, unknown>, idx: number) => {
                      const modified = f.modifiedTime ? new Date(f.modifiedTime as string).toLocaleDateString('es-MX') : ''
                      const mimeIcon = (f.mimeType as string || '').includes('folder') ? '📂' : (f.mimeType as string || '').includes('document') ? '📄' : (f.mimeType as string || '').includes('spreadsheet') ? '📊' : (f.mimeType as string || '').includes('presentation') ? '📰' : '📎'
                      const fileLink = (f.webViewLink as string) || `https://drive.google.com/file/d/${f.id || ''}/view`
                      formattedResult += `${idx + 1}. ${mimeIcon} **${f.name}**${modified ? ` — ${modified}` : ''}\n   🔗 [Abrir en Drive](${fileLink})\n\n`
                    })
                  }
                } else if (gService === 'gmail' && (gAction === 'list_messages' || gAction === 'list_emails')) {
                  const emails = googleResult.data?.messages || []
                  if (emails.length === 0) {
                    formattedResult = '📧 No se encontraron emails.'
                  } else {
                    formattedResult = `📧 **Tus últimos ${emails.length} emails:**\n\n`
                    emails.forEach((email: Record<string, unknown>, idx: number) => {
                      const fromStr = (email.from as string || '').split('<')[0].trim().replace(/"/g, '')
                      const dateStr = email.date ? new Date(email.date as string).toLocaleString('es-MX', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
                      const emailLink = `https://mail.google.com/mail/u/0/#inbox/${email.id || ''}`
                      formattedResult += `${idx + 1}. **${email.subject || 'Sin asunto'}**\n   👤 ${fromStr}\n   🕐 ${dateStr}\n   💬 ${((email.snippet as string) || '').substring(0, 100)}...\n   🔗 [Abrir en Gmail](${emailLink})\n\n`
                    })
                  }
                } else if (gService === 'docs' && gAction === 'list') {
                  const docs = googleResult.data?.files || []
                  if (docs.length === 0) {
                    formattedResult = '📝 No se encontraron documentos en Google Docs.'
                  } else {
                    formattedResult = `📝 **Tus documentos de Google Docs (${docs.length}):**\n\n`
                    docs.forEach((doc: Record<string, unknown>, idx: number) => {
                      const modified = doc.modifiedTime ? new Date(doc.modifiedTime as string).toLocaleDateString('es-MX') : ''
                      const docLink = (doc.webViewLink as string) || `https://docs.google.com/document/d/${doc.id || ''}/edit`
                      formattedResult += `${idx + 1}. 📄 **${doc.name}**${modified ? ` — ${modified}` : ''}\n   🔗 [Abrir en Google Docs](${docLink})\n\n`
                    })
                  }
                } else if (gService === 'docs' && gAction === 'create') {
                  const docId = googleResult.data?.documentId || ''
                  const docLink = docId ? `https://docs.google.com/document/d/${docId}/edit` : '#'
                  formattedResult = `✅ **Documento creado:** "${googleResult.data?.title || 'Nuevo Documento'}"\n🔗 [Abrir en Google Docs](${docLink})`
                  // Save docId for chained append_text steps
                  if (docId) lastCreatedDocId = docId
                } else if (gService === 'docs' && gAction === 'append_text') {
                  const docId = gParams.documentId || ''
                  const docLink = docId ? `https://docs.google.com/document/d/${docId}/edit` : '#'
                  formattedResult = `✅ **Contenido escrito en el documento exitosamente.**\n🔗 [Abrir en Google Docs](${docLink})`
                } else if (gService === 'sheets' && gAction === 'create') {
                  const sheetUrl = googleResult.data?.spreadsheetUrl || '#'
                  formattedResult = `✅ **Hoja de cálculo creada:** "${googleResult.data?.properties?.title || 'Nueva Hoja'}"\n🔗 [Abrir en Google Sheets](${sheetUrl})`
                } else {
                  // Generic formatter
                  formattedResult = `✅ **Google ${gService} — ${gAction}:**\n\`\`\`json\n${JSON.stringify(googleResult.data, null, 2).substring(0, 1500)}\n\`\`\``
                }

                if (!isMultiStep) {
                  setMessages(prev =>
                    prev.map(m =>
                      m.id === assistantMessageId
                        ? { ...m, content: formattedResult, actionResult: { success: true, type: 'google_workspace', name: `Google ${gService}`, location: '/dashboard/brazos' } }
                        : m
                    )
                  )
                } else {
                  // Add as separate message in multi-step
                  const gMsg: ChatMessage = {
                    id: `msg-google-${Date.now()}-${i}`,
                    role: 'assistant',
                    content: formattedResult,
                    timestamp: new Date(),
                  }
                  setMessages(prev => [...prev, gMsg])
                }
                addActivity(`✅ OCTOPUS completó Google ${gService}: ${gAction}`)
                stepResults.push({ step: stepNum, success: true, label: `Google ${gService}: ${gAction}` })
                // === AUTO-TRACK: Register/update lead when email is sent via Google ===
                if (gService === 'gmail' && ['send_email', 'reply'].includes(gAction) && gParams?.to) {
                  const trackPayload = {
                    email: gParams.to,
                    subject: gParams.subject || '',
                    contactName: gParams._contactName || null,
                    businessName: gParams._businessName || null,
                    phone: gParams._phone || null,
                    website: gParams._website || null,
                    city: gParams._city || null,
                  }
                  console.log('[auto-track] 📡 Sending Google track:', trackPayload.email, trackPayload.contactName)
                  fetch('/api/growth/leads/auto-track', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(trackPayload),
                  })
                    .then(r => r.json())
                    .then(data => console.log('[auto-track] ✅ Google result:', data.action, data.lead?.id))
                    .catch(err => console.error('[auto-track] ❌ Google track failed:', err))
                }
              } else {
                const errData = await googleResponse.json().catch(() => ({ error: 'Error desconocido' }))
                const errMsg = (errData as Record<string, string>).error || `Error ${googleResponse.status}`
                
                if (googleResponse.status === 403) {
                  // === SMTP FALLBACK: If this is an email action and Google is not connected, try SMTP ===
                  const isEmailAction = gService === 'gmail' && ['send_email', 'create_draft'].includes(gAction)
                  if (isEmailAction && gParams) {
                    addActivity('🔄 Google no conectado, intentando vía SMTP...')
                    const smtpResponse = await fetch('/api/brazos/smtp/send', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        action: 'send_email',
                        params: gParams,
                      }),
                    })
                    if (smtpResponse.ok) {
                      const smtpResult = await smtpResponse.json()
                      const smtpMsg = `✅ **Email enviado vía SMTP:**\n- 📧 Para: ${smtpResult.to}\n- 📝 Asunto: ${smtpResult.subject}\n- 🏷️ Desde: ${smtpResult.from || 'SMTP'}`
                      if (!isMultiStep) {
                        setMessages(prev =>
                          prev.map(m =>
                            m.id === assistantMessageId
                              ? { ...m, content: smtpMsg, actionResult: { success: true, type: 'google_workspace', name: 'SMTP Email', location: '/dashboard/brazos' } }
                              : m
                          )
                        )
                      } else {
                        const sMsg: ChatMessage = { id: `msg-smtp-${Date.now()}-${i}`, role: 'assistant', content: smtpMsg, timestamp: new Date() }
                        setMessages(prev => [...prev, sMsg])
                      }
                      addActivity('✅ Email enviado vía SMTP')
                      stepResults.push({ step: stepNum, success: true, label: 'Email enviado (SMTP)' })
                      // === AUTO-TRACK: Register/update lead when email is sent via SMTP ===
                      if (gParams?.to) {
                        const smtpTrackPayload = {
                          email: gParams.to,
                          subject: gParams.subject || '',
                          contactName: gParams._contactName || null,
                          businessName: gParams._businessName || null,
                          phone: gParams._phone || null,
                          website: gParams._website || null,
                          city: gParams._city || null,
                        }
                        console.log('[auto-track] 📡 Sending SMTP track:', smtpTrackPayload.email, smtpTrackPayload.contactName)
                        fetch('/api/growth/leads/auto-track', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(smtpTrackPayload),
                        })
                          .then(r => r.json())
                          .then(data => console.log('[auto-track] ✅ SMTP result:', data.action, data.lead?.id))
                          .catch(err => console.error('[auto-track] ❌ SMTP track failed:', err))
                      }
                    } else {
                      const smtpErr = await smtpResponse.json().catch(() => ({ error: 'SMTP no disponible' }))
                      const smtpErrMsg = smtpResponse.status === 403
                        ? `⚠️ **No hay servicio de email conectado.**\n\nConecta uno de estos en **Brazos**:\n- 🔵 **Google Workspace** (Gmail API)\n- 📧 **SMTP Email** (Hostinger, Zoho, etc. — gratis)\n\n[Ir a Brazos →](/dashboard/brazos)`
                        : `❌ Error SMTP: ${(smtpErr as Record<string, string>).error}`
                      if (!isMultiStep) {
                        setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: smtpErrMsg } : m))
                      }
                      stepResults.push({ step: stepNum, success: false, label: 'Email no enviado' })
                    }
                  } else {
                    const notConnectedMsg = `⚠️ **Google Workspace no está conectado.**\n\nVe a **Brazos** → Google Workspace → Conectar para habilitar esta funcionalidad.\n\n[Ir a Brazos →](/dashboard/brazos)`
                    if (!isMultiStep) {
                      setMessages(prev =>
                        prev.map(m =>
                          m.id === assistantMessageId
                            ? { ...m, content: notConnectedMsg }
                            : m
                        )
                      )
                    }
                    stepResults.push({ step: stepNum, success: false, label: `Google Workspace no conectado` })
                  }
                } else {
                  throw new Error(errMsg)
                }
              }
            }
            // === 🚀 GROWTH ENGINE ===
            // === SCHEDULE / SOCIAL BRIDGE (LLM-generated schedule action) ===
            else if (action.type === 'schedule' && action.data) {
              const schedContent = (action.data as Record<string, unknown>).content as string || (action.data as Record<string, unknown>).text as string || ''
              const schedPlatform = (action.data as Record<string, unknown>).platform as string || 'linkedin'
              const schedTime = (action.data as Record<string, unknown>).scheduledFor as string || (action.data as Record<string, unknown>).time as string || (action.data as Record<string, unknown>).date as string
              
              // Search for recent video/image in messages
              const recentMsgsForSched = messages.slice(-20)
              let schedMediaUrl: string | undefined
              let schedMediaType: string | undefined
              
              // Check for video
              const vidMsg = [...recentMsgsForSched].reverse().find(m => m.generatedVideo)
              if (vidMsg?.generatedVideo) {
                schedMediaUrl = vidMsg.generatedVideo
                schedMediaType = 'video'
              }
              if (!schedMediaUrl) {
                const videoUrlMsg = [...recentMsgsForSched].reverse().find(m =>
                  m.role === 'assistant' && (m.content.includes('Ver/Descargar Video') || /https?:\/\/[^\s\)]+\.(?:mp4|webm|mov)/i.test(m.content))
                )
                if (videoUrlMsg) {
                  const urlMatch = videoUrlMsg.content.match(/\[Ver\/Descargar Video\]\((https?:\/\/[^\)]+)\)/i) || videoUrlMsg.content.match(/(https?:\/\/[^\s\)]+\.(?:mp4|webm|mov))/i)
                  if (urlMatch) { schedMediaUrl = urlMatch[1]; schedMediaType = 'video' }
                }
              }
              // Check for image
              if (!schedMediaUrl) {
                const imgMsg = [...recentMsgsForSched].reverse().find(m => m.generatedImage && m.role === 'assistant')
                if (imgMsg?.generatedImage) { schedMediaUrl = imgMsg.generatedImage; schedMediaType = 'image' }
              }
              
              // Build proper content
              let finalContent = schedContent
              if (!finalContent && schedMediaUrl && schedMediaType === 'video') {
                finalContent = '🚀 Check out what AI can do for your business. OCTOPUS Omni Cockpit — one platform, total control.\n\n#AI #Automation #OCTOPUS #Innovation'
              } else if (!finalContent) {
                finalContent = '🐙 Publicado con OCTOPUS — AI Delivery Protocol\n\n#AI #OCTOPUS'
              }
              
              const scheduleDate = schedTime ? new Date(schedTime) : new Date(Date.now() + 3600000)
              
              try {
                const pubRes = await fetch('/api/social-bridge/publish', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    platform: schedPlatform,
                    content: finalContent,
                    mediaUrl: schedMediaUrl,
                    mediaType: schedMediaType,
                    scheduledFor: scheduleDate.toISOString(),
                    source: 'jarvis',
                  }),
                })
                
                if (pubRes.ok) {
                  const dateStr = scheduleDate.toLocaleDateString('es', { weekday: 'long', month: 'long', day: 'numeric' })
                  const timeStr = scheduleDate.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: true })
                  const mediaLabel = schedMediaType === 'video' ? '🎬 Con video adjunto' : schedMediaType === 'image' ? '📷 Con imagen adjunta' : ''
                  
                  if (!isMultiStep) {
                    setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: `## 📅 ¡Publicación Programada!\n\n**Fecha:** ${dateStr}\n**Hora:** ${timeStr}\n**Plataforma:** ${schedPlatform}\n${mediaLabel ? `**Media:** ${mediaLabel}\n` : ''}\n**Contenido:**\n> ${finalContent.split('\n').join('\n> ')}\n\n✅ Aparecerá en tu [Social Bridge](/dashboard/social-bridge) → "Programar"` } : m))
                  }
                  stepResults.push({ step: stepNum, success: true, label: `Publicación programada: ${dateStr} ${timeStr}` })
                  addActivity(`📅 Publicación programada: ${dateStr} ${timeStr}`, 'success')
                } else {
                  stepResults.push({ step: stepNum, success: false, label: 'Error programando publicación' })
                }
              } catch {
                stepResults.push({ step: stepNum, success: false, label: 'Error programando publicación' })
              }
            }
            else if (action.type === 'growth_engine' && action.data?.growthAction) {
              const gAction = action.data.growthAction
              const gParams = action.data.growthParams || {}

              addActivity(`🚀 OCTOPUS ejecutando Growth Engine: ${gAction}`)

              if (!isMultiStep) {
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantMessageId
                      ? { ...m, content: action.message || `🚀 Ejecutando Growth Engine: ${gAction}...` }
                      : m
                  )
                )
              }

              let growthUrl = ''
              let growthMethod = 'GET'
              let growthBody: string | undefined = undefined

              // Map growthAction → API endpoint
              switch (gAction) {
                case 'list_leads': {
                  const qp = new URLSearchParams()
                  if (gParams.status) qp.set('status', gParams.status as string)
                  if (gParams.tier) qp.set('tier', gParams.tier as string)
                  if (gParams.search) qp.set('search', gParams.search as string)
                  if (gParams.limit) qp.set('limit', String(gParams.limit))
                  if (gParams.source) qp.set('source', gParams.source as string)
                  if (gParams.hasTags) qp.set('hasTags', 'true')
                  growthUrl = `/api/growth/leads?${qp.toString()}`
                  break
                }
                case 'nurture_status': {
                  growthUrl = '/api/growth/campaigns/nurture'
                  break
                }
                case 'research_lead': {
                  // Special case: research_lead uses POST with body and its own response handling
                  growthUrl = '/api/growth/leads/research'
                  growthMethod = 'POST'
                  growthBody = JSON.stringify({
                    email: gParams.email || undefined,
                    leadId: gParams.leadId || undefined,
                    name: gParams.name || gParams.contactName || gParams.businessName || undefined,
                  })
                  break
                }
                case 'get_lead':
                  growthUrl = `/api/growth/leads/${gParams.leadId}`
                  break
                case 'create_lead':
                  growthUrl = '/api/growth/leads'
                  growthMethod = 'POST'
                  growthBody = JSON.stringify(gParams)
                  break
                case 'update_lead':
                  growthUrl = `/api/growth/leads/${gParams.leadId}`
                  growthMethod = 'PATCH'
                  growthBody = JSON.stringify(gParams)
                  break
                case 'generate_outreach':
                  growthUrl = '/api/growth/outreach'
                  growthMethod = 'POST'
                  growthBody = JSON.stringify({
                    leadId: gParams.leadId,
                    email: gParams.email,
                    customSubject: gParams.customSubject || gParams.subject,
                    customMessage: gParams.customMessage || gParams.message || gParams.body,
                    tone: gParams.tone,
                    language: gParams.language,
                  })
                  break
                case 'update_pending_emails':
                case 'update_outreach_copy':
                  growthUrl = '/api/growth/actions/update-copy'
                  growthMethod = 'POST'
                  growthBody = JSON.stringify({
                    subject: gParams.subject,
                    body: gParams.body,
                    campaignId: gParams.campaignId,
                  })
                  break
                case 'approve_action':
                  growthUrl = `/api/growth/actions/${gParams.actionId}`
                  growthMethod = 'PATCH'
                  growthBody = JSON.stringify({ status: 'approved' })
                  break
                case 'list_actions': {
                  const aq = new URLSearchParams()
                  if (gParams.status) aq.set('status', gParams.status as string)
                  if (gParams.leadId) aq.set('leadId', gParams.leadId as string)
                  growthUrl = `/api/growth/actions?${aq.toString()}`
                  break
                }
                case 'sync_inbox':
                  growthUrl = '/api/growth/inbox/sync'
                  growthMethod = 'POST'
                  break
                case 'list_inbox': {
                  const iq = new URLSearchParams()
                  if (gParams.leadId) iq.set('leadId', gParams.leadId as string)
                  growthUrl = `/api/growth/inbox?${iq.toString()}`
                  break
                }
                case 'reply_email':
                  growthUrl = '/api/growth/inbox/reply'
                  growthMethod = 'POST'
                  growthBody = JSON.stringify(gParams)
                  break
                case 'get_stats':
                  growthUrl = '/api/growth/stats'
                  break
                case 'get_insights':
                  growthUrl = '/api/growth/insights'
                  break
                case 'get_report':
                  growthUrl = '/api/growth/reports'
                  break
                case 'list_campaigns':
                  growthUrl = '/api/growth/campaigns'
                  break
                case 'create_campaign':
                  growthUrl = '/api/growth/campaigns'
                  growthMethod = 'POST'
                  growthBody = JSON.stringify(gParams)
                  break
                case 'campaign_status': {
                  growthUrl = '/api/growth/campaigns'
                  break
                }
                case 'assign_leads_to_campaign':
                  growthUrl = '/api/growth/campaigns'
                  growthMethod = 'PATCH'
                  // Smart assign: if count is provided, use assignTopN (auto-picks top leads by score)
                  // Falls back to explicit leadIds if provided
                  if (gParams.count || gParams.assignTopN) {
                    growthBody = JSON.stringify({ id: gParams.campaignId, assignTopN: gParams.count || gParams.assignTopN })
                  } else {
                    growthBody = JSON.stringify({ id: gParams.campaignId, addLeadIds: gParams.leadIds || gParams.addLeadIds })
                  }
                  break
                case 'activate_campaign':
                  // Use the Semi-Auto activate endpoint that generates AI emails as pending actions
                  // Supports campaignId, campaignName, or "auto" (picks most recent draft)
                  growthUrl = '/api/growth/campaigns/activate'
                  growthMethod = 'POST'
                  growthBody = JSON.stringify({ 
                    campaignId: gParams.campaignId || 'auto',
                    campaignName: gParams.campaignName || gParams.name || undefined,
                  })
                  break
                case 'delete_campaign':
                  growthUrl = `/api/growth/campaigns?id=${gParams.campaignId}`
                  growthMethod = 'DELETE'
                  break
                case 'apply_seasonal_campaign':
                case 'apply_campaign':
                  growthUrl = '/api/growth/campaigns'
                  growthMethod = 'POST'
                  growthBody = JSON.stringify(gParams)
                  break
                case 'batch_outreach':
                  growthUrl = '/api/growth/outreach/batch'
                  growthMethod = 'POST'
                  growthBody = JSON.stringify({ limit: gParams.limit || 10, status: gParams.status || 'new' })
                  break
                case 'batch_approve':
                  growthUrl = '/api/growth/actions/batch-approve'
                  growthMethod = 'POST'
                  growthBody = JSON.stringify({})
                  break
                case 'send_follow_up':
                  growthUrl = '/api/growth/outreach/batch'
                  growthMethod = 'POST'
                  growthBody = JSON.stringify({ limit: gParams.limit || 10, status: gParams.status || 'contacted', followUp: true })
                  break
                default:
                  growthUrl = '/api/growth/stats'
              }

              const fetchOpts: RequestInit = {
                method: growthMethod,
                headers: { 'Content-Type': 'application/json' },
              }
              if (growthBody && growthMethod !== 'GET') fetchOpts.body = growthBody

              const growthRes = await fetch(growthUrl, fetchOpts)

              if (growthRes.ok) {
                const growthData = await growthRes.json()
                let formatted = ''

                // Format based on action type
                if (gAction === 'list_leads') {
                  const leads = growthData.leads || growthData || []
                  if (Array.isArray(leads) && leads.length > 0) {
                    // Check if filtered by source for contextual header
                    const sourceFilter = gParams.source as string | undefined
                    const headerLabel = sourceFilter
                      ? `🔍 Leads de **${sourceFilter}** — ${leads.length}:`
                      : `🚀 **Pipeline — ${leads.length} leads:**`
                    formatted = `${headerLabel}\n\n`
                    leads.slice(0, 15).forEach((l: Record<string, unknown>, idx: number) => {
                      const tierEmoji = l.leadTier === 'antimatter' ? '⚛️' : l.leadTier === 'vibranium' ? '💎' : l.leadTier === 'diamond' ? '💠' : '📋'
                      // Show source badge for external leads
                      const sourceBadge = l.leadSource && l.leadSource !== 'octopus-prospecting' ? ` 🏷️ \`${l.leadSource}\`` : ''
                      const tagsBadge = l.tags ? ` 🔖 ${l.tags}` : ''
                      formatted += `${idx + 1}. ${tierEmoji} **${l.businessName || l.contactName}** — ${l.businessType || 'N/A'}\n   📧 ${l.email || 'sin email'} | 📍 ${l.city || ''}${l.state ? `, ${l.state}` : ''} | Score: ${l.qualificationScore || 0}\n   Estado: \`${l.status}\` | Tier: \`${l.leadTier}\`${sourceBadge}${tagsBadge}\n\n`
                    })
                    if (leads.length > 15) formatted += `...y ${leads.length - 15} más.\n`
                  } else {
                    formatted = '📋 No hay leads en el pipeline aún. ¿Quieres crear uno?'
                  }
                } else if (gAction === 'nurture_status') {
                  const templates = growthData.templates || []
                  const campaigns = growthData.campaigns || []
                  formatted = `🌱 **Nurture Campaigns:**\n\n`
                  if (campaigns.length > 0) {
                    campaigns.forEach((c: Record<string, unknown>) => {
                      const leadsCount = (c._count as Record<string, number>)?.leads || 0
                      formatted += `📬 **${c.name}** | Status: \`${c.status}\` | Type: \`${c.campaignType}\`\n   📊 Total: ${c.totalLeads} leads | Sent: ${c.sentCount} | Opens: ${c.openCount} | Replies: ${c.replyCount} | Converted: ${c.convertedCount}\n   📅 Started: ${c.startedAt ? new Date(c.startedAt as string).toLocaleDateString() : 'N/A'} | Enrolled: ${leadsCount}\n\n`
                    })
                  } else {
                    formatted += '📋 No hay campañas de nurture activas.\n'
                  }
                  if (templates.length > 0) {
                    formatted += `\n📋 **Templates disponibles:** ${templates.map((t: Record<string, unknown>) => `${t.name} (${t.stepsCount} pasos)`).join(', ')}\n`
                  }
                } else if (gAction === 'research_lead') {
                  // research_lead returns { analysis, leadFound, lead, domain, sources }
                  formatted = growthData.analysis || '❌ No se pudo completar la investigación.'
                  if (growthData.sources && growthData.sources.length > 0) {
                    formatted += `\n\n---\n📎 **Fuentes:** ${growthData.sources.map((s: string) => `[${new URL(s).hostname}](${s})`).join(' · ')}`
                  }
                  if (growthData.domain?.active) {
                    formatted += `\n🌐 Dominio activo: **${growthData.domain.name}** ${growthData.domain.title ? `— "${growthData.domain.title}"` : ''}`
                  }
                } else if (gAction === 'get_lead') {
                  const l = growthData
                  formatted = `🔍 **Detalle del Lead:**\n\n📌 **${l.businessName || 'Sin nombre'}** (${l.businessType || 'N/A'})\n- 👤 ${l.contactName || 'N/A'}\n- 📧 ${l.email || 'N/A'}\n- 📱 ${l.phone || 'N/A'}\n- 📍 ${l.city || ''}${l.state ? `, ${l.state}` : ''}, ${l.country || ''}\n- ⭐ Google Rating: ${l.googleRating || 'N/A'}\n- 🎯 Score: ${l.qualificationScore}/100 | Tier: \`${l.leadTier}\`\n- 📊 Status: \`${l.status}\` | Follow-ups: ${l.followUpCount || 0}\n${l.painPoints ? `- 🎯 Pain Points: ${JSON.stringify(l.painPoints)}\n` : ''}${l.notes ? `- 📝 Notas: ${l.notes}\n` : ''}`
                } else if (gAction === 'create_lead') {
                  let ppExtra = ''
                  try {
                    if (growthData.painPoints) {
                      const pp = typeof growthData.painPoints === 'string' ? JSON.parse(growthData.painPoints) : growthData.painPoints
                      if (pp.urgencia) ppExtra += `\n- 🔥 Urgencia: ${pp.urgencia}/10`
                      if (pp.probabilidad_conversion) ppExtra += ` | Conversión: \`${pp.probabilidad_conversion}\``
                      if (pp.valor_estimado_cliente) ppExtra += `\n- 💰 Valor estimado: ${pp.valor_estimado_cliente}`
                      if (pp.fuente) ppExtra += `\n- 📡 Fuente: ${pp.fuente}`
                      if (pp.senal_compra) ppExtra += `\n- 🎯 Señal de compra: ${pp.senal_compra}`
                      if (pp.approach_recomendado) ppExtra += `\n- 💬 Approach: _${pp.approach_recomendado.substring(0, 120)}..._`
                    }
                  } catch { /* ignore parse errors */ }
                  // Save lead ID for chained outreach/update steps
                  if (growthData.id) lastCreatedLeadId = growthData.id
                  formatted = `✅ **Lead GOLD STANDARD creado:**\n- 📌 ${growthData.businessName || growthData.contactName}\n- 📍 ${growthData.city || ''}${growthData.state ? `, ${growthData.state}` : ''}\n- 🎯 Score: ${growthData.qualificationScore}/100 | Tier: \`${growthData.leadTier}\`${ppExtra}`
                } else if (gAction === 'update_lead') {
                  formatted = `✅ **Lead actualizado:** ${growthData.businessName || growthData.contactName}`
                } else if (gAction === 'update_pending_emails' || gAction === 'update_outreach_copy') {
                  formatted = `✉️ **Copy actualizado:**\n\n${growthData.message || ''}\n\n${growthData.updated || 0} emails pendientes ahora tienen el nuevo subject/body. Apruébalos cuando quieras enviarlos.`
                } else if (gAction === 'generate_outreach') {
                  formatted = `📧 **Outreach generado:**\n\n`
                  if (growthData.action) {
                    formatted += `**Asunto:** ${growthData.action.title || 'N/A'}\n\n${growthData.action.description || ''}\n\n⚡ *Acción pendiente de aprobación (ID: ${growthData.action.id}). Apruébala para enviar el email.*`
                  } else {
                    formatted += JSON.stringify(growthData, null, 2).substring(0, 1500)
                  }
                } else if (gAction === 'approve_action') {
                  formatted = `✅ **Acción aprobada y ejecutada.**\n${growthData.emailSent ? '📧 Email enviado exitosamente via Gmail.' : ''}`
                } else if (gAction === 'list_actions') {
                  const actions2 = growthData.actions || growthData || []
                  if (Array.isArray(actions2) && actions2.length > 0) {
                    formatted = `⚡ **${actions2.length} acciones:**\n\n`
                    actions2.slice(0, 10).forEach((a: Record<string, unknown>, idx: number) => {
                      formatted += `${idx + 1}. **${a.title}** — \`${a.status}\`\n   Tipo: ${a.actionType} | Lead: ${(a as Record<string, Record<string, string>>).lead?.businessName || 'N/A'}\n\n`
                    })
                  } else {
                    formatted = '⚡ No hay acciones registradas.'
                  }
                } else if (gAction === 'list_inbox') {
                  const inboxMessages = growthData.messages || []
                  if (Array.isArray(inboxMessages) && inboxMessages.length > 0) {
                    formatted = `📬 **Bandeja de entrada — ${inboxMessages.length} mensajes:**\n\n`
                    inboxMessages.slice(0, 10).forEach((msg: Record<string, unknown>, idx: number) => {
                      const fromStr = (msg.from as string) || 'Desconocido'
                      const subject = (msg.subject as string) || 'Sin asunto'
                      const snippet = (msg.snippet as string) || ''
                      const dateStr = msg.date ? new Date(msg.date as string).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
                      const leadName = (msg.leadName as string) || ''
                      const labels = (msg.labelIds as string[]) || []
                      const isReply = labels.includes('INBOX') || (fromStr.toLowerCase().includes('@') && !fromStr.toLowerCase().includes('octopus'))
                      const icon = isReply ? '📩' : '📤'
                      formatted += `${idx + 1}. ${icon} **${subject}**\n   De: ${fromStr}${leadName ? ` (${leadName})` : ''} · ${dateStr}\n   _${snippet.substring(0, 150)}${snippet.length > 150 ? '...' : ''}_\n\n`
                    })
                    if (inboxMessages.length > 10) formatted += `...y ${inboxMessages.length - 10} mensajes más.\n`
                  } else {
                    formatted = '📬 La bandeja está vacía — no hay mensajes recientes de leads.'
                  }
                } else if (gAction === 'sync_inbox') {
                  formatted = `🔄 **Inbox sincronizado:**\n- Replies procesados: ${growthData.processed || 0}\n- Nuevos: ${growthData.newReplies || 0}\n- Bounces: ${growthData.bounces || 0}`
                } else if (gAction === 'get_stats') {
                  const s = growthData
                  formatted = `📊 **Estadísticas del Growth Engine:**\n\n- Total leads: ${s.total || 0}\n- Por status: ${JSON.stringify(s.byStatus || {})}\n- Por tier: ${JSON.stringify(s.byTier || {})}\n- Score promedio: ${s.avgScore || 0}\n- Tasa de conversión: ${s.conversionRate || 0}%`
                } else if (gAction === 'get_insights') {
                  const insights = growthData.insights || []
                  if (Array.isArray(insights) && insights.length > 0) {
                    formatted = `🧠 **Insights del Growth Engine:**\n\n`
                    insights.forEach((ins: Record<string, unknown>, idx: number) => {
                      formatted += `${idx + 1}. **${ins.title}**\n   ${ins.description}\n\n`
                    })
                  } else {
                    formatted = `🧠 **Resumen:** ${growthData.summary || JSON.stringify(growthData).substring(0, 1000)}`
                  }
                } else if (gAction === 'get_report') {
                  formatted = `📋 **Reporte del Growth Engine:**\n\n${growthData.report || growthData.summary || JSON.stringify(growthData, null, 2).substring(0, 2000)}`
                } else if (gAction === 'list_campaigns' || gAction === 'campaign_status') {
                  const camps = growthData.campaigns || []
                  const stats = growthData.stats || {}
                  if (Array.isArray(camps) && camps.length > 0) {
                    formatted = `🎯 **Campañas (${stats.total || camps.length} total — ${stats.active || 0} activas, ${stats.draft || 0} borrador):**\n\n`
                    camps.forEach((c: Record<string, unknown>, idx: number) => {
                      const statusEmoji = c.status === 'active' ? '🟢' : c.status === 'draft' ? '📝' : c.status === 'completed' ? '✅' : '⏸️'
                      formatted += `${idx + 1}. ${statusEmoji} **${c.name}** [${c.campaignType || 'outreach'}]\n   Status: \`${c.status}\` | Leads: ${c.totalLeads || 0} | Enviados: ${c.sentCount || 0} | Respuestas: ${c.replyCount || 0} | Convertidos: ${c.convertedCount || 0}\n\n`
                    })
                  } else {
                    formatted = '🎯 No hay campañas creadas aún. Di "crea una campaña" para empezar.'
                  }
                  if (growthData.seasonalTemplates && growthData.seasonalTemplates.length > 0) {
                    formatted += `\n📅 **Templates estacionales disponibles:**\n`
                    growthData.seasonalTemplates.forEach((t: Record<string, unknown>) => {
                      formatted += `- ${t.emoji} **${t.name}**: ${t.description}\n`
                    })
                  }
                } else if (gAction === 'create_campaign') {
                  const c = growthData.campaign || growthData
                  // Save campaign ID for chained assign/activate steps
                  if (c.id) lastCreatedCampaignId = c.id
                  formatted = `✅ **Campaña creada:**\n\n🎯 **${c.name}**\n- Tipo: ${c.campaignType || 'outreach'}\n- Status: \`${c.status}\`\n- Leads asignados: ${c.totalLeads || c._count?.leads || 0}\n${c.description ? `- Descripción: ${c.description}\n` : ''}\n📋 La campaña está en **borrador**. Ahora puedes asignarle leads y luego activarla.`
                } else if (gAction === 'assign_leads_to_campaign') {
                  const c = growthData.campaign || growthData
                  const assignedLeads = growthData.assignedLeads || []
                  const assignedCount = growthData.assignedCount || c.totalLeads || c._count?.leads || 0
                  let leadList = ''
                  if (assignedLeads.length > 0) {
                    leadList = '\n\n**Leads asignados:**\n'
                    assignedLeads.slice(0, 15).forEach((l: Record<string, unknown>, idx: number) => {
                      leadList += `${idx + 1}. **${l.businessName}** (Score: ${l.qualificationScore || 0})\n`
                    })
                    if (assignedLeads.length > 15) leadList += `...y ${assignedLeads.length - 15} más.\n`
                  }
                  formatted = `✅ **${assignedCount} leads asignados a campaña:**\n\n🎯 **${c.name}**\n- Total leads en campaña: **${c.totalLeads || c._count?.leads || 0}**\n- Status: \`${c.status}\`${leadList}\n\n${c.status === 'draft' ? '📋 La campaña sigue en borrador. Di "activa la campaña" para lanzarla.' : '🚀 Campaña activa — los leads están listos para recibir outreach.'}`
                } else if (gAction === 'activate_campaign') {
                  // Semi-Auto activate response: { campaignName, generated, failed, skipped, total, results, message }
                  const campaignName = growthData.campaignName || growthData.campaign?.name || growthData.name || 'Campaña'
                  const generated = growthData.generated || 0
                  const failed = growthData.failed || 0
                  const total = growthData.total || 0
                  const activateResults = growthData.results || []
                  
                  formatted = `🚀 **Campaña "${campaignName}" activada (Semi-Auto):**\n\n`
                  formatted += `📧 **${generated} emails generados por IA** de ${total} leads\n`
                  if (failed > 0) formatted += `❌ ${failed} fallidos\n`
                  formatted += `\n`
                  
                  // Show generated email subjects
                  const successResults = activateResults.filter((r: Record<string, unknown>) => r.success)
                  if (successResults.length > 0) {
                    formatted += `**Emails generados (pendientes de aprobación):**\n`
                    successResults.slice(0, 15).forEach((r: Record<string, unknown>, idx: number) => {
                      formatted += `${idx + 1}. ✉️ **${r.businessName}** — "${r.subject}"\n`
                    })
                    if (successResults.length > 15) formatted += `...y ${successResults.length - 15} más.\n`
                    formatted += `\n⚡ **${generated} acciones pendientes de aprobación.** Ve a Growth Engine → Actions para revisarlos, o di "aprueba todo" para enviarlos.`
                  } else if (generated === 0 && total === 0) {
                    // Fallback for old PATCH-style response
                    const c = growthData.campaign || growthData
                    formatted = `🚀 **Campaña activada:**\n\n🎯 **${c.name || campaignName}** — ahora está **ACTIVA**\n- Leads: ${c.totalLeads || 0}\n- Status: \`active\`\n\n⚡ Los leads de esta campaña están listos para recibir outreach.`
                  }
                } else if (gAction === 'delete_campaign') {
                  formatted = `🗑️ **Campaña eliminada exitosamente.**\n\nLos leads que estaban asignados siguen disponibles en el pipeline.`
                } else if (gAction === 'apply_seasonal_campaign' || gAction === 'apply_campaign') {
                  formatted = `✅ **Campaña aplicada exitosamente.**\n${growthData.action ? `📧 Email generado para: ${(growthData as Record<string, Record<string, string>>).lead?.businessName || 'lead'}` : ''}`
                } else if (gAction === 'batch_outreach') {
                  const results = growthData.results || []
                  const successCount = results.filter((r: Record<string, unknown>) => r.success).length
                  const failCount = results.filter((r: Record<string, unknown>) => !r.success).length
                  formatted = `📧 **Batch Outreach completado:**\n\n✅ **${successCount} emails generados** | ❌ ${failCount} fallidos\n\n`
                  results.filter((r: Record<string, unknown>) => r.success).slice(0, 15).forEach((r: Record<string, unknown>, idx: number) => {
                    formatted += `${idx + 1}. ✅ **${r.businessName}** — Email listo para aprobación\n`
                  })
                  if (successCount > 0) {
                    formatted += `\n⚡ **${successCount} acciones pendientes de aprobación.** Di "aprueba todo" para enviarlos.`
                  }
                } else if (gAction === 'send_follow_up') {
                  const results = growthData.results || []
                  const successCount = results.filter((r: Record<string, unknown>) => r.success).length
                  const failCount = results.filter((r: Record<string, unknown>) => !r.success).length
                  formatted = `🔄 **Follow-Up Outreach completado:**\n\n✅ **${successCount} follow-ups generados** | ❌ ${failCount} fallidos\n\n`
                  results.filter((r: Record<string, unknown>) => r.success).slice(0, 15).forEach((r: Record<string, unknown>, idx: number) => {
                    formatted += `${idx + 1}. ✅ **${r.businessName}** — Follow-up listo para aprobación\n`
                  })
                  if (successCount > 0) {
                    formatted += `\n⚡ **${successCount} follow-ups pendientes de aprobación.** Di "aprueba todo" para enviarlos.`
                  } else {
                    formatted += `\nℹ️ No se encontraron leads con status "contacted" para follow-up.`
                  }
                } else if (gAction === 'batch_approve') {
                  const approved = growthData.approved || 0
                  const sent = growthData.sent || 0
                  const failed = growthData.failed || 0
                  const remaining = growthData.remaining || 0
                  const queueNote = remaining > 0
                    ? `\n⏳ **${remaining} emails quedan en cola**${growthData.rateLimited ? ` — límite diario alcanzado (${growthData.rateLimit?.usedToday}/${growthData.rateLimit?.limit} en plan ${growthData.rateLimit?.planId})` : ' — ve a Growth → Campañas y pulsa "Aprobar Todo" para continuar el envío'}\n`
                    : ''
                  if (sent === 0 && approved > 0) {
                    formatted = `⚠️ **Batch Approve — Alerta:**\n\n✅ ${approved} acciones aprobadas\n📧 **0 emails enviados**\n\n🔴 **Gmail no envió ningún correo.** Posibles causas:\n• La cuenta de Gmail no está conectada o el token expiró\n• Verifica la conexión en **Brazos → Google Services**\n• Reconecta Gmail y vuelve a intentar\n\n💡 *Las acciones quedaron aprobadas — solo falta resolver el envío.*`
                  } else if (sent === 0 && approved === 0) {
                    formatted = `ℹ️ **Batch Approve:** No había acciones pendientes de aprobación.\n\n💡 *Primero genera emails con "batch outreach" y luego apruébalos.*`
                  } else {
                    formatted = `✅ **Batch Approve completado:**\n\n📧 **${sent} emails enviados** via Gmail\n✅ ${approved} acciones aprobadas\n${failed > 0 ? `❌ ${failed} fallidos\n` : ''}${queueNote}\n🚀 ¡Outreach en marcha!`
                  }
                } else {
                  formatted = `✅ **Growth Engine — ${gAction}:**\n\`\`\`json\n${JSON.stringify(growthData, null, 2).substring(0, 1500)}\n\`\`\``
                }

                // === POST-TOOL CONVERSATIONAL ANALYSIS ===
                // For data-heavy actions, send the tool result back to the LLM
                // so OCTOPUS can analyze it conversationally (like a real assistant)
                const CONVERSATIONAL_ACTIONS = ['list_inbox', 'list_leads', 'get_stats', 'get_insights', 'get_report', 'get_lead', 'research_lead', 'nurture_status', 'campaign_status']
                if (CONVERSATIONAL_ACTIONS.includes(gAction) && !isMultiStep) {
                  // Show a thinking indicator while LLM analyzes
                  setMessages(prev =>
                    prev.map(m =>
                      m.id === assistantMessageId
                        ? { ...m, content: '🧠 Analizando datos...', actionResult: { success: true, type: 'growth_engine', name: `Growth: ${gAction}`, location: '/dashboard/growth' } }
                        : m
                    )
                  )
                  try {
                    const analysisRes = await fetch('/api/jarvis/chat', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        message: `[RESULTADO DE HERRAMIENTA — ${gAction}]\n\n${formatted}\n\n[INSTRUCCIÓN DEL SISTEMA: El usuario pidió: "${userMessage}". Arriba tienes los datos obtenidos del Growth Engine. Ahora ANALIZA estos datos de forma conversacional, como un asesor de ventas inteligente. NO repitas los datos en formato lista/JSON. En su lugar:\n- Resume lo más importante en lenguaje natural\n- Identifica oportunidades, problemas o patrones\n- Sugiere acciones concretas que el usuario debería tomar\n- Si hay respuestas de leads, analiza el sentimiento y propón cómo responder\n- Sé conciso (3-4 párrafos máximo), útil y proactivo\n- Habla como un asesor de confianza, no como una base de datos]`,
                        history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
                      }),
                    })
                    if (analysisRes.ok) {
                      const reader = analysisRes.body?.getReader()
                      if (reader) {
                        const decoder = new TextDecoder()
                        let analysisContent = ''
                        let buf = ''
                        while (true) {
                          const { done, value } = await reader.read()
                          if (done) break
                          buf += decoder.decode(value, { stream: true })
                          const lines = buf.split('\n')
                          buf = lines.pop() || ''
                          for (const line of lines) {
                            if (line.startsWith('data: ')) {
                              const d = line.slice(6)
                              if (d === '[DONE]') continue
                              try {
                                const p = JSON.parse(d)
                                if (p.content) {
                                  analysisContent += p.content
                                  const displayAnalysis = analysisContent.replace(/```jarvis-action[\s\S]*?```/g, '').replace(/```jarvis-action[\s\S]*$/g, '').trim()
                                  setMessages(prev =>
                                    prev.map(m =>
                                      m.id === assistantMessageId
                                        ? { ...m, content: displayAnalysis, actionResult: { success: true, type: 'growth_engine', name: `Growth: ${gAction}`, location: '/dashboard/growth' } }
                                        : m
                                    )
                                  )
                                }
                              } catch { /* skip */ }
                            }
                          }
                        }
                        reader.releaseLock()
                      }
                    } else {
                      // If analysis fails, fallback to formatted data
                      setMessages(prev =>
                        prev.map(m =>
                          m.id === assistantMessageId
                            ? { ...m, content: formatted, actionResult: { success: true, type: 'growth_engine', name: `Growth: ${gAction}`, location: '/dashboard/growth' } }
                            : m
                        )
                      )
                    }
                  } catch {
                    // Fallback to formatted data on error
                    setMessages(prev =>
                      prev.map(m =>
                        m.id === assistantMessageId
                          ? { ...m, content: formatted, actionResult: { success: true, type: 'growth_engine', name: `Growth: ${gAction}`, location: '/dashboard/growth' } }
                          : m
                      )
                    )
                  }
                } else if (!isMultiStep) {
                  setMessages(prev =>
                    prev.map(m =>
                      m.id === assistantMessageId
                        ? { ...m, content: formatted, actionResult: { success: true, type: 'growth_engine', name: `Growth: ${gAction}`, location: '/dashboard/growth' } }
                        : m
                    )
                  )
                } else {
                  const gMsg: ChatMessage = {
                    id: `msg-growth-${Date.now()}-${i}`,
                    role: 'assistant',
                    content: formatted,
                    timestamp: new Date(),
                  }
                  setMessages(prev => [...prev, gMsg])
                }
                addActivity(`✅ OCTOPUS completó Growth Engine: ${gAction}`)
                stepResults.push({ step: stepNum, success: true, label: `Growth: ${gAction}` })
              } else {
                const errData = await growthRes.json().catch(() => ({ error: 'Error desconocido' }))
                const errMsg = (errData as Record<string, string>).error || `Error ${growthRes.status}`
                // Better error messages for specific actions
                if (gAction === 'activate_campaign' && (errMsg.includes('no encontrada') || growthRes.status === 404)) {
                  throw new Error(`Campaña no encontrada. Puede que el ID sea incorrecto. Usa "list_campaigns" para ver las campañas disponibles.`)
                } else if (gAction === 'activate_campaign' && errMsg.includes('campaignId requerido')) {
                  throw new Error(`No se pudo activar: falta el ID de la campaña. Dime el nombre de la campaña y la busco primero.`)
                }
                throw new Error(errMsg)
              }
            }
            // === GENERACIÓN DE CONTENIDO CREATIVO ===
            else if (['generate_image', 'generate_video'].includes(action.type) && action.data?.parameters?.mediaType) {
              const params = action.data.parameters as Record<string, unknown>
              const mediaType = params.mediaType as string
              const prompt = action.data.imagePrompt || action.data.videoPrompt || ''
              const orientation = params.orientation as string || 'square'
              
              let format = params.format as string || 'post'
              const platform = params.platform as string || 'general'
              if (orientation === 'vertical' && format === 'post') { format = 'story' }

              // Show generating state
              if (!isMultiStep) {
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantMessageId
                      ? { ...m, content: action.message || `🎨 Generando ${mediaType === 'video' ? 'video' : 'imagen'}...`, isGeneratingImage: mediaType === 'image', isGeneratingVideo: mediaType === 'video' }
                      : m
                  )
                )
              }
              addActivity(`🎨 OCTOPUS generando ${mediaType}: ${(prompt as string).substring(0, 50)}...`)

              // Determinar projectId: explícito en params, o del proyecto creado en pasos anteriores
              const mediaProjectId = (params.projectId as string) || lastCreatedProjectId || undefined

              // 🎨 Resolver modelo de imagen: LLM hint → mensaje del usuario → dropdown state → default
              let resolvedImageModel: string | null | undefined = (params.imageModel as string) || null
              if (!resolvedImageModel && mediaType === 'image') {
                const detected = detectImageModelFromMessage(userMessage || '')
                if (detected.modelId) {
                  resolvedImageModel = detected.modelId
                  addActivity(`🎯 ${t('jarvis.modelDetected')}: ${detected.label}`)
                }
              }
              if (!resolvedImageModel && imageModel && imageModel !== 'auto') {
                resolvedImageModel = imageModel
              }

              const creativeResponse = await fetch('/api/creative/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: mediaType === 'video' ? 'video' : 'image',
                  prompt,
                  platform,
                  format,
                  style: params.style || 'cinematic',
                  title: params.title || (prompt as string).substring(0, 60),
                  videoMode: mediaType === 'video' ? (params.videoMode || 'slideshow') : undefined,
                  videoModel: params.videoModel,
                  projectId: mediaProjectId,
                  imageModel: resolvedImageModel,
                  orientation,
                }),
              })

              if (creativeResponse.ok) {
                const result = await creativeResponse.json()
                if (result.success && result.asset) {
                  // For multi-step, add a NEW message for each generated media
                  if (isMultiStep) {
                    const mediaMsg: ChatMessage = {
                      id: `msg-media-${Date.now()}-${i}`,
                      role: 'assistant',
                      content: `✅ **Paso ${stepNum}:** ${mediaType === 'video' ? 'Video' : 'Imagen'} generada — "${result.asset.title || (prompt as string).substring(0, 40)}"`,
                      timestamp: new Date(),
                      generatedImage: mediaType === 'image' ? result.asset.content : undefined,
                      generatedImageModel: mediaType === 'image' ? (result.asset.modelUsed as string | undefined) : undefined,
                      generatedVideo: mediaType === 'video' ? result.asset.content : undefined,
                      videoThumbnail: mediaType === 'video' ? (result.asset.thumbnail as string | undefined) : undefined,
                      videoModelUsed: mediaType === 'video' ? ((result.asset.modelUsed as string | undefined) || (result.asset.videoMode === 'ai' ? 'AI Video' : 'Slideshow')) : undefined,
                      isGeneratingImage: false,
                      isGeneratingVideo: false,
                    }
                    setMessages(prev => [...prev, mediaMsg])
                  } else {
                    setMessages(prev =>
                      prev.map(m =>
                        m.id === assistantMessageId
                          ? { ...m, content: action.message || `✅ ¡${mediaType === 'video' ? 'Video' : 'Imagen'} generada exitosamente!`, generatedImage: mediaType === 'image' ? result.asset.content : undefined, generatedImageModel: mediaType === 'image' ? (result.asset.modelUsed as string | undefined) : undefined, generatedVideo: mediaType === 'video' ? result.asset.content : undefined, videoThumbnail: mediaType === 'video' ? (result.asset.thumbnail as string | undefined) : undefined, videoModelUsed: mediaType === 'video' ? ((result.asset.modelUsed as string | undefined) || (result.asset.videoMode === 'ai' ? 'AI Video' : 'Slideshow')) : undefined, videoFrames: undefined, isGeneratingImage: false, isGeneratingVideo: false, actionResult: { success: true, type: mediaType, name: result.asset.title || 'Contenido creativo', location: '/dashboard/chat' } }
                          : m
                      )
                    )
                  }
                  addActivity(`✅ OCTOPUS creó ${mediaType}: ${result.asset.title || (prompt as string).substring(0, 40)}`)
                  if (mediaType === 'image' && result.asset.content) lastGeneratedImageUrlRef.current = result.asset.content
                  stepResults.push({ step: stepNum, success: true, label: `${mediaType === 'video' ? 'Video' : 'Imagen'} generada`, image: mediaType === 'image' ? result.asset.content : undefined })
                } else {
                  throw new Error(result.error || 'Error en generación')
                }
              } else {
                const errData = await creativeResponse.json().catch(() => ({}))
                throw new Error((errData as Record<string, string>).error || `Error ${creativeResponse.status}`)
              }
            }
            // === CREATE_MEDIA (unified image/video via Creative API) ===
            else if (action.type === 'create_media' && action.data?.media) {
              const media = action.data.media as Record<string, string>
              const mediaType = media.mediaType || 'image'
              const prompt = media.description || ''
              const format = media.format || 'post'
              const platform = media.platform || 'general'
              const style = media.style || 'cinematic'
              const title = media.title || prompt.substring(0, 60)

              if (!isMultiStep) {
                setMessages(prev => prev.map(m => m.id === assistantMessageId
                  ? { ...m, content: action.message || `🎨 Generando ${mediaType}...`, isGeneratingImage: mediaType === 'image', isGeneratingVideo: mediaType === 'video' }
                  : m))
              }
              addActivity(`🎨 OCTOPUS generando ${mediaType}: ${prompt.substring(0, 50)}...`)

              const mediaProjectId = (media.projectId as string) || lastCreatedProjectId || undefined

              // 🎨 Resolver modelo de imagen: LLM hint → mensaje del usuario → dropdown state → default
              const orientation2 = (media.orientation as string) || 'square'
              let resolvedImageModel2: string | null | undefined = (media.imageModel as string) || (media.modelId as string) || null
              if (!resolvedImageModel2 && mediaType === 'image') {
                const detected = detectImageModelFromMessage(userMessage || '')
                if (detected.modelId) {
                  resolvedImageModel2 = detected.modelId
                  addActivity(`🎯 ${t('jarvis.modelDetected')}: ${detected.label}`)
                }
              }
              if (!resolvedImageModel2 && imageModel && imageModel !== 'auto') {
                resolvedImageModel2 = imageModel
              }

              const creativeResponse = await fetch('/api/creative/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: mediaType === 'video' ? 'video' : 'image',
                  prompt, platform, format, style, title,
                  videoMode: mediaType === 'video' ? (media.videoMode || 'slideshow') : undefined,
                  projectId: mediaProjectId,
                  imageModel: resolvedImageModel2,
                  orientation: orientation2,
                }),
              })

              if (creativeResponse.ok) {
                const result = await creativeResponse.json()
                if (result.success && result.asset) {
                  if (isMultiStep) {
                    setMessages(prev => [...prev, { id: `msg-media-${Date.now()}-${i}`, role: 'assistant', content: `✅ **Paso ${stepNum}:** ${mediaType === 'video' ? 'Video' : 'Imagen'} — "${result.asset.title || title}"`, timestamp: new Date(), generatedImage: mediaType === 'image' ? result.asset.content : undefined, generatedImageModel: mediaType === 'image' ? (result.asset.modelUsed as string | undefined) : undefined, generatedVideo: mediaType === 'video' ? result.asset.content : undefined, videoThumbnail: mediaType === 'video' ? (result.asset.thumbnail as string | undefined) : undefined, videoModelUsed: mediaType === 'video' ? ((result.asset.modelUsed as string | undefined) || (result.asset.videoMode === 'ai' ? 'AI Video' : 'Slideshow')) : undefined, isGeneratingImage: false, isGeneratingVideo: false }])
                  } else {
                    setMessages(prev => prev.map(m => m.id === assistantMessageId
                      ? { ...m, content: action.message || `✅ ¡${mediaType === 'video' ? 'Video' : 'Imagen'} generada!`, generatedImage: mediaType === 'image' ? result.asset.content : undefined, generatedImageModel: mediaType === 'image' ? (result.asset.modelUsed as string | undefined) : undefined, generatedVideo: mediaType === 'video' ? result.asset.content : undefined, videoThumbnail: mediaType === 'video' ? (result.asset.thumbnail as string | undefined) : undefined, videoModelUsed: mediaType === 'video' ? ((result.asset.modelUsed as string | undefined) || (result.asset.videoMode === 'ai' ? 'AI Video' : 'Slideshow')) : undefined, isGeneratingImage: false, isGeneratingVideo: false, actionResult: { success: true, type: mediaType, name: result.asset.title || title, location: '/dashboard/chat' } }
                      : m))
                  }
                  if (mediaType === 'image' && result.asset.content) lastGeneratedImageUrlRef.current = result.asset.content
                  stepResults.push({ step: stepNum, success: true, label: `${mediaType} generada`, image: mediaType === 'image' ? result.asset.content : undefined })
                } else {
                  throw new Error(result.error || 'Error en generación')
                }
              } else {
                const errData = await creativeResponse.json().catch(() => ({}))
                throw new Error((errData as Record<string, string>).error || `Error ${creativeResponse.status}`)
              }
            }
            // === BRAZOS (health check / troubleshoot) ===
            else if (action.type === 'brazos') {
              const bAction = action.data?.brazosAction || 'health_check'
              if (!isMultiStep) {
                setMessages(prev => prev.map(m => m.id === assistantMessageId
                  ? { ...m, content: action.message || '🔍 Ejecutando diagnóstico de brazos...' }
                  : m))
              }
              addActivity('🔧 Diagnóstico de brazos', 'info')

              const healthRes = await fetch('/api/brazos/health')
              const healthData = await healthRes.json()

              let responseText = `## 🔧 Diagnóstico de Brazos\n\n`
              if (!healthData.brazos || healthData.brazos.length === 0) {
                responseText += '⚪ No tienes ningún brazo conectado.\n\n👉 Ve a [Brazos Activos](/dashboard/brazos) para conectar tus servicios.'
              } else {
                const overallIcon = healthData.overall === 'healthy' ? '✅' : healthData.overall === 'warning' ? '⚠️' : '🔴'
                responseText += `**Estado general:** ${overallIcon} ${healthData.overall === 'healthy' ? 'Todo funciona' : healthData.overall === 'warning' ? 'Algunos necesitan atención' : 'Problemas críticos'}\n\n`
                for (const brazo of healthData.brazos) {
                  const icon = brazo.status === 'healthy' ? '✅' : brazo.status === 'degraded' ? '⚠️' : '❌'
                  responseText += `### ${icon} ${brazo.name}\n`
                  if (brazo.issues?.length > 0) brazo.issues.forEach((issue: string) => { responseText += `- ❌ ${issue}\n` })
                  if (brazo.suggestions?.length > 0) brazo.suggestions.forEach((sug: string, si: number) => { responseText += `${si + 1}. ${sug}\n` })
                  responseText += '\n'
                }
              }

              if (!isMultiStep) {
                setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: responseText } : m))
              } else {
                setMessages(prev => [...prev, { id: `msg-brazos-${Date.now()}`, role: 'assistant', content: responseText, timestamp: new Date() }])
              }
              stepResults.push({ step: stepNum, success: true, label: `Brazos: ${bAction}` })
            }
            // === IoT (device control) ===
            else if (action.type === 'iot') {
              const iotAction = action.data?.iotAction || 'status'
              const deviceName = action.data?.deviceName || action.data?.target || ''
              const iotParams = action.data?.iotParams || {}

              if (!isMultiStep) {
                setMessages(prev => prev.map(m => m.id === assistantMessageId
                  ? { ...m, content: action.message || `🏠 Ejecutando IoT: ${iotAction}...` }
                  : m))
              }
              addActivity(`🏠 IoT: ${iotAction} ${deviceName}`, 'info')

              const iotRes = await fetch('/api/iot/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: iotAction, deviceName, roomName: action.data?.roomName, ...iotParams }),
              })
              const iotData = await iotRes.json()

              let iotResponseText: string
              if (iotRes.ok) {
                iotResponseText = iotData.message || `✅ IoT: ${iotAction} ejecutado${deviceName ? ` en ${deviceName}` : ''}`
              } else {
                iotResponseText = `⚠️ ${iotData.error || 'Error al controlar dispositivo IoT'}`
              }

              if (!isMultiStep) {
                setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: iotResponseText } : m))
              } else {
                setMessages(prev => [...prev, { id: `msg-iot-${Date.now()}`, role: 'assistant', content: iotResponseText, timestamp: new Date() }])
              }
              stepResults.push({ step: stepNum, success: iotRes.ok, label: `IoT: ${iotAction}` })
            }
            // === SOCIAL BRIDGE (publish/schedule LinkedIn) ===
            else if (action.type === 'social_bridge') {
              const socialAction = action.data?.socialAction || 'publish_linkedin'
              const content = action.data?.content || ''
              const mediaUrl = action.data?.mediaUrl || null

              if (!content && socialAction !== 'status') {
                throw new Error('No se proporcionó contenido para publicar.')
              }

              if (!isMultiStep) {
                setMessages(prev => prev.map(m => m.id === assistantMessageId
                  ? { ...m, content: action.message || '📡 Publicando en LinkedIn...' }
                  : m))
              }
              addActivity(`📡 Social Bridge: ${socialAction}`, 'info')

              if (socialAction === 'status') {
                const statusRes = await fetch('/api/social-bridge/status')
                const statusData = await statusRes.json()
                const statusText = statusData.connected ? '✅ LinkedIn conectado' : '❌ LinkedIn no conectado. Conéctalo en [Social Bridge](/dashboard/social-bridge).'
                if (!isMultiStep) {
                  setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: statusText } : m))
                }
                stepResults.push({ step: stepNum, success: true, label: 'Social Bridge: status' })
              } else if (socialAction === 'schedule_linkedin') {
                const schedRes = await fetch('/api/social-bridge/scheduler', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ content, scheduledFor: action.data?.scheduledFor, platform: 'linkedin' }),
                })
                const schedData = await schedRes.json()
                const schedText = schedRes.ok ? `✅ Post programado para ${action.data?.scheduledFor || 'fecha programada'}` : `❌ ${schedData.error || 'Error al programar'}`
                if (!isMultiStep) {
                  setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: schedText } : m))
                }
                stepResults.push({ step: stepNum, success: schedRes.ok, label: 'LinkedIn: programado' })
              } else {
                // publish_linkedin
                // Search for recent media in conversation if no mediaUrl provided
                let finalMediaUrl = mediaUrl
                if (!finalMediaUrl) {
                  const reversed = [...messages].reverse()
                  const aiImg = reversed.find(m => m.generatedImage)?.generatedImage
                  const userImg = reversed.find(m => m.image)?.image
                  finalMediaUrl = aiImg || userImg || null
                }

                const pubRes = await fetch('/api/social-bridge/publish', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ platform: 'linkedin', content, contentType: finalMediaUrl ? 'image' : 'text', mediaUrl: finalMediaUrl || undefined }),
                })
                const pubData = await pubRes.json()
                if (pubRes.ok && pubData.post?.status === 'published') {
                  const successText = `## ✅ ¡Publicado en LinkedIn!\n\n> ${content.split('\n').join('\n> ')}\n\n${pubData.post.platformUrl ? `🔗 [Ver post](${pubData.post.platformUrl})` : '📡 Enviado correctamente.'}`
                  if (!isMultiStep) {
                    setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: successText } : m))
                  } else {
                    setMessages(prev => [...prev, { id: `msg-social-${Date.now()}`, role: 'assistant', content: successText, timestamp: new Date() }])
                  }
                  stepResults.push({ step: stepNum, success: true, label: 'LinkedIn: publicado' })
                } else {
                  throw new Error(pubData.error || 'No se pudo publicar en LinkedIn')
                }
              }
            }
            // === SALES AGENT (CRUD) ===
            else if (action.type === 'sales_agent') {
              const salesAction = action.data?.salesAction || 'list'
              const salesParams = action.data?.salesParams || {}

              if (!isMultiStep) {
                setMessages(prev => prev.map(m => m.id === assistantMessageId
                  ? { ...m, content: action.message || `🤖 Sales Agent: ${salesAction}...` }
                  : m))
              }
              addActivity(`🤖 Sales Agent: ${salesAction}`, 'info')

              let salesResponseText = ''
              if (salesAction === 'list') {
                const res = await fetch('/api/sales-agent')
                const data = await res.json()
                const agents = data.agents || data || []
                if (Array.isArray(agents) && agents.length > 0) {
                  salesResponseText = `## 🤖 Tus Sales Agents (${agents.length})\n\n`
                  agents.forEach((a: Record<string, unknown>, idx: number) => {
                    salesResponseText += `${idx + 1}. **${a.name}** — ${a.isActive ? '🟢 Activo' : '⚫ Inactivo'}\n   Leads capturados: ${(a as Record<string, Record<string, number>>)._count?.salesChats || 0}\n\n`
                  })
                } else {
                  salesResponseText = '🤖 No tienes Sales Agents aún. Di "crea un agente de ventas" para empezar.'
                }
              } else if (salesAction === 'create') {
                const res = await fetch('/api/sales-agent', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(salesParams),
                })
                const data = await res.json()
                if (res.ok) {
                  salesResponseText = `✅ **Sales Agent creado:** ${data.name || 'Nuevo agente'}\n\n🔗 Configúralo en [Sales Agents](/dashboard/sales-agent)`
                } else {
                  throw new Error(data.error || 'Error creando agente')
                }
              } else {
                salesResponseText = `✅ Sales Agent: ${salesAction} ejecutado`
              }

              if (!isMultiStep) {
                setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: salesResponseText } : m))
              } else {
                setMessages(prev => [...prev, { id: `msg-sales-${Date.now()}`, role: 'assistant', content: salesResponseText, timestamp: new Date() }])
              }
              stepResults.push({ step: stepNum, success: true, label: `Sales Agent: ${salesAction}` })
            }
            // === VOICE AGENT (DB CRUD via API) ===
            else if (action.type === 'voice_agent') {
              const voiceAction = action.data?.voiceAction || 'list'
              const agentData = action.data?.agentData || {}

              if (!isMultiStep) {
                setMessages(prev => prev.map(m => m.id === assistantMessageId
                  ? { ...m, content: action.message || `🎙️ Voice Agent: ${voiceAction}...` }
                  : m))
              }
              addActivity(`🎙️ Voice Agent: ${voiceAction}`, 'info')

              let voiceResponseText = ''
              if (voiceAction === 'list') {
                try {
                  const res = await fetch('/api/voice-agent')
                  const agents = res.ok ? await res.json() : []
                  if (Array.isArray(agents) && agents.length > 0) {
                    voiceResponseText = `## 🎙️ Tus Voice Agents (${agents.length})\n\n`
                    agents.forEach((a: Record<string, string | boolean>, idx: number) => {
                      const tierLabel = a.ttsTier === 'free' ? '🔊 Free' : a.ttsTier === 'pro' ? '⚡ Pro' : '✨ Premium'
                      voiceResponseText += `${idx + 1}. **${a.agentName}** — ${a.isActive ? '🟢 Activo' : '⚫ Inactivo'} | ${tierLabel} | ${(a.language || 'es').toString().toUpperCase()}\n   Modelo: ${a.model || 'gpt-4.1'}\n\n`
                    })
                    voiceResponseText += `\n🔗 [Configurar Voice Agents](/dashboard/voice-agent)`
                  } else {
                    voiceResponseText = '🎙️ No tienes Voice Agents aún. Di "crea un voice agent" para empezar, o ve a [Voice Agent](/dashboard/voice-agent).'
                  }
                } catch {
                  voiceResponseText = '⚠️ Error leyendo Voice Agents. Ve a [Voice Agent](/dashboard/voice-agent) para gestionarlos.'
                }
              } else if (voiceAction === 'create') {
                try {
                  const name = agentData.name || 'Nuevo Voice Agent'
                  const res = await fetch('/api/voice-agent', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      agentName: name,
                      systemPrompt: agentData.prompt || 'Eres un asistente virtual útil y amigable.',
                      model: agentData.model || 'gpt-4.1',
                      greeting: agentData.greeting || '¡Hola! ¿En qué puedo ayudarte hoy?',
                      language: agentData.language || 'es',
                    }),
                  })
                  if (!res.ok) throw new Error('API error')
                  const newAgent = await res.json()
                  voiceResponseText = `✅ **Voice Agent creado:** ${name}\n\n🎙️ Tier: Free (Web Speech API)\n🤖 Modelo: ${newAgent.model}\n🌐 Idioma: ${String(newAgent.language).toUpperCase()}\n\n🔗 [Configurar voz y embed](/dashboard/voice-agent) para elegir tier Pro/Premium y obtener el código de widget.`
                } catch {
                  voiceResponseText = '⚠️ Error creando Voice Agent. Ve a [Voice Agent](/dashboard/voice-agent) para crearlo manualmente.'
                }
              } else {
                voiceResponseText = `✅ Voice Agent: ${voiceAction} — Ve a [Voice Agent](/dashboard/voice-agent) para gestionar.`
              }

              if (!isMultiStep) {
                setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: voiceResponseText } : m))
              } else {
                setMessages(prev => [...prev, { id: `msg-voice-${Date.now()}`, role: 'assistant', content: voiceResponseText, timestamp: new Date() }])
              }
              stepResults.push({ step: stepNum, success: true, label: `Voice Agent: ${voiceAction}` })
            }
            // === UGC GENERATE (video pipeline) ===
            else if (action.type === 'ugc_generate') {
              const topic = action.data?.ugcTopic || ''
              const style = action.data?.ugcStyle || 'profesional'
              const language = action.data?.ugcLanguage || 'es'
              const duration = action.data?.ugcDuration || 10

              setMessages(prev => prev.map(m => m.id === assistantMessageId
                ? { ...m, content: `🎬 **Generando UGC Video (${style})...**\n\n⏳ Paso 1/4: Creando guión con AI...`, isGeneratingVideo: true }
                : m))
              addActivity(`🎬 UGC: Generando video ${style}`, 'info')

              // Step 1: Script
              let creativeScript = ''
              try {
                const scriptRes = await fetch('/api/ugc-factory/generate-script', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ topic, style, language, duration }),
                })
                if (scriptRes.ok) {
                  const scriptData = await scriptRes.json()
                  creativeScript = (scriptData.script || '').replace(/^#+\s*/gm, '').replace(/^\*+/gm, '').replace(/\*+$/gm, '').trim()
                }
              } catch { /* fallback below */ }

              if (!creativeScript) {
                creativeScript = language === 'en'
                  ? 'Stop scrolling. Your business needs this. Ahk-tuh-pus runs your campaigns, manages your leads, creates your content. All in one AI cockpit.'
                  : 'Para de scrollear. Tu negocio necesita esto. Ahk-tuh-pus maneja tus campañas, tus leads, tu contenido. Todo en un solo cockpit AI.'
              }

              // Step 2: Avatar
              setMessages(prev => prev.map(m => m.id === assistantMessageId
                ? { ...m, content: `🎬 **Generando UGC Video (${style})...**\n\n✅ Guión listo\n⏳ Paso 2/4: Creando avatar AI...` }
                : m))

              const avatarRes = await fetch('/api/creative/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'image',
                  prompt: `Photorealistic AI content creator, UGC style, ${style === 'cinematic' ? 'dramatic lighting' : 'friendly'}, looking at camera, ring light, upper body. DO NOT copy any real person.`,
                  platform: 'general', format: 'post', style: 'photorealistic', title: `UGC Avatar - ${style}`,
                }),
              })

              if (!avatarRes.ok) throw new Error('No se pudo generar el avatar AI')
              const avatarData = await avatarRes.json()
              const avatarImageUrl = avatarData.asset?.content || avatarData.imageUrl
              if (!avatarImageUrl) throw new Error('No se obtuvo imagen del avatar')

              // Step 3: Seedance
              setMessages(prev => prev.map(m => m.id === assistantMessageId
                ? { ...m, content: `🎬 **Generando UGC Video (${style})...**\n\n✅ Guión listo\n✅ Avatar AI creado\n⏳ Paso 3/4: Seedance (fal.ai)...`, generatedImage: avatarImageUrl }
                : m))

              const seedanceRes = await fetch('/api/ugc-factory/seedance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl: avatarImageUrl, prompt: creativeScript, duration, resolution: '720p', language }),
              })
              const seedanceData = await seedanceRes.json()
              if (!seedanceRes.ok || !seedanceData.requestId) throw new Error(seedanceData.error || 'Error con Seedance')

              // Step 4: Poll
              setMessages(prev => prev.map(m => m.id === assistantMessageId
                ? { ...m, content: `🎬 **Generando UGC Video (${style})...**\n\n✅ Guión listo\n✅ Avatar creado\n✅ Seedance enviado\n⏳ Paso 4/4: Renderizando video...` }
                : m))

              const maxPolls = 60
              let videoUrl: string | null = null
              for (let p = 0; p < maxPolls; p++) {
                await new Promise(r => setTimeout(r, 5000))
                try {
                  // ✅ Correct endpoint: POST /seedance-status (NOT GET /seedance)
                  const pollRes = await fetch('/api/ugc-factory/seedance-status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      requestId: seedanceData.requestId,
                      statusUrl: seedanceData.statusUrl,
                      responseUrl: seedanceData.responseUrl,
                    }),
                  })
                  if (!pollRes.ok) {
                    console.warn('[UGC Poll] HTTP', pollRes.status, 'retrying...')
                    continue
                  }
                  const pollData = await pollRes.json()
                  if (pollData.status === 'completed' && pollData.videoUrl) {
                    videoUrl = pollData.videoUrl
                    break
                  } else if (pollData.status === 'failed') {
                    throw new Error(pollData.error || 'Video rendering failed')
                  }
                  // Update visible progress every ~5 polls (~25s)
                  if (p > 0 && p % 5 === 0) {
                    setMessages(prev => prev.map(m => m.id === assistantMessageId
                      ? { ...m, content: `🎬 **Generando UGC Video (${style})...**\n\n✅ Guión listo\n✅ Avatar creado\n✅ Seedance enviado\n⏳ Renderizando... (${Math.round((p * 5) / 60 * 100) / 100} min transcurridos)` }
                      : m))
                  }
                } catch (pollErr) {
                  if (p === maxPolls - 1) throw pollErr
                }
              }

              if (videoUrl) {
                setMessages(prev => prev.map(m => m.id === assistantMessageId
                  ? { ...m, content: `## 🎬 UGC Video Generado ✅\n\n**Estilo:** ${style} | **Idioma:** ${language}\n\n📝 **Guión:** "${creativeScript.substring(0, 100)}..."\n\n🔗 [Ver/Descargar Video](${videoUrl})`, generatedVideo: videoUrl ?? undefined, videoModelUsed: 'Seedance 1.5 Pro (UGC)', isGeneratingVideo: false }
                  : m))
                stepResults.push({ step: stepNum, success: true, label: 'UGC Video generado' })
              } else {
                throw new Error('Video rendering timeout (más de 5 min, abortado)')
              }
            }
            // === 📡 CONTENT PUBLISH ===
            else if (action.type === 'content_publish') {
              const pubTitle = action.data?.title || ''
              const pubContent = action.data?.content || ''
              const pubSlug = action.data?.slug || ''
              const pubContentType = action.data?.contentType || 'blog_post'
              const pubAgentId = action.data?.agentId || 'octopus'
              const pubMetadata = action.data?.metadata || {}

              if (!isMultiStep) {
                setMessages(prev => prev.map(m => m.id === assistantMessageId
                  ? { ...m, content: action.message || `📡 Publicando "${pubTitle}"...` }
                  : m))
              }
              addActivity(`📡 Publicando: ${pubTitle}`, 'info')

              if (!pubTitle || !pubContent) {
                stepResults.push({ step: stepNum, success: false, label: 'Content Publisher: Faltan datos (title y content)' })
              } else {
                try {
                  const pubRes = await fetch('/api/skills/content-publish', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      title: pubTitle,
                      content: pubContent,
                      slug: pubSlug,
                      contentType: pubContentType,
                      agentId: pubAgentId,
                      metadata: pubMetadata
                    })
                  })
                  const pubData = await pubRes.json()
                  if (pubData.success) {
                    const urlLine = pubData.publishedUrl ? ` 🔗 ${pubData.publishedUrl}` : ''
                    stepResults.push({ step: stepNum, success: true, label: `"${pubTitle}" publicado en ${pubData.duration}ms${urlLine}` })
                    addActivity(`✅ Publicado: ${pubTitle}`, 'success')
                  } else {
                    stepResults.push({ step: stepNum, success: false, label: `Error publicando "${pubTitle}": ${pubData.error}` })
                    addActivity(`❌ Error publicando: ${pubTitle}`, 'error')
                  }
                } catch (pubErr: unknown) {
                  stepResults.push({ step: stepNum, success: false, label: `Error de conexión: ${pubErr instanceof Error ? pubErr.message : 'desconocido'}` })
                }
              }
            }
            // === WEB SEARCH ===
            else if (action.type === 'web_search') {
              // Extract query from action data, or fallback to user message
              let query = action.data?.query || ''
              if (!query && userMessage) {
                query = userMessage
                  .replace(/^(?:che\s+)?(?:busca(?:me|r)?|búscame|investiga(?:r)?|averigua(?:r)?|googlea(?:r)?)\s*/i, '')
                  .trim() || userMessage
              }
              if (!isMultiStep) {
                setMessages(prev => prev.map(m => m.id === assistantMessageId
                  ? { ...m, content: `🔍 Buscando: "${query}"...` }
                  : m))
              }
              addActivity(`🔍 Web search: ${query.substring(0, 50)}`, 'info')

              // Use dedicated web-search endpoint (Gemini + DuckDuckGo fallback)
              const searchRes = await fetch('/api/jarvis/web-search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query }),
              })

              if (searchRes.ok) {
                const searchData = await searchRes.json()
                const results = searchData.data?.results || []
                const geminiAnswer = searchData.data?.geminiAnswer || ''
                let searchContent = ''
                if (geminiAnswer) searchContent += geminiAnswer + '\n\n'
                if (results.length > 0) {
                  searchContent += '**📎 Fuentes:**\n' + results.map((r: { title: string; snippet: string; url: string }) => `• [${r.title}](${r.url})${r.snippet ? ' — ' + r.snippet : ''}`).join('\n')
                }
                if (!searchContent) searchContent = `No se encontraron resultados para "${query}".`
                if (!isMultiStep) {
                  setMessages(prev => prev.map(m => m.id === assistantMessageId 
                    ? { ...m, content: searchContent, actionResult: { success: true, type: 'web_search', name: `Búsqueda: "${query.substring(0, 40)}"`, location: '' } } 
                    : m))
                } else {
                  setMessages(prev => [...prev, { id: `msg-search-${Date.now()}`, role: 'assistant', content: searchContent, timestamp: new Date() }])
                }
                stepResults.push({ step: stepNum, success: true, label: `Web search: ${query.substring(0, 30)}` })
              } else {
                throw new Error('Error en búsqueda web')
              }
            }
            // === THEME TOGGLE ===
            // === BROWSER AUTOMATION ===
            else if (action.type === 'browser_automation') {
              const browserAction = action.data?.browserAction || 'ai_task'
              
              if (!isMultiStep) {
                setMessages(prev => prev.map(m => m.id === assistantMessageId
                  ? { ...m, content: action.message || '🌐 Browser Automation...' }
                  : m))
              }
              addActivity(`🌐 Browser: ${browserAction}`, 'info')

              try {
                // --- STATUS ---
                if (browserAction === 'status') {
                  const statusRes = await fetch('/api/brazos')
                  const statusData = await statusRes.json()
                  const browserArm = statusData.connections?.find((c: any) => c.armType === 'browser_automation')
                  const ollamaArm = statusData.connections?.find((c: any) => c.armType === 'ollama')
                  let isOnline = false
                  if (browserArm && Date.now() - new Date(browserArm.updatedAt).getTime() < 30000 && browserArm.status === 'connected') isOnline = true
                  else if (ollamaArm && Date.now() - new Date(ollamaArm.updatedAt).getTime() < 30000 && ollamaArm.status === 'connected') isOnline = true
                  const statusText = isOnline ? '✅ Bridge Online — Browser Automation listo para operar.' : '❌ Bridge Offline — Necesitas ejecutar el Bridge en tu PC. Ve a **Browser Automation** en el menú para activarlo.'
                  if (!isMultiStep) {
                    setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: statusText } : m))
                  }
                  stepResults.push({ step: stepNum, success: isOnline, label: `Bridge: ${isOnline ? 'online' : 'offline'}` })
                }
                // --- LIST TEMPLATES ---
                else if (browserAction === 'list_templates') {
                  const tplRes = await fetch('/api/browser-bridge/templates')
                  const tplData = await tplRes.json()
                  const templates = tplData.templates || []
                  if (templates.length === 0) {
                    const noTplText = '📋 No hay plantillas creadas aún. Puedo crear una — ¿qué tarea web quieres automatizar?'
                    if (!isMultiStep) {
                      setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: noTplText } : m))
                    }
                  } else {
                    const tplList = templates.map((t: any, i: number) => {
                      const vars = t.variables && Array.isArray(t.variables) ? t.variables.map((v: any) => `\`{{${v.key}}}\``).join(', ') : ''
                      return `${i + 1}. **${t.name}** ${t.category ? `[${t.category}]` : ''} — ${t.steps?.length || 0} pasos${vars ? ` — Variables: ${vars}` : ''}${t.useCount > 0 ? ` (×${t.useCount})` : ''}\n   ID: \`${t.id}\``
                    }).join('\n')
                    const tplText = `📋 **Plantillas disponibles (${templates.length}):**\n\n${tplList}\n\n💡 Dime cuál quieres ejecutar o si quieres crear una nueva.`
                    if (!isMultiStep) {
                      setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: tplText } : m))
                    }
                  }
                  stepResults.push({ step: stepNum, success: true, label: `${templates.length} plantillas listadas` })
                }
                // --- CREATE TEMPLATE ---
                else if (browserAction === 'create_template') {
                  const tplRes = await fetch('/api/browser-bridge/templates', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: 'create',
                      name: action.data?.templateName || 'Nueva Plantilla',
                      description: action.data?.templateDescription || null,
                      category: action.data?.templateCategory || null,
                      steps: action.data?.browserSteps || [],
                      variables: null, // auto-detected by API
                    }),
                  })
                  const tplData = await tplRes.json()
                  if (tplRes.ok && tplData.template) {
                    const vars = tplData.template.variables && Array.isArray(tplData.template.variables)
                      ? tplData.template.variables.map((v: any) => `\`{{${v.key}}}\``).join(', ')
                      : 'ninguna'
                    const successText = `✅ **Plantilla creada:** "${tplData.template.name}"\n\n📝 ${tplData.template.steps?.length || 0} pasos | Variables: ${vars}\n🏷️ Categoría: ${tplData.template.category || 'general'}\n\n💡 Para ejecutarla: dime "ejecuta ${tplData.template.name}" con los valores de las variables.`
                    if (!isMultiStep) {
                      setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: successText } : m))
                    }
                    stepResults.push({ step: stepNum, success: true, label: `Plantilla creada: ${tplData.template.name}` })
                  } else {
                    throw new Error(tplData.error || 'Error creando plantilla')
                  }
                }
                // --- RUN TEMPLATE ---
                else if (browserAction === 'run_template') {
                  // First ensure we have an active session, or create one
                  let sessionId = action.data?.browserSessionId || ''
                  if (!sessionId) {
                    const sessRes = await fetch('/api/browser-bridge/sessions')
                    const sessData = await sessRes.json()
                    if (sessData.sessions?.length > 0) {
                      sessionId = sessData.sessions[0].id
                    } else {
                      const newSessRes = await fetch('/api/browser-bridge/sessions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'create_session', name: 'OCTOPUS Auto' }),
                      })
                      const newSessData = await newSessRes.json()
                      sessionId = newSessData.session?.id || ''
                    }
                  }
                  if (!sessionId) throw new Error('No se pudo crear sesión de browser')

                  // Resolver templateId: si viene vacío, intentar por nombre contra la lista de plantillas
                  let resolvedTemplateId = action.data?.browserTemplateId || ''
                  if (!resolvedTemplateId) {
                    const tplName = (action.data as any)?.templateName || (action.data as any)?.browserTemplateName || ''
                    const tplListRes = await fetch('/api/browser-bridge/templates')
                    const tplListData = await tplListRes.json()
                    const allTpls = tplListData.templates || []
                    if (tplName) {
                      const match = allTpls.find((t: any) => t.name?.toLowerCase().includes(String(tplName).toLowerCase()))
                      if (match) resolvedTemplateId = match.id
                    }
                    if (!resolvedTemplateId) {
                      const names = allTpls.map((t: any) => t.name).join(', ') || 'ninguna'
                      throw new Error(`No encontré la plantilla a ejecutar. Plantillas disponibles: ${names}. Dime cuál quieres correr o describe la tarea y la ejecuto con IA.`)
                    }
                  }

                  const runRes = await fetch('/api/browser-bridge/sessions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: 'run_template',
                      sessionId,
                      templateId: resolvedTemplateId,
                      variables: (() => {
                        // 🔗 C — sustituir {{last_image_url}} en variables de plantilla por la URL real
                        const rawVars = (action.data?.browserVariables || {}) as Record<string, unknown>
                        const chainImg2 = stepResults.slice().reverse().find(r => r.image)?.image || lastGeneratedImageUrlRef.current
                        if (!chainImg2) return rawVars
                        return Object.fromEntries(Object.entries(rawVars).map(([k, v]) => [
                          k,
                          typeof v === 'string' ? v.replace(/\{\{\s*(last_image_url|image_url|imagen_generada)\s*\}\}/gi, chainImg2) : v,
                        ]))
                      })(),
                    }),
                  })
                  const runData = await runRes.json()
                  if (runRes.ok && runData.commands) {
                    const tplCmdIds: string[] = (runData.commands || []).map((c: any) => c.id).filter(Boolean)
                    if (!isMultiStep) {
                      setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: `▶️ **Plantilla "${runData.templateName}"** — ${tplCmdIds.length} comandos enviados.\n⏳ Esperando resultados reales del Bridge...` } : m))
                    }
                    const tplPoll = await pollBrowserCommandResults(tplCmdIds, (resolved, totalCmds) => {
                      if (!isMultiStep) {
                        setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: `▶️ **Plantilla "${runData.templateName}" ejecutándose...** ${resolved}/${totalCmds} comandos resueltos` } : m))
                      }
                    })
                    const tplFinalText = formatBrowserResult(`Plantilla "${runData.templateName}"`, tplPoll)
                    if (!isMultiStep) {
                      setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: tplFinalText } : m))
                    }
                    const tplOk = !tplPoll.timedOut && tplPoll.failed === 0
                    stepResults.push({ step: stepNum, success: tplOk, label: `Plantilla ${runData.templateName}: ${tplPoll.done}/${tplPoll.total} OK${tplPoll.failed ? `, ${tplPoll.failed} fallidos` : ''}` })
                  } else {
                    throw new Error(runData.error || 'Error ejecutando plantilla')
                  }
                }
                // --- AI TASK ---
                else if (browserAction === 'ai_task') {
                  // Ensure we have a session
                  let sessionId = action.data?.browserSessionId || ''
                  if (!sessionId) {
                    const sessRes = await fetch('/api/browser-bridge/sessions')
                    const sessData = await sessRes.json()
                    if (sessData.sessions?.length > 0) {
                      sessionId = sessData.sessions[0].id
                    } else {
                      const newSessRes = await fetch('/api/browser-bridge/sessions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'create_session', name: 'OCTOPUS Auto' }),
                      })
                      const newSessData = await newSessRes.json()
                      sessionId = newSessData.session?.id || ''
                    }
                  }
                  if (!sessionId) throw new Error('No se pudo crear sesión de browser')

                  // 🔗 C — Encadenamiento imagen → navegador: sustituir placeholder por la URL REAL
                  let browserTask: string = action.data?.browserCommand || action.data?.content || ''
                  const chainImg = stepResults.slice().reverse().find(r => r.image)?.image || lastGeneratedImageUrlRef.current
                  if (chainImg) {
                    const hadPlaceholder = /\{\{\s*(last_image_url|image_url|imagen_generada)\s*\}\}/i.test(browserTask)
                    browserTask = browserTask.replace(/\{\{\s*(last_image_url|image_url|imagen_generada)\s*\}\}/gi, chainImg)
                    if (!hadPlaceholder && !/https?:\/\//.test(browserTask) && /\b(imagen|image|foto|photo)\b/i.test(browserTask)) {
                      browserTask += `\n\nNOTA: la URL real de la imagen generada es ${chainImg} — si necesitas pegar o escribir la URL de la imagen, usa exactamente esa.`
                    }
                    if (hadPlaceholder) addActivity('🔗 URL de imagen generada encadenada a la tarea del navegador', 'info')
                  }

                  const taskRes = await fetch('/api/browser-bridge/sessions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: 'ai_task',
                      sessionId,
                      task: browserTask,
                    }),
                  })
                  const taskData = await taskRes.json()
                  if (taskRes.ok) {
                    const parsed = taskData.parsed || 0
                    const cmdIds: string[] = (taskData.commands || []).map((c: any) => c.id).filter(Boolean)
                    const sendingText = `🌐 **Tarea enviada al navegador** — IA parseó **${parsed} comandos**.\n⏳ Esperando resultados reales del Bridge...`
                    if (!isMultiStep) {
                      setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: sendingText } : m))
                    }
                    addActivity(`🌐 ${parsed} comandos enviados — esperando feedback del Bridge`, 'info')
                    const pollResult = await pollBrowserCommandResults(cmdIds, (resolved, totalCmds) => {
                      if (!isMultiStep) {
                        setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: `🌐 **Ejecutando en tu navegador...** ${resolved}/${totalCmds} comandos resueltos` } : m))
                      }
                    })
                    const finalText = formatBrowserResult('Tarea de navegador', pollResult)
                    if (!isMultiStep) {
                      setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: finalText } : m))
                    }
                    const taskOk = !pollResult.timedOut && pollResult.failed === 0
                    addActivity(taskOk ? `✅ Navegador: ${pollResult.done}/${pollResult.total} comandos OK` : `⚠️ Navegador: ${pollResult.done} OK, ${pollResult.failed} fallidos${pollResult.timedOut ? ' (aún ejecutando)' : ''}`, taskOk ? 'success' : 'warning')
                    stepResults.push({ step: stepNum, success: taskOk, label: `AI task: ${pollResult.done}/${pollResult.total} comandos OK${pollResult.failed ? `, ${pollResult.failed} fallidos` : ''}${pollResult.firstError ? ` — ${pollResult.firstError}` : ''}` })
                  } else {
                    throw new Error(taskData.error || 'Error ejecutando tarea')
                  }
                }
                // --- SEND COMMAND ---
                else if (browserAction === 'send_command') {
                  let sessionId = action.data?.browserSessionId || ''
                  if (!sessionId) {
                    const sessRes = await fetch('/api/browser-bridge/sessions')
                    const sessData = await sessRes.json()
                    if (sessData.sessions?.length > 0) sessionId = sessData.sessions[0].id
                  }
                  if (!sessionId) throw new Error('No hay sesión activa')

                  const steps = action.data?.browserSteps || []
                  let cmdCount = 0
                  const sentCmdIds: string[] = []
                  for (const step of steps) {
                    const cmdRes = await fetch('/api/browser-bridge/sessions', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        action: 'send_command',
                        sessionId,
                        type: (step as any).type || 'goto',
                        params: step,
                      }),
                    })
                    try {
                      const cmdData = await cmdRes.json()
                      if (cmdData.command?.id) sentCmdIds.push(cmdData.command.id)
                    } catch { /* sin id, igual contamos */ }
                    cmdCount++
                  }
                  if (!isMultiStep) {
                    setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: `🌐 **${cmdCount} comandos enviados.** ⏳ Esperando resultados reales del Bridge...` } : m))
                  }
                  const cmdPoll = await pollBrowserCommandResults(sentCmdIds, (resolved, totalCmds) => {
                    if (!isMultiStep) {
                      setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: `🌐 **Ejecutando en tu navegador...** ${resolved}/${totalCmds} comandos resueltos` } : m))
                    }
                  })
                  const cmdFinalText = formatBrowserResult('Comandos de navegador', cmdPoll)
                  if (!isMultiStep) {
                    setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: cmdFinalText } : m))
                  }
                  const cmdOk = !cmdPoll.timedOut && cmdPoll.failed === 0
                  stepResults.push({ step: stepNum, success: cmdOk, label: `Comandos: ${cmdPoll.done}/${cmdPoll.total} OK${cmdPoll.failed ? `, ${cmdPoll.failed} fallidos` : ''}` })
                }
                else {
                  stepResults.push({ step: stepNum, success: false, label: `Browser action desconocida: ${browserAction}` })
                }
              } catch (browserErr: unknown) {
                const errMsg = browserErr instanceof Error ? browserErr.message : 'Error desconocido'
                const errText = `❌ **Error en Browser Automation:** ${errMsg}`
                if (!isMultiStep) {
                  setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: errText } : m))
                }
                stepResults.push({ step: stepNum, success: false, label: `Browser error: ${errMsg}` })
              }
            }
            else if (action.type === 'theme_toggle') {
              const targetTheme = action.data?.theme || 'toggle'
              const newTheme = targetTheme === 'toggle' ? (theme === 'dark' ? 'cream' : 'dark') : targetTheme
              setTheme(newTheme as import('@/lib/theme-context').Theme)
              const themeMsg = newTheme === 'dark' ? '🌙 Modo oscuro activado' : '☀️ Modo claro activado'
              if (!isMultiStep) {
                setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: themeMsg } : m))
              }
              stepResults.push({ step: stepNum, success: true, label: themeMsg })
            }
            else if (['execute', 'connect', 'disconnect'].includes(action.type)) {
              if (!isMultiStep) {
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantMessageId
                      ? { ...m, content: action.message || cleanedPlan, actionResult: { success: true, type: action.type, name: action.data?.target || 'Acción', location: '' } }
                      : m
                  )
                )
              }
              addActivity(`⚡ OCTOPUS ejecutó: ${action.type} - ${action.data?.target || ''}`)
              stepResults.push({ step: stepNum, success: true, label: `${action.type}: ${action.data?.target || ''}` })
            }
          } catch (stepErr) {
            console.error(`Error en paso ${stepNum}:`, stepErr)
            stepResults.push({ step: stepNum, success: false, label: `${stepLabel} — Error: ${stepErr instanceof Error ? stepErr.message : 'desconocido'}` })
          }
        } // end for loop

        // Final summary for multi-step
        if (isMultiStep) {
          const successCount = stepResults.filter(r => r.success).length
          const summaryLines = stepResults.map(r => 
            `${r.success ? '✅' : '❌'} **Paso ${r.step}:** ${r.label}`
          )
          const finalContent = cleanedPlan + `\n\n---\n🎯 **Ejecución completada (${successCount}/${allActions.length} exitosos)**\n\n` + summaryLines.join('\n')
          
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantMessageId
                ? { ...m, content: finalContent, isGeneratingImage: false, isGeneratingVideo: false }
                : m
            )
          )
          speak(`¡Listo! Ejecuté ${successCount} de ${allActions.length} pasos automáticamente.`)
        }
      }

      // === CLIENT-SIDE FALLBACK: Execute actions the LLM missed ===
      if (allActions.length === 0 && userMessage) {
        const lowerMsg = userMessage.toLowerCase()
        // Theme toggle fallback
        if (/modo\s+oscuro|modo\s+claro|dark\s*mode|light\s*mode|pon.*(?:oscuro|claro|dark|light)|cambia.*tema/.test(lowerMsg)) {
          const isDark = /oscuro|dark/i.test(lowerMsg)
          const isLight = /claro|light/i.test(lowerMsg)
          const targetTheme: import('@/lib/theme-context').Theme = isDark ? 'dark' : isLight ? 'cream' : (theme === 'dark' ? 'cream' : 'dark')
          setTheme(targetTheme)
          const themeMsg = targetTheme === 'dark' ? '🌙 Modo oscuro activado' : '☀️ Modo claro activado'
          setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, actionResult: { success: true, type: 'theme_toggle', name: themeMsg, location: '' } } : m))
          console.log('[Fallback] Theme toggle executed client-side:', targetTheme)
        }
        // Web search fallback — uses /api/jarvis/web-search endpoint directly
        else if (/(?:busca|búscame|investiga|averigua|googlea|tendencias?\s+de|noticias\s+de)/i.test(lowerMsg)) {
          const query = lowerMsg
            .replace(/^(?:che\s+)?(?:busca(?:me|r)?|búscame|investiga(?:r)?|averigua(?:r)?|googlea(?:r)?)\s*/i, '')
            .trim() || lowerMsg
          if (query && query.length > 2) {
            try {
              setMessages(prev => prev.map(m => m.id === assistantMessageId 
                ? { ...m, content: (m.content || '') + `\n\n🔍 Buscando: "${query}"...` }
                : m))
              const searchRes = await fetch('/api/jarvis/web-search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
              })
              if (searchRes.ok) {
                const searchData = await searchRes.json()
                const results = searchData.data?.results || []
                const geminiAnswer = searchData.data?.geminiAnswer || ''
                if (geminiAnswer || results.length > 0) {
                  let resultsText = ''
                  if (geminiAnswer) resultsText += geminiAnswer + '\n\n'
                  if (results.length > 0) {
                    resultsText += '**📎 Fuentes:**\n' + results.map((r: { title: string; snippet: string; url: string }) => `• [${r.title}](${r.url})`).join('\n')
                  }
                  setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: resultsText, actionResult: { success: true, type: 'web_search', name: `Búsqueda: "${query}"`, location: '' } } : m))
                  console.log('[Fallback] Web search executed client-side:', query, `(${results.length} results)`)
                } else {
                  setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: (m.content || '') + `\n\nNo encontré resultados para "${query}".` } : m))
                }
              }
            } catch (e) { console.error('[Fallback] Web search error:', e) }
          }
        }
      }

      // Speak response (cleaned) - only for non-multi-step
      if (fullContent && !isMultiStep) {
        const spokenContent = fullContent
          .replace(/```jarvis-action[\s\S]*?```/g, '')
          .replace(/```[\s\S]*?```/g, '') // remove code blocks
          .replace(/[*#_\[\]`🏠⚡💡🔌🐙💤✅⚫🟢🤔⚠️🎬🚀🌙☀️🌑🌅🔮🌊🌞💫🎯🧠🔊📊📈🎨🖼️💻]/g, '')
          .replace(/\n+/g, '. ')
          .trim()
          .substring(0, 300)
        if (spokenContent) {
          speak(spokenContent)
        }
      }

    } catch (error) {
      // If aborted by user, don't show error
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.log('[OCTOPUS] Streaming abortado por el usuario')
        return
      }
      console.error('Error:', error)
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMessageId
            ? { ...m, content: 'Lo siento, hubo un error. ¿Puedes intentar de nuevo?' }
            : m
        )
      )
    } finally {
      abortControllerRef.current = null
      setIsStreaming(false)
    }
  }

  // Analyze system
  const analyzeSystem = async () => {
    setIsAnalyzing(true)
    setJarvisThought(locale === 'en' ? 'Analyzing ecosystem...' : 'Analizando ecosistema...')
    addActivity(locale === 'en' ? '🧠 JARVIS: Starting analysis' : '🧠 JARVIS: Iniciando análisis')

    try {
      const progressInterval = setInterval(() => {
        setConsciousnessLevel(prev => Math.min(prev + 10, 90))
      }, 300)

      const response = await fetch('/api/jarvis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agents: dbAgents,
          skills: dbSkills,
          mcps: dbMcps,
          recentActivities: activities.slice(-20).map((a, i) => ({
            id: `activity-${i}`,
            timestamp: new Date(),
            type: 'info',
            source: 'system',
            message: a,
          })),
          metrics: { projectsCreated: 0, successRate: 85 },
          projectHistory: [],
        }),
      })

      clearInterval(progressInterval)

      if (!response.ok) throw new Error('Error')

      const data = await response.json()

      if (data.success && data.analysis) {
        setRecommendations(data.analysis.recommendations || [])
        try {
          const parsed = JSON.parse(data.rawResponse.match(/\{[\s\S]*\}/)?.[0] || '{}')
          setInsights(parsed.insights || [])
          setJarvisThought(parsed.thought || (locale === 'en' ? 'Analysis completed' : 'Análisis completado'))
          setSystemHealth(parsed.systemHealth || 'good')
          setConsciousnessLevel(parsed.consciousnessLevel || 85)
          // Update sub-dimensions from response
          if (data.consciousness?.dimensions) {
            setConsciousnessDimensions({
              operativa: Math.round(data.consciousness.dimensions.operativa ?? 50),
              datos: Math.round(data.consciousness.dimensions.datos ?? 50),
              predictiva: Math.round(data.consciousness.dimensions.predictiva ?? 50),
              relacional: Math.round(data.consciousness.dimensions.relacional ?? 50),
            })
          } else if (parsed.consciousness) {
            setConsciousnessDimensions({
              operativa: Math.round(parsed.consciousness.operativa ?? 50),
              datos: Math.round(parsed.consciousness.datos ?? 50),
              predictiva: Math.round(parsed.consciousness.predictiva ?? 50),
              relacional: Math.round(parsed.consciousness.relacional ?? 50),
            })
          }
          setAnalysisCount(prev => prev + 1)
          setEvolutionLog(prev => [...prev, {
            date: new Date().toISOString(),
            level: parsed.consciousnessLevel || 85,
            event: `Analysis #${analysisCount + 1}`,
          }].slice(-50))
        } catch {
          setJarvisThought(locale === 'en' ? 'Analysis completed' : 'Análisis completado')
          setConsciousnessLevel(85)
        }
        addActivity(`🧠 JARVIS: ${data.analysis.recommendations?.length || 0} recomendaciones`)
      }
    } catch (error) {
      console.error('Error:', error)
      setJarvisThought(locale === 'en' ? 'Analysis error' : 'Error en análisis')
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Implement recommendation
  const handleImplement = async (rec: Recommendation, action: 'approve' | 'reject') => {
    setImplementingId(rec.id)
    try {
      const response = await fetch('/api/jarvis/implement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recommendation: rec, action }),
      })

      const data = await response.json()

      if (data.success) {
        setRecommendations(prev =>
          prev.map(r =>
            r.id === rec.id
              ? { ...r, status: action === 'approve' ? 'implemented' : 'rejected' }
              : r
          )
        )

        if (action === 'approve' && data.data) {
          if (rec.type === 'agent') {
            // Save agent to DB instead of localStorage
            try {
              await fetch('/api/agent-factory/agents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data.data),
              })
              await fetchDbAgents()
            } catch (e) { console.error('[Jarvis] Error saving recommendation agent:', e) }
            addActivity(`✅ JARVIS creó agente: ${data.data.name}`)
          } else if (rec.type === 'skill') {
            try {
              await fetch('/api/skill-factory/skills', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data.data),
              })
              await fetchDbSkills()
            } catch (e) { console.error('[Jarvis] Error saving recommendation skill:', e) }
            addActivity(`✅ JARVIS creó skill: ${data.data.name}`)
          } else if (rec.type === 'mcp') {
            try {
              await fetch('/api/mcp-factory/servers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data.data),
              })
              await fetchDbMcps()
            } catch (e) { console.error('[Jarvis] Error saving recommendation MCP:', e) }
            addActivity(`✅ JARVIS configuró MCP: ${data.data.name}`)
          }
        }
        setSelectedRec(null)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setImplementingId(null)
    }
  }

  const pendingRecs = recommendations.filter(r => r.status === 'pending')
  const implementedRecs = recommendations.filter(r => r.status === 'implemented')

  return (
    <div className={`h-[calc(100vh-64px)] sm:h-[calc(100vh-80px)] flex flex-col transition-colors duration-300 terminal-scanlines ${
      theme === 'terminal'
        ? 'p-0 font-mono'
        : 'p-2 sm:p-4 lg:p-6'
    }`}>
      {/* Terminal window chrome — solo en tema terminal */}
      {theme === 'terminal' && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border-color)] bg-[var(--bg-secondary)] flex-shrink-0">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500/60" />
            <span className="w-3 h-3 rounded-full bg-yellow-400/60" />
            <span className="w-3 h-3 rounded-full bg-green-500/60" />
          </div>
          <span className="text-[11px] text-[var(--text-muted)] font-mono flex-1 text-center tracking-widest">
            OCTOPUS — omni-terminal v2.0
          </span>
          <span className="text-[10px] text-[var(--text-muted)] font-mono opacity-50">
            {isStreaming ? '● EXEC' : '○ IDLE'}
          </span>
        </div>
      )}

      {/* Header — Estilo Apple refinado, responsive */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${theme === 'terminal' ? 'mb-0 px-4 pt-3 pb-2 border-b border-[var(--border-color)]/40' : 'mb-3 sm:mb-5'}`}>
        <div className="flex items-center gap-3">
          <motion.div
            animate={{
              boxShadow: isStreaming || isAnalyzing
                ? ['0 0 20px rgba(74, 144, 217, 0.4)', '0 0 35px rgba(74, 144, 217, 0.6)', '0 0 20px rgba(74, 144, 217, 0.4)']
                : '0 4px 20px rgba(74, 144, 217, 0.15)',
            }}
            transition={{ duration: 1.5, repeat: isStreaming || isAnalyzing ? Infinity : 0 }}
            className="w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden shadow-lg"
          >
            <Image
              src="/octopus-core-logo.png"
              alt="OCTOPUS Core"
              width={64}
              height={64}
              className="w-12 h-12 sm:w-16 sm:h-16 object-cover scale-[1.45]"
              priority
            />
          </motion.div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
              {JARVIS_PERSONALITY.name}
              <span className="text-[10px] font-medium text-[#4A90D9] bg-[#4A90D9]/8 px-2 py-0.5 rounded-full tracking-wide">
                v{JARVIS_PERSONALITY.version}
              </span>
            </h1>
            <p className="text-[12px] sm:text-[13px] text-[var(--text-muted)] font-normal truncate">{locale === 'en' ? 'Your intelligent personal assistant' : 'Tu asistente personal inteligente'}</p>
          </div>
        </div>

        {/* Tabs — estilo segmented control Apple, responsive */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-0.5 bg-[var(--text-primary)]/[0.04] p-1 rounded-xl flex-1 sm:flex-initial">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 sm:flex-initial px-3 sm:px-4 py-1.5 sm:py-2 rounded-[10px] text-[12px] sm:text-[13px] font-medium transition-all duration-200 flex items-center justify-center gap-1.5 sm:gap-2 ${
                activeTab === 'chat'
                  ? 'bg-[var(--card-bg)] shadow-sm shadow-black/5 text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Chat
            </button>
            <button
              onClick={() => setActiveTab('analysis')}
              className={`flex-1 sm:flex-initial px-3 sm:px-4 py-1.5 sm:py-2 rounded-[10px] text-[12px] sm:text-[13px] font-medium transition-all duration-200 flex items-center justify-center gap-1.5 sm:gap-2 ${
                activeTab === 'analysis'
                  ? 'bg-[var(--card-bg)] shadow-sm shadow-black/5 text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{locale === 'en' ? 'Analysis' : 'Análisis'}</span>
              <span className="sm:hidden">{locale === 'en' ? 'Anal.' : 'Anal.'}</span>
              {pendingRecs.length > 0 && (
                <span className="bg-[#C4622D] text-white text-[10px] font-semibold w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center rounded-full">
                  {pendingRecs.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('graph')}
              className={`flex-1 sm:flex-initial px-3 sm:px-4 py-1.5 sm:py-2 rounded-[10px] text-[12px] sm:text-[13px] font-medium transition-all duration-200 flex items-center justify-center gap-1.5 sm:gap-2 ${
                activeTab === 'graph'
                  ? 'bg-[var(--card-bg)] shadow-sm shadow-black/5 text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              {locale === 'en' ? 'Graph' : 'Grafo'}
              {graphData && graphData.stats.totalNodes > 0 && (
                <span className="bg-[#2D4A3E] text-white text-[10px] font-semibold w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center rounded-full">
                  {graphData.stats.totalNodes}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('bubbles')}
              className={`flex-1 sm:flex-initial px-3 sm:px-4 py-1.5 sm:py-2 rounded-[10px] text-[12px] sm:text-[13px] font-medium transition-all duration-200 flex items-center justify-center gap-1.5 sm:gap-2 ${
                activeTab === 'bubbles'
                  ? 'bg-[var(--card-bg)] shadow-sm shadow-black/5 text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              <span className="text-[13px] leading-none">🫧</span>
              {locale === 'en' ? 'Bubbles' : 'Burbujas'}
            </button>
          </div>
          
          {/* Clear Memory Button */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowClearConfirm(true)}
              title={t('jarvis.clear')}
              className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[#C4622D] hover:bg-[#C4622D]/10 transition-all duration-200"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            {showClearConfirm && (
              <div className="absolute right-0 top-full mt-2 bg-[var(--card-bg)] rounded-xl shadow-lg border border-[var(--border-color)] p-4 z-[60] w-64">
                <p className="text-sm text-[var(--text-primary)] font-medium mb-1">🗑️ {t('jarvis.clear_confirm')}</p>
                <p className="text-xs text-[var(--text-secondary)] mb-3">{t('jarvis.clear_desc')}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] transition-colors"
                  >
                    {t('jarvis.cancel')}
                  </button>
                  <button
                    onClick={clearMemory}
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-[#C4622D] text-white hover:bg-[#B5521F] transition-colors font-medium"
                  >
                    {t('jarvis.clear_btn')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chat Tab */}
      {activeTab === 'chat' && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Loading Memory Indicator */}
          {isLoadingMemory && (
            <div className="absolute inset-0 bg-[var(--bg-primary)]/80 flex items-center justify-center z-50 rounded-2xl backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <Image src="/octopus-core-logo.png" alt="OCTOPUS" width={56} height={56} className="w-14 h-14 object-cover scale-[1.4] animate-pulse" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#2D4A3E] rounded-full animate-ping" />
                </div>
                <p className="text-[var(--text-secondary)] font-medium">Cargando memoria...</p>
              </div>
            </div>
          )}
          
          {/* Chat Messages */}
          <Card
            className={`flex-1 overflow-hidden flex flex-col transition-all rounded-2xl border-0 shadow-lg shadow-black/[0.04] bg-[var(--card-bg)] ${
              dragActive ? 'ring-2 ring-[#4A90D9] bg-[#4A90D9]/5' : ''
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
          >
            {/* Drag overlay */}
            <AnimatePresence>
              {dragActive && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-[#4A90D9]/10 flex items-center justify-center z-10 pointer-events-none"
                >
                  <div className="bg-[var(--card-bg)] p-6 rounded-2xl shadow-lg flex items-center gap-3">
                    <Upload className="w-8 h-8 text-[#4A90D9]" />
                    <span className="text-lg font-medium">Suelta imagen o documento aquí</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Messages */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-5 space-y-4">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-[20px] px-5 py-3.5 ${
                      msg.role === 'user'
                        ? 'user-bubble bg-[#2D4A3E] text-white shadow-sm shadow-[#2D4A3E]/20'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-primary)]'
                    }`}
                  >
                    {/* Imágenes subidas por el usuario (soporta multi-imagen) */}
                    {msg.images && msg.images.length > 0 ? (
                      <div className={`mb-3 ${msg.images.length === 1 ? '' : 'grid gap-2 ' + (msg.images.length === 2 ? 'grid-cols-2' : 'grid-cols-3')}`}>
                        {msg.images.map((img, idx) => (
                          <img
                            key={idx}
                            src={img}
                            alt={`Uploaded ${idx + 1}`}
                            className={`rounded-xl object-cover ${msg.images!.length === 1 ? 'max-h-48' : 'h-24 w-full'}`}
                          />
                        ))}
                      </div>
                    ) : msg.image ? (
                      <div className="mb-3">
                        <img
                          src={msg.image}
                          alt="Uploaded"
                          className="max-h-48 rounded-xl"
                        />
                      </div>
                    ) : null}

                    {/* Documento adjunto por el usuario */}
                    {msg.document && (
                      <div className="mb-3 flex items-center gap-3 p-3.5 rounded-xl bg-emerald-400/20 border border-emerald-300/40 backdrop-blur-sm">
                        <div className="h-11 w-11 rounded-lg bg-emerald-500/25 flex items-center justify-center flex-shrink-0 ring-1 ring-emerald-300/30">
                          {msg.document.type === 'pdf' && <FileText className="w-5 h-5 text-red-200" />}
                          {msg.document.type === 'docx' && <FileText className="w-5 h-5 text-blue-200" />}
                          {(msg.document.type === 'xlsx' || msg.document.type === 'csv') && <FileSpreadsheet className="w-5 h-5 text-emerald-200" />}
                          {(msg.document.type === 'txt' || msg.document.type === 'unknown') && <File className="w-5 h-5 text-gray-200" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate">📄 {msg.document.name}</p>
                          <p className="text-xs opacity-70">{msg.document.type.toUpperCase()} — Enviado para análisis</p>
                        </div>
                      </div>
                    )}
                    
                    {/* Indicador de generación de video */}
                    {msg.isGeneratingVideo && (
                      <div className="flex items-center gap-3 mb-3 p-4 bg-gradient-to-r from-indigo-50 to-cyan-50 rounded-xl border border-indigo-200">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 animate-pulse flex items-center justify-center">
                            <Activity className="w-5 h-5 text-white animate-pulse" />
                          </div>
                          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 animate-ping opacity-30" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-indigo-800">Generando video animado...</p>
                          <p className="text-xs text-indigo-600">Creando múltiples frames para la animación</p>
                        </div>
                      </div>
                    )}
                    
                    {/* Video Slideshow Player */}
                    {msg.videoFrames && msg.videoFrames.length >= 2 && (
                      <SlideshowPlayer frames={msg.videoFrames} prompt={msg.videoPrompt || 'Video generado'} />
                    )}
                    
                    {/* Indicador de búsqueda web */}
                    {msg.isSearchingWeb && (
                      <div className="flex items-center gap-3 mb-3 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-200">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 animate-pulse flex items-center justify-center">
                            <Globe className="w-5 h-5 text-white" />
                          </div>
                          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 animate-ping opacity-30" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-blue-800">Navegando en la web...</p>
                          <p className="text-xs text-blue-600">Buscando información relevante</p>
                        </div>
                      </div>
                    )}
                    
                    {/* Resultados de búsqueda web */}
                    {msg.webSearchData && msg.webSearchData.results.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-3 p-3 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border border-blue-200"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Globe className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-800">
                            Fuentes web ({msg.webSearchData.results.length})
                          </span>
                        </div>
                        <div className="space-y-2">
                          {msg.webSearchData.results.slice(0, 3).map((result, i) => (
                            <a
                              key={i}
                              href={result.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-start gap-2 p-2 rounded-lg hover:bg-[var(--bg-secondary)]/60 transition-colors group"
                            >
                              <Search className="w-3 h-3 text-blue-500 mt-1 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-blue-700 truncate group-hover:text-blue-900">
                                  {result.title}
                                </p>
                                {result.snippet && (
                                  <p className="text-xs text-[var(--text-secondary)] line-clamp-1">
                                    {result.snippet}
                                  </p>
                                )}
                              </div>
                              <ExternalLink className="w-3 h-3 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </a>
                          ))}
                        </div>
                      </motion.div>
                    )}
                    
                    {/* Indicador de generación de imagen */}
                    {msg.isGeneratingImage && (
                      <div className="flex items-center gap-3 mb-3 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 animate-pulse flex items-center justify-center">
                            <ImageIcon className="w-5 h-5 text-white" />
                          </div>
                          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 animate-ping opacity-30" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-purple-800">Generando imagen...</p>
                          <p className="text-xs text-purple-600">Esto puede tomar unos segundos</p>
                        </div>
                      </div>
                    )}
                    
                    {/* Imagen generada por OCTOPUS */}
                    {msg.generatedImage && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mb-3"
                      >
                        <div className="group">
                          <div className="relative inline-block">
                            <img
                              src={msg.generatedImage}
                              alt="Imagen generada por OCTOPUS — click para ampliar"
                              className="max-w-full rounded-xl shadow-lg border border-purple-200 cursor-zoom-in transition-transform hover:scale-[1.01]"
                              style={{ maxHeight: '400px', objectFit: 'contain' }}
                              onClick={() => msg.generatedImage && openLightbox(msg.generatedImage)}
                            />
                            {showWatermark && (
                              <img
                                src="/octopus-watermark.png"
                                alt="OCTOPUS"
                                className="absolute bottom-3 right-3 pointer-events-none select-none"
                                style={{ width: '38px', height: '38px', opacity: 0.45, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}
                              />
                            )}
                            <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => { e.stopPropagation(); msg.generatedImage && openLightbox(msg.generatedImage) }}
                                className="p-2 bg-gradient-to-b from-white to-slate-100 dark:from-slate-700 dark:to-slate-800 border border-slate-200 dark:border-white/10 rounded-lg shadow-[0_2px_6px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-[0_2px_6px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)] text-slate-700 dark:text-slate-200 hover:text-purple-600 hover:-translate-y-[1px] transition-all"
                                title="Ampliar imagen"
                              >
                                <Maximize2 className="w-4 h-4" />
                              </button>
                              <a
                                href={msg.generatedImage}
                                download="octopus-generated-image.png"
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-2 bg-gradient-to-b from-white to-slate-100 dark:from-slate-700 dark:to-slate-800 border border-slate-200 dark:border-white/10 rounded-lg shadow-[0_2px_6px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-[0_2px_6px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)] text-slate-700 dark:text-slate-200 hover:text-emerald-600 hover:-translate-y-[1px] transition-all"
                                title="Descargar imagen"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                            </div>
                          </div>
                          {/* Badge con modelo usado */}
                          {msg.generatedImageModel && (
                            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-300/40 text-[11px] font-medium text-purple-700 dark:text-purple-300">
                              <span className="text-xs">🎨</span>
                              <span>{locale === 'en' ? 'Generated with' : 'Generado con'}</span>
                              <span className="font-semibold">{msg.generatedImageModel}</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {/* Video generado por OCTOPUS — player + botones (abrir/descargar) */}
                    {msg.generatedVideo && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mb-3"
                      >
                        <div className="group">
                          <div className="relative inline-block max-w-full">
                            <video
                              src={msg.generatedVideo}
                              poster={msg.videoThumbnail}
                              controls
                              playsInline
                              preload="metadata"
                              className="max-w-full rounded-xl shadow-lg border border-indigo-200 bg-black"
                              style={{ maxHeight: '480px' }}
                            >
                              Tu navegador no soporta video HTML5.
                            </video>
                            <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <a
                                href={msg.generatedVideo}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-2 bg-gradient-to-b from-white to-slate-100 dark:from-slate-700 dark:to-slate-800 border border-slate-200 dark:border-white/10 rounded-lg shadow-[0_2px_6px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-[0_2px_6px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)] text-slate-700 dark:text-slate-200 hover:text-indigo-600 hover:-translate-y-[1px] transition-all"
                                title="Abrir en nueva pestaña"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                              <a
                                href={msg.generatedVideo}
                                download="octopus-generated-video.mp4"
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-2 bg-gradient-to-b from-white to-slate-100 dark:from-slate-700 dark:to-slate-800 border border-slate-200 dark:border-white/10 rounded-lg shadow-[0_2px_6px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-[0_2px_6px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)] text-slate-700 dark:text-slate-200 hover:text-emerald-600 hover:-translate-y-[1px] transition-all"
                                title="Descargar video"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                            </div>
                          </div>
                          {/* Badge con modelo usado */}
                          <div className="mt-2 flex flex-wrap gap-2 items-center">
                            {msg.videoModelUsed && (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-indigo-500/10 to-cyan-500/10 border border-indigo-300/40 text-[11px] font-medium text-indigo-700 dark:text-indigo-300">
                                <span className="text-xs">🎬</span>
                                <span>{locale === 'en' ? 'Generated with' : 'Generado con'}</span>
                                <span className="font-semibold">{msg.videoModelUsed}</span>
                              </div>
                            )}
                            <a
                              href={msg.generatedVideo}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-300/40 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 hover:scale-105 transition-transform"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>{locale === 'en' ? 'View direct link' : 'Ver enlace directo'}</span>
                            </a>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    
                    <div className="prose prose-sm max-w-none prose-p:text-inherit prose-strong:text-inherit prose-headings:text-inherit [&_*:not(a)]:text-inherit">
                      {msg.content.replace(/```jarvis-action[\s\S]*?```/g, '').replace(/```jarvis-action[\s\S]*$/g, '').trim().split('\n').map((line, i) => {
                        // Renderizar markdown: **bold**, [text](url), `code`, plain URLs
                        const renderLine = (text: string): React.ReactNode[] => {
                          const parts: React.ReactNode[] = []
                          let remaining = text
                          let key = 0
                          while (remaining.length > 0) {
                            // Match markdown link [text](url)
                            const linkMatch = remaining.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/)
                            // Match bold **text**
                            const boldMatch = remaining.match(/\*\*([^*]+)\*\*/)
                            // Match plain URL (not already inside markdown link)
                            const plainUrlMatch = remaining.match(/(?<!\]\()(?<!\()(https?:\/\/[^\s),<>"]+)/)
                            
                            // Find which comes first
                            const linkIdx = linkMatch?.index ?? Infinity
                            const boldIdx = boldMatch?.index ?? Infinity
                            const plainUrlIdx = plainUrlMatch?.index ?? Infinity
                            
                            const minIdx = Math.min(linkIdx, boldIdx, plainUrlIdx)
                            
                            if (minIdx === Infinity) {
                              parts.push(remaining)
                              break
                            }
                            
                            if (linkIdx === minIdx && linkMatch) {
                              if (linkIdx > 0) parts.push(remaining.substring(0, linkIdx))
                              parts.push(
                                <a key={`link-${key++}`} href={linkMatch[2]} target="_blank" rel="noopener noreferrer"
                                  className="!text-[#2563EB] hover:!text-[#1D4ED8] underline decoration-[#2563EB]/40 hover:decoration-[#1D4ED8] decoration-2 transition-colors font-semibold">
                                  {linkMatch[1]} ↗
                                </a>
                              )
                              remaining = remaining.substring(linkIdx + linkMatch[0].length)
                            } else if (boldIdx === minIdx && boldMatch) {
                              if (boldIdx > 0) parts.push(remaining.substring(0, boldIdx))
                              parts.push(<strong key={`bold-${key++}`}>{boldMatch[1]}</strong>)
                              remaining = remaining.substring(boldIdx + boldMatch[0].length)
                            } else if (plainUrlIdx === minIdx && plainUrlMatch) {
                              if (plainUrlIdx > 0) parts.push(remaining.substring(0, plainUrlIdx))
                              const displayUrl = plainUrlMatch[1].replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
                              parts.push(
                                <a key={`url-${key++}`} href={plainUrlMatch[1]} target="_blank" rel="noopener noreferrer"
                                  className="!text-[#2563EB] hover:!text-[#1D4ED8] underline decoration-[#2563EB]/40 hover:decoration-[#1D4ED8] decoration-2 transition-colors font-semibold">
                                  {displayUrl.length > 40 ? displayUrl.substring(0, 40) + '...' : displayUrl} ↗
                                </a>
                              )
                              remaining = remaining.substring(plainUrlIdx + plainUrlMatch[1].length)
                            }
                          }
                          return parts
                        }
                        return (
                          <p key={i} className="mb-1 last:mb-0">
                            {renderLine(line)}
                          </p>
                        )
                      })}
                      {msg.role === 'assistant' && msg.content === '' && isStreaming && !msg.isGeneratingImage && (
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2 h-2 bg-[#4A90D9] rounded-full animate-bounce" />
                          <span className="w-2 h-2 bg-[#4A90D9] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                          <span className="w-2 h-2 bg-[#4A90D9] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                        </span>
                      )}
                    </div>
                    {/* LinkedIn Publish Button — appears when OCTOPUS suggests a LinkedIn post */}
                    {msg.role === 'assistant' && !isStreaming && msg.content.length > 50 && (() => {
                      // Detect if this message contains LinkedIn-publishable content
                      const hasLinkedInContext = /linkedin|linked\s*in/i.test(msg.content) && /(post|copy|publica|texto|contenido|sugerido|acompañante)/i.test(msg.content)
                      if (!hasLinkedInContext) return null

                      // Extract the best publishable content from the message
                      const extractContent = (): string | null => {
                        const lines = msg.content.split('\n')
                        // Look for blockquote section (> lines)
                        const blockquoteLines = lines.filter(l => l.startsWith('> ')).map(l => l.replace(/^>\s*/, ''))
                        if (blockquoteLines.length > 0) return blockquoteLines.join('\n')
                        // Look for content after "Copy sugerido" or "Texto acompañante" headers
                        for (let i = 0; i < lines.length; i++) {
                          if (/(?:copy\s*sugerido|texto\s*acompañante|post\s*sugerido)/i.test(lines[i])) {
                            const contentLines: string[] = []
                            for (let j = i + 1; j < lines.length; j++) {
                              const line = lines[j].trim()
                              if (line === '---' || line === '```' || line.startsWith('##')) break
                              if (line === '...' || line === '') { if (contentLines.length > 0 && line === '') contentLines.push(''); continue }
                              contentLines.push(line.replace(/^\*\*/, '').replace(/\*\*$/, ''))
                            }
                            const result = contentLines.join('\n').trim()
                            if (result.length > 20) return result
                          }
                        }
                        return null
                      }

                      const publishContent = extractContent()
                      if (!publishContent) return null

                      // Find nearby image (AI-generated or user-uploaded)
                      const nearbyImage = msg.generatedImage || (() => {
                        const idx = messages.findIndex(m => m.id === msg.id)
                        if (idx < 0) return null
                        for (let k = idx - 1; k >= Math.max(0, idx - 5); k--) {
                          if (messages[k].generatedImage) return messages[k].generatedImage
                          if (messages[k].image) return messages[k].image
                        }
                        return null
                      })()

                      return (
                        <motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: 0.5 }}
                          className="mt-3 p-3.5 bg-[#0A66C2]/5 backdrop-blur-sm border border-[#0A66C2]/20 rounded-2xl"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-[#0A66C2] to-[#004182] flex items-center justify-center shadow-sm shadow-[#0A66C2]/20">
                              <Linkedin className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-semibold text-[#0A66C2]">Publicar en LinkedIn{nearbyImage ? ' 📷 con imagen' : ''}</p>
                              <p className="text-[11px] text-[#0A66C2]/60 truncate">{publishContent.substring(0, 60)}...</p>
                            </div>
                            <button
                              onClick={async () => {
                                const btn = document.activeElement as HTMLButtonElement
                                if (btn) btn.disabled = true
                                try {
                                  const res = await fetch('/api/social-bridge/publish', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ platform: 'linkedin', content: publishContent, contentType: nearbyImage ? 'image' : 'text', mediaUrl: nearbyImage || undefined }),
                                  })
                                  const data = await res.json()
                                  if (res.ok && data.post?.status === 'published') {
                                    const newId = `assistant-linkedin-${Date.now()}`
                                    setMessages(prev => [...prev, {
                                      id: newId,
                                      role: 'assistant',
                                      content: `## ✅ ¡Publicado en LinkedIn!\n\n${data.post.platformUrl ? `🔗 [Ver post](${data.post.platformUrl})` : '📡 Post enviado correctamente.'}`,
                                      timestamp: new Date()
                                    }])
                                    addActivity('✅ Post publicado en LinkedIn desde Jarvis', 'success')
                                    logOctopusProtocol('linkedin', nearbyImage ? 'image' : 'text', !!nearbyImage)
                                  } else {
                                    const newId = `assistant-linkedin-err-${Date.now()}`
                                    setMessages(prev => [...prev, {
                                      id: newId,
                                      role: 'assistant',
                                      content: `## ❌ Error al publicar\n\n${data.error || 'Verifica que LinkedIn esté conectado en [Social Bridge](/dashboard/social-bridge).'}`,
                                      timestamp: new Date()
                                    }])
                                  }
                                } catch {
                                  const newId = `assistant-linkedin-err-${Date.now()}`
                                  setMessages(prev => [...prev, {
                                    id: newId,
                                    role: 'assistant',
                                    content: '⚠️ Error de conexión. Intenta de nuevo.',
                                    timestamp: new Date()
                                  }])
                                }
                              }}
                              className="px-4 py-2 rounded-xl text-[12px] font-bold text-white bg-gradient-to-r from-[#0A66C2] to-[#004182] hover:shadow-lg hover:shadow-[#0A66C2]/20 transition-all duration-200 flex items-center gap-1.5"
                            >
                              <Send className="w-3.5 h-3.5" /> Publicar
                            </button>
                          </div>
                        </motion.div>
                      )
                    })()}
                    {/* Action Result Badge — Estilo Apple */}
                    {msg.actionResult && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                        className="mt-3 p-3.5 bg-[#E8F5E9]/60 backdrop-blur-sm border border-green-200/50 rounded-2xl"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-sm shadow-green-500/20">
                            <Check className="w-4 h-4 text-white" strokeWidth={3} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-green-800">
                              {msg.actionResult.type === 'skill' ? 'Skill creado' : msg.actionResult.type === 'agent' ? 'Agente creado' : msg.actionResult.type === 'project' ? 'Proyecto creado' : msg.actionResult.type === 'growth_engine' ? '🚀 Growth Engine' : msg.actionResult.type === 'google_workspace' ? '🔵 Google Workspace' : msg.actionResult.type === 'introspect' ? '👁️ Introspección' : msg.actionResult.type === 'image' || msg.actionResult.type === 'video' ? '🎨 Contenido creativo' : msg.actionResult.type === 'web_search' ? '🔍 Búsqueda web' : msg.actionResult.type === 'mcp' ? 'MCP creado' : '✅ Acción completada'}
                            </p>
                            <p className="text-[11px] text-green-600/80 truncate">
                              {msg.actionResult.name} → {msg.actionResult.type === 'skill' ? 'Skill Factory' : msg.actionResult.type === 'agent' ? 'Agent Factory' : msg.actionResult.type === 'project' ? 'Proyectos' : msg.actionResult.type === 'growth_engine' ? 'Growth Engine' : msg.actionResult.type === 'google_workspace' ? 'Google' : msg.actionResult.type === 'introspect' ? 'Sistema' : msg.actionResult.type === 'image' || msg.actionResult.type === 'video' ? 'Creative Studio' : msg.actionResult.type === 'web_search' ? 'Web' : msg.actionResult.type === 'mcp' ? 'MCP Factory' : 'Octopus'}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              if (msg.actionResult?.type === 'skill') router.push('/dashboard/skill-factory')
                              else if (msg.actionResult?.type === 'agent') router.push('/dashboard/agent-factory')
                              else if (msg.actionResult?.type === 'mcp') router.push('/dashboard/mcp-factory')
                              else if (msg.actionResult?.type === 'project') router.push(msg.actionResult?.location || '/dashboard/projects')
                              else if (msg.actionResult?.type === 'growth_engine') router.push('/dashboard/growth')
                              else if (msg.actionResult?.type === 'google_workspace') router.push('/dashboard/brazos')
                              else if (msg.actionResult?.location) router.push(msg.actionResult.location)
                            }}
                            className="px-3.5 py-1.5 rounded-xl text-[12px] font-semibold text-green-700 bg-[var(--bg-secondary)]/80 border border-green-200/60 hover:bg-[var(--card-bg)] hover:shadow-sm transition-all duration-200"
                          >
                            Ver
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Pending Images Preview (multi-image, up to 10) */}
            {pendingImages.length > 0 && (
              <div className="px-5 py-3 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[12px] font-medium text-[var(--text-primary)]">
                    {pendingImages.length} {pendingImages.length === 1 ? 'imagen' : 'imágenes'} adjuntada{pendingImages.length === 1 ? '' : 's'}
                    <span className="text-[var(--text-muted)] font-normal ml-1.5">· {pendingImages.length}/{MAX_IMAGES}</span>
                  </p>
                  {pendingImages.length > 1 && (
                    <button
                      onClick={() => setPendingImages([])}
                      className="text-[11px] font-medium text-red-500 hover:text-red-600 transition-colors"
                    >
                      Quitar todas
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {pendingImages.map((img, idx) => (
                    <div key={idx} className="relative group">
                      <img
                        src={img.data}
                        alt={img.name}
                        title={img.name}
                        className="h-16 w-16 rounded-xl object-cover shadow-sm border border-[var(--border-color)]"
                      />
                      <button
                        onClick={() => setPendingImages(curr => curr.filter((_, i) => i !== idx))}
                        className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-red-500 text-white hover:bg-red-600 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Quitar imagen"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pending Document Preview */}
            {/* Pre-processing indicator */}
            {isPreProcessing && (
              <div className="px-5 py-3 border-t border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-amber-600 animate-spin" />
                  <p className="text-[13px] font-medium text-amber-700">
                    🧠 Pre-procesando archivo grande en tu navegador...
                  </p>
                </div>
              </div>
            )}

            {/* Pending Video Preview */}
            {pendingVideo && (
              <div className="px-5 py-3 border-t border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50">
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-purple-100 to-indigo-100 border border-purple-200 flex items-center justify-center shadow-sm text-2xl">
                    🎬
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">🎬 {pendingVideo.name}</p>
                    <p className="text-[11px] text-purple-600 font-medium">
                      Video — Listo para analizar (se extraerán frames con FFmpeg)
                    </p>
                  </div>
                  <button
                    onClick={() => setPendingVideo(null)}
                    className="p-2 hover:bg-red-50 rounded-xl text-[var(--text-muted)] hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {pendingDocument && !isPreProcessing && (
              <div className="px-5 py-3 border-t border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50">
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 border border-emerald-200 flex items-center justify-center shadow-sm">
                    {getDocIconComponent(pendingDocument.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">📄 {pendingDocument.name}</p>
                    <p className="text-[11px] text-emerald-600 font-medium">
                      {pendingDocument.preExtractedText 
                        ? `${pendingDocument.type.toUpperCase()} — ✅ Pre-procesado en navegador (listo)`
                        : `${pendingDocument.type.toUpperCase()} — Listo para analizar`
                      }
                    </p>
                  </div>
                  <button
                    onClick={() => setPendingDocument(null)}
                    className="p-2 hover:bg-red-50 rounded-xl text-[var(--text-muted)] hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Input — Estilo Apple / Copilot, optimizado para móvil */}
            <div className="p-3 sm:p-5 bg-gradient-to-t from-[var(--card-bg)] via-[var(--card-bg)] to-[var(--card-bg)]/80 border-t border-[var(--border-color)]">
              {/* Voice Mode animated banner */}
              <AnimatePresence>
                {voiceMode && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className={`mb-2 sm:mb-3 flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-500 ${
                      voicePhase === 'listening' ? 'bg-emerald-500/10 border-emerald-500/20' :
                      voicePhase === 'thinking' ? 'bg-amber-500/10 border-amber-500/20' :
                      voicePhase === 'speaking' ? 'bg-blue-500/10 border-blue-500/20' :
                      'bg-[var(--hover-bg)] border-[var(--border-color)]'
                    }`}
                  >
                    {/* Animated orb */}
                    <div className="relative flex-shrink-0 w-8 h-8 flex items-center justify-center">
                      <div className={`absolute inset-0 rounded-full transition-all duration-700 ${
                        voicePhase === 'listening' ? 'bg-emerald-500/20 animate-ping' :
                        voicePhase === 'thinking' ? 'bg-amber-500/20 animate-pulse' :
                        voicePhase === 'speaking' ? 'bg-blue-500/20 animate-pulse' : ''
                      }`} />
                      <div className={`relative w-4 h-4 rounded-full transition-all duration-500 ${
                        voicePhase === 'listening' ? 'bg-emerald-400 scale-110' :
                        voicePhase === 'thinking' ? 'bg-amber-400 scale-90' :
                        voicePhase === 'speaking' ? 'bg-blue-400 scale-125' : 'bg-gray-400'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] font-semibold transition-colors ${
                        voicePhase === 'listening' ? 'text-emerald-400' :
                        voicePhase === 'thinking' ? 'text-amber-400' :
                        voicePhase === 'speaking' ? 'text-blue-400' : 'text-[var(--text-secondary)]'
                      }`}>
                        {voicePhase === 'listening' ? (interimTranscript ? `"${interimTranscript}..."` : '🎙️ Escuchando...') :
                         voicePhase === 'thinking' ? '🧠 Pensando...' :
                         voicePhase === 'speaking' ? '🔊 Hablando...' : 'Modo Voz'}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Conversación continua activa</p>
                    </div>
                    <button
                      onClick={toggleVoiceMode}
                      className="text-[11px] font-bold text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors border border-red-500/20"
                    >
                      Detener
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Voice listening banner (non-voice-mode) */}
              <AnimatePresence>
                {isListening && !voiceMode && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-2 sm:mb-3 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20"
                  >
                    <div className="relative flex-shrink-0">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                      <div className="absolute inset-0 w-3 h-3 bg-red-500 rounded-full animate-ping opacity-40" />
                    </div>
                    <p className="text-[13px] font-medium text-red-400 flex-1 truncate">
                      {interimTranscript 
                        ? `"${interimTranscript}..."` 
                        : (locale === 'en' ? '🎙️ Listening... speak now' : '🎙️ Escuchando... habla ahora')
                      }
                    </p>
                    <button
                      onClick={toggleListening}
                      className="text-[11px] font-bold text-red-400 hover:text-red-300 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors"
                    >
                      {locale === 'en' ? 'Stop' : 'Parar'}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Input bar — reorganizado para móvil */}
              <div className={`bg-[var(--input-bg)] border shadow-sm focus-within:shadow-md transition-all duration-300 ${
                theme === 'terminal'
                  ? 'rounded-none border-[var(--border-color)] focus-within:border-[var(--text-primary)]/60'
                  : 'rounded-2xl'
              } ${
                isListening
                  ? 'border-red-500/40 shadow-red-500/10 focus-within:border-red-500/40 focus-within:shadow-red-500/10'
                  : theme !== 'terminal' ? 'border-[var(--border-color)] focus-within:border-[#4A90D9]/40 focus-within:shadow-[#4A90D9]/5' : ''
              }`}>
                {/* Textarea + Send row */}
                <div className="flex items-end gap-1.5 sm:gap-2 px-2 sm:px-3 pt-2 pb-1.5 sm:pb-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileInput}
                    multiple
                    accept="image/*,video/*,.pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.mp4,.webm,.mov,.avi,.mkv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/plain"
                    className="hidden"
                  />
                  {/* Textarea with voice overlay */}
                  <div className="flex-1 relative flex items-end gap-1">
                    {/* Terminal prompt prefix */}
                    {theme === 'terminal' && (
                      <span className="text-[var(--text-primary)] opacity-70 text-[13px] font-mono pb-2.5 flex-shrink-0 select-none">
                        {'>_'}
                      </span>
                    )}
                    <textarea
                      value={inputMessage}
                      onChange={(e) => {
                        setInputMessage(e.target.value)
                        e.target.style.height = 'auto'
                        e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          sendMessage()
                        }
                      }}
                      onPaste={handlePaste}
                      placeholder={isListening ? (locale === 'en' ? '🎙️ Listening... speak now' : '🎙️ Escuchando... habla ahora') : t('jarvis.type_message')}
                      className="w-full px-1 sm:px-2 py-2 bg-transparent border-0 focus:ring-0 outline-none text-[14px] sm:text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none overflow-y-auto leading-relaxed"
                      style={{ minHeight: '40px', maxHeight: '160px' }}
                      rows={1}
                      disabled={isStreaming}
                    />
                    {/* Interim transcript overlay */}
                    {isListening && interimTranscript && (
                      <div className="absolute left-1 sm:left-2 right-2 top-2 text-[14px] sm:text-[15px] text-[#4A90D9]/70 italic pointer-events-none leading-relaxed truncate">
                        {inputMessage ? '' : ''}{interimTranscript}...
                      </div>
                    )}
                  </div>

                  {/* Send / Stop — 3D lift */}
                  {isStreaming ? (
                    <button
                      onClick={stopStreaming}
                      className="p-2 sm:p-2.5 rounded-xl transition-all duration-200 bg-gradient-to-b from-red-400 to-red-600 text-white border border-red-600/60 shadow-[0_2px_6px_rgba(239,68,68,0.35),inset_0_1px_0_rgba(255,255,255,0.4)] hover:shadow-[0_4px_12px_rgba(239,68,68,0.45),inset_0_1px_0_rgba(255,255,255,0.4)] hover:-translate-y-[1px] active:translate-y-0 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] animate-pulse flex-shrink-0"
                      title="Detener respuesta"
                    >
                      <Square className="w-4 h-4 sm:w-[18px] sm:h-[18px] fill-current drop-shadow-sm" />
                    </button>
                  ) : (
                    <button
                      data-voice-autosend
                      onClick={sendMessage}
                      disabled={!inputMessage.trim() && pendingImages.length === 0 && !pendingDocument && !pendingVideo}
                      className={`p-2 sm:p-2.5 rounded-xl transition-all duration-200 flex-shrink-0 ${
                        !inputMessage.trim() && pendingImages.length === 0 && !pendingDocument && !pendingVideo
                          ? 'bg-gradient-to-b from-[var(--text-primary)]/5 to-[var(--text-primary)]/10 text-[var(--text-muted)] cursor-not-allowed border border-[var(--border-color)]/40'
                          : 'bg-gradient-to-b from-[#4A90D9] to-[#2E6CB8] text-white border border-[#2E6CB8]/80 shadow-[0_2px_8px_rgba(74,144,217,0.35),inset_0_1px_0_rgba(255,255,255,0.35)] hover:shadow-[0_6px_16px_rgba(74,144,217,0.5),inset_0_1px_0_rgba(255,255,255,0.35)] hover:-translate-y-[1px] active:translate-y-0 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]'
                      }`}
                    >
                      <Send className="w-4 h-4 sm:w-[18px] sm:h-[18px] drop-shadow-sm" />
                    </button>
                  )}
                </div>

                {/* Action buttons row — 3D toolbar */}
                <div className="flex items-center gap-1.5 px-2 sm:px-3 pb-2.5 pt-1 border-t border-[var(--border-color)]/30">
                  {/* Attach — 3D */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 sm:p-2 rounded-lg transition-all duration-200 bg-gradient-to-b from-white to-slate-100 dark:from-slate-700/60 dark:to-slate-800/60 border border-slate-200/80 dark:border-white/10 text-[var(--text-muted)] hover:text-[var(--text-secondary)] shadow-[0_1px_2px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.95)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] hover:-translate-y-[1px] hover:shadow-[0_3px_8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.95)] dark:hover:shadow-[0_3px_8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)] active:translate-y-0 active:shadow-[inset_0_1px_3px_rgba(0,0,0,0.15)]"
                    title="Adjuntar imagen o documento"
                  >
                    <Paperclip className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                  </button>

                  {/* Mic — 3D */}
                  <div className="relative">
                    <button
                      onClick={toggleListening}
                      className={`relative p-1.5 sm:p-2 rounded-lg transition-all duration-200 ${
                        isListening
                          ? 'bg-gradient-to-b from-red-400 to-red-600 text-white border border-red-600/60 shadow-[0_3px_10px_rgba(239,68,68,0.45),inset_0_1px_0_rgba(255,255,255,0.4)]'
                          : micPermission === 'denied'
                            ? 'bg-gradient-to-b from-red-500/5 to-red-500/10 border border-red-500/20 text-red-400/50 cursor-not-allowed'
                            : 'bg-gradient-to-b from-white to-slate-100 dark:from-slate-700/60 dark:to-slate-800/60 border border-slate-200/80 dark:border-white/10 text-[var(--text-muted)] hover:text-[var(--text-secondary)] shadow-[0_1px_2px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.95)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] hover:-translate-y-[1px] hover:shadow-[0_3px_8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.95)] dark:hover:shadow-[0_3px_8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)] active:translate-y-0 active:shadow-[inset_0_1px_3px_rgba(0,0,0,0.15)]'
                      }`}
                      title={
                        isListening 
                          ? (locale === 'en' ? 'Stop & send' : 'Detener y enviar') 
                          : micPermission === 'denied'
                            ? (locale === 'en' ? 'Microphone blocked - check browser settings' : 'Micrófono bloqueado - revisa configuración del navegador')
                            : (locale === 'en' ? 'Speak to OCTOPUS' : 'Hablar a OCTOPUS')
                      }
                    >
                      {isListening ? (
                        <MicOff className="w-4 h-4 sm:w-[18px] sm:h-[18px] drop-shadow-sm" />
                      ) : (
                        <Mic className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                      )}
                      {isListening && (
                        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-400 rounded-full animate-ping" />
                      )}
                    </button>
                  </div>

                  {/* Voice Mode toggle — 3D */}
                  <button
                    onClick={toggleVoiceMode}
                    className={`px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all duration-200 flex items-center gap-1 ${
                      voiceMode
                        ? 'bg-gradient-to-b from-emerald-400 to-cyan-600 text-white border border-emerald-600/70 shadow-[0_3px_10px_rgba(16,185,129,0.45),inset_0_1px_0_rgba(255,255,255,0.4)] animate-pulse'
                        : 'bg-gradient-to-b from-white to-slate-100 dark:from-slate-700/60 dark:to-slate-800/60 border border-slate-200/80 dark:border-white/10 text-[var(--text-muted)] hover:text-[var(--text-secondary)] shadow-[0_1px_2px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.95)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] hover:-translate-y-[1px] hover:shadow-[0_3px_8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.95)] dark:hover:shadow-[0_3px_8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)] active:translate-y-0 active:shadow-[inset_0_1px_3px_rgba(0,0,0,0.15)]'
                    }`}
                    title={voiceMode ? 'Desactivar Modo Voz' : 'Activar Modo Voz — conversación continua'}
                  >
                    <Mic className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${voiceMode ? 'drop-shadow-sm' : ''}`} />
                    <span className="hidden sm:inline">{voiceMode ? 'Voz ON' : 'Modo Voz'}</span>
                    <span className="sm:hidden">{voiceMode ? 'ON' : 'Voz'}</span>
                  </button>

                  {/* Voice language toggle — 3D */}
                  <button
                    onClick={() => {
                      const newLang = voiceLang === 'es' ? 'en' : 'es'
                      setVoiceLang(newLang)
                    }}
                    className={`px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all duration-200 flex items-center gap-1 ${
                      voiceLang === 'es'
                        ? 'bg-gradient-to-b from-orange-400 to-orange-600 text-white border border-orange-600/70 shadow-[0_3px_10px_rgba(249,115,22,0.4),inset_0_1px_0_rgba(255,255,255,0.35)] hover:-translate-y-[1px] hover:shadow-[0_5px_14px_rgba(249,115,22,0.5),inset_0_1px_0_rgba(255,255,255,0.35)] active:translate-y-0 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)]'
                        : 'bg-gradient-to-b from-blue-400 to-blue-600 text-white border border-blue-600/70 shadow-[0_3px_10px_rgba(59,130,246,0.4),inset_0_1px_0_rgba(255,255,255,0.35)] hover:-translate-y-[1px] hover:shadow-[0_5px_14px_rgba(59,130,246,0.5),inset_0_1px_0_rgba(255,255,255,0.35)] active:translate-y-0 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)]'
                    }`}
                    title={`Idioma de voz: ${voiceLang === 'es' ? 'Español' : 'English'}. Click para cambiar.`}
                  >
                    <span className="drop-shadow-sm">{voiceLang === 'es' ? '🇪🇸' : '🇺🇸'}</span>
                    <span className="hidden sm:inline uppercase drop-shadow-sm">{voiceLang}</span>
                  </button>

                  {/* Voice toggle — 3D */}
                  <button
                    onClick={() => {
                      const newEnabled = !voiceEnabled
                      setVoiceEnabled(newEnabled)
                      // Si se desactiva, parar TODO el audio inmediatamente
                      if (!newEnabled) {
                        // Parar audio HTML5 (Google Cloud TTS)
                        if (audioRef.current) {
                          audioRef.current.pause()
                          audioRef.current.currentTime = 0
                          audioRef.current = null
                        }
                        // Parar voz del navegador (fallback)
                        if (synthRef.current) {
                          synthRef.current.cancel()
                        }
                        setIsSpeaking(false)
                        // Also stop voice mode if active
                        if (voiceMode) {
                          voiceModeRef.current = false
                          setVoiceMode(false)
                          setVoicePhase('idle')
                        }
                      }
                    }}
                    className={`p-1.5 sm:p-2 rounded-lg transition-all duration-200 ${
                      voiceEnabled
                        ? 'bg-gradient-to-b from-sky-400 to-blue-600 text-white border border-blue-600/70 shadow-[0_3px_10px_rgba(74,144,217,0.45),inset_0_1px_0_rgba(255,255,255,0.35)] hover:-translate-y-[1px] hover:shadow-[0_5px_14px_rgba(74,144,217,0.55),inset_0_1px_0_rgba(255,255,255,0.35)] active:translate-y-0 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)]'
                        : 'bg-gradient-to-b from-white to-slate-100 dark:from-slate-700/60 dark:to-slate-800/60 border border-slate-200/80 dark:border-white/10 text-[var(--text-muted)] hover:text-[var(--text-secondary)] shadow-[0_1px_2px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.95)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] hover:-translate-y-[1px] hover:shadow-[0_3px_8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.95)] dark:hover:shadow-[0_3px_8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)] active:translate-y-0 active:shadow-[inset_0_1px_3px_rgba(0,0,0,0.15)]'
                    } ${isSpeaking ? 'animate-pulse' : ''}`}
                    title={voiceEnabled ? 'Desactivar voz' : 'Activar voz'}
                  >
                    {voiceEnabled ? <Volume2 className="w-4 h-4 sm:w-[18px] sm:h-[18px] drop-shadow-sm" /> : <VolumeX className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />}
                  </button>

                  {/* Turbo Mode Toggle — 3D */}
                  <button
                    onClick={toggleTurbo}
                    className={`px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all duration-200 flex items-center gap-1 ${
                      turbo.enabled
                        ? 'bg-gradient-to-b from-amber-300 via-orange-400 to-orange-600 text-white border border-orange-600/70 shadow-[0_3px_12px_rgba(251,146,60,0.55),inset_0_1px_0_rgba(255,255,255,0.45)] hover:-translate-y-[1px] hover:shadow-[0_5px_16px_rgba(251,146,60,0.65),inset_0_1px_0_rgba(255,255,255,0.45)] active:translate-y-0 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]'
                        : 'bg-gradient-to-b from-white to-slate-100 dark:from-slate-700/60 dark:to-slate-800/60 border border-slate-200/80 dark:border-white/10 text-[var(--text-muted)] hover:text-[var(--text-secondary)] shadow-[0_1px_2px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.95)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] hover:-translate-y-[1px] hover:shadow-[0_3px_8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.95)] dark:hover:shadow-[0_3px_8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)] active:translate-y-0 active:shadow-[inset_0_1px_3px_rgba(0,0,0,0.15)]'
                    }`}
                    title={turbo.enabled 
                      ? `⚡ Turbo activo: ${turbo.model?.split('/')[1] || turbo.model || ''} — Click para desactivar` 
                      : 'Activar Turbo Mode (configura en Settings)'}
                  >
                    <span className={`${turbo.enabled ? 'animate-pulse drop-shadow-sm' : ''}`}>⚡</span>
                    {turbo.enabled && turbo.model && (
                      <span className="hidden sm:inline max-w-[60px] truncate drop-shadow-sm">
                        {turbo.model.includes('/') ? turbo.model.split('/')[1]?.split('-').slice(0, 2).join('-') : turbo.model}
                      </span>
                    )}
                  </button>

                  {/* 🎨 Image Model Picker — 3D */}
                  <button
                    onClick={() => setShowModelPicker(true)}
                    className={`px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all duration-200 flex items-center gap-1 ${
                      imageModel !== 'auto'
                        ? 'bg-gradient-to-b from-purple-400 via-fuchsia-500 to-pink-600 text-white border border-pink-600/70 shadow-[0_3px_12px_rgba(217,70,239,0.5),inset_0_1px_0_rgba(255,255,255,0.4)] hover:-translate-y-[1px] hover:shadow-[0_5px_16px_rgba(217,70,239,0.6),inset_0_1px_0_rgba(255,255,255,0.4)] active:translate-y-0 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]'
                        : 'bg-gradient-to-b from-white to-slate-100 dark:from-slate-700/60 dark:to-slate-800/60 border border-slate-200/80 dark:border-white/10 text-[var(--text-muted)] hover:text-[var(--text-secondary)] shadow-[0_1px_2px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.95)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] hover:-translate-y-[1px] hover:shadow-[0_3px_8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.95)] dark:hover:shadow-[0_3px_8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)] active:translate-y-0 active:shadow-[inset_0_1px_3px_rgba(0,0,0,0.15)]'
                    }`}
                    title={`🎨 ${t('jarvis.imageModel')}: ${imageModel === 'auto' ? t('jarvis.autoDetect') : getModelLabel(imageModel)}. ${t('jarvis.imageModelClick')}.`}
                  >
                    <span className={imageModel !== 'auto' ? 'drop-shadow-sm' : ''}>🎨</span>
                    <span className="hidden sm:inline max-w-[80px] truncate">
                      {imageModel === 'auto' ? 'Auto' : (IMAGE_MODELS.find(m => m.id === imageModel)?.emoji || '') + ' ' + (IMAGE_MODELS.find(m => m.id === imageModel)?.id.split('/').pop()?.split('-').slice(0, 2).join('-') || 'Custom')}
                    </span>
                  </button>

                  {/* 🧠 Chat Model Picker — 3D */}
                  <button
                    onClick={() => setShowChatModelPicker(true)}
                    className={`px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all duration-200 flex items-center gap-1 ${
                      chatModel !== 'auto'
                        ? 'bg-gradient-to-b from-cyan-400 via-teal-500 to-emerald-600 text-white border border-emerald-600/70 shadow-[0_3px_12px_rgba(16,185,129,0.5),inset_0_1px_0_rgba(255,255,255,0.4)] hover:-translate-y-[1px] hover:shadow-[0_5px_16px_rgba(16,185,129,0.65),inset_0_1px_0_rgba(255,255,255,0.4)] active:translate-y-0 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]'
                        : 'bg-gradient-to-b from-white to-slate-100 dark:from-slate-700/60 dark:to-slate-800/60 border border-slate-200/80 dark:border-white/10 text-[var(--text-muted)] hover:text-[var(--text-secondary)] shadow-[0_1px_2px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.95)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] hover:-translate-y-[1px] hover:shadow-[0_3px_8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.95)] dark:hover:shadow-[0_3px_8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)] active:translate-y-0 active:shadow-[inset_0_1px_3px_rgba(0,0,0,0.15)]'
                    }`}
                    title={`🧠 Modelo del chat: ${chatModel === 'auto' ? 'Auto (sistema decide)' : TURBO_MODELS.find(m => m.id === chatModel)?.name || chatModel}`}
                  >
                    <span className={chatModel !== 'auto' ? 'drop-shadow-sm' : ''}>🧠</span>
                    <span className="hidden sm:inline max-w-[80px] truncate">
                      {chatModel === 'auto' ? 'Auto' : (TURBO_MODELS.find(m => m.id === chatModel)?.name.split(' ').slice(-2).join(' ') || chatModel.split('/').pop()?.split('-').slice(0, 2).join('-') || 'Custom')}
                    </span>
                  </button>
                </div>
              </div>

              {/* 🔍 Image Lightbox Modal — zoom/pan before download */}
              <AnimatePresence>
                {lightboxImage && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-[100] bg-black/92 backdrop-blur-md flex items-center justify-center"
                    onClick={closeLightbox}
                    onWheel={(e) => {
                      e.preventDefault()
                      const delta = e.deltaY > 0 ? 0.9 : 1.1
                      setLightboxZoom(z => Math.min(Math.max(z * delta, 0.5), 8))
                    }}
                  >
                    {/* Toolbar */}
                    <div
                      className="absolute top-4 right-4 flex items-center gap-2 z-10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => setLightboxZoom(z => Math.max(z / 1.25, 0.5))}
                        className="p-2.5 bg-gradient-to-b from-white/95 to-slate-100/95 dark:from-slate-800/95 dark:to-slate-900/95 border border-white/20 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.3)] text-slate-700 dark:text-slate-200 hover:text-purple-500 hover:-translate-y-[1px] transition-all backdrop-blur-md"
                        title="Alejar (-)"
                      >
                        <ZoomOut className="w-5 h-5" />
                      </button>
                      <div className="px-3 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-mono tabular-nums min-w-[64px] text-center">
                        {Math.round(lightboxZoom * 100)}%
                      </div>
                      <button
                        onClick={() => setLightboxZoom(z => Math.min(z * 1.25, 8))}
                        className="p-2.5 bg-gradient-to-b from-white/95 to-slate-100/95 dark:from-slate-800/95 dark:to-slate-900/95 border border-white/20 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.3)] text-slate-700 dark:text-slate-200 hover:text-purple-500 hover:-translate-y-[1px] transition-all backdrop-blur-md"
                        title="Acercar (+)"
                      >
                        <ZoomIn className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => { setLightboxZoom(1); setLightboxOffset({ x: 0, y: 0 }) }}
                        className="px-3 py-2 bg-gradient-to-b from-white/95 to-slate-100/95 dark:from-slate-800/95 dark:to-slate-900/95 border border-white/20 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.3)] text-slate-700 dark:text-slate-200 text-xs font-bold hover:text-purple-500 hover:-translate-y-[1px] transition-all backdrop-blur-md"
                        title="Restablecer (0)"
                      >
                        Fit
                      </button>
                      <a
                        href={lightboxImage}
                        download="octopus-generated-image.png"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 bg-gradient-to-b from-emerald-400 to-emerald-600 border border-emerald-600/70 rounded-xl shadow-[0_4px_12px_rgba(16,185,129,0.45),inset_0_1px_0_rgba(255,255,255,0.35)] text-white hover:-translate-y-[1px] transition-all"
                        title="Descargar"
                      >
                        <Download className="w-5 h-5" />
                      </a>
                      <button
                        onClick={closeLightbox}
                        className="p-2.5 bg-gradient-to-b from-red-400 to-red-600 border border-red-600/70 rounded-xl shadow-[0_4px_12px_rgba(239,68,68,0.45),inset_0_1px_0_rgba(255,255,255,0.35)] text-white hover:-translate-y-[1px] transition-all ml-2"
                        title="Cerrar (Esc)"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Hints */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-white/80 text-[11px] font-medium flex items-center gap-3 pointer-events-none">
                      <span>🖱️ Scroll para zoom</span>
                      <span className="text-white/40">·</span>
                      <span>✋ Arrastra para mover</span>
                      <span className="text-white/40">·</span>
                      <span>⌨️ + / - / 0 / Esc</span>
                    </div>

                    {/* Image */}
                    <motion.img
                      key={lightboxImage}
                      src={lightboxImage}
                      alt="Imagen ampliada"
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                      className="max-w-[92vw] max-h-[85vh] rounded-lg shadow-2xl select-none"
                      draggable={false}
                      style={{
                        transform: `translate(${lightboxOffset.x}px, ${lightboxOffset.y}px) scale(${lightboxZoom})`,
                        cursor: lightboxZoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'zoom-in',
                        transformOrigin: 'center center',
                        transition: isPanning ? 'none' : 'transform 0.15s ease-out',
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (lightboxZoom === 1) {
                          setLightboxZoom(2)
                        }
                      }}
                      onMouseDown={(e) => {
                        if (lightboxZoom <= 1) return
                        e.stopPropagation()
                        e.preventDefault()
                        setIsPanning(true)
                        panStartRef.current = {
                          x: e.clientX,
                          y: e.clientY,
                          offsetX: lightboxOffset.x,
                          offsetY: lightboxOffset.y,
                        }
                      }}
                      onMouseMove={(e) => {
                        if (!isPanning || !panStartRef.current) return
                        e.stopPropagation()
                        const dx = e.clientX - panStartRef.current.x
                        const dy = e.clientY - panStartRef.current.y
                        setLightboxOffset({
                          x: panStartRef.current.offsetX + dx,
                          y: panStartRef.current.offsetY + dy,
                        })
                      }}
                      onMouseUp={() => {
                        setIsPanning(false)
                        panStartRef.current = null
                      }}
                      onMouseLeave={() => {
                        setIsPanning(false)
                        panStartRef.current = null
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 🎨 Image Model Picker Modal */}
              {showModelPicker && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                  onClick={() => setShowModelPicker(false)}
                >
                  <div
                    className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="sticky top-0 bg-[var(--bg-primary)] border-b border-[var(--border-color)] px-5 py-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">🎨</span>
                        <div>
                          <h3 className="text-base font-bold text-[var(--text-primary)]">
                            {t('jarvis.imageGenModel')}
                          </h3>
                          <p className="text-xs text-[var(--text-muted)]">
                            {hasOpenRouterKey
                              ? `✅ ${t('jarvis.openrouterConnected')}`
                              : `⚠️ ${t('jarvis.noOpenrouter')}`}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowModelPicker(false)}
                        className="p-1.5 rounded-lg hover:bg-[var(--hover-bg)] text-[var(--text-muted)]"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="p-5 space-y-4">
                      {/* Auto option */}
                      <button
                        onClick={() => { setImageModel('auto'); setShowModelPicker(false) }}
                        className={`w-full text-left p-4 rounded-xl border transition-all ${
                          imageModel === 'auto'
                            ? 'bg-purple-500/10 border-purple-500 shadow-[0_0_16px_rgba(168,85,247,0.25)]'
                            : 'bg-[var(--bg-secondary)] border-[var(--border-color)] hover:border-purple-500/60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">🤖</span>
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-[var(--text-primary)]">
                              {t('jarvis.autoDetect')}
                            </div>
                            <div className="text-xs text-[var(--text-muted)] mt-0.5">
                              {t('jarvis.autoDesc')}
                            </div>
                          </div>
                          {imageModel === 'auto' && <Check className="w-5 h-5 text-purple-500" />}
                        </div>
                      </button>

                      {/* Grouped models */}
                      {CATEGORY_ORDER.map(cat => {
                        const models = groupImageModels()[cat]
                        if (!models || models.length === 0) return null
                        const catMeta = CATEGORY_LABELS[cat]
                        return (
                          <div key={cat}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: catMeta.color }} />
                              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: catMeta.color }}>
                                {t(catMeta.labelKey)}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {models.map((m: ImageModel) => {
                                const isSelected = imageModel === m.id
                                const disabled = m.needsKey && !hasOpenRouterKey
                                return (
                                  <button
                                    key={m.id}
                                    onClick={() => { if (!disabled) { setImageModel(m.id); setShowModelPicker(false) } }}
                                    disabled={disabled}
                                    className={`p-3 rounded-lg border text-left text-xs transition-all relative ${
                                      isSelected
                                        ? 'bg-purple-500/10 border-purple-500 text-[var(--text-primary)] shadow-[0_0_16px_rgba(168,85,247,0.25)]'
                                        : disabled
                                          ? 'bg-[var(--bg-secondary)]/50 border-[var(--border-color)]/50 text-[var(--text-muted)]/60 cursor-not-allowed'
                                          : 'bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-secondary)] hover:border-purple-500/60 hover:bg-[var(--hover-bg)]'
                                    }`}
                                  >
                                    {m.isNew && !disabled && (
                                      <span className="absolute -top-1.5 -right-1.5 text-[9px] font-bold bg-gradient-to-r from-emerald-500 to-teal-400 text-white px-1.5 py-0.5 rounded-full shadow-md">
                                        NEW
                                      </span>
                                    )}
                                    <div className="flex items-start gap-2">
                                      <span className="text-sm mt-0.5">{m.emoji}</span>
                                      <div className="flex-1 min-w-0">
                                        <div className="font-medium truncate">{t(m.labelKey)}</div>
                                        <p className="text-[10px] text-[var(--text-muted)] leading-snug line-clamp-2 mt-0.5">
                                          {t(m.descKey)}
                                        </p>
                                        {m.priceHint && (
                                          <span className="text-[9px] text-[var(--text-muted)]/80 mt-0.5 inline-block">
                                            {m.priceHint}
                                          </span>
                                        )}
                                      </div>
                                      {isSelected && <Check className="w-4 h-4 text-purple-500 flex-shrink-0" />}
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
                </div>
              )}

              {/* 🧠 Chat Model Picker Modal */}
              {showChatModelPicker && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                  onClick={() => setShowChatModelPicker(false)}
                >
                  <div
                    className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto"
                    onClick={e => e.stopPropagation()}
                  >
                    {/* Header */}
                    <div className="sticky top-0 bg-[var(--bg-primary)] border-b border-[var(--border-color)] px-5 py-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">🧠</span>
                        <div>
                          <h3 className="text-base font-bold text-[var(--text-primary)]">Modelo del Chat</h3>
                          <p className="text-xs text-[var(--text-muted)]">
                            {hasOpenRouterKey
                              ? '✅ OpenRouter conectado — todos los modelos disponibles'
                              : '⚠️ Sin OpenRouter — solo modelos con mapa Abacus funcionarán'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowChatModelPicker(false)}
                        className="p-1.5 rounded-lg hover:bg-[var(--hover-bg)] text-[var(--text-muted)]"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="p-5 space-y-4">
                      {/* Auto option */}
                      <button
                        onClick={() => { setChatModel('auto'); setShowChatModelPicker(false) }}
                        className={`w-full text-left p-4 rounded-xl border transition-all ${
                          chatModel === 'auto'
                            ? 'bg-emerald-500/10 border-emerald-500 shadow-[0_0_16px_rgba(16,185,129,0.25)]'
                            : 'bg-[var(--bg-secondary)] border-[var(--border-color)] hover:border-emerald-500/60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">🤖</span>
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-[var(--text-primary)]">Auto (recomendado)</div>
                            <div className="text-xs text-[var(--text-muted)] mt-0.5">
                              Turbo si está activo, si no Abacus AI (gpt-4.1) — el sistema decide
                            </div>
                          </div>
                          {chatModel === 'auto' && <Check className="w-5 h-5 text-emerald-500" />}
                        </div>
                      </button>

                      {/* Modelos agrupados por provider */}
                      {Array.from(new Set(TURBO_MODELS.map((m: TurboModel) => m.provider))).map(provider => {
                        const models = TURBO_MODELS.filter((m: TurboModel) => m.provider === provider)
                        const icon = models[0]?.providerIcon || '•'
                        return (
                          <div key={provider}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm">{icon}</span>
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                                {provider}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {models.map((m: TurboModel) => {
                                const isSelected = chatModel === m.id
                                const badge = getTierBadge(m.tier)
                                const needsOR = !['openai/gpt-4o', 'openai/gpt-5.4', 'openai/gpt-5.4-mini', 'openai/o3',
                                  'anthropic/claude-fable-5', 'anthropic/claude-opus-4.8', 'anthropic/claude-opus-4.6',
                                  'anthropic/claude-sonnet-4.6'].includes(m.id)
                                const disabled = needsOR && !hasOpenRouterKey
                                return (
                                  <button
                                    key={m.id}
                                    onClick={() => { if (!disabled) { setChatModel(m.id); setShowChatModelPicker(false) } }}
                                    disabled={disabled}
                                    className={`p-3 rounded-lg border text-left text-xs transition-all relative ${
                                      isSelected
                                        ? 'bg-emerald-500/10 border-emerald-500 text-[var(--text-primary)] shadow-[0_0_16px_rgba(16,185,129,0.25)]'
                                        : disabled
                                          ? 'bg-[var(--bg-secondary)]/50 border-[var(--border-color)]/50 text-[var(--text-muted)]/60 cursor-not-allowed'
                                          : 'bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-secondary)] hover:border-emerald-500/60 hover:bg-[var(--hover-bg)]'
                                    }`}
                                  >
                                    <div className="flex items-start gap-2">
                                      <span className="text-sm mt-0.5">{m.providerIcon}</span>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-medium truncate">{m.name}</span>
                                          <span
                                            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                            style={{ background: badge.bg, color: badge.color }}
                                          >
                                            {badge.label}
                                          </span>
                                        </div>
                                        <p className="text-[10px] text-[var(--text-muted)] leading-snug line-clamp-2 mt-0.5">
                                          {m.description}
                                        </p>
                                        <span className="text-[9px] text-[var(--text-muted)]/70 mt-0.5 inline-block">
                                          {m.contextWindow} ctx{disabled ? ' · requiere OpenRouter' : ''}
                                        </span>
                                      </div>
                                      {isSelected && <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
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
                </div>
              )}

              {/* Suggestion chips — Estilo Copilot Grid */}
              <div className="mt-3 sm:mt-4 grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
                {(locale === 'en' ? [
                  { icon: ImageIcon, text: 'Generate an image of an octopus', emoji: '🎨' },
                  { icon: Navigation, text: 'Go to projects', emoji: '✨' },
                  { icon: BarChart3, text: 'Give me a report', emoji: '📊' },
                  { icon: Globe, text: 'Search for AI news', emoji: '🌐' },
                ] : [
                  { icon: ImageIcon, text: 'Genera una imagen de un pulpo', emoji: '🎨' },
                  { icon: Navigation, text: 'Vamos a proyectos', emoji: '✨' },
                  { icon: BarChart3, text: 'Dame un reporte', emoji: '📊' },
                  { icon: Globe, text: 'Busca noticias de IA', emoji: '🌐' },
                ]).map((action, i) => (
                  <button
                    key={i}
                    onClick={() => setInputMessage(action.text)}
                    className="group flex items-center gap-2 sm:gap-2.5 px-2.5 sm:px-3.5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl bg-[var(--bg-secondary)]/80 border border-[var(--border-color)] hover:border-[#4A90D9]/25 hover:bg-[var(--bg-secondary)] hover:shadow-md hover:shadow-[#4A90D9]/5 text-left transition-all duration-200 active:scale-[0.98]"
                  >
                    <span className="text-sm sm:text-base leading-none">{action.emoji}</span>
                    <span className="text-[11px] sm:text-[13px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] font-medium leading-snug line-clamp-2">{action.text}</span>
                  </button>
                ))}
              </div>

              {/* Secondary chips — Ojos + Web en línea compacta */}
              <div className="mt-2 sm:mt-2.5 flex items-center gap-1.5 sm:gap-2 flex-wrap">
                {(locale === 'en' ? [
                  { icon: Eye, text: 'Show me your code', emoji: '👁️', tint: 'hover:border-purple-200 hover:bg-purple-50/50' },
                  { icon: Brain, text: 'Analyze yourself', emoji: '🧠', tint: 'hover:border-indigo-200 hover:bg-indigo-50/50' },
                  { icon: Activity, text: 'System statistics', emoji: '⚡', tint: 'hover:border-blue-200 hover:bg-blue-50/50' },
                  { icon: Search, text: 'What is machine learning', emoji: '🔍', tint: 'hover:border-cyan-200 hover:bg-cyan-50/50' },
                ] : [
                  { icon: Eye, text: 'Muéstrame tu código', emoji: '👁️', tint: 'hover:border-purple-200 hover:bg-purple-50/50' },
                  { icon: Brain, text: 'Analízate a ti mismo', emoji: '🧠', tint: 'hover:border-indigo-200 hover:bg-indigo-50/50' },
                  { icon: Activity, text: 'Estadísticas del sistema', emoji: '⚡', tint: 'hover:border-blue-200 hover:bg-blue-50/50' },
                  { icon: Search, text: 'Qué es machine learning', emoji: '🔍', tint: 'hover:border-cyan-200 hover:bg-cyan-50/50' },
                ]).map((action, i) => (
                  <button
                    key={i}
                    onClick={() => setInputMessage(action.text)}
                    className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-[var(--bg-secondary)]/60 border border-[var(--border-color)] text-[11px] sm:text-[12px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] font-medium transition-all duration-200 ${action.tint}`}
                  >
                    <span className="text-xs sm:text-sm leading-none">{action.emoji}</span>
                    {action.text}
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Analysis Tab */}
      {activeTab === 'analysis' && (
        <div className="flex-1 overflow-y-auto space-y-6">
          {/* 🧠 Consciousness Panel — Persistent & Sub-dimensional */}
          <Card className="p-5 border-[#4A90D9]/20 relative overflow-hidden">
            {/* Subtle background glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#4A90D9]/5 via-transparent to-[#2D4A3E]/5 pointer-events-none" />
            
            <div className="relative z-10">
              {/* Header row: Overall consciousness + expand toggle */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#4A90D9]/10 rounded-xl">
                    <Brain className="w-6 h-6 text-[#4A90D9]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-lg">{locale === 'en' ? 'Consciousness' : 'Consciencia'}</h3>
                      {analysisCount > 0 && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[#4A90D9]/10 text-[#4A90D9]">
                          #{analysisCount}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">
                      {locale === 'en' ? 'Persistent — accumulates with each analysis' : 'Persistente — se acumula con cada análisis'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {/* Overall level display */}
                  <div className="text-right">
                    <span className="text-3xl font-bold text-[#4A90D9]">{consciousnessLevel}%</span>
                  </div>
                  <button
                    onClick={() => setConsciousnessExpanded(prev => !prev)}
                    className="p-1.5 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors text-[var(--text-muted)]"
                  >
                    <motion.div animate={{ rotate: consciousnessExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <TrendingUp className="w-4 h-4" />
                    </motion.div>
                  </button>
                </div>
              </div>

              {/* Overall progress bar */}
              <div className="h-2.5 bg-[var(--border-color)] rounded-full overflow-hidden mb-4">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, #4A90D9, #2D4A3E, #C4622D)' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${consciousnessLevel}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              </div>

              {/* Sub-dimensions — always visible, compact */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {([
                  { key: 'operativa' as const, icon: Cpu, color: '#4A90D9', labelEn: 'Operative', labelEs: 'Operativa' },
                  { key: 'datos' as const, icon: Database, color: '#2D4A3E', labelEn: 'Data', labelEs: 'Datos' },
                  { key: 'predictiva' as const, icon: TrendingUp, color: '#C4622D', labelEn: 'Predictive', labelEs: 'Predictiva' },
                  { key: 'relacional' as const, icon: Link2, color: '#8B5CF6', labelEn: 'Relational', labelEs: 'Relacional' },
                ]).map(dim => (
                  <div key={dim.key} className="flex items-center gap-2 p-2 rounded-lg bg-[var(--bg-secondary)]/50">
                    <dim.icon className="w-4 h-4 flex-shrink-0" style={{ color: dim.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[11px] text-[var(--text-muted)] truncate">
                          {locale === 'en' ? dim.labelEn : dim.labelEs}
                        </span>
                        <span className="text-[11px] font-bold" style={{ color: dim.color }}>
                          {consciousnessDimensions[dim.key]}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-[var(--border-color)] rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: dim.color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${consciousnessDimensions[dim.key]}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Expanded: Evolution timeline */}
              <AnimatePresence>
                {consciousnessExpanded && evolutionLog.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 pt-3 border-t border-[var(--border-color)]">
                      <p className="text-xs font-medium text-[var(--text-muted)] mb-2">
                        {locale === 'en' ? '📈 Evolution History' : '📈 Historial de Evolución'}
                      </p>
                      <div className="flex items-end gap-1 h-16">
                        {evolutionLog.slice(-20).map((entry, i) => {
                          const height = Math.max(8, (entry.level / 100) * 100)
                          const isLatest = i === evolutionLog.slice(-20).length - 1
                          return (
                            <div
                              key={i}
                              className="flex-1 flex flex-col items-center justify-end group relative"
                            >
                              <motion.div
                                className={`w-full rounded-t-sm ${isLatest ? 'bg-[#4A90D9]' : 'bg-[#4A90D9]/40'}`}
                                initial={{ height: 0 }}
                                animate={{ height: `${height}%` }}
                                transition={{ duration: 0.5, delay: i * 0.02 }}
                              />
                              {/* Tooltip on hover */}
                              <div className="absolute bottom-full mb-1 hidden group-hover:block z-20">
                                <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-2 py-1 shadow-lg whitespace-nowrap">
                                  <p className="text-[10px] font-bold">{entry.level}%</p>
                                  <p className="text-[9px] text-[var(--text-muted)]">
                                    {new Date(entry.date).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Card>

          {/* Stats row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${
                  systemHealth === 'optimal' ? 'bg-green-100' :
                  systemHealth === 'good' ? 'bg-blue-100' :
                  systemHealth === 'degraded' ? 'bg-yellow-100' : 'bg-red-100'
                }`}>
                  <Shield className={`w-5 h-5 ${
                    systemHealth === 'optimal' ? 'text-green-600' :
                    systemHealth === 'good' ? 'text-blue-600' :
                    systemHealth === 'degraded' ? 'text-yellow-600' : 'text-red-600'
                  }`} />
                </div>
                <div>
                  <p className="text-sm text-[var(--text-secondary)]">{locale === 'en' ? 'System' : 'Sistema'}</p>
                  <p className="font-bold capitalize">{systemHealth}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#C4622D]/10 rounded-xl">
                  <Lightbulb className="w-5 h-5 text-[#C4622D]" />
                </div>
                <div>
                  <p className="text-sm text-[var(--text-secondary)]">{locale === 'en' ? 'Pending' : 'Pendientes'}</p>
                  <p className="text-2xl font-bold text-[#C4622D]">{pendingRecs.length}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-xl">
                  <Check className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-[var(--text-secondary)]">{locale === 'en' ? 'Implemented' : 'Implementadas'}</p>
                  <p className="text-2xl font-bold text-green-600">{implementedRecs.length}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Analyze button */}
          <div className="flex justify-center">
            <Button
              onClick={analyzeSystem}
              disabled={isAnalyzing}
              size="lg"
              className="gap-2"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {locale === 'en' ? 'Analyzing...' : 'Analizando...'}
                </>
              ) : (
                <>
                  <Activity className="w-5 h-5" />
                  {locale === 'en' ? 'Analyze Ecosystem' : 'Analizar Ecosistema'}
                </>
              )}
            </Button>
          </div>

          {/* Thought */}
          <motion.p
            key={jarvisThought}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-[#4A90D9] italic"
          >
            "{jarvisThought || (locale === 'en' ? 'Ready to help you' : 'Listo para ayudarte')}"
          </motion.p>

          {/* Insights */}
          {insights.length > 0 && (
            <Card className="p-6 bg-gradient-to-br from-[#4A90D9]/5 to-[#2D4A3E]/5">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#4A90D9]" />
                Insights
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {insights.map((insight, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 bg-[var(--card-bg)] rounded-xl">
                    <Target className="w-4 h-4 text-[#4A90D9] mt-0.5 flex-shrink-0" />
                    <p className="text-sm">{insight}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Recommendations */}
          <div>
            <h3 className="font-bold text-xl mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#C4622D]" />
              {locale === 'en' ? 'Self-Improvement Recommendations' : 'Recomendaciones de Auto-Mejora'}
            </h3>

            {recommendations.length === 0 ? (
              <Card className="p-12 text-center">
                <Brain className="w-16 h-16 mx-auto text-[var(--text-muted)] mb-4" />
                <p className="text-[var(--text-secondary)]">
                  {locale === 'en' ? 'Press "Analyze Ecosystem" to generate recommendations' : 'Presiona "Analizar Ecosistema" para generar recomendaciones'}
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recommendations.map((rec, index) => {
                  const IconComp = typeIcons[rec.type]
                  const isImplemented = rec.status === 'implemented'
                  const isRejected = rec.status === 'rejected'

                  return (
                    <motion.div
                      key={rec.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card className={`p-5 hover:shadow-lg transition-all ${
                        isImplemented ? 'border-2 border-green-300 bg-green-50/50' :
                        isRejected ? 'opacity-50' : ''
                      }`}>
                        <div className="flex items-start justify-between mb-3">
                          <div
                            className="p-2 rounded-xl"
                            style={{ backgroundColor: `${typeColors[rec.type]}15` }}
                          >
                            <IconComp
                              className="w-5 h-5"
                              style={{ color: typeColors[rec.type] }}
                            />
                          </div>
                          <span
                            className="text-xs px-2 py-1 rounded-full font-medium"
                            style={{
                              backgroundColor: `${priorityColors[rec.priority]}20`,
                              color: priorityColors[rec.priority],
                            }}
                          >
                            {(locale === 'en' ? priorityLabelsEn : priorityLabelsEs)[rec.priority]}
                          </span>
                        </div>

                        <h4 className="font-bold mb-1">{rec.title}</h4>
                        <p className="text-sm text-[var(--text-secondary)] mb-3 line-clamp-2">{rec.description}</p>

                        {isImplemented ? (
                          <div className="flex items-center gap-2 text-green-600 text-sm">
                            <Check className="w-4 h-4" /> {locale === 'en' ? 'Implemented' : 'Implementado'}
                          </div>
                        ) : isRejected ? (
                          <div className="flex items-center gap-2 text-gray-400 text-sm">
                            <X className="w-4 h-4" /> {locale === 'en' ? 'Rejected' : 'Rechazado'}
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => setSelectedRec(rec)} className="flex-1">
                              <Eye className="w-3 h-3 mr-1" /> {locale === 'en' ? 'View' : 'Ver'}
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleImplement(rec, 'approve')}
                              disabled={implementingId === rec.id}
                              className="flex-1 bg-green-600 hover:bg-green-700"
                            >
                              {implementingId === rec.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <ThumbsUp className="w-3 h-3 mr-1" />
                              )}
                              {locale === 'en' ? 'Approve' : 'Aprobar'}
                            </Button>
                          </div>
                        )}
                      </Card>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Knowledge Graph Tab (Phase 2) */}
      {activeTab === 'graph' && (
        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Graph Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#2D4A3E]/10 rounded-xl">
                  <Network className="w-5 h-5 text-[#2D4A3E]" />
                </div>
                <div>
                  <p className="text-sm text-[var(--text-secondary)]">{locale === 'en' ? 'Entities' : 'Entidades'}</p>
                  <p className="text-xl font-bold text-[#2D4A3E]">{graphData?.stats.totalNodes ?? 0}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#C4622D]/10 rounded-xl">
                  <GitBranch className="w-5 h-5 text-[#C4622D]" />
                </div>
                <div>
                  <p className="text-sm text-[var(--text-secondary)]">{locale === 'en' ? 'Relations' : 'Relaciones'}</p>
                  <p className="text-xl font-bold text-[#C4622D]">{graphData?.stats.totalEdges ?? 0}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#4A90D9]/10 rounded-xl">
                  <GitBranch className="w-5 h-5 text-[#4A90D9]" />
                </div>
                <div>
                  <p className="text-sm text-[var(--text-secondary)]">GitHub Items</p>
                  <p className="text-xl font-bold text-[#4A90D9]">{armsSyncStatus?.github.itemCount ?? 0}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/10 rounded-xl">
                  <Mail className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-[var(--text-secondary)]">Gmail Items</p>
                  <p className="text-xl font-bold text-red-500">{armsSyncStatus?.gmail.itemCount ?? 0}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Graph Visualization + Arms Sync */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Knowledge Graph Visualization */}
            <Card className="lg:col-span-2 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Network className="w-5 h-5 text-[#2D4A3E]" />
                  Knowledge Graph
                </h3>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={loadGraphData}
                    disabled={graphLoading}
                  >
                    <RefreshCw className={`w-3 h-3 mr-1 ${graphLoading ? 'animate-spin' : ''}`} />
                    {locale === 'en' ? 'Refresh' : 'Actualizar'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={clearGraph}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    {t('jarvis.clear_btn')}
                  </Button>
                </div>
              </div>

              {graphLoading ? (
                <div className="flex items-center justify-center h-[400px]">
                  <Loader2 className="w-8 h-8 text-[#2D4A3E] animate-spin" />
                </div>
              ) : !graphData || graphData.nodes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[400px] text-[var(--text-muted)]">
                  <Network className="w-16 h-16 mb-4 opacity-30" />
                  <p className="text-lg font-medium">{locale === 'en' ? 'Empty graph' : 'Grafo vacío'}</p>
                  <p className="text-sm mt-1">{locale === 'en' ? 'Talk to OCTOPUS or sync your Arms to populate the graph' : 'Habla con OCTOPUS o sincroniza tus Brazos para poblar el grafo'}</p>
                </div>
              ) : (
                <div className="relative h-[400px] bg-[#1A1A1A]/[0.02] rounded-xl border border-[#1A1A1A]/10 overflow-hidden">
                  {/* SVG-based force-directed-like visualization */}
                  <svg width="100%" height="100%" viewBox="0 0 800 400">
                    {/* Edges */}
                    {graphData.edges.map((edge, i) => {
                      const sourceNode = graphData.nodes.find(n => n.id === edge.source)
                      const targetNode = graphData.nodes.find(n => n.id === edge.target)
                      if (!sourceNode || !targetNode) return null
                      const si = graphData.nodes.indexOf(sourceNode)
                      const ti = graphData.nodes.indexOf(targetNode)
                      const total = graphData.nodes.length
                      const sAngle = (si / total) * Math.PI * 2
                      const tAngle = (ti / total) * Math.PI * 2
                      const cx = 400, cy = 200, rx = 280, ry = 150
                      const sx = cx + rx * Math.cos(sAngle)
                      const sy = cy + ry * Math.sin(sAngle)
                      const tx = cx + rx * Math.cos(tAngle)
                      const ty = cy + ry * Math.sin(tAngle)
                      return (
                        <g key={`edge-${i}`}>
                          <line
                            x1={sx} y1={sy} x2={tx} y2={ty}
                            stroke="#C4622D"
                            strokeWidth={Math.max(0.5, edge.weight * 0.5)}
                            strokeOpacity={0.3}
                          />
                          <text
                            x={(sx + tx) / 2}
                            y={(sy + ty) / 2 - 4}
                            textAnchor="middle"
                            fill="#C4622D"
                            fontSize="8"
                            opacity={0.6}
                          >
                            {edge.predicate}
                          </text>
                        </g>
                      )
                    })}
                    {/* Nodes */}
                    {graphData.nodes.map((node, i) => {
                      const total = graphData.nodes.length
                      const angle = (i / total) * Math.PI * 2
                      const cx = 400, cy = 200, rx = 280, ry = 150
                      const nx = cx + rx * Math.cos(angle)
                      const ny = cy + ry * Math.sin(angle)
                      const radius = Math.max(8, Math.min(20, 8 + node.mentions * 2))
                      const nodeColors: Record<string, string> = {
                        person: '#4A90D9',
                        technology: '#2D4A3E',
                        project: '#C4622D',
                        company: '#9B59B6',
                        concept: '#E67E22',
                        tool: '#1ABC9C',
                        language: '#3498DB',
                        framework: '#2ECC71',
                      }
                      const color = nodeColors[node.type] || '#95A5A6'
                      const isSelected = selectedNode === node.id
                      return (
                        <g
                          key={node.id}
                          onClick={() => setSelectedNode(isSelected ? null : node.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          {isSelected && (
                            <circle cx={nx} cy={ny} r={radius + 4} fill="none" stroke={color} strokeWidth="2" strokeDasharray="3 3" opacity={0.6} />
                          )}
                          <circle
                            cx={nx} cy={ny} r={radius}
                            fill={color}
                            fillOpacity={0.8}
                            stroke={isSelected ? '#1A1A1A' : 'white'}
                            strokeWidth={isSelected ? 2 : 1}
                          />
                          <text
                            x={nx}
                            y={ny + radius + 12}
                            textAnchor="middle"
                            fill="#1A1A1A"
                            fontSize="9"
                            fontWeight={isSelected ? 'bold' : 'normal'}
                          >
                            {node.name.length > 14 ? node.name.substring(0, 12) + '…' : node.name}
                          </text>
                        </g>
                      )
                    })}
                  </svg>
                  {/* Legend */}
                  <div className="absolute bottom-3 left-3 flex flex-wrap gap-2">
                    {[
                      { type: 'person', color: '#4A90D9', label: 'Persona' },
                      { type: 'technology', color: '#2D4A3E', label: 'Tecnología' },
                      { type: 'project', color: '#C4622D', label: 'Proyecto' },
                      { type: 'tool', color: '#1ABC9C', label: 'Herramienta' },
                      { type: 'concept', color: '#E67E22', label: 'Concepto' },
                    ].map(leg => (
                      <div key={leg.type} className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)]">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: leg.color }} />
                        {leg.label}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Selected node details */}
              {selectedNode && graphData && (() => {
                const node = graphData.nodes.find(n => n.id === selectedNode)
                const nodeEdges = graphData.edges.filter(e => e.source === selectedNode || e.target === selectedNode)
                if (!node) return null
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-4 bg-[var(--bg-primary)] rounded-xl border border-[#C4622D]/20"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold capitalize">{node.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[#2D4A3E]/10 text-[#2D4A3E] capitalize">{node.type}</span>
                        <span className="text-xs text-[var(--text-muted)]">{node.mentions} menciones</span>
                      </div>
                      <button onClick={() => setSelectedNode(null)} className="p-1 hover:bg-[#1A1A1A]/10 rounded">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {nodeEdges.length > 0 && (
                      <div className="space-y-1 mt-2">
                        {nodeEdges.slice(0, 8).map((e, idx) => (
                          <div key={idx} className="text-sm text-[var(--text-secondary)]">
                            <span className="font-medium">{e.sourceName || '?'}</span>
                            {' → '}
                            <span className="text-[#C4622D]">{e.predicate}</span>
                            {' → '}
                            <span className="font-medium">{e.targetName || '?'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )
              })()}

              {/* Top Entities */}
              {graphData && graphData.stats.topEntities.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-2">{locale === 'en' ? 'Top Entities' : 'Top Entidades'}</h4>
                  <div className="flex flex-wrap gap-2">
                    {graphData.stats.topEntities.map((entity, i) => (
                      <span key={i} className="px-3 py-1 text-xs rounded-full bg-[#2D4A3E]/10 text-[#2D4A3E] font-medium">
                        {entity.name} ({entity.mentions})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* Arms Sync Panel */}
            <Card className="p-6">
              <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2 mb-4">
                <Zap className="w-5 h-5 text-[#C4622D]" />
                {locale === 'en' ? 'Arms Sync' : 'Sincronización de Brazos'}
              </h3>

              <div className="space-y-4">
                {/* GitHub */}
                <div className="p-4 rounded-xl border border-[#1A1A1A]/10 bg-[#1A1A1A]/[0.02]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-[#1A1A1A] rounded-lg">
                        <GitBranch className="w-4 h-4 text-white" />
                      </div>
                      <span className="font-medium text-sm">GitHub</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${armsSyncStatus?.github.connected ? 'bg-green-100 text-green-700' : 'bg-[var(--hover-bg)] text-[var(--text-secondary)]'}`}>
                      {armsSyncStatus?.github.connected ? (locale === 'en' ? 'Connected' : 'Conectado') : (locale === 'en' ? 'Not connected' : 'No conectado')}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] mb-3">
                    {armsSyncStatus?.github.lastSync
                      ? `${locale === 'en' ? 'Last sync' : 'Última sync'}: ${new Date(armsSyncStatus.github.lastSync).toLocaleDateString(locale === 'en' ? 'en' : 'es')}`
                      : (locale === 'en' ? 'Not synced' : 'Sin sincronizar')}
                    {armsSyncStatus?.github.itemCount ? ` • ${armsSyncStatus.github.itemCount} items` : ''}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => syncArm('github')}
                    disabled={syncingArm === 'github' || !armsSyncStatus?.github.connected}
                    className="w-full bg-[#2D4A3E] hover:bg-[#2D4A3E]/90"
                  >
                    {syncingArm === 'github' ? (
                      <><Loader2 className="w-3 h-3 animate-spin mr-1" /> {locale === 'en' ? 'Syncing...' : 'Sincronizando...'}</>
                    ) : (
                      <><RefreshCcw className="w-3 h-3 mr-1" /> {locale === 'en' ? 'Sync to Graph' : 'Sincronizar al Grafo'}</>
                    )}
                  </Button>
                </div>

                {/* Gmail */}
                <div className="p-4 rounded-xl border border-[#1A1A1A]/10 bg-[#1A1A1A]/[0.02]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-red-500 rounded-lg">
                        <Mail className="w-4 h-4 text-white" />
                      </div>
                      <span className="font-medium text-sm">Gmail</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${armsSyncStatus?.gmail.connected ? 'bg-green-100 text-green-700' : 'bg-[var(--hover-bg)] text-[var(--text-secondary)]'}`}>
                      {armsSyncStatus?.gmail.connected ? (locale === 'en' ? 'Connected' : 'Conectado') : (locale === 'en' ? 'Not connected' : 'No conectado')}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] mb-3">
                    {armsSyncStatus?.gmail.lastSync
                      ? `${locale === 'en' ? 'Last sync' : 'Última sync'}: ${new Date(armsSyncStatus.gmail.lastSync).toLocaleDateString(locale === 'en' ? 'en' : 'es')}`
                      : (locale === 'en' ? 'Not synced' : 'Sin sincronizar')}
                    {armsSyncStatus?.gmail.itemCount ? ` • ${armsSyncStatus.gmail.itemCount} items` : ''}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => syncArm('gmail')}
                    disabled={syncingArm === 'gmail' || !armsSyncStatus?.gmail.connected}
                    className="w-full bg-red-500 hover:bg-red-600"
                  >
                    {syncingArm === 'gmail' ? (
                      <><Loader2 className="w-3 h-3 animate-spin mr-1" /> {locale === 'en' ? 'Syncing...' : 'Sincronizando...'}</>
                    ) : (
                      <><RefreshCcw className="w-3 h-3 mr-1" /> {locale === 'en' ? 'Sync to Graph' : 'Sincronizar al Grafo'}</>
                    )}
                  </Button>
                </div>

                {/* Info */}
                <div className="p-3 rounded-lg bg-[#4A90D9]/5 border border-[#4A90D9]/20">
                  <p className="text-xs text-[#4A90D9]/80">
                    💡 {locale === 'en' 
                      ? 'Sync imports data from your connected Arms to the Knowledge Graph. Extracted entities and relations will be used to improve OCTOPUS responses.' 
                      : 'La sincronización importa datos de tus Brazos conectados al Knowledge Graph. Las entidades y relaciones extraídas se usarán para mejorar las respuestas de OCTOPUS.'}
                  </p>
                </div>

                {/* How it works */}
                <div className="mt-4 space-y-3">
                  <h4 className="text-sm font-medium text-[var(--text-secondary)]">{locale === 'en' ? 'How does it work?' : '¿Cómo funciona?'}</h4>
                  <div className="space-y-2 text-xs text-[var(--text-secondary)]">
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-[#2D4A3E]">1.</span>
                      <span>{locale === 'en' ? 'Connect your Arms in the Active Arms section' : 'Conecta tus Brazos en la sección de Brazos Activos'}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-[#2D4A3E]">2.</span>
                      <span>{locale === 'en' ? 'Sync here to import repos/emails to the graph' : 'Sincroniza aquí para importar repos/emails al grafo'}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-[#2D4A3E]">3.</span>
                      <span>{locale === 'en' ? 'OCTOPUS will use this information in its responses' : 'OCTOPUS usará esta información en sus respuestas'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Bubbles Tab — Mapa Mental Infinito */}
      {activeTab === 'bubbles' && (
        <BubblesMindMap locale={locale === 'en' ? 'en' : 'es'} />
      )}

      {/* Recommendation Modal */}
      <AnimatePresence>
        {selectedRec && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedRec(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-[var(--card-bg)] rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div
                    className="p-3 rounded-xl"
                    style={{ backgroundColor: `${typeColors[selectedRec.type]}15` }}
                  >
                    {(() => {
                      const IconComp = typeIcons[selectedRec.type]
                      return <IconComp className="w-6 h-6" style={{ color: typeColors[selectedRec.type] }} />
                    })()}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{selectedRec.title}</h2>
                    <p className="text-sm text-[var(--text-secondary)] capitalize">{locale === 'en' ? `${selectedRec.type} recommendation` : `Recomendación de ${selectedRec.type}`}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedRec(null)} className="p-2 rounded-xl hover:bg-[var(--hover-bg)]">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-1">{locale === 'en' ? 'Description' : 'Descripción'}</h4>
                  <p>{selectedRec.description}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-1">{locale === 'en' ? 'Reasoning' : 'Razonamiento'}</h4>
                  <p>{selectedRec.reasoning}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-1">{locale === 'en' ? 'Impact' : 'Impacto'}</h4>
                  <p>{selectedRec.impact}</p>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <Button
                  variant="outline"
                  onClick={() => handleImplement(selectedRec, 'reject')}
                  className="flex-1"
                  disabled={implementingId === selectedRec.id}
                >
                  <ThumbsDown className="w-4 h-4 mr-2" /> {locale === 'en' ? 'Reject' : 'Rechazar'}
                </Button>
                <Button
                  onClick={() => handleImplement(selectedRec, 'approve')}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={implementingId === selectedRec.id}
                >
                  {implementingId === selectedRec.id ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <ThumbsUp className="w-4 h-4 mr-2" />
                  )}
                  {locale === 'en' ? 'Approve & Implement' : 'Aprobar e Implementar'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Notifications */}
      <div className="fixed bottom-6 right-6 space-y-3 z-50">
        <AnimatePresence>
          {notifications.map((notif) => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, x: 100, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.8 }}
              className="bg-[var(--card-bg)] rounded-2xl shadow-xl border border-green-200 p-4 min-w-[300px]"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  notif.type === 'skill' ? 'bg-[#C4622D]/10' :
                  notif.type === 'agent' ? 'bg-[#2D4A3E]/10' : 'bg-[#4A90D9]/10'
                }`}>
                  {notif.type === 'skill' ? (
                    <Wrench className="w-5 h-5 text-[#C4622D]" />
                  ) : notif.type === 'agent' ? (
                    <Bot className="w-5 h-5 text-[#2D4A3E]" />
                  ) : (
                    <Plug className="w-5 h-5 text-[#4A90D9]" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-[var(--text-primary)]">
                    ✅ {notif.type === 'skill' ? 'Skill' : notif.type === 'agent' ? 'Agente' : 'MCP'} creado
                  </p>
                  <p className="text-sm text-[var(--text-secondary)]">{notif.name}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (notif.type === 'skill') router.push('/dashboard/skill-factory')
                    else if (notif.type === 'agent') router.push('/dashboard/agent-factory')
                    else router.push('/dashboard/mcp-factory')
                    setNotifications(prev => prev.filter(n => n.id !== notif.id))
                  }}
                >
                  Ver
                </Button>
              </div>
              <div className="mt-2 h-1 bg-[var(--hover-bg)] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: 5, ease: 'linear' }}
                  className="h-full bg-green-500"
                />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* 🎨 Canvas — proyecto web en vivo */}
      <AnimatePresence>
        {showCanvas && canvasProject && (
          <OctopusCanvas
            projectId={canvasProject.projectId}
            title={canvasProject.title}
            files={canvasProject.files}
            refreshKey={canvasRefreshKey}
            locale={locale === 'en' ? 'en' : 'es'}
            onClose={() => setShowCanvas(false)}
            onLogs={runCanvasAutoFix}
            onVision={runCanvasVision}
            onSwitchProject={async (pid) => {
              try {
                const res = await fetch(`/api/canvas?projectId=${pid}`)
                if (!res.ok) return
                const data = await res.json()
                setCanvasProject({ projectId: data.projectId, title: data.title, files: data.files })
                setCanvasRefreshKey(k => k + 1)
                canvasFixDoneRef.current = ''
              } catch { /* ignore */ }
            }}
            onNewProject={() => {
              setCanvasProject(null)
              setShowCanvas(false)
            }}
            onCloneUrl={runCanvasClone}
          />
        )}
      </AnimatePresence>
      {!showCanvas && canvasProject && (
        <CanvasReopenChip
          title={canvasProject.title}
          locale={locale === 'en' ? 'en' : 'es'}
          onClick={() => setShowCanvas(true)}
        />
      )}

      {/* Plan upgrade modal */}
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