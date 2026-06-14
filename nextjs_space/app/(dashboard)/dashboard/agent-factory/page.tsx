'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot,
  Plus,
  Code,
  Palette,
  Database,
  Workflow,
  Sparkles,
  Play,
  Pause,
  Settings,
  Trash2,
  Copy,
  ChevronRight,
  Layers,
  Paintbrush,
  BarChart3,
  Zap,
  X,
  Check,
  Send,
  MessageSquare,
  Loader2,
  StopCircle,
  Pencil,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AGENT_CATEGORIES, AGENT_TEMPLATES, type CustomAgent, type AgentCategory, type AgentTemplate } from '@/lib/agent-factory-types'
import { useMetrics } from '@/lib/metrics-context'
import { useI18n } from '@/lib/i18n-context'
import { usePlanGate } from '@/hooks/use-plan-gate'
import { UpgradeModal } from '@/components/upgrade-modal'

const iconMap: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Code,
  Palette,
  Database,
  Workflow,
  Sparkles,
  Layers,
  Paintbrush,
  BarChart3,
  Bot,
}

export default function AgentFactoryPage() {
  const [agents, setAgents] = useState<CustomAgent[]>([])
  const { t, locale } = useI18n()
  const isEn = locale === 'en'
  const catName = (key: string, esName: string): string => {
    if (!isEn) return esName
    const map: Record<string, string> = {
      code: 'Code',
      design: 'Design',
      data: 'Data',
      automation: 'Automation',
      custom: 'Custom',
    }
    return map[key] || esName
  }
  const [selectedCategory, setSelectedCategory] = useState<AgentCategory | 'all'>('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplate | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [newAgent, setNewAgent] = useState({
    name: '',
    description: '',
    systemPrompt: '',
    category: 'code' as AgentCategory,
    model: 'gpt-4.1',
    temperature: 0.7,
    maxTokens: 4096,
  })
  const { addActivity } = useMetrics()
  const { upgradeModal, closeUpgradeModal, showUpgradeModal, usage } = usePlanGate()

  // Edit state
  const [editAgent, setEditAgent] = useState<CustomAgent | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    systemPrompt: '',
    category: 'code' as AgentCategory,
    model: 'gpt-4.1',
    temperature: 0.7,
    maxTokens: 4096,
  })

  const openEditModal = (agent: CustomAgent) => {
    setEditAgent(agent)
    setEditForm({
      name: agent.name,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
      category: agent.category,
      model: agent.model,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
    })
  }

  const handleSaveEdit = async () => {
    if (!editAgent || !editForm.name || !editForm.systemPrompt) return
    const updated = agents.map((a) =>
      a.id === editAgent.id
        ? {
            ...a,
            name: editForm.name,
            description: editForm.description,
            systemPrompt: editForm.systemPrompt,
            category: editForm.category,
            model: editForm.model,
            temperature: editForm.temperature,
            maxTokens: editForm.maxTokens,
            updatedAt: new Date(),
          }
        : a
    )
    const editedAgent = updated.find((a) => a.id === editAgent.id)!
    await saveAgentToDB(editedAgent, 'PATCH')
    await loadAgents()
    addActivity(`✏️ Agente editado: ${editForm.name}`)
    setEditAgent(null)
  }

  // Chat state
  type ChatMsg = { role: 'user' | 'assistant'; content: string }
  const [chatAgent, setChatAgent] = useState<CustomAgent | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => { scrollToBottom() }, [chatMessages, scrollToBottom])

  const openChat = (agent: CustomAgent) => {
    setChatAgent(agent)
    setChatMessages([])
    setChatInput('')
    setChatLoading(false)
    addActivity(`💬 Probando agente: ${agent.name}`)
  }

  const sendMessage = async () => {
    if (!chatInput.trim() || !chatAgent || chatLoading) return
    const userMsg: ChatMsg = { role: 'user', content: chatInput.trim() }
    const newMessages = [...chatMessages, userMsg]
    setChatMessages(newMessages)
    setChatInput('')
    setChatLoading(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/agent-factory/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          systemPrompt: chatAgent.systemPrompt,
          model: chatAgent.model,
          temperature: chatAgent.temperature,
          maxTokens: chatAgent.maxTokens,
          agentId: chatAgent.name,
        }),
        signal: controller.signal,
      })

      if (!res.ok) throw new Error('Error del servidor')

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No stream')
      const decoder = new TextDecoder()
      let assistantContent = ''
      setChatMessages(prev => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') break
          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta?.content
            if (delta) {
              assistantContent += delta
              const content = assistantContent
              setChatMessages(prev => {
                const copy = [...prev]
                copy[copy.length - 1] = { role: 'assistant', content }
                return copy
              })
            }
          } catch { /* skip non-json lines */ }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setChatMessages(prev => [...prev, { role: 'assistant', content: '❌ Error al conectar con el modelo. Intenta de nuevo.' }])
    } finally {
      setChatLoading(false)
      abortRef.current = null
    }
  }

  const stopGeneration = () => {
    abortRef.current?.abort()
    setChatLoading(false)
  }

  // Load agents from database API
  const loadAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/agent-factory/agents')
      const data = await res.json()
      const agentList = data.agents || []
      setAgents(agentList.map((a: Record<string, unknown>) => ({
        ...a,
        color: '#C4622D',
        capabilities: [],
        maxTokens: 4096,
        createdAt: new Date(a.createdAt as string),
        updatedAt: new Date(a.updatedAt as string),
      })))
      // Clean up any stale localStorage (migration period ended)
      try { localStorage.removeItem('octopus-agents') } catch {}
    } catch (err) {
      console.error('[Agent Factory] Error loading agents:', err)
    }
  }, [])

  useEffect(() => {
    loadAgents()
  }, [loadAgents])

  const saveAgentToDB = async (agent: CustomAgent, method: 'POST' | 'PATCH' = 'POST') => {
    try {
      const res = await fetch('/api/agent-factory/agents', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(method === 'PATCH' ? { id: agent.id } : {}),
          name: agent.name,
          description: agent.description,
          model: agent.model,
          category: agent.category,
          systemPrompt: agent.systemPrompt,
          icon: agent.icon,
          temperature: agent.temperature,
          isActive: agent.isActive,
        }),
      })
      const data = await res.json()
      return data.agent
    } catch (err) {
      console.error('[Agent Factory] Error saving agent:', err)
      return null
    }
  }

  const deleteAgentFromDB = async (agentId: string) => {
    try {
      await fetch(`/api/agent-factory/agents?id=${agentId}`, { method: 'DELETE' })
    } catch (err) {
      console.error('[Agent Factory] Error deleting agent:', err)
    }
  }

  const handleSelectTemplate = (template: AgentTemplate) => {
    setSelectedTemplate(template)
    setNewAgent({
      name: template.name,
      description: template.description,
      systemPrompt: template.systemPrompt,
      category: template.category,
      model: 'gpt-4.1',
      temperature: 0.7,
      maxTokens: 4096,
    })
  }

  const handleCreateAgent = () => {
    if (!newAgent.name || !newAgent.systemPrompt) return

    setIsCreating(true)

    setTimeout(async () => {
      const agent: CustomAgent = {
        id: `agent-${Date.now()}`,
        name: newAgent.name,
        description: newAgent.description,
        category: newAgent.category,
        icon: selectedTemplate?.icon || 'Bot',
        color: AGENT_CATEGORIES[newAgent.category]?.color || '#C4622D',
        systemPrompt: newAgent.systemPrompt,
        capabilities: [],
        model: newAgent.model,
        temperature: newAgent.temperature,
        maxTokens: newAgent.maxTokens,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      // Plan gate: check agent limit (client-side, localStorage)
      const agentLimit = usage?.agents?.limit ?? 3
      if (agents.length >= agentLimit && usage?.planId === 'starter') {
        showUpgradeModal('agents', agents.length, agentLimit, 'pro')
        setIsCreating(false)
        return
      }

      await saveAgentToDB(agent, 'POST')
      await loadAgents()
      addActivity(`🤖 Nuevo agente creado: ${agent.name}`)
      setShowCreateModal(false)
      setSelectedTemplate(null)
      setNewAgent({
        name: '',
        description: '',
        systemPrompt: '',
        category: 'code',
        model: 'gpt-4.1',
        temperature: 0.7,
        maxTokens: 4096,
      })
      setIsCreating(false)
    }, 1500)
  }

  const toggleAgentStatus = async (agentId: string) => {
    const agent = agents.find((a) => a.id === agentId)
    if (!agent) return
    const toggled = { ...agent, isActive: !agent.isActive, updatedAt: new Date() }
    await saveAgentToDB(toggled, 'PATCH')
    await loadAgents()
    addActivity(`🤖 Agente ${agent.name}: ${agent.isActive ? 'Desactivado' : 'Activado'}`)
  }

  const deleteAgent = async (agentId: string) => {
    const agent = agents.find((a) => a.id === agentId)
    await deleteAgentFromDB(agentId)
    await loadAgents()
    if (agent) {
      addActivity(`🗑️ Agente eliminado: ${agent.name}`)
    }
  }

  const duplicateAgent = async (agent: CustomAgent) => {
    const duplicate: CustomAgent = {
      ...agent,
      id: `agent-${Date.now()}`,
      name: `${agent.name} (copia)`,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    await saveAgentToDB(duplicate, 'POST')
    await loadAgents()
    addActivity(`📋 Agente duplicado: ${duplicate.name}`)
  }

  const filteredAgents =
    selectedCategory === 'all' ? agents : agents.filter((a) => a.category === selectedCategory)

  const activeAgents = agents.filter((a) => a.isActive).length

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1A1A1A] flex items-center gap-3">
            <Bot className="w-8 h-8 text-[#2D4A3E]" />
            {t('agents.title')}
          </h1>
          <p className="text-[#1A1A1A]/60 mt-2">
            {t('agents.subtitle')}
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          {t('agents.create')}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-[#2D4A3E] to-[#2D4A3E]/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white/60 text-sm">{isEn ? 'Total Agents' : 'Total Agentes'}</p>
              <p className="text-2xl font-bold text-white">{agents.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-[#C4622D] to-[#C4622D]/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Play className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white/60 text-sm">{isEn ? 'Active' : 'Activos'}</p>
              <p className="text-2xl font-bold text-white">{activeAgents}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-[#4A90D9] to-[#4A90D9]/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white/60 text-sm">{isEn ? 'Tasks Today' : 'Tareas Hoy'}</p>
              <p className="text-2xl font-bold text-white">--</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-[#9B59B6] to-[#9B59B6]/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white/60 text-sm">{isEn ? 'Templates' : 'Plantillas'}</p>
              <p className="text-2xl font-bold text-white">{AGENT_TEMPLATES.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            selectedCategory === 'all'
              ? 'bg-[#2D4A3E] text-white'
              : 'bg-[#F5F0E8] text-[#1A1A1A]/60 hover:bg-[#2D4A3E]/10'
          }`}
        >
          {isEn ? 'All' : 'Todos'}
        </button>
        {Object.entries(AGENT_CATEGORIES).map(([key, cat]) => {
          const IconComp = iconMap[cat.icon] || Bot
          return (
            <button
              key={key}
              onClick={() => setSelectedCategory(key as AgentCategory)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                selectedCategory === key
                  ? 'bg-[#2D4A3E] text-white'
                  : 'bg-[#F5F0E8] text-[#1A1A1A]/60 hover:bg-[#2D4A3E]/10'
              }`}
            >
              <IconComp className="w-4 h-4" />
              {catName(key, cat.name)}
            </button>
          )
        })}
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {filteredAgents.map((agent, index) => {
            const IconComp = iconMap[agent.icon] || Bot
            return (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="p-6 hover:shadow-lg transition-all group">
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className="p-3 rounded-2xl"
                      style={{ backgroundColor: `${agent.color}20` }}
                    >
                      <IconComp className="w-6 h-6" style={{ color: agent.color }} />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleAgentStatus(agent.id)}
                        className={`p-2 rounded-xl transition-all ${
                          agent.isActive
                            ? 'bg-green-100 text-green-600'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {agent.isActive ? (
                          <Play className="w-4 h-4" />
                        ) : (
                          <Pause className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => openEditModal(agent)}
                        title={isEn ? 'Edit agent' : 'Editar agente'}
                        className="p-2 rounded-xl bg-blue-100 text-blue-600 hover:bg-blue-200 transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => duplicateAgent(agent)}
                        className="p-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteAgent(agent.id)}
                        className="p-2 rounded-xl bg-red-100 text-red-600 hover:bg-red-200 transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-bold text-lg text-[#1A1A1A] mb-1">{agent.name}</h3>
                  <p className="text-sm text-[#1A1A1A]/60 mb-4 line-clamp-2">
                    {agent.description}
                  </p>

                  <div className="flex items-center gap-2 text-xs text-[#1A1A1A]/40">
                    <span
                      className="px-2 py-1 rounded-lg"
                      style={{ backgroundColor: `${agent.color}15`, color: agent.color }}
                    >
                      {catName(agent.category, AGENT_CATEGORIES[agent.category]?.name || agent.category)}
                    </span>
                    <span className="px-2 py-1 rounded-lg bg-gray-100">
                      {agent.model}
                    </span>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                    <div
                      className={`flex items-center gap-2 text-sm ${
                        agent.isActive ? 'text-green-600' : 'text-gray-400'
                      }`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${
                          agent.isActive ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      />
                      {agent.isActive ? (isEn ? 'Active' : 'Activo') : (isEn ? 'Inactive' : 'Inactivo')}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(agent)}
                        className="px-3 py-1.5 bg-[#F5F0E8] text-[#2D4A3E] rounded-xl text-sm font-medium hover:bg-[#E8E0D4] transition-colors flex items-center gap-1.5"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        {isEn ? 'Edit' : 'Editar'}
                      </button>
                      <button
                        onClick={() => openChat(agent)}
                        className="px-3 py-1.5 bg-[#C4622D] text-white rounded-xl text-sm font-medium hover:bg-[#A8501F] transition-colors flex items-center gap-1.5"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        {isEn ? 'Test' : 'Probar'}
                      </button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </AnimatePresence>

        {filteredAgents.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="col-span-full py-16 text-center"
          >
            <Bot className="w-16 h-16 mx-auto text-[#1A1A1A]/20 mb-4" />
            <p className="text-[#1A1A1A]/40 mb-4">{isEn ? 'No agents in this category' : 'No hay agentes en esta categoría'}</p>
            <Button onClick={() => setShowCreateModal(true)} variant="outline">
              {isEn ? 'Create your first agent' : 'Crear tu primer agente'}
            </Button>
          </motion.div>
        )}
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => !isCreating && setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-[#1A1A1A]">{isEn ? 'Create New Agent' : 'Crear Nuevo Agente'}</h2>
                <button
                  onClick={() => !isCreating && setShowCreateModal(false)}
                  className="p-2 rounded-xl hover:bg-gray-100 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {!selectedTemplate ? (
                <>
                  <p className="text-[#1A1A1A]/60 mb-6">{isEn ? 'Select a template or create from scratch' : 'Selecciona una plantilla o crea desde cero'}</p>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    {AGENT_TEMPLATES.map((template) => {
                      const IconComp = iconMap[template.icon] || Bot
                      return (
                        <button
                          key={template.id}
                          onClick={() => handleSelectTemplate(template)}
                          className="p-4 rounded-2xl border-2 border-gray-100 hover:border-[#2D4A3E] transition-all text-left group"
                        >
                          <div
                            className="p-3 rounded-xl w-fit mb-3"
                            style={{ backgroundColor: `${template.color}20` }}
                          >
                            <IconComp className="w-5 h-5" style={{ color: template.color }} />
                          </div>
                          <h3 className="font-bold text-[#1A1A1A] group-hover:text-[#2D4A3E] transition-colors">
                            {template.name}
                          </h3>
                          <p className="text-sm text-[#1A1A1A]/60 mt-1 line-clamp-2">
                            {template.description}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                  <button
                    onClick={() =>
                      setSelectedTemplate({
                        id: 'custom',
                        name: '',
                        description: '',
                        category: 'custom',
                        icon: 'Bot',
                        color: '#E67E22',
                        systemPrompt: '',
                        suggestedCapabilities: [],
                      })
                    }
                    className="w-full p-4 rounded-2xl border-2 border-dashed border-gray-200 hover:border-[#C4622D] transition-all text-center"
                  >
                    <Plus className="w-6 h-6 mx-auto text-[#1A1A1A]/40 mb-2" />
                    <p className="font-medium text-[#1A1A1A]/60">{isEn ? 'Create from scratch' : 'Crear desde cero'}</p>
                  </button>
                </>
              ) : (
                <>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[#1A1A1A] mb-2">
                        {isEn ? 'Agent Name *' : 'Nombre del Agente *'}
                      </label>
                      <input
                        type="text"
                        value={newAgent.name}
                        onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2D4A3E] focus:ring-2 focus:ring-[#2D4A3E]/20 outline-none"
                        placeholder={isEn ? 'E.g.: Frontend Specialist' : 'Ej: Frontend Specialist'}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#1A1A1A] mb-2">
                        {isEn ? 'Description' : 'Descripción'}
                      </label>
                      <input
                        type="text"
                        value={newAgent.description}
                        onChange={(e) => setNewAgent({ ...newAgent, description: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2D4A3E] focus:ring-2 focus:ring-[#2D4A3E]/20 outline-none"
                        placeholder={isEn ? 'What does this agent do?' : '¿Qué hace este agente?'}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#1A1A1A] mb-2">
                        System Prompt *
                      </label>
                      <textarea
                        value={newAgent.systemPrompt}
                        onChange={(e) => setNewAgent({ ...newAgent, systemPrompt: e.target.value })}
                        rows={4}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2D4A3E] focus:ring-2 focus:ring-[#2D4A3E]/20 outline-none resize-none"
                        placeholder={isEn ? "Define the agent's personality and capabilities..." : 'Define la personalidad y capacidades del agente...'}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-[#1A1A1A] mb-2">
                          {isEn ? 'Category' : 'Categoría'}
                        </label>
                        <select
                          value={newAgent.category}
                          onChange={(e) =>
                            setNewAgent({ ...newAgent, category: e.target.value as AgentCategory })
                          }
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2D4A3E] focus:ring-2 focus:ring-[#2D4A3E]/20 outline-none bg-white"
                        >
                          {Object.entries(AGENT_CATEGORIES).map(([key, cat]) => (
                            <option key={key} value={key}>
                              {catName(key, cat.name)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#1A1A1A] mb-2">
                          {isEn ? 'Model' : 'Modelo'}
                        </label>
                        <select
                          value={newAgent.model}
                          onChange={(e) => setNewAgent({ ...newAgent, model: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2D4A3E] focus:ring-2 focus:ring-[#2D4A3E]/20 outline-none bg-white"
                        >
                          <option value="gpt-4.1">GPT-4.1</option>
                          <option value="gpt-4o-mini">GPT-4o Mini</option>
                          <option value="claude-3-7-sonnet-20250219">Claude 3.7 Sonnet</option>
                          <option value="kimi-k2">Kimi K2</option>
                          <option value="qwen-max">Qwen Max</option>
                          <option value="qwen-plus">Qwen Plus</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-[#1A1A1A] mb-2">
                          {isEn ? 'Temperature' : 'Temperatura'}: {newAgent.temperature}
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={newAgent.temperature}
                          onChange={(e) =>
                            setNewAgent({ ...newAgent, temperature: parseFloat(e.target.value) })
                          }
                          className="w-full accent-[#2D4A3E]"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#1A1A1A] mb-2">
                          Max Tokens
                        </label>
                        <input
                          type="number"
                          value={newAgent.maxTokens}
                          onChange={(e) =>
                            setNewAgent({ ...newAgent, maxTokens: parseInt(e.target.value) })
                          }
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2D4A3E] focus:ring-2 focus:ring-[#2D4A3E]/20 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-8">
                    <Button
                      variant="outline"
                      onClick={() => setSelectedTemplate(null)}
                      className="flex-1"
                      disabled={isCreating}
                    >
                      {isEn ? 'Back' : 'Volver'}
                    </Button>
                    <Button
                      onClick={handleCreateAgent}
                      className="flex-1 gap-2"
                      disabled={!newAgent.name || !newAgent.systemPrompt || isCreating}
                    >
                      {isCreating ? (
                        <>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          >
                            <Settings className="w-4 h-4" />
                          </motion.div>
                          {isEn ? 'Creating...' : 'Creando...'}
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          {isEn ? 'Create Agent' : 'Crear Agente'}
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {editAgent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setEditAgent(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-[#1A1A1A] flex items-center gap-2">
                  <Pencil className="w-5 h-5 text-[#C4622D]" />
                  {isEn ? 'Edit Agent' : 'Editar Agente'}
                </h2>
                <button
                  onClick={() => setEditAgent(null)}
                  className="p-2 rounded-xl hover:bg-gray-100 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#1A1A1A] mb-2">
                    {isEn ? 'Agent Name *' : 'Nombre del Agente *'}
                  </label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2D4A3E] focus:ring-2 focus:ring-[#2D4A3E]/20 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#1A1A1A] mb-2">
                    {isEn ? 'Description' : 'Descripción'}
                  </label>
                  <input
                    type="text"
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2D4A3E] focus:ring-2 focus:ring-[#2D4A3E]/20 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#1A1A1A] mb-2">
                    System Prompt *
                  </label>
                  <textarea
                    value={editForm.systemPrompt}
                    onChange={(e) => setEditForm({ ...editForm, systemPrompt: e.target.value })}
                    rows={8}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2D4A3E] focus:ring-2 focus:ring-[#2D4A3E]/20 outline-none resize-y font-mono text-sm"
                    placeholder={isEn ? "Define the agent's personality and capabilities..." : 'Define la personalidad y capacidades del agente...'}
                  />
                  <p className="text-xs text-[#1A1A1A]/40 mt-1">
                    {isEn ? `${editForm.systemPrompt.length} characters` : `${editForm.systemPrompt.length} caracteres`}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#1A1A1A] mb-2">
                      {isEn ? 'Category' : 'Categoría'}
                    </label>
                    <select
                      value={editForm.category}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value as AgentCategory })}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2D4A3E] focus:ring-2 focus:ring-[#2D4A3E]/20 outline-none bg-white"
                    >
                      {Object.entries(AGENT_CATEGORIES).map(([key, cat]) => (
                        <option key={key} value={key}>
                          {catName(key, cat.name)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#1A1A1A] mb-2">
                      {isEn ? 'Model' : 'Modelo'}
                    </label>
                    <select
                      value={editForm.model}
                      onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2D4A3E] focus:ring-2 focus:ring-[#2D4A3E]/20 outline-none bg-white"
                    >
                      <option value="gpt-4.1">GPT-4.1</option>
                      <option value="gpt-4o-mini">GPT-4o Mini</option>
                      <option value="claude-3-7-sonnet-20250219">Claude 3.7 Sonnet</option>
                      <option value="kimi-k2">Kimi K2</option>
                      <option value="qwen-max">Qwen Max</option>
                      <option value="qwen-plus">Qwen Plus</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#1A1A1A] mb-2">
                      {isEn ? 'Temperature' : 'Temperatura'}: {editForm.temperature}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={editForm.temperature}
                      onChange={(e) => setEditForm({ ...editForm, temperature: parseFloat(e.target.value) })}
                      className="w-full accent-[#2D4A3E]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#1A1A1A] mb-2">
                      Max Tokens
                    </label>
                    <input
                      type="number"
                      value={editForm.maxTokens}
                      onChange={(e) => setEditForm({ ...editForm, maxTokens: parseInt(e.target.value) || 4096 })}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2D4A3E] focus:ring-2 focus:ring-[#2D4A3E]/20 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <Button
                  variant="outline"
                  onClick={() => setEditAgent(null)}
                  className="flex-1"
                >
                  {isEn ? 'Cancel' : 'Cancelar'}
                </Button>
                <Button
                  onClick={handleSaveEdit}
                  className="flex-1 gap-2"
                  disabled={!editForm.name || !editForm.systemPrompt}
                >
                  <Check className="w-4 h-4" />
                  {isEn ? 'Save Changes' : 'Guardar Cambios'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Modal */}
      <AnimatePresence>
        {chatAgent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => { setChatAgent(null); abortRef.current?.abort() }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden"
            >
              {/* Chat Header */}
              <div className="flex items-center gap-3 p-4 border-b border-[#E8E0D4]" style={{ background: `linear-gradient(135deg, ${chatAgent.color}10, ${chatAgent.color}05)` }}>
                <div className="p-2 rounded-xl" style={{ backgroundColor: `${chatAgent.color}20` }}>
                  {(() => { const Ic = iconMap[chatAgent.icon] || Bot; return <Ic className="w-5 h-5" style={{ color: chatAgent.color }} />; })()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-[#1A1A1A] truncate">{chatAgent.name}</h3>
                  <p className="text-xs text-[#1A1A1A]/50 flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-[#F5F0E8] font-mono text-[10px]">{chatAgent.model}</span>
                    <span>T: {chatAgent.temperature}</span>
                  </p>
                </div>
                <button
                  onClick={() => { setChatMessages([]); setChatInput('') }}
                  className="px-3 py-1.5 text-xs text-[#1A1A1A]/50 hover:text-[#1A1A1A] hover:bg-[#F5F0E8] rounded-lg transition-colors"
                >
                  {isEn ? 'Clear' : 'Limpiar'}
                </button>
                <button onClick={() => { setChatAgent(null); abortRef.current?.abort() }} className="p-1.5 hover:bg-[#F5F0E8] rounded-lg transition-colors">
                  <X className="w-4 h-4 text-[#1A1A1A]/60" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatMessages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="p-4 rounded-2xl mb-4" style={{ backgroundColor: `${chatAgent.color}10` }}>
                      {(() => { const Ic = iconMap[chatAgent.icon] || Bot; return <Ic className="w-10 h-10" style={{ color: chatAgent.color }} />; })()}
                    </div>
                    <h4 className="font-bold text-[#1A1A1A] mb-1">{isEn ? `Talk to ${chatAgent.name}` : `Habla con ${chatAgent.name}`}</h4>
                    <p className="text-sm text-[#1A1A1A]/50 max-w-sm mb-4">{chatAgent.description}</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {(isEn ? ['What can you do?', 'How can you help?', 'Give me an example'] : ['¿Qué puedes hacer?', '¿Cómo me ayudas?', 'Dame un ejemplo']).map((q) => (
                        <button
                          key={q}
                          onClick={() => { setChatInput(q); }}
                          className="px-3 py-1.5 bg-[#F5F0E8] text-[#2D4A3E] rounded-full text-xs hover:bg-[#E8E0D4] transition-colors"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {chatMessages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-[#2D4A3E] text-white rounded-br-md'
                        : 'bg-[#F5F0E8] text-[#1A1A1A] rounded-bl-md'
                    }`}>
                      {msg.role === 'assistant' && (
                        <div className="flex items-center gap-1.5 mb-1">
                          <Bot className="w-3 h-3" style={{ color: chatAgent.color }} />
                          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: chatAgent.color }}>{chatAgent.name}</span>
                        </div>
                      )}
                      <div className="text-sm whitespace-pre-wrap leading-relaxed">
                        {(() => {
                          // Parse markdown images ![alt](url) and render them inline
                          const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
                          const parts: React.ReactNode[] = []
                          let lastIdx = 0
                          let match: RegExpExecArray | null
                          const content = msg.content
                          while ((match = imgRegex.exec(content)) !== null) {
                            if (match.index > lastIdx) {
                              parts.push(<span key={`t-${lastIdx}`}>{content.slice(lastIdx, match.index)}</span>)
                            }
                            parts.push(
                              <span key={`img-${match.index}`} className="block my-3">
                                <img
                                  src={match[2]}
                                  alt={match[1] || 'Imagen generada'}
                                  className="rounded-xl max-w-full shadow-lg border border-[#E8E0D4]"
                                  style={{ maxHeight: 400 }}
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                                />
                              </span>
                            )
                            lastIdx = match.index + match[0].length
                          }
                          if (lastIdx < content.length) {
                            parts.push(<span key={`t-${lastIdx}`}>{content.slice(lastIdx)}</span>)
                          }
                          return parts.length > 0 ? parts : content
                        })()}
                        {chatLoading && i === chatMessages.length - 1 && msg.role === 'assistant' && !msg.content && (
                          <span className="inline-flex gap-1 ml-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '300ms' }} />
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-[#E8E0D4]">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                    placeholder={isEn ? `Type a message to ${chatAgent.name}...` : `Escribe un mensaje a ${chatAgent.name}...`}
                    disabled={chatLoading}
                    className="flex-1 px-4 py-3 bg-[#F5F0E8] border border-[#E8E0D4] rounded-xl text-sm text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30 focus:border-[#C4622D] disabled:opacity-60"
                  />
                  {chatLoading ? (
                    <button
                      onClick={stopGeneration}
                      className="p-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors"
                    >
                      <StopCircle className="w-5 h-5" />
                    </button>
                  ) : (
                    <button
                      onClick={sendMessage}
                      disabled={!chatInput.trim()}
                      className="p-3 bg-[#C4622D] text-white rounded-xl hover:bg-[#A8501F] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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