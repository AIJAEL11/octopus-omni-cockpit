'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  MessageCircleQuestion,
  X,
  Send,
  Minus,
  Sparkles,
  Mic,
  MicOff,
  Loader2,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

// Complete module map — matches ALL sidebar routes
const MODULE_MAP: Record<string, { key: string; name: { es: string; en: string }; icon: string }> = {
  'jarvis':               { key: 'jarvis',               name: { es: 'OCTOPUS (Jarvis)', en: 'OCTOPUS (Jarvis)' }, icon: '🧠' },
  'chat':                 { key: 'chat',                 name: { es: 'Estudio Creativo', en: 'Creative Studio' }, icon: '🎨' },
  'projects':             { key: 'projects',             name: { es: 'Mis Proyectos', en: 'My Projects' }, icon: '📁' },
  'project-builder':      { key: 'project-builder',      name: { es: 'Project Builder', en: 'Project Builder' }, icon: '🏗️' },
  'website-intelligence': { key: 'website-intelligence', name: { es: 'Web Intelligence', en: 'Web Intelligence' }, icon: '🔍' },
  'brazos':               { key: 'brazos',               name: { es: 'Brazos Activos', en: 'Active Arms' }, icon: '🦾' },
  'skill-factory':        { key: 'skill-factory',        name: { es: 'Skill Factory', en: 'Skill Factory' }, icon: '🔧' },
  'agent-factory':        { key: 'agent-factory',        name: { es: 'Agent Factory', en: 'Agent Factory' }, icon: '🤖' },
  'mcp-factory':          { key: 'mcp-factory',          name: { es: 'MCP Factory', en: 'MCP Factory' }, icon: '🔌' },
  'mcp-directory':        { key: 'mcp-directory',        name: { es: 'MCP Directory', en: 'MCP Directory' }, icon: '🔎' },
  'growth':               { key: 'growth',               name: { es: 'Growth Engine', en: 'Growth Engine' }, icon: '📈' },
  'ad-factory':           { key: 'ad-factory',           name: { es: 'Ad Factory', en: 'Ad Factory' }, icon: '📣' },
  'ugc-factory':          { key: 'ugc-factory',          name: { es: 'UGC Factory', en: 'UGC Factory' }, icon: '🎬' },
  'sales-agent':          { key: 'sales-agent',          name: { es: 'Sales Agent', en: 'Sales Agent' }, icon: '💼' },
  'calendar':             { key: 'calendar',             name: { es: 'Agenda Inteligente', en: 'Smart Calendar' }, icon: '📅' },
  'invoices':             { key: 'invoices',             name: { es: 'Facturación Express', en: 'Express Invoicing' }, icon: '🧾' },
  'social-bridge':        { key: 'social-bridge',        name: { es: 'Social Bridge', en: 'Social Bridge' }, icon: '🌉' },
  'hogar':                { key: 'hogar',                name: { es: 'Hogar Inteligente', en: 'Smart Home' }, icon: '🏠' },
  'motion-graphics':     { key: 'motion-graphics',     name: { es: 'Motion Graphics', en: 'Motion Graphics' }, icon: '✨' },
  'api-hub':              { key: 'api-hub',              name: { es: 'API Hub', en: 'API Hub' }, icon: '🔗' },
  'voice-agent':          { key: 'voice-agent',          name: { es: 'Voice Agent', en: 'Voice Agent' }, icon: '🎙️' },
  'claude-code':          { key: 'claude-code',          name: { es: 'Code Engine', en: 'Code Engine' }, icon: '🖥️' },
  'ask-octo':             { key: 'ask-octo',             name: { es: 'ASK Octo AI', en: 'ASK Octo AI' }, icon: '🐙' },
  'channels':             { key: 'channels',             name: { es: 'Hub Omnicanal', en: 'Omnichannel Hub' }, icon: '📡' },
  'canvas-templates':     { key: 'canvas-templates',     name: { es: 'Plantillas Comunidad', en: 'Community Templates' }, icon: '🧬' },
  'mcp-server':           { key: 'mcp-server',           name: { es: 'MCP Server', en: 'MCP Server' }, icon: '🔌' },
  'cockpit':              { key: 'cockpit',              name: { es: 'Cockpit Clásico', en: 'Classic Cockpit' }, icon: '📊' },
  'settings':             { key: 'settings',             name: { es: 'Configuración', en: 'Settings' }, icon: '⚙️' },
  'admin':                { key: 'admin',                name: { es: 'Admin Panel', en: 'Admin Panel' }, icon: '👑' },
  'dashboard':            { key: 'dashboard',            name: { es: 'Dashboard Principal', en: 'Main Dashboard' }, icon: '🏠' },
}

// Quick suggestions per module (bilingual)
const QUICK_SUGGESTIONS: Record<string, { es: string; en: string; icon: string }[]> = {
  jarvis: [
    { es: '¿Cómo creo una página web aquí mismo?', en: 'How do I build a website right here?', icon: '🎨' },
    { es: '¿Cómo genero imágenes?', en: 'How do I generate images?', icon: '🖼️' },
    { es: '¿Cómo creo videos UGC?', en: 'How do I create UGC videos?', icon: '🎬' },
    { es: '¿Cómo clono el diseño de otro sitio?', en: 'How do I clone another site\'s design?', icon: '🌐' },
  ],
  chat: [
    { es: '¿Cómo creo una imagen?', en: 'How do I create an image?', icon: '🎨' },
    { es: '¿Qué tipo de contenido puedo crear?', en: 'What kind of content can I create?', icon: '✨' },
  ],
  'social-bridge': [
    { es: '¿Cómo conecto LinkedIn?', en: 'How do I connect LinkedIn?', icon: '🔗' },
    { es: '¿Cómo programo posts?', en: 'How do I schedule posts?', icon: '📅' },
  ],
  'ugc-factory': [
    { es: '¿Cómo creo un avatar?', en: 'How do I create an avatar?', icon: '👤' },
    { es: '¿Cuánto tarda un video?', en: 'How long does a video take?', icon: '⏱️' },
  ],
  growth: [
    { es: '¿Cómo creo una campaña?', en: 'How do I create a campaign?', icon: '🚀' },
    { es: '¿Cómo importo leads?', en: 'How do I import leads?', icon: '📥' },
  ],
  'ad-factory': [
    { es: '¿Cómo creo un anuncio?', en: 'How do I create an ad?', icon: '📣' },
    { es: '¿Qué es Brand DNA?', en: 'What is Brand DNA?', icon: '🧬' },
  ],
  'sales-agent': [
    { es: '¿Cómo creo un agente de ventas?', en: 'How do I create a sales agent?', icon: '💼' },
    { es: '¿Cómo configuro el widget?', en: 'How do I set up the widget?', icon: '💬' },
  ],
  brazos: [
    { es: '¿Cómo conecto un servicio?', en: 'How do I connect a service?', icon: '🔌' },
    { es: '¿Qué integraciones hay?', en: 'What integrations are available?', icon: '🦾' },
  ],
  calendar: [
    { es: '¿Cómo creo un evento?', en: 'How do I create an event?', icon: '📅' },
    { es: '¿Cómo comparto mi booking link?', en: 'How do I share my booking link?', icon: '🔗' },
  ],
  invoices: [
    { es: '¿Cómo creo una factura?', en: 'How do I create an invoice?', icon: '🧾' },
    { es: '¿Cómo exporto a PDF?', en: 'How do I export to PDF?', icon: '📄' },
  ],
  'website-intelligence': [
    { es: '¿Cómo analizo un sitio web?', en: 'How do I analyze a website?', icon: '🔍' },
    { es: '¿Qué datos puedo extraer?', en: 'What data can I extract?', icon: '📊' },
  ],
  'mcp-factory': [
    { es: '¿Cómo creo un servidor MCP?', en: 'How do I create an MCP server?', icon: '🔌' },
    { es: '¿Qué es un MCP?', en: 'What is MCP?', icon: '❓' },
  ],
  'mcp-directory': [
    { es: '¿Cómo busco servidores?', en: 'How do I search servers?', icon: '🔎' },
    { es: '¿Cómo instalo un MCP?', en: 'How do I install an MCP?', icon: '📦' },
  ],
  hogar: [
    { es: '¿Cómo conecto dispositivos?', en: 'How do I connect devices?', icon: '🏠' },
    { es: '¿Qué puedo automatizar?', en: 'What can I automate?', icon: '⚡' },
  ],
  'motion-graphics': [
    { es: '¿Cómo funciona el Audio Factory?', en: 'How does Audio Factory work?', icon: '🎵' },
    { es: '¿Cómo creo una campaña completa?', en: 'How do I create a full campaign?', icon: '📢' },
    { es: '¿Qué modelos de video hay?', en: 'What video models are available?', icon: '🎬' },
  ],
  'api-hub': [
    { es: '¿Cómo conecto una API?', en: 'How do I connect an API?', icon: '🔗' },
    { es: '¿Cómo pruebo un endpoint?', en: 'How do I test an endpoint?', icon: '🧪' },
  ],
  'skill-factory': [
    { es: '¿Cómo creo un skill?', en: 'How do I create a skill?', icon: '🔧' },
    { es: '¿Qué tipos de skills hay?', en: 'What types of skills are there?', icon: '📋' },
  ],
  'agent-factory': [
    { es: '¿Cómo creo un agente?', en: 'How do I create an agent?', icon: '🤖' },
    { es: '¿Cómo le asigno skills?', en: 'How do I assign skills?', icon: '🛠️' },
  ],
  'voice-agent': [
    { es: '¿Cómo creo un voice agent?', en: 'How do I create a voice agent?', icon: '🎙️' },
    { es: '¿Qué tiers de voz hay?', en: 'What voice tiers are available?', icon: '🔊' },
  ],
  'claude-code': [
    { es: '¿Cómo publico mi sitio con Octopus Hosting?', en: 'How do I publish my site with Octopus Hosting?', icon: '🐙' },
    { es: '¿Cómo conecto un dominio personalizado?', en: 'How do I connect a custom domain?', icon: '🌐' },
    { es: '¿Cómo veo las analíticas de mi sitio?', en: 'How do I view my site analytics?', icon: '📊' },
    { es: '¿Cómo restauro una versión anterior?', en: 'How do I restore a previous version?', icon: '🔄' },
  ],
  settings: [
    { es: '¿Cómo cambio mi perfil?', en: 'How do I change my profile?', icon: '⚙️' },
    { es: '¿Cómo activo Turbo Mode?', en: 'How do I enable Turbo Mode?', icon: '⚡' },
  ],
  admin: [
    { es: '¿Cómo veo analíticas?', en: 'How do I see analytics?', icon: '📊' },
    { es: '¿Cómo gestiono usuarios?', en: 'How do I manage users?', icon: '👥' },
  ],
  projects: [
    { es: '¿Cómo creo un proyecto?', en: 'How do I create a project?', icon: '📁' },
    { es: '¿Cómo organizo mis archivos?', en: 'How do I organize my files?', icon: '🗂️' },
  ],
  dashboard: [
    { es: '¿Qué métricas veo aquí?', en: 'What metrics do I see here?', icon: '📊' },
    { es: '¿Cómo navego a un módulo?', en: 'How do I navigate to a module?', icon: '🧭' },
  ],
  channels: [
    { es: '¿Cómo conecto WhatsApp?', en: 'How do I connect WhatsApp?', icon: '💬' },
    { es: '¿Dónde pego la URL del webhook?', en: 'Where do I paste the webhook URL?', icon: '🔗' },
    { es: '¿Mis credenciales están seguras?', en: 'Are my credentials safe?', icon: '🔒' },
  ],
  'canvas-templates': [
    { es: '¿Cómo publico mi plantilla?', en: 'How do I publish my template?', icon: '🧬' },
    { es: '¿Cómo gano créditos?', en: 'How do I earn credits?', icon: '⚡' },
    { es: '¿Cómo personalizo una plantilla?', en: 'How do I customize a template?', icon: '🎨' },
  ],
  'mcp-server': [
    { es: '¿Cómo conecto Claude Code?', en: 'How do I connect Claude Code?', icon: '🔌' },
    { es: '¿Qué puede hacer desde la terminal?', en: 'What can it do from the terminal?', icon: '⌨️' },
    { es: '¿Mi token es seguro?', en: 'Is my token safe?', icon: '🔒' },
  ],
  cockpit: [
    { es: '¿Qué métricas veo aquí?', en: 'What metrics do I see here?', icon: '📊' },
    { es: '¿Qué es la salud de tentáculos?', en: 'What is tentacle health?', icon: '🐙' },
  ],
  default: [
    { es: '¿Qué puede hacer OCTOPUS?', en: 'What can OCTOPUS do?', icon: '🐙' },
    { es: '¿Cómo empiezo?', en: 'How do I get started?', icon: '🚀' },
  ]
}

// Encode AudioBuffer to WAV ArrayBuffer (16-bit PCM)
function encodeWAV(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = 1
  const sampleRate = buffer.sampleRate
  const format = 1 // PCM
  const bitsPerSample = 16
  const samples = buffer.getChannelData(0)
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign = numChannels * (bitsPerSample / 8)
  const dataSize = samples.length * (bitsPerSample / 8)
  const headerSize = 44
  const totalSize = headerSize + dataSize
  const ab = new ArrayBuffer(totalSize)
  const view = new DataView(ab)
  const writeStr = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)) }
  writeStr(0, 'RIFF'); view.setUint32(4, totalSize - 8, true); writeStr(8, 'WAVE')
  writeStr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, format, true)
  view.setUint16(22, numChannels, true); view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true); view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true); writeStr(36, 'data'); view.setUint32(40, dataSize, true)
  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
    offset += 2
  }
  return ab
}

export function OctoGuideBubble() {
  const { data: session } = useSession() || {}
  const pathname = usePathname()
  const { locale: language } = useI18n()
  
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [hasUnread, setHasUnread] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  
  const prevModuleRef = useRef<string>('default')
  
  // Get current module from URL — checks longest match first to avoid false positives
  const getCurrentModule = useCallback(() => {
    if (!pathname) return 'default'
    // Sort keys by length descending so 'mcp-factory' matches before 'mcp', etc.
    const sortedKeys = Object.keys(MODULE_MAP).sort((a, b) => b.length - a.length)
    for (const key of sortedKeys) {
      if (pathname.includes(key)) return MODULE_MAP[key].key
    }
    // If on /dashboard exactly
    if (pathname === '/dashboard' || pathname === '/dashboard/') return 'dashboard'
    return 'default'
  }, [pathname])
  
  const currentModule = getCurrentModule()
  const currentModuleInfo = Object.values(MODULE_MAP).find(m => m.key === currentModule)
  const suggestions = QUICK_SUGGESTIONS[currentModule] || QUICK_SUGGESTIONS.default
  
  // Get user's first name
  const firstName = session?.user?.name?.split(' ')[0] || 'User'

  // ============================================
  // NEW USER DETECTION — Auto-open with welcome guide
  // Detects if user is new (no localStorage flag) and shows onboarding guidance
  // ============================================
  useEffect(() => {
    if (!session?.user?.email) return
    const storageKey = `octo_welcomed_${session.user.email}`
    const alreadyWelcomed = localStorage.getItem(storageKey)
    if (alreadyWelcomed) return

    // Mark as welcomed immediately to avoid duplicate triggers
    localStorage.setItem(storageKey, new Date().toISOString())

    // Auto-open after a short delay so the page loads first
    const timer = setTimeout(() => {
      const welcomeMsg = language === 'es'
        ? `🐙 ¡Hola ${firstName}! Bienvenido a **OCTOPUS Omni Cockpit** — tu centro de comando con IA.\n\n` +
          `Soy **Octo**, tu asistente inteligente. Estoy aquí para guiarte por toda la plataforma. Aquí tienes tus primeros pasos:\n\n` +
          `1️⃣ **Pídelo en el chat** 🎨 — Escribe en la home "crea una landing para mi negocio" y tu sitio se construye EN VIVO en el panel Canvas: con verificación automática, botón Deploy a URL pública, e iteración por chat ("hazlo azul").\n\n` +
          `2️⃣ **Smart Home** 🏠 — Visita Hogar Inteligente para descargar el **Puente de Extensión Chrome**. Este puente conecta OCTOPUS con tus redes sociales, servicios externos, la Visión del Canvas y el Clonador de sitios.\n\n` +
          `3️⃣ **Plantillas Comunidad** 🧬 — Explora plantillas listas hechas por otros usuarios, ábrelas en tu Canvas con un click y personalízalas por chat.\n\n` +
          `4️⃣ **Growth Engine** 📈 — Genera leads y automatiza tu crecimiento. Y en el **Hub Omnicanal** 📡 conectas Telegram/WhatsApp/SMS para hablar con OCTOPUS desde tu teléfono.\n\n` +
          `💡 **Tip:** Puedes preguntarme lo que sea en cualquier momento — conozco CADA módulo de la plataforma.\n\n` +
          `¿Por dónde quieres empezar? 🚀`
        : `🐙 Hey ${firstName}! Welcome to **OCTOPUS Omni Cockpit** — your AI command center.\n\n` +
          `I'm **Octo**, your intelligent assistant. I'm here to guide you through the entire platform. Here are your first steps:\n\n` +
          `1️⃣ **Ask in the chat** 🎨 — Type "create a landing page for my business" on the home and your site builds LIVE in the Canvas panel: auto-verification, Deploy button to a public URL, and chat iteration ("make it blue").\n\n` +
          `2️⃣ **Smart Home** 🏠 — Visit Smart Home to download the **Chrome Extension Bridge**. This bridge connects OCTOPUS to your social media, external services, Canvas Vision, and the site Cloner.\n\n` +
          `3️⃣ **Community Templates** 🧬 — Browse ready-made templates from other users, open them in your Canvas with one click, and customize via chat.\n\n` +
          `4️⃣ **Growth Engine** 📈 — Generate leads and automate your growth. And in the **Omnichannel Hub** 📡 connect Telegram/WhatsApp/SMS to talk to OCTOPUS from your phone.\n\n` +
          `💡 **Tip:** You can ask me anything at any time — I know EVERY module on the platform.\n\n` +
          `Where would you like to start? 🚀`
      setMessages([{ role: 'assistant', content: welcomeMsg }])
      setIsOpen(true)
      setHasUnread(true)
    }, 2000)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.email])

  // Detect page/module changes and inject a system notification
  useEffect(() => {
    if (currentModule !== prevModuleRef.current && messages.length > 0) {
      const modInfo = currentModuleInfo
      if (modInfo) {
        const label = language === 'es' ? modInfo.name.es : modInfo.name.en
        const notif = language === 'es'
          ? `📍 Navegaste a **${modInfo.icon} ${label}**. ¡Pregúntame lo que necesites sobre este módulo!`
          : `📍 You navigated to **${modInfo.icon} ${label}**. Ask me anything about this module!`
        setMessages(prev => [...prev, { role: 'assistant', content: notif }])
      }
    }
    prevModuleRef.current = currentModule
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentModule])
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])
  
  // Focus input when opening
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen, isMinimized])
  
  // Clear unread when opening
  useEffect(() => {
    if (isOpen) setHasUnread(false)
  }, [isOpen])
  
  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    
    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)
    
    try {
      const res = await fetch('/api/octo-guide/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          currentPage: pathname,
          currentModule,
          sessionId,
          language
        })
      })
      
      const data = await res.json()
      
      if (data.success) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.message }])
        if (data.sessionId) setSessionId(data.sessionId)
        if (!isOpen || isMinimized) setHasUnread(true)
      } else {
        const errorMsg = language === 'es' 
          ? 'Lo siento, hubo un error. Intenta de nuevo.' 
          : 'Sorry, there was an error. Try again.'
        setMessages(prev => [...prev, { role: 'assistant', content: errorMsg }])
      }
    } catch {
      const errorMsg = language === 'es' 
        ? 'Error de conexión.' 
        : 'Connection error.'
      setMessages(prev => [...prev, { role: 'assistant', content: errorMsg }])
    } finally {
      setIsLoading(false)
    }
  }
  
  const handleQuickQuestion = (question: string) => {
    setInput(question)
    setTimeout(() => handleSend(), 50)
  }

  // Microphone toggle — record → convert to WAV → transcribe → fill input
  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      // Stop recording
      mediaRecorderRef.current?.stop()
      setIsRecording(false)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : ''

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      audioChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType })
        if (blob.size < 1000) return // too short

        setIsTranscribing(true)
        try {
          // Convert webm → WAV via AudioContext
          const arrayBuf = await blob.arrayBuffer()
          const audioCtx = new AudioContext()
          const decoded = await audioCtx.decodeAudioData(arrayBuf)
          const wavBuf = encodeWAV(decoded)
          audioCtx.close()

          // Base64 encode
          const bytes = new Uint8Array(wavBuf)
          let binary = ''
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
          const base64 = btoa(binary)

          // Call transcribe endpoint
          const res = await fetch('/api/voice-agent/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio: base64, language, format: 'wav' }),
          })
          const data = await res.json()
          if (data.transcript) {
            // Auto-send the transcribed message directly
            setInput('')
            setMessages(prev => [...prev, { role: 'user', content: data.transcript }])
            setIsLoading(true)
            try {
              const chatRes = await fetch('/api/octo-guide/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  message: data.transcript,
                  currentPage: pathname,
                  currentModule,
                  sessionId,
                  language
                })
              })
              const chatData = await chatRes.json()
              if (chatData.success) {
                setMessages(prev => [...prev, { role: 'assistant', content: chatData.message }])
                if (chatData.sessionId) setSessionId(chatData.sessionId)
              } else {
                setMessages(prev => [...prev, { role: 'assistant', content: language === 'es' ? 'Error al procesar.' : 'Processing error.' }])
              }
            } catch {
              setMessages(prev => [...prev, { role: 'assistant', content: language === 'es' ? 'Error de conexión.' : 'Connection error.' }])
            } finally {
              setIsLoading(false)
            }
          }
        } catch (err) {
          console.error('[OctoGuide STT] Error:', err)
        } finally {
          setIsTranscribing(false)
        }
      }

      mediaRecorderRef.current = recorder
      recorder.start()
      setIsRecording(true)
    } catch (err) {
      console.error('[OctoGuide STT] Mic access denied:', err)
    }
  }, [isRecording, language, pathname, currentModule, sessionId])
  
  // Don't render on login page
  if (!session?.user || pathname?.includes('login')) {
    return null
  }
  
  // Translations
  const texts = {
    greeting: language === 'es' ? `¡Hola ${firstName}!` : `Hi ${firstName}!`,
    subtitle: language === 'es' ? '¿En qué puedo ayudarte?' : 'How can I help?',
    placeholder: language === 'es' ? 'Escribe tu pregunta...' : 'Type your question...',
  }
  
  return (
    <>
      {/* Floating Bubble Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            data-tour-id="octo-guide-bubble"
            className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-br from-[#673de6] to-[#a855f7] rounded-full shadow-lg shadow-purple-500/30 flex items-center justify-center group"
          >
            {/* Pulse ring */}
            <span className="absolute inset-0 rounded-full bg-[#673de6] animate-ping opacity-20" />
            
            {/* Icon */}
            <span className="text-2xl">🐙</span>
            
            {/* Unread indicator */}
            {hasUnread && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse" />
            )}
            
            {/* Tooltip */}
            <span className="absolute right-full mr-3 px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              ASK Octo AI ✨
            </span>
          </motion.button>
        )}
      </AnimatePresence>
      
      {/* Chat Window - Small Floating Box */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ 
              opacity: 1, 
              y: 0, 
              scale: 1,
              height: isMinimized ? 'auto' : 420 
            }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-6 right-6 z-50 w-[340px] bg-[#0f172a] rounded-2xl shadow-2xl shadow-black/40 border border-white/10 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#673de6] to-[#a855f7]">
              <div className="flex items-center gap-2">
                <span className="text-xl">🐙</span>
                <div>
                  <h3 className="text-white font-semibold text-sm">ASK Octo AI</h3>
                  <p className="text-white/70 text-xs flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    {language === 'es' ? 'Tu guía inteligente' : 'Your smart guide'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <Minus className="w-4 h-4 text-white" />
                </button>
                <button
                  onClick={() => {
                    setIsOpen(false)
                    setIsMinimized(false)
                  }}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
            
            {/* Content - Collapsible */}
            <AnimatePresence>
              {!isMinimized && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="flex flex-col flex-1 overflow-hidden"
                >
                  {/* Messages Area */}
                  <div className="flex-1 overflow-y-auto p-3 max-h-[280px] min-h-[200px]">
                    {messages.length === 0 ? (
                      // Welcome State - Compact
                      <div className="text-center py-4">
                        <h4 className="text-white font-medium mb-1">{texts.greeting}</h4>
                        <p className="text-white/50 text-sm mb-4">{texts.subtitle}</p>
                        
                        {/* Quick Suggestions - Compact */}
                        <div className="space-y-1.5">
                          {suggestions.map((s, i) => (
                            <button
                              key={i}
                              onClick={() => handleQuickQuestion(language === 'es' ? s.es : s.en)}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#673de6]/50 transition-all text-left group"
                            >
                              <span className="text-sm">{s.icon}</span>
                              <span className="text-xs text-white/70 group-hover:text-white">
                                {language === 'es' ? s.es : s.en}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      // Chat Messages - Compact
                      <div className="space-y-2">
                        {messages.map((msg, i) => (
                          <div
                            key={i}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
                                msg.role === 'user'
                                  ? 'bg-[#673de6] text-white'
                                  : 'bg-white/10 text-white/90'
                              }`}
                            >
                              {msg.content}
                            </div>
                          </div>
                        ))}
                        {isLoading && (
                          <div className="flex justify-start">
                            <div className="bg-white/10 rounded-xl px-3 py-2">
                              <div className="flex gap-1">
                                <span className="w-1.5 h-1.5 bg-[#673de6] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-1.5 h-1.5 bg-[#673de6] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-1.5 h-1.5 bg-[#673de6] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                              </div>
                            </div>
                          </div>
                        )}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </div>
                  
                  {/* Input Area - Compact */}
                  <div className="border-t border-white/10 p-3">
                    {messages.length > 0 && (
                      <button
                        onClick={() => {
                          setMessages([])
                          setSessionId(null)
                        }}
                        className="text-[10px] text-white/40 hover:text-[#a855f7] mb-2 transition-colors"
                      >
                        {language === 'es' ? '↻ Nueva conversación' : '↻ New conversation'}
                      </button>
                    )}
                    <div className="flex items-center gap-1.5 bg-white/5 rounded-full px-3 py-2 border border-white/10 focus-within:border-[#673de6]/50 transition-colors">
                      <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                        placeholder={isRecording ? (language === 'es' ? '🔴 Grabando...' : '🔴 Recording...') : isTranscribing ? (language === 'es' ? '⏳ Transcribiendo...' : '⏳ Transcribing...') : texts.placeholder}
                        disabled={isRecording || isTranscribing}
                        className="flex-1 bg-transparent text-xs text-white placeholder-white/40 focus:outline-none disabled:opacity-60"
                      />
                      {/* Mic button */}
                      <button
                        onClick={toggleRecording}
                        disabled={isLoading || isTranscribing}
                        className={`p-1.5 rounded-full transition-all ${
                          isRecording
                            ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                            : isTranscribing
                              ? 'bg-yellow-500/50 cursor-wait'
                              : 'bg-white/10 hover:bg-white/20'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {isTranscribing ? (
                          <Loader2 className="w-3 h-3 text-white animate-spin" />
                        ) : isRecording ? (
                          <MicOff className="w-3 h-3 text-white" />
                        ) : (
                          <Mic className="w-3 h-3 text-white/70" />
                        )}
                      </button>
                      {/* Send button */}
                      <button
                        onClick={handleSend}
                        disabled={isLoading || !input.trim() || isRecording || isTranscribing}
                        className="p-1.5 bg-[#673de6] hover:bg-[#5025d1] disabled:opacity-50 disabled:cursor-not-allowed rounded-full transition-colors"
                      >
                        <Send className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
