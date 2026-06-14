'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { isAdminEmail } from '@/lib/admin-email'
import { useI18n } from '@/lib/i18n-context'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Shield, Users, MessageSquare, Brain, TrendingUp, Zap,
  Activity, Database, RefreshCw, Loader2, AlertTriangle,
  Crown, Server, BarChart3, Eye, Clock, CheckCircle,
  XCircle, Globe, Cpu, Palette, Bot, Home as HomeIcon,
  ChevronDown, ChevronUp, Search, Lock, Layers,
  Send, Mic, MicOff, Volume2, VolumeX, Square, Sparkles, Video, Download, Play, Copy, ExternalLink,
  ImagePlus, X, Bell, UserPlus, Target, Lightbulb, AlertCircle,
  Mail, CheckCheck, ArrowRight, Share2, CalendarDays, FileText, Building2,
  MessageCircleQuestion, ThumbsUp, ThumbsDown, BookOpen, Plus, Trash2, Star, MessageSquareText, Code2,
} from 'lucide-react'

// ============================================
// TYPES
// ============================================
interface ModuleStats {
  socialBridge: { totalPosts: number; publishedPosts: number; connections: number; extensions: number }
  salesAgent: { totalAgents: number; activeAgents: number; chats: number; leads: number; hotLeads: number }
  invoices: { total: number; paid: number }
  calendar: { events: number; bookingConfigs: number }
  workspaces: { total: number }
  codeEngine: { sessions: number; hostedSites: number; activeSites: number; views: number; snapshots: number; customDomains: number }
}

interface AdminData {
  overview: {
    totalUsers: number
    totalProjects: number
    totalSessions: number
    totalMessages: number
    totalCreativeAssets: number
    totalArmConnections: number
    totalApiKeys: number
    totalSmartDevices: number
  }
  users: {
    id: string
    name: string | null
    email: string
    image: string | null
    createdAt: string
    updatedAt: string
    planId: string
    turboEnabled: boolean
    turboModel: string | null
    elevenLabsEnabled: boolean
    _count: {
      Project: number
      ChatSession: number
      CreativeAsset: number
      GrowthLead: number
      GrowthInsight: number
      ApiKey: number
      ArmConnection: number
      SmartDevice: number
    }
  }[]
  growthStats: {
    totalLeads: number
    totalActions: number
    pendingActions: number
    completedActions: number
    leadsByStatus: { status: string; _count: number }[]
  }
  ragStats: {
    totalSemanticMemories: number
    totalGraphEntities: number
    totalGraphRelations: number
    totalSemanticVectors: number
    totalKnowledgeDocs: number
    totalQueryHistory: number
  }
  moduleStats?: ModuleStats
  recentActivity: {
    messages: { id: string; role: string; content: string; createdAt: string; session: { userId: string; User: { name: string | null; email: string } } }[]
    sessions: { id: string; title: string; status: string; createdAt: string; updatedAt: string; User: { name: string | null; email: string }; _count: { messages: number } }[]
    leads: { id: string; businessName: string; status: string; priority: string; city: string | null; createdAt: string; User: { name: string | null } }[]
    actions: { id: string; actionType: string; title: string; status: string; createdAt: string; User: { name: string | null } }[]
  }
}

type TabKey = 'overview' | 'users' | 'intelligence' | 'growth' | 'activity' | 'security' | 'comms' | 'analytics' | 'platform' | 'octopus' | 'octoguide' | 'reputation'

// ============================================
// NOTIFICATION SYSTEM
// ============================================
interface AdminNotification {
  id: string
  type: 'info' | 'success' | 'warning' | 'alert'
  icon: string
  title: string
  description: string
  chatPrompt: string // Pre-filled question for OCTOPUS IA
  timestamp: string
}

function generateNotifications(data: AdminData): AdminNotification[] {
  const notifs: AdminNotification[] = []
  const now = new Date()

  // --- User milestones ---
  const { totalUsers, totalMessages, totalCreativeAssets, totalProjects, totalSmartDevices, totalArmConnections } = data.overview
  if (totalUsers >= 30) {
    notifs.push({
      id: `milestone-users-${totalUsers}`,
      type: 'success',
      icon: '🎉',
      title: `¡${totalUsers} usuarios en la plataforma!`,
      description: `La comunidad sigue creciendo. Tienes ${totalUsers} usuarios registrados.`,
      chatPrompt: `Tenemos ${totalUsers} usuarios registrados. Dame un análisis detallado de la base de usuarios, patrones de actividad, y recomendaciones para aumentar el engagement.`,
      timestamp: now.toISOString(),
    })
  }

  // --- New users (last 48h) ---
  const recentUsers = data.users.filter(u => {
    const created = new Date(u.createdAt)
    return (now.getTime() - created.getTime()) < 48 * 60 * 60 * 1000
  })
  if (recentUsers.length > 0) {
    notifs.push({
      id: `new-users-${recentUsers.length}-${now.toDateString()}`,
      type: 'info',
      icon: '👤',
      title: `${recentUsers.length} usuario${recentUsers.length > 1 ? 's' : ''} nuevo${recentUsers.length > 1 ? 's' : ''} (48h)`,
      description: recentUsers.map(u => u.name || u.email.split('@')[0]).join(', '),
      chatPrompt: `Hay ${recentUsers.length} usuarios nuevos en las últimas 48 horas: ${recentUsers.map(u => `${u.name || 'Sin nombre'} (${u.email})`).join(', ')}. Analiza quiénes son, qué plan tienen, y sugiere cómo hacer onboarding personalizado.`,
      timestamp: now.toISOString(),
    })
  }

  // --- Inactive users (no projects, no sessions) ---
  const inactiveUsers = data.users.filter(u => u._count.Project === 0 && u._count.ChatSession === 0)
  if (inactiveUsers.length > 2) {
    notifs.push({
      id: `inactive-users-${inactiveUsers.length}`,
      type: 'warning',
      icon: '😴',
      title: `${inactiveUsers.length} usuarios inactivos`,
      description: 'Usuarios que no han creado proyectos ni sesiones de chat.',
      chatPrompt: `Tenemos ${inactiveUsers.length} usuarios inactivos que no han creado proyectos ni sesiones. ¿Qué estrategias de re-engagement me recomiendas? Dame un plan de acción concreto.`,
      timestamp: now.toISOString(),
    })
  }

  // --- Messages milestone ---
  if (totalMessages >= 50) {
    notifs.push({
      id: `milestone-messages-${Math.floor(totalMessages / 50) * 50}`,
      type: 'success',
      icon: '💬',
      title: `${totalMessages} mensajes procesados`,
      description: 'La IA ha procesado una gran cantidad de conversaciones.',
      chatPrompt: `La plataforma ha procesado ${totalMessages} mensajes en total. Dame métricas de uso de la IA, tendencias de conversación, y recomendaciones para mejorar la calidad de las respuestas.`,
      timestamp: now.toISOString(),
    })
  }

  // --- Growth leads ---
  const { totalLeads, pendingActions } = data.growthStats
  if (totalLeads > 0) {
    notifs.push({
      id: `growth-leads-${totalLeads}`,
      type: 'info',
      icon: '🎯',
      title: `${totalLeads} leads en Growth Engine`,
      description: pendingActions > 0 ? `${pendingActions} acciones pendientes requieren atención.` : 'Todos los leads están siendo procesados.',
      chatPrompt: `El Growth Engine tiene ${totalLeads} leads y ${pendingActions} acciones pendientes. Dame un reporte detallado del pipeline de crecimiento y qué acciones priorizar.`,
      timestamp: now.toISOString(),
    })
  }
  if (pendingActions > 3) {
    notifs.push({
      id: `pending-actions-${pendingActions}`,
      type: 'alert',
      icon: '⚠️',
      title: `${pendingActions} acciones pendientes`,
      description: 'Hay acciones de crecimiento que necesitan ser ejecutadas.',
      chatPrompt: `Hay ${pendingActions} acciones de crecimiento pendientes. ¿Cuáles son las más urgentes y qué impacto tienen? Prioriza las acciones para mí.`,
      timestamp: now.toISOString(),
    })
  }

  // --- RAG Knowledge ---
  const { totalSemanticMemories, totalGraphEntities, totalSemanticVectors, totalKnowledgeDocs } = data.ragStats
  if (totalSemanticMemories > 0 || totalKnowledgeDocs > 0) {
    notifs.push({
      id: `rag-status-${totalSemanticMemories}-${totalGraphEntities}`,
      type: 'info',
      icon: '🧠',
      title: 'Estado RAG 2.0+',
      description: `${totalSemanticMemories} memorias, ${totalGraphEntities} entidades, ${totalSemanticVectors} vectores, ${totalKnowledgeDocs} docs.`,
      chatPrompt: `El sistema RAG tiene ${totalSemanticMemories} memorias semánticas, ${totalGraphEntities} entidades de grafo, ${totalSemanticVectors} vectores y ${totalKnowledgeDocs} documentos. Evalúa la salud del sistema de conocimiento y recomienda qué tipo de información debería agregar para mejorar la inteligencia.`,
      timestamp: now.toISOString(),
    })
  }

  // --- Creative assets ---
  if (totalCreativeAssets > 0) {
    notifs.push({
      id: `creative-assets-${totalCreativeAssets}`,
      type: 'success',
      icon: '🎨',
      title: `${totalCreativeAssets} assets creativos`,
      description: 'Assets generados por la plataforma.',
      chatPrompt: `La plataforma ha generado ${totalCreativeAssets} assets creativos. Dame un análisis de los tipos de contenido más creados y sugerencias para diversificar la producción creativa.`,
      timestamp: now.toISOString(),
    })
  }

  // --- IoT Smart Home ---
  if (totalSmartDevices > 0) {
    notifs.push({
      id: `iot-devices-${totalSmartDevices}`,
      type: 'info',
      icon: '🏠',
      title: `${totalSmartDevices} dispositivos IoT`,
      description: 'Dispositivos Smart Home conectados.',
      chatPrompt: `Hay ${totalSmartDevices} dispositivos IoT conectados al Smart Home. ¿Cuáles son, qué estado tienen, y qué automatizaciones puedo crear?`,
      timestamp: now.toISOString(),
    })
  }

  // --- Brazos (Connections) ---
  if (totalArmConnections > 0) {
    notifs.push({
      id: `brazos-${totalArmConnections}`,
      type: 'info',
      icon: '🦾',
      title: `${totalArmConnections} Brazos conectados`,
      description: `${data.overview.totalApiKeys} API keys activas.`,
      chatPrompt: `Tenemos ${totalArmConnections} brazos (conexiones) activos y ${data.overview.totalApiKeys} API keys. Dame un resumen de las integraciones activas, su salud, y qué nuevas integraciones recomiendas.`,
      timestamp: now.toISOString(),
    })
  }

  // --- Platform Health Overall ---
  notifs.push({
    id: `platform-health-${now.toDateString()}`,
    type: 'info',
    icon: '🐙',
    title: 'Resumen diario de la plataforma',
    description: `${totalUsers} usuarios, ${totalMessages} msgs, ${totalProjects} proyectos, ${totalCreativeAssets} assets.`,
    chatPrompt: `Dame un resumen ejecutivo completo de la plataforma OCTOPUS. Quiero saber: estado general, métricas clave, tendencias, problemas potenciales, y las 3 acciones más importantes que debo tomar hoy como CEO.`,
    timestamp: now.toISOString(),
  })

  return notifs
}

const NOTIF_COLORS = {
  info: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', dot: 'bg-blue-500' },
  success: { bg: 'bg-green-500/10', border: 'border-green-500/20', text: 'text-green-400', dot: 'bg-green-500' },
  warning: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', text: 'text-yellow-400', dot: 'bg-yellow-500' },
  alert: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400', dot: 'bg-red-500' },
}

// ============================================
// ADMIN PANEL
// ============================================
export default function AdminPage() {
  const { data: session, status } = useSession() || {}
  const router = useRouter()
  const { locale } = useI18n()
  const [data, setData] = useState<AdminData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [refreshing, setRefreshing] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [dismissedNotifs, setDismissedNotifs] = useState<string[]>([])
  const [octopusChatPrompt, setOctopusChatPrompt] = useState<string | null>(null)
  const notifPanelRef = useRef<HTMLDivElement>(null)

  const isAdmin = isAdminEmail(session?.user?.email)

  // Load dismissed notifications from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('octopus_dismissed_notifs')
        if (stored) setDismissedNotifs(JSON.parse(stored))
      } catch {}
    }
  }, [])

  // Close notification panel on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifPanelRef.current && !notifPanelRef.current.contains(e.target as Node)) {
        setShowNotifications(false)
      }
    }
    if (showNotifications) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showNotifications])

  // Generate notifications from data
  const notifications = data ? generateNotifications(data) : []
  const activeNotifs = notifications.filter(n => !dismissedNotifs.includes(n.id))
  const unreadCount = activeNotifs.length

  const dismissNotif = (id: string) => {
    const updated = [...dismissedNotifs, id]
    setDismissedNotifs(updated)
    if (typeof window !== 'undefined') {
      localStorage.setItem('octopus_dismissed_notifs', JSON.stringify(updated))
    }
  }

  const dismissAll = () => {
    const allIds = notifications.map(n => n.id)
    setDismissedNotifs(allIds)
    if (typeof window !== 'undefined') {
      localStorage.setItem('octopus_dismissed_notifs', JSON.stringify(allIds))
    }
  }

  const handleNotifChat = (prompt: string) => {
    setOctopusChatPrompt(prompt)
    setShowNotifications(false)
    setActiveTab('octopus')
  }

  const fetchData = useCallback(async () => {
    try {
      setRefreshing(true)
      const res = await fetch('/api/admin')
      if (res.status === 403) {
        setError('Acceso denegado')
        return
      }
      if (!res.ok) throw new Error('Error fetching admin data')
      const json = await res.json()
      setData(json)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user?.email || !isAdminEmail(session.user.email)) {
      router.replace('/dashboard')
      return
    }
    fetchData()
  }, [status, session, router, fetchData])

  // ACCESS DENIED SCREEN
  if (status !== 'loading' && !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#1A1A1A]">
        <Card className="p-8 text-center bg-red-950/50 border-red-500/30">
          <Lock className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-red-400 mb-2">⛔ Acceso Denegado</h2>
          <p className="text-red-300/70">Solo el administrador de la plataforma puede acceder a este panel.</p>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#1A1A1A]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#FFD700] animate-spin mx-auto mb-4" />
          <p className="text-[#F5F0E8]/70 text-lg">Cargando Panel de Administración...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#1A1A1A]">
        <Card className="p-8 text-center bg-red-950/30 border-red-500/20">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl text-red-400 mb-2">Error</h2>
          <p className="text-red-300/70">{error}</p>
          <Button onClick={fetchData} className="mt-4 bg-red-600 hover:bg-red-700 text-white">Reintentar</Button>
        </Card>
      </div>
    )
  }

  const tabs: { key: TabKey; label: string; icon: typeof Shield }[] = [
    { key: 'overview', label: 'Overview', icon: BarChart3 },
    { key: 'users', label: 'Usuarios', icon: Users },
    { key: 'intelligence', label: 'Inteligencia RAG', icon: Brain },
    { key: 'growth', label: 'Growth Engine', icon: TrendingUp },
    { key: 'activity', label: 'Actividad', icon: Activity },
    { key: 'security', label: 'Seguridad', icon: Shield },
    { key: 'platform', label: '🗺️ Plataforma', icon: Layers },
    { key: 'comms', label: '📧 Comunicaciones', icon: Mail },
    { key: 'analytics', label: '📈 Analytics', icon: BarChart3 },
    { key: 'octopus', label: '🐙 OCTOPUS IA', icon: Sparkles },
    { key: 'octoguide', label: '🤖 ASK Octo AI', icon: MessageCircleQuestion },
    { key: 'reputation', label: locale === 'es' ? '⭐ Reputación' : '⭐ Reputation', icon: Star },
  ]

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-[#F5F0E8] p-4 md:p-6 lg:p-8">
      {/* HEADER */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FFD700] to-[#C4622D] flex items-center justify-center shadow-lg shadow-[#FFD700]/20">
              <Crown className="w-8 h-8 text-[#1A1A1A]" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-[#FFD700] to-[#C4622D] bg-clip-text text-transparent">
                Panel de Administración
              </h1>
              <p className="text-[#F5F0E8]/50 text-sm mt-1">OCTOPUS Omni Cockpit — Control Total</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* NOTIFICATION BELL */}
            <div className="relative" ref={notifPanelRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className={`relative p-3 rounded-xl transition-all border ${
                  showNotifications 
                    ? 'bg-[#FFD700]/20 text-[#FFD700] border-[#FFD700]/30 shadow-lg shadow-[#FFD700]/10' 
                    : 'bg-[#1A1A1A] text-[#F5F0E8]/50 border-[#F5F0E8]/10 hover:bg-[#FFD700]/10 hover:text-[#FFD700] hover:border-[#FFD700]/20'
                }`}
                title="Notificaciones OCTOPUS"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#C4622D] text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse shadow-lg shadow-[#C4622D]/30">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* NOTIFICATION PANEL */}
              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="absolute right-0 top-14 w-[420px] max-h-[70vh] bg-[#0A0A0A] border border-[#FFD700]/15 rounded-2xl shadow-2xl shadow-black/50 z-[100] overflow-hidden"
                  >
                    {/* Panel Header */}
                    <div className="p-4 border-b border-[#FFD700]/10 bg-gradient-to-r from-[#FFD700]/5 to-transparent">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🔔</span>
                          <h3 className="text-sm font-bold text-[#FFD700]">Notificaciones OCTOPUS</h3>
                          {activeNotifs.length > 0 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#C4622D]/20 text-[#C4622D] font-medium">
                              {activeNotifs.length} nuevas
                            </span>
                          )}
                        </div>
                        {activeNotifs.length > 0 && (
                          <button
                            onClick={dismissAll}
                            className="text-[10px] text-[#F5F0E8]/30 hover:text-[#FFD700] transition-colors"
                          >
                            Marcar todas leídas
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Notifications List */}
                    <div className="overflow-y-auto max-h-[calc(70vh-64px)] scrollbar-hide">
                      {activeNotifs.length === 0 ? (
                        <div className="p-8 text-center">
                          <span className="text-4xl mb-3 block">✅</span>
                          <p className="text-[#F5F0E8]/40 text-sm">¡Todo en orden, CEO!</p>
                          <p className="text-[#F5F0E8]/20 text-xs mt-1">No hay notificaciones pendientes</p>
                        </div>
                      ) : (
                        <div className="p-2 space-y-1.5">
                          {activeNotifs.map((notif) => {
                            const colors = NOTIF_COLORS[notif.type]
                            return (
                              <div
                                key={notif.id}
                                className={`group p-3 rounded-xl ${colors.bg} border ${colors.border} hover:border-[#FFD700]/20 transition-all`}
                              >
                                <div className="flex items-start gap-3">
                                  <span className="text-xl flex-shrink-0 mt-0.5">{notif.icon}</span>
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-xs font-semibold ${colors.text}`}>{notif.title}</p>
                                    <p className="text-[10px] text-[#F5F0E8]/40 mt-0.5 line-clamp-2">{notif.description}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                      <button
                                        onClick={() => handleNotifChat(notif.chatPrompt)}
                                        className="flex items-center gap-1.5 text-[10px] font-medium text-[#FFD700] hover:text-[#FFD700]/80 bg-[#FFD700]/10 hover:bg-[#FFD700]/15 px-2.5 py-1 rounded-lg transition-all"
                                      >
                                        <MessageSquare className="w-3 h-3" />
                                        Pregúntale a OCTOPUS
                                      </button>
                                      <button
                                        onClick={() => dismissNotif(notif.id)}
                                        className="text-[10px] text-[#F5F0E8]/20 hover:text-[#F5F0E8]/50 transition-colors px-2 py-1"
                                      >
                                        Descartar
                                      </button>
                                    </div>
                                  </div>
                                  <div className={`w-2 h-2 rounded-full ${colors.dot} flex-shrink-0 mt-1.5 animate-pulse`} />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Button
              onClick={fetchData}
              disabled={refreshing}
              className="bg-[#2D4A3E] hover:bg-[#2D4A3E]/80 text-[#F5F0E8] border border-[#FFD700]/20"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
        </div>
      </motion.div>

      {/* TABS */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === tab.key
                  ? 'bg-[#FFD700]/20 text-[#FFD700] border border-[#FFD700]/30'
                  : 'bg-[#1A1A1A] text-[#F5F0E8]/50 border border-[#F5F0E8]/10 hover:bg-[#F5F0E8]/5 hover:text-[#F5F0E8]/70'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* TAB CONTENT */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'overview' && <OverviewTab data={data} />}
          {activeTab === 'users' && <UsersTab users={data.users} />}
          {activeTab === 'intelligence' && <IntelligenceTab stats={data.ragStats} />}
          {activeTab === 'growth' && <GrowthTab stats={data.growthStats} leads={data.recentActivity.leads} actions={data.recentActivity.actions} />}
          {activeTab === 'activity' && <ActivityTab activity={data.recentActivity} />}
          {activeTab === 'security' && <SecurityTab />}
          {activeTab === 'platform' && <PlatformTab moduleStats={data.moduleStats} overview={data.overview} ragStats={data.ragStats} growthStats={data.growthStats} />}
          {activeTab === 'comms' && <CommunicationsTab users={data.users} />}
          {activeTab === 'analytics' && <AnalyticsTab />}
          {activeTab === 'octopus' && <OctopusTab initialPrompt={octopusChatPrompt} onPromptConsumed={() => setOctopusChatPrompt(null)} />}
          {activeTab === 'octoguide' && <OctoGuideTab />}
          {activeTab === 'reputation' && <ReputationTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ============================================
// METRIC CARD
// ============================================
function MetricCard({ icon: Icon, label, value, color = '#FFD700', sub }: { icon: typeof Shield; label: string; value: number | string; color?: string; sub?: string }) {
  return (
    <Card className="bg-[#1A1A1A] border-[#F5F0E8]/10 p-5 hover:border-[#FFD700]/20 transition-all">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[#F5F0E8]/50 text-xs uppercase tracking-wider mb-1">{label}</p>
          <p className="text-3xl font-bold" style={{ color }}>{typeof value === 'number' ? value.toLocaleString() : value}</p>
          {sub && <p className="text-[#F5F0E8]/30 text-xs mt-1">{sub}</p>}
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
    </Card>
  )
}

// ============================================
// OVERVIEW TAB
// ============================================
function OverviewTab({ data }: { data: AdminData }) {
  const o = data.overview
  const ms = data.moduleStats
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-[#FFD700] flex items-center gap-2">
        <BarChart3 className="w-5 h-5" /> Métricas Globales
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard icon={Users} label="Usuarios" value={o.totalUsers} color="#4A90D9" />
        <MetricCard icon={MessageSquare} label="Mensajes" value={o.totalMessages} color="#2D4A3E" sub={`${o.totalSessions} sesiones`} />
        <MetricCard icon={Palette} label="Assets Creativos" value={o.totalCreativeAssets} color="#C4622D" />
        <MetricCard icon={Bot} label="Proyectos" value={o.totalProjects} color="#9B59B6" />
        <MetricCard icon={TrendingUp} label="Growth Leads" value={data.growthStats.totalLeads} color="#2ECC71" sub={`${data.growthStats.totalActions} acciones`} />
        <MetricCard icon={Brain} label="Memorias RAG" value={data.ragStats.totalSemanticMemories} color="#E74C3C" sub={`${data.ragStats.totalSemanticVectors} vectores`} />
        <MetricCard icon={Cpu} label="Conexiones (Brazos)" value={o.totalArmConnections} color="#3498DB" sub={`${o.totalApiKeys} API keys`} />
        <MetricCard icon={HomeIcon} label="Dispositivos IoT" value={o.totalSmartDevices} color="#F39C12" />
      </div>

      {/* Extended Module Metrics */}
      {ms && (
        <>
          <h4 className="text-sm font-semibold text-[#F5F0E8]/70 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4" /> Módulos Extendidos
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard icon={Share2} label="Social Bridge" value={ms.socialBridge.totalPosts} color="#1DA1F2" sub={`${ms.socialBridge.publishedPosts} publicados • ${ms.socialBridge.connections} redes`} />
            <MetricCard icon={Bot} label="Sales Agents" value={ms.salesAgent.totalAgents} color="#10B981" sub={`${ms.salesAgent.activeAgents} activos • ${ms.salesAgent.hotLeads} hot leads`} />
            <MetricCard icon={FileText} label="Facturación" value={ms.invoices.total} color="#C4622D" sub={`${ms.invoices.paid} pagadas`} />
            <MetricCard icon={CalendarDays} label="Agenda" value={ms.calendar.events} color="#8B5CF6" sub={`${ms.calendar.bookingConfigs} booking configs`} />
            <MetricCard icon={Building2} label="Workspaces" value={ms.workspaces.total} color="#FFD700" sub="Multi-marca activo" />
            <MetricCard icon={Code2} label="Code Engine" value={ms.codeEngine?.sessions ?? 0} color="#06B6D4" sub={`${ms.codeEngine?.hostedSites ?? 0} sitios • ${ms.codeEngine?.views ?? 0} visitas • ${ms.codeEngine?.snapshots ?? 0} snapshots`} />
          </div>
        </>
      )}

      {/* Platform health summary */}
      <Card className="bg-[#1A1A1A] border-[#F5F0E8]/10 p-6">
        <h4 className="text-sm font-semibold text-[#F5F0E8]/70 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Server className="w-4 h-4" /> Estado de la Plataforma
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[#2D4A3E]/20 border border-[#2D4A3E]/30">
            <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
            <div>
              <p className="text-sm font-medium text-[#F5F0E8]">Ley Absoluta</p>
              <p className="text-xs text-[#F5F0E8]/40">7 Artículos activos • INMUTABLE</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[#2D4A3E]/20 border border-[#2D4A3E]/30">
            <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
            <div>
              <p className="text-sm font-medium text-[#F5F0E8]">RAG 2.0+ Engine</p>
              <p className="text-xs text-[#F5F0E8]/40">Budget: 11K tokens • Auto-Summarizer ON</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[#2D4A3E]/20 border border-[#2D4A3E]/30">
            <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
            <div>
              <p className="text-sm font-medium text-[#F5F0E8]">Agente Centinela</p>
              <p className="text-xs text-[#F5F0E8]/40">Monitoreando 24/7 • 0 amenazas detectadas</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

// ============================================
// USERS TAB
// ============================================
function UsersTab({ users }: { users: AdminData['users'] }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedUser, setExpandedUser] = useState<string | null>(null)

  const filtered = users.filter(u =>
    (u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-lg font-semibold text-[#FFD700] flex items-center gap-2">
          <Users className="w-5 h-5" /> Usuarios Registrados ({users.length})
        </h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#F5F0E8]/30" />
          <input
            type="text"
            placeholder="Buscar usuario..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9 pr-4 py-2 rounded-xl bg-[#1A1A1A] border border-[#F5F0E8]/10 text-[#F5F0E8] text-sm placeholder-[#F5F0E8]/30 focus:outline-none focus:border-[#FFD700]/30 w-64"
          />
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map(user => (
          <Card key={user.id} className="bg-[#1A1A1A] border-[#F5F0E8]/10 overflow-hidden">
            <button
              onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}
              className="w-full p-4 flex items-center justify-between hover:bg-[#F5F0E8]/5 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#2D4A3E] to-[#C4622D] flex items-center justify-center text-white font-bold text-sm">
                  {user.image ? (
                    <img src={user.image} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    (user.name || user.email)[0]?.toUpperCase()
                  )}
                </div>
                <div>
                  <p className="text-[#F5F0E8] font-medium text-sm">{user.name || 'Sin nombre'}</p>
                  <p className="text-[#F5F0E8]/40 text-xs">{user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  user.planId === 'starter' ? 'bg-[#F5F0E8]/10 text-[#F5F0E8]/50' :
                  user.planId === 'pro' ? 'bg-[#FFD700]/20 text-[#FFD700]' :
                  'bg-purple-500/20 text-purple-400'
                }`}>
                  {user.planId.toUpperCase()}
                </span>
                {user.turboEnabled && <Zap className="w-4 h-4 text-[#FFD700]" />}
                {expandedUser === user.id ? <ChevronUp className="w-4 h-4 text-[#F5F0E8]/30" /> : <ChevronDown className="w-4 h-4 text-[#F5F0E8]/30" />}
              </div>
            </button>
            <AnimatePresence>
              {expandedUser === user.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatPill label="Proyectos" value={user._count.Project} />
                    <StatPill label="Sesiones Chat" value={user._count.ChatSession} />
                    <StatPill label="Assets Creativos" value={user._count.CreativeAsset} />
                    <StatPill label="Growth Leads" value={user._count.GrowthLead} />
                    <StatPill label="API Keys" value={user._count.ApiKey} />
                    <StatPill label="Conexiones" value={user._count.ArmConnection} />
                    <StatPill label="IoT Devices" value={user._count.SmartDevice} />
                    <StatPill label="Insights" value={user._count.GrowthInsight} />
                    <div className="col-span-2 md:col-span-4 flex flex-wrap gap-2 mt-1">
                      <span className="text-[10px] text-[#F5F0E8]/30">Registrado: {new Date(user.createdAt).toLocaleDateString('es')}</span>
                      <span className="text-[10px] text-[#F5F0E8]/30">•</span>
                      <span className="text-[10px] text-[#F5F0E8]/30">Último acceso: {new Date(user.updatedAt).toLocaleDateString('es')}</span>
                      {user.turboModel && <><span className="text-[10px] text-[#F5F0E8]/30">•</span><span className="text-[10px] text-[#FFD700]/50">Turbo: {user.turboModel}</span></>}
                      {user.elevenLabsEnabled && <><span className="text-[10px] text-[#F5F0E8]/30">•</span><span className="text-[10px] text-purple-400/50">ElevenLabs: ON</span></>}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        ))}
      </div>
    </div>
  )
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[#F5F0E8]/5 rounded-lg p-2 text-center">
      <p className="text-lg font-bold text-[#F5F0E8]">{value}</p>
      <p className="text-[10px] text-[#F5F0E8]/40 uppercase tracking-wider">{label}</p>
    </div>
  )
}

// ============================================
// INTELLIGENCE TAB (RAG)
// ============================================
function IntelligenceTab({ stats }: { stats: AdminData['ragStats'] }) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-[#FFD700] flex items-center gap-2">
        <Brain className="w-5 h-5" /> Motor de Inteligencia RAG 2.0+
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <MetricCard icon={Brain} label="Memorias Semánticas" value={stats.totalSemanticMemories} color="#E74C3C" />
        <MetricCard icon={Globe} label="Entidades del Grafo" value={stats.totalGraphEntities} color="#3498DB" sub={`${stats.totalGraphRelations} relaciones`} />
        <MetricCard icon={Database} label="Vectores Semánticos" value={stats.totalSemanticVectors} color="#9B59B6" />
        <MetricCard icon={Eye} label="Documentos KB" value={stats.totalKnowledgeDocs} color="#2ECC71" />
        <MetricCard icon={Search} label="Historial de Queries" value={stats.totalQueryHistory} color="#F39C12" />
        <MetricCard icon={Zap} label="Budget RAG" value="11,000" color="#FFD700" sub="tokens por request" />
      </div>

      {/* RAG Config Summary */}
      <Card className="bg-[#1A1A1A] border-[#F5F0E8]/10 p-6">
        <h4 className="text-sm font-semibold text-[#F5F0E8]/70 uppercase tracking-wider mb-4">Configuración Activa</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ConfigRow label="RAG Token Budget" value="11,000 tokens (número mágico 🐙)" />
          <ConfigRow label="Max Items Re-ranked" value="20" />
          <ConfigRow label="Historial Máximo" value="99 mensajes (número mágico 🎰)" />
          <ConfigRow label="Auto-Summarizer" value="Activo (>30 msgs → compresión LLM)" />
          <ConfigRow label="Max Response Tokens" value="4K-8K (dinámico)" />
          <ConfigRow label="Knowledge Base Chunks" value="4 chunks × 800 chars" />
          <ConfigRow label="Vector Search Text" value="700 chars por resultado" />
          <ConfigRow label="Knowledge Graph" value="1,000 chars" />
          <ConfigRow label="Modelo Principal" value="GPT-4.1 (1M token window)" />
          <ConfigRow label="Modelo Summarizer" value="GPT-4.1-mini" />
        </div>
      </Card>
    </div>
  )
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-[#F5F0E8]/5">
      <span className="text-xs text-[#F5F0E8]/50">{label}</span>
      <span className="text-xs text-[#FFD700] font-medium">{value}</span>
    </div>
  )
}

// ============================================
// GROWTH TAB
// ============================================
function GrowthTab({ stats, leads, actions }: { stats: AdminData['growthStats']; leads: AdminData['recentActivity']['leads']; actions: AdminData['recentActivity']['actions'] }) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-[#FFD700] flex items-center gap-2">
        <TrendingUp className="w-5 h-5" /> Growth Engine
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard icon={Users} label="Total Leads" value={stats.totalLeads} color="#2ECC71" />
        <MetricCard icon={Activity} label="Total Acciones" value={stats.totalActions} color="#3498DB" />
        <MetricCard icon={Clock} label="Pendientes" value={stats.pendingActions} color="#F39C12" />
        <MetricCard icon={CheckCircle} label="Completadas" value={stats.completedActions} color="#2D4A3E" />
      </div>

      {/* Leads by status */}
      {stats.leadsByStatus.length > 0 && (
        <Card className="bg-[#1A1A1A] border-[#F5F0E8]/10 p-6">
          <h4 className="text-sm font-semibold text-[#F5F0E8]/70 uppercase tracking-wider mb-3">Leads por Estado</h4>
          <div className="flex flex-wrap gap-3">
            {stats.leadsByStatus.map(s => (
              <div key={s.status} className="bg-[#F5F0E8]/5 rounded-lg px-4 py-2 text-center">
                <p className="text-lg font-bold text-[#F5F0E8]">{s._count}</p>
                <p className="text-[10px] text-[#F5F0E8]/40 uppercase">{s.status}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recent Leads */}
      <Card className="bg-[#1A1A1A] border-[#F5F0E8]/10 p-6">
        <h4 className="text-sm font-semibold text-[#F5F0E8]/70 uppercase tracking-wider mb-3">Últimos Leads</h4>
        <div className="space-y-2">
          {leads.map(lead => (
            <div key={lead.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-[#F5F0E8]/5">
              <div>
                <p className="text-sm text-[#F5F0E8] font-medium">{lead.businessName}</p>
                <p className="text-[10px] text-[#F5F0E8]/40">{lead.city || 'Sin ciudad'} • {new Date(lead.createdAt).toLocaleDateString('es')}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                  lead.status === 'new' ? 'bg-blue-500/20 text-blue-400' :
                  lead.status === 'contacted' ? 'bg-yellow-500/20 text-yellow-400' :
                  lead.status === 'qualified' ? 'bg-green-500/20 text-green-400' :
                  'bg-[#F5F0E8]/10 text-[#F5F0E8]/50'
                }`}>
                  {lead.status}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                  lead.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                  lead.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-[#F5F0E8]/10 text-[#F5F0E8]/50'
                }`}>
                  {lead.priority}
                </span>
              </div>
            </div>
          ))}
          {leads.length === 0 && <p className="text-sm text-[#F5F0E8]/30 text-center py-4">Sin leads aún</p>}
        </div>
      </Card>

      {/* Recent Actions */}
      <Card className="bg-[#1A1A1A] border-[#F5F0E8]/10 p-6">
        <h4 className="text-sm font-semibold text-[#F5F0E8]/70 uppercase tracking-wider mb-3">Últimas Acciones</h4>
        <div className="space-y-2">
          {actions.map(action => (
            <div key={action.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-[#F5F0E8]/5">
              <div>
                <p className="text-sm text-[#F5F0E8] font-medium">{action.title}</p>
                <p className="text-[10px] text-[#F5F0E8]/40">{action.actionType} • {new Date(action.createdAt).toLocaleDateString('es')}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                action.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                action.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                action.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                'bg-[#F5F0E8]/10 text-[#F5F0E8]/50'
              }`}>
                {action.status}
              </span>
            </div>
          ))}
          {actions.length === 0 && <p className="text-sm text-[#F5F0E8]/30 text-center py-4">Sin acciones aún</p>}
        </div>
      </Card>
    </div>
  )
}

// ============================================
// ACTIVITY TAB
// ============================================
function ActivityTab({ activity }: { activity: AdminData['recentActivity'] }) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-[#FFD700] flex items-center gap-2">
        <Activity className="w-5 h-5" /> Actividad Reciente
      </h3>

      {/* Recent Sessions */}
      <Card className="bg-[#1A1A1A] border-[#F5F0E8]/10 p-6">
        <h4 className="text-sm font-semibold text-[#F5F0E8]/70 uppercase tracking-wider mb-3">💬 Sesiones de Chat Recientes</h4>
        <div className="space-y-2">
          {activity.sessions.map(s => (
            <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-[#F5F0E8]/5">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#F5F0E8] font-medium truncate">{s.title}</p>
                <p className="text-[10px] text-[#F5F0E8]/40">{s.User?.name || s.User?.email || 'Unknown'} • {s._count.messages} msgs • {new Date(s.updatedAt).toLocaleString('es')}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] flex-shrink-0 ml-2 ${
                s.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-[#F5F0E8]/10 text-[#F5F0E8]/40'
              }`}>
                {s.status}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Recent Messages */}
      <Card className="bg-[#1A1A1A] border-[#F5F0E8]/10 p-6">
        <h4 className="text-sm font-semibold text-[#F5F0E8]/70 uppercase tracking-wider mb-3">📨 Últimos Mensajes</h4>
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {activity.messages.map(m => (
            <div key={m.id} className="py-2 px-3 rounded-lg bg-[#F5F0E8]/5">
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  m.role === 'user' ? 'bg-blue-500/20 text-blue-400' : 'bg-[#2D4A3E]/50 text-[#2D4A3E]'
                }`}>
                  {m.role === 'user' ? 'USER' : 'OCTOPUS'}
                </span>
                <span className="text-[10px] text-[#F5F0E8]/30">{m.session?.User?.name || m.session?.User?.email || ''}</span>
                <span className="text-[10px] text-[#F5F0E8]/20">{new Date(m.createdAt).toLocaleString('es')}</span>
              </div>
              <p className="text-xs text-[#F5F0E8]/60 leading-relaxed">{m.content}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ============================================
// PLATFORM TAB — Architecture Map + Module Status
// ============================================
interface PlatformModule {
  icon: string
  name: string
  description: string
  status: 'active' | 'beta' | 'hidden'
  category: string
  stats?: string
  route?: string
  highlight?: boolean
}

function PlatformTab({ moduleStats, overview, ragStats, growthStats }: { moduleStats?: ModuleStats; overview: AdminData['overview']; ragStats: AdminData['ragStats']; growthStats: AdminData['growthStats'] }) {
  const ms = moduleStats

  const modules: PlatformModule[] = [
    // Core IA
    { icon: '📊', name: 'Command Center', description: 'Dashboard KPIs en tiempo real — pipeline, leads, assets, agentes', status: 'active', category: 'Core', route: '/dashboard', stats: `${overview.totalMessages} msgs • ${overview.totalSessions} sesiones` },
    { icon: '🤖', name: 'Jarvis', description: 'Asistente IA conversacional — RAG 2.0+, voz bidireccional, visión, documentos PDF', status: 'active', category: 'Core', route: '/dashboard/jarvis', stats: `${ragStats.totalSemanticMemories} memorias • ${ragStats.totalSemanticVectors} vectores` },
    { icon: '🧠', name: 'RAG 2.0+ Engine', description: 'Motor de inteligencia semántica — grafos de conocimiento, vectores, auto-summarizer', status: 'active', category: 'Core', stats: `${ragStats.totalGraphEntities} entidades • ${ragStats.totalKnowledgeDocs} docs` },
    // Creación
    { icon: '🎨', name: 'Creative Studio', description: 'Chat con IA para generación de proyectos creativos multi-agente', status: 'active', category: 'Creación', route: '/dashboard/chat', stats: `${overview.totalCreativeAssets} assets` },
    { icon: '🏭', name: 'Project Foundry', description: 'Enjambre de agentes: Arquitecto, Diseñador, Frontend, Backend, Game, Image', status: 'hidden', category: 'Creación', route: '/dashboard/project-builder', stats: `${overview.totalProjects} proyectos` },
    { icon: '🎯', name: 'Ad Factory', description: 'Generador de anuncios con IA + Brand DNA Extractor + Multi-formato', status: 'active', category: 'Creación', route: '/dashboard/ad-factory' },
    { icon: '🎬', name: 'UGC Factory', description: 'Videos UGC con avatares IA, lip-sync, motion control, SeeDance', status: 'active', category: 'Creación', route: '/dashboard/ugc-factory' },
    { icon: '🖥️', name: 'Code Engine', description: 'IDE + Claude AI + Octopus Hosting — desarrollo full-stack con deploy instantáneo, versionado y analytics', status: 'active', category: 'Creación', route: '/dashboard/code-engine', stats: ms ? `${ms.codeEngine?.sessions ?? 0} sesiones • ${ms.codeEngine?.hostedSites ?? 0} sitios (${ms.codeEngine?.activeSites ?? 0} activos) • ${ms.codeEngine?.views ?? 0} visitas` : '', highlight: true },
    // Ventas & Crecimiento
    { icon: '📈', name: 'Growth Engine', description: 'Pipeline B2B/B2C + Intent Intelligence v2.0 + leads de agentes', status: 'active', category: 'Ventas', route: '/dashboard/growth', stats: `${growthStats.totalLeads} leads • ${growthStats.totalActions} acciones` },
    { icon: '🤖', name: 'Sales Agent', description: 'Agentes embebibles en landing pages — Elite Context Engine (10 campos), captura UTM', status: 'active', category: 'Ventas', route: '/dashboard/sales-agent', stats: ms ? `${ms.salesAgent.activeAgents}/${ms.salesAgent.totalAgents} activos • ${ms.salesAgent.leads} leads (${ms.salesAgent.hotLeads} 🔥)` : '' },
    { icon: '🧾', name: 'Facturación Express', description: 'Facturas y cotizaciones profesionales con PDF, tracking de pagos', status: 'active', category: 'Ventas', route: '/dashboard/invoices', stats: ms ? `${ms.invoices.total} docs • ${ms.invoices.paid} pagadas` : '' },
    // Publicación & Social
    { icon: '🌐', name: 'Social Bridge', description: '8 redes sociales via Extensión Chrome — SSE, anti-detección, training, scheduler (7 fases)', status: 'active', category: 'Social', route: '/dashboard/social-bridge', stats: ms ? `${ms.socialBridge.totalPosts} posts • ${ms.socialBridge.publishedPosts} publicados • ${ms.socialBridge.connections} conexiones` : '', highlight: true },
    { icon: '🏢', name: 'Multi-Workspace', description: 'Sistema multi-marca/agencia — LinkedIn aislado por workspace, branding independiente', status: 'active', category: 'Social', stats: ms ? `${ms.workspaces.total} workspaces` : '', highlight: true },
    // Organización
    { icon: '📅', name: 'Agenda Inteligente', description: 'Calendario + reservas públicas tipo Calendly con slots inteligentes', status: 'active', category: 'Organización', route: '/dashboard/calendar', stats: ms ? `${ms.calendar.events} eventos • ${ms.calendar.bookingConfigs} configs booking` : '' },
    { icon: '📁', name: 'Mis Proyectos', description: 'Sistema organizacional por categorías — Campaña, Contenido, Branding, Investigación', status: 'active', category: 'Organización', route: '/dashboard/projects', stats: `${overview.totalProjects} proyectos` },
    // Integraciones
    { icon: '🦾', name: 'Brazos Activos', description: 'Google Workspace (Calendar, Drive, Docs, Sheets, Gmail) + Telegram Bot', status: 'active', category: 'Integraciones', route: '/dashboard/brazos', stats: `${overview.totalArmConnections} conexiones • ${overview.totalApiKeys} API keys` },
    { icon: '🔌', name: 'API Hub', description: 'Gestión centralizada de API keys para servicios externos', status: 'active', category: 'Integraciones', route: '/dashboard/api-hub' },
    { icon: '🔍', name: 'Web Intelligence', description: 'Análisis profundo de sitios web con IA — SEO, contenido, tecnología', status: 'active', category: 'Integraciones' },
    // Agentes & Skills
    { icon: '⚡', name: 'Skill Factory', description: 'Creador visual de skills/herramientas para agentes IA', status: 'active', category: 'Agentes', route: '/dashboard/skill-factory' },
    { icon: '🤖', name: 'Agent Factory', description: 'Creador de agentes autónomos personalizados', status: 'active', category: 'Agentes', route: '/dashboard/agent-factory' },
    { icon: '🔧', name: 'MCP Factory', description: 'Servidores Model Context Protocol para herramientas avanzadas', status: 'active', category: 'Agentes', route: '/dashboard/mcp-factory' },
    { icon: '📚', name: 'MCP Directory', description: 'Directorio de MCPs disponibles para instalar', status: 'active', category: 'Agentes', route: '/dashboard/mcp-directory' },
    // Smart Home & System
    { icon: '🏠', name: 'Smart Home', description: 'Control IoT — WiZ + HubSpace + comandos de voz via Jarvis', status: 'active', category: 'Sistema', route: '/dashboard/hogar', stats: `${overview.totalSmartDevices} dispositivos` },
    { icon: '💳', name: 'Plans & Pricing', description: 'Sistema de suscripciones con Stripe — Starter, Pro, Enterprise', status: 'active', category: 'Sistema', route: '/dashboard/plans' },
    { icon: '⚙️', name: 'Settings', description: 'Voz (ElevenLabs), Turbo Mode, perfil, avatar, preferencias', status: 'active', category: 'Sistema', route: '/dashboard/settings' },
    { icon: '👑', name: 'Admin Panel', description: 'Panel CEO — OCTOPUS IA, analytics, comunicaciones, seguridad, mapa de plataforma', status: 'active', category: 'Sistema', route: '/dashboard/admin' },
  ]

  const categories = [...new Set(modules.map(m => m.category))]
  const categoryIcons: Record<string, string> = {
    'Core': '🧠', 'Creación': '🎨', 'Ventas': '💰', 'Social': '🌐',
    'Organización': '📋', 'Integraciones': '🔗', 'Agentes': '🤖', 'Sistema': '⚙️'
  }

  const activeCount = modules.filter(m => m.status === 'active').length
  const betaCount = modules.filter(m => m.status === 'beta').length
  const hiddenCount = modules.filter(m => m.status === 'hidden').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h3 className="text-lg font-semibold text-[#FFD700] flex items-center gap-2">
          <Layers className="w-5 h-5" /> Mapa de Plataforma — OCTOPUS Omni Cockpit
        </h3>
        <div className="flex gap-3">
          <span className="px-3 py-1 rounded-full bg-green-500/15 text-green-400 text-xs font-medium">🟢 {activeCount} Activos</span>
          {betaCount > 0 && <span className="px-3 py-1 rounded-full bg-yellow-500/15 text-yellow-400 text-xs font-medium">🟡 {betaCount} Beta</span>}
          {hiddenCount > 0 && <span className="px-3 py-1 rounded-full bg-[#F5F0E8]/10 text-[#F5F0E8]/40 text-xs font-medium">⚪ {hiddenCount} Ocultos</span>}
          <span className="px-3 py-1 rounded-full bg-[#FFD700]/15 text-[#FFD700] text-xs font-bold">{modules.length} Módulos Total</span>
        </div>
      </div>

      {/* Summary Cards */}
      {ms && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="bg-[#1A1A1A] border-[#FFD700]/15 p-4 text-center">
            <Building2 className="w-5 h-5 text-[#FFD700] mx-auto mb-1" />
            <p className="text-2xl font-bold text-[#FFD700]">{ms.workspaces.total}</p>
            <p className="text-[10px] text-[#F5F0E8]/40 uppercase">Workspaces</p>
          </Card>
          <Card className="bg-[#1A1A1A] border-blue-500/15 p-4 text-center">
            <Share2 className="w-5 h-5 text-blue-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-blue-400">{ms.socialBridge.publishedPosts}</p>
            <p className="text-[10px] text-[#F5F0E8]/40 uppercase">Posts Publicados</p>
          </Card>
          <Card className="bg-[#1A1A1A] border-green-500/15 p-4 text-center">
            <Bot className="w-5 h-5 text-green-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-green-400">{ms.salesAgent.activeAgents}</p>
            <p className="text-[10px] text-[#F5F0E8]/40 uppercase">Sales Agents</p>
          </Card>
          <Card className="bg-[#1A1A1A] border-purple-500/15 p-4 text-center">
            <CalendarDays className="w-5 h-5 text-purple-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-purple-400">{ms.calendar.events}</p>
            <p className="text-[10px] text-[#F5F0E8]/40 uppercase">Eventos</p>
          </Card>
          <Card className="bg-[#1A1A1A] border-[#C4622D]/15 p-4 text-center">
            <FileText className="w-5 h-5 text-[#C4622D] mx-auto mb-1" />
            <p className="text-2xl font-bold text-[#C4622D]">{ms.invoices.total}</p>
            <p className="text-[10px] text-[#F5F0E8]/40 uppercase">Facturas</p>
          </Card>
        </div>
      )}

      {/* Module Grid by Category */}
      {categories.map(category => (
        <div key={category}>
          <h4 className="text-sm font-bold text-[#F5F0E8]/60 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span>{categoryIcons[category] || '📦'}</span> {category}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {modules.filter(m => m.category === category).map((mod) => (
              <Card
                key={mod.name}
                className={`bg-[#1A1A1A] p-4 transition-all hover:border-[#FFD700]/20 ${
                  mod.highlight ? 'border-[#FFD700]/25 ring-1 ring-[#FFD700]/10' :
                  mod.status === 'hidden' ? 'border-[#F5F0E8]/5 opacity-50' : 'border-[#F5F0E8]/10'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0">{mod.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-[#F5F0E8] truncate">{mod.name}</p>
                      {mod.highlight && <span className="text-[8px] px-1.5 py-0.5 rounded bg-[#FFD700]/20 text-[#FFD700] font-bold uppercase">nuevo</span>}
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        mod.status === 'active' ? 'bg-green-400' :
                        mod.status === 'beta' ? 'bg-yellow-400' : 'bg-[#F5F0E8]/20'
                      }`} />
                    </div>
                    <p className="text-[11px] text-[#F5F0E8]/40 leading-relaxed mb-2">{mod.description}</p>
                    {mod.stats && (
                      <p className="text-[10px] text-[#FFD700]/60 font-mono">{mod.stats}</p>
                    )}
                    {mod.route && (
                      <p className="text-[9px] text-[#F5F0E8]/20 font-mono mt-1">{mod.route}</p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {/* Tech Stack */}
      <Card className="bg-[#1A1A1A] border-[#F5F0E8]/10 p-6">
        <h4 className="text-sm font-semibold text-[#F5F0E8]/70 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Server className="w-4 h-4" /> Stack Tecnológico
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <ConfigRow label="Framework" value="Next.js 14 (App Router)" />
          <ConfigRow label="Base de Datos" value="PostgreSQL + Prisma ORM" />
          <ConfigRow label="IA Principal" value="GPT-4.1 (1M tokens)" />
          <ConfigRow label="IA Rápida" value="GPT-4.1-mini" />
          <ConfigRow label="Turbo Mode" value="OpenRouter (Claude/GPT/Gemini)" />
          <ConfigRow label="Voz" value="ElevenLabs TTS + Web Speech API" />
          <ConfigRow label="Visión" value="GPT-4.1 Vision (multimodal)" />
          <ConfigRow label="Videos UGC" value="Hedra + SeeDance + Motion Control" />
          <ConfigRow label="Imágenes" value="Abacus AI Image Gen" />
          <ConfigRow label="Auth" value="NextAuth.js (Google SSO + Credentials)" />
          <ConfigRow label="Pagos" value="Stripe (Checkout + Portal)" />
          <ConfigRow label="PDF" value="Playwright HTML2PDF API" />
          <ConfigRow label="IoT" value="WiZ + HubSpace HTTP APIs" />
          <ConfigRow label="Social" value="Chrome Extension (Manifest V3 + SSE)" />
          <ConfigRow label="Email" value="Abacus AI Notification API" />
          <ConfigRow label="Storage" value="Abacus AI Cloud Storage (S3)" />
        </div>
      </Card>
    </div>
  )
}

// ============================================
// SECURITY TAB
// ============================================
function SecurityTab() {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-[#FFD700] flex items-center gap-2">
        <Shield className="w-5 h-5" /> Centro de Seguridad
      </h3>

      {/* Ley Absoluta Status */}
      <Card className="bg-[#1A1A1A] border-[#FFD700]/20 p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FFD700]/20 to-[#C4622D]/20 flex items-center justify-center">
            <Shield className="w-8 h-8 text-[#FFD700]" />
          </div>
          <div>
            <h4 className="text-xl font-bold text-[#FFD700]">⚖️ Ley Absoluta v1.0</h4>
            <p className="text-[#F5F0E8]/40 text-sm">Código Inquebrantable — Estado: ACTIVA</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <LawArticle num="I" title="Territorios Prohibidos" status="activo" desc="Deep Web, Dark Web, XXX, contenido ilegal" />
          <LawArticle num="II" title="Intenciones Encubiertas" status="activo" desc="Detección de prompt injection y evasiones" />
          <LawArticle num="III" title="Herramientas Blindadas" status="activo" desc="Skills/MCPs/Agentes maliciosos bloqueados" />
          <LawArticle num="IV" title="Auto-Mejora" status="activo" desc="Reportar → Esperar OK → Implementar" />
          <LawArticle num="V" title="Protección del Núcleo" status="activo" desc="9K llaves de encriptación cuántica" />
          <LawArticle num="VI" title="Agentes Externos" status="activo" desc="Detectar → Neutralizar → Desinformar → Bloquear" />
          <LawArticle num="VII" title="Agente Centinela" status="activo" desc="Monitoreo 24/7 • Defensa activa" />
        </div>
      </Card>

      {/* Sentinel Agent Status */}
      <Card className="bg-[#1A1A1A] border-[#2D4A3E]/30 p-6">
        <h4 className="text-sm font-semibold text-[#F5F0E8]/70 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-green-400" /> Agente Centinela — Estado
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-center">
            <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-green-400">0</p>
            <p className="text-[10px] text-green-300/60 uppercase">Amenazas Detectadas</p>
          </div>
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center">
            <Shield className="w-8 h-8 text-blue-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-blue-400">0</p>
            <p className="text-[10px] text-blue-300/60 uppercase">Intentos de Infiltración</p>
          </div>
          <div className="p-4 rounded-xl bg-[#FFD700]/10 border border-[#FFD700]/20 text-center">
            <Lock className="w-8 h-8 text-[#FFD700] mx-auto mb-2" />
            <p className="text-2xl font-bold text-[#FFD700]">0</p>
            <p className="text-[10px] text-[#FFD700]/60 uppercase">Usuarios Bloqueados</p>
          </div>
        </div>
      </Card>

      {/* Security Log */}
      <Card className="bg-[#1A1A1A] border-[#F5F0E8]/10 p-6">
        <h4 className="text-sm font-semibold text-[#F5F0E8]/70 uppercase tracking-wider mb-3">📜 Registro de Seguridad</h4>
        <div className="text-center py-8">
          <Shield className="w-12 h-12 text-green-400/30 mx-auto mb-3" />
          <p className="text-[#F5F0E8]/40 text-sm">Sin incidentes de seguridad registrados</p>
          <p className="text-[#F5F0E8]/20 text-xs mt-1">El Agente Centinela monitorea activamente todas las solicitudes</p>
        </div>
      </Card>
    </div>
  )
}

// ============================================
// COMMUNICATIONS TAB — Email to users
// ============================================
interface EmailTemplate {
  id: string
  icon: string
  label: string
  subject: string
  body: string
  ctaText: string
  ctaUrl: string
  type: string
}

const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'welcome',
    icon: '👋',
    label: 'Bienvenida',
    subject: '¡Bienvenido a OCTOPUS Omni Cockpit!',
    body: '¡Hola! 🐙\n\nGracias por unirte a OCTOPUS Omni Cockpit, la plataforma de inteligencia omnicanal más avanzada.\n\nAquí puedes:\n\n🤖 Hablar con Jarvis — tu asistente de IA personal\n🎨 Crear contenido profesional con Ad Factory\n📈 Escalar tu negocio con Growth Engine\n🏠 Controlar tu hogar inteligente con Smart Home\n\n¡Explora y descubre todo lo que OCTOPUS puede hacer por ti!',
    ctaText: 'Explorar OCTOPUS →',
    ctaUrl: '',
    type: 'onboarding',
  },
  {
    id: 'smart-home',
    icon: '🏠',
    label: 'Smart Home',
    subject: '🏠 Controla tu hogar desde OCTOPUS — Sin levantarte del sofá',
    body: '¡Hola! 🐙\n\n¿Sabías que puedes controlar tu hogar inteligente directamente desde OCTOPUS?\n\nCon Smart Home puedes:\n\n💡 Encender y apagar luces con un click o comando de voz\n🌡️ Ajustar la temperatura de tu hogar\n🔌 Controlar dispositivos WiZ y HubSpace\n📱 Todo desde una sola plataforma — sin salir de tu silla\n\nConecta tus dispositivos hoy y empieza a vivir la experiencia del hogar inteligente con OCTOPUS.',
    ctaText: 'Conectar Smart Home →',
    ctaUrl: '',
    type: 'tips',
  },
  {
    id: 'jarvis',
    icon: '🤖',
    label: 'Jarvis IA',
    subject: '🤖 Tu asistente Jarvis te espera — Habla, pregunta, crea',
    body: '¡Hola! 🐙\n\nJarvis es tu asistente de inteligencia artificial personal dentro de OCTOPUS.\n\nCon Jarvis puedes:\n\n🗣️ Hablar por voz en español o inglés\n📄 Analizar documentos PDF, imágenes y archivos\n🧠 Acceder a memoria contextual con RAG 2.0+\n🎨 Generar contenido creativo y resolver problemas\n⚡ Activar Turbo Mode para respuestas premium\n\nJarvis aprende de ti y se adapta a tu estilo. ¡Pruébalo ahora!',
    ctaText: 'Hablar con Jarvis →',
    ctaUrl: '',
    type: 'tips',
  },
  {
    id: 'ad-factory',
    icon: '🎨',
    label: 'Ad Factory',
    subject: '🎨 Crea contenido profesional con Ad Factory — IA Generativa',
    body: '¡Hola! 🐙\n\nAd Factory es tu estudio de contenido impulsado por IA generativa.\n\nCon Ad Factory puedes:\n\n🖼️ Generar imágenes publicitarias de alta calidad\n📝 Crear copys persuasivos automáticamente\n🎯 Brand DNA — extrae la esencia visual de cualquier marca\n📐 Múltiples formatos: Instagram, Facebook, Stories, y más\n\nCrea contenido profesional en segundos, sin necesidad de un diseñador.',
    ctaText: 'Crear con Ad Factory →',
    ctaUrl: '',
    type: 'tips',
  },
  {
    id: 'growth',
    icon: '📈',
    label: 'Growth Engine',
    subject: '📈 Escala tu negocio con Growth Engine — Pipeline inteligente',
    body: '¡Hola! 🐙\n\nGrowth Engine es tu motor de crecimiento inteligente dentro de OCTOPUS.\n\nCon Growth Engine puedes:\n\n🔍 Descubrir leads de alta calidad con IA\n📊 Pipeline visual de oportunidades\n📧 Inbox inteligente para comunicación\n🎯 Acciones automatizadas de seguimiento\n📋 Campañas de prospección personalizadas\n\nDeja que la IA trabaje por ti mientras tú te enfocas en cerrar negocios.',
    ctaText: 'Activar Growth Engine →',
    ctaUrl: '',
    type: 'tips',
  },
  {
    id: 'announcement',
    icon: '📢',
    label: 'Anuncio General',
    subject: '📢 Novedades en OCTOPUS Omni Cockpit',
    body: '¡Hola! 🐙\n\nTenemos novedades emocionantes en OCTOPUS Omni Cockpit.\n\n[Escribe tu anuncio aquí]\n\n¡Gracias por ser parte de la comunidad OCTOPUS!',
    ctaText: 'Ver Novedades →',
    ctaUrl: '',
    type: 'announcement',
  },
]

type UserInfo = AdminData['users'][number]

function CommunicationsTab({ users }: { users: UserInfo[] }) {
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [ctaText, setCtaText] = useState('')
  const [ctaUrl, setCtaUrl] = useState('')
  const [emailType, setEmailType] = useState('announcement')
  const [sendToAll, setSendToAll] = useState(true)
  const [selectedEmails, setSelectedEmails] = useState<string[]>([])
  const [filterType, setFilterType] = useState<'all' | 'active' | 'inactive' | 'new'>('all')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(null)
  const [showUserPicker, setShowUserPicker] = useState(false)

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  const filteredUsers = users.filter(u => {
    if (filterType === 'active') return u._count.Project > 0 || u._count.ChatSession > 0
    if (filterType === 'inactive') return u._count.Project === 0 && u._count.ChatSession === 0
    if (filterType === 'new') {
      const created = new Date(u.createdAt)
      return (Date.now() - created.getTime()) < 7 * 24 * 60 * 60 * 1000
    }
    return true
  })

  const applyTemplate = (template: EmailTemplate) => {
    setSelectedTemplate(template)
    setSubject(template.subject)
    setBody(template.body)
    setCtaText(template.ctaText)
    setCtaUrl(template.ctaUrl ? template.ctaUrl : `${baseUrl}/dashboard`)
    setEmailType(template.type)
  }

  const toggleEmail = (email: string) => {
    setSelectedEmails(prev =>
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    )
  }

  const selectFiltered = () => {
    setSelectedEmails(filteredUsers.map(u => u.email))
    setSendToAll(false)
    setShowUserPicker(false)
  }

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) return
    setSending(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: emailType,
          subject,
          body,
          ctaText: ctaText || undefined,
          ctaUrl: ctaUrl || undefined,
          sendToAll,
          recipientEmails: sendToAll ? undefined : selectedEmails,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult({ sent: data.sent, failed: data.failed, total: data.total })
      } else {
        setResult({ sent: 0, failed: 1, total: 1 })
      }
    } catch {
      setResult({ sent: 0, failed: 1, total: 1 })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-[#FFD700] flex items-center gap-2">
        <Mail className="w-5 h-5" /> Centro de Comunicaciones
      </h3>

      {/* Templates */}
      <Card className="bg-[#1A1A1A] border-[#FFD700]/20 p-5">
        <h4 className="text-sm font-semibold text-[#F5F0E8]/70 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#FFD700]" /> Plantillas Rápidas
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {EMAIL_TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => applyTemplate(t)}
              className={`p-3 rounded-xl text-center transition-all border ${
                selectedTemplate?.id === t.id
                  ? 'bg-[#FFD700]/15 border-[#FFD700]/30 text-[#FFD700]'
                  : 'bg-[#0A0A0A] border-[#F5F0E8]/5 text-[#F5F0E8]/50 hover:bg-[#F5F0E8]/5 hover:text-[#F5F0E8]/70'
              }`}
            >
              <span className="text-2xl block mb-1">{t.icon}</span>
              <span className="text-[10px] font-medium">{t.label}</span>
            </button>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Composer */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-[#1A1A1A] border-[#F5F0E8]/10 p-5 space-y-4">
            <h4 className="text-sm font-semibold text-[#F5F0E8]/70 uppercase tracking-wider flex items-center gap-2">
              <Mail className="w-4 h-4" /> Componer Email
            </h4>

            {/* Subject */}
            <div>
              <label className="text-xs text-[#F5F0E8]/40 mb-1 block">Asunto</label>
              <input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Asunto del email..."
                className="w-full bg-[#0A0A0A] border border-[#F5F0E8]/10 rounded-xl px-4 py-3 text-sm text-[#F5F0E8] placeholder-[#F5F0E8]/20 focus:outline-none focus:border-[#FFD700]/30"
              />
            </div>

            {/* Body */}
            <div>
              <label className="text-xs text-[#F5F0E8]/40 mb-1 block">Mensaje</label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Escribe el contenido del email..."
                rows={10}
                className="w-full bg-[#0A0A0A] border border-[#F5F0E8]/10 rounded-xl px-4 py-3 text-sm text-[#F5F0E8] placeholder-[#F5F0E8]/20 focus:outline-none focus:border-[#FFD700]/30 resize-none"
              />
            </div>

            {/* CTA */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#F5F0E8]/40 mb-1 block">Botón CTA (texto)</label>
                <input
                  value={ctaText}
                  onChange={e => setCtaText(e.target.value)}
                  placeholder="Ej: Explorar OCTOPUS →"
                  className="w-full bg-[#0A0A0A] border border-[#F5F0E8]/10 rounded-xl px-4 py-2.5 text-sm text-[#F5F0E8] placeholder-[#F5F0E8]/20 focus:outline-none focus:border-[#FFD700]/30"
                />
              </div>
              <div>
                <label className="text-xs text-[#F5F0E8]/40 mb-1 block">URL del botón</label>
                <input
                  value={ctaUrl}
                  onChange={e => setCtaUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-[#0A0A0A] border border-[#F5F0E8]/10 rounded-xl px-4 py-2.5 text-sm text-[#F5F0E8] placeholder-[#F5F0E8]/20 focus:outline-none focus:border-[#FFD700]/30"
                />
              </div>
            </div>

            {/* Type */}
            <div>
              <label className="text-xs text-[#F5F0E8]/40 mb-1 block">Tipo de email</label>
              <div className="flex gap-2">
                {[
                  { key: 'onboarding', label: '🎓 Onboarding' },
                  { key: 'tips', label: '💡 Tips' },
                  { key: 'announcement', label: '📢 Anuncio' },
                ].map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setEmailType(opt.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      emailType === opt.key
                        ? 'bg-[#FFD700]/15 text-[#FFD700] border border-[#FFD700]/30'
                        : 'bg-[#0A0A0A] text-[#F5F0E8]/40 border border-[#F5F0E8]/5 hover:text-[#F5F0E8]/60'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Recipients + Send */}
        <div className="space-y-4">
          <Card className="bg-[#1A1A1A] border-[#F5F0E8]/10 p-5 space-y-4">
            <h4 className="text-sm font-semibold text-[#F5F0E8]/70 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4" /> Destinatarios
            </h4>

            {/* All users toggle */}
            <button
              onClick={() => { setSendToAll(true); setShowUserPicker(false) }}
              className={`w-full p-3 rounded-xl text-left text-sm transition-all border ${
                sendToAll ? 'bg-[#FFD700]/10 border-[#FFD700]/30 text-[#FFD700]' : 'bg-[#0A0A0A] border-[#F5F0E8]/5 text-[#F5F0E8]/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  <span className="font-medium">Todos los usuarios</span>
                </div>
                <span className="text-xs opacity-60">{users.length}</span>
              </div>
            </button>

            {/* Select specific */}
            <button
              onClick={() => { setSendToAll(false); setShowUserPicker(true) }}
              className={`w-full p-3 rounded-xl text-left text-sm transition-all border ${
                !sendToAll ? 'bg-[#FFD700]/10 border-[#FFD700]/30 text-[#FFD700]' : 'bg-[#0A0A0A] border-[#F5F0E8]/5 text-[#F5F0E8]/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4" />
                  <span className="font-medium">Seleccionar usuarios</span>
                </div>
                {!sendToAll && selectedEmails.length > 0 && (
                  <span className="text-xs bg-[#FFD700]/20 px-2 py-0.5 rounded-full">{selectedEmails.length}</span>
                )}
              </div>
            </button>

            {/* User picker */}
            {showUserPicker && !sendToAll && (
              <div className="space-y-2">
                {/* Filters */}
                <div className="flex gap-1 flex-wrap">
                  {([
                    { key: 'all', label: 'Todos' },
                    { key: 'active', label: 'Activos' },
                    { key: 'inactive', label: 'Inactivos' },
                    { key: 'new', label: 'Nuevos (7d)' },
                  ] as { key: typeof filterType; label: string }[]).map(f => (
                    <button
                      key={f.key}
                      onClick={() => setFilterType(f.key)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-medium ${
                        filterType === f.key ? 'bg-[#FFD700]/15 text-[#FFD700]' : 'bg-[#0A0A0A] text-[#F5F0E8]/30'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                  <button
                    onClick={selectFiltered}
                    className="px-2 py-1 rounded-lg text-[10px] font-medium bg-[#2D4A3E] text-[#F5F0E8]/70 ml-auto"
                  >
                    Seleccionar todos ({filteredUsers.length})
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1 scrollbar-hide">
                  {filteredUsers.map(u => (
                    <label
                      key={u.id}
                      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all text-xs ${
                        selectedEmails.includes(u.email) ? 'bg-[#FFD700]/10 text-[#F5F0E8]' : 'text-[#F5F0E8]/40 hover:bg-[#F5F0E8]/5'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedEmails.includes(u.email)}
                        onChange={() => toggleEmail(u.email)}
                        className="rounded border-[#F5F0E8]/20 bg-transparent accent-[#FFD700]"
                      />
                      <span className="truncate">{u.name || u.email.split('@')[0]}</span>
                      <span className="text-[9px] text-[#F5F0E8]/20 ml-auto truncate">{u.email}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Summary */}
            <div className="text-xs text-[#F5F0E8]/30 flex items-center gap-2 pt-2 border-t border-[#F5F0E8]/5">
              <Mail className="w-3 h-3" />
              {sendToAll ? `Se enviará a ${users.length} usuarios` : `${selectedEmails.length} usuarios seleccionados`}
            </div>

            {/* Send Button */}
            <button
              onClick={handleSend}
              disabled={sending || !subject.trim() || !body.trim() || (!sendToAll && selectedEmails.length === 0)}
              className="w-full p-3.5 rounded-xl bg-gradient-to-r from-[#FFD700] to-[#C4622D] text-[#1A1A1A] font-bold text-sm hover:opacity-90 transition-all disabled:opacity-30 flex items-center justify-center gap-2 shadow-lg shadow-[#FFD700]/10"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enviando emails...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Enviar {sendToAll ? `a ${users.length} usuarios` : `a ${selectedEmails.length} usuarios`}
                </>
              )}
            </button>

            {/* Result */}
            {result && (
              <div className={`p-3 rounded-xl text-sm ${
                result.failed === 0 ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400'
              }`}>
                <div className="flex items-center gap-2">
                  <CheckCheck className="w-4 h-4" />
                  <span className="font-medium">
                    {result.sent}/{result.total} emails enviados
                    {result.failed > 0 ? ` • ${result.failed} fallidos` : ''}
                  </span>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

// ============================================
// ANALYTICS TAB — Gráficas de Tendencias
// ============================================
interface AnalyticsData {
  userGrowth: { date: string; total: number; new: number }[]
  messagesPerDay: { date: string; count: number }[]
  sessionsPerDay: { date: string; count: number }[]
  moduleUsage: { chat: number; assets: number; growth: number; devices: number }
  assetBreakdown: { type: string; count: number }[]
  leadBreakdown: { status: string; count: number }[]
  deviceBreakdown: { platform: string; count: number }[]
  engagement: { active: number; inactive: number; total: number }
}

function AnalyticsTab() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/analytics')
      .then(r => r.json())
      .then(d => { setAnalytics(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-[#FFD700]" />
      <span className="ml-3 text-[#F5F0E8]/60">Cargando analytics...</span>
    </div>
  )

  if (!analytics) return (
    <div className="text-center py-20 text-[#F5F0E8]/50">Error al cargar analytics</div>
  )

  const { userGrowth, messagesPerDay, sessionsPerDay, moduleUsage, assetBreakdown, leadBreakdown, deviceBreakdown, engagement } = analytics

  // Simple SVG chart helpers
  const maxVal = (arr: number[]) => Math.max(...arr, 1)

  // Sparkline component
  const Sparkline = ({ data, color, height = 60 }: { data: number[]; color: string; height?: number }) => {
    if (data.length < 2) return <div className="text-[#F5F0E8]/30 text-xs">Sin datos suficientes</div>
    const max = maxVal(data)
    const w = 100
    const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${height - (v / max) * (height - 4)}`).join(' ')
    return (
      <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`grad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          points={`0,${height} ${points} ${w},${height}`}
          fill={`url(#grad-${color.replace('#','')})`}
        />
        <polyline points={points} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
    )
  }

  // Bar chart component  
  const BarChart = ({ items, colorFn }: { items: { label: string; value: number }[]; colorFn: (i: number) => string }) => {
    const max = maxVal(items.map(i => i.value))
    return (
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={item.label} className="flex items-center gap-3">
            <span className="text-xs text-[#F5F0E8]/60 w-20 truncate">{item.label}</span>
            <div className="flex-1 h-6 bg-white/5 rounded overflow-hidden">
              <motion.div
                className="h-full rounded"
                style={{ backgroundColor: colorFn(i) }}
                initial={{ width: 0 }}
                animate={{ width: `${(item.value / max) * 100}%` }}
                transition={{ duration: 0.8, delay: i * 0.1 }}
              />
            </div>
            <span className="text-xs font-mono text-[#FFD700] w-10 text-right">{item.value}</span>
          </div>
        ))}
      </div>
    )
  }

  // Donut chart
  const DonutChart = ({ segments, size = 120 }: { segments: { label: string; value: number; color: string }[]; size?: number }) => {
    const total = segments.reduce((s, seg) => s + seg.value, 0)
    if (total === 0) return <div className="text-xs text-[#F5F0E8]/30">Sin datos</div>
    const r = size / 2 - 10
    const cx = size / 2
    const cy = size / 2
    let startAngle = -90

    return (
      <div className="flex items-center gap-4">
        <svg width={size} height={size}>
          {segments.map((seg, i) => {
            const angle = (seg.value / total) * 360
            const endAngle = startAngle + angle
            const largeArc = angle > 180 ? 1 : 0
            const x1 = cx + r * Math.cos((startAngle * Math.PI) / 180)
            const y1 = cy + r * Math.sin((startAngle * Math.PI) / 180)
            const x2 = cx + r * Math.cos((endAngle * Math.PI) / 180)
            const y2 = cy + r * Math.sin((endAngle * Math.PI) / 180)
            const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`
            startAngle = endAngle
            return <path key={i} d={path} fill={seg.color} opacity={0.85} />
          })}
          <circle cx={cx} cy={cy} r={r * 0.55} fill="#1A1A1A" />
          <text x={cx} y={cy - 4} textAnchor="middle" fill="#FFD700" fontSize="16" fontWeight="bold">{total}</text>
          <text x={cx} y={cy + 12} textAnchor="middle" fill="#F5F0E8" fontSize="9" opacity={0.5}>total</text>
        </svg>
        <div className="space-y-1">
          {segments.map((seg, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: seg.color }} />
              <span className="text-[#F5F0E8]/70">{seg.label}</span>
              <span className="text-[#FFD700] font-mono">{seg.value}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const COLORS = ['#FFD700', '#C4622D', '#2D4A3E', '#6366F1', '#EC4899', '#14B8A6', '#F59E0B', '#8B5CF6']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <BarChart3 className="w-6 h-6 text-[#FFD700]" />
        <h2 className="text-xl font-bold text-[#FFD700]">Analytics & Tendencias</h2>
        <span className="text-xs text-[#F5F0E8]/40 ml-auto">Últimos 30 días</span>
      </div>

      {/* Row 1: User Growth + Engagement Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 bg-[#1A1A1A] border-[#FFD700]/20 p-4">
          <h3 className="text-sm font-semibold text-[#F5F0E8]/80 mb-1">📈 Crecimiento de Usuarios (Acumulativo)</h3>
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <Sparkline data={userGrowth.map(d => d.total)} color="#FFD700" height={80} />
              <div className="flex justify-between text-[10px] text-[#F5F0E8]/30 mt-1">
                <span>{userGrowth[0]?.date?.slice(5) || ''}</span>
                <span>{userGrowth[userGrowth.length - 1]?.date?.slice(5) || ''}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-[#FFD700]">{userGrowth[userGrowth.length - 1]?.total || 0}</div>
              <div className="text-xs text-[#F5F0E8]/50">usuarios</div>
            </div>
          </div>
        </Card>

        <Card className="bg-[#1A1A1A] border-[#2D4A3E]/40 p-4">
          <h3 className="text-sm font-semibold text-[#F5F0E8]/80 mb-3">👥 Engagement</h3>
          <DonutChart segments={[
            { label: 'Activos (7d)', value: engagement.active, color: '#2D4A3E' },
            { label: 'Inactivos', value: engagement.inactive, color: '#C4622D' },
          ]} />
          <div className="mt-2 text-xs text-[#F5F0E8]/40">
            Retención: {engagement.total > 0 ? Math.round((engagement.active / engagement.total) * 100) : 0}%
          </div>
        </Card>
      </div>

      {/* Row 2: Messages + Sessions sparklines */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-[#1A1A1A] border-[#C4622D]/20 p-4">
          <h3 className="text-sm font-semibold text-[#F5F0E8]/80 mb-1">💬 Mensajes / Día</h3>
          <Sparkline data={messagesPerDay.map(d => d.count)} color="#C4622D" height={60} />
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-[#F5F0E8]/30">{messagesPerDay[0]?.date?.slice(5) || ''}</span>
            <span className="text-sm font-bold text-[#C4622D]">{messagesPerDay.reduce((s, d) => s + d.count, 0)} total</span>
          </div>
        </Card>

        <Card className="bg-[#1A1A1A] border-[#6366F1]/20 p-4">
          <h3 className="text-sm font-semibold text-[#F5F0E8]/80 mb-1">🔄 Sesiones / Día</h3>
          <Sparkline data={sessionsPerDay.map(d => d.count)} color="#6366F1" height={60} />
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-[#F5F0E8]/30">{sessionsPerDay[0]?.date?.slice(5) || ''}</span>
            <span className="text-sm font-bold text-[#6366F1]">{sessionsPerDay.reduce((s, d) => s + d.count, 0)} total</span>
          </div>
        </Card>
      </div>

      {/* Row 3: Module Usage + Asset Types */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-[#1A1A1A] border-white/10 p-4">
          <h3 className="text-sm font-semibold text-[#F5F0E8]/80 mb-3">🧩 Uso por Módulo (30d)</h3>
          <BarChart
            items={[
              { label: 'Chat/IA', value: moduleUsage.chat },
              { label: 'Creativos', value: moduleUsage.assets },
              { label: 'Growth', value: moduleUsage.growth },
              { label: 'IoT', value: moduleUsage.devices },
            ]}
            colorFn={(i) => COLORS[i]}
          />
        </Card>

        <Card className="bg-[#1A1A1A] border-white/10 p-4">
          <h3 className="text-sm font-semibold text-[#F5F0E8]/80 mb-3">🎨 Assets Creativos</h3>
          {assetBreakdown.length > 0 ? (
            <BarChart
              items={assetBreakdown.map(a => ({ label: a.type, value: a.count }))}
              colorFn={(i) => COLORS[i % COLORS.length]}
            />
          ) : (
            <div className="text-xs text-[#F5F0E8]/30 py-4 text-center">Sin assets en los últimos 30 días</div>
          )}
        </Card>
      </div>

      {/* Row 4: Leads + Devices */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-[#1A1A1A] border-white/10 p-4">
          <h3 className="text-sm font-semibold text-[#F5F0E8]/80 mb-3">🎯 Growth Leads por Status</h3>
          {leadBreakdown.length > 0 ? (
            <DonutChart
              segments={leadBreakdown.map((l, i) => ({ label: l.status, value: l.count, color: COLORS[i % COLORS.length] }))}
            />
          ) : (
            <div className="text-xs text-[#F5F0E8]/30 py-4 text-center">Sin leads registrados</div>
          )}
        </Card>

        <Card className="bg-[#1A1A1A] border-white/10 p-4">
          <h3 className="text-sm font-semibold text-[#F5F0E8]/80 mb-3">🏠 Dispositivos IoT</h3>
          {deviceBreakdown.length > 0 ? (
            <DonutChart
              segments={deviceBreakdown.map((d, i) => ({ label: d.platform, value: d.count, color: COLORS[i % COLORS.length] }))}
            />
          ) : (
            <div className="text-xs text-[#F5F0E8]/30 py-4 text-center">Sin dispositivos registrados</div>
          )}
        </Card>
      </div>
    </div>
  )
}

// ============================================
// OCTOPUS IA TAB — Chat con voz + conocimiento total
// ============================================
interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
}

interface SpeechRecogInstance {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: { resultIndex: number; results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } } }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}

function OctopusTab({ initialPrompt, onPromptConsumed }: { initialPrompt?: string | null; onPromptConsumed?: () => void }) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [pendingImage, setPendingImage] = useState<string | null>(null)
  const [pendingImageName, setPendingImageName] = useState<string>('')
  const [dragActive, setDragActive] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<SpeechRecogInstance | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const initialPromptSent = useRef(false)

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming, interimText])

  // Init speech recognition
  useEffect(() => {
    if (typeof window === 'undefined') return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechAPI) return

    const recog = new SpeechAPI() as SpeechRecogInstance
    recog.continuous = true
    recog.interimResults = true
    recog.lang = 'es-ES'

    recog.onresult = (event) => {
      let interim = ''
      let finalText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalText += result[0].transcript
        } else {
          interim += result[0].transcript
        }
      }
      if (finalText) {
        setInput(prev => (prev ? prev + ' ' : '') + finalText.trim())
        setInterimText('')
      } else {
        setInterimText(interim)
      }
    }
    recog.onerror = (e) => {
      console.warn('[Admin Speech] Error:', e.error)
      if (e.error !== 'aborted') setIsListening(false)
    }
    recog.onend = () => {
      setIsListening(false)
      setInterimText('')
    }
    recognitionRef.current = recog
  }, [])

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return
    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      setInput('')
      setInterimText('')
      try {
        recognitionRef.current.start()
        setIsListening(true)
      } catch { /* already started */ }
    }
  }, [isListening])

  // TTS
  const speak = useCallback(async (text: string) => {
    if (!voiceEnabled || !text) return
    setIsSpeaking(true)
    try {
      const res = await fetch('/api/jarvis/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.substring(0, 2500) }),
      })
      if (!res.ok) { setIsSpeaking(false); return }
      const { audioBase64 } = await res.json()
      if (!audioBase64) { setIsSpeaking(false); return }
      const audio = new Audio(`data:audio/mpeg;base64,${audioBase64}`)
      audioRef.current = audio
      audio.onended = () => setIsSpeaking(false)
      audio.onerror = () => setIsSpeaking(false)
      audio.play().catch(() => setIsSpeaking(false))
    } catch {
      setIsSpeaking(false)
    }
  }, [voiceEnabled])

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    setIsSpeaking(false)
  }, [])

  // Send message
  // Image handling
  const handleImageFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    if (file.size > 20 * 1024 * 1024) return // 20MB max
    const reader = new FileReader()
    reader.onload = (e) => {
      setPendingImage(e.target?.result as string)
      setPendingImageName(file.name)
    }
    reader.readAsDataURL(file)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const file = e.dataTransfer?.files?.[0]
    if (file) handleImageFile(file)
  }, [handleImageFile])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleImageFile(file)
    e.target.value = ''
  }, [handleImageFile])

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text || input).trim()
    if (!msg && !pendingImage) return
    if (isStreaming) return
    
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
    }
    setInterimText('')

    // Capture current image before clearing
    const currentImage = pendingImage
    const currentImageName = pendingImageName

    const displayContent = currentImage
      ? `${msg || 'Analiza esta imagen'}${currentImageName ? ` 📎 ${currentImageName}` : ' 📎 Imagen'}`
      : msg

    const userMsg: ChatMsg = { role: 'user', content: displayContent }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setPendingImage(null)
    setPendingImageName('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setIsStreaming(true)

    const history = [...messages, userMsg].slice(-30)
    const assistantMsg: ChatMsg = { role: 'assistant', content: '' }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: any = { message: msg || 'Analiza esta imagen', history }
    if (currentImage) payload.imageBase64 = currentImage

    try {
      abortRef.current = new AbortController()
      const res = await fetch('/api/admin/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: abortRef.current.signal,
      })

      if (!res.ok) throw new Error('Error')

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No reader')

      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''

      setMessages(prev => [...prev, assistantMsg])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              if (parsed.content) {
                fullText += parsed.content
                setMessages(prev => {
                  const updated = [...prev]
                  updated[updated.length - 1] = { role: 'assistant', content: fullText }
                  return updated
                })
              }
            } catch {}
          }
        }
      }

      // Auto-speak response
      if (voiceEnabled && fullText) {
        speak(fullText)
      }

      // === ACTION EXECUTOR: Parse and execute ```action blocks ===
      const actionMatch = fullText.match(/```action\s*\n?([\s\S]*?)```/)
      if (actionMatch) {
        try {
          const actionData = JSON.parse(actionMatch[1].trim())
          // Show executing indicator
          setMessages(prev => [...prev, { role: 'assistant', content: '⚡ Ejecutando acción...' }])
          const actionRes = await fetch('/api/admin/actions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(actionData),
          })
          const actionResult = await actionRes.json()
          const resultText = actionResult.success
            ? `✅ **Acción ejecutada:**\n${actionResult.result}`
            : `❌ **Error:** ${actionResult.result || actionResult.error || 'Error desconocido'}`
          setMessages(prev => {
            const updated = [...prev]
            updated[updated.length - 1] = { role: 'assistant', content: resultText }
            return updated
          })
        } catch {
          setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Error al parsear/ejecutar la acción.' }])
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages(prev => [...prev, { role: 'assistant', content: '❌ Error al comunicarse con OCTOPUS. Intenta de nuevo.' }])
      }
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }, [input, isStreaming, messages, isListening, voiceEnabled, speak, pendingImage, pendingImageName])

  // Handle initial prompt from notification
  useEffect(() => {
    if (initialPrompt && !initialPromptSent.current && !isStreaming) {
      initialPromptSent.current = true
      onPromptConsumed?.()
      setTimeout(() => sendMessage(initialPrompt), 300)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt, sendMessage])

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (isListening) {
        // Stop listening and send what we have
        if (recognitionRef.current) recognitionRef.current.stop()
        setIsListening(false)
        setTimeout(() => sendMessage(), 100)
      } else {
        sendMessage()
      }
    }
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 180px)', minHeight: '600px' }}>
      {/* Header Bar */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FFD700]/20 to-[#C4622D]/20 flex items-center justify-center">
            <span className="text-xl">🐙</span>
          </div>
          <div>
            <h3 className="text-base font-bold text-[#FFD700] flex items-center gap-2">
              OCTOPUS IA — Modo CEO
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium uppercase tracking-wider">Live</span>
            </h3>
            <p className="text-[10px] text-[#F5F0E8]/30">Acceso completo a todos los datos de la plataforma en tiempo real</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setVoiceEnabled(!voiceEnabled); if (isSpeaking) stopSpeaking() }}
            className={`p-2.5 rounded-xl transition-all ${voiceEnabled ? 'bg-[#FFD700]/20 text-[#FFD700] border border-[#FFD700]/20' : 'bg-[#F5F0E8]/5 text-[#F5F0E8]/30 border border-[#F5F0E8]/5'}`}
            title={voiceEnabled ? 'Voz activada' : 'Voz desactivada'}
          >
            {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          {isSpeaking && (
            <button onClick={stopSpeaking} className="p-2.5 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/20">
              <Square className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Chat Container — fills remaining space */}
      <Card
        className={`bg-[#0A0A0A] border-[#FFD700]/10 p-0 overflow-hidden flex flex-col flex-1 rounded-2xl shadow-xl shadow-black/20 relative transition-all ${dragActive ? 'border-[#FFD700]/50 ring-2 ring-[#FFD700]/20' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {dragActive && (
          <div className="absolute inset-0 bg-[#FFD700]/5 z-50 flex items-center justify-center backdrop-blur-sm rounded-2xl">
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-[#1A1A1A]/90 border border-[#FFD700]/30 shadow-xl">
              <ImagePlus className="w-12 h-12 text-[#FFD700]" />
              <p className="text-[#FFD700] font-semibold text-lg">Suelta tu imagen aquí</p>
              <p className="text-[#F5F0E8]/40 text-xs">OCTOPUS analizará la imagen con visión IA</p>
            </div>
          </div>
        )}
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-hide">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#FFD700]/15 to-[#C4622D]/15 flex items-center justify-center mb-6 shadow-lg shadow-[#FFD700]/5">
                <span className="text-5xl">🐙</span>
              </div>
              <h4 className="text-xl font-bold text-[#FFD700] mb-3">OCTOPUS en Modo CEO</h4>
              <p className="text-[#F5F0E8]/40 text-sm max-w-lg leading-relaxed mb-2">
                Tengo acceso completo a todos los datos de la plataforma en tiempo real.
                Pregúntame sobre métricas, usuarios, estrategia, módulos o cualquier aspecto del cockpit.
              </p>
              <p className="text-[#F5F0E8]/20 text-xs mb-8">
                🎙️ También puedes hablarme por voz — usa el micrófono para conversar
              </p>
              <div className="grid grid-cols-2 gap-2 max-w-lg w-full">
                {[
                  { q: '¿Cómo va la plataforma?', icon: '📊' },
                  { q: 'Dame un reporte ejecutivo', icon: '📋' },
                  { q: 'Envía email de Smart Home a los inactivos', icon: '🏠' },
                  { q: 'Envía bienvenida a los usuarios nuevos', icon: '👋' },
                  { q: 'Análisis del Growth Engine', icon: '🚀' },
                  { q: 'Sugerencias de mejora', icon: '💡' },
                ].map(({ q, icon }) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs text-left bg-[#1A1A1A] text-[#F5F0E8]/60 border border-[#F5F0E8]/5 hover:bg-[#FFD700]/10 hover:text-[#FFD700] hover:border-[#FFD700]/20 transition-all group"
                  >
                    <span className="text-base group-hover:scale-110 transition-transform">{icon}</span>
                    <span>{q}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[80%] rounded-2xl px-5 py-3.5 ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-[#2D4A3E] to-[#2D4A3E]/80 text-[#F5F0E8] rounded-br-md shadow-md shadow-[#2D4A3E]/20'
                  : 'bg-[#141414] border border-[#FFD700]/8 text-[#F5F0E8]/90 rounded-bl-md shadow-md shadow-black/10'
              }`}>
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[#FFD700]/5">
                    <span className="text-sm">🐙</span>
                    <span className="text-[10px] font-bold text-[#FFD700] uppercase tracking-widest">OCTOPUS</span>
                    <span className="text-[9px] text-[#F5F0E8]/15">•</span>
                    <span className="text-[9px] text-[#F5F0E8]/20">Modo CEO</span>
                  </div>
                )}
                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                  {msg.content.split(/(```action[\s\S]*?```)/g).map((part, pi) =>
                    part.startsWith('```action') ? (
                      <div key={pi} className="my-2 px-3 py-2 bg-[#FFD700]/10 border border-[#FFD700]/20 rounded-lg text-xs font-mono text-[#FFD700]">
                        ⚡ Acción detectada — ejecutando...
                      </div>
                    ) : (
                      <span key={pi}>{part.split(/(\*\*.*?\*\*)/g).map((seg, si) =>
                        seg.startsWith('**') && seg.endsWith('**')
                          ? <strong key={si} className="text-[#FFD700] font-semibold">{seg.slice(2, -2)}</strong>
                          : seg
                      )}</span>
                    )
                  )}
                </div>
                {msg.role === 'assistant' && !isStreaming && msg.content && (
                  <div className="flex items-center gap-3 mt-3 pt-2 border-t border-[#F5F0E8]/5">
                    {voiceEnabled && (
                      <button
                        onClick={() => speak(msg.content)}
                        className="text-[10px] text-[#F5F0E8]/25 hover:text-[#FFD700] transition-colors flex items-center gap-1"
                      >
                        <Volume2 className="w-3 h-3" /> Escuchar
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex justify-start">
              <div className="bg-[#141414] border border-[#FFD700]/8 rounded-2xl rounded-bl-md px-5 py-4 shadow-md">
                <div className="flex items-center gap-3">
                  <span className="text-lg">🐙</span>
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 bg-[#FFD700] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-[#FFD700] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-[#FFD700] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-[10px] text-[#F5F0E8]/20 ml-1">Analizando datos de la plataforma...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input Area — pinned bottom */}
        <div className="border-t border-[#FFD700]/10 p-4 bg-[#0A0A0A] flex-shrink-0">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInput}
            className="hidden"
          />
          {/* Pending image preview */}
          {pendingImage && (
            <div className="mb-3 flex items-start gap-3 p-3 rounded-xl bg-[#141414] border border-[#FFD700]/15">
              <div className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-[#1A1A1A]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pendingImage} alt={pendingImageName || 'Imagen'} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#FFD700] font-medium truncate">📎 {pendingImageName || 'Imagen'}</p>
                <p className="text-[10px] text-[#F5F0E8]/30 mt-1">Imagen lista para analizar con visión IA</p>
              </div>
              <button
                onClick={() => { setPendingImage(null); setPendingImageName('') }}
                className="p-1.5 rounded-lg bg-[#F5F0E8]/5 text-[#F5F0E8]/40 hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0"
                title="Quitar imagen"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          {isListening && interimText && (
            <div className="text-xs text-[#FFD700]/50 mb-2 px-2 italic animate-pulse">🎙️ {interimText}</div>
          )}
          {isListening && !interimText && (
            <div className="text-xs text-red-400/60 mb-2 px-2 flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              Escuchando... habla ahora
            </div>
          )}
          <div className="flex items-end gap-3">
            <button
              onClick={toggleListening}
              className={`p-3 rounded-xl transition-all flex-shrink-0 mb-0.5 ${
                isListening
                  ? 'bg-red-500/20 text-red-400 animate-pulse border border-red-500/30 shadow-lg shadow-red-500/10'
                  : 'bg-[#1A1A1A] text-[#F5F0E8]/40 hover:text-[#FFD700] hover:bg-[#FFD700]/10 border border-[#F5F0E8]/5 hover:border-[#FFD700]/20'
              }`}
              title={isListening ? 'Detener micrófono' : 'Hablar'}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-3 rounded-xl bg-[#1A1A1A] text-[#F5F0E8]/40 hover:text-[#FFD700] hover:bg-[#FFD700]/10 border border-[#F5F0E8]/5 hover:border-[#FFD700]/20 transition-all flex-shrink-0 mb-0.5"
              title="Adjuntar imagen"
              disabled={isStreaming}
            >
              <ImagePlus className="w-5 h-5" />
            </button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                // Auto-resize
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
              }}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? '🎙️ Escuchando...' : 'Pregúntale a OCTOPUS sobre la plataforma...'}
              className="flex-1 bg-[#141414] border border-[#F5F0E8]/8 rounded-xl px-5 py-3 text-sm text-[#F5F0E8] placeholder-[#F5F0E8]/20 focus:outline-none focus:border-[#FFD700]/30 focus:ring-1 focus:ring-[#FFD700]/20 transition-all resize-none overflow-y-auto scrollbar-hide"
              rows={1}
              style={{ maxHeight: '160px' }}
              disabled={isStreaming}
            />
            <button
              onClick={() => sendMessage()}
              disabled={isStreaming || (!input.trim() && !isListening && !pendingImage)}
              className="p-3 rounded-xl bg-gradient-to-r from-[#FFD700] to-[#C4622D] text-[#1A1A1A] hover:opacity-90 transition-all disabled:opacity-30 flex-shrink-0 shadow-lg shadow-[#FFD700]/10 mb-0.5"
            >
              {isStreaming ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
          {/* Context badges */}
          <div className="flex items-center justify-center gap-4 mt-3 text-[9px] text-[#F5F0E8]/15">
            <span className="flex items-center gap-1"><Database className="w-3 h-3" /> DB en tiempo real</span>
            <span>•</span>
            <span className="flex items-center gap-1"><Brain className="w-3 h-3" /> GPT-4.1 Vision + Acciones</span>
            <span>•</span>
            <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Admin Only</span>
            <span>•</span>
            <span className="flex items-center gap-1">{voiceEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />} {voiceEnabled ? 'Voz ON' : 'Voz OFF'}</span>
          </div>
        </div>
      </Card>
    </div>
  )
}

function LawArticle({ num, title, status, desc }: { num: string; title: string; status: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-[#F5F0E8]/5 border border-[#F5F0E8]/5">
      <div className="w-8 h-8 rounded-lg bg-[#FFD700]/10 flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-bold text-[#FFD700]">{num}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm text-[#F5F0E8] font-medium">{title}</p>
          <span className="w-2 h-2 rounded-full bg-green-400" />
        </div>
        <p className="text-[10px] text-[#F5F0E8]/40 mt-0.5">{desc}</p>
      </div>
    </div>
  )
}


// ============================================
// ASK OCTO AI TAB
// ============================================
function OctoGuideTab() {
  const [data, setData] = useState<{
    stats: {
      totalSessions: number
      totalMessages: number
      knowledgeCount: number
      helpfulCount: number
      notHelpfulCount: number
      resolvedCount: number
      satisfactionRate: number
      messagesByModule: { module: string; count: number }[]
    }
    recentSessions: {
      id: string
      user: { name: string | null; email: string; image: string | null } | null
      context: string | null
      messageCount: number
      lastMessage: string | null
      updatedAt: string
    }[]
    knowledgeArticles: {
      id: string
      title: string
      category: string
      module: string | null
      keywords: string[]
      priority: number
      createdAt: string
      updatedAt: string
    }[]
    learnedPatterns: {
      id: string
      question: string
      answer: string
      module: string | null
      createdAt: string
    }[]
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [activeSection, setActiveSection] = useState<'overview' | 'knowledge' | 'patterns' | 'sessions'>('overview')
  const [newArticle, setNewArticle] = useState({ title: '', content: '', category: 'faq', module: 'general', keywords: '', priority: 5 })
  const [showAddForm, setShowAddForm] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/octo-guide')
      const json = await res.json()
      if (json.success) setData(json)
    } catch (error) {
      console.error('Error fetching ASK Octo data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSeed = async () => {
    setSeeding(true)
    try {
      const res = await fetch('/api/octo-guide/seed', { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        alert(`✅ ${json.message}`)
        fetchData()
      }
    } catch (error) {
      console.error('Seed error:', error)
    } finally {
      setSeeding(false)
    }
  }

  const handleAddArticle = async () => {
    try {
      const res = await fetch('/api/admin/octo-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_knowledge',
          ...newArticle,
          keywords: newArticle.keywords.split(',').map(k => k.trim()).filter(Boolean),
        }),
      })
      const json = await res.json()
      if (json.success) {
        setShowAddForm(false)
        setNewArticle({ title: '', content: '', category: 'faq', module: 'general', keywords: '', priority: 5 })
        fetchData()
      }
    } catch (error) {
      console.error('Add article error:', error)
    }
  }

  const handleDeleteArticle = async (id: string) => {
    if (!confirm('¿Eliminar este artículo?')) return
    try {
      await fetch('/api/admin/octo-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_knowledge', id }),
      })
      fetchData()
    } catch (error) {
      console.error('Delete error:', error)
    }
  }

  const handlePromotePattern = async (patternId: string) => {
    try {
      const res = await fetch('/api/admin/octo-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'promote_pattern', patternId }),
      })
      const json = await res.json()
      if (json.success) {
        alert('✅ Patrón promovido a Knowledge Base')
        fetchData()
      }
    } catch (error) {
      console.error('Promote error:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#FFD700]" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-[#F5F0E8]/50">
        <MessageCircleQuestion className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No se pudieron cargar los datos</p>
        <Button onClick={fetchData} className="mt-4">Reintentar</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-purple-600/20 to-purple-800/10 border-purple-500/30 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{data.stats.totalSessions}</p>
              <p className="text-xs text-purple-300">Sesiones</p>
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-blue-600/20 to-blue-800/10 border-blue-500/30 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <MessageCircleQuestion className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{data.stats.totalMessages}</p>
              <p className="text-xs text-blue-300">Mensajes</p>
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-green-600/20 to-green-800/10 border-green-500/30 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <ThumbsUp className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{data.stats.satisfactionRate}%</p>
              <p className="text-xs text-green-300">Satisfacción</p>
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-amber-600/20 to-amber-800/10 border-amber-500/30 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{data.stats.knowledgeCount}</p>
              <p className="text-xs text-amber-300">Artículos KB</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Feedback Stats */}
      <Card className="bg-[#1A1A1A] border-white/10 p-4">
        <h3 className="text-sm font-semibold text-[#F5F0E8]/80 mb-3">📊 Feedback del Usuario</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <ThumbsUp className="w-5 h-5 text-green-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-green-400">{data.stats.helpfulCount}</p>
            <p className="text-xs text-green-300">Útiles</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <ThumbsDown className="w-5 h-5 text-red-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-red-400">{data.stats.notHelpfulCount}</p>
            <p className="text-xs text-red-300">No Útiles</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <CheckCircle className="w-5 h-5 text-blue-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-blue-400">{data.stats.resolvedCount}</p>
            <p className="text-xs text-blue-300">Resueltos</p>
          </div>
        </div>
      </Card>

      {/* Section Tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['overview', 'knowledge', 'patterns', 'sessions'] as const).map(section => (
          <button
            key={section}
            onClick={() => setActiveSection(section)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeSection === section
                ? 'bg-[#FFD700] text-black'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            {section === 'overview' && '📊 Overview'}
            {section === 'knowledge' && '📚 Knowledge Base'}
            {section === 'patterns' && '🧠 Patrones Aprendidos'}
            {section === 'sessions' && '💬 Sesiones Recientes'}
          </button>
        ))}
        <Button
          onClick={handleSeed}
          disabled={seeding}
          className="ml-auto bg-purple-600 hover:bg-purple-700"
        >
          {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          <span className="ml-2">Re-seed KB</span>
        </Button>
      </div>

      {/* Overview Section */}
      {activeSection === 'overview' && (
        <Card className="bg-[#1A1A1A] border-white/10 p-4">
          <h3 className="text-sm font-semibold text-[#F5F0E8]/80 mb-4">📈 Uso por Módulo</h3>
          <div className="space-y-2">
            {data.stats.messagesByModule.map((m, i) => {
              const maxCount = Math.max(...data.stats.messagesByModule.map(x => x.count))
              const width = maxCount > 0 ? (m.count / maxCount) * 100 : 0
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-white/60 w-24 truncate">{m.module}</span>
                  <div className="flex-1 h-6 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-white/80 w-12 text-right">{m.count}</span>
                </div>
              )
            })}
            {data.stats.messagesByModule.length === 0 && (
              <p className="text-xs text-white/40 text-center py-4">Sin datos aún</p>
            )}
          </div>
        </Card>
      )}

      {/* Knowledge Base Section */}
      {activeSection === 'knowledge' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-[#F5F0E8]/80">📚 Knowledge Base ({data.knowledgeArticles.length} artículos)</h3>
            <Button onClick={() => setShowAddForm(!showAddForm)} className="bg-green-600 hover:bg-green-700">
              <Plus className="w-4 h-4 mr-1" />
              Agregar
            </Button>
          </div>

          {showAddForm && (
            <Card className="bg-[#1A1A1A] border-white/10 p-4 space-y-3">
              <input
                type="text"
                placeholder="Título"
                value={newArticle.title}
                onChange={e => setNewArticle(p => ({ ...p, title: e.target.value }))}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
              />
              <textarea
                placeholder="Contenido"
                value={newArticle.content}
                onChange={e => setNewArticle(p => ({ ...p, content: e.target.value }))}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm h-24"
              />
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={newArticle.category}
                  onChange={e => setNewArticle(p => ({ ...p, category: e.target.value }))}
                  className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                >
                  <option value="faq">FAQ</option>
                  <option value="module">Módulo</option>
                  <option value="command">Comando</option>
                  <option value="error">Error</option>
                  <option value="best_practice">Best Practice</option>
                </select>
                <select
                  value={newArticle.module}
                  onChange={e => setNewArticle(p => ({ ...p, module: e.target.value }))}
                  className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                >
                  <option value="general">General</option>
                  <option value="jarvis">Jarvis</option>
                  <option value="social_bridge">Social Bridge</option>
                  <option value="ugc_factory">UGC Factory</option>
                  <option value="growth">Growth Engine</option>
                  <option value="ad_factory">Ad Factory</option>
                  <option value="sales_agent">Sales Agent</option>
                </select>
                <input
                  type="number"
                  placeholder="Prioridad (1-100)"
                  value={newArticle.priority}
                  onChange={e => setNewArticle(p => ({ ...p, priority: parseInt(e.target.value) || 5 }))}
                  className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                />
              </div>
              <input
                type="text"
                placeholder="Keywords (separadas por coma)"
                value={newArticle.keywords}
                onChange={e => setNewArticle(p => ({ ...p, keywords: e.target.value }))}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
              />
              <div className="flex gap-2">
                <Button onClick={handleAddArticle} className="bg-green-600 hover:bg-green-700">Guardar</Button>
                <Button onClick={() => setShowAddForm(false)} variant="outline">Cancelar</Button>
              </div>
            </Card>
          )}

          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {data.knowledgeArticles.map(article => (
              <Card key={article.id} className="bg-[#1A1A1A] border-white/10 p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">{article.category}</span>
                      {article.module && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">{article.module}</span>
                      )}
                      <span className="text-xs text-white/40">P:{article.priority}</span>
                    </div>
                    <p className="text-sm text-white font-medium">{article.title}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {article.keywords.slice(0, 5).map((kw, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/50">{kw}</span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteArticle(article.id)}
                    className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Learned Patterns Section */}
      {activeSection === 'patterns' && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-[#F5F0E8]/80">🧠 Patrones Aprendidos (Respuestas Útiles)</h3>
          <p className="text-xs text-white/40">Estas son respuestas que los usuarios marcaron como útiles. Puedes promoverlas a la Knowledge Base.</p>
          
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {data.learnedPatterns.map(pattern => (
              <Card key={pattern.id} className="bg-[#1A1A1A] border-white/10 p-4">
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 mb-2 inline-block">
                        {pattern.module || 'general'}
                      </span>
                    </div>
                    <Button
                      onClick={() => handlePromotePattern(pattern.id)}
                      className="bg-amber-600 hover:bg-amber-700 text-xs px-2 py-1 h-auto"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Promover a KB
                    </Button>
                  </div>
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2">
                    <p className="text-xs text-blue-300 mb-1">❓ Pregunta:</p>
                    <p className="text-sm text-white">{pattern.question}</p>
                  </div>
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2">
                    <p className="text-xs text-green-300 mb-1">✅ Respuesta:</p>
                    <p className="text-sm text-white/80 line-clamp-3">{pattern.answer}</p>
                  </div>
                </div>
              </Card>
            ))}
            {data.learnedPatterns.length === 0 && (
              <p className="text-xs text-white/40 text-center py-8">
                Aún no hay patrones aprendidos. Aparecerán aquí cuando los usuarios marquen respuestas como útiles.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Recent Sessions Section */}
      {activeSection === 'sessions' && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-[#F5F0E8]/80">💬 Sesiones Recientes</h3>
          
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {data.recentSessions.map(session => (
              <Card key={session.id} className="bg-[#1A1A1A] border-white/10 p-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                    {session.user?.name?.[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{session.user?.name || session.user?.email || 'Usuario'}</p>
                    <p className="text-xs text-white/40 truncate">{session.lastMessage || 'Sin mensajes'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono text-white/60">{session.messageCount} msgs</p>
                    <p className="text-[10px] text-white/30">{new Date(session.updatedAt).toLocaleDateString()}</p>
                  </div>
                </div>
              </Card>
            ))}
            {data.recentSessions.length === 0 && (
              <p className="text-xs text-white/40 text-center py-8">Sin sesiones recientes</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


// ============================================
// REPUTATION TAB — Context-Aware Feedback Engine
// ============================================
interface ReviewItem {
  id: string
  rating: number
  comment: string | null
  featureUsed: string | null
  feedbackType: string | null
  isPublic: boolean
  sentimentScore: number
  priority: string
  adminReply: string | null
  adminRepliedAt: string | null
  promoStatus: string | null
  promoImageUrl: string | null
  promoCopy: string | null
  promoVideoUrl: string | null
  promoVoiceUrl: string | null
  createdAt: string
  User: { name: string | null; email: string | null; image: string | null; planId: string | null }
}

function ReputationTab() {
  const { locale } = useI18n()
  const es = locale === 'es'
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [filter, setFilter] = useState<'all' | 'emotion' | 'usability' | 'results' | 'priority'>('all')
  const [promoGenerating, setPromoGenerating] = useState<Record<string, string>>({}) // reviewId -> 'ad' | 'video'
  const [expandedPromo, setExpandedPromo] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const fetchReviews = useCallback(async () => {
    try {
      const res = await fetch('/api/reviews?admin=true')
      const data = await res.json()
      if (data.reviews) setReviews(data.reviews)
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchReviews() }, [fetchReviews])

  const handleReply = async (reviewId: string) => {
    if (!replyText.trim()) return
    setSending(true)
    try {
      const res = await fetch('/api/reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId, adminReply: replyText }),
      })
      if (res.ok) { setReplyingTo(null); setReplyText(''); fetchReviews() }
    } catch { /* ignore */ } finally { setSending(false) }
  }

  const togglePublic = async (reviewId: string, isPublic: boolean) => {
    await fetch('/api/reviews', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reviewId, isPublic: !isPublic }) })
    fetchReviews()
  }

  // 🐙 Self-Promotion Engine handlers
  const generatePromoAd = async (reviewId: string) => {
    setPromoGenerating(prev => ({ ...prev, [reviewId]: 'ad' }))
    try {
      const res = await fetch('/api/reviews/promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId }),
      })
      if (res.ok) { fetchReviews(); setExpandedPromo(reviewId) }
    } catch { /* ignore */ } finally { setPromoGenerating(prev => { const n = { ...prev }; delete n[reviewId]; return n }) }
  }

  const generatePromoVideo = async (reviewId: string) => {
    setPromoGenerating(prev => ({ ...prev, [reviewId]: 'video' }))
    try {
      const res = await fetch('/api/reviews/promo/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId, voiceProfile: 'cinematic_male' }),
      })
      if (res.ok) { fetchReviews(); setExpandedPromo(reviewId) }
    } catch { /* ignore */ } finally { setPromoGenerating(prev => { const n = { ...prev }; delete n[reviewId]; return n }) }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // ── Computed scores by feedback type ──
  const emotionReviews = reviews.filter(r => r.feedbackType === 'emotion' || ['audio_factory', 'motion_graphics'].includes(r.featureUsed || ''))
  const usabilityReviews = reviews.filter(r => r.feedbackType === 'usability' || r.featureUsed === 'ad_factory')
  const resultsReviews = reviews.filter(r => r.feedbackType === 'results' || r.featureUsed === 'growth_engine')

  const calcScore = (arr: ReviewItem[]) => arr.length > 0 ? arr.reduce((s, r) => s + r.rating, 0) / arr.length : 0
  const wowScore = calcScore(emotionReviews)
  const publishScore = calcScore(usabilityReviews)
  const successScore = calcScore(resultsReviews)

  const totalReviews = reviews.length
  const avgRating = totalReviews > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / totalReviews : 0
  const highPriority = reviews.filter(r => r.priority === 'high' || r.priority === 'critical')
  const distribution = [1, 2, 3, 4, 5].map(star => reviews.filter(r => r.rating === star).length)

  const filtered = filter === 'all' ? reviews
    : filter === 'emotion' ? emotionReviews
    : filter === 'usability' ? usabilityReviews
    : filter === 'results' ? resultsReviews
    : highPriority

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#FFD700]" /></div>

  return (
    <div className="space-y-6">
      {/* ── Context-Aware Score Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-[#1A1A1A] border-white/10 p-4 text-center">
          <div className="text-3xl font-bold text-[#FFD700]">{avgRating.toFixed(1)}</div>
          <div className="flex items-center justify-center gap-0.5 mt-1">
            {[1, 2, 3, 4, 5].map(i => (
              <Star key={i} className={`w-3.5 h-3.5 ${i <= Math.round(avgRating) ? 'text-[#FFD700] fill-[#FFD700]' : 'text-white/20'}`} />
            ))}
          </div>
          <p className="text-xs text-white/50 mt-1">{es ? 'Global' : 'Overall'} ({totalReviews})</p>
        </Card>
        <Card className="bg-[#1A1A1A] border-[#FFD700]/20 p-4 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-[#FFD700] to-[#C4622D]" />
          <div className="text-xs mb-1">🎬</div>
          <div className="text-2xl font-bold text-[#FFD700]">{wowScore.toFixed(1)}</div>
          <p className="text-xs text-white/50 mt-0.5">Wow Score</p>
          <p className="text-[10px] text-white/30">Audio / Motion ({emotionReviews.length})</p>
        </Card>
        <Card className="bg-[#1A1A1A] border-[#8B5CF6]/20 p-4 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9]" />
          <div className="text-xs mb-1">📢</div>
          <div className="text-2xl font-bold text-[#8B5CF6]">{publishScore.toFixed(1)}</div>
          <p className="text-xs text-white/50 mt-0.5">Publish Score</p>
          <p className="text-[10px] text-white/30">Ad Factory ({usabilityReviews.length})</p>
        </Card>
        <Card className="bg-[#1A1A1A] border-[#10B981]/20 p-4 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-[#10B981] to-[#059669]" />
          <div className="text-xs mb-1">💰</div>
          <div className="text-2xl font-bold text-[#10B981]">{successScore.toFixed(1)}</div>
          <p className="text-xs text-white/50 mt-0.5">Success Score</p>
          <p className="text-[10px] text-white/30">Growth Engine ({resultsReviews.length})</p>
        </Card>
      </div>

      {/* ── High Priority Alert ── */}
      {highPriority.length > 0 && (
        <Card className="bg-red-500/5 border-red-500/20 p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-red-400">
                ⚡ {highPriority.length} {es ? 'issues de alta prioridad' : 'high priority issues'}
              </p>
              <p className="text-xs text-white/40">
                {es ? 'Feedback negativo de resultados — requiere atención inmediata' : 'Negative results feedback — requires immediate attention'}
              </p>
            </div>
            <button onClick={() => setFilter('priority')} className="ml-auto px-3 py-1 rounded-lg text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">
              {es ? 'Ver todos' : 'View all'}
            </button>
          </div>
        </Card>
      )}

      {/* ── Distribution Bar ── */}
      <Card className="bg-[#1A1A1A] border-white/10 p-5">
        <h3 className="text-sm font-semibold text-white/70 mb-4">{es ? 'Distribución de Ratings' : 'Rating Distribution'}</h3>
        <div className="space-y-2">
          {[5, 4, 3, 2, 1].map(star => {
            const count = distribution[star - 1]
            const pct = totalReviews > 0 ? (count / totalReviews) * 100 : 0
            return (
              <div key={star} className="flex items-center gap-3">
                <span className="text-sm text-white/60 w-8">{star}★</span>
                <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-[#FFD700] rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-sm text-white/40 w-10 text-right">{count}</span>
              </div>
            )
          })}
        </div>
      </Card>

      {/* ── Filter Tabs ── */}
      <div className="flex gap-2 flex-wrap">
        {([
          { key: 'all' as const, label: es ? 'Todas' : 'All', count: totalReviews, color: '' },
          { key: 'emotion' as const, label: '🎬 Wow', count: emotionReviews.length, color: 'text-[#FFD700]' },
          { key: 'usability' as const, label: '📢 Publish', count: usabilityReviews.length, color: 'text-[#8B5CF6]' },
          { key: 'results' as const, label: '💰 Success', count: resultsReviews.length, color: 'text-[#10B981]' },
          { key: 'priority' as const, label: '⚡ Priority', count: highPriority.length, color: 'text-red-400' },
        ]).map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === f.key ? 'bg-[#FFD700] text-[#1A1A1A]' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* ── 🐙 Self-Promotion Engine Banner ── */}
      {reviews.some(r => r.rating >= 4) && (
        <Card className="bg-gradient-to-r from-[#FFD700]/5 via-[#C4622D]/5 to-[#8B5CF6]/5 border-[#FFD700]/20 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#FFD700] to-[#C4622D] rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#FFD700]/20">
              <span className="text-lg">🐙</span>
            </div>
            <div>
              <p className="text-sm font-bold text-[#FFD700]">Self-Promotion Engine</p>
              <p className="text-xs text-white/40">
                {es ? 'Convierte reseñas positivas en ads virales, videos promo y posts de LinkedIn automáticamente' : 'Turn positive reviews into viral ads, promo videos and LinkedIn posts automatically'}
              </p>
            </div>
            <div className="ml-auto text-xs text-white/30">
              {reviews.filter(r => r.rating >= 4 && r.promoStatus === 'ready').length}/{reviews.filter(r => r.rating >= 4).length} {es ? 'promos listos' : 'promos ready'}
            </div>
          </div>
        </Card>
      )}

      {/* ── Reviews List ── */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <Card className="bg-[#1A1A1A] border-white/10 p-8 text-center">
            <MessageSquareText className="w-10 h-10 text-white/20 mx-auto mb-3" />
            <p className="text-white/40">{es ? 'No hay reviews en esta categoría' : 'No reviews in this category'}</p>
          </Card>
        )}
        {filtered.map(review => {
          const isPriority = review.priority === 'high' || review.priority === 'critical'
          const typeColor = review.feedbackType === 'emotion' ? '#FFD700' : review.feedbackType === 'usability' ? '#8B5CF6' : review.feedbackType === 'results' ? '#10B981' : '#666'
          const typeLabel = review.feedbackType === 'emotion' ? 'Wow' : review.feedbackType === 'usability' ? 'Publish' : review.feedbackType === 'results' ? 'Success' : 'General'
          const isPositive = review.rating >= 4
          const isGeneratingAd = promoGenerating[review.id] === 'ad'
          const isGeneratingVideo = promoGenerating[review.id] === 'video'
          const hasPromo = review.promoStatus === 'ready'
          const showPromo = expandedPromo === review.id

          return (
            <Card key={review.id} className={`bg-[#1A1A1A] p-5 ${isPriority ? 'border-red-500/30 ring-1 ring-red-500/10' : hasPromo ? 'border-[#FFD700]/20' : 'border-white/10'}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {isPriority && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold animate-pulse">
                        ⚡ {review.priority.toUpperCase()}
                      </span>
                    )}
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${typeColor}20`, color: typeColor }}>
                      {typeLabel}
                    </span>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map(i => (
                        <Star key={i} className={`w-3.5 h-3.5 ${i <= review.rating ? 'fill-current' : 'text-white/20'}`} style={i <= review.rating ? { color: typeColor } : undefined} />
                      ))}
                    </div>
                    <span className="text-xs text-white/40">
                      {new Date(review.createdAt).toLocaleDateString(es ? 'es-ES' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    {review.featureUsed && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#C4622D]/20 text-[#C4622D]">{review.featureUsed}</span>
                    )}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${review.isPublic ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-white/30'}`}>
                      {review.isPublic ? '🌐' : '🔒'}
                    </span>
                    {hasPromo && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FFD700]/20 text-[#FFD700] font-medium">
                        🐙 {es ? 'Promo listo' : 'Promo ready'}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-white/70 font-medium mb-1">{review.User?.name || review.User?.email || (es ? 'Anónimo' : 'Anonymous')}</p>
                  {review.comment && <p className="text-sm text-white/60">{review.comment}</p>}

                  {review.adminReply && (
                    <div className="mt-3 pl-4 border-l-2 border-[#FFD700]/30 bg-[#FFD700]/5 rounded-r-lg p-3">
                      <p className="text-xs text-[#FFD700]/70 font-medium mb-1">↩️ {es ? 'Tu respuesta' : 'Your reply'}</p>
                      <p className="text-sm text-white/60">{review.adminReply}</p>
                    </div>
                  )}

                  {/* 🐙 Self-Promotion Engine — Action buttons for positive reviews */}
                  {isPositive && (
                    <div className="mt-3 pt-3 border-t border-white/5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {!hasPromo && !review.promoImageUrl && (
                          <button
                            onClick={() => generatePromoAd(review.id)}
                            disabled={!!promoGenerating[review.id]}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#FFD700]/10 to-[#C4622D]/10 text-[#FFD700] hover:from-[#FFD700]/20 hover:to-[#C4622D]/20 transition-all border border-[#FFD700]/20 disabled:opacity-50"
                          >
                            {isGeneratingAd ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
                            {isGeneratingAd ? (es ? 'Generando ad...' : 'Generating ad...') : (es ? '🎨 Generar Social Ad' : '🎨 Generate Social Ad')}
                          </button>
                        )}
                        {(hasPromo || review.promoImageUrl) && (
                          <button
                            onClick={() => generatePromoVideo(review.id)}
                            disabled={!!promoGenerating[review.id]}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#8B5CF6]/10 to-[#C4622D]/10 text-[#8B5CF6] hover:from-[#8B5CF6]/20 hover:to-[#C4622D]/20 transition-all border border-[#8B5CF6]/20 disabled:opacity-50"
                          >
                            {isGeneratingVideo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Video className="w-3.5 h-3.5" />}
                            {isGeneratingVideo ? (es ? 'Generando video...' : 'Generating video...') : (es ? '🎥 Generate Promo Video' : '🎥 Generate Promo Video')}
                          </button>
                        )}
                        {hasPromo && (
                          <button
                            onClick={() => setExpandedPromo(showPromo ? null : review.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-white/60 hover:bg-white/10 transition-all"
                          >
                            {showPromo ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            {showPromo ? (es ? 'Ocultar promo' : 'Hide promo') : (es ? 'Ver promo' : 'View promo')}
                          </button>
                        )}
                        {review.promoStatus === 'generating' && !promoGenerating[review.id] && (
                          <span className="text-[10px] text-white/30 flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" /> {es ? 'Procesando en background...' : 'Processing in background...'}
                          </span>
                        )}
                      </div>

                      {/* ── Expanded Promo Preview ── */}
                      {showPromo && hasPromo && (
                        <div className="mt-4 space-y-4 bg-white/[0.02] rounded-xl p-4 border border-[#FFD700]/10">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-bold text-[#FFD700]">🐙 Self-Promotion Engine</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">READY</span>
                          </div>

                          {/* Promo Image */}
                          {review.promoImageUrl && (
                            <div>
                              <p className="text-xs text-white/40 mb-2 font-medium">{es ? '🎨 Social Proof Ad' : '🎨 Social Proof Ad'}</p>
                              <div className="relative aspect-square max-w-[280px] rounded-xl overflow-hidden border border-white/10 bg-black/30">
                                <img src={review.promoImageUrl} alt="Promo ad" className="w-full h-full object-cover" />
                              </div>
                            </div>
                          )}

                          {/* LinkedIn Copy */}
                          {review.promoCopy && (
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <p className="text-xs text-white/40 font-medium">📝 LinkedIn Copy</p>
                                <button
                                  onClick={() => copyToClipboard(review.promoCopy || '', review.id + '_copy')}
                                  className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/40 hover:text-[#FFD700] hover:bg-white/10 transition-all"
                                >
                                  {copiedId === review.id + '_copy' ? <CheckCheck className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                                  {copiedId === review.id + '_copy' ? (es ? 'Copiado!' : 'Copied!') : (es ? 'Copiar' : 'Copy')}
                                </button>
                              </div>
                              <div className="bg-white/5 rounded-lg p-3 text-xs text-white/60 whitespace-pre-wrap max-h-40 overflow-y-auto">
                                {review.promoCopy}
                              </div>
                            </div>
                          )}

                          {/* Promo Video */}
                          {review.promoVideoUrl && (
                            <div>
                              <p className="text-xs text-white/40 mb-2 font-medium">🎥 {es ? 'Video Promo Masterizado' : 'Masterized Promo Video'}</p>
                              <div className="relative max-w-[400px] rounded-xl overflow-hidden border border-white/10 bg-black">
                                <video src={review.promoVideoUrl} controls className="w-full" />
                              </div>
                              <div className="flex gap-2 mt-2">
                                <a
                                  href={review.promoVideoUrl}
                                  download={`octopus-promo-${review.id}.mp4`}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#FFD700]/10 text-[#FFD700] hover:bg-[#FFD700]/20 transition-all border border-[#FFD700]/20"
                                  onClick={e => { e.preventDefault(); const a = document.createElement('a'); a.href = review.promoVideoUrl || ''; a.download = `octopus-promo-${review.id}.mp4`; document.body.appendChild(a); a.click(); document.body.removeChild(a) }}
                                >
                                  <Download className="w-3.5 h-3.5" /> {es ? 'Descargar' : 'Download'}
                                </a>
                                {review.promoCopy && (
                                  <button
                                    onClick={() => copyToClipboard(review.promoCopy || '', review.id + '_share')}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#0077B5]/10 text-[#0077B5] hover:bg-[#0077B5]/20 transition-all border border-[#0077B5]/20"
                                  >
                                    {copiedId === review.id + '_share' ? <CheckCheck className="w-3.5 h-3.5" /> : <ExternalLink className="w-3.5 h-3.5" />}
                                    {copiedId === review.id + '_share' ? (es ? '¡Copiado!' : 'Copied!') : 'LinkedIn'}
                                  </button>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Voice-only preview (if no video yet) */}
                          {review.promoVoiceUrl && !review.promoVideoUrl && (
                            <div>
                              <p className="text-xs text-white/40 mb-2 font-medium">🎙️ {es ? 'Narración' : 'Narration'}</p>
                              <audio src={review.promoVoiceUrl} controls className="w-full max-w-[300px]" />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {replyingTo === review.id && (
                    <div className="mt-3 flex gap-2">
                      <input value={replyText} onChange={e => setReplyText(e.target.value)} placeholder={es ? 'Escribe tu respuesta...' : 'Write your reply...'}
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#FFD700]/50" />
                      <Button size="sm" onClick={() => handleReply(review.id)} disabled={sending} className="bg-[#FFD700] text-[#1A1A1A] hover:bg-[#FFD700]/90">
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setReplyingTo(null); setReplyText('') }} className="text-white/40"><X className="w-4 h-4" /></Button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 ml-4">
                  <Button size="sm" variant="ghost" onClick={() => { setReplyingTo(review.id); setReplyText(review.adminReply || '') }} className="text-white/40 hover:text-[#FFD700]" title={es ? 'Responder' : 'Reply'}>
                    <MessageSquare className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => togglePublic(review.id, review.isPublic)} className="text-white/40 hover:text-[#FFD700]" title={review.isPublic ? (es ? 'Ocultar' : 'Hide') : (es ? 'Publicar' : 'Publish')}>
                    {review.isPublic ? <Eye className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}