'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSession } from 'next-auth/react'
import { Mic, Volume2, Play, Square, Copy, Check, Plus, Trash2, Settings, Eye, Code, Zap, Crown, Globe, MessageSquare, Wand2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n-context'

interface VoiceAgentConfig {
  id: string
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
  isActive: boolean
  createdAt: string
}

const TTS_TIERS = [
  {
    id: 'free' as const,
    name: 'Free',
    icon: Globe,
    description: 'Web Speech API — Gratis, funciona en Chrome/Edge/Safari',
    price: '$0',
    features: ['Sin costo', 'Voces del navegador', 'Multilingüe básico', 'Sin API key'],
    color: '#22c55e',
  },
  {
    id: 'pro' as const,
    name: 'Pro',
    icon: Zap,
    description: 'OpenRouter — Voces de alta calidad a bajo costo',
    price: '~$0.015/min',
    features: ['13 voces premium', 'Calidad natural', 'Streaming', 'Requiere OpenRouter key'],
    color: '#f59e0b',
  },
  {
    id: 'premium' as const,
    name: 'Premium',
    icon: Crown,
    description: 'ElevenLabs — Voces ultra-realistas, clonación de voz',
    price: '~$0.18/min',
    features: ['Voces ultra-realistas', 'Clonación de voz', '29 idiomas', 'Requiere ElevenLabs key'],
    color: '#a855f7',
  },
]

const ACCENT_COLORS = [
  '#C4622D', '#2D4A3E', '#4A90D9', '#9B59B6', '#1ABC9C',
  '#E74C3C', '#F39C12', '#3498DB', '#e91e63', '#00bcd4',
]

const OPENROUTER_VOICES = [
  'alloy', 'ash', 'ballad', 'coral', 'echo', 'fable',
  'nova', 'onyx', 'sage', 'shimmer', 'verse', 'marin', 'cedar',
]

const MODELS = [
  { id: 'gpt-4.1', name: 'GPT-4.1' },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' },
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
  { id: 'kimi-k2', name: 'Kimi K2' },
  { id: 'qwen-max', name: 'Qwen Max' },
]

export default function VoiceAgentPage() {
  const { data: session } = useSession() || {}
  const { t, locale } = useI18n()
  const [agents, setAgents] = useState<VoiceAgentConfig[]>([])
  const [selectedAgent, setSelectedAgent] = useState<VoiceAgentConfig | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPrompt, setNewPrompt] = useState('')
  const [newGreeting, setNewGreeting] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'config' | 'voice' | 'embed'>('config')
  const [isTesting, setIsTesting] = useState(false)
  const [testResponse, setTestResponse] = useState('')
  const [loading, setLoading] = useState(true)

  // Fetch agents from API
  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/voice-agent')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setAgents(data)
      // Clean up any leftover localStorage data (migration period over)
      localStorage.removeItem('octopus-voice-agents')
      return data as VoiceAgentConfig[]
    } catch (err) {
      console.error('Error fetching voice agents:', err)
      return [] as VoiceAgentConfig[]
    }
  }, [])

  // Initial load
  useEffect(() => {
    let cancelled = false
    async function init() {
      await fetchAgents()
      if (!cancelled) {
        setLoading(false)
      }
    }
    init()
    return () => { cancelled = true }
  }, [fetchAgents])

  const openCreateModal = useCallback(() => {
    setNewName('')
    setNewPrompt('')
    setNewGreeting('')
    setShowCreateModal(true)
  }, [])

  const createAgent = useCallback(async () => {
    if (!newName.trim()) return
    try {
      const res = await fetch('/api/voice-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentName: newName.trim(),
          systemPrompt: newPrompt.trim() || 'Eres un asistente virtual útil y amigable.',
          greeting: newGreeting.trim() || '¡Hola! ¿En qué puedo ayudarte hoy?',
        }),
      })
      if (!res.ok) throw new Error('Failed to create')
      const newAgent = await res.json()
      setAgents(prev => [newAgent, ...prev])
      setSelectedAgent(newAgent)
      setShowCreateModal(false)
      setActiveTab('config')
    } catch (err) {
      console.error('Error creating voice agent:', err)
    }
  }, [newName, newPrompt, newGreeting])

  // Debounced update to API
  const saveTimeout = useRef<NodeJS.Timeout | null>(null)
  const updateAgent = useCallback((field: string, value: string | number | boolean) => {
    if (!selectedAgent) return
    const updated = { ...selectedAgent, [field]: value }
    setSelectedAgent(updated)
    setAgents(prev => prev.map(a => a.id === updated.id ? updated : a))

    // Debounce API call
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(async () => {
      try {
        await fetch(`/api/voice-agent/${updated.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: value }),
        })
      } catch (err) {
        console.error('Error saving voice agent:', err)
      }
    }, 500)
  }, [selectedAgent])

  const deleteAgent = useCallback(async (id: string) => {
    try {
      await fetch(`/api/voice-agent/${id}`, { method: 'DELETE' })
      setAgents(prev => prev.filter(a => a.id !== id))
      if (selectedAgent?.id === id) setSelectedAgent(null)
    } catch (err) {
      console.error('Error deleting voice agent:', err)
    }
  }, [selectedAgent])

  // Extract voice ID from URL or raw ID
  const parseVoiceId = useCallback((input: string): string => {
    const trimmed = input.trim()
    if (!trimmed) return ''
    const voiceIdMatch = trimmed.match(/voiceId=([a-zA-Z0-9]+)/)
    if (voiceIdMatch) return voiceIdMatch[1]
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
  }, [])

  const copyEmbedCode = useCallback(() => {
    if (!selectedAgent) return
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const configObj = {
      agentName: selectedAgent.agentName,
      systemPrompt: selectedAgent.systemPrompt,
      model: selectedAgent.model,
      temperature: selectedAgent.temperature,
      ttsTier: selectedAgent.ttsTier,
      ttsVoice: selectedAgent.ttsVoice,
      accentColor: selectedAgent.accentColor,
      greeting: selectedAgent.greeting,
      language: selectedAgent.language,
      openRouterKey: selectedAgent.openRouterKey || '',
      elevenLabsKey: selectedAgent.elevenLabsKey || '',
      elevenLabsVoiceId: selectedAgent.elevenLabsVoiceId || '',
    }
    const code = `<!-- OCTOPUS Voice Agent Widget -->\n<script>\n(function(){\n  var c=${JSON.stringify(configObj)};\n  localStorage.setItem('voice-agent-config-${selectedAgent.id}',JSON.stringify(c));\n  var i=document.createElement('iframe');\n  i.src='${baseUrl}/widget/voice/${selectedAgent.id}';\n  i.style.cssText='position:fixed;bottom:0;right:0;width:420px;height:660px;border:none;z-index:99999;background:transparent;';\n  i.allow='microphone';\n  document.body.appendChild(i);\n})();\n</script>`
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [selectedAgent])

  const getTestMessage = useCallback((lang: string) => {
    switch (lang) {
      case 'en': return 'Hello! What services do you offer?'
      case 'pt': return 'Olá! Quais serviços vocês oferecem?'
      case 'fr': return 'Bonjour ! Quels services proposez-vous ?'
      default: return '¡Hola! ¿Qué servicios ofrecen?'
    }
  }, [])

  const getLangCode = useCallback((lang: string) => {
    switch (lang) {
      case 'en': return 'en-US'
      case 'pt': return 'pt-BR'
      case 'fr': return 'fr-FR'
      default: return 'es-ES'
    }
  }, [])

  const testVoice = useCallback(async () => {
    if (!selectedAgent) return
    setIsTesting(true)
    setTestResponse('')
    try {
      const res = await fetch('/api/voice-agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: getTestMessage(selectedAgent.language) }],
          systemPrompt: selectedAgent.systemPrompt,
          model: selectedAgent.model,
          temperature: selectedAgent.temperature,
          language: selectedAgent.language,
        }),
      })
      if (!res.ok || !res.body) throw new Error('API error')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              full += parsed.choices?.[0]?.delta?.content || ''
              setTestResponse(full)
            } catch { /* skip */ }
          }
        }
      }
      if (full && selectedAgent.ttsTier === 'free') {
        const utterance = new SpeechSynthesisUtterance(full)
        utterance.lang = getLangCode(selectedAgent.language)
        utterance.onend = () => setIsTesting(false)
        window.speechSynthesis.speak(utterance)
      } else {
        setIsTesting(false)
      }
    } catch {
      setTestResponse('Error al probar el agente')
      setIsTesting(false)
    }
  }, [selectedAgent, getTestMessage, getLangCode])

  const [previewingVoice, setPreviewingVoice] = useState(false)
  const [previewError, setPreviewError] = useState('')

  const previewVoice = useCallback(async () => {
    if (!selectedAgent) return
    setPreviewingVoice(true)
    setPreviewError('')
    
    const sampleTexts: Record<string, string> = {
      es: 'Hola, soy tu asistente virtual de Octopus Skills. ¿En qué puedo ayudarte hoy?',
      en: 'Hi, I\'m your Octopus Skills virtual assistant. How can I help you today?',
      pt: 'Olá, sou seu assistente virtual da Octopus Skills. Como posso ajudá-lo hoje?',
      fr: 'Bonjour, je suis votre assistant virtuel Octopus Skills. Comment puis-je vous aider ?',
    }
    const sampleText = sampleTexts[selectedAgent.language] || sampleTexts.es

    try {
      if (selectedAgent.ttsTier === 'free') {
        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(sampleText)
        utterance.lang = getLangCode(selectedAgent.language)
        utterance.onend = () => setPreviewingVoice(false)
        utterance.onerror = () => { setPreviewingVoice(false); setPreviewError('Error de síntesis de voz') }
        window.speechSynthesis.speak(utterance)
      } else if (selectedAgent.ttsTier === 'premium' && selectedAgent.elevenLabsKey && selectedAgent.elevenLabsVoiceId) {
        const voiceId = parseVoiceId(selectedAgent.elevenLabsVoiceId)
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': selectedAgent.elevenLabsKey,
          },
          body: JSON.stringify({
            text: sampleText,
            model_id: 'eleven_multilingual_v2',
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          }),
        })
        if (!res.ok) {
          const err = await res.text().catch(() => 'Unknown error')
          throw new Error(`ElevenLabs API error: ${err}`)
        }
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        audio.onended = () => { setPreviewingVoice(false); URL.revokeObjectURL(url) }
        audio.onerror = () => { setPreviewingVoice(false); setPreviewError('Error reproduciendo audio') }
        audio.play()
      } else if (selectedAgent.ttsTier === 'pro') {
        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(sampleText)
        utterance.lang = getLangCode(selectedAgent.language)
        utterance.onend = () => setPreviewingVoice(false)
        window.speechSynthesis.speak(utterance)
      } else {
        setPreviewError(selectedAgent.ttsTier === 'premium' ? 'Ingresa tu API Key y Voice ID primero' : 'Configura la voz primero')
        setPreviewingVoice(false)
      }
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Error al previsualizar la voz')
      setPreviewingVoice(false)
    }
  }, [selectedAgent, getLangCode, parseVoiceId])

  return (
    <div className="min-h-screen p-6 bg-[#080d19]">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <span className="text-4xl">🎙️</span>
              {t('voiceAgent.title')}
            </h1>
            <p className="text-[#C4622D]/80 mt-1 font-medium">{t('voiceAgent.subtitle')}</p>
          </div>
          <Button onClick={() => openCreateModal()} className="gap-2">
            <Plus className="w-4 h-4" /> {t('voiceAgent.createAgent')}
          </Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Agent List */}
        <div className="lg:col-span-4">
          <Card className="bg-[#0d1321] border-white/10 p-4">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Mic className="w-4 h-4 text-[#C4622D]" />
              {t('voiceAgent.myAgents')}
            </h3>
            {loading ? (
              <div className="text-center py-12 text-white/60">
                <div className="w-8 h-8 border-2 border-[#C4622D]/30 border-t-[#C4622D] rounded-full animate-spin mx-auto mb-3" />
                <p>{locale === 'en' ? 'Loading agents...' : 'Cargando agentes...'}</p>
              </div>
            ) : agents.length === 0 ? (
              <div className="text-center py-12 text-white/60">
                <Mic className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>{t('voiceAgent.noAgents')}</p>
                <Button onClick={() => openCreateModal()} variant="outline" className="mt-4 text-sm">
                  <Plus className="w-3 h-3 mr-1" /> {t('voiceAgent.createFirst')}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {agents.map(agent => (
                  <motion.div
                    key={agent.id}
                    whileHover={{ scale: 1.02 }}
                    onClick={() => { setSelectedAgent(agent); setActiveTab('config') }}
                    className={`p-4 rounded-xl cursor-pointer transition-all border ${
                      selectedAgent?.id === agent.id
                        ? 'border-[#C4622D]/50 bg-[#C4622D]/10'
                        : 'border-white/5 bg-white/5 hover:border-white/15'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg" style={{ background: `${agent.accentColor}22` }}>🎙️</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium truncate">{agent.agentName}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            agent.ttsTier === 'free' ? 'bg-green-500/20 text-green-400' :
                            agent.ttsTier === 'pro' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-purple-500/20 text-purple-400'
                          }`}>
                            {agent.ttsTier === 'free' ? '🔊 Free' : agent.ttsTier === 'pro' ? '⚡ Pro' : '✨ Premium'}
                          </span>
                          <span className={`w-2 h-2 rounded-full ${agent.isActive ? 'bg-green-400' : 'bg-red-400'}`} />
                        </div>
                      </div>
                      <button onClick={e => { e.stopPropagation(); deleteAgent(agent.id) }} className="p-1.5 rounded-lg hover:bg-red-500/20 text-white/50 hover:text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Config Panel */}
        <div className="lg:col-span-8">
          {!selectedAgent ? (
            <Card className="bg-[#0d1321] border-white/10 p-12 text-center">
              <Mic className="w-16 h-16 mx-auto mb-4 text-white/40" />
              <h3 className="text-xl text-white/90 font-semibold">{t('voiceAgent.selectAgent')}</h3>
              <p className="text-white/60 mt-2">{t('voiceAgent.selectAgentSub')}</p>
            </Card>
          ) : (
            <Card className="bg-[#0d1321] border-white/10 overflow-hidden">
              {/* Tabs */}
              <div className="flex border-b border-white/10">
                {[
                  { id: 'config' as const, icon: Settings, label: t('voiceAgent.tabConfig') },
                  { id: 'voice' as const, icon: Volume2, label: t('voiceAgent.tabVoice') },
                  { id: 'embed' as const, icon: Code, label: t('voiceAgent.tabEmbed') },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 text-sm font-medium transition-all ${
                      activeTab === tab.id
                        ? 'text-[#C4622D] border-b-2 border-[#C4622D] bg-[#C4622D]/5'
                        : 'text-white/70 hover:text-white/80'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" /> {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-6">
                {/* CONFIG TAB */}
                {activeTab === 'config' && (
                  <div className="space-y-6">
                    <div>
                      <label className="text-white/90 text-sm font-medium mb-2 block">{t('voiceAgent.agentName')}</label>
                      <input value={selectedAgent.agentName} onChange={e => updateAgent('agentName', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#C4622D]/50 focus:outline-none transition-colors" />
                    </div>
                    <div>
                      <label className="text-white/90 text-sm font-medium mb-2 block">{t('voiceAgent.systemPrompt')}</label>
                      <textarea value={selectedAgent.systemPrompt} onChange={e => updateAgent('systemPrompt', e.target.value)} rows={5} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#C4622D]/50 focus:outline-none transition-colors resize-none" />
                    </div>
                    <div>
                      <label className="text-white/90 text-sm font-medium mb-2 block">{t('voiceAgent.greeting')}</label>
                      <input value={selectedAgent.greeting} onChange={e => updateAgent('greeting', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#C4622D]/50 focus:outline-none transition-colors" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-white/90 text-sm font-medium mb-2 block">{t('voiceAgent.model')}</label>
                        <select value={selectedAgent.model} onChange={e => updateAgent('model', e.target.value)} className="w-full bg-[#0d1321] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#C4622D]/50 focus:outline-none" style={{ colorScheme: 'dark' }}>
                          {MODELS.map(m => <option key={m.id} value={m.id} className="bg-[#0d1321] text-white">{m.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-white/90 text-sm font-medium mb-2 block">{t('voiceAgent.language')}</label>
                        <select value={selectedAgent.language} onChange={e => updateAgent('language', e.target.value)} className="w-full bg-[#0d1321] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#C4622D]/50 focus:outline-none" style={{ colorScheme: 'dark' }}>
                          <option value="es" className="bg-[#0d1321] text-white">Español</option>
                          <option value="en" className="bg-[#0d1321] text-white">English</option>
                          <option value="pt" className="bg-[#0d1321] text-white">Português</option>
                          <option value="fr" className="bg-[#0d1321] text-white">Français</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-white/90 text-sm font-medium mb-2 block">{t('voiceAgent.accentColor')}</label>
                      <div className="flex gap-3">
                        {ACCENT_COLORS.map(color => (
                          <button key={color} onClick={() => updateAgent('accentColor', color)} className={`w-8 h-8 rounded-full transition-all ${selectedAgent.accentColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0d1321] scale-110' : 'hover:scale-110'}`} style={{ background: color }} />
                        ))}
                      </div>
                    </div>
                    <div className="pt-2">
                      <Button onClick={testVoice} disabled={isTesting} className="gap-2">
                        {isTesting ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        {isTesting ? t('voiceAgent.testing') : t('voiceAgent.testAgent')}
                      </Button>
                      {testResponse && (
                        <div className="mt-3 p-3 rounded-lg bg-white/5 text-white/70 text-sm">
                          <span className="text-[#C4622D] font-medium">🎙️ {selectedAgent.agentName}:</span> {testResponse}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* VOICE TAB */}
                {activeTab === 'voice' && (
                  <div className="space-y-6">
                    <h3 className="text-white font-semibold text-lg">{t('voiceAgent.selectTier')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {TTS_TIERS.map(tier => (
                        <motion.div key={tier.id} whileHover={{ scale: 1.02 }} onClick={() => updateAgent('ttsTier', tier.id)}
                          className={`p-5 rounded-xl cursor-pointer transition-all border ${selectedAgent.ttsTier === tier.id ? 'border-2' : 'border-white/10 hover:border-white/20'}`}
                          style={{ borderColor: selectedAgent.ttsTier === tier.id ? tier.color : undefined, background: selectedAgent.ttsTier === tier.id ? `${tier.color}11` : 'rgba(255,255,255,0.03)' }}>
                          <div className="flex items-center gap-2 mb-3">
                            <tier.icon className="w-5 h-5" style={{ color: tier.color }} />
                            <span className="text-white font-bold">{tier.name}</span>
                            {selectedAgent.ttsTier === tier.id && <Check className="w-4 h-4 ml-auto" style={{ color: tier.color }} />}
                          </div>
                          <div className="text-2xl font-bold mb-2" style={{ color: tier.color }}>{tier.price}</div>
                          <p className="text-white/70 text-xs mb-3">{tier.description}</p>
                          <ul className="space-y-1">
                            {tier.features.map((f, i) => (<li key={i} className="text-white/60 text-xs flex items-center gap-1.5"><span style={{ color: tier.color }}>✓</span> {f}</li>))}
                          </ul>
                        </motion.div>
                      ))}
                    </div>

                    {selectedAgent.ttsTier === 'free' && (
                      <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                        <p className="text-green-400 text-sm font-medium">🔊 {t('voiceAgent.browserVoice')}</p>
                        <p className="text-white/60 text-xs mt-1">{t('voiceAgent.browserVoiceDesc')}</p>
                      </div>
                    )}

                    {selectedAgent.ttsTier === 'pro' && (
                      <div className="space-y-4">
                        <div>
                          <label className="text-white/90 text-sm font-medium mb-2 block">OpenRouter API Key</label>
                          <input type="password" value={selectedAgent.openRouterKey || ''} onChange={e => updateAgent('openRouterKey', e.target.value)} placeholder="sk-or-..." className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500/50 focus:outline-none" />
                          <p className="text-white/50 text-xs mt-1">Obtén tu key en <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">openrouter.ai/keys</a></p>
                        </div>
                        <div>
                          <label className="text-white/90 text-sm font-medium mb-2 block">{t('voiceAgent.selectVoice')}</label>
                          <div className="grid grid-cols-4 gap-2">
                            {OPENROUTER_VOICES.map(voice => (
                              <button key={voice} onClick={() => updateAgent('ttsVoice', voice)} className={`px-3 py-2 rounded-lg text-sm transition-all ${selectedAgent.ttsVoice === voice ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' : 'bg-white/5 text-white/70 border border-white/10 hover:border-white/20'}`}>{voice}</button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedAgent.ttsTier === 'premium' && (
                      <div className="space-y-4">
                        <div>
                          <label className="text-white/90 text-sm font-medium mb-2 block">ElevenLabs API Key</label>
                          <input type="password" value={selectedAgent.elevenLabsKey || ''} onChange={e => updateAgent('elevenLabsKey', e.target.value)} placeholder="sk_... o xi_..." className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500/50 focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-white/90 text-sm font-medium mb-2 block">Voice ID</label>
                          <input value={selectedAgent.elevenLabsVoiceId || ''} onChange={e => updateAgent('elevenLabsVoiceId', parseVoiceId(e.target.value))} placeholder="hA4zGnmTwX2NQiTRMt7o o pega la URL completa" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500/50 focus:outline-none" />
                          <p className="text-white/50 text-xs mt-1">Encuentra Voice IDs en <a href="https://elevenlabs.io/app/voice-library" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">elevenlabs.io</a> — puedes pegar la URL completa, se extrae automáticamente</p>
                        </div>
                      </div>
                    )}

                    {/* Voice Preview Section */}
                    <div className="mt-6 pt-6 border-t border-white/10">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="text-white font-semibold flex items-center gap-2">
                            <Volume2 className="w-4 h-4 text-[#C4622D]" />
                            {t('voiceAgent.previewVoice')}
                          </h4>
                          <p className="text-white/50 text-xs mt-1">
                            {selectedAgent.ttsTier === 'premium'
                              ? 'Escucha cómo suena tu voz ElevenLabs seleccionada'
                              : selectedAgent.ttsTier === 'pro'
                              ? 'Preview con voz del navegador (OpenRouter TTS se usa en el widget)'
                              : 'Escucha la voz del navegador con tu configuración'}
                          </p>
                        </div>
                        <Button
                          onClick={previewVoice}
                          disabled={previewingVoice || (selectedAgent.ttsTier === 'premium' && (!selectedAgent.elevenLabsKey || !selectedAgent.elevenLabsVoiceId))}
                          className="gap-2"
                          style={{ background: previewingVoice ? undefined : `${TTS_TIERS.find(t => t.id === selectedAgent.ttsTier)?.color}22`, borderColor: TTS_TIERS.find(t => t.id === selectedAgent.ttsTier)?.color }}
                        >
                          {previewingVoice ? (
                            <>
                              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Reproduciendo...
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4" />
                              🔊 Escuchar Voz
                            </>
                          )}
                        </Button>
                      </div>
                      {previewError && (
                        <div className="mt-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                          ⚠️ {previewError}
                        </div>
                      )}
                      {previewingVoice && (
                        <div className="mt-3 flex items-center gap-3 p-3 rounded-lg bg-white/5">
                          <div className="flex gap-1">
                            {[0, 1, 2, 3, 4].map(i => (
                              <motion.div
                                key={i}
                                animate={{ scaleY: [0.4, 1, 0.4] }}
                                transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
                                className="w-1 h-5 rounded-full"
                                style={{ background: TTS_TIERS.find(t => t.id === selectedAgent.ttsTier)?.color || '#C4622D' }}
                              />
                            ))}
                          </div>
                          <span className="text-white/70 text-sm">Reproduciendo muestra de audio...</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* EMBED TAB */}
                {activeTab === 'embed' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-white font-semibold text-lg">{t('voiceAgent.embedTitle')}</h3>
                      <Button onClick={() => setShowPreview(!showPreview)} variant="outline" className="gap-2 text-sm">
                        <Eye className="w-4 h-4" /> {showPreview ? t('voiceAgent.hidePreview') : t('voiceAgent.showPreview')}
                      </Button>
                    </div>
                    <p className="text-white/70 text-sm">{t('voiceAgent.embedDesc')}</p>
                    <div className="relative">
                      <pre className="bg-black/40 rounded-xl p-4 text-xs text-green-400 overflow-x-auto border border-white/10 whitespace-pre-wrap">
{`<!-- OCTOPUS Voice Agent Widget -->
<script>
(function(){
  var c=${JSON.stringify({
    agentName: selectedAgent.agentName,
    systemPrompt: selectedAgent.systemPrompt,
    model: selectedAgent.model,
    temperature: selectedAgent.temperature,
    ttsTier: selectedAgent.ttsTier,
    ttsVoice: selectedAgent.ttsVoice,
    accentColor: selectedAgent.accentColor,
    greeting: selectedAgent.greeting,
    language: selectedAgent.language,
    openRouterKey: selectedAgent.openRouterKey || '',
    elevenLabsKey: selectedAgent.elevenLabsKey || '',
    elevenLabsVoiceId: selectedAgent.elevenLabsVoiceId || '',
  }, null, 2)};
  localStorage.setItem('voice-agent-config-${selectedAgent.id}',JSON.stringify(c));
  var i=document.createElement('iframe');
  i.src='${typeof window !== 'undefined' ? window.location.origin : ''}/widget/voice/${selectedAgent.id}';
  i.style.cssText='position:fixed;bottom:0;right:0;width:420px;height:660px;border:none;z-index:99999;background:transparent;';
  i.allow='microphone';
  document.body.appendChild(i);
})();
</script>`}
                      </pre>
                      <button onClick={copyEmbedCode} className="absolute top-3 right-3 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
                        {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <h4 className="text-white font-medium text-sm mb-3">📋 {t('voiceAgent.howToEmbed')}</h4>
                      <ol className="space-y-2 text-white/70 text-sm">
                        <li>1. {t('voiceAgent.step1')}</li>
                        <li>2. {t('voiceAgent.step2')}</li>
                        <li>3. {t('voiceAgent.step3')}</li>
                        <li>4. {t('voiceAgent.step4')}</li>
                      </ol>
                    </div>
                    {showPreview && (
                      <div className="rounded-xl border border-white/10 overflow-hidden" style={{ height: '500px', background: '#1a1a2e' }}>
                        <iframe
                          key={`${selectedAgent.id}-${selectedAgent.ttsTier}-${selectedAgent.ttsVoice}-${Date.now()}`}
                          src={`/widget/voice/${selectedAgent.id}`}
                          className="w-full h-full border-0"
                          allow="microphone"
                          title="Voice Agent Preview"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateModal(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()} className="bg-[#0d1321] border border-white/10 rounded-2xl p-6 w-full max-w-lg">
              <h3 className="text-xl font-bold text-white mb-1">🎙️ {t('voiceAgent.newAgent')}</h3>
              <p className="text-white/60 text-sm mb-5">{t('voiceAgent.newAgentDesc')}</p>
              <div className="space-y-4">
                <div>
                  <label className="text-white/90 text-sm font-medium mb-1.5 block">{t('voiceAgent.agentName')} *</label>
                  <input
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="Ej: Asistente de Soporte, Vendedor Pro..."
                    className="w-full bg-[#0d1321] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:border-[#C4622D]/50 focus:outline-none transition-colors"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-white/90 text-sm font-medium mb-1.5 block">{t('voiceAgent.systemPrompt')}</label>
                  <textarea
                    value={newPrompt}
                    onChange={e => setNewPrompt(e.target.value)}
                    rows={4}
                    placeholder="Describe la personalidad y objetivo de tu agente. Ej: Eres un experto en tecnología que ayuda a los clientes a elegir el mejor producto..."
                    className="w-full bg-[#0d1321] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:border-[#C4622D]/50 focus:outline-none transition-colors resize-none"
                  />
                </div>
                <div>
                  <label className="text-white/90 text-sm font-medium mb-1.5 block">{t('voiceAgent.greeting')}</label>
                  <input
                    value={newGreeting}
                    onChange={e => setNewGreeting(e.target.value)}
                    placeholder="Ej: ¡Hola! Soy tu asesor virtual. ¿En qué te puedo ayudar?"
                    className="w-full bg-[#0d1321] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:border-[#C4622D]/50 focus:outline-none transition-colors"
                  />
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/10 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#C4622D]/20 flex items-center justify-center text-lg">🔊</div>
                  <div className="text-white/60 text-xs">STT + LLM + TTS — La voz y modelo se configuran después de crear</div>
                </div>
                <div className="flex gap-3 pt-1">
                  <Button onClick={() => setShowCreateModal(false)} variant="outline" className="flex-1">{t('voiceAgent.cancel')}</Button>
                  <Button onClick={createAgent} disabled={!newName.trim()} className="flex-1 gap-2"><Wand2 className="w-4 h-4" /> {t('voiceAgent.create')}</Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
