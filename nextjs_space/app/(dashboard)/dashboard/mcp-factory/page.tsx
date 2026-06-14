'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plug,
  Plus,
  MessageCircle,
  HardDrive,
  GitBranch,
  Brain,
  Calendar,
  Cloud,
  Mail,
  Send,
  Sparkles,
  FileText,
  Github,
  Check,
  X,
  RefreshCw,
  Trash2,
  Zap,
  ChevronRight,
  ChevronDown,
  Link,
  Shield,
  Search,
  Wand2,
  Code2,
  BookOpen,
  Star,
  Copy,
  ExternalLink,
  Loader2,
  Cpu,
  Eye,
  EyeOff,
  Settings,
  AlertTriangle,
  Save,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MCP_CATEGORIES, MCP_TEMPLATES, type MCPServer, type MCPCategory } from '@/lib/mcp-factory-types'
import { useMetrics } from '@/lib/metrics-context'
import { useI18n } from '@/lib/i18n-context'

const iconMap: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  MessageCircle, HardDrive, GitBranch, Brain, Calendar, Plug, Cloud, Mail, Send, Sparkles, FileText, Github,
}

interface GeneratedTool {
  name: string
  description: string
  inputSchema?: {
    type: string
    properties: Record<string, { type: string; description: string }>
    required?: string[]
  }
}

interface GeneratedResource {
  uri: string
  name: string
  description: string
  mimeType?: string
}

interface GeneratedPrompt {
  name: string
  description: string
  arguments?: { name: string; description: string; required: boolean }[]
}

interface GeneratedConfig {
  name: string
  description: string
  category: string
  icon: string
  color: string
  capabilities: string[]
  version: string
  tools: GeneratedTool[]
  resources: GeneratedResource[]
  prompts: GeneratedPrompt[]
  configExample: Record<string, unknown>
  inspiradoEn: string[]
  readme: string
}

interface PatternMatch {
  name: string
  author: string
  category: string
  stars: number
}

const SUGGESTION_KEYS: { key: string; icon: string }[] = [
  { key: 'mcp.sug_social', icon: '📱' },
  { key: 'mcp.sug_db', icon: '🗄️' },
  { key: 'mcp.sug_monitor', icon: '📡' },
  { key: 'mcp.sug_code', icon: '💻' },
  { key: 'mcp.sug_pdf', icon: '📄' },
  { key: 'mcp.sug_chat', icon: '💬' },
]

export default function MCPFactoryPage() {
  const [servers, setServers] = useState<MCPServer[]>([])
  const { t } = useI18n()
  const [selectedCategory, setSelectedCategory] = useState<MCPCategory | 'all'>('all')
  const [showConnectModal, setShowConnectModal] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<Partial<MCPServer> | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionConfig, setConnectionConfig] = useState({ endpoint: '', apiKey: '' })
  const { addActivity } = useMetrics()

  // AI Generation state
  const [activeTab, setActiveTab] = useState<'ai' | 'templates' | 'connected'>('ai')
  const [aiQuery, setAiQuery] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedConfig, setGeneratedConfig] = useState<GeneratedConfig | null>(null)
  const [patterns, setPatterns] = useState<PatternMatch[]>([])
  const [generationError, setGenerationError] = useState('')
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    tools: true, resources: false, prompts: false, config: false, readme: false,
  })
  const [copiedField, setCopiedField] = useState('')
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [configServer, setConfigServer] = useState<MCPServer | null>(null)
  const [configTab, setConfigTab] = useState<'details' | 'tools' | 'connection'>('details')
  const [configEdits, setConfigEdits] = useState({ endpoint: '', apiKey: '' })
  const [showApiKey, setShowApiKey] = useState(false)
  const [configSaved, setConfigSaved] = useState(false)

  const loadServers = useCallback(async () => {
    try {
      const res = await fetch('/api/mcp-factory/servers')
      if (res.ok) {
        const data = await res.json()
        const dbServers: MCPServer[] = (data.servers || []).map((s: MCPServer & { lastSync?: string }) => ({
          ...s,
          lastSync: s.lastSync ? new Date(s.lastSync) : undefined,
        }))
        // Clean up any leftover localStorage data (migration period over)
        localStorage.removeItem('octopus-mcp-servers')
        setServers(dbServers)
      }
    } catch (err) {
      console.error('[MCP Factory] Error loading servers:', err)
    }
  }, [])

  useEffect(() => {
    loadServers()
  }, [loadServers])

  const saveServerToDB = async (server: MCPServer, method: 'POST' | 'PATCH' = 'POST') => {
    try {
      await fetch('/api/mcp-factory/servers', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(method === 'PATCH' ? { id: server.id } : {}),
          name: server.name,
          description: server.description,
          category: server.category,
          icon: server.icon,
          color: server.color,
          endpoint: server.endpoint,
          apiKey: server.apiKey,
          isConnected: server.isConnected,
          capabilities: server.capabilities,
          version: server.version,
          lastSync: server.lastSync,
        }),
      })
    } catch (err) {
      console.error('[MCP Factory] Error saving server:', err)
    }
  }

  const deleteServerFromDB = async (serverId: string) => {
    try {
      await fetch(`/api/mcp-factory/servers?id=${serverId}`, { method: 'DELETE' })
    } catch (err) {
      console.error('[MCP Factory] Error deleting server:', err)
    }
  }

  const handleSelectTemplate = (template: Partial<MCPServer>) => {
    setSelectedTemplate(template)
    setConnectionConfig({ endpoint: '', apiKey: '' })
  }

  const handleConnectMCP = () => {
    if (!selectedTemplate || !connectionConfig.endpoint) return
    setIsConnecting(true)
    setTimeout(async () => {
      const server: MCPServer = {
        id: `mcp-${Date.now()}`,
        name: selectedTemplate.name || 'Custom MCP',
        description: selectedTemplate.description || '',
        category: (selectedTemplate.category || 'custom') as MCPCategory,
        icon: selectedTemplate.icon || 'Plug',
        color: selectedTemplate.color || '#1ABC9C',
        endpoint: connectionConfig.endpoint,
        apiKey: connectionConfig.apiKey || undefined,
        isConnected: true,
        capabilities: selectedTemplate.capabilities || [],
        version: selectedTemplate.version || '1.0.0',
        lastSync: new Date(),
      }
      await saveServerToDB(server, 'POST')
      await loadServers()
      addActivity(`🔌 ${t('mcp.activity_connected')} ${server.name}`)
      setShowConnectModal(false)
      setSelectedTemplate(null)
      setConnectionConfig({ endpoint: '', apiKey: '' })
      setIsConnecting(false)
    }, 2000)
  }

  const handleConnectGenerated = () => {
    if (!generatedConfig) return
    setIsConnecting(true)
    setTimeout(async () => {
      const server: MCPServer = {
        id: `mcp-ai-${Date.now()}`,
        name: generatedConfig.name,
        description: generatedConfig.description,
        category: (generatedConfig.category as MCPCategory) || 'custom',
        icon: generatedConfig.icon || 'Sparkles',
        color: generatedConfig.color || '#C4622D',
        endpoint: `mcp://generated/${generatedConfig.name.toLowerCase().replace(/\s+/g, '-')}`,
        isConnected: true,
        capabilities: generatedConfig.capabilities || [],
        version: generatedConfig.version || '1.0.0',
        lastSync: new Date(),
      }
      await saveServerToDB(server, 'POST')
      await loadServers()
      addActivity(`🐙 ${t('mcp.activity_generated')} ${server.name}`)
      setIsConnecting(false)
      setActiveTab('connected')
    }, 1500)
  }

  const toggleServerConnection = async (serverId: string) => {
    if (togglingId) return
    setTogglingId(serverId)
    const server = servers.find((s) => s.id === serverId)
    if (!server) { setTogglingId(null); return }
    try {
      if (server.isConnected) {
        // Desconectar: directo
        const toggled: MCPServer = { ...server, isConnected: false }
        await saveServerToDB(toggled, 'PATCH')
        await loadServers()
        addActivity(`🔌 MCP ${server.name}: ${t('mcp.disconnected_status')}`)
      } else {
        // Conectar: test REAL de conexión al endpoint
        const res = await fetch('/api/mcp-factory/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: serverId }),
        })
        const data = await res.json()
        await loadServers()
        if (data.connected) {
          addActivity(`✅ MCP ${server.name}: conexión verificada (${data.latency}ms)`)
        } else {
          addActivity(`❌ MCP ${server.name}: ${data.error || 'no se pudo conectar al endpoint'}`)
        }
      }
    } catch {
      addActivity(`❌ MCP ${server.name}: error probando la conexión`)
    } finally {
      setTogglingId(null)
    }
  }

  // Test de conexión real desde el modal de configuración
  const [testingConnection, setTestingConnection] = useState(false)
  const [testResult, setTestResult] = useState<{ connected: boolean; latency?: number; status?: number | null; error?: string | null } | null>(null)

  const testConnectionFromConfig = async () => {
    if (!configServer || testingConnection) return
    setTestingConnection(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/mcp-factory/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: configServer.id }),
      })
      const data = await res.json()
      setTestResult(data)
      await loadServers()
      setConfigServer(prev => prev ? { ...prev, isConnected: !!data.connected } : prev)
      addActivity(data.connected
        ? `✅ MCP ${configServer.name}: conexión verificada (${data.latency}ms)`
        : `❌ MCP ${configServer.name}: ${data.error || 'no se pudo conectar'}`)
    } catch {
      setTestResult({ connected: false, error: 'Error de red probando la conexión' })
    } finally {
      setTestingConnection(false)
    }
  }

  const syncServer = async (serverId: string) => {
    const server = servers.find((s) => s.id === serverId)
    if (!server) return
    const synced = { ...server, lastSync: new Date() }
    await saveServerToDB(synced, 'PATCH')
    await loadServers()
    addActivity(`🔄 ${t('mcp.activity_synced')} ${server.name}`)
  }

  const deleteServer = async (serverId: string) => {
    const server = servers.find((s) => s.id === serverId)
    await deleteServerFromDB(serverId)
    await loadServers()
    if (server) addActivity(`🗑️ ${t('mcp.activity_deleted')} ${server.name}`)
  }

  const generateMCP = useCallback(async (query: string) => {
    if (!query.trim()) return
    setIsGenerating(true)
    setGenerationError('')
    setGeneratedConfig(null)
    setPatterns([])

    try {
      const res = await fetch('/api/mcp-factory/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), action: 'generate' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('mcp.error_title'))
      setGeneratedConfig(data.config)
      setPatterns(data.patterns || [])
      setExpandedSections({ tools: true, resources: false, prompts: false, config: false, readme: false })
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : t('mcp.error_title'))
    } finally {
      setIsGenerating(false)
    }
  }, [t])

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(''), 2000)
  }

  const openConfig = (server: MCPServer) => {
    setConfigServer(server)
    setConfigEdits({ endpoint: server.endpoint, apiKey: server.apiKey || '' })
    setConfigTab('details')
    setShowApiKey(false)
    setConfigSaved(false)
    setTestResult(null)
  }

  const saveConfig = async () => {
    if (!configServer) return
    const updatedServer = { ...configServer, endpoint: configEdits.endpoint, apiKey: configEdits.apiKey || undefined }
    await saveServerToDB(updatedServer, 'PATCH')
    await loadServers()
    setConfigServer(updatedServer)
    setConfigSaved(true)
    addActivity(`⚙️ ${t('mcp.configure')}: ${configServer.name}`)
    setTimeout(() => setConfigSaved(false), 2000)
  }

  const disconnectFromConfig = async () => {
    if (!configServer) return
    const updatedServer = { ...configServer, isConnected: false }
    await saveServerToDB(updatedServer, 'PATCH')
    await loadServers()
    setConfigServer(updatedServer)
    addActivity(`🔌 MCP ${configServer.name}: ${t('mcp.disconnected_status')}`)
  }

  const deleteFromConfig = () => {
    if (!configServer) return
    deleteServer(configServer.id)
    setConfigServer(null)
  }

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const connectedServers = servers.filter((s) => s.isConnected).length
  const filteredServers = selectedCategory === 'all' ? servers : servers.filter((s) => s.category === selectedCategory)

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1A1A1A] flex items-center gap-3">
            <Plug className="w-8 h-8 text-[#C4622D]" />
{t('mcp_factory.title')}
          </h1>
          <p className="text-[#1A1A1A]/60 mt-1">
            {t('mcp_factory.subtitle')}
          </p>
        </div>
        <Button onClick={() => setShowConnectModal(true)} className="gap-2 bg-[#2D4A3E] hover:bg-[#2D4A3E]/90">
          <Plus className="w-4 h-4" />
          {t('mcp_factory.create')}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 bg-gradient-to-br from-[#2D4A3E] to-[#2D4A3E]/80 border-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl"><Plug className="w-5 h-5 text-white" /></div>
            <div>
              <p className="text-white/60 text-sm">{t('mcp.stat_total')}</p>
              <p className="text-2xl font-bold text-white">{servers.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-[#C4622D] to-[#C4622D]/80 border-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl"><Link className="w-5 h-5 text-white" /></div>
            <div>
              <p className="text-white/60 text-sm">{t('mcp.stat_connected')}</p>
              <p className="text-2xl font-bold text-white">{connectedServers}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-[#4A90D9] to-[#4A90D9]/80 border-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl"><Zap className="w-5 h-5 text-white" /></div>
            <div>
              <p className="text-white/60 text-sm">{t('mcp.stat_tools')}</p>
              <p className="text-2xl font-bold text-white">{servers.reduce((acc, s) => acc + s.capabilities.length, 0)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-[#9B59B6] to-[#9B59B6]/80 border-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl"><Cpu className="w-5 h-5 text-white" /></div>
            <div>
              <p className="text-white/60 text-sm">{t('mcp.stat_directory')}</p>
              <p className="text-2xl font-bold text-white">259</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F5F0E8] rounded-2xl p-1">
        {[
          { id: 'ai' as const, label: t('mcp.tab_ai'), icon: Wand2 },
          { id: 'templates' as const, label: t('mcp.tab_templates'), icon: BookOpen },
          { id: 'connected' as const, label: `${t('mcp.tab_my_mcps')} (${servers.length})`, icon: Plug },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white text-[#1A1A1A] shadow-sm'
                : 'text-[#1A1A1A]/50 hover:text-[#1A1A1A]/80'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* === TAB: AI Generation === */}
      {activeTab === 'ai' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* AI Hero */}
          <Card className="p-6 md:p-8 bg-gradient-to-br from-[#1A1A1A] to-[#2D4A3E] border-0 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#C4622D]/10 rounded-full blur-3xl -mr-20 -mt-20" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#9B59B6]/10 rounded-full blur-3xl -ml-16 -mb-16" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-[#C4622D] rounded-2xl">
                  <Wand2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{t('mcp.ai_hero_title')}</h2>
                  <p className="text-white/50 text-sm">{t('mcp.ai_hero_desc')}</p>
                </div>
              </div>

              <div className="mt-5 flex gap-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={aiQuery}
                    onChange={(e) => setAiQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !isGenerating) generateMCP(aiQuery) }}
                    placeholder={t('mcp.ai_placeholder')}
                    className="w-full px-5 py-4 rounded-2xl bg-white/10 border border-white/20 text-white placeholder-white/30 focus:border-[#C4622D] focus:ring-2 focus:ring-[#C4622D]/30 outline-none text-sm"
                    disabled={isGenerating}
                  />
                  <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                </div>
                <Button
                  onClick={() => generateMCP(aiQuery)}
                  disabled={!aiQuery.trim() || isGenerating}
                  className="px-6 bg-[#C4622D] hover:bg-[#C4622D]/90 text-white rounded-2xl h-auto"
                >
                  {isGenerating ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <><Sparkles className="w-5 h-5 mr-2" /> {t('mcp.generate')}</>
                  )}
                </Button>
              </div>

              {/* Suggestion chips */}
              <div className="mt-4 flex flex-wrap gap-2">
                {SUGGESTION_KEYS.map((s, i) => {
                  const text = t(s.key)
                  return (
                    <button
                      key={i}
                      onClick={() => { setAiQuery(text); generateMCP(text) }}
                      disabled={isGenerating}
                      className="px-3 py-1.5 rounded-xl bg-white/10 text-white/70 text-xs hover:bg-white/20 hover:text-white transition-all disabled:opacity-50"
                    >
                      {s.icon} {text}
                    </button>
                  )
                })}
              </div>
            </div>
          </Card>

          {/* Loading state */}
          {isGenerating && (
            <Card className="p-8 border-0 bg-[#F5F0E8]">
              <div className="flex flex-col items-center gap-4">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="p-4 bg-[#C4622D]/10 rounded-full"
                >
                  <Sparkles className="w-8 h-8 text-[#C4622D]" />
                </motion.div>
                <div className="text-center">
                  <p className="font-semibold text-[#1A1A1A]">{t('mcp.generating_title')}</p>
                  <p className="text-sm text-[#1A1A1A]/50 mt-1">{t('mcp.generating_desc')}</p>
                </div>
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
                      className="w-2 h-2 bg-[#C4622D] rounded-full"
                    />
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Error state */}
          {generationError && (
            <Card className="p-6 border-red-200 bg-red-50">
              <div className="flex items-center gap-3">
                <X className="w-5 h-5 text-red-500" />
                <div>
                  <p className="font-medium text-red-700">{t('mcp.error_title')}</p>
                  <p className="text-sm text-red-600">{generationError}</p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => generateMCP(aiQuery)}
                className="mt-3 text-red-600 border-red-200 hover:bg-red-50"
              >
                <RefreshCw className="w-4 h-4 mr-2" /> {t('mcp.retry')}
              </Button>
            </Card>
          )}

          {/* Generated Result */}
          {generatedConfig && !isGenerating && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {/* Header card */}
              <Card className="p-6 border-0 bg-gradient-to-r from-[#2D4A3E]/5 to-[#C4622D]/5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-2xl" style={{ backgroundColor: `${generatedConfig.color || '#C4622D'}20` }}>
                      {(() => {
                        const IC = iconMap[generatedConfig.icon] || Sparkles
                        return <IC className="w-7 h-7" style={{ color: generatedConfig.color || '#C4622D' }} />
                      })()}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-[#1A1A1A]">{generatedConfig.name}</h3>
                      <p className="text-[#1A1A1A]/60 text-sm mt-1">{generatedConfig.description}</p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {generatedConfig.capabilities?.map((cap, i) => (
                          <span key={i} className="text-xs px-2.5 py-1 rounded-lg bg-[#2D4A3E]/10 text-[#2D4A3E] font-medium">
                            {cap}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleConnectGenerated}
                      disabled={isConnecting}
                      className="gap-2 bg-[#C4622D] hover:bg-[#C4622D]/90"
                    >
                      {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
                      {t('mcp.connect')}
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Inspirado en */}
              {patterns.length > 0 && (
                <Card className="p-4 border-0 bg-[#F5F0E8]">
                  <p className="text-xs font-medium text-[#1A1A1A]/50 mb-2 flex items-center gap-1">
                    <Star className="w-3 h-3" /> {t('mcp.inspired_by')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {patterns.map((p, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-white text-[#1A1A1A]/70 shadow-sm">
                        <Star className="w-3 h-3 text-yellow-500" />
                        {p.name}
                        <span className="text-[#1A1A1A]/30">by {p.author}</span>
                        <span className="text-[#1A1A1A]/30">({p.stars.toLocaleString()}★)</span>
                      </span>
                    ))}
                  </div>
                </Card>
              )}

              {/* Tools section */}
              <Card className="border-0 overflow-hidden">
                <button
                  onClick={() => toggleSection('tools')}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-xl"><Zap className="w-4 h-4 text-blue-600" /></div>
                    <span className="font-semibold text-[#1A1A1A]">Tools ({generatedConfig.tools?.length || 0})</span>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-[#1A1A1A]/40 transition-transform ${expandedSections.tools ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {expandedSections.tools && generatedConfig.tools && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                      <div className="px-4 pb-4 space-y-3">
                        {generatedConfig.tools.map((tool, i) => (
                          <div key={i} className="p-4 rounded-xl bg-[#F5F0E8] border border-[#2D4A3E]/10">
                            <div className="flex items-start justify-between">
                              <div>
                                <code className="text-sm font-mono font-bold text-[#2D4A3E]">{tool.name}</code>
                                <p className="text-xs text-[#1A1A1A]/60 mt-1">{tool.description}</p>
                              </div>
                            </div>
                            {tool.inputSchema?.properties && (
                              <div className="mt-3 space-y-1">
                                {Object.entries(tool.inputSchema.properties).map(([key, val]) => (
                                  <div key={key} className="flex items-center gap-2 text-xs">
                                    <code className="px-1.5 py-0.5 rounded bg-white text-[#C4622D] font-mono">{key}</code>
                                    <span className="text-[#1A1A1A]/40">{val.type}</span>
                                    {tool.inputSchema?.required?.includes(key) && (
                                      <span className="text-red-400 text-[10px]">{t('mcp.required')}</span>
                                    )}
                                    <span className="text-[#1A1A1A]/30">— {val.description}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>

              {/* Resources section */}
              {generatedConfig.resources && generatedConfig.resources.length > 0 && (
                <Card className="border-0 overflow-hidden">
                  <button
                    onClick={() => toggleSection('resources')}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 rounded-xl"><HardDrive className="w-4 h-4 text-purple-600" /></div>
                      <span className="font-semibold text-[#1A1A1A]">Resources ({generatedConfig.resources.length})</span>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-[#1A1A1A]/40 transition-transform ${expandedSections.resources ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {expandedSections.resources && (
                      <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                        <div className="px-4 pb-4 space-y-2">
                          {generatedConfig.resources.map((res, i) => (
                            <div key={i} className="p-3 rounded-xl bg-purple-50 border border-purple-100">
                              <div className="flex items-center gap-2">
                                <code className="text-xs font-mono text-purple-700">{res.uri}</code>
                                {res.mimeType && <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 rounded text-purple-500">{res.mimeType}</span>}
                              </div>
                              <p className="text-xs text-[#1A1A1A]/60 mt-1">{res.name} — {res.description}</p>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              )}

              {/* Prompts section */}
              {generatedConfig.prompts && generatedConfig.prompts.length > 0 && (
                <Card className="border-0 overflow-hidden">
                  <button
                    onClick={() => toggleSection('prompts')}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-100 rounded-xl"><MessageCircle className="w-4 h-4 text-orange-600" /></div>
                      <span className="font-semibold text-[#1A1A1A]">Prompts ({generatedConfig.prompts.length})</span>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-[#1A1A1A]/40 transition-transform ${expandedSections.prompts ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {expandedSections.prompts && (
                      <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                        <div className="px-4 pb-4 space-y-2">
                          {generatedConfig.prompts.map((prompt, i) => (
                            <div key={i} className="p-3 rounded-xl bg-orange-50 border border-orange-100">
                              <code className="text-sm font-mono font-bold text-orange-700">{prompt.name}</code>
                              <p className="text-xs text-[#1A1A1A]/60 mt-1">{prompt.description}</p>
                              {prompt.arguments && prompt.arguments.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {prompt.arguments.map((arg, j) => (
                                    <span key={j} className="text-[10px] px-2 py-0.5 rounded bg-orange-100 text-orange-600">
                                      {arg.name} {arg.required && '*'}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              )}

              {/* Config Example */}
              {generatedConfig.configExample && (
                <Card className="border-0 overflow-hidden">
                  <button
                    onClick={() => toggleSection('config')}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 rounded-xl"><Code2 className="w-4 h-4 text-green-600" /></div>
                      <span className="font-semibold text-[#1A1A1A]">{t('mcp.config_section')}</span>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-[#1A1A1A]/40 transition-transform ${expandedSections.config ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {expandedSections.config && (
                      <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                        <div className="px-4 pb-4">
                          <div className="relative">
                            <pre className="p-4 rounded-xl bg-[#1A1A1A] text-green-400 text-xs font-mono overflow-x-auto">
                              {JSON.stringify(generatedConfig.configExample, null, 2)}
                            </pre>
                            <button
                              onClick={() => handleCopy(JSON.stringify(generatedConfig.configExample, null, 2), 'config')}
                              className="absolute top-3 right-3 p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all"
                            >
                              {copiedField === 'config' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-white/60" />}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              )}

              {/* Readme */}
              {generatedConfig.readme && (
                <Card className="border-0 overflow-hidden">
                  <button
                    onClick={() => toggleSection('readme')}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 rounded-xl"><BookOpen className="w-4 h-4 text-gray-600" /></div>
                      <span className="font-semibold text-[#1A1A1A]">{t('mcp.instructions')}</span>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-[#1A1A1A]/40 transition-transform ${expandedSections.readme ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {expandedSections.readme && (
                      <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                        <div className="px-4 pb-4">
                          <div className="p-4 rounded-xl bg-gray-50 text-sm text-[#1A1A1A]/70 whitespace-pre-wrap">
                            {generatedConfig.readme}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              )}

              {/* Bottom actions */}
              <div className="flex gap-3">
                <Button
                  onClick={handleConnectGenerated}
                  disabled={isConnecting}
                  className="flex-1 gap-2 bg-[#C4622D] hover:bg-[#C4622D]/90 py-6"
                >
                  {isConnecting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plug className="w-5 h-5" />}
                  {t('mcp.connect_this')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleCopy(JSON.stringify(generatedConfig, null, 2), 'full')}
                  className="gap-2 py-6"
                >
                  {copiedField === 'full' ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                  {t('mcp.copy_json')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setGeneratedConfig(null); setAiQuery('') }}
                  className="gap-2 py-6"
                >
                  <RefreshCw className="w-5 h-5" /> {t('mcp.new')}
                </Button>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* === TAB: Templates === */}
      {activeTab === 'templates' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {MCP_TEMPLATES.map((template) => {
              const IconComp = iconMap[template.icon || 'Plug'] || Plug
              return (
                <Card key={template.id} className="p-5 hover:shadow-lg transition-all group cursor-pointer" onClick={() => { handleSelectTemplate(template); setShowConnectModal(true) }}>
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-2xl" style={{ backgroundColor: `${template.color}20` }}>
                      <IconComp className="w-6 h-6" style={{ color: template.color }} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-[#1A1A1A] group-hover:text-[#C4622D] transition-colors">{template.name}</h3>
                      <p className="text-sm text-[#1A1A1A]/60 mt-1">{template.description}</p>
                      <div className="flex flex-wrap gap-1 mt-3">
                        {template.capabilities?.slice(0, 3).map((cap) => (
                          <span key={cap} className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500">{cap}</span>
                        ))}
                        {(template.capabilities?.length || 0) > 3 && (
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500">+{(template.capabilities?.length || 0) - 3}</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-[#1A1A1A]/20 group-hover:text-[#C4622D] transition-colors" />
                  </div>
                </Card>
              )
            })}
            {/* Custom MCP button */}
            <Card
              className="p-5 border-dashed border-2 hover:border-[#C4622D] transition-all cursor-pointer flex items-center justify-center"
              onClick={() => {
                handleSelectTemplate({
                  id: 'custom', name: t('mcp.custom_mcp'), description: t('mcp.custom_mcp_desc'),
                  category: 'custom', icon: 'Plug', color: '#1ABC9C', capabilities: [], version: '1.0.0',
                })
                setShowConnectModal(true)
              }}
            >
              <div className="text-center">
                <Plus className="w-8 h-8 mx-auto text-[#1A1A1A]/30 mb-2" />
                <p className="font-medium text-[#1A1A1A]/50">{t('mcp.custom_mcp')}</p>
                <p className="text-xs text-[#1A1A1A]/30 mt-1">{t('mcp.connect_any_endpoint')}</p>
              </div>
            </Card>
          </div>

          <div className="text-center">
            <a href="/dashboard/mcp-directory" className="inline-flex items-center gap-2 text-[#C4622D] hover:underline text-sm">
              <ExternalLink className="w-4 h-4" /> {t('mcp.explore_directory')}
            </a>
          </div>
        </motion.div>
      )}

      {/* === TAB: Connected Servers === */}
      {activeTab === 'connected' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Category Filter */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                selectedCategory === 'all' ? 'bg-[#C4622D] text-white' : 'bg-[#F5F0E8] text-[#1A1A1A]/60 hover:bg-[#C4622D]/10'
              }`}
            >
              {t('mcp.filter_all')}
            </button>
            {Object.entries(MCP_CATEGORIES).map(([key, cat]) => {
              const IconComp = iconMap[cat.icon] || Plug
              return (
                <button
                  key={key}
                  onClick={() => setSelectedCategory(key as MCPCategory)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                    selectedCategory === key ? 'bg-[#C4622D] text-white' : 'bg-[#F5F0E8] text-[#1A1A1A]/60 hover:bg-[#C4622D]/10'
                  }`}
                >
                  <IconComp className="w-4 h-4" />
                  {cat.name}
                </button>
              )
            })}
          </div>

          {/* MCP Servers Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {filteredServers.map((server, index) => {
                const IconComp = iconMap[server.icon] || Plug
                const isToggling = togglingId === server.id
                return (
                  <motion.div
                    key={server.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className={`p-6 hover:shadow-lg transition-all duration-500 group relative overflow-hidden ${
                      isToggling ? 'ring-2 ring-[#C4622D]/40' : ''
                    } ${!server.isConnected && !isToggling ? 'opacity-75' : ''}`}>
                      {/* Top glow bar */}
                      <div className={`absolute top-0 left-0 right-0 h-1 transition-all duration-700 ${
                        isToggling ? 'bg-[#C4622D] animate-pulse' : server.isConnected ? 'bg-green-500' : 'bg-gray-200'
                      }`} />

                      <div className="flex items-start justify-between mb-4">
                        <div className={`p-3 rounded-2xl transition-all duration-500 ${isToggling ? 'animate-pulse' : ''}`} style={{ backgroundColor: `${server.color}20` }}>
                          <IconComp className="w-6 h-6" style={{ color: server.color }} />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => syncServer(server.id)}
                            title={t('mcp.sync')}
                            className="p-2 rounded-xl bg-blue-50 text-blue-500 hover:bg-blue-100 hover:text-blue-600 transition-all opacity-0 group-hover:opacity-100"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteServer(server.id)}
                            title={t('mcp.delete')}
                            className="p-2 rounded-xl bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <h3 className="font-bold text-lg text-[#1A1A1A] mb-1">{server.name}</h3>
                      <p className="text-sm text-[#1A1A1A]/60 mb-3 line-clamp-2">{server.description}</p>

                      <div className="flex flex-wrap gap-1 mb-3">
                        {server.capabilities.slice(0, 3).map((cap) => (
                          <span key={cap} className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-600">{cap}</span>
                        ))}
                        {server.capabilities.length > 3 && (
                          <span className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-500">+{server.capabilities.length - 3}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-[#1A1A1A]/40 mb-4">
                        <span className="px-2 py-1 rounded-lg" style={{ backgroundColor: `${server.color}15`, color: server.color }}>
                          {MCP_CATEGORIES[server.category]?.name || 'Custom'}
                        </span>
                        <span className="px-2 py-1 rounded-lg bg-gray-100">v{server.version}</span>
                        <span className="px-2 py-1 rounded-lg bg-gray-100">
                          {server.capabilities.length} {t('mcp.tools_count')}
                        </span>
                      </div>

                      {/* Toggle footer */}
                      <div className="pt-4 border-t border-gray-100">
                        <div className="flex items-center justify-between">
                          {/* Status + toggle switch */}
                          <button
                            onClick={() => toggleServerConnection(server.id)}
                            disabled={!!togglingId}
                            className="flex items-center gap-3 group/toggle"
                          >
                            {/* Toggle switch */}
                            <div className={`relative w-12 h-6 rounded-full transition-all duration-500 ${
                              isToggling ? 'bg-[#C4622D]/60' : server.isConnected ? 'bg-green-500' : 'bg-gray-300'
                            }`}>
                              <motion.div
                                className={`absolute top-0.5 w-5 h-5 rounded-full shadow-md ${
                                  isToggling ? 'bg-white' : 'bg-white'
                                }`}
                                animate={{
                                  left: isToggling
                                    ? (server.isConnected ? '24px' : '2px')
                                    : (server.isConnected ? '24px' : '2px'),
                                  scale: isToggling ? [1, 0.8, 1] : 1,
                                }}
                                transition={{ duration: 0.3, ease: 'easeInOut' }}
                              />
                              {isToggling && (
                                <motion.div
                                  className="absolute inset-0 rounded-full border-2 border-[#C4622D]"
                                  animate={{ opacity: [0.5, 1, 0.5] }}
                                  transition={{ duration: 0.8, repeat: Infinity }}
                                />
                              )}
                            </div>
                            {/* Status label */}
                            <span className={`text-sm font-medium transition-all duration-300 ${
                              isToggling ? 'text-[#C4622D]' : server.isConnected ? 'text-green-600' : 'text-gray-400'
                            }`}>
                              {isToggling
                                ? (server.isConnected ? t('mcp.toggling_off') : t('mcp.toggling_on'))
                                : (server.isConnected ? t('mcp.connected_status') : t('mcp.disconnected_status'))
                              }
                            </span>
                            {!isToggling && server.isConnected && (
                              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            )}
                            {isToggling && (
                              <Loader2 className="w-3.5 h-3.5 text-[#C4622D] animate-spin" />
                            )}
                          </button>

                          {/* Configure button */}
                          <button
                            onClick={() => openConfig(server)}
                            className="text-[#C4622D] hover:underline text-sm flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity"
                          >
                            {t('mcp.configure')} <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                )
              })}
            </AnimatePresence>

            {filteredServers.length === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="col-span-full py-16 text-center">
                <Plug className="w-16 h-16 mx-auto text-[#1A1A1A]/20 mb-4" />
                <p className="text-[#1A1A1A]/40 mb-4">{t('mcp.no_mcps_category')}</p>
                <div className="flex gap-3 justify-center">
                  <Button onClick={() => setActiveTab('ai')} className="gap-2 bg-[#C4622D] hover:bg-[#C4622D]/90">
                    <Wand2 className="w-4 h-4" /> {t('mcp.create_with_ai')}
                  </Button>
                  <Button onClick={() => setShowConnectModal(true)} variant="outline">
                    <Plus className="w-4 h-4 mr-2" /> {t('mcp.connect_manual')}
                  </Button>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}

      {/* Connect Modal */}
      <AnimatePresence>
        {showConnectModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => !isConnecting && setShowConnectModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-[#1A1A1A]">{t('mcp.modal_title')}</h2>
                <button onClick={() => !isConnecting && setShowConnectModal(false)} className="p-2 rounded-xl hover:bg-gray-100 transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {!selectedTemplate ? (
                <>
                  <p className="text-[#1A1A1A]/60 mb-6">{t('mcp.modal_desc')}</p>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    {MCP_TEMPLATES.map((template) => {
                      const IconComp = iconMap[template.icon || 'Plug'] || Plug
                      return (
                        <button
                          key={template.id}
                          onClick={() => handleSelectTemplate(template)}
                          className="p-4 rounded-2xl border-2 border-gray-100 hover:border-[#C4622D] transition-all text-left group"
                        >
                          <div className="p-3 rounded-xl w-fit mb-3" style={{ backgroundColor: `${template.color}20` }}>
                            <IconComp className="w-5 h-5" style={{ color: template.color }} />
                          </div>
                          <h3 className="font-bold text-[#1A1A1A] group-hover:text-[#C4622D] transition-colors">{template.name}</h3>
                          <p className="text-sm text-[#1A1A1A]/60 mt-1 line-clamp-2">{template.description}</p>
                        </button>
                      )
                    })}
                  </div>
                  <button
                    onClick={() => handleSelectTemplate({
                      id: 'custom', name: t('mcp.custom_mcp'), description: t('mcp.custom_mcp_desc'),
                      category: 'custom', icon: 'Plug', color: '#1ABC9C', capabilities: [], version: '1.0.0',
                    })}
                    className="w-full p-4 rounded-2xl border-2 border-dashed border-gray-200 hover:border-[#C4622D] transition-all text-center"
                  >
                    <Plus className="w-6 h-6 mx-auto text-[#1A1A1A]/40 mb-2" />
                    <p className="font-medium text-[#1A1A1A]/60">{t('mcp.connect_custom')}</p>
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-4 mb-6 p-4 rounded-2xl bg-[#F5F0E8]">
                    {(() => {
                      const IconComp = iconMap[selectedTemplate.icon || 'Plug'] || Plug
                      return (
                        <div className="p-3 rounded-xl" style={{ backgroundColor: `${selectedTemplate.color}20` }}>
                          <IconComp className="w-6 h-6" style={{ color: selectedTemplate.color }} />
                        </div>
                      )
                    })()}
                    <div>
                      <h3 className="font-bold text-[#1A1A1A]">{selectedTemplate.name}</h3>
                      <p className="text-sm text-[#1A1A1A]/60">{selectedTemplate.description}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[#1A1A1A] mb-2">{t('mcp.endpoint_label')}</label>
                      <input
                        type="text"
                        value={connectionConfig.endpoint}
                        onChange={(e) => setConnectionConfig({ ...connectionConfig, endpoint: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#C4622D] focus:ring-2 focus:ring-[#C4622D]/20 outline-none"
                        placeholder="https://api.example.com/mcp"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#1A1A1A] mb-2">{t('mcp.apikey_label')}</label>
                      <input
                        type="password"
                        value={connectionConfig.apiKey}
                        onChange={(e) => setConnectionConfig({ ...connectionConfig, apiKey: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#C4622D] focus:ring-2 focus:ring-[#C4622D]/20 outline-none"
                        placeholder="sk-..."
                      />
                    </div>
                    {selectedTemplate.capabilities && selectedTemplate.capabilities.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-[#1A1A1A] mb-2">{t('mcp.capabilities_label')}</label>
                        <div className="flex flex-wrap gap-2">
                          {selectedTemplate.capabilities.map((cap) => (
                            <span key={cap} className="px-3 py-1.5 rounded-xl bg-[#2D4A3E]/10 text-[#2D4A3E] text-sm">✓ {cap}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 mt-8">
                    <Button variant="outline" onClick={() => setSelectedTemplate(null)} className="flex-1" disabled={isConnecting}>{t('mcp.back')}</Button>
                    <Button onClick={handleConnectMCP} className="flex-1 gap-2" disabled={!connectionConfig.endpoint || isConnecting}>
                      {isConnecting ? (
                        <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><RefreshCw className="w-4 h-4" /></motion.div> {t('mcp.connecting')}</>
                      ) : (
                        <><Check className="w-4 h-4" /> {t('mcp.connect_mcp')}</>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Config Modal */}
      <AnimatePresence>
        {configServer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => { setConfigServer(null); setShowApiKey(false); setConfigSaved(false) }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center gap-3 p-5 border-b border-[#E8E0D4]">
                <div className={`w-10 h-10 rounded-xl ${configServer.color} flex items-center justify-center text-white text-lg`}>
                  {(() => { const Ic = iconMap[configServer.icon] || iconMap['brain']; return <Ic className="w-5 h-5" />; })()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-[#1A1A1A] truncate">{configServer.name}</h3>
                  <p className="text-xs text-[#1A1A1A]/50">{configServer.category}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${configServer.isConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                  {configServer.isConnected ? t('mcp.config_connected') : t('mcp.config_disconnected')}
                </span>
                <button onClick={() => { setConfigServer(null); setShowApiKey(false); setConfigSaved(false) }} className="p-1.5 hover:bg-[#F5F0E8] rounded-lg transition-colors">
                  <X className="w-4 h-4 text-[#1A1A1A]/60" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-[#E8E0D4]">
                {(['details', 'tools', 'connection'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => { setConfigTab(tab); setConfigSaved(false) }}
                    className={`flex-1 py-3 text-sm font-medium transition-colors relative ${configTab === tab ? 'text-[#C4622D]' : 'text-[#1A1A1A]/50 hover:text-[#1A1A1A]/70'}`}
                  >
                    {t(`mcp.config_tab_${tab}`)}
                    {configTab === tab && <motion.div layoutId="configTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C4622D]" />}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {configTab === 'details' && (
                  <>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-[#1A1A1A]/50 uppercase tracking-wider">{t('mcp.config_name')}</label>
                        <p className="mt-1 text-[#1A1A1A] font-medium">{configServer.name}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-[#1A1A1A]/50 uppercase tracking-wider">{t('mcp.config_description')}</label>
                        <p className="mt-1 text-[#1A1A1A]/80 text-sm">{configServer.description}</p>
                      </div>
                      <div className="flex gap-6">
                        <div>
                          <label className="text-xs font-medium text-[#1A1A1A]/50 uppercase tracking-wider">{t('mcp.config_category')}</label>
                          <p className="mt-1"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${configServer.color} text-white`}>{configServer.category}</span></p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-[#1A1A1A]/50 uppercase tracking-wider">{t('mcp.config_version')}</label>
                          <p className="mt-1 text-[#1A1A1A] font-mono text-sm">{configServer.version || 'v1.0.0'}</p>
                        </div>
                      </div>
                      {configServer.lastSync && (
                        <div>
                          <label className="text-xs font-medium text-[#1A1A1A]/50 uppercase tracking-wider">{t('mcp.config_last_sync')}</label>
                          <p className="mt-1 text-[#1A1A1A]/70 text-sm">{configServer.lastSync instanceof Date ? configServer.lastSync.toLocaleString() : String(configServer.lastSync)}</p>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-medium text-[#1A1A1A]/50 uppercase tracking-wider">{t('mcp.config_capabilities')}</label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {configServer.capabilities.map((cap, i) => (
                          <span key={i} className="px-3 py-1 bg-[#F5F0E8] text-[#2D4A3E] rounded-full text-xs font-medium border border-[#E8E0D4]">
                            {cap}
                          </span>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {configTab === 'tools' && (
                  <div className="space-y-3">
                    <p className="text-sm text-[#1A1A1A]/60">{t('mcp.config_tools_desc')}</p>
                    {configServer.capabilities.length === 0 ? (
                      <div className="text-center py-8 text-[#1A1A1A]/40">
                        <Settings className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">{t('mcp.config_no_tools')}</p>
                      </div>
                    ) : (
                      configServer.capabilities.map((cap, i) => (
                        <div key={i} className="p-3 bg-[#F5F0E8]/60 rounded-xl border border-[#E8E0D4] flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg ${configServer.color} flex items-center justify-center text-white`}>
                            <Zap className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#1A1A1A]">{cap}</p>
                            <p className="text-xs text-[#1A1A1A]/50">{t('mcp.config_tool_available')}</p>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700">
                            {t('mcp.config_active')}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {configTab === 'connection' && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-medium text-[#1A1A1A]/50 uppercase tracking-wider">{t('mcp.config_endpoint')}</label>
                      <input
                        type="text"
                        value={configEdits.endpoint}
                        onChange={(e) => setConfigEdits(p => ({ ...p, endpoint: e.target.value }))}
                        className="mt-1 w-full px-3 py-2.5 bg-[#F5F0E8] border border-[#E8E0D4] rounded-xl text-sm text-[#1A1A1A] font-mono focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30 focus:border-[#C4622D]"
                        placeholder="https://mcp.example.com/v1"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-[#1A1A1A]/50 uppercase tracking-wider">{t('mcp.config_api_key')}</label>
                      <div className="mt-1 relative">
                        <input
                          type={showApiKey ? 'text' : 'password'}
                          value={configEdits.apiKey}
                          onChange={(e) => setConfigEdits(p => ({ ...p, apiKey: e.target.value }))}
                          className="w-full px-3 py-2.5 pr-10 bg-[#F5F0E8] border border-[#E8E0D4] rounded-xl text-sm text-[#1A1A1A] font-mono focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30 focus:border-[#C4622D]"
                          placeholder="sk-..."
                        />
                        <button onClick={() => setShowApiKey(!showApiKey)} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 hover:bg-[#E8E0D4] rounded-lg transition-colors">
                          {showApiKey ? <EyeOff className="w-4 h-4 text-[#1A1A1A]/50" /> : <Eye className="w-4 h-4 text-[#1A1A1A]/50" />}
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={saveConfig}
                      className="w-full py-2.5 bg-[#C4622D] text-white rounded-xl text-sm font-medium hover:bg-[#A8501F] transition-colors flex items-center justify-center gap-2"
                    >
                      {configSaved ? (
                        <><Check className="w-4 h-4" /> {t('mcp.config_saved')}</>
                      ) : (
                        <><Save className="w-4 h-4" /> {t('mcp.config_save')}</>
                      )}
                    </button>

                    {/* Test de conexión real */}
                    <button
                      onClick={testConnectionFromConfig}
                      disabled={testingConnection}
                      className="w-full py-2.5 bg-[#2D4A3E] text-white rounded-xl text-sm font-medium hover:bg-[#22382F] transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {testingConnection ? (
                        <><RefreshCw className="w-4 h-4 animate-spin" /> Probando conexión...</>
                      ) : (
                        <><Zap className="w-4 h-4" /> Probar conexión</>
                      )}
                    </button>
                    {testResult && (
                      <div className={`p-3 rounded-xl text-sm border ${testResult.connected ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                        {testResult.connected
                          ? `✅ Conexión verificada — ${testResult.latency}ms${testResult.status ? ` (HTTP ${testResult.status})` : ''}`
                          : `❌ ${testResult.error || 'No se pudo conectar al endpoint'}`}
                      </div>
                    )}

                    {/* Danger Zone */}
                    <div className="mt-4 pt-4 border-t border-red-200">
                      <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        <span className="text-xs font-bold text-red-600 uppercase tracking-wider">{t('mcp.config_danger_zone')}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={disconnectFromConfig}
                          disabled={!configServer.isConnected}
                          className="flex-1 py-2 border border-orange-300 text-orange-700 rounded-xl text-xs font-medium hover:bg-orange-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {t('mcp.config_disconnect')}
                        </button>
                        <button
                          onClick={deleteFromConfig}
                          className="flex-1 py-2 border border-red-300 text-red-700 rounded-xl text-xs font-medium hover:bg-red-50 transition-colors"
                        >
                          {t('mcp.config_delete')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}