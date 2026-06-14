'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'

// ═══════════════════════════════════════════════════════════════
// OCTOPUS Voice Agent Widget — Embeddable floating voice agent
// Supports 3 TTS tiers: Free (Web Speech), Pro (OpenRouter), Premium (ElevenLabs)
// ═══════════════════════════════════════════════════════════════

// MediaRecorder-based STT (replaces Web Speech API for Brave/iframe compatibility)

// Helper: encode AudioBuffer → 16-bit WAV ArrayBuffer (for transcription APIs)
function encodeWAV(audioBuffer: AudioBuffer): ArrayBuffer {
  const numChannels = 1
  const sampleRate = audioBuffer.sampleRate
  const bitsPerSample = 16
  const channelData = audioBuffer.getChannelData(0)
  const samples = channelData.length
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign = numChannels * (bitsPerSample / 8)
  const dataSize = samples * blockAlign
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)
  const w = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)) }
  w(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  w(8, 'WAVE')
  w(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  w(36, 'data')
  view.setUint32(40, dataSize, true)
  let offset = 44
  for (let i = 0; i < samples; i++) {
    const s = Math.max(-1, Math.min(1, channelData[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
    offset += 2
  }
  return buffer
}

// Extract voice ID from URL or raw ID
function parseVoiceId(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  const match = trimmed.match(/voiceId=([a-zA-Z0-9]+)/)
  if (match) return match[1]
  try {
    const url = new URL(trimmed)
    const fromParam = url.searchParams.get('voiceId')
    if (fromParam) return fromParam
  } catch { /* not a URL */ }
  if (trimmed.includes('/')) {
    const segments = trimmed.split('/').filter(Boolean)
    const last = segments[segments.length - 1]
    if (last && !last.includes('.') && !last.includes('?') && last.length > 10) return last
  }
  return trimmed
}

interface VoiceConfig {
  agentName: string
  systemPrompt: string
  model: string
  temperature: number
  ttsTier: 'free' | 'pro' | 'premium'
  ttsVoice: string
  accentColor: string
  greeting: string
  language: string
  openRouterKey?: string
  elevenLabsKey?: string
  elevenLabsVoiceId?: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const DEFAULT_CONFIG: VoiceConfig = {
  agentName: 'OCTOPUS Voice',
  systemPrompt: 'Eres un asistente de ventas amigable y profesional.',
  model: 'gpt-4.1',
  temperature: 0.7,
  ttsTier: 'free',
  ttsVoice: 'es-ES',
  accentColor: '#C4622D',
  greeting: '¡Hola! ¿En qué puedo ayudarte hoy?',
  language: 'es',
}

export default function VoiceWidgetPage() {
  const params = useParams()
  const agentId = params?.id as string
  const [config, setConfig] = useState<VoiceConfig>(DEFAULT_CONFIG)
  const [isOpen, setIsOpen] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [transcript, setTranscript] = useState('')
  const [currentResponse, setCurrentResponse] = useState('')
  const [waveAmplitude, setWaveAmplitude] = useState(0)
  const [textInput, setTextInput] = useState('')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const animFrameRef = useRef<number>(0)

  // Make widget background transparent (override root layout body bg)
  useEffect(() => {
    document.body.style.background = 'transparent'
    document.body.style.backgroundColor = 'transparent'
    document.documentElement.style.background = 'transparent'
    document.documentElement.style.backgroundColor = 'transparent'
    return () => {
      document.body.style.background = ''
      document.body.style.backgroundColor = ''
      document.documentElement.style.background = ''
      document.documentElement.style.backgroundColor = ''
    }
  }, [])

  // Load config from localStorage (set by parent page)
  useEffect(() => {
    if (!agentId) return
    try {
      const stored = localStorage.getItem(`voice-agent-config-${agentId}`)
      if (stored) {
        setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(stored) })
      }
    } catch { /* use defaults */ }
  }, [agentId])

  // Pre-load speech synthesis voices (fixes empty getVoices on first call in Brave/Chrome)
  const voicesReadyRef = useRef(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    const loadVoices = () => { window.speechSynthesis.getVoices(); voicesReadyRef.current = true }
    loadVoices()
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
  }, [])

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentResponse])

  // Wave animation
  useEffect(() => {
    if (isListening || isSpeaking) {
      const animate = () => {
        setWaveAmplitude(Math.random() * 0.5 + 0.5)
        animFrameRef.current = requestAnimationFrame(animate)
      }
      animFrameRef.current = requestAnimationFrame(animate)
    } else {
      cancelAnimationFrame(animFrameRef.current)
      setWaveAmplitude(0)
    }
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [isListening, isSpeaking])

  // ═══ TTS: Speak text ═══
  const speak = useCallback(async (text: string) => {
    if (!text.trim()) return
    setIsSpeaking(true)

    try {
      if (config.ttsTier === 'free') {
        // Web Speech API (free) with Chrome/Brave workaround
        return new Promise<void>((resolve) => {
          window.speechSynthesis.cancel()
          const utterance = new SpeechSynthesisUtterance(text)
          utterance.lang = config.language === 'en' ? 'en-US' : 'es-ES'
          utterance.rate = 1.0
          utterance.pitch = 1.0
          
          // Try to find a good voice
          const voices = window.speechSynthesis.getVoices()
          const preferred = voices.find(v => 
            v.lang.startsWith(config.language === 'en' ? 'en' : 'es') && 
            (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Premium'))
          ) || voices.find(v => v.lang.startsWith(config.language === 'en' ? 'en' : 'es'))
          if (preferred) utterance.voice = preferred

          // Chrome/Brave bug workaround: speech stops after ~15s
          // Keep-alive timer that pauses/resumes to prevent timeout
          let keepAlive: ReturnType<typeof setInterval> | null = null
          const startKeepAlive = () => {
            keepAlive = setInterval(() => {
              if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
                window.speechSynthesis.pause()
                window.speechSynthesis.resume()
              }
            }, 10000)
          }
          const stopKeepAlive = () => { if (keepAlive) clearInterval(keepAlive) }
          
          utterance.onstart = () => startKeepAlive()
          utterance.onend = () => { stopKeepAlive(); setIsSpeaking(false); resolve() }
          utterance.onerror = (e) => { 
            console.warn('Free TTS error:', e.error)
            stopKeepAlive(); setIsSpeaking(false); resolve() 
          }
          synthRef.current = utterance
          window.speechSynthesis.speak(utterance)
        })
      } else if (config.ttsTier === 'pro' && config.openRouterKey) {
        // OpenRouter TTS (pro) — streaming audio via SSE
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.openRouterKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'openai/gpt-audio-mini',
            messages: [{ role: 'user', content: text }],
            modalities: ['text', 'audio'],
            audio: { voice: config.ttsVoice || 'coral', format: 'pcm16' },
            stream: true,
          }),
        })

        if (!response.ok) {
          const errText = await response.text().catch(() => 'unknown')
          console.error('Pro TTS API error:', response.status, errText)
        }
        if (response.ok && response.body) {
          const reader = response.body.getReader()
          const decoder = new TextDecoder()
          let audioChunks: string[] = []
          let buffer = ''

          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''
            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed.startsWith('data: ') || trimmed === 'data: [DONE]') continue
              try {
                const json = JSON.parse(trimmed.slice(6))
                const audioData = json.choices?.[0]?.delta?.audio?.data
                if (audioData) audioChunks.push(audioData)
              } catch { /* skip non-JSON lines */ }
            }
          }

          if (audioChunks.length > 0) {
            // Decode base64 PCM16 chunks into raw bytes
            const fullBase64 = audioChunks.join('')
            const byteString = atob(fullBase64)
            const pcmBytes = new Uint8Array(byteString.length)
            for (let i = 0; i < byteString.length; i++) pcmBytes[i] = byteString.charCodeAt(i)

            // Wrap raw PCM16 in a WAV header so the browser can play it
            const sampleRate = 24000  // OpenAI audio models output 24kHz
            const numChannels = 1
            const bitsPerSample = 16
            const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
            const blockAlign = numChannels * (bitsPerSample / 8)
            const wavHeader = new ArrayBuffer(44)
            const view = new DataView(wavHeader)
            const writeStr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)) }
            writeStr(0, 'RIFF')
            view.setUint32(4, 36 + pcmBytes.length, true)
            writeStr(8, 'WAVE')
            writeStr(12, 'fmt ')
            view.setUint32(16, 16, true)
            view.setUint16(20, 1, true) // PCM
            view.setUint16(22, numChannels, true)
            view.setUint32(24, sampleRate, true)
            view.setUint32(28, byteRate, true)
            view.setUint16(32, blockAlign, true)
            view.setUint16(34, bitsPerSample, true)
            writeStr(36, 'data')
            view.setUint32(40, pcmBytes.length, true)

            const wavBlob = new Blob([wavHeader, pcmBytes], { type: 'audio/wav' })
            const url = URL.createObjectURL(wavBlob)
            const audio = new Audio(url)
            audioRef.current = audio
            audio.onended = () => { setIsSpeaking(false); URL.revokeObjectURL(url) }
            audio.onerror = () => { setIsSpeaking(false); URL.revokeObjectURL(url) }
            await audio.play()
            return
          }
        }
        // Fallback if pro fails
        console.warn('Pro TTS: no audio received, falling back')
        setIsSpeaking(false)
      } else if (config.ttsTier === 'premium') {
        // ElevenLabs (premium) — use server-side proxy OR direct API
        const voiceId = config.elevenLabsVoiceId ? parseVoiceId(config.elevenLabsVoiceId) : ''
        
        let response: Response
        if (config.elevenLabsKey) {
          // Direct call (authenticated user in dashboard)
          response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: {
              'xi-api-key': config.elevenLabsKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              text,
              model_id: 'eleven_multilingual_v2',
              voice_settings: { stability: 0.5, similarity_boost: 0.8 },
            }),
          })
        } else {
          // Server-side proxy (public widget, no keys exposed)
          response = await fetch('/api/voice-agent/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, voiceId }),
          })
        }
        
        if (response.ok) {
          const blob = await response.blob()
          const url = URL.createObjectURL(blob)
          const audio = new Audio(url)
          audioRef.current = audio
          audio.onended = () => { setIsSpeaking(false); URL.revokeObjectURL(url) }
          audio.onerror = () => { setIsSpeaking(false); URL.revokeObjectURL(url) }
          await audio.play()
          return
        } else {
          console.warn('[TTS Premium] Error:', response.status, '- falling back to Web Speech')
          // Fallback to free TTS
          return new Promise<void>((resolve) => {
            window.speechSynthesis.cancel()
            const utterance = new SpeechSynthesisUtterance(text)
            utterance.lang = config.language === 'en' ? 'en-US' : 'es-ES'
            utterance.onend = () => { setIsSpeaking(false); resolve() }
            utterance.onerror = () => { setIsSpeaking(false); resolve() }
            synthRef.current = utterance
            window.speechSynthesis.speak(utterance)
          })
        }
      } else {
        setIsSpeaking(false)
      }
    } catch (err) {
      console.error('TTS Error:', err)
      setIsSpeaking(false)
    }
  }, [config])

  // ═══ Send message to agent brain ═══
  const sendMessage = useCallback(async (userText: string) => {
    if (!userText.trim()) return
    setIsProcessing(true)
    setCurrentResponse('')

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: userText }]
    setMessages(newMessages)

    try {
      const response = await fetch('/api/voice-agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.slice(-10), // Last 10 for context
          systemPrompt: config.systemPrompt,
          model: config.model,
          temperature: config.temperature,
          agentName: config.agentName,
          language: config.language || 'es',
        }),
      })

      if (!response.ok || !response.body) throw new Error('Chat API error')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullResponse = ''

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
              const content = parsed.choices?.[0]?.delta?.content || ''
              fullResponse += content
              setCurrentResponse(fullResponse)
            } catch { /* skip */ }
          }
        }
      }

      setMessages(prev => [...prev, { role: 'assistant', content: fullResponse }])
      setCurrentResponse('')
      setIsProcessing(false)

      // Speak the response
      if (fullResponse.trim()) {
        console.log('[Voice Agent] Response received, speaking with', config.ttsTier, 'tier...', fullResponse.substring(0, 80))
        await speak(fullResponse)
      } else {
        console.warn('[Voice Agent] Empty response received, skipping TTS')
      }
    } catch (err) {
      console.error('Voice agent error:', err)
      setIsProcessing(false)
      setCurrentResponse('')
    }
  }, [messages, config, speak])

  // ═══ STT: MediaRecorder-based (works in Brave + iframes) ═══
  const startListening = useCallback(async () => {
    // Stop speaking if currently speaking
    window.speechSynthesis.cancel()
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    setIsSpeaking(false)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : ''
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)
      audioChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setIsListening(false)

        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        if (audioBlob.size < 500) {
          console.warn('[STT] Recording too short, ignoring')
          setTranscript('')
          return
        }

        setTranscript('🔄 Transcribiendo...')
        console.log('[STT] Converting webm to wav for transcription, size:', audioBlob.size)

        try {
          // Convert webm → WAV using AudioContext (browser-native, works everywhere)
          const arrayBuffer = await audioBlob.arrayBuffer()
          const audioCtx = new AudioContext({ sampleRate: 16000 })
          const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
          
          // Encode as 16-bit WAV
          const wavData = encodeWAV(audioBuffer)
          const wavBytes = new Uint8Array(wavData)
          let binary = ''
          const chunkSize = 8192
          for (let i = 0; i < wavBytes.length; i += chunkSize) {
            binary += String.fromCharCode.apply(null, Array.from(wavBytes.slice(i, i + chunkSize)))
          }
          const base64 = btoa(binary)
          console.log('[STT] WAV encoded, size:', wavBytes.length, 'sending...')

          const res = await fetch('/api/voice-agent/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audio: base64,
              format: 'wav',
              language: config.language,
              openRouterKey: config.openRouterKey || undefined,
            }),
          })

          if (res.ok) {
            const data = await res.json()
            const text = data.transcript?.trim()
            if (text) {
              console.log('[STT] Transcript:', text)
              setTranscript('')
              sendMessage(text)
            } else {
              console.warn('[STT] Empty transcript received')
              setTranscript('')
              setMessages(prev => [...prev, {
                role: 'assistant',
                content: '🎤 No pude entender lo que dijiste. Intenta de nuevo o escribe tu mensaje.',
              }])
            }
          } else {
            console.error('[STT] Transcription API error:', res.status)
            setTranscript('')
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: '⚠️ Error al transcribir. Usa el campo de texto mientras tanto.',
            }])
          }
        } catch (err) {
          console.error('[STT] Transcription error:', err)
          setTranscript('')
        }
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      setIsListening(true)
      setTranscript('')
      console.log('[STT] Recording started with', recorder.mimeType)
    } catch (err) {
      console.error('[STT] Mic access error:', err)
      setIsListening(false)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '⚠️ No se pudo acceder al micrófono. Verifica los permisos del navegador o usa el campo de texto.',
      }])
    }
  }, [config.language, config.openRouterKey, sendMessage])

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  // ═══ Open widget + play greeting ═══
  const openWidget = useCallback(() => {
    setIsOpen(true)
    if (messages.length === 0 && config.greeting) {
      setMessages([{ role: 'assistant', content: config.greeting }])
      setTimeout(() => speak(config.greeting), 500)
    }
  }, [messages.length, config.greeting, speak])

  const accentColor = config.accentColor || '#C4622D'

  return (
    <div style={{ position: 'fixed', bottom: 0, right: 0, zIndex: 99999, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Floating Bubble */}
      {!isOpen && (
        <button
          onClick={openWidget}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`,
            border: 'none',
            cursor: 'pointer',
            boxShadow: `0 4px 20px ${accentColor}66`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={e => { (e.target as HTMLElement).style.transform = 'scale(1.1)' }}
          onMouseLeave={e => { (e.target as HTMLElement).style.transform = 'scale(1)' }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
          {/* Pulse ring */}
          <span style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            border: `2px solid ${accentColor}`,
            animation: 'pulse-ring 2s ease-out infinite',
          }} />
        </button>
      )}

      {/* Widget Panel */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '380px',
          maxHeight: '600px',
          background: '#0a0f1a',
          borderRadius: '20px',
          boxShadow: `0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px ${accentColor}33`,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideUp 0.3s ease',
        }}>
          {/* Header */}
          <div style={{
            padding: '16px 20px',
            background: `linear-gradient(135deg, ${accentColor}22, ${accentColor}11)`,
            borderBottom: `1px solid ${accentColor}33`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: `linear-gradient(135deg, ${accentColor}, ${accentColor}bb)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <span style={{ fontSize: '20px' }}>🐙</span>
              </div>
              <div>
                <div style={{ color: 'white', fontWeight: 600, fontSize: '15px' }}>{config.agentName}</div>
                <div style={{ color: `${accentColor}cc`, fontSize: '12px' }}>
                  {isSpeaking ? '🔊 Hablando...' : isListening ? '🎤 Escuchando...' : isProcessing ? '🤔 Pensando...' : '● En línea'}
                </div>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: 'white',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>✕</button>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            maxHeight: '360px',
          }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth: '80%',
                  padding: '10px 14px',
                  borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: msg.role === 'user' ? accentColor : 'rgba(255,255,255,0.08)',
                  color: 'white',
                  fontSize: '14px',
                  lineHeight: '1.5',
                }}>{msg.content}</div>
              </div>
            ))}
            {currentResponse && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  maxWidth: '80%',
                  padding: '10px 14px',
                  borderRadius: '16px 16px 16px 4px',
                  background: 'rgba(255,255,255,0.08)',
                  color: 'white',
                  fontSize: '14px',
                  lineHeight: '1.5',
                }}>{currentResponse}<span style={{ animation: 'blink 1s infinite' }}>▊</span></div>
              </div>
            )}
            {transcript && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{
                  maxWidth: '80%',
                  padding: '10px 14px',
                  borderRadius: '16px 16px 4px 16px',
                  background: `${accentColor}66`,
                  color: 'white',
                  fontSize: '14px',
                  fontStyle: 'italic',
                  lineHeight: '1.5',
                }}>{transcript}...</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Voice Visualizer + Controls */}
          <div style={{
            padding: '16px 20px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.02)',
          }}>
            {/* Wave Visualizer */}
            {(isListening || isSpeaking) && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
                height: '40px',
                marginBottom: '12px',
              }}>
                {Array.from({ length: 20 }).map((_, i) => (
                  <div key={i} style={{
                    width: '3px',
                    borderRadius: '2px',
                    background: isListening ? '#22c55e' : accentColor,
                    height: `${Math.max(4, Math.random() * 32 * waveAmplitude)}px`,
                    transition: 'height 0.1s ease',
                  }} />
                ))}
              </div>
            )}

            {/* Text Input + Controls */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '0 4px' }}>
              {/* Text input field */}
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (textInput.trim() && !isProcessing) {
                    sendMessage(textInput.trim())
                    setTextInput('')
                  }
                }}
                style={{ flex: 1, display: 'flex', gap: '6px' }}
              >
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={isListening ? '🎤 Escuchando...' : 'Escribe un mensaje...'}
                  disabled={isProcessing || isListening}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '24px',
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(255,255,255,0.08)',
                    color: 'white',
                    fontSize: '13px',
                    outline: 'none',
                    opacity: isProcessing ? 0.6 : 1,
                  }}
                />
                <button
                  type="submit"
                  disabled={!textInput.trim() || isProcessing}
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    border: 'none',
                    cursor: textInput.trim() && !isProcessing ? 'pointer' : 'not-allowed',
                    background: textInput.trim() ? accentColor : 'rgba(255,255,255,0.1)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                    opacity: textInput.trim() && !isProcessing ? 1 : 0.4,
                    flexShrink: 0,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
              </form>

              {/* Mic Button */}
              <button
                onClick={isListening ? stopListening : startListening}
                disabled={isProcessing}
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  border: 'none',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  background: isListening 
                    ? 'linear-gradient(135deg, #ef4444, #dc2626)' 
                    : `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease',
                  boxShadow: isListening 
                    ? '0 0 20px rgba(239,68,68,0.4)' 
                    : `0 4px 12px ${accentColor}44`,
                  opacity: isProcessing ? 0.6 : 1,
                  flexShrink: 0,
                }}
              >
                {isListening ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
                )}
              </button>

              {/* Stop speaking */}
              {isSpeaking && (
                <button
                  onClick={() => {
                    window.speechSynthesis.cancel()
                    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
                    setIsSpeaking(false)
                  }}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(255,255,255,0.1)',
                    cursor: 'pointer',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4zM23 9l-6 6M17 9l6 6"/></svg>
                </button>
              )}
            </div>

            {/* TTS Tier Badge */}
            <div style={{
              textAlign: 'center',
              marginTop: '10px',
              fontSize: '10px',
              color: 'rgba(255,255,255,0.3)',
              letterSpacing: '0.5px',
            }}>
              {config.ttsTier === 'free' ? '🔊 Web Speech' : config.ttsTier === 'pro' ? '⚡ OpenRouter Pro' : '✨ ElevenLabs Premium'}
              {' · '}
              Powered by OCTOPUS 🐙
            </div>
          </div>
        </div>
      )}

      {/* Global Styles */}
      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes slideUp {
          0% { transform: translateY(20px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}