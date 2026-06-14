'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useSession } from 'next-auth/react'
import {
  TrendingUp,
  Users,
  MessageSquare,
  Target,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Globe,
  Flame,
  BarChart3,
  Palette,
  FolderOpen,
  Link2,
  HomeIcon,
  BookOpen,
  Activity,
  Clock,
  Eye,
  Mail,
  RefreshCw,
  Loader2,
  ChevronRight,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useMetrics } from '@/lib/metrics-context'
import { useI18n } from '@/lib/i18n-context'
import Link from 'next/link'
import { MegaSkillLauncher } from '@/components/mega-skill-launcher'
import { ContentPublishWidget } from '@/components/content-publish-widget'
import { GettingStartedChecklist } from '@/components/getting-started-checklist'
import { TentacleHealthWidget } from '@/components/tentacle-health-widget'

interface KPIData {
  growth: {
    totalLeads: number
    leadsToday: number
    leadsThisWeek: number
    hotLeads: number
    conversionRate: number
    replyRate: number
    outreachSent: number
    statusBreakdown: Record<string, number>
    tierBreakdown: Record<string, number>
    converted: number
    replied: number
  }
  sales: {
    totalAgents: number
    activeAgents: number
    totalChats: number
    chatsToday: number
    capturedLeads: number
    hotLeads: number
    sourceBreakdown: Record<string, number>
  }
  creative: {
    totalAssets: number
    assetsToday: number
  }
  platform: {
    projects: number
    connections: number
    smartDevices: number
    knowledgeDocs: number
  }
  recentLeads: any[]
  recentAgentLeads: any[]
}

const TIER_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  diamond: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', label: '💎 Diamond' },
  vibranium: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400', label: '🟣 Vibranium' },
  antimatter: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', label: '⚛️ Antimatter' },
}

const SOURCE_COLORS: Record<string, string> = {
  facebook: '#1877F2', google: '#EA4335', linkedin: '#0A66C2',
  tiktok: '#010101', instagram: '#E4405F', direct: '#6b7280',
}

export default function DashboardPage() {
  const { data: session } = useSession() || {}
  const { activities } = useMetrics()
  const { t } = useI18n()
  const userName = session?.user?.name?.split(' ')?.[0] ?? 'Usuario'
  const [kpis, setKpis] = useState<KPIData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchKPIs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch('/api/dashboard/kpis')
      if (res.ok) setKpis(await res.json())
    } catch (_) { /* silent */ }
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { fetchKPIs() }, [fetchKPIs])

  // Time-based greeting
  const hour = new Date().getHours()
  const greeting = hour < 12 ? (t('cmd.morning') || 'Buenos días') : hour < 18 ? (t('cmd.afternoon') || 'Buenas tardes') : (t('cmd.evening') || 'Buenas noches')

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-[#C4622D] mx-auto" />
          <p className="text-gray-500 dark:text-gray-400">{t('cmd.loading') || 'Cargando Command Center...'}</p>
        </div>
      </div>
    )
  }

  const g = kpis?.growth
  const s = kpis?.sales
  const c = kpis?.creative
  const p = kpis?.platform

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-[#F5F0E8]">
            {greeting}, {userName}! 🐙
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{t('cmd.subtitle') || 'Tu centro de comando en tiempo real'}</p>
        </motion.div>
        <Button
          variant="outline"
          onClick={() => fetchKPIs(true)}
          disabled={refreshing}
          className="self-start sm:self-auto rounded-xl"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          {t('cmd.refresh') || 'Actualizar'}
        </Button>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={Target}
          label={t('cmd.total_leads') || 'Pipeline Total'}
          value={g?.totalLeads || 0}
          sub={`+${g?.leadsToday || 0} ${t('cmd.today') || 'hoy'}`}
          color="#2D4A3E"
          href="/dashboard/growth"
        />
        <KPICard
          icon={Flame}
          label={t('cmd.hot_leads') || 'Leads Hot'}
          value={g?.hotLeads || 0}
          sub={`${g?.conversionRate || 0}% ${t('cmd.conversion') || 'conversión'}`}
          color="#ef4444"
          href="/dashboard/growth"
        />
        <KPICard
          icon={MessageSquare}
          label={t('cmd.agent_chats') || 'Chats Agentes'}
          value={s?.totalChats || 0}
          sub={`+${s?.chatsToday || 0} ${t('cmd.today') || 'hoy'}`}
          color="#C4622D"
          href="/dashboard/sales-agent"
        />
        <KPICard
          icon={Palette}
          label={t('cmd.creatives') || 'Assets Creativos'}
          value={c?.totalAssets || 0}
          sub={`+${c?.assetsToday || 0} ${t('cmd.today') || 'hoy'}`}
          color="#8B5CF6"
          href="/dashboard/chat"
        />
      </div>

      {/* Primeros pasos (solo si faltan pasos por completar) */}
      <GettingStartedChecklist />

      {/* Salud de tentáculos */}
      <TentacleHealthWidget />

      {/* Quick Launch: Mega Skill */}
      <MegaSkillLauncher />

      {/* Second Row: Growth + Sales Agent Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Growth Engine Summary */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="dark:border-white/10 h-full">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#2D4A3E]/10 dark:bg-[#2D4A3E]/30 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-[#2D4A3E] dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-[#F5F0E8]">{t('cmd.growth_engine') || 'Growth Engine'}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('cmd.pipeline_overview') || 'Vista general del pipeline'}</p>
                </div>
              </div>
              <Link href="/dashboard/growth">
                <Button variant="ghost" className="text-xs rounded-lg">
                  {t('cmd.view_all') || 'Ver todo'} <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>

            {/* Status Pipeline Bar */}
            <div className="mb-5">
              <div className="flex rounded-xl overflow-hidden h-3 bg-gray-100 dark:bg-white/5">
                {(['new', 'contacted', 'replied', 'converted', 'lost'] as const).map(status => {
                  const count = g?.statusBreakdown?.[status] || 0
                  const pct = g?.totalLeads ? (count / g.totalLeads) * 100 : 0
                  if (pct === 0) return null
                  const colors: Record<string, string> = { new: '#4A90D9', contacted: '#f59e0b', replied: '#22c55e', converted: '#C4622D', lost: '#6b7280' }
                  return <div key={status} style={{ width: `${pct}%`, backgroundColor: colors[status] }} className="transition-all" />
                })}
              </div>
              <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400 flex-wrap gap-1">
                {(['new', 'contacted', 'replied', 'converted', 'lost'] as const).map(status => {
                  const count = g?.statusBreakdown?.[status] || 0
                  const labels: Record<string, string> = { new: 'New', contacted: 'Contacted', replied: 'Replied', converted: 'Converted', lost: 'Lost' }
                  return <span key={status}>{labels[status]}: <strong>{count}</strong></span>
                })}
              </div>
            </div>

            {/* Tier Breakdown */}
            <div className="flex gap-2 flex-wrap mb-4">
              {Object.entries(g?.tierBreakdown || {}).sort((a, b) => b[1] - a[1]).map(([tier, count]) => {
                const meta = TIER_COLORS[tier] || TIER_COLORS.diamond
                return (
                  <span key={tier} className={`text-xs px-3 py-1.5 rounded-full font-medium ${meta.bg} ${meta.text}`}>
                    {meta.label}: {count}
                  </span>
                )
              })}
            </div>

            {/* Outreach stats */}
            <div className="grid grid-cols-3 gap-3">
              <MiniStat label={t('cmd.outreach') || 'Outreach'} value={g?.outreachSent || 0} icon={Mail} />
              <MiniStat label={t('cmd.replies') || 'Replies'} value={g?.replied || 0} icon={ArrowUpRight} color="#22c55e" />
              <MiniStat label={t('cmd.converted') || 'Converted'} value={g?.converted || 0} icon={Target} color="#C4622D" />
            </div>
          </Card>
        </motion.div>

        {/* Sales Agent Summary */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="dark:border-white/10 h-full">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#C4622D]/10 dark:bg-[#C4622D]/30 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-[#C4622D]" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-[#F5F0E8]">{t('cmd.sales_agents') || 'Sales Agents'}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('cmd.agents_overview') || 'Agentes y conversiones'}</p>
                </div>
              </div>
              <Link href="/dashboard/sales-agent">
                <Button variant="ghost" className="text-xs rounded-lg">
                  {t('cmd.view_all') || 'Ver todo'} <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>

            {/* Agent Stats */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/5">
                <div className="text-2xl font-bold text-gray-900 dark:text-[#F5F0E8]">{s?.activeAgents || 0}<span className="text-sm font-normal text-gray-400">/{s?.totalAgents || 0}</span></div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('cmd.active_agents') || 'Agentes activos'}</div>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/5">
                <div className="text-2xl font-bold text-gray-900 dark:text-[#F5F0E8]">{s?.capturedLeads || 0}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('cmd.captured_leads') || 'Leads capturados'}</div>
              </div>
            </div>

            {/* Source Breakdown */}
            {Object.keys(s?.sourceBreakdown || {}).length > 0 && (
              <div className="mb-5">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('cmd.lead_sources') || 'Fuentes de leads'}</p>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(s?.sourceBreakdown || {}).sort((a, b) => b[1] - a[1]).map(([source, count]) => (
                    <span key={source} className="text-xs px-2.5 py-1 rounded-full font-medium border dark:border-white/10"
                      style={{ color: SOURCE_COLORS[source] || '#6b7280', borderColor: `${SOURCE_COLORS[source] || '#6b7280'}40`, background: `${SOURCE_COLORS[source] || '#6b7280'}10` }}>
                      {source}: {count}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Hot leads from agent */}
            <div className="grid grid-cols-3 gap-3">
              <MiniStat label={t('cmd.total_chats') || 'Total Chats'} value={s?.totalChats || 0} icon={MessageSquare} />
              <MiniStat label={t('cmd.today_str') || 'Hoy'} value={s?.chatsToday || 0} icon={Zap} color="#f59e0b" />
              <MiniStat label="🔥 Hot" value={s?.hotLeads || 0} icon={Flame} color="#ef4444" />
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Content Publisher Widget */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <ContentPublishWidget />
      </motion.div>

      {/* Third Row: Platform Stats + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Platform Overview */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="dark:border-white/10 h-full">
            <h3 className="font-bold text-gray-900 dark:text-[#F5F0E8] mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#2D4A3E] dark:text-emerald-400" />
              {t('cmd.platform') || 'Plataforma'}
            </h3>
            <div className="space-y-3">
              <PlatformRow icon={FolderOpen} label={t('cmd.projects') || 'Proyectos'} value={p?.projects || 0} href="/dashboard/projects" />
              <PlatformRow icon={Palette} label={t('cmd.assets') || 'Assets Creativos'} value={c?.totalAssets || 0} href="/dashboard/chat" />
              <PlatformRow icon={Link2} label={t('cmd.connections') || 'Brazos Conectados'} value={p?.connections || 0} href="/dashboard/brazos" />
              <PlatformRow icon={HomeIcon} label={t('cmd.devices') || 'Dispositivos IoT'} value={p?.smartDevices || 0} href="/dashboard/hogar" />
              <PlatformRow icon={BookOpen} label={t('cmd.knowledge') || 'Docs Conocimiento'} value={p?.knowledgeDocs || 0} href="/dashboard/jarvis" />
            </div>
          </Card>
        </motion.div>

        {/* Recent Leads */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="lg:col-span-2">
          <Card className="dark:border-white/10 h-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-[#F5F0E8] flex items-center gap-2">
                <Users className="w-5 h-5 text-[#C4622D]" />
                {t('cmd.recent_leads') || 'Leads Recientes'}
              </h3>
              <Link href="/dashboard/growth">
                <Button variant="ghost" className="text-xs rounded-lg">
                  {t('cmd.view_all') || 'Ver todo'} <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>
            <div className="space-y-2">
              {(kpis?.recentLeads || []).length === 0 && (kpis?.recentAgentLeads || []).length === 0 ? (
                <p className="text-gray-400 text-center py-6 text-sm">{t('cmd.no_leads') || 'No hay leads aún'}</p>
              ) : (
                <>
                  {(kpis?.recentLeads || []).slice(0, 3).map((lead: any) => {
                    const tier = TIER_COLORS[lead.leadTier] || TIER_COLORS.diamond
                    return (
                      <div key={lead.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/8 transition-colors">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${tier.bg} ${tier.text}`}>
                          {lead.businessName?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-900 dark:text-[#F5F0E8] truncate">{lead.businessName}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{lead.city || 'N/A'} · {lead.email || 'Sin email'}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${tier.bg} ${tier.text}`}>{lead.leadTier}</span>
                      </div>
                    )
                  })}
                  {(kpis?.recentAgentLeads || []).slice(0, 2).map((lead: any) => (
                    <div key={lead.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/8 transition-colors">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs bg-[#C4622D]/10 text-[#C4622D]">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 dark:text-[#F5F0E8] truncate">{lead.visitorName || 'Visitante'}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{lead.agent?.name || 'Agente'} · {lead.source || 'direct'}</p>
                      </div>
                      <span className="text-xs">{lead.buyingSignal === 'hot' ? '🔥' : lead.buyingSignal === 'warm' ? '🟡' : '❄️'}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Quick Navigation */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <h3 className="font-bold text-gray-900 dark:text-[#F5F0E8] mb-3">{t('cmd.quick_nav') || 'Acceso Rápido'}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { icon: Target, label: 'Growth', href: '/dashboard/growth', color: '#2D4A3E' },
            { icon: MessageSquare, label: 'Sales Agent', href: '/dashboard/sales-agent', color: '#C4622D' },
            { icon: Sparkles, label: 'Creativo', href: '/dashboard/chat', color: '#8B5CF6' },
            { icon: Globe, label: 'Web Intel', href: '/dashboard/website-intelligence', color: '#0EA5E9' },
            { icon: Eye, label: 'OCTOPUS', href: '/dashboard/jarvis', color: '#FFD700' },
            { icon: Activity, label: 'Ad Factory', href: '/dashboard/ad-factory', color: '#EC4899' },
          ].map(item => (
            <Link key={item.href} href={item.href}>
              <Card className="p-3 dark:border-white/10 hover:shadow-md transition-all cursor-pointer group text-center">
                <div className="w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{ background: `${item.color}15` }}>
                  <item.icon className="w-5 h-5" style={{ color: item.color }} />
                </div>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{item.label}</p>
              </Card>
            </Link>
          ))}
        </div>
      </motion.div>

      {/* Activity Feed (compact) */}
      {activities.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
          <Card className="dark:border-white/10">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-900 dark:text-[#F5F0E8] flex items-center gap-2 text-sm">
                <Activity className="w-4 h-4 text-[#C4622D]" />
                {t('cmd.live_activity') || 'Actividad en Vivo'}
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              </h3>
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {activities.slice(0, 8).map((activity, i) => (
                <div key={activity.id} className="flex items-center gap-2 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#C4622D] shrink-0" />
                  <span className="text-gray-700 dark:text-gray-300 truncate">{activity.action}</span>
                  <span className="text-xs text-gray-400 ml-auto shrink-0 flex items-center gap-1">
                    <Clock className="w-3 h-3" />{activity.time}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  )
}

/* ─── Sub-components ─── */
function KPICard({ icon: Icon, label, value, sub, color, href }: { icon: any; label: string; value: number; sub: string; color: string; href: string }) {
  return (
    <Link href={href}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} whileHover={{ y: -2 }}>
        <Card className="card-shine dark:border-white/10 cursor-pointer hover:shadow-lg transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-5 group-hover:opacity-10 transition-opacity" style={{ background: color, transform: 'translate(30%, -30%)' }} />
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-[#F5F0E8]">{value.toLocaleString()}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</div>
          <div className="text-xs mt-2 font-medium" style={{ color }}>{sub}</div>
        </Card>
      </motion.div>
    </Link>
  )
}

function MiniStat({ label, value, icon: Icon, color = '#2D4A3E' }: { label: string; value: number; icon: any; color?: string }) {
  return (
    <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/5 text-center">
      <Icon className="w-4 h-4 mx-auto mb-1" style={{ color }} />
      <div className="text-lg font-bold text-gray-900 dark:text-[#F5F0E8]">{value}</div>
      <div className="text-[10px] text-gray-500 dark:text-gray-400">{label}</div>
    </div>
  )
}

function PlatformRow({ icon: Icon, label, value, href }: { icon: any; label: string; value: number; href: string }) {
  return (
    <Link href={href}>
      <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer group">
        <Icon className="w-4 h-4 text-gray-400 group-hover:text-[#C4622D] transition-colors" />
        <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">{label}</span>
        <span className="text-sm font-bold text-gray-900 dark:text-[#F5F0E8]">{value}</span>
        <ChevronRight className="w-3 h-3 text-gray-300 group-hover:text-[#C4622D] transition-colors" />
      </div>
    </Link>
  )
}