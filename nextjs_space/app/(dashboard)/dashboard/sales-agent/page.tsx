'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  MessageSquare, Plus, Copy, Check, Trash2, 
  Users, Settings, Eye, EyeOff,
  Zap, Palette, Package, DollarSign, Link2, Sparkles,
  X, MessageCircle, Target, Star, ShieldCheck, Clock,
  Brain, Globe, Percent, Swords, ChevronRight, HelpCircle,
  Award, BookOpen
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n-context'

interface SalesAgent {
  id: string
  name: string
  productName: string
  productDesc: string
  productPrice: string | null
  purchaseLink: string | null
  brandVoice: string | null
  greeting: string | null
  objections: string | null
  targetAudience: string | null
  keyBenefits: string | null
  faq: string | null
  socialProof: string | null
  guarantee: string | null
  urgencyTriggers: string | null
  closingStyle: string | null
  agentLanguage: string | null
  maxDiscount: string | null
  competitorInfo: string | null
  accentColor: string
  logoUrl: string | null
  isActive: boolean
  conversations: number
  conversions: number
  createdAt: string
  updatedAt: string
  _count?: { chatLogs: number }
}

const ACCENT_COLORS = [
  { value: '#C4622D', en: 'Clay', es: 'Arcilla' },
  { value: '#2D4A3E', en: 'Moss', es: 'Musgo' },
  { value: '#4A90D9', en: 'Blue', es: 'Azul' },
  { value: '#E74C3C', en: 'Red', es: 'Rojo' },
  { value: '#F39C12', en: 'Orange', es: 'Naranja' },
  { value: '#9B59B6', en: 'Purple', es: 'Púrpura' },
  { value: '#1ABC9C', en: 'Teal', es: 'Turquesa' },
  { value: '#1A1A1A', en: 'Carbon', es: 'Carbón' },
]

const FORM_TABS_DEF = [
  { id: 'basic', en: 'Product', es: 'Producto', icon: Package },
  { id: 'audience', en: 'Audience', es: 'Audiencia', icon: Target },
  { id: 'sales', en: 'Sales', es: 'Ventas', icon: Zap },
  { id: 'knowledge', en: 'Knowledge', es: 'Conocimiento', icon: Brain },
  { id: 'style', en: 'Style', es: 'Estilo', icon: Palette },
]

const defaultForm = {
  name: '', productName: '', productDesc: '', productPrice: '', purchaseLink: '',
  brandVoice: '', greeting: '', objections: '', accentColor: '#C4622D',
  targetAudience: '', keyBenefits: '', faq: '', socialProof: '',
  guarantee: '', urgencyTriggers: '', closingStyle: '', agentLanguage: 'auto',
  maxDiscount: '', competitorInfo: '',
}

export default function SalesAgentPage() {
  const { locale } = useI18n()
  const isEn = locale === 'en'
  const [agents, setAgents] = useState<SalesAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [editingAgent, setEditingAgent] = useState<SalesAgent | null>(null)
  const [viewingAgent, setViewingAgent] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('basic')
  const [form, setForm] = useState(defaultForm)

  useEffect(() => { fetchAgents() }, [])

  const fetchAgents = async () => {
    try {
      const res = await fetch('/api/sales-agent')
      if (res.ok) setAgents(await res.json())
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const createAgent = async () => {
    if (!form.name || !form.productName || !form.productDesc) return
    setCreating(true)
    try {
      const res = await fetch('/api/sales-agent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) { await fetchAgents(); closeModal() }
    } catch (e) { console.error(e) }
    finally { setCreating(false) }
  }

  const updateAgent = async () => {
    if (!editingAgent) return
    setCreating(true)
    try {
      const res = await fetch(`/api/sales-agent/${editingAgent.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) { await fetchAgents(); closeModal() }
    } catch (e) { console.error(e) }
    finally { setCreating(false) }
  }

  const toggleAgent = async (id: string, isActive: boolean) => {
    await fetch(`/api/sales-agent/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    })
    fetchAgents()
  }

  const deleteAgent = async (id: string) => {
    if (!confirm(isEn ? 'Delete this agent? All conversations will be lost.' : '¿Eliminar este agente? Se perderán todas las conversaciones.')) return
    await fetch(`/api/sales-agent/${id}`, { method: 'DELETE' })
    fetchAgents()
  }

  const openEdit = (agent: SalesAgent) => {
    setEditingAgent(agent)
    setForm({
      name: agent.name, productName: agent.productName, productDesc: agent.productDesc,
      productPrice: agent.productPrice || '', purchaseLink: agent.purchaseLink || '',
      brandVoice: agent.brandVoice || '', greeting: agent.greeting || '',
      objections: agent.objections || '', accentColor: agent.accentColor,
      targetAudience: agent.targetAudience || '', keyBenefits: agent.keyBenefits || '',
      faq: agent.faq || '', socialProof: agent.socialProof || '',
      guarantee: agent.guarantee || '', urgencyTriggers: agent.urgencyTriggers || '',
      closingStyle: agent.closingStyle || '', agentLanguage: agent.agentLanguage || 'auto',
      maxDiscount: agent.maxDiscount || '', competitorInfo: agent.competitorInfo || '',
    })
    setActiveTab('basic')
  }

  const closeModal = () => {
    setShowCreate(false)
    setEditingAgent(null)
    setForm(defaultForm)
    setActiveTab('basic')
  }

  const copyEmbedCode = (agent: SalesAgent) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const code = `<script>\n(function(){var d=document,s=d.createElement('div');s.innerHTML='<iframe src="${origin}/widget/chat/${agent.id}" style="position:fixed;bottom:20px;right:20px;width:400px;height:600px;border:none;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.3);z-index:9999"></iframe>';d.body.appendChild(s);})();\n</script>`
    navigator.clipboard.writeText(code)
    setCopiedId(agent.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const totalConversations = agents.reduce((s, a) => s + a.conversations, 0)
  const totalChats = agents.reduce((s, a) => s + (a._count?.chatLogs || 0), 0)
  const activeAgents = agents.filter(a => a.isActive).length

  // Count filled elite fields for agent "completeness"
  const getAgentScore = (a: SalesAgent) => {
    const fields = [a.targetAudience, a.keyBenefits, a.faq, a.socialProof, a.guarantee, a.urgencyTriggers, a.closingStyle, a.competitorInfo, a.objections, a.brandVoice]
    return fields.filter(f => f && f.trim().length > 0).length
  }

  const InputField = ({ label, icon: Icon, value, onChange, placeholder, type = 'text' }: any) => (
    <div>
      <label className="block text-sm font-medium text-gray-600 dark:text-[#F5F0E8]/70 mb-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 inline mr-1" />} {label}
      </label>
      <input value={value} onChange={onChange} placeholder={placeholder} type={type}
        className="w-full px-4 py-3 bg-gray-100 dark:bg-[#F5F0E8]/5 border border-gray-200 dark:border-[#F5F0E8]/10 rounded-xl text-gray-900 dark:text-[#F5F0E8] placeholder-gray-400 dark:placeholder-[#F5F0E8]/30 focus:border-[#C4622D]/50 focus:outline-none transition-colors" />
    </div>
  )

  const TextAreaField = ({ label, icon: Icon, value, onChange, placeholder, rows = 3, hint }: any) => (
    <div>
      <label className="block text-sm font-medium text-gray-600 dark:text-[#F5F0E8]/70 mb-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 inline mr-1" />} {label}
      </label>
      {hint && <p className="text-xs text-gray-400 dark:text-[#F5F0E8]/30 mb-2 italic">{hint}</p>}
      <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows}
        className="w-full px-4 py-3 bg-gray-100 dark:bg-[#F5F0E8]/5 border border-gray-200 dark:border-[#F5F0E8]/10 rounded-xl text-gray-900 dark:text-[#F5F0E8] placeholder-gray-400 dark:placeholder-[#F5F0E8]/30 focus:border-[#C4622D]/50 focus:outline-none resize-none transition-colors" />
    </div>
  )

  return (
    <div className="min-h-screen p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-[#F5F0E8] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C4622D] to-[#E8853A] flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            Sales Agent
          </h1>
          <p className="text-gray-600 dark:text-[#F5F0E8]/60 mt-1">{isEn ? 'AI agents that convert visitors into customers 🐙' : 'Agentes de IA que convierten visitantes en clientes 🐙'}</p>
        </div>
        <Button onClick={() => { setForm(defaultForm); setActiveTab('basic'); setShowCreate(true) }} className="bg-[#C4622D] hover:bg-[#B5531E] text-white gap-2">
          <Plus className="w-4 h-4" /> {isEn ? 'Create Agent' : 'Crear Agente'}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { icon: Users, label: isEn ? 'Conversations' : 'Conversaciones', value: totalConversations, color: '#4A90D9' },
          { icon: MessageCircle, label: isEn ? 'Active Chats' : 'Chats Activos', value: totalChats, color: '#2D4A3E' },
          { icon: Zap, label: isEn ? 'Active Agents' : 'Agentes Activos', value: activeAgents, color: '#C4622D' },
        ].map((stat) => (
          <Card key={stat.label} className="bg-white dark:bg-[#1A1A1A] border-gray-200 dark:border-[#F5F0E8]/10 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${stat.color}20` }}>
                <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-[#F5F0E8]">{stat.value}</p>
                <p className="text-xs text-gray-500 dark:text-[#F5F0E8]/50">{stat.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Agents List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : agents.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-20">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[#C4622D]/10 flex items-center justify-center">
            <MessageSquare className="w-10 h-10 text-[#C4622D]" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-[#F5F0E8] mb-2">{isEn ? 'Create your first Sales Agent' : 'Crea tu primer Sales Agent'}</h3>
          <p className="text-gray-500 dark:text-[#F5F0E8]/50 max-w-md mx-auto mb-6">
            {isEn
              ? 'Configure an AI agent with deep context that converts visitors into buyers. Outperform any generic chatbot with built-in sales psychology.'
              : 'Configura un agente de IA con contexto profundo que convierte visitantes en compradores. Supera cualquier chatbot genérico con psicología de ventas integrada.'}
          </p>
          <Button onClick={() => setShowCreate(true)} className="bg-[#C4622D] hover:bg-[#B5531E] text-white gap-2">
            <Plus className="w-4 h-4" /> {isEn ? 'Create Agent' : 'Crear Agente'}
          </Button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {agents.map((agent, i) => {
            const score = getAgentScore(agent)
            return (
            <motion.div key={agent.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card className="bg-white dark:bg-[#1A1A1A] border-gray-200 dark:border-[#F5F0E8]/10 overflow-hidden">
                <div className="h-1.5" style={{ background: agent.accentColor }} />
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${agent.accentColor}20` }}>
                        <MessageSquare className="w-5 h-5" style={{ color: agent.accentColor }} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-[#F5F0E8]">{agent.name}</h3>
                        <p className="text-xs text-gray-500 dark:text-[#F5F0E8]/50">{agent.productName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${agent.isActive ? 'bg-green-500/20 text-green-600 dark:text-green-400' : 'bg-red-500/20 text-red-600 dark:text-red-400'}`}>
                        {agent.isActive ? (isEn ? 'Active' : 'Activo') : (isEn ? 'Paused' : 'Pausado')}
                      </span>
                    </div>
                  </div>

                  {/* Context Score Bar */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500 dark:text-[#F5F0E8]/50">{isEn ? 'Agent context' : 'Contexto del agente'}</span>
                      <span className={`text-xs font-medium ${score >= 8 ? 'text-green-500' : score >= 5 ? 'text-yellow-500' : 'text-orange-500'}`}>{score}/10</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-200 dark:bg-[#F5F0E8]/10 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${score >= 8 ? 'bg-green-500' : score >= 5 ? 'bg-yellow-500' : 'bg-orange-500'}`} style={{ width: `${score * 10}%` }} />
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 dark:text-[#F5F0E8]/60 mb-4 line-clamp-2">{agent.productDesc}</p>
                  <div className="flex gap-4 mb-4">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-[#F5F0E8]/50"><Users className="w-3.5 h-3.5" /><span>{agent.conversations} chats</span></div>
                    {agent.productPrice && <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-[#F5F0E8]/50"><DollarSign className="w-3.5 h-3.5" /><span>{agent.productPrice}</span></div>}
                    {agent.purchaseLink && <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-[#F5F0E8]/50"><Link2 className="w-3.5 h-3.5" /><span>{isEn ? 'Link active' : 'Link activo'}</span></div>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => copyEmbedCode(agent)} className="text-xs bg-gray-100 dark:bg-[#F5F0E8]/10 hover:bg-gray-200 dark:hover:bg-[#F5F0E8]/20 text-gray-900 dark:text-[#F5F0E8] gap-1.5 h-8">
                      {copiedId === agent.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedId === agent.id ? (isEn ? 'Copied!' : '¡Copiado!') : 'Embed'}
                    </Button>
                    <Button onClick={() => setViewingAgent(viewingAgent === agent.id ? null : agent.id)} className="text-xs bg-gray-100 dark:bg-[#F5F0E8]/10 hover:bg-gray-200 dark:hover:bg-[#F5F0E8]/20 text-gray-900 dark:text-[#F5F0E8] gap-1.5 h-8">
                      <Eye className="w-3.5 h-3.5" /> Preview
                    </Button>
                    <Button onClick={() => openEdit(agent)} className="text-xs bg-gray-100 dark:bg-[#F5F0E8]/10 hover:bg-gray-200 dark:hover:bg-[#F5F0E8]/20 text-gray-900 dark:text-[#F5F0E8] gap-1.5 h-8">
                      <Settings className="w-3.5 h-3.5" /> {isEn ? 'Edit' : 'Editar'}
                    </Button>
                    <Button onClick={() => toggleAgent(agent.id, agent.isActive)} className="text-xs bg-gray-100 dark:bg-[#F5F0E8]/10 hover:bg-gray-200 dark:hover:bg-[#F5F0E8]/20 text-gray-900 dark:text-[#F5F0E8] gap-1.5 h-8">
                      {agent.isActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {agent.isActive ? (isEn ? 'Pause' : 'Pausar') : (isEn ? 'Activate' : 'Activar')}
                    </Button>
                    <Button onClick={() => deleteAgent(agent.id)} className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-500 dark:text-red-400 gap-1.5 h-8">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <AnimatePresence>
                  {viewingAgent === agent.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 500, opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-gray-200 dark:border-[#F5F0E8]/10 overflow-hidden">
                      <iframe src={`/widget/chat/${agent.id}`} className="w-full h-[500px] border-none" title={`Preview: ${agent.name}`} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </motion.div>
          )})}
        </div>
      )}

      {/* ═══ CREATE / EDIT MODAL ═══ */}
      <AnimatePresence>
        {(showCreate || editingAgent) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4"
            onClick={closeModal}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#F5F0E8]/10 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
              
              {/* Modal Header */}
              <div className="p-5 border-b border-gray-200 dark:border-[#F5F0E8]/10 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-[#F5F0E8] flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[#C4622D]" />
                    {editingAgent ? (isEn ? 'Edit Agent' : 'Editar Agente') : (isEn ? 'Create Sales Agent' : 'Crear Sales Agent')}
                  </h2>
                  <button onClick={closeModal} className="text-gray-400 dark:text-[#F5F0E8]/40 hover:text-gray-900 dark:hover:text-[#F5F0E8]"><X className="w-5 h-5" /></button>
                </div>
                {/* Tabs */}
                <div className="flex gap-1 mt-4 overflow-x-auto pb-1">
                  {FORM_TABS_DEF.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                        activeTab === tab.id
                          ? 'bg-[#C4622D] text-white shadow-lg'
                          : 'text-gray-500 dark:text-[#F5F0E8]/50 hover:bg-gray-100 dark:hover:bg-[#F5F0E8]/10'
                      }`}>
                      <tab.icon className="w-3.5 h-3.5" /> {isEn ? tab.en : tab.es}
                    </button>
                  ))}
                </div>
              </div>

              {/* Modal Body - Scrollable */}
              <div className="flex-1 overflow-y-auto p-5">
                <div className="space-y-5">

                  {/* ═══ TAB: PRODUCTO ═══ */}
                  {activeTab === 'basic' && (
                    <>
                      <InputField label={isEn ? 'Agent Name *' : 'Nombre del Agente *'} icon={Sparkles}
                        value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })}
                        placeholder={isEn ? 'E.g.: Keto Pro Agent, Course Closer' : 'Ej: Agente Keto Pro, Closer de Cursos'} />
                      <InputField label={isEn ? 'Product Name *' : 'Nombre del Producto *'} icon={Package}
                        value={form.productName} onChange={(e: any) => setForm({ ...form, productName: e.target.value })}
                        placeholder={isEn ? 'E.g.: Keto Recipes Course, Premium Membership' : 'Ej: Curso Recetas Keto, Membresía Premium'} />
                      <TextAreaField label={isEn ? 'Product Description *' : 'Descripción del Producto *'} icon={BookOpen}
                        value={form.productDesc} onChange={(e: any) => setForm({ ...form, productDesc: e.target.value })}
                        placeholder={isEn ? 'Describe your product: what it includes, what it does, what problem it solves...' : 'Describe tu producto: qué incluye, para qué sirve, qué problema resuelve...'}
                        hint={isEn ? 'Be specific. The more detail you give, the better your agent will sell.' : 'Sé específico. Entre más detalle le des, mejor venderá tu agente.'} rows={4} />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <InputField label={isEn ? 'Price' : 'Precio'} icon={DollarSign}
                          value={form.productPrice} onChange={(e: any) => setForm({ ...form, productPrice: e.target.value })}
                          placeholder="$47 USD" />
                        <InputField label={isEn ? 'Purchase Link' : 'Link de Compra'} icon={Link2}
                          value={form.purchaseLink} onChange={(e: any) => setForm({ ...form, purchaseLink: e.target.value })}
                          placeholder="https://hotmart.com/..." />
                      </div>
                      <TextAreaField label={isEn ? 'Key Benefits' : 'Beneficios Clave'} icon={Star}
                        value={form.keyBenefits} onChange={(e: any) => setForm({ ...form, keyBenefits: e.target.value })}
                        placeholder={isEn ? '• 50 easy-to-make recipes\n• 30-day meal plan\n• Private community access\n• WhatsApp support' : '• 50 recetas fáciles de hacer\n• Plan de comidas de 30 días\n• Acceso a comunidad privada\n• Soporte por WhatsApp'}
                        hint={isEn ? 'List the main benefits. One per line.' : 'Lista los beneficios principales. Uno por línea.'} rows={4} />
                    </>
                  )}

                  {/* ═══ TAB: AUDIENCIA ═══ */}
                  {activeTab === 'audience' && (
                    <>
                      <TextAreaField label={isEn ? 'Target Audience' : 'Audiencia Objetivo'} icon={Target}
                        value={form.targetAudience} onChange={(e: any) => setForm({ ...form, targetAudience: e.target.value })}
                        placeholder={isEn ? 'Women aged 25-45 who want to lose weight healthily without going hungry. Tired of restrictive diets, looking for something sustainable.' : 'Mujeres de 25-45 años que quieren bajar de peso de forma saludable sin pasar hambre. Están cansadas de dietas restrictivas y buscan algo sostenible.'}
                        hint={isEn ? 'Who is your ideal buyer? Age, gender, main pain point, desire.' : '¿Quién es tu comprador ideal? Edad, género, dolor principal, deseo.'} rows={4} />
                      <TextAreaField label={isEn ? 'Social Proof / Testimonials' : 'Prueba Social / Testimonios'} icon={Award}
                        value={form.socialProof} onChange={(e: any) => setForm({ ...form, socialProof: e.target.value })}
                        placeholder={isEn ? '"Lost 8 kg in 2 months without going hungry" — Maria G.\n"The recipes are delicious, my family doesn\'t even notice they\'re keto" — Carlos R.\n+2,500 students in 15 countries' : '"Perdí 8 kg en 2 meses sin pasar hambre" — María G.\n"Las recetas son deliciosas, mi familia ni nota que son keto" — Carlos R.\n+2,500 alumnos en 15 países'}
                        hint={isEn ? 'Real testimonials, sales numbers, notable clients. The agent will cite them naturally.' : 'Testimonios reales, números de ventas, clientes destacados. El agente los citará naturalmente.'} rows={4} />
                      <TextAreaField label={isEn ? 'Competitor Info' : 'Información de Competidores'} icon={Swords}
                        value={form.competitorInfo} onChange={(e: any) => setForm({ ...form, competitorInfo: e.target.value })}
                        placeholder={isEn ? 'What sets us apart from other keto courses: we include Latin recipes, personal WhatsApp support, and customized meal plans.' : 'Diferencia vs otros cursos keto: nosotros incluimos recetas latinas, soporte WhatsApp personal, y plan de comidas personalizado.'}
                        hint={isEn ? 'What makes you different? The agent will use this to position your product.' : '¿Qué te diferencia? El agente usará esto para posicionar tu producto.'} rows={3} />
                    </>
                  )}

                  {/* ═══ TAB: VENTAS ═══ */}
                  {activeTab === 'sales' && (
                    <>
                      <TextAreaField label={isEn ? 'Objection Handling' : 'Manejo de Objeciones'} icon={ShieldCheck}
                        value={form.objections} onChange={(e: any) => setForm({ ...form, objections: e.target.value })}
                        placeholder={isEn ? '"Too expensive" → Includes 50 recipes + community + support = less than $1/day\n"No time" → Recipes in 15 min or less\n"Does it work?" → +2,500 students with real results' : '"Es muy caro" → Incluye 50 recetas + comunidad + soporte = menos de $1/día\n"No tengo tiempo" → Recetas de 15 min o menos\n"¿Funciona?" → +2,500 alumnos con resultados reales'}
                        hint={isEn ? 'Objection → Response. The agent will use them automatically.' : 'Objeción → Respuesta. El agente las usará automáticamente.'} rows={4} />
                      <TextAreaField label={isEn ? 'Urgency Triggers' : 'Gatillos de Urgencia'} icon={Clock}
                        value={form.urgencyTriggers} onChange={(e: any) => setForm({ ...form, urgencyTriggers: e.target.value })}
                        placeholder={isEn ? 'Special launch price this week only. Bonus: free intermittent fasting guide for a limited time. Only 20 spots left.' : 'Precio especial de lanzamiento solo esta semana. Bono: guía de ayuno intermitente gratis por tiempo limitado. Solo quedan 20 cupos.'}
                        hint={isEn ? 'Scarcity, limited offers, bonuses. The agent will mention them at the right moment.' : 'Escasez, ofertas limitadas, bonos. El agente los mencionará en el momento justo.'} rows={3} />
                      <TextAreaField label={isEn ? 'Guarantee' : 'Garantía'} icon={ShieldCheck}
                        value={form.guarantee} onChange={(e: any) => setForm({ ...form, guarantee: e.target.value })}
                        placeholder={isEn ? '30-day guarantee. If you don\'t like it, full refund. No questions asked.' : 'Garantía 30 días. Si no te gusta, te devuelvo tu dinero. Sin preguntas.'}
                        hint={isEn ? 'Reduces perceived risk. The agent uses it to close undecided prospects.' : 'Reduce el riesgo percibido. El agente lo usa para cerrar indecisos.'} rows={2} />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <InputField label={isEn ? 'Max Discount' : 'Descuento Máximo'} icon={Percent}
                          value={form.maxDiscount} onChange={(e: any) => setForm({ ...form, maxDiscount: e.target.value })}
                          placeholder={isEn ? '10% or $5 USD' : '10% o $5 USD'} />
                        <div>
                          <label className="block text-sm font-medium text-gray-600 dark:text-[#F5F0E8]/70 mb-1.5">
                            <Brain className="w-3.5 h-3.5 inline mr-1" /> {isEn ? 'Closing Style' : 'Estilo de Cierre'}
                          </label>
                          <select value={form.closingStyle} onChange={e => setForm({ ...form, closingStyle: e.target.value })}
                            className="w-full px-4 py-3 bg-gray-100 dark:bg-[#F5F0E8]/5 border border-gray-200 dark:border-[#F5F0E8]/10 rounded-xl text-gray-900 dark:text-[#F5F0E8] focus:border-[#C4622D]/50 focus:outline-none">
                            <option value="">{isEn ? 'Automatic' : 'Automático'}</option>
                            <option value="consultivo">{isEn ? 'Consultive — Listen first, close later' : 'Consultivo — Escucha primero, cierra después'}</option>
                            <option value="directo">{isEn ? 'Direct — Gets to the point fast' : 'Directo — Va al grano rápido'}</option>
                            <option value="suave">{isEn ? 'Soft — No pressure, lots of value' : 'Suave — Sin presión, mucho valor'}</option>
                            <option value="urgente">{isEn ? 'Urgent — Scarcity and FOMO' : 'Urgente — Escasez y FOMO'}</option>
                            <option value="storytelling">{isEn ? 'Storytelling — Sells with stories' : 'Storytelling — Vende con historias'}</option>
                          </select>
                        </div>
                      </div>
                    </>
                  )}

                  {/* ═══ TAB: CONOCIMIENTO ═══ */}
                  {activeTab === 'knowledge' && (
                    <>
                      <TextAreaField label={isEn ? 'Frequently Asked Questions (FAQ)' : 'Preguntas Frecuentes (FAQ)'} icon={HelpCircle}
                        value={form.faq} onChange={(e: any) => setForm({ ...form, faq: e.target.value })}
                        placeholder={isEn ? 'Q: Is it suitable for diabetics?\nA: Yes, all recipes are low-carb.\n\nQ: Does it include a shopping list?\nA: Yes, each week includes a grocery list.\n\nQ: Can I access it from my phone?\nA: Yes, the platform is 100% responsive.' : 'P: ¿Es apto para diabéticos?\nR: Sí, todas las recetas son bajas en carbohidratos.\n\nP: ¿Incluye lista de compras?\nR: Sí, cada semana incluye lista de supermercado.\n\nP: ¿Puedo acceder desde el celular?\nR: Sí, la plataforma es 100% responsive.'}
                        hint={isEn ? 'Question → Answer. The agent will respond exactly this when asked.' : 'Pregunta → Respuesta. El agente responderá exactamente esto cuando le pregunten.'} rows={6} />
                      <TextAreaField label={isEn ? 'Initial Greeting' : 'Saludo Inicial'} icon={MessageCircle}
                        value={form.greeting} onChange={(e: any) => setForm({ ...form, greeting: e.target.value })}
                        placeholder={isEn ? 'Hello! 👋 Interested in learning more about our course?' : '¡Hola! 👋 ¿Te interesa saber más sobre nuestro curso?'} rows={2} />
                      <TextAreaField label={isEn ? 'Brand Voice' : 'Voz de Marca'} icon={Sparkles}
                        value={form.brandVoice} onChange={(e: any) => setForm({ ...form, brandVoice: e.target.value })}
                        placeholder={isEn ? 'Speak like a knowledgeable friend. Casual but trustworthy tone. Use emojis sparingly.' : 'Habla como un amigo experto. Tono casual pero confiable. Usa emojis con moderación. Tutea al visitante.'}
                        hint={isEn ? 'How should your agent speak? Define its personality.' : '¿Cómo debe hablar tu agente? Define su personalidad.'} rows={3} />
                    </>
                  )}

                  {/* ═══ TAB: ESTILO ═══ */}
                  {activeTab === 'style' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-[#F5F0E8]/70 mb-1.5">
                          <Globe className="w-3.5 h-3.5 inline mr-1" /> {isEn ? 'Agent Language' : 'Idioma del Agente'}
                        </label>
                        <select value={form.agentLanguage} onChange={e => setForm({ ...form, agentLanguage: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-100 dark:bg-[#F5F0E8]/5 border border-gray-200 dark:border-[#F5F0E8]/10 rounded-xl text-gray-900 dark:text-[#F5F0E8] focus:border-[#C4622D]/50 focus:outline-none">
                          <option value="auto">{isEn ? 'Auto-detect visitor language' : 'Auto-detectar idioma del visitante'}</option>
                          <option value="es">Español</option>
                          <option value="en">English</option>
                          <option value="pt">Português</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-[#F5F0E8]/70 mb-2"><Palette className="w-3.5 h-3.5 inline mr-1" /> {isEn ? 'Widget Color' : 'Color del Widget'}</label>
                        <div className="flex gap-2 flex-wrap">
                          {ACCENT_COLORS.map(c => (
                            <button key={c.value} onClick={() => setForm({ ...form, accentColor: c.value })}
                              className={`w-8 h-8 rounded-lg transition-all ${form.accentColor === c.value ? 'ring-2 ring-[#C4622D] ring-offset-2 ring-offset-white dark:ring-offset-[#1A1A1A] scale-110' : 'hover:scale-105'}`}
                              style={{ backgroundColor: c.value }} title={isEn ? c.en : c.es} />
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-5 border-t border-gray-200 dark:border-[#F5F0E8]/10 flex-shrink-0">
                <div className="flex gap-3">
                  <Button onClick={editingAgent ? updateAgent : createAgent}
                    disabled={creating || !form.name || !form.productName || !form.productDesc}
                    className="flex-1 bg-[#C4622D] hover:bg-[#B5531E] text-white gap-2 disabled:opacity-50">
                    {creating ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Zap className="w-4 h-4" />}
                    {editingAgent ? (isEn ? 'Save Changes' : 'Guardar Cambios') : (isEn ? 'Create Agent' : 'Crear Agente')}
                  </Button>
                  <Button onClick={closeModal}
                    className="bg-gray-100 dark:bg-[#F5F0E8]/10 hover:bg-gray-200 dark:hover:bg-[#F5F0E8]/20 text-gray-900 dark:text-[#F5F0E8]">{isEn ? 'Cancel' : 'Cancelar'}</Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
