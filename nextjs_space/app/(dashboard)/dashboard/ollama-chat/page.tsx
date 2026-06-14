'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSession } from 'next-auth/react'
import {
  Send,
  Cpu,
  Loader2,
  Plus,
  Trash2,
  MessageSquare,
  ChevronDown,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  Settings2,
  Bot,
  User,
  Zap,
  Clock,
  Shield,
  BookOpen,
  Download,
  HardDrive,
  Monitor,
  X,
  CheckCircle2,
  CircleSlash,
  AlertCircle,
  Sparkles,
  Code2,
  Eye,
  Brain,
  Database,
  ChevronRight,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n-context'
import Link from 'next/link'
import type { CookbookModel, OllamaHardware, OllamaPullRequest } from '@/lib/brazos-types'

// ============================================
// OLLAMA CHAT — Chat with Local AI Models
// ============================================

interface OllamaModel {
  name: string
  size?: number
  family?: string
  parameterSize?: string
  quantization?: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error?: string
  createdAt: string
}

interface ChatSession {
  id: string
  model: string
  title: string
  updatedAt: string
  _count?: { messages: number }
}

export default function OllamaChatPage() {
  const { data: session } = useSession() || {}
  const { t } = useI18n()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Bridge/Ollama status
  const [ollamaStatus, setOllamaStatus] = useState<{
    bridgePresent: boolean
    running: boolean
    installed: boolean
    models: OllamaModel[]
  } | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)

  // Chat state
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [pendingMsgId, setPendingMsgId] = useState<string | null>(null)
  const [showSidebar, setShowSidebar] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showModelSelect, setShowModelSelect] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Cookbook state
  const [showCookbook, setShowCookbook] = useState(false)
  const [cookbookData, setCookbookData] = useState<{
    catalog: (CookbookModel & { isInstalled: boolean; compatibility: string; activePull: OllamaPullRequest | null })[]
    hardware: OllamaHardware | null
    os: string | null
    ramGB: number | null
    installedCount: number
    bridgePresent: boolean
    ollamaRunning: boolean
    pullQueue: OllamaPullRequest[]
  } | null>(null)
  const [cookbookLoading, setCookbookLoading] = useState(false)
  const [pullingModels, setPullingModels] = useState<Set<string>>(new Set())
  const [cookbookFilter, setCookbookFilter] = useState<'all' | 'chat' | 'code' | 'vision' | 'reasoning' | 'embedding'>('all')
  const [cookbookTier, setCookbookTier] = useState<'all' | 'lightweight' | 'standard' | 'heavy' | 'extreme'>('all')
  const cookbookPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Fetch Ollama status
  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/arms/ollama/status')
      if (r.ok) {
        const data = await r.json()
        // API returns { connected, status: { bridgePresent, running, models, ... } }
        const st = data.status || data
        setOllamaStatus(st)
        if (st.models?.length > 0 && !selectedModel) {
          setSelectedModel(st.models[0].name)
        }
      }
    } catch {} finally {
      setStatusLoading(false)
    }
  }, [selectedModel])

  // Fetch sessions
  const fetchSessions = useCallback(async () => {
    try {
      const r = await fetch('/api/arms/ollama/chat?action=sessions')
      if (r.ok) {
        const data = await r.json()
        setSessions(data.sessions || [])
      }
    } catch {}
  }, [])

  // Fetch messages for active session
  const fetchMessages = useCallback(async (sessId: string) => {
    try {
      const r = await fetch(`/api/arms/ollama/chat?action=messages&sessionId=${sessId}`)
      if (r.ok) {
        const data = await r.json()
        setMessages(data.messages || [])
        if (data.session?.model) {
          setSelectedModel(data.session.model)
        }
      }
    } catch {}
  }, [])

  // Poll for pending message response — shows streaming content in real-time
  const pollMessageStatus = useCallback(async (msgId: string) => {
    try {
      const r = await fetch(`/api/arms/ollama/chat?action=status&messageId=${msgId}`)
      if (r.ok) {
        const data = await r.json()

        // Update streaming content in real-time (even while processing)
        if (data.status === 'processing' && data.content) {
          setMessages(prev => {
            const updated = [...prev]
            const idx = updated.findIndex(m => m.id === msgId || (m.role === 'assistant' && (m.status === 'pending' || m.status === 'processing')))
            if (idx >= 0) {
              updated[idx] = { ...updated[idx], content: data.content, status: 'processing', id: msgId }
            }
            return updated
          })
        }

        if (data.status === 'completed' || data.status === 'failed') {
          setPendingMsgId(null)
          setSending(false)
          // Refresh all messages to get final clean content
          if (activeSessionId) {
            await fetchMessages(activeSessionId)
          }
          return true // Done polling
        }
      }
    } catch {}
    return false
  }, [activeSessionId, fetchMessages])

  // Start polling when we have a pending message — faster polling for streaming UX
  useEffect(() => {
    if (!pendingMsgId) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
      return
    }
    pollRef.current = setInterval(async () => {
      const done = await pollMessageStatus(pendingMsgId)
      if (done && pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }, 1000) // Poll every 1s for streaming updates (was 1.5s)
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }
  }, [pendingMsgId, pollMessageStatus])

  // Initial load
  useEffect(() => {
    fetchStatus()
    fetchSessions()
    const si = setInterval(fetchStatus, 30000)
    return () => clearInterval(si)
  }, [fetchStatus, fetchSessions])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pendingMsgId])

  // Send message
  const handleSend = async () => {
    if (!input.trim() || sending || !selectedModel) return
    const msg = input.trim()
    setInput('')
    setSending(true)

    // Optimistic UI: add user message immediately
    const optimisticUserMsg: ChatMessage = {
      id: 'temp-user-' + Date.now(),
      role: 'user',
      content: msg,
      status: 'completed',
      createdAt: new Date().toISOString(),
    }
    const optimisticAssistantMsg: ChatMessage = {
      id: 'temp-assistant-' + Date.now(),
      role: 'assistant',
      content: '',
      status: 'pending',
      createdAt: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimisticUserMsg, optimisticAssistantMsg])

    try {
      const r = await fetch('/api/arms/ollama/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSessionId,
          model: selectedModel,
          message: msg,
        }),
      })
      if (!r.ok) {
        const err = await r.json()
        throw new Error(err.message || err.error || 'Failed to send')
      }
      const data = await r.json()

      // Set the real session ID
      if (!activeSessionId) {
        setActiveSessionId(data.sessionId)
        fetchSessions()
      }

      // Start polling for the assistant response
      setPendingMsgId(data.assistantMessageId)
    } catch (err: unknown) {
      setSending(false)
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido'
      setMessages(prev => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        if (last && last.role === 'assistant') {
          last.status = 'failed'
          last.error = errorMsg
        }
        return updated
      })
    }
  }

  // New session
  const handleNewSession = () => {
    setActiveSessionId(null)
    setMessages([])
    setPendingMsgId(null)
    setSending(false)
    inputRef.current?.focus()
  }

  // Load session
  const handleLoadSession = async (sessId: string) => {
    setActiveSessionId(sessId)
    setPendingMsgId(null)
    setSending(false)
    await fetchMessages(sessId)
  }

  // Delete session
  const handleDeleteSession = async (sessId: string) => {
    try {
      await fetch(`/api/arms/ollama/chat?sessionId=${sessId}`, { method: 'DELETE' })
      setSessions(prev => prev.filter(s => s.id !== sessId))
      if (activeSessionId === sessId) {
        handleNewSession()
      }
    } catch {}
  }

  // Copy message
  const handleCopy = (id: string, content: string) => {
    const clean = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
    navigator.clipboard.writeText(clean)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Cookbook data fetching
  const fetchCookbook = useCallback(async () => {
    try {
      const r = await fetch('/api/arms/ollama/cookbook')
      if (r.ok) {
        const data = await r.json()
        setCookbookData(data)
      }
    } catch {}
  }, [])

  // Open cookbook drawer
  const handleOpenCookbook = useCallback(async () => {
    setShowCookbook(true)
    setCookbookLoading(true)
    await fetchCookbook()
    setCookbookLoading(false)
  }, [fetchCookbook])

  // Poll cookbook while open (for pull progress)
  useEffect(() => {
    if (!showCookbook) {
      if (cookbookPollRef.current) { clearInterval(cookbookPollRef.current); cookbookPollRef.current = null }
      return
    }
    // Only poll if there are active pulls
    const hasActivePulls = cookbookData?.pullQueue?.some(p => p.status === 'pending' || p.status === 'downloading')
    if (hasActivePulls) {
      cookbookPollRef.current = setInterval(fetchCookbook, 3000)
    }
    return () => { if (cookbookPollRef.current) { clearInterval(cookbookPollRef.current); cookbookPollRef.current = null } }
  }, [showCookbook, cookbookData?.pullQueue, fetchCookbook])

  // Trigger model pull
  const handlePullModel = async (ollamaTag: string) => {
    setPullingModels(prev => new Set(prev).add(ollamaTag))
    try {
      const r = await fetch('/api/arms/ollama/cookbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pull', model: ollamaTag }),
      })
      if (!r.ok) {
        const err = await r.json()
        console.error('Pull failed:', err.error)
      }
      // Refresh cookbook data
      await fetchCookbook()
    } catch (err) {
      console.error('Pull error:', err)
    } finally {
      setPullingModels(prev => { const next = new Set(prev); next.delete(ollamaTag); return next })
    }
  }

  // Cancel pull
  const handleCancelPull = async (pullId: string) => {
    try {
      await fetch('/api/arms/ollama/cookbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel_pull', pullId }),
      })
      await fetchCookbook()
    } catch {}
  }

  // Category icon helper
  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'chat': return Sparkles
      case 'code': return Code2
      case 'vision': return Eye
      case 'reasoning': return Brain
      case 'embedding': return Database
      default: return Sparkles
    }
  }

  // Compatibility color helper
  const getCompatColor = (compat: string) => {
    switch (compat) {
      case 'perfect': return { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'Runs great' }
      case 'possible': return { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30', label: 'Might be slow' }
      case 'heavy': return { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30', label: 'Too heavy' }
      default: return { bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/30', label: 'Unknown' }
    }
  }

  // Tier display helper
  const getTierInfo = (tier: string) => {
    switch (tier) {
      case 'lightweight': return { label: '4-8 GB', color: 'text-emerald-400', emoji: '🪶' }
      case 'standard': return { label: '8-16 GB', color: 'text-cyan-400', emoji: '⚡' }
      case 'heavy': return { label: '16-32 GB', color: 'text-amber-400', emoji: '🔥' }
      case 'extreme': return { label: '32+ GB', color: 'text-red-400', emoji: '🚀' }
      default: return { label: '', color: 'text-gray-400', emoji: '' }
    }
  }

  // Format model size
  const formatSize = (bytes?: number) => {
    if (!bytes) return ''
    const gb = bytes / (1024 * 1024 * 1024)
    return gb >= 1 ? gb.toFixed(1) + ' GB' : (bytes / (1024 * 1024)).toFixed(0) + ' MB'
  }

  // Render status banner
  const renderStatus = () => {
    if (statusLoading) {
      return (
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Detecting Ollama...
        </div>
      )
    }
    if (!ollamaStatus?.bridgePresent) {
      return (
        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <div className="text-sm">
            <span className="text-amber-600 font-medium">Bridge not detected.</span>
            <span className="text-gray-400 ml-1">
              Install the Bridge from{' '}
              <Link href="/dashboard/brazos" className="text-cyan-400 hover:underline">Active Arms</Link>
              {' '}→ Smart Home → Download Bridge
            </span>
          </div>
        </div>
      )
    }
    if (!ollamaStatus.running) {
      return (
        <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
          <div className="text-sm">
            <span className="text-yellow-300 font-medium">Ollama is not running.</span>
            <span className="text-gray-400 ml-1">
              Open Ollama on your machine to chat with your local models.
            </span>
          </div>
        </div>
      )
    }
    return null
  }

  const canSend = !!selectedModel && ollamaStatus?.running && ollamaStatus?.bridgePresent && !sending

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden">
      {/* Sessions sidebar */}
      <AnimatePresence>
        {showSidebar && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="border-r border-[#2D4A3E]/30 bg-[#0F1419] flex flex-col overflow-hidden flex-shrink-0"
          >
            <div className="p-3 border-b border-[#2D4A3E]/30">
              <Button
                onClick={handleNewSession}
                className="w-full bg-cyan-600 hover:bg-cyan-700 text-white text-sm"
              >
                <Plus className="w-4 h-4 mr-2" /> New Conversation
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {sessions.length === 0 && (
                <p className="text-gray-500 text-xs text-center mt-8 px-3">
                  Your Ollama conversations will appear here
                </p>
              )}
              {sessions.map(sess => (
                <div
                  key={sess.id}
                  className={`group flex items-center gap-2 p-2.5 rounded-lg cursor-pointer transition-colors text-sm ${
                    activeSessionId === sess.id
                      ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                      : 'text-gray-400 hover:bg-[#1A2332] hover:text-gray-200'
                  }`}
                  onClick={() => handleLoadSession(sess.id)}
                >
                  <MessageSquare className="w-4 h-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-xs font-medium">{sess.title}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {sess.model} · {sess._count?.messages || 0} msgs
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteSession(sess.id) }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-opacity"
                  >
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 p-3 border-b border-[#2D4A3E]/30 bg-[#0F1419]/80">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-1.5 hover:bg-[#1A2332] rounded-lg transition-colors"
          >
            <MessageSquare className="w-5 h-5 text-gray-400" />
          </button>

          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-cyan-400" />
            <span className="font-semibold text-white">Ollama Chat</span>
          </div>

          {/* Model selector */}
          <div className="relative">
            <button
              onClick={() => setShowModelSelect(!showModelSelect)}
              disabled={!ollamaStatus?.models?.length}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#1A2332] border border-[#2D4A3E]/40 rounded-lg text-sm text-gray-300 hover:border-cyan-500/50 transition-colors disabled:opacity-50"
            >
              <Bot className="w-4 h-4 text-cyan-400" />
              <span className="max-w-[200px] truncate">{selectedModel || 'Select model'}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            <AnimatePresence>
              {showModelSelect && ollamaStatus?.models && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="absolute top-full left-0 mt-1 w-80 bg-[#1A2332] border border-[#2D4A3E]/40 rounded-xl shadow-2xl z-50 overflow-hidden"
                >
                  <div className="p-2 max-h-64 overflow-y-auto space-y-1">
                    {ollamaStatus.models.map(m => (
                      <button
                        key={m.name}
                        onClick={() => { setSelectedModel(m.name); setShowModelSelect(false) }}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors ${
                          selectedModel === m.name
                            ? 'bg-cyan-500/15 border border-cyan-500/30'
                            : 'hover:bg-[#0F1419]'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                          <Cpu className="w-4 h-4 text-cyan-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{m.name}</p>
                          <p className="text-[10px] text-gray-500">
                            {m.family && <span>{m.family}</span>}
                            {m.parameterSize && <span> · {m.parameterSize}</span>}
                            {m.quantization && <span> · {m.quantization}</span>}
                            {m.size && <span> · {formatSize(m.size)}</span>}
                          </p>
                        </div>
                        {selectedModel === m.name && (
                          <Check className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Cookbook button */}
          <button
            onClick={handleOpenCookbook}
            className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-[#C4622D]/20 to-amber-500/20 border border-[#C4622D]/30 rounded-lg text-sm text-[#C4622D] hover:border-[#C4622D]/60 hover:from-[#C4622D]/30 hover:to-amber-500/30 transition-all"
          >
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline font-medium">Cookbook</span>
          </button>

          <div className="flex-1" />

          {/* Status badges */}
          <div className="flex items-center gap-2">
            {ollamaStatus?.bridgePresent && (
              <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full">
                <Shield className="w-3 h-3" /> Bridge
              </span>
            )}
            {ollamaStatus?.running && (
              <span className="flex items-center gap-1 text-xs text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded-full">
                <Zap className="w-3 h-3" /> Local
              </span>
            )}
          </div>
        </div>

        {/* Status banners */}
        <div className="px-4 pt-2">
          {renderStatus()}
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && !sending && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 flex items-center justify-center mb-6">
                <Cpu className="w-10 h-10 text-cyan-400" />
              </div>
              <h2 className="text-xl font-bold text-zinc-800 mb-2">Chat with Ollama</h2>
              <p className="text-gray-400 text-sm max-w-md mb-6">
                Chat with AI models running 100% on your machine.
                Total privacy — nothing leaves your computer.
              </p>
              <div className="grid grid-cols-2 gap-3 max-w-sm">
                {[
                  { icon: Shield, text: 'Total Privacy', sub: 'Data never leaves' },
                  { icon: Zap, text: 'No Limits', sub: 'No tokens/credits' },
                  { icon: Clock, text: 'Uncensored', sub: 'No filters' },
                  { icon: Settings2, text: 'Your Hardware', sub: 'Local GPU' },
                ].map((item, i) => (
                  <div key={i} className="p-3 bg-[#1A2332] rounded-xl border border-[#2D4A3E]/20 text-left">
                    <item.icon className="w-5 h-5 text-cyan-400 mb-2" />
                    <p className="text-xs font-medium text-white">{item.text}</p>
                    <p className="text-[10px] text-gray-500">{item.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {messages.filter(m => m.role !== 'system').map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-lg bg-cyan-500/15 flex items-center justify-center flex-shrink-0 mt-1">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                </div>
              )}
              <div className={`max-w-[75%] ${msg.role === 'user' ? 'order-1' : ''}`}>
                <div className={`rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-cyan-600 text-white rounded-br-md'
                    : 'bg-[#1A2332] border border-[#2D4A3E]/30 text-gray-200 rounded-bl-md'
                }`}>
                  {msg.status === 'pending' || (msg.status === 'processing' && !msg.content) ? (
                    <div className="flex items-center gap-2 text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">
                        {msg.status === 'pending' ? 'Waiting for Bridge...' : 'Starting generation...'}
                      </span>
                    </div>
                  ) : msg.status === 'processing' && msg.content ? (
                    <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                      {msg.content.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<think>[\s\S]*/gi, '').trim()}
                      <span className="inline-block w-2 h-4 bg-cyan-400 ml-0.5 animate-pulse rounded-sm" />
                    </div>
                  ) : msg.status === 'failed' ? (
                    <div className="flex items-center gap-2 text-red-400">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm">{msg.error || 'Error generating response'}</span>
                    </div>
                  ) : (
                    <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                      {msg.content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()}
                    </div>
                  )}
                </div>
                {msg.role === 'assistant' && msg.status === 'completed' && msg.content && (
                  <div className="flex items-center gap-1 mt-1">
                    <button
                      onClick={() => handleCopy(msg.id, msg.content)}
                      className="p-1 hover:bg-[#1A2332] rounded transition-colors"
                    >
                      {copiedId === msg.id
                        ? <Check className="w-3 h-3 text-emerald-400" />
                        : <Copy className="w-3 h-3 text-gray-500" />
                      }
                    </button>
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-lg bg-[#C4622D]/20 flex items-center justify-center flex-shrink-0 mt-1 order-2">
                  <User className="w-4 h-4 text-[#C4622D]" />
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="p-4 border-t border-[#2D4A3E]/30 bg-[#0F1419]">
          <div className="flex gap-2 max-w-4xl mx-auto">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={canSend ? 'Type your message...' : 'Waiting for Ollama connection...'}
                disabled={!canSend}
                rows={1}
                className="w-full bg-[#1A2332] border border-[#2D4A3E]/40 rounded-xl px-4 py-3 pr-12 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 resize-none disabled:opacity-50 transition-colors"
                style={{ minHeight: '48px', maxHeight: '120px' }}
                onInput={(e) => {
                  const ta = e.target as HTMLTextAreaElement
                  ta.style.height = 'auto'
                  ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
                }}
              />
              <button
                onClick={handleSend}
                disabled={!canSend || !input.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 disabled:opacity-30 disabled:hover:bg-cyan-600 transition-colors"
              >
                {sending ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
              </button>
            </div>
          </div>
          <p className="text-center text-[10px] text-gray-600 mt-2">
            <Shield className="w-3 h-3 inline mr-1" />
            Processed 100% locally via Bridge → Ollama. Nothing leaves your machine.
          </p>
        </div>
      </div>

      {/* Cookbook Drawer Overlay */}
      <AnimatePresence>
        {showCookbook && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              onClick={() => setShowCookbook(false)}
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-[#0F1419] border-l border-[#2D4A3E]/40 z-50 flex flex-col overflow-hidden shadow-2xl"
            >
              {/* Drawer Header */}
              <div className="flex items-center gap-3 p-4 border-b border-[#2D4A3E]/30 bg-gradient-to-r from-[#0F1419] to-[#1A2332]">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C4622D]/30 to-amber-500/20 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-[#C4622D]" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-white">Model Cookbook</h2>
                  <p className="text-xs text-gray-400">Scan your hardware → find the perfect model → one-click install</p>
                </div>
                <button
                  onClick={() => setShowCookbook(false)}
                  className="p-2 hover:bg-[#1A2332] rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto">
                {cookbookLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-3" />
                      <p className="text-sm text-gray-400">Scanning hardware...</p>
                    </div>
                  </div>
                ) : cookbookData ? (
                  <div className="p-4 space-y-4">
                    {/* Hardware Card */}
                    <div className="rounded-xl bg-gradient-to-r from-[#1A2332] to-[#1A2332]/80 border border-[#2D4A3E]/30 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Monitor className="w-5 h-5 text-cyan-400" />
                        <h3 className="text-sm font-semibold text-white">Your Machine</h3>
                        {cookbookData.bridgePresent ? (
                          <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" /> Bridge Connected
                          </span>
                        ) : (
                          <span className="ml-auto flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                            <AlertCircle className="w-3 h-3" /> Bridge Offline
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-[#0F1419]/60 rounded-lg p-3">
                          <p className="text-[10px] text-gray-500 mb-1">RAM</p>
                          <p className="text-sm font-bold text-white">
                            {cookbookData.ramGB ? `${cookbookData.ramGB} GB` : '—'}
                          </p>
                        </div>
                        <div className="bg-[#0F1419]/60 rounded-lg p-3">
                          <p className="text-[10px] text-gray-500 mb-1">OS</p>
                          <p className="text-sm font-bold text-white capitalize">
                            {cookbookData.os || '—'}
                          </p>
                        </div>
                        <div className="bg-[#0F1419]/60 rounded-lg p-3">
                          <p className="text-[10px] text-gray-500 mb-1">CPU</p>
                          <p className="text-sm font-bold text-white truncate" title={cookbookData.hardware?.cpu || ''}>
                            {cookbookData.hardware?.cpu ? cookbookData.hardware.cpu.split(' ').slice(0, 3).join(' ') : '—'}
                          </p>
                        </div>
                        <div className="bg-[#0F1419]/60 rounded-lg p-3">
                          <p className="text-[10px] text-gray-500 mb-1">GPU</p>
                          <p className="text-sm font-bold text-white truncate" title={cookbookData.hardware?.gpu || ''}>
                            {cookbookData.hardware?.gpu ? cookbookData.hardware.gpu.split(' ').slice(0, 3).join(' ') : '—'}
                          </p>
                        </div>
                      </div>
                      {!cookbookData.hardware?.totalRam && cookbookData.bridgePresent && (
                        <p className="text-[10px] text-amber-400/80 mt-2 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Hardware detection requires Bridge v2.1+. Update your Bridge for full scanner features.
                        </p>
                      )}
                      {!cookbookData.bridgePresent && (
                        <p className="text-[10px] text-amber-400/80 mt-2 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Connect the Octopus Bridge to detect your hardware and enable one-click model downloads.
                        </p>
                      )}
                    </div>

                    {/* Filters */}
                    <div className="flex flex-wrap gap-2">
                      <div className="flex gap-1 bg-[#1A2332] rounded-lg p-1">
                        {(['all', 'chat', 'code', 'vision', 'reasoning', 'embedding'] as const).map(cat => {
                          const Icon = cat === 'all' ? Sparkles : getCategoryIcon(cat)
                          return (
                            <button
                              key={cat}
                              onClick={() => setCookbookFilter(cat)}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                                cookbookFilter === cat
                                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#0F1419]/50'
                              }`}
                            >
                              <Icon className="w-3 h-3" />
                              <span className="capitalize">{cat}</span>
                            </button>
                          )
                        })}
                      </div>
                      <div className="flex gap-1 bg-[#1A2332] rounded-lg p-1">
                        {(['all', 'lightweight', 'standard', 'heavy', 'extreme'] as const).map(tier => {
                          const info = tier === 'all' ? { emoji: '🎯', label: 'All', color: 'text-gray-400' } : getTierInfo(tier)
                          return (
                            <button
                              key={tier}
                              onClick={() => setCookbookTier(tier)}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                                cookbookTier === tier
                                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#0F1419]/50'
                              }`}
                            >
                              <span>{info.emoji}</span>
                              <span>{tier === 'all' ? 'All' : info.label}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Model Cards */}
                    <div className="space-y-3">
                      {(() => {
                        const filtered = cookbookData.catalog.filter(m => {
                          if (cookbookFilter !== 'all' && m.category !== cookbookFilter) return false
                          if (cookbookTier !== 'all' && m.tier !== cookbookTier) return false
                          return true
                        })
                        if (filtered.length === 0) {
                          return (
                            <div className="text-center py-12 text-gray-500">
                              <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
                              <p className="text-sm">No models match these filters</p>
                            </div>
                          )
                        }

                        // Group by tier
                        const tiers = ['lightweight', 'standard', 'heavy', 'extreme'] as const
                        return tiers.map(tier => {
                          const tierModels = filtered.filter(m => m.tier === tier)
                          if (tierModels.length === 0) return null
                          const tierInfo = getTierInfo(tier)
                          return (
                            <div key={tier}>
                              <div className="flex items-center gap-2 mb-2 mt-2">
                                <span>{tierInfo.emoji}</span>
                                <span className={`text-xs font-semibold uppercase tracking-wider ${tierInfo.color}`}>
                                  {tier} — {tierInfo.label} RAM
                                </span>
                                <div className="flex-1 h-px bg-[#2D4A3E]/30" />
                              </div>
                              <div className="space-y-2">
                                {tierModels.map(model => {
                                  const CatIcon = getCategoryIcon(model.category)
                                  const compat = getCompatColor(model.compatibility)
                                  const isPulling = pullingModels.has(model.ollamaTag)
                                  const activePull = model.activePull

                                  return (
                                    <div
                                      key={model.id}
                                      className={`rounded-xl border p-3 transition-all ${
                                        model.isInstalled
                                          ? 'bg-emerald-500/5 border-emerald-500/20'
                                          : 'bg-[#1A2332]/50 border-[#2D4A3E]/20 hover:border-[#2D4A3E]/50'
                                      }`}
                                    >
                                      <div className="flex items-start gap-3">
                                        {/* Icon */}
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                          model.isInstalled ? 'bg-emerald-500/15' : 'bg-cyan-500/10'
                                        }`}>
                                          <CatIcon className={`w-5 h-5 ${model.isInstalled ? 'text-emerald-400' : 'text-cyan-400'}`} />
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <h4 className="text-sm font-semibold text-white">{model.name}</h4>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0F1419] text-gray-400 font-mono">
                                              {model.parameterSize}
                                            </span>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0F1419] text-gray-500 capitalize">
                                              {model.category}
                                            </span>
                                            {model.isInstalled && (
                                              <span className="flex items-center gap-0.5 text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                                                <CheckCircle2 className="w-3 h-3" /> Installed
                                              </span>
                                            )}
                                            {model.compatibility !== 'unknown' && !model.isInstalled && (
                                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${compat.bg} ${compat.text}`}>
                                                {compat.label}
                                              </span>
                                            )}
                                          </div>
                                          <p className="text-xs text-gray-400 mt-1 leading-relaxed">{model.description}</p>
                                          <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-500">
                                            <span><HardDrive className="w-3 h-3 inline mr-0.5" />{model.diskSizeGB} GB disk</span>
                                            <span>Min {model.minRamGB} GB RAM</span>
                                            <span>{model.quantization}</span>
                                          </div>
                                          {/* Highlights */}
                                          <div className="flex flex-wrap gap-1 mt-2">
                                            {model.highlights.map((h, i) => (
                                              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#0F1419] text-gray-400 border border-[#2D4A3E]/20">
                                                {h}
                                              </span>
                                            ))}
                                          </div>
                                        </div>

                                        {/* Action */}
                                        <div className="flex-shrink-0">
                                          {model.isInstalled ? (
                                            <button
                                              onClick={() => {
                                                setSelectedModel(model.ollamaTag)
                                                setShowCookbook(false)
                                              }}
                                              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 rounded-lg text-xs font-medium text-emerald-400 transition-colors"
                                            >
                                              <Sparkles className="w-3 h-3" /> Use
                                            </button>
                                          ) : activePull ? (
                                            <div className="text-right">
                                              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                                                <Loader2 className="w-3 h-3 text-cyan-400 animate-spin" />
                                                <span className="text-xs text-cyan-400">
                                                  {activePull.progress != null ? `${activePull.progress}%` : 'Queued'}
                                                </span>
                                              </div>
                                              <button
                                                onClick={() => handleCancelPull(activePull.id)}
                                                className="text-[10px] text-gray-500 hover:text-red-400 mt-1 transition-colors"
                                              >
                                                Cancel
                                              </button>
                                            </div>
                                          ) : (
                                            <button
                                              onClick={() => handlePullModel(model.ollamaTag)}
                                              disabled={isPulling || !cookbookData.bridgePresent || !cookbookData.ollamaRunning}
                                              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600/80 hover:bg-cyan-600 disabled:opacity-30 disabled:hover:bg-cyan-600/80 border border-cyan-500/30 rounded-lg text-xs font-medium text-white transition-colors"
                                            >
                                              {isPulling ? (
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                              ) : (
                                                <Download className="w-3 h-3" />
                                              )}
                                              Pull
                                            </button>
                                          )}
                                        </div>
                                      </div>

                                      {/* Pull progress bar */}
                                      {activePull && activePull.progress != null && (
                                        <div className="mt-2 w-full bg-[#0F1419] rounded-full h-1.5 overflow-hidden">
                                          <motion.div
                                            className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${activePull.progress}%` }}
                                            transition={{ duration: 0.3 }}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })
                      })()}
                    </div>

                    {/* Footer info */}
                    <div className="pb-4 pt-2">
                      <p className="text-[10px] text-gray-600 text-center">
                        {cookbookData.installedCount} models installed · Models are downloaded and run 100% locally via Ollama
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-3" />
                      <p className="text-sm text-gray-400">Could not load cookbook data</p>
                      <button onClick={handleOpenCookbook} className="text-xs text-cyan-400 hover:underline mt-2">
                        Try again
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
