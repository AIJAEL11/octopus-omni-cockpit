'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot, Send, Users, X, Loader2, Zap, AlertTriangle,
  ChevronDown, ChevronUp, Settings2, Sparkles, MessageSquare,
  ArrowRight, Trash2,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n-context'

// ══════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════

interface Agent {
  id: string
  name: string
  description: string
  systemPrompt: string
  model?: string
  category?: string
  temperature?: number
  icon?: string
  isActive?: boolean
}

interface ChatMessage {
  id: string
  role: 'user' | 'agent'
  content: string
  agentId?: string
  agentName?: string
  agentIcon?: string
  timestamp: number
  engine?: string
}

interface AgentResponse {
  agentId: string
  agentName: string
  content: string
  engine: string
}

// ══════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════

const AGENT_COLORS = [
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-amber-600',
  'from-violet-500 to-purple-600',
  'from-blue-500 to-cyan-600',
  'from-rose-500 to-pink-600',
  'from-lime-500 to-green-600',
  'from-fuchsia-500 to-pink-600',
  'from-sky-500 to-blue-600',
  'from-yellow-500 to-orange-600',
  'from-indigo-500 to-violet-600',
  'from-red-500 to-rose-600',
]

const AGENT_BG_COLORS = [
  'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
  'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800',
  'bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800',
  'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',
  'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800',
  'bg-lime-50 dark:bg-lime-950/30 border-lime-200 dark:border-lime-800',
  'bg-fuchsia-50 dark:bg-fuchsia-950/30 border-fuchsia-200 dark:border-fuchsia-800',
  'bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800',
  'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800',
  'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800',
  'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
]

const CATEGORY_ICONS: Record<string, string> = {
  'Código': '💻', 'Diseño': '🎨', 'Datos': '📊', 'Automatización': '⚡',
  'Personalizado': '🔧', 'Marketing': '📣', 'Ventas': '💰', 'SEO': '🔍',
  'Soporte': '🎧', 'Contenido': '✍️',
}

// ══════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════

export default function MultiAgentChatPage() {
  const { locale } = useI18n()
  const es = locale === 'es'

  // State
  const [allAgents, setAllAgents] = useState<Agent[]>([])
  const [selectedAgents, setSelectedAgents] = useState<Agent[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [showAgentPicker, setShowAgentPicker] = useState(true)
  const [hasGroqKey, setHasGroqKey] = useState<boolean | null>(null)
  const [error, setError] = useState('')
  const [respondingAgents, setRespondingAgents] = useState<string[]>([])
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Get agent color by index in selected list
  const getAgentColor = (agentId: string) => {
    const idx = selectedAgents.findIndex(a => a.id === agentId)
    return AGENT_COLORS[idx % AGENT_COLORS.length]
  }
  const getAgentBg = (agentId: string) => {
    const idx = selectedAgents.findIndex(a => a.id === agentId)
    return AGENT_BG_COLORS[idx % AGENT_BG_COLORS.length]
  }

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [])

  // Load agents from Agent Factory
  useEffect(() => {
    async function load() {
      setIsLoading(true)
      try {
        const [agentsRes, keysRes] = await Promise.all([
          fetch('/api/agent-factory/agents'),
          fetch('/api/api-hub'),
        ])
        if (agentsRes.ok) {
          const data = await agentsRes.json()
          setAllAgents((data.agents || []).filter((a: Agent) => a.isActive !== false))
        }
        if (keysRes.ok) {
          const keysData = await keysRes.json()
          const keys = keysData.keys || keysData.apiKeys || []
          const groq = keys.find((k: { serviceType: string; status: string }) => k.serviceType === 'groq' && k.status === 'active')
          setHasGroqKey(!!groq)
        }
      } catch (err) {
        console.error('Error loading agents:', err)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  // Toggle agent selection
  const toggleAgent = (agent: Agent) => {
    setSelectedAgents(prev => {
      const exists = prev.find(a => a.id === agent.id)
      if (exists) return prev.filter(a => a.id !== agent.id)
      if (prev.length >= 11) return prev // Max 11
      return [...prev, agent]
    })
  }

  // Send message
  const sendMessage = async () => {
    if (!input.trim() || isSending || selectedAgents.length === 0) return

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsSending(true)
    setError('')
    setRespondingAgents(selectedAgents.map(a => a.id))
    scrollToBottom()

    try {
      // Build history for API
      const history = messages.map(m => ({
        agentId: m.agentId || 'user',
        agentName: m.agentName || 'User',
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      }))

      const res = await fetch('/api/multi-agent-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.content,
          agents: selectedAgents.map(a => ({
            id: a.id,
            name: a.name,
            systemPrompt: a.systemPrompt,
            model: a.model,
            temperature: a.temperature,
            icon: a.icon,
          })),
          history,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Error del servidor' }))
        throw new Error(errData.error || `Error ${res.status}`)
      }

      const data = await res.json()
      const agentMessages: ChatMessage[] = (data.responses || []).map((r: AgentResponse) => ({
        id: `msg-${Date.now()}-${r.agentId}`,
        role: 'agent' as const,
        content: r.content,
        agentId: r.agentId,
        agentName: r.agentName,
        timestamp: Date.now(),
        engine: r.engine,
      }))

      setMessages(prev => [...prev, ...agentMessages])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error enviando mensaje')
    } finally {
      setIsSending(false)
      setRespondingAgents([])
      scrollToBottom()
    }
  }

  // Clear chat
  const clearChat = () => {
    setMessages([])
    setError('')
  }

  // ══════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-white">
              Multi-Agent Chat
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {es ? 'Conversa con múltiples agentes a la vez' : 'Chat with multiple agents simultaneously'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearChat}>
              <Trash2 className="w-4 h-4 mr-1" />
              {es ? 'Limpiar' : 'Clear'}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAgentPicker(!showAgentPicker)}
          >
            <Bot className="w-4 h-4 mr-1" />
            {selectedAgents.length}/{allAgents.length}
            {showAgentPicker ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
          </Button>
        </div>
      </div>

      {/* Groq Key Warning */}
      {hasGroqKey === false && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800"
        >
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <div className="flex-1 text-sm">
            <p className="font-medium text-amber-800 dark:text-amber-200">
              {es ? 'Groq API Key no configurada' : 'Groq API Key not configured'}
            </p>
            <p className="text-amber-600 dark:text-amber-400">
              {es
                ? 'Para velocidad máxima y costo cero, configura tu Groq key en API Hub. Sin ella usaremos engines alternativos.'
                : 'For best speed and zero cost, configure your Groq key in API Hub. Without it, alternative engines will be used.'}
            </p>
          </div>
          <a
            href="/dashboard/settings"
            className="text-xs font-medium text-amber-700 dark:text-amber-300 hover:underline flex-shrink-0"
          >
            API Hub →
          </a>
        </motion.div>
      )}

      {/* Agent Picker */}
      <AnimatePresence>
        {showAgentPicker && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="p-4 border border-zinc-200 dark:border-zinc-700">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                  <Settings2 className="w-4 h-4" />
                  {es ? 'Selecciona Agentes' : 'Select Agents'}
                  <span className="text-xs font-normal text-zinc-400">
                    ({selectedAgents.length}/11 {es ? 'máx' : 'max'})
                  </span>
                </h3>
                {selectedAgents.length > 0 && (
                  <button
                    onClick={() => setSelectedAgents([])}
                    className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  >
                    {es ? 'Quitar todos' : 'Remove all'}
                  </button>
                )}
              </div>

              {allAgents.length === 0 ? (
                <div className="text-center py-8">
                  <Bot className="w-10 h-10 mx-auto text-zinc-300 dark:text-zinc-600 mb-3" />
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {es ? 'No tienes agentes creados aún.' : 'No agents created yet.'}
                  </p>
                  <a
                    href="/dashboard/agent-factory"
                    className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline mt-1 inline-flex items-center gap-1"
                  >
                    {es ? 'Crear agentes' : 'Create agents'} <ArrowRight className="w-3 h-3" />
                  </a>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                  {allAgents.map((agent) => {
                    const isSelected = selectedAgents.some(a => a.id === agent.id)
                    const catIcon = CATEGORY_ICONS[agent.category || ''] || '🤖'
                    return (
                      <motion.button
                        key={agent.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => toggleAgent(agent)}
                        className={`relative p-3 rounded-lg border text-left transition-all ${
                          isSelected
                            ? 'border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-emerald-300 dark:ring-emerald-700'
                            : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 bg-white dark:bg-zinc-800/50'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                            <span className="text-white text-[10px] font-bold">
                              {selectedAgents.findIndex(a => a.id === agent.id) + 1}
                            </span>
                          </div>
                        )}
                        <div className="text-lg mb-1">{catIcon}</div>
                        <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                          {agent.name}
                        </p>
                        <p className="text-[10px] text-zinc-400 truncate mt-0.5">
                          {agent.category || 'General'}
                        </p>
                      </motion.button>
                    )
                  })}
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected Agents Bar */}
      {selectedAgents.length > 0 && !showAgentPicker && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {selectedAgents.map((agent, i) => (
            <span
              key={agent.id}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium text-white bg-gradient-to-r ${AGENT_COLORS[i % AGENT_COLORS.length]}`}
            >
              {agent.name}
              <button onClick={() => toggleAgent(agent)} className="hover:opacity-70">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Chat Area */}
      <div className="flex flex-col bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-700" style={{ height: 'calc(100vh - 340px)', minHeight: '400px' }}>
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && selectedAgents.length > 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="relative mb-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 flex items-center justify-center">
                  <MessageSquare className="w-8 h-8 text-emerald-500/50" />
                </div>
                <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-amber-400" />
              </div>
              <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                {es ? '¡Listo! Tus agentes están escuchando' : 'Ready! Your agents are listening'}
              </p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 max-w-md">
                {es
                  ? `${selectedAgents.map(a => a.name).join(', ')} responderán a tu mensaje. ${selectedAgents.length > 3 ? 'El router inteligente decidirá quién es relevante.' : ''}`
                  : `${selectedAgents.map(a => a.name).join(', ')} will respond. ${selectedAgents.length > 3 ? 'The smart router decides who is relevant.' : ''}`}
              </p>
            </div>
          )}

          {messages.length === 0 && selectedAgents.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Users className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mb-3" />
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {es ? 'Selecciona al menos un agente para comenzar' : 'Select at least one agent to start'}
              </p>
            </div>
          )}

          <AnimatePresence mode="popLayout">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'user' ? (
                  <div className="max-w-[70%] bg-emerald-600 text-white rounded-2xl rounded-br-md px-4 py-2.5">
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                ) : (
                  <div className={`max-w-[80%] rounded-2xl rounded-bl-md px-4 py-3 border ${getAgentBg(msg.agentId || '')}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${getAgentColor(msg.agentId || '')} flex items-center justify-center`}>
                        <span className="text-white text-[10px] font-bold">
                          {(msg.agentName || '?')[0].toUpperCase()}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        {msg.agentName}
                      </span>
                      {msg.engine && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400">
                          via {msg.engine}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Loading indicators */}
          {isSending && respondingAgents.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-wrap gap-2"
            >
              {respondingAgents.map((agentId) => {
                const agent = selectedAgents.find(a => a.id === agentId)
                if (!agent) return null
                return (
                  <div
                    key={agentId}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border ${getAgentBg(agentId)}`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${getAgentColor(agentId)} flex items-center justify-center`}>
                      <span className="text-white text-[9px] font-bold">{agent.name[0]}</span>
                    </div>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">{agent.name}</span>
                    <div className="flex gap-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )
              })}
            </motion.div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mb-2 p-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
            <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {error}
            </p>
          </div>
        )}

        {/* Input Area */}
        <div className="p-3 border-t border-zinc-200 dark:border-zinc-700">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              placeholder={
                selectedAgents.length === 0
                  ? (es ? 'Selecciona agentes primero...' : 'Select agents first...')
                  : (es ? 'Escribe tu mensaje...' : 'Type your message...')
              }
              disabled={isSending || selectedAgents.length === 0}
              rows={1}
              className="flex-1 resize-none rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-400 disabled:opacity-50 max-h-32"
              style={{ minHeight: '42px' }}
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isSending || selectedAgents.length === 0}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl px-4 h-[42px]"
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-[10px] text-zinc-400">
              {es ? 'Enter para enviar · Shift+Enter nueva línea' : 'Enter to send · Shift+Enter new line'}
            </p>
            {selectedAgents.length > 3 && (
              <p className="text-[10px] text-zinc-400 flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" />
                {es ? 'Router inteligente activo' : 'Smart router active'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
