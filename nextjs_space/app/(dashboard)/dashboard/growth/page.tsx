'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSession } from 'next-auth/react'
import {
  TrendingUp,
  Search,
  Plus,
  Upload,
  Zap,
  CheckCircle,
  XCircle,
  Mail,
  Phone,
  Globe,
  MapPin,
  Star,
  ChevronDown,
  ChevronRight,
  Clock,
  BarChart3,
  Users,
  Target,
  ArrowUpRight,
  Sparkles,
  Eye,
  Loader2,
  X,
  Send,
  Inbox,
  Filter,
  RefreshCw,
  AlertCircle,
  Diamond,
  Trophy,
  Flame,
  MessageSquare,
  Trash2,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n-context'
import { usePlanGate } from '@/hooks/use-plan-gate'
import { UpgradeModal } from '@/components/upgrade-modal'
import { FeedbackModal, useFeedbackTrigger } from '@/components/feedback-modal'

/* ───── types ───── */
interface Lead {
  id: string
  businessName: string
  businessType: string
  contactName: string | null
  email: string
  emailCategory: string | null
  phone: string | null
  website: string | null
  city: string | null
  state: string | null
  country: string | null
  googleRating: number | null
  status: string
  priority: string
  qualificationScore: number
  leadTier: string | null
  leadSource: string | null
  painPoints: string | null
  notes: string | null
  followUpCount: number
  lastContactedAt: string | null
  emailBounced: boolean
  createdAt: string
}

interface Action {
  id: string
  leadId: string
  actionType: string
  title: string
  description: string | null
  payload: string | null
  reasoning: string | null
  status: string
  lead?: Lead
  createdAt: string
}

interface Stats {
  total: number
  pipeline: Record<string, number>
  tiers: Record<string, number>
  emailCategories: Record<string, number>
  pendingActions: number
  topCities: { city: string; count: number }[]
  recentLeads: any[]
  // Phase 2
  totalActions: number
  executedActions: number
  emailsSent: number
  totalMessages: number
  outboundMessages: number
  inboundMessages: number
  contactRate: number
  responseRate: number
  conversionRate: number
}

/* ───── constants ───── */
const TAB_DEFS = [
  { id: 'pipeline', labelKey: 'growth.tab_pipeline', icon: Target },
  { id: 'actions', labelKey: 'growth.tab_actions', icon: Zap },
  { id: 'inbox', labelKey: 'growth.tab_inbox', icon: Inbox },
  { id: 'campaigns', labelKey: 'growth.tab_campaigns', icon: Flame },
  { id: 'insights', labelKey: 'growth.tab_insights', icon: Sparkles },
  { id: 'report', labelKey: 'growth.tab_report', icon: BarChart3 },
  { id: 'stats', labelKey: 'growth.tab_stats', icon: TrendingUp },
  { id: 'agent_leads', labelKey: 'growth.tab_agent_leads', icon: MessageSquare },
]

const STATUS_COLORS: Record<string, string> = {
  new: '#4A90D9',
  contacted: '#f59e0b',
  replied: '#22c55e',
  converted: '#C4622D',
  lost: '#6b7280',
}

const TIER_ICONS: Record<string, typeof Diamond> = {
  diamond: Diamond,
  vibranium: Trophy,
  antimatter: Flame,
}

const TIER_COLORS: Record<string, string> = {
  diamond: '#60a5fa',
  vibranium: '#a78bfa',
  antimatter: '#f97316',
}

function useEmailCatLabels(): Record<string, string> {
  const { t } = useI18n()
  return {
    'A+': t('growth.email_cat_a_plus'),
    A: t('growth.email_cat_a'),
    'B+': t('growth.email_cat_b_plus'),
    B: t('growth.email_cat_b'),
    C: t('growth.email_cat_c'),
  }
}

/* ───── helper ───── */
function ScoreBadge({ score }: { score: number }) {
  const bg = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold text-white"
      style={{ backgroundColor: bg }}
    >
      {score}
    </span>
  )
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-white capitalize"
      style={{ backgroundColor: STATUS_COLORS[status] || '#6b7280' }}
    >
      {status}
    </span>
  )
}

function TierBadge({ tier }: { tier: string | null }) {
  if (!tier) return null
  const Icon = TIER_ICONS[tier] || Diamond
  const color = TIER_COLORS[tier] || '#6b7280'
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold capitalize" style={{ color }}>
      <Icon className="w-3.5 h-3.5" />
      {tier}
    </span>
  )
}

/* ═══════════════════════════════════════════ */
export default function GrowthPage() {
  const { data: session } = useSession() || {}
  const { t } = useI18n()
  const { upgradeModal, closeUpgradeModal, handlePlanError } = usePlanGate()
  const { showFeedback, setShowFeedback, feedbackFeature, feedbackLabel, triggerFeedback } = useFeedbackTrigger()
  const [tab, setTab] = useState('pipeline')
  const [leads, setLeads] = useState<Lead[]>([])
  const [actions, setActions] = useState<Action[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterTier, setFilterTier] = useState('')
  const [inboxNewCount, setInboxNewCount] = useState(0)
  const [dbStatusCounts, setDbStatusCounts] = useState<Record<string, number>>({})

  /* modals */
  const [showAddLead, setShowAddLead] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [generatingAI, setGeneratingAI] = useState<string | null>(null)

  /* fetch leads */
  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (filterStatus) params.set('status', filterStatus)
      if (filterTier) params.set('tier', filterTier)
      const res = await fetch(`/api/growth/leads?${params}`)
      if (res.ok) {
        const data = await res.json()
        setLeads(data.leads ?? data)
        if (data.statusCounts) setDbStatusCounts(data.statusCounts)
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [search, filterStatus, filterTier])

  /* fetch actions */
  const fetchActions = useCallback(async () => {
    try {
      const res = await fetch('/api/growth/actions')
      if (res.ok) {
        const data = await res.json()
        setActions(data.actions ?? data)
      }
    } catch (e) { console.error(e) }
  }, [])

  /* fetch stats */
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/growth/stats')
      if (res.ok) setStats(await res.json())
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  useEffect(() => {
    if (tab === 'actions') fetchActions()
    if (tab === 'stats') fetchStats()
  }, [tab, fetchActions, fetchStats])

  /* ── generate AI outreach ── */
  const handleAIOutreach = async (lead: Lead) => {
    setGeneratingAI(lead.id)
    try {
      const res = await fetch('/api/growth/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id }),
      })
      if (res.ok) {
        setTab('actions')
        fetchActions()
        triggerFeedback('growth_engine', 'Growth Engine')
      } else {
        const err = await res.json()
        alert(err.error || 'Error generando outreach')
      }
    } catch (e) { console.error(e) }
    setGeneratingAI(null)
  }

  /* ── approve / reject action ── */
  const [sendingEmail, setSendingEmail] = useState<string | null>(null)
  const [lastSendResult, setLastSendResult] = useState<{ id: string; sent: boolean } | null>(null)

  const handleActionDecision = async (actionId: string, status: 'approved' | 'rejected') => {
    if (status === 'approved') setSendingEmail(actionId)
    try {
      const res = await fetch(`/api/growth/actions/${actionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok && status === 'approved') {
        const data = await res.json()
        setLastSendResult({ id: actionId, sent: data.emailSent })
        setTimeout(() => setLastSendResult(null), 5000)
      }
      fetchActions()
      fetchLeads()
    } catch (e) { console.error(e) }
    setSendingEmail(null)
  }

  /* ── quick stats bar — use real DB counts (not limited by take:500) ── */
  const statusCounts = Object.keys(dbStatusCounts).length > 0
    ? dbStatusCounts
    : leads.reduce((acc, l) => { acc[l.status] = (acc[l.status] || 0) + 1; return acc }, {} as Record<string, number>)

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A1A] flex items-center gap-2">
              <TrendingUp className="w-7 h-7 text-[#C4622D]" />
              {t('growth.title')}
            </h1>
            <p className="text-sm text-gray-500 mt-1">{t('growth.subtitle')}</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setShowImport(true)}
              variant="outline"
              className="rounded-xl border-[#2D4A3E]/20 text-[#2D4A3E] hover:bg-[#2D4A3E]/5"
            >
              <Upload className="w-4 h-4 mr-1" /> {t('growth.import')}
            </Button>
            <Button
              onClick={() => setShowAddLead(true)}
              className="rounded-xl bg-[#C4622D] hover:bg-[#B5521D] text-white"
            >
              <Plus className="w-4 h-4 mr-1" /> {t('growth.new_lead')}
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {(['new', 'contacted', 'replied', 'converted', 'lost'] as const).map((s) => (
          <Card
            key={s}
            className="p-3 rounded-2xl border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            style={{ borderLeft: `4px solid ${STATUS_COLORS[s]}` }}
            onClick={() => { setFilterStatus(filterStatus === s ? '' : s) }}
          >
            <p className="text-xs text-gray-500 capitalize">{s}</p>
            <p className="text-xl font-bold text-[#1A1A1A]">{statusCounts[s] || 0}</p>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/60 rounded-2xl p-1 overflow-x-auto scrollbar-hide">
        {TAB_DEFS.map((tabDef) => {
          const Icon = tabDef.icon
          const active = tab === tabDef.id
          return (
            <button
              key={tabDef.id}
              onClick={() => setTab(tabDef.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                active
                  ? 'bg-[#2D4A3E] text-white shadow-sm'
                  : 'text-gray-500 hover:text-[#1A1A1A] hover:bg-white/80'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t(tabDef.labelKey)}
              {tabDef.id === 'actions' && actions.filter((a) => a.status === 'pending').length > 0 && (
                <span className="ml-1 bg-[#C4622D] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {actions.filter((a) => a.status === 'pending').length}
                </span>
              )}
              {tabDef.id === 'inbox' && inboxNewCount > 0 && (
                <span className="ml-1 bg-[#22c55e] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                  {inboxNewCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {tab === 'pipeline' && (
          <motion.div key="pipeline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <PipelineTab
              leads={leads}
              loading={loading}
              search={search}
              setSearch={setSearch}
              filterStatus={filterStatus}
              setFilterStatus={setFilterStatus}
              filterTier={filterTier}
              setFilterTier={setFilterTier}
              onSelectLead={setSelectedLead}
              onAIOutreach={handleAIOutreach}
              generatingAI={generatingAI}
              onRefresh={fetchLeads}
            />
          </motion.div>
        )}
        {tab === 'actions' && (
          <motion.div key="actions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ActionsTab actions={actions} onDecision={handleActionDecision} onRefresh={fetchActions} sendingEmail={sendingEmail} lastSendResult={lastSendResult} />
          </motion.div>
        )}
        {tab === 'inbox' && (
          <motion.div key="inbox" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <InboxTab onNewCount={setInboxNewCount} />
          </motion.div>
        )}
        {tab === 'campaigns' && (
          <motion.div key="campaigns" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <CampaignsTab leads={leads} onRefreshActions={fetchActions} />
          </motion.div>
        )}
        {tab === 'insights' && (
          <motion.div key="insights" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <InsightsTab />
          </motion.div>
        )}
        {tab === 'report' && (
          <motion.div key="report" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ReportTab />
          </motion.div>
        )}
        {tab === 'stats' && (
          <motion.div key="stats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <StatsTab stats={stats} />
          </motion.div>
        )}
        {tab === 'agent_leads' && (
          <motion.div key="agent_leads" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <AgentLeadsTab />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      {showAddLead && <AddLeadModal onClose={() => setShowAddLead(false)} onSaved={() => { setShowAddLead(false); fetchLeads() }} handlePlanError={handlePlanError} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onDone={() => { setShowImport(false); fetchLeads() }} />}
      {selectedLead && <LeadDetailModal lead={selectedLead} onClose={() => setSelectedLead(null)} onUpdated={fetchLeads} />}
      <UpgradeModal
        isOpen={upgradeModal.isOpen}
        onClose={closeUpgradeModal}
        feature={upgradeModal.feature}
        current={upgradeModal.current}
        limit={upgradeModal.limit}
        requiredPlan={upgradeModal.requiredPlan}
      />
      <FeedbackModal isOpen={showFeedback} onClose={() => setShowFeedback(false)} featureUsed={feedbackFeature} featureLabel={feedbackLabel} />
    </div>
  )
}

/* ═══════════════  PIPELINE TAB  ═══════════════ */
function PipelineTab({
  leads, loading, search, setSearch, filterStatus, setFilterStatus, filterTier, setFilterTier,
  onSelectLead, onAIOutreach, generatingAI, onRefresh,
}: {
  leads: Lead[]; loading: boolean; search: string; setSearch: (v: string) => void
  filterStatus: string; setFilterStatus: (v: string) => void
  filterTier: string; setFilterTier: (v: string) => void
  onSelectLead: (l: Lead) => void; onAIOutreach: (l: Lead) => void
  generatingAI: string | null; onRefresh: () => void
}) {
  const { t } = useI18n()
  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('growth.search_placeholder')}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F5F0E8] border-0 text-sm focus:ring-2 focus:ring-[#C4622D]/30 outline-none"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-[#F5F0E8] border-0 text-sm focus:ring-2 focus:ring-[#C4622D]/30 outline-none"
        >
          <option value="">{t('growth.all_status')}</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="replied">Replied</option>
          <option value="converted">Converted</option>
          <option value="lost">Lost</option>
        </select>
        <select
          value={filterTier}
          onChange={(e) => setFilterTier(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-[#F5F0E8] border-0 text-sm focus:ring-2 focus:ring-[#C4622D]/30 outline-none"
        >
          <option value="">{t('growth.all_tiers')}</option>
          <option value="diamond">💎 Diamond</option>
          <option value="vibranium">🏆 Vibranium</option>
          <option value="antimatter">🔥 Antimatter</option>
        </select>
        <Button onClick={onRefresh} variant="outline" size="sm" className="rounded-xl">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Lead List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[#C4622D]" />
        </div>
      ) : leads.length === 0 ? (
        <Card className="p-12 rounded-2xl border-0 shadow-sm text-center">
          <Users className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-700 font-medium">{t('growth.no_leads')}</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {leads.map((lead) => (
            <Card
              key={lead.id}
              className="p-4 rounded-2xl border-0 shadow-sm hover:shadow-md transition-all cursor-pointer"
              onClick={() => onSelectLead(lead)}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-[#1A1A1A] truncate">{lead.businessName}</h3>
                    <StatusPill status={lead.status} />
                    <ScoreBadge score={lead.qualificationScore} />
                    <TierBadge tier={lead.leadTier} />
                    {lead.emailCategory && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                        {lead.emailCategory}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                    {lead.contactName && <span>{lead.contactName}</span>}
                    <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{lead.email}</span>
                    {lead.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{lead.city}</span>}
                    {lead.googleRating && <span className="flex items-center gap-1"><Star className="w-3 h-3 text-yellow-500" />{lead.googleRating}</span>}
                    <span className="capitalize text-gray-400">{lead.businessType}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    className="rounded-xl bg-[#C4622D] hover:bg-[#B5521D] text-white text-xs"
                    onClick={(e) => { e.stopPropagation(); onAIOutreach(lead) }}
                    disabled={generatingAI === lead.id}
                  >
                    {generatingAI === lead.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : lead.status === 'contacted' ? (
                      <><RefreshCw className="w-3.5 h-3.5 mr-1" /> Follow-up</>
                    ) : (
                      <><Sparkles className="w-3.5 h-3.5 mr-1" /> AI Email</>
                    )}
                  </Button>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

/* ═══════════════  ACTIONS TAB  ═══════════════ */
function ActionsTab({
  actions, onDecision, onRefresh, sendingEmail, lastSendResult,
}: {
  actions: Action[]; onDecision: (id: string, s: 'approved' | 'rejected') => void; onRefresh: () => void
  sendingEmail: string | null; lastSendResult: { id: string; sent: boolean } | null
}) {
  const { t } = useI18n()
  const pending = actions.filter((a) => a.status === 'pending')
  const history = actions.filter((a) => a.status !== 'pending')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[#1A1A1A]">{t('growth.pending_actions')} ({pending.length})</h2>
        <Button onClick={onRefresh} variant="outline" size="sm" className="rounded-xl">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {pending.length === 0 ? (
        <Card className="p-8 rounded-2xl border-0 shadow-sm text-center">
          <CheckCircle className="w-10 h-10 mx-auto text-green-400 mb-2" />
          <p className="text-gray-500">{t('growth.no_actions')}</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {pending.map((action) => (
            <ActionCard key={action.id} action={action} onDecision={onDecision} sendingEmail={sendingEmail} lastSendResult={lastSendResult} />
          ))}
        </div>
      )}

      {history.length > 0 && (
        <>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Historial</h3>
          <div className="space-y-2">
            {history.slice(0, 20).map((action) => (
              <ActionCard key={action.id} action={action} onDecision={onDecision} readonly sendingEmail={null} lastSendResult={null} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ActionCard({
  action, onDecision, readonly = false, sendingEmail, lastSendResult,
}: {
  action: Action; onDecision: (id: string, s: 'approved' | 'rejected') => void; readonly?: boolean
  sendingEmail: string | null; lastSendResult: { id: string; sent: boolean } | null
}) {
  const [expanded, setExpanded] = useState(false)
  let payload: { subject?: string; body?: string } = {}
  try { payload = action.payload ? JSON.parse(action.payload) : {} } catch { /* ignore */ }

  const statusColor = action.status === 'approved' ? '#22c55e' : action.status === 'rejected' ? '#ef4444' : action.status === 'executed' ? '#4A90D9' : '#f59e0b'

  return (
    <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-[#C4622D]" />
              <span className="font-bold text-sm text-[#1A1A1A]">{action.title}</span>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white capitalize"
                style={{ backgroundColor: statusColor }}
              >
                {action.status}
              </span>
            </div>
            {action.lead && (
              <p className="text-xs text-gray-500 mt-1">
                Para: <strong>{action.lead.businessName}</strong> ({action.lead.email})
              </p>
            )}
            {action.reasoning && (
              <p className="text-xs text-gray-400 mt-1 italic">{action.reasoning}</p>
            )}
          </div>
          <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-gray-600">
            <ChevronDown className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>

        <AnimatePresence>
          {expanded && payload.body && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 p-3 bg-[#F5F0E8] rounded-xl">
                {payload.subject && (
                  <p className="text-xs font-semibold text-[#2D4A3E] mb-1">Subject: {payload.subject}</p>
                )}
                <p className="text-sm text-[#1A1A1A] whitespace-pre-wrap">{payload.body}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Send result toast */}
        {lastSendResult?.id === action.id && (
          <motion.div
            initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
            className={`mt-2 p-2 rounded-xl text-xs font-medium ${lastSendResult.sent ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}
          >
            {lastSendResult.sent
              ? '✅ Email enviado por Gmail exitosamente'
              : '⚠️ Aprobado pero Gmail no conectado — email no enviado'}
          </motion.div>
        )}

        {!readonly && action.status === 'pending' && (
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              className="rounded-xl bg-[#2D4A3E] hover:bg-[#1e332a] text-white text-xs"
              onClick={() => onDecision(action.id, 'approved')}
              disabled={sendingEmail === action.id}
            >
              {sendingEmail === action.id ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Enviando...</>
              ) : (
                <><Send className="w-3.5 h-3.5 mr-1" /> Aprobar y Enviar</>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl text-red-500 border-red-200 hover:bg-red-50 text-xs"
              onClick={() => onDecision(action.id, 'rejected')}
              disabled={sendingEmail === action.id}
            >
              <XCircle className="w-3.5 h-3.5 mr-1" /> Rechazar
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}

/* ═══════════════  INBOX TAB (Phase 2 — Real Gmail)  ═══════════════ */
function InboxTab({ onNewCount }: { onNewCount?: (n: number) => void }) {
  const { t } = useI18n()
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ newReplies: number; classifications: any[] } | null>(null)
  const [connected, setConnected] = useState(true)
  const [expandedMsg, setExpandedMsg] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<'all' | 'sent' | 'received'>('all')
  const [replyTo, setReplyTo] = useState<{ leadId: string; leadName: string; threadId?: string; subject?: string } | null>(null)
  const [replyBody, setReplyBody] = useState('')
  const [sendingReply, setSendingReply] = useState(false)

  const loadInbox = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/growth/inbox')
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
        setConnected(data.connected !== false)
        // Count received messages for badge
        const received = (data.messages || []).filter((m: any) => !m.isSent)
        onNewCount?.(received.length)
      } else if (res.status === 403) {
        setConnected(false)
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [onNewCount])

  useEffect(() => { loadInbox() }, [loadInbox])

  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/growth/inbox/sync', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setSyncResult(data)
        if (data.newReplies > 0) loadInbox()
      }
    } catch (e) { console.error(e) }
    setSyncing(false)
  }

  const handleReply = async () => {
    if (!replyTo || !replyBody.trim()) return
    setSendingReply(true)
    try {
      const res = await fetch('/api/growth/inbox/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: replyTo.leadId,
          subject: replyTo.subject ? `Re: ${replyTo.subject}` : 'Re: Partnership Opportunity',
          body: replyBody,
          threadId: replyTo.threadId,
        }),
      })
      if (res.ok) {
        setReplyTo(null)
        setReplyBody('')
        loadInbox()
      } else {
        const err = await res.json()
        alert(err.error || 'Error enviando respuesta')
      }
    } catch (e) { console.error(e) }
    setSendingReply(false)
  }

  const CLASSIFICATION_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
    interested: { label: 'Interesado', color: '#22c55e', emoji: '🔥' },
    not_interested: { label: 'No Interesado', color: '#ef4444', emoji: '❌' },
    question: { label: 'Pregunta', color: '#f59e0b', emoji: '❓' },
    bounce: { label: 'Bounce', color: '#6b7280', emoji: '⚠️' },
    neutral: { label: 'Neutral', color: '#4A90D9', emoji: '📩' },
  }

  const filtered = messages.filter((m) => {
    if (filterType === 'sent') return m.isSent
    if (filterType === 'received') return !m.isSent
    return true
  })

  if (!connected) {
    return (
      <Card className="p-12 rounded-2xl border-0 shadow-sm text-center">
        <AlertCircle className="w-12 h-12 mx-auto text-yellow-400 mb-3" />
        <h3 className="text-lg font-bold text-[#1A1A1A] mb-2">{t('growth.gmail_not_connected') || 'Gmail No Conectado'}</h3>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          {t('growth.connect_inbox')}
        </p>
      </Card>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-[#C4622D]" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-bold text-[#1A1A1A]">
          Inbox Gmail <span className="text-sm font-normal text-gray-400">({filtered.length} mensajes)</span>
        </h2>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleSync}
            disabled={syncing}
            size="sm"
            className="rounded-xl bg-[#22c55e] hover:bg-[#16a34a] text-white text-xs"
          >
            {syncing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
            Sync & Clasificar
          </Button>
          <div className="flex gap-1 bg-white/60 rounded-xl p-0.5">
            {(['all', 'sent', 'received'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilterType(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filterType === f ? 'bg-[#2D4A3E] text-white' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {f === 'all' ? t('growth.inbox_all') : f === 'sent' ? t('growth.inbox_sent') : t('growth.inbox_received')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sync Result Banner */}
      {syncResult && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-3 rounded-xl border-0 shadow-sm bg-[#22c55e]/10">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#22c55e]" />
              <span className="text-sm font-semibold text-[#1A1A1A]">
                Sync completo — {syncResult.newReplies} nuevas respuestas detectadas
              </span>
            </div>
            {syncResult.classifications?.length > 0 && (
              <div className="mt-2 space-y-1">
                {syncResult.classifications.map((c: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                    <span>{CLASSIFICATION_LABELS[c.classification]?.emoji || '📩'}</span>
                    <span className="font-semibold">{c.leadName}</span>
                    <span className="px-1.5 py-0.5 rounded text-white text-[10px]" style={{ backgroundColor: CLASSIFICATION_LABELS[c.classification]?.color || '#6b7280' }}>
                      {CLASSIFICATION_LABELS[c.classification]?.label || c.classification}
                    </span>
                    <span className="text-gray-400 truncate">{c.subject}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      )}



      {filtered.length === 0 ? (
        <Card className="p-8 rounded-2xl border-0 shadow-sm text-center">
          <Inbox className="w-10 h-10 mx-auto text-gray-300 mb-2" />
          <p className="text-gray-500">No hay mensajes {filterType !== 'all' ? 'en esta categoría' : 'todavía'}</p>
          <p className="text-xs text-gray-400 mt-1">Los emails aparecerán aquí después de aprobar y enviar outreach</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((msg) => (
            <Card
              key={msg.id}
              className="rounded-2xl border-0 shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setExpandedMsg(expandedMsg === msg.id ? null : msg.id)}
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white ${msg.isSent ? 'bg-[#4A90D9]' : 'bg-[#22c55e]'}`}>
                        {msg.isSent ? '→ Enviado' : '← Recibido'}
                      </span>
                      {msg.leadName && (
                        <span className="text-xs font-semibold text-[#C4622D]">{msg.leadName}</span>
                      )}
                      <span className="text-[10px] text-gray-400">{msg.date ? new Date(msg.date).toLocaleDateString() : ''}</span>
                    </div>
                    <p className="text-sm font-bold text-[#1A1A1A] mt-1 truncate">{msg.subject || 'Sin asunto'}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {msg.isSent ? `Para: ${msg.to}` : `De: ${msg.from}`}
                    </p>
                    {expandedMsg !== msg.id && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-1">{msg.snippet}</p>
                    )}
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${expandedMsg === msg.id ? 'rotate-180' : ''}`} />
                </div>

                <AnimatePresence>
                  {expandedMsg === msg.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 p-3 bg-[#F5F0E8] rounded-xl">
                        <p className="text-sm text-[#1A1A1A] whitespace-pre-wrap">{msg.body || msg.snippet}</p>
                      </div>
                      {/* Reply button & inline compose for received messages */}
                      {!msg.isSent && msg.leadId && (
                        <div className="mt-3">
                          {replyTo?.leadId === msg.leadId ? (
                            <div className="p-3 bg-white rounded-xl border border-[#4A90D9]/30" onClick={(e) => e.stopPropagation()}>
                              <p className="text-xs font-bold text-[#4A90D9] mb-2">Responder a <span className="text-[#C4622D]">{msg.leadName || 'Lead'}</span></p>
                              <textarea
                                value={replyBody}
                                onChange={(e) => setReplyBody(e.target.value)}
                                placeholder="Escribe tu respuesta..."
                                className="w-full h-24 px-3 py-2 rounded-xl bg-[#F5F0E8] border-0 text-sm focus:ring-2 focus:ring-[#4A90D9]/30 outline-none resize-none"
                                autoFocus
                              />
                              <div className="flex justify-end gap-2 mt-2">
                                <Button onClick={(e) => { e.stopPropagation(); setReplyTo(null); setReplyBody('') }} size="sm" className="rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs">
                                  Cancelar
                                </Button>
                                <Button onClick={(e) => { e.stopPropagation(); handleReply() }} disabled={sendingReply || !replyBody.trim()} size="sm" className="rounded-xl bg-[#4A90D9] hover:bg-[#3a7bc8] text-white text-xs">
                                  {sendingReply ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />}
                                  Enviar Respuesta
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-end">
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setReplyTo({
                                    leadId: msg.leadId,
                                    leadName: msg.leadName || 'Lead',
                                    threadId: msg.threadId,
                                    subject: msg.subject,
                                  })
                                }}
                                size="sm"
                                className="rounded-xl bg-[#4A90D9] hover:bg-[#3a7bc8] text-white text-xs"
                              >
                                <Send className="w-3 h-3 mr-1" /> Responder
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

/* ═══════════════  CAMPAIGNS TAB  ═══════════════ */
function CampaignsTab({ leads, onRefreshActions }: { leads: Lead[]; onRefreshActions: () => void }) {
  const { locale } = useI18n()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)

  const fetchCampaigns = useCallback(() => {
    setLoading(true)
    fetch('/api/growth/campaigns')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { fetchCampaigns() }, [fetchCampaigns])

  const [activationResult, setActivationResult] = useState<any>(null)
  const [approving, setApproving] = useState(false)
  const [sendProgress, setSendProgress] = useState<string | null>(null)

  const handleActivate = async (campaignId: string) => {
    setGenerating(campaignId)
    setActivationResult(null)
    try {
      const res = await fetch('/api/growth/campaigns/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId }),
      })
      const result = await res.json()
      if (res.ok) {
        setActivationResult(result)
        fetchCampaigns()
        onRefreshActions()
      } else {
        alert(result.error || 'Error activando campaña')
      }
    } catch (e) { console.error(e) }
    setGenerating(null)
  }

  const handleApproveAll = async () => {
    if (!window.confirm('¿Enviar TODOS los emails pendientes via Gmail?\n\nSe enviarán en lotes de 10 (cola automática) respetando tu límite diario.\n(Requiere Google Workspace conectado en Brazos)')) return
    setApproving(true)
    setSendProgress(null)
    let totalSent = 0
    let totalApproved = 0
    let totalFailed = 0
    let rateLimitMsg: string | null = null
    try {
      // Cola de envíos: el servidor procesa en chunks de 10; repetimos mientras queden pendientes
      for (let i = 0; i < 50; i++) {
        const res = await fetch('/api/growth/actions/batch-approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
        const result = await res.json()
        if (!res.ok) {
          if (res.status === 429) {
            rateLimitMsg = result.error || 'Límite diario de envíos alcanzado.'
            break
          }
          alert(result.error || 'Error aprobando')
          break
        }
        totalSent += result.sent || 0
        totalApproved += result.approved || 0
        totalFailed += result.failed || 0
        const remaining = result.remaining || 0
        if (remaining > 0 && !result.rateLimited) {
          setSendProgress(`${totalSent} enviados · ${remaining} en cola...`)
          continue
        }
        if (result.rateLimited) {
          rateLimitMsg = `Límite diario alcanzado (${result.rateLimit?.usedToday}/${result.rateLimit?.limit} en plan ${result.rateLimit?.planId}). ${remaining} emails quedan en cola para mañana.`
        }
        break
      }
      if (totalApproved > 0 || totalSent > 0) {
        alert(`✅ ${totalSent} emails enviados, ${totalApproved} acciones aprobadas.${totalFailed > 0 ? ` ❌ ${totalFailed} fallaron.` : ''}${rateLimitMsg ? `\n\n⏳ ${rateLimitMsg}` : ''}`)
        setActivationResult(null)
        fetchCampaigns()
        onRefreshActions()
      } else if (rateLimitMsg) {
        alert(`⏳ ${rateLimitMsg}`)
      }
    } catch (e) { console.error(e) }
    setSendProgress(null)
    setApproving(false)
  }

  const handlePause = async (campaignId: string) => {
    setGenerating(campaignId)
    try {
      await fetch('/api/growth/campaigns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: campaignId, status: 'paused' }),
      })
      fetchCampaigns()
    } catch (e) { console.error(e) }
    setGenerating(null)
  }

  const handleSeasonalApply = async (campaignId: string, leadId: string) => {
    setGenerating(`${campaignId}-${leadId}`)
    try {
      const res = await fetch('/api/growth/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, leadId }),
      })
      if (res.ok) {
        onRefreshActions()
        alert('✅ Email de campaña generado. Revisa el tab de Acciones para aprobarlo.')
      } else {
        const err = await res.json()
        alert(err.error || 'Error')
      }
    } catch (e) { console.error(e) }
    setGenerating(null)
  }

  const handleDeleteCampaign = async (campaignId: string, campaignName: string) => {
    const confirmed = window.confirm(`¿Eliminar la campaña "${campaignName}"?\n\nEsto desvinculará todos los leads asignados (no se eliminan los leads, solo la campaña).`)
    if (!confirmed) return
    setGenerating(campaignId)
    try {
      const res = await fetch(`/api/growth/campaigns?id=${campaignId}`, { method: 'DELETE' })
      if (res.ok) {
        fetchCampaigns()
      } else {
        const err = await res.json()
        alert(err.error || 'Error al eliminar')
      }
    } catch (e) { console.error(e) }
    setGenerating(null)
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-[#C4622D]" /></div>
  if (!data) return null

  const campaigns = data.campaigns || []
  const seasonalTemplates = data.seasonalTemplates || []
  const stats = data.stats || {}
  const activeCampaigns = campaigns.filter((c: any) => c.status === 'active')
  const draftCampaigns = campaigns.filter((c: any) => c.status === 'draft')
  const completedCampaigns = campaigns.filter((c: any) => c.status === 'completed' || c.status === 'paused')

  const statusColor = (s: string) => s === 'active' ? 'bg-emerald-100 text-emerald-700' : s === 'draft' ? 'bg-amber-100 text-amber-700' : s === 'paused' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700'
  const statusIcon = (s: string) => s === 'active' ? '🟢' : s === 'draft' ? '📝' : s === 'paused' ? '⏸️' : '✅'

  return (
    <div className="space-y-6">
      {/* Stats Bar */}
      {campaigns.length > 0 && (
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F5F0E8] text-sm">
            <span className="font-bold text-[#1A1A1A]">{stats.total || 0}</span>
            <span className="text-gray-500">campañas</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-sm">
            <span className="font-bold text-emerald-700">{stats.active || 0}</span>
            <span className="text-emerald-600">activas</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 text-sm">
            <span className="font-bold text-amber-700">{stats.draft || 0}</span>
            <span className="text-amber-600">borrador</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 text-sm">
            <span className="font-bold text-blue-700">{stats.totalLeadsInCampaigns || 0}</span>
            <span className="text-blue-600">leads en campañas</span>
          </div>
          {(() => {
            const totalSent = campaigns.reduce((s: number, c: any) => s + (c.sentCount || 0), 0)
            const totalOpened = campaigns.reduce((s: number, c: any) => s + (c.openCount || 0), 0)
            if (totalSent === 0) return null
            const rate = Math.round((totalOpened / totalSent) * 100)
            return (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 text-sm" title={`${totalOpened} aperturas de ${totalSent} enviados`}>
                <span className="font-bold text-amber-700">👁 {rate}%</span>
                <span className="text-amber-600">open rate global</span>
              </div>
            )
          })()}
        </div>
      )}

      {/* ── Activation Result Panel ── */}
      {activationResult && (
        <Card className="p-5 rounded-2xl border-2 border-[#C4622D]/30 shadow-lg bg-gradient-to-br from-white to-orange-50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🚀</span>
              <div>
                <h3 className="font-bold text-[#1A1A1A] text-lg">Campaña Activada</h3>
                <p className="text-sm text-gray-500">
                  {activationResult.generated} emails generados
                  {activationResult.failed > 0 && <span className="text-red-500 ml-1">• {activationResult.failed} fallaron</span>}
                  {activationResult.skipped > 0 && <span className="text-amber-500 ml-1">• {activationResult.skipped} ya tenían acciones</span>}
                </p>
              </div>
            </div>
            <button onClick={() => setActivationResult(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
          </div>

          {/* Preview generated emails */}
          {activationResult.results && activationResult.results.filter((r: any) => r.success).length > 0 && (
            <div className="space-y-2 mb-4 max-h-64 overflow-y-auto pr-1">
              {activationResult.results.filter((r: any) => r.success).map((a: any, i: number) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/80 border border-gray-100">
                  <span className="text-lg mt-0.5">📧</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-[#1A1A1A] truncate">{a.businessName || 'Lead'}</p>
                    <p className="text-xs text-gray-500 truncate">{a.subject || 'Email de outreach'}</p>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 whitespace-nowrap">Pendiente</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleApproveAll}
              disabled={approving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-colors disabled:opacity-50"
            >
              {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>✅</span>}
              {approving ? (sendProgress || 'Enviando...') : 'Aprobar Todo y Enviar'}
            </button>
            <button
              onClick={() => setActivationResult(null)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F5F0E8] hover:bg-[#EDE5D8] text-[#1A1A1A] font-medium text-sm transition-colors"
            >
              📋 Revisar en Acciones
            </button>
          </div>
        </Card>
      )}

      {/* Active Campaigns */}
      {activeCampaigns.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-[#1A1A1A] mb-3">🔥 Campañas Activas</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {activeCampaigns.map((c: any) => (
              <CampaignCard key={c.id} campaign={c} statusColor={statusColor} statusIcon={statusIcon} generating={generating} onPause={handlePause} onDelete={handleDeleteCampaign} />
            ))}
          </div>
        </div>
      )}

      {/* Draft Campaigns */}
      {draftCampaigns.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-[#1A1A1A] mb-3">📝 Campañas en Borrador</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {draftCampaigns.map((c: any) => (
              <CampaignCard key={c.id} campaign={c} statusColor={statusColor} statusIcon={statusIcon} generating={generating} onActivate={handleActivate} onDelete={handleDeleteCampaign} />
            ))}
          </div>
        </div>
      )}

      {/* Completed / Paused */}
      {completedCampaigns.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-[#1A1A1A] mb-3">📦 Completadas / Pausadas</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {completedCampaigns.map((c: any) => (
              <CampaignCard key={c.id} campaign={c} statusColor={statusColor} statusIcon={statusIcon} generating={generating} onDelete={handleDeleteCampaign} />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {campaigns.length === 0 && (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🎯</div>
          <h3 className="text-xl font-bold text-[#1A1A1A] mb-2">Sin campañas aún</h3>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            Dile a OCTOPUS: &quot;Crea una campaña llamada Mi Primera Campaña&quot; y luego &quot;pasa los primeros 25 leads&quot;
          </p>
        </div>
      )}

      {/* Seasonal Templates */}
      {seasonalTemplates.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-[#1A1A1A] mb-3">📅 Templates Estacionales</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {seasonalTemplates.map((t: any) => (
              <Card key={t.id} className="p-4 rounded-2xl border-0 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{t.emoji}</span>
                  <div className="flex-1">
                    <h4 className="font-bold text-[#1A1A1A] text-sm">{t.name}</h4>
                    <p className="text-xs text-gray-500 mt-1">{t.description}</p>
                    <p className="text-xs text-[#C4622D] font-semibold mt-2">💡 {t.hook}</p>
                    {leads.filter(l => l.status === 'new' || l.status === 'contacted').length > 0 && (
                      <div className="mt-3">
                        <select
                          className="w-full px-2 py-1.5 rounded-lg bg-[#F5F0E8] text-xs border-0 text-[#1A1A1A]"
                          defaultValue=""
                          onChange={(e) => { if (e.target.value) handleSeasonalApply(t.id, e.target.value) }}
                        >
                          <option value="">{locale === 'en' ? 'Apply to lead...' : 'Aplicar a lead...'}</option>
                          {leads.filter(l => l.status === 'new' || l.status === 'contacted').map(l => (
                            <option key={l.id} value={l.id}>{l.businessName} ({l.businessType})</option>
                          ))}
                        </select>
                        {generating?.startsWith(t.id) && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-[#C4622D]">
                            <Loader2 className="w-3 h-3 animate-spin" /> Generando email...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════  CAMPAIGN CARD  ═══════════════ */
function CampaignCard({ campaign: c, statusColor, statusIcon, generating, onActivate, onPause, onDelete }: {
  campaign: any; statusColor: (s: string) => string; statusIcon: (s: string) => string; generating: string | null; onActivate?: (id: string) => void; onPause?: (id: string) => void; onDelete?: (id: string, name: string) => void
}) {
  const leadCount = c._count?.leads || c.totalLeads || 0
  const typeEmoji = c.campaignType === 'outreach' ? '📧' : c.campaignType === 'seasonal' ? '📅' : c.campaignType === 'nurture' ? '🌱' : c.campaignType === 'reactivation' ? '🔄' : '🎯'

  return (
    <Card className="p-5 rounded-2xl border-0 shadow-sm hover:shadow-md transition-shadow group relative">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{typeEmoji}</span>
          <div>
            <h4 className="font-bold text-[#1A1A1A]">{c.name}</h4>
            {c.description && <p className="text-xs text-gray-500 mt-0.5">{c.description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColor(c.status)}`}>
            {statusIcon(c.status)} {c.status}
          </span>
          {onDelete && (
            <button
              onClick={() => onDelete(c.id, c.name)}
              disabled={generating === c.id}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 disabled:opacity-30"
              title="Eliminar campaña"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-5 gap-1.5 mb-3">
        <div className="text-center">
          <div className="text-lg font-bold text-[#1A1A1A]">{leadCount}</div>
          <div className="text-[10px] text-gray-400">Leads</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-[#C4622D]">{c.sentCount || 0}</div>
          <div className="text-[10px] text-gray-400">Enviados</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-amber-500">{c.openCount || 0}</div>
          <div className="text-[10px] text-gray-400">
            👁 Abiertos{(c.sentCount || 0) > 0 ? ` · ${Math.round(((c.openCount || 0) / c.sentCount) * 100)}%` : ''}
          </div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-emerald-600">{c.replyCount || 0}</div>
          <div className="text-[10px] text-gray-400">Respuestas</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-blue-600">{c.convertedCount || 0}</div>
          <div className="text-[10px] text-gray-400">Convertidos</div>
        </div>
      </div>

      {/* Progress bar */}
      {leadCount > 0 && (
        <div className="mb-3">
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden flex">
            {(c.sentCount || 0) > 0 && <div className="h-full bg-[#C4622D]" style={{ width: `${Math.min(100, ((c.sentCount || 0) / leadCount) * 100)}%` }} />}
            {(c.openCount || 0) > 0 && <div className="h-full bg-amber-400" style={{ width: `${Math.min(100, ((c.openCount || 0) / leadCount) * 100)}%` }} />}
            {(c.replyCount || 0) > 0 && <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, ((c.replyCount || 0) / leadCount) * 100)}%` }} />}
            {(c.convertedCount || 0) > 0 && <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, ((c.convertedCount || 0) / leadCount) * 100)}%` }} />}
          </div>
        </div>
      )}

      {/* Type & Date */}
      <div className="flex items-center justify-between text-[10px] text-gray-400">
        <span className="capitalize">Tipo: {c.campaignType || 'outreach'}</span>
        <span>{new Date(c.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-3">
        {c.status === 'draft' && onActivate && (
          <button
            onClick={() => onActivate(c.id)}
            disabled={generating === c.id}
            className="flex-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
          >
            {generating === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : '🚀'} Activar
          </button>
        )}
        {c.status === 'active' && onPause && (
          <button
            onClick={() => onPause(c.id)}
            disabled={generating === c.id}
            className="flex-1 px-3 py-1.5 rounded-lg bg-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
          >
            {generating === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : '⏸️'} Pausar
          </button>
        )}
        {leadCount === 0 && (
          <span className="text-[10px] text-amber-600 italic">Sin leads — dile a OCTOPUS: &quot;pasa leads a esta campaña&quot;</span>
        )}
      </div>
    </Card>
  )
}

/* ═══════════════  INSIGHTS / CEREBRO TAB  ═══════════════ */
function InsightsTab() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/growth/insights')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-[#C4622D]" /></div>
  if (!data) return null

  const catPerf = data.emailCategoryPerformance || {}
  const typePerf = data.businessTypePerformance || {}
  const tierPerf = data.tierPerformance || {}
  const classDist = data.classificationDistribution || {}

  return (
    <div className="space-y-6">
      {/* AI Summary */}
      {data.aiSummary && (
        <Card className="p-5 rounded-2xl border-0 shadow-sm bg-gradient-to-r from-[#2D4A3E]/5 to-[#C4622D]/5">
          <div className="flex items-start gap-3">
            <Sparkles className="w-6 h-6 text-[#C4622D] shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-[#1A1A1A] mb-2">🧠 AI Insights</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{data.aiSummary}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Email Category Performance */}
      <Card className="p-5 rounded-2xl border-0 shadow-sm">
        <h3 className="font-bold text-[#1A1A1A] mb-4">📧 Performance por Categoría de Email</h3>
        <div className="space-y-3">
          {Object.entries(catPerf).sort(([a], [b]) => a.localeCompare(b)).map(([cat, perf]: [string, any]) => {
            const replyRate = perf.sent > 0 ? Math.round((perf.replied / perf.sent) * 100) : 0
            return (
              <div key={cat} className="flex items-center gap-3">
                <span className="text-xs font-bold w-10 text-gray-600">{cat}</span>
                <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden flex">
                  <div className="h-full bg-[#4A90D9] transition-all" style={{ width: `${Math.max(perf.sent * 10, 2)}%` }} title={`Enviados: ${perf.sent}`} />
                  <div className="h-full bg-[#22c55e] transition-all" style={{ width: `${Math.max(perf.replied * 10, 0)}%` }} title={`Respondidos: ${perf.replied}`} />
                  <div className="h-full bg-[#C4622D] transition-all" style={{ width: `${Math.max(perf.converted * 10, 0)}%` }} title={`Convertidos: ${perf.converted}`} />
                </div>
                <span className="text-xs font-bold w-20 text-right text-[#1A1A1A]">{replyRate}% reply</span>
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#4A90D9]" /> Enviados</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#22c55e]" /> Respondidos</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#C4622D]" /> Convertidos</span>
        </div>
      </Card>

      {/* Business Type Performance */}
      <Card className="p-5 rounded-2xl border-0 shadow-sm">
        <h3 className="font-bold text-[#1A1A1A] mb-4">🏢 Performance por Tipo de Negocio</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Object.entries(typePerf).map(([type, perf]: [string, any]) => {
            const replyRate = perf.contacted > 0 ? Math.round((perf.replied / perf.contacted) * 100) : 0
            return (
              <div key={type} className="p-3 rounded-xl bg-[#F5F0E8]">
                <p className="text-sm font-bold text-[#1A1A1A] capitalize">{type}</p>
                <p className="text-xs text-gray-500 mt-1">{perf.total} leads · {perf.replied} replies</p>
                <p className="text-lg font-bold mt-1" style={{ color: replyRate >= 50 ? '#22c55e' : replyRate >= 20 ? '#f59e0b' : '#6b7280' }}>
                  {replyRate}%
                </p>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Reply Classification */}
      {Object.keys(classDist).length > 0 && (
        <Card className="p-5 rounded-2xl border-0 shadow-sm">
          <h3 className="font-bold text-[#1A1A1A] mb-4">🎯 Clasificación de Respuestas</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {(['interested', 'question', 'neutral', 'not_interested', 'bounce'] as const).map((cls) => {
              const info: Record<string, { label: string; color: string; emoji: string }> = {
                interested: { label: 'Interesado', color: '#22c55e', emoji: '🔥' },
                not_interested: { label: 'No Interesado', color: '#ef4444', emoji: '❌' },
                question: { label: 'Pregunta', color: '#f59e0b', emoji: '❓' },
                bounce: { label: 'Bounce', color: '#6b7280', emoji: '⚠️' },
                neutral: { label: 'Neutral', color: '#4A90D9', emoji: '📩' },
              }
              const c = info[cls]
              return (
                <div key={cls} className="text-center p-2 rounded-xl" style={{ backgroundColor: `${c.color}10` }}>
                  <span className="text-xl">{c.emoji}</span>
                  <p className="text-2xl font-bold mt-1" style={{ color: c.color }}>{classDist[cls] || 0}</p>
                  <p className="text-[10px] text-gray-500">{c.label}</p>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Follow-up Stats */}
      <Card className="p-5 rounded-2xl border-0 shadow-sm">
        <h3 className="font-bold text-[#1A1A1A] mb-3">🔄 Follow-up Effectiveness</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-[#2D4A3E]">{data.followUpStats?.leadsWithFollowUps || 0}</p>
            <p className="text-xs text-gray-500">Con follow-ups</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-[#22c55e]">{data.followUpStats?.followUpsThatGotReply || 0}</p>
            <p className="text-xs text-gray-500">Obtuvieron respuesta</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-[#C4622D]">{data.followUpStats?.avgFollowUpsToReply || 0}</p>
            <p className="text-xs text-gray-500">Promedio para respuesta</p>
          </div>
        </div>
      </Card>

      {/* Elite Reality List */}
      {data.eliteLeads?.length > 0 && (
        <Card className="p-5 rounded-2xl border-0 shadow-sm">
          <h3 className="font-bold text-[#1A1A1A] mb-4">🏆 Elite Reality List — Top Leads</h3>
          <div className="space-y-2">
            {data.eliteLeads.map((l: any, i: number) => (
              <div key={l.id} className="flex items-center gap-3 p-2 rounded-xl bg-[#F5F0E8]">
                <span className="text-lg font-bold text-[#C4622D] w-6 text-center">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#1A1A1A] truncate">{l.businessName}</p>
                  <p className="text-xs text-gray-500 capitalize">{l.businessType} · {l.city}</p>
                </div>
                <ScoreBadge score={l.score} />
                <TierBadge tier={l.tier} />
                <StatusPill status={l.status} />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

/* ═══════════════  REPORT TAB  ═══════════════ */
function ReportTab() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/growth/reports')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-[#C4622D]" /></div>
  if (!data) return null

  return (
    <div className="space-y-6">
      {/* AI Report */}
      {data.report && (
        <Card className="p-6 rounded-2xl border-0 shadow-sm bg-gradient-to-br from-[#2D4A3E]/5 to-[#C4622D]/5">
          <div className="prose prose-sm max-w-none text-sm text-[#1A1A1A] whitespace-pre-wrap">
            {data.report}
          </div>
        </Card>
      )}

      {/* Hot Leads */}
      {data.metrics?.hotLeads?.length > 0 && (
        <Card className="p-5 rounded-2xl border-0 shadow-sm">
          <h3 className="font-bold text-[#1A1A1A] mb-3">🔥 Leads Calientes — Acción Inmediata</h3>
          <div className="space-y-2">
            {data.metrics.hotLeads.map((l: any) => (
              <div key={l.id} className="flex items-center gap-3 p-2 rounded-xl bg-[#F5F0E8]">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#1A1A1A]">{l.businessName}</p>
                  <p className="text-xs text-gray-500 capitalize">{l.businessType} · {l.city}</p>
                </div>
                <ScoreBadge score={l.score} />
                {l.replyClassification && (
                  <span className="text-xs font-bold text-[#22c55e] capitalize">{l.replyClassification}</span>
                )}
                <StatusPill status={l.status} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recent Replies */}
      {data.metrics?.recentReplies?.length > 0 && (
        <Card className="p-5 rounded-2xl border-0 shadow-sm">
          <h3 className="font-bold text-[#1A1A1A] mb-3">📬 Respuestas Recientes</h3>
          <div className="space-y-2">
            {data.metrics.recentReplies.map((r: any) => (
              <div key={r.id} className="p-3 rounded-xl bg-[#F5F0E8]">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[#C4622D]">{r.leadName}</span>
                  <span className="text-[10px] text-gray-400">{r.date ? new Date(r.date).toLocaleDateString() : ''}</span>
                </div>
                <p className="text-xs text-gray-600 mt-1">{r.preview}</p>
                {r.classification && (
                  <span className="text-[10px] font-bold capitalize text-[#2D4A3E] mt-1 inline-block">📊 {r.classification}</span>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Quick Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Acciones Hoy" value={data.metrics?.todayActions || 0} icon={Zap} color="#C4622D" />
        <StatCard label="Mensajes Hoy" value={data.metrics?.todayMessages || 0} icon={Mail} color="#4A90D9" />
        <StatCard label="Total Leads" value={data.metrics?.totalLeads || 0} icon={Users} color="#2D4A3E" />
        <StatCard label="Convertidos" value={data.metrics?.pipeline?.converted || 0} icon={CheckCircle} color="#22c55e" />
      </div>
    </div>
  )
}

/* ═══════════════  STATS TAB (Phase 2 Enhanced)  ═══════════════ */
function StatsTab({ stats }: { stats: Stats | null }) {
  const { t } = useI18n()
  const emailCatLabels = useEmailCatLabels()
  if (!stats) return (
    <div className="flex justify-center py-16">
      <Loader2 className="w-8 h-8 animate-spin text-[#C4622D]" />
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label={t('growth.stat_total_leads')} value={stats.total} icon={Users} color="#2D4A3E" />
        <StatCard label={t('growth.stat_qualified')} value={stats.emailsSent} icon={Send} color="#4A90D9" />
        <StatCard label={t('growth.stat_conversions')} value={stats.pipeline?.converted || 0} icon={CheckCircle} color="#22c55e" />
        <StatCard label={t('growth.stat_pending')} value={stats.pendingActions} icon={Clock} color="#f59e0b" />
      </div>

      {/* Conversion Funnel */}
      <Card className="p-5 rounded-2xl border-0 shadow-sm">
        <h3 className="font-bold text-[#1A1A1A] mb-4">Embudo de Conversión</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 rounded-xl bg-[#4A90D9]/10">
            <p className="text-3xl font-bold text-[#4A90D9]">{stats.contactRate}%</p>
            <p className="text-xs text-gray-500 mt-1">Tasa de Contacto</p>
            <p className="text-[10px] text-gray-400">Leads contactados / total</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-[#22c55e]/10">
            <p className="text-3xl font-bold text-[#22c55e]">{stats.responseRate}%</p>
            <p className="text-xs text-gray-500 mt-1">Tasa de Respuesta</p>
            <p className="text-[10px] text-gray-400">Respuestas / contactados</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-[#C4622D]/10">
            <p className="text-3xl font-bold text-[#C4622D]">{stats.conversionRate}%</p>
            <p className="text-xs text-gray-500 mt-1">Tasa de Conversión</p>
            <p className="text-[10px] text-gray-400">Convertidos / total</p>
          </div>
        </div>
      </Card>

      {/* Tier Distribution */}
      <Card className="p-5 rounded-2xl border-0 shadow-sm">
        <h3 className="font-bold text-[#1A1A1A] mb-4">Distribución por Tier</h3>
        <div className="grid grid-cols-3 gap-4">
          {(['diamond', 'vibranium', 'antimatter'] as const).map((tier) => {
            const count = stats.tiers?.[tier] || 0
            const pct = stats.total ? Math.round((count / stats.total) * 100) : 0
            const Icon = TIER_ICONS[tier]
            return (
              <div key={tier} className="text-center">
                <Icon className="w-8 h-8 mx-auto mb-1" style={{ color: TIER_COLORS[tier] }} />
                <p className="text-2xl font-bold text-[#1A1A1A]">{count}</p>
                <p className="text-xs text-gray-500 capitalize">{tier} ({pct}%)</p>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Email Quality */}
      <Card className="p-5 rounded-2xl border-0 shadow-sm">
        <h3 className="font-bold text-[#1A1A1A] mb-4">Calidad de Emails</h3>
        <div className="space-y-2">
          {Object.entries(stats.emailCategories || {}).sort(([a], [b]) => a.localeCompare(b)).map(([cat, count]) => {
            const pct = stats.total ? Math.round(((count as number) / stats.total) * 100) : 0
            return (
              <div key={cat} className="flex items-center gap-3">
                <span className="text-xs font-bold w-20 text-gray-600">{emailCatLabels[cat] || cat}</span>
                <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: '#C4622D' }}
                  />
                </div>
                <span className="text-xs font-bold text-[#1A1A1A] w-12 text-right">{count as number} ({pct}%)</span>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Activity Summary */}
      <Card className="p-5 rounded-2xl border-0 shadow-sm">
        <h3 className="font-bold text-[#1A1A1A] mb-4">Actividad</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="text-center p-2">
            <p className="text-xl font-bold text-[#1A1A1A]">{stats.totalActions}</p>
            <p className="text-xs text-gray-500">Acciones totales</p>
          </div>
          <div className="text-center p-2">
            <p className="text-xl font-bold text-[#1A1A1A]">{stats.outboundMessages}</p>
            <p className="text-xs text-gray-500">Emails enviados</p>
          </div>
          <div className="text-center p-2">
            <p className="text-xl font-bold text-[#1A1A1A]">{stats.inboundMessages}</p>
            <p className="text-xs text-gray-500">Respuestas</p>
          </div>
          <div className="text-center p-2">
            <p className="text-xl font-bold text-[#1A1A1A]">{stats.totalMessages}</p>
            <p className="text-xs text-gray-500">Mensajes total</p>
          </div>
        </div>
      </Card>

      {/* Top Cities */}
      {stats.topCities && stats.topCities.length > 0 && (
        <Card className="p-5 rounded-2xl border-0 shadow-sm">
          <h3 className="font-bold text-[#1A1A1A] mb-4">Top Ciudades</h3>
          <div className="space-y-2">
            {stats.topCities.map((c, i) => (
              <div key={c.city} className="flex items-center gap-3">
                <span className="text-sm font-bold text-[#2D4A3E] w-6">{i + 1}</span>
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="flex-1 text-sm text-[#1A1A1A]">{c.city}</span>
                <span className="text-sm font-bold text-[#C4622D]">{c.count}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: typeof Users; color: string }) {
  return (
    <Card className="p-4 rounded-2xl border-0 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <div>
          <p className="text-2xl font-bold text-[#1A1A1A]">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </Card>
  )
}

/* ═══════════════  ADD LEAD MODAL  ═══════════════ */
function AddLeadModal({ onClose, onSaved, handlePlanError }: { onClose: () => void; onSaved: () => void; handlePlanError?: (res: Response, feature: 'leads' | 'creative' | 'iot') => Promise<boolean> }) {
  const { t, locale } = useI18n()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    businessName: '', businessType: 'restaurant', contactName: '', email: '',
    phone: '', website: '', city: '', state: '', country: '', googleRating: '',
    leadSource: '', notes: '',
  })

  const handleSave = async () => {
    if (!form.businessName || !form.email) return alert('Nombre y email son requeridos')
    setSaving(true)
    try {
      const payload = {
        ...form,
        googleRating: form.googleRating ? parseFloat(form.googleRating) : null,
      }
      const res = await fetch('/api/growth/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) { onSaved() }
      else {
        if (handlePlanError && await handlePlanError(res, 'leads')) {
          onClose()
          return
        }
        const err = await res.json().catch(() => ({ error: 'Error' }))
        alert(err.error || 'Error')
      }
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  const fieldClass = 'w-full px-3 py-2.5 rounded-xl bg-[#F5F0E8] border-0 text-sm focus:ring-2 focus:ring-[#C4622D]/30 outline-none'

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#1A1A1A]">{t('growth.add_lead_title')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs font-semibold text-gray-600 mb-1 block">{locale === 'en' ? 'Business Name *' : 'Nombre del Negocio *'}</label>
            <input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} className={fieldClass} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">{locale === 'en' ? 'Business Type' : 'Tipo de Negocio'}</label>
            <select value={form.businessType} onChange={(e) => setForm({ ...form, businessType: e.target.value })} className={fieldClass}>
              <option value="restaurant">{locale === 'en' ? 'Restaurant' : 'Restaurante'}</option>
              <option value="bar">Bar</option>
              <option value="gym">Gym</option>
              <option value="salon">{locale === 'en' ? 'Salon' : 'Salón'}</option>
              <option value="cafe">{locale === 'en' ? 'Cafe' : 'Café'}</option>
              <option value="retail">Retail</option>
              <option value="hotel">Hotel</option>
              <option value="other">{locale === 'en' ? 'Other' : 'Otro'}</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">{locale === 'en' ? 'Contact' : 'Contacto'}</label>
            <input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} className={fieldClass} />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Email *</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={fieldClass} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">{locale === 'en' ? 'Phone' : 'Teléfono'}</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={fieldClass} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Website</label>
            <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className={fieldClass} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">{locale === 'en' ? 'City' : 'Ciudad'}</label>
            <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={fieldClass} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">{locale === 'en' ? 'State' : 'Estado'}</label>
            <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className={fieldClass} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">{locale === 'en' ? 'Country' : 'País'}</label>
            <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className={fieldClass} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Google Rating</label>
            <input type="number" step="0.1" min="0" max="5" value={form.googleRating} onChange={(e) => setForm({ ...form, googleRating: e.target.value })} className={fieldClass} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">{locale === 'en' ? 'Lead Source' : 'Fuente del Lead'}</label>
            <input value={form.leadSource} onChange={(e) => setForm({ ...form, leadSource: e.target.value })} className={fieldClass} placeholder="Google Maps, referral..." />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-semibold text-gray-600 mb-1 block">{locale === 'en' ? 'Notes' : 'Notas'}</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${fieldClass} resize-none h-20`} />
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <Button onClick={onClose} variant="outline" className="flex-1 rounded-xl">{locale === 'en' ? 'Cancel' : 'Cancelar'}</Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1 rounded-xl bg-[#C4622D] hover:bg-[#B5521D] text-white">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (locale === 'en' ? 'Save Lead' : 'Guardar Lead')}
          </Button>
        </div>
      </motion.div>
    </div>
  )
}

/* ═══════════════  IMPORT MODAL  ═══════════════ */
function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { t, locale } = useI18n()
  const [jsonText, setJsonText] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null)

  const handleImport = async () => {
    setImporting(true)
    try {
      const parsed = JSON.parse(jsonText)
      const leads = Array.isArray(parsed) ? parsed : [parsed]
      const res = await fetch('/api/growth/leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads }),
      })
      if (res.ok) {
        setResult(await res.json())
      } else {
        const err = await res.json()
        alert(err.error || 'Error')
      }
    } catch {
      alert(locale === 'en' ? 'Invalid JSON. Check the format.' : 'JSON inválido. Verifica el formato.')
    }
    setImporting(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#1A1A1A]">{t('growth.import_title')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        {result ? (
          <div className="text-center py-4">
            <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-3" />
            <p className="font-bold text-[#1A1A1A]">{locale === 'en' ? 'Import complete' : 'Importación completa'}</p>
            <p className="text-sm text-gray-500 mt-1">{result.imported} {locale === 'en' ? 'imported' : 'importados'} · {result.skipped} {locale === 'en' ? 'duplicates' : 'duplicados'}</p>
            {result.errors.length > 0 && (
              <div className="mt-3 text-left bg-red-50 p-3 rounded-xl">
                <p className="text-xs font-bold text-red-600 mb-1">{locale === 'en' ? 'Errors:' : 'Errores:'}</p>
                {result.errors.map((e, i) => <p key={i} className="text-xs text-red-500">{e}</p>)}
              </div>
            )}
            <Button onClick={onDone} className="mt-4 rounded-xl bg-[#C4622D] hover:bg-[#B5521D] text-white">{locale === 'en' ? 'Close' : 'Cerrar'}</Button>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-2">
              {locale === 'en' ? 'Paste a JSON array of leads. Fields: businessName, email, businessType, contactName, phone, website, city, state, country, googleRating, leadSource, notes' : 'Pega un arreglo JSON de leads. Campos: businessName, email, businessType, contactName, phone, website, city, state, country, googleRating, leadSource, notes'}
            </p>
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder='[{"businessName": "My Restaurant", "email": "info@myrest.com", "businessType": "restaurant", "city": "Miami"}]'
              className="w-full h-48 px-3 py-2.5 rounded-xl bg-[#F5F0E8] border-0 text-sm font-mono focus:ring-2 focus:ring-[#C4622D]/30 outline-none resize-none"
            />
            <div className="flex gap-3 mt-4">
              <Button onClick={onClose} variant="outline" className="flex-1 rounded-xl">{locale === 'en' ? 'Cancel' : 'Cancelar'}</Button>
              <Button onClick={handleImport} disabled={importing || !jsonText.trim()} className="flex-1 rounded-xl bg-[#C4622D] hover:bg-[#B5521D] text-white">
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Upload className="w-4 h-4 mr-1" /> {locale === 'en' ? 'Import' : 'Importar'}</>}
              </Button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  )
}

/* ═══════════════  LEAD DETAIL MODAL  ═══════════════ */
function LeadDetailModal({ lead, onClose, onUpdated }: { lead: Lead; onClose: () => void; onUpdated: () => void }) {
  const { t } = useI18n()
  const emailCatLabels = useEmailCatLabels()
  const [detail, setDetail] = useState<(Lead & { actions?: Action[]; messages?: any[] }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [editStatus, setEditStatus] = useState(lead.status)
  const [editNotes, setEditNotes] = useState(lead.notes || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/growth/leads/${lead.id}`)
      .then((r) => r.json())
      .then((d) => { setDetail(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [lead.id])

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch(`/api/growth/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: editStatus, notes: editNotes }),
      })
      onUpdated()
      onClose()
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  const painPoints = lead.painPoints ? (() => { try { return JSON.parse(lead.painPoints) } catch { return null } })() : null

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-[#1A1A1A]">{lead.businessName}</h2>
            <div className="flex items-center gap-2 mt-1">
              <StatusPill status={lead.status} />
              <ScoreBadge score={lead.qualificationScore} />
              <TierBadge tier={lead.leadTier} />
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#C4622D]" /></div>
        ) : (
          <div className="space-y-4">
            {/* Contact Info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {lead.contactName && (
                <div className="flex items-center gap-2"><Users className="w-4 h-4 text-gray-400" /><span>{lead.contactName}</span></div>
              )}
              <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-gray-400" /><span>{lead.email}</span></div>
              {lead.phone && <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-gray-400" /><span>{lead.phone}</span></div>}
              {lead.website && (
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-gray-400" />
                  <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noopener noreferrer" className="text-[#4A90D9] hover:underline">{lead.website}</a>
                </div>
              )}
              {lead.city && <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-gray-400" /><span>{lead.city}{lead.state ? `, ${lead.state}` : ''}{lead.country ? ` · ${lead.country}` : ''}</span></div>}
              {lead.googleRating && <div className="flex items-center gap-2"><Star className="w-4 h-4 text-yellow-500" /><span>{lead.googleRating} / 5</span></div>}
              <div className="flex items-center gap-2 text-gray-500"><span className="capitalize">{lead.businessType}</span></div>
              {lead.emailCategory && <div className="flex items-center gap-2"><span className="text-xs font-semibold bg-gray-100 px-2 py-0.5 rounded">{lead.emailCategory} — {emailCatLabels[lead.emailCategory] || ''}</span></div>}
            </div>

            {/* Pain Points */}
            {painPoints && Array.isArray(painPoints) && painPoints.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Pain Points</p>
                <div className="flex flex-wrap gap-1">
                  {painPoints.map((p: string, i: number) => (
                    <span key={i} className="text-xs bg-[#C4622D]/10 text-[#C4622D] px-2 py-0.5 rounded-full">{p}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Edit Status & Notes */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F5F0E8] border-0 text-sm focus:ring-2 focus:ring-[#C4622D]/30 outline-none"
                >
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="replied">Replied</option>
                  <option value="converted">Converted</option>
                  <option value="lost">Lost</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Notas</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F5F0E8] border-0 text-sm focus:ring-2 focus:ring-[#C4622D]/30 outline-none resize-none h-20"
                />
              </div>
            </div>

            {/* Messages */}
            {detail?.messages && detail.messages.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">Mensajes ({detail.messages.length})</p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {detail.messages.map((m: any) => (
                    <div key={m.id} className={`p-2 rounded-xl text-xs ${m.direction === 'outbound' ? 'bg-[#2D4A3E]/5 ml-4' : 'bg-[#F5F0E8] mr-4'}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{m.direction === 'outbound' ? '→ Enviado' : '← Recibido'}</span>
                        <span className="text-gray-400">{new Date(m.createdAt).toLocaleDateString()}</span>
                      </div>
                      {m.subject && <p className="font-medium mt-1">{m.subject}</p>}
                      <p className="text-gray-600 mt-0.5 line-clamp-3">{m.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button onClick={onClose} variant="outline" className="flex-1 rounded-xl">Cerrar</Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1 rounded-xl bg-[#C4622D] hover:bg-[#B5521D] text-white">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar Cambios'}
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}


/* ═══════════════  AGENT LEADS TAB  ═══════════════ */
const SOURCE_META: Record<string, { label: string; color: string; bg: string }> = {
  facebook: { label: 'Facebook', color: '#1877F2', bg: 'rgba(24,119,242,0.12)' },
  google: { label: 'Google', color: '#EA4335', bg: 'rgba(234,67,53,0.12)' },
  linkedin: { label: 'LinkedIn', color: '#0A66C2', bg: 'rgba(10,102,194,0.12)' },
  tiktok: { label: 'TikTok', color: '#010101', bg: 'rgba(1,1,1,0.10)' },
  instagram: { label: 'Instagram', color: '#E4405F', bg: 'rgba(228,64,95,0.12)' },
  direct: { label: 'Directo', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
}
const SIGNAL_META: Record<string, { emoji: string; label: string; color: string }> = {
  hot: { emoji: '🔥', label: 'Hot', color: '#ef4444' },
  warm: { emoji: '🟡', label: 'Warm', color: '#f59e0b' },
  cold: { emoji: '❄️', label: 'Cold', color: '#6b7280' },
}

function AgentLeadsTab() {
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [sourceStats, setSourceStats] = useState<Record<string, number>>({})
  const [signalStats, setSignalStats] = useState<Record<string, number>>({})
  const [filterSource, setFilterSource] = useState('all')
  const [filterSignal, setFilterSignal] = useState('all')

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/sales-agent/capture-lead')
      if (res.ok) {
        const data = await res.json()
        setLeads(data.leads || [])
        const srcMap: Record<string, number> = {}
        const sigMap: Record<string, number> = {}
        for (const l of data.leads || []) {
          const src = (l.source || 'direct').toLowerCase()
          srcMap[src] = (srcMap[src] || 0) + 1
          const sig = (l.buyingSignal || 'cold').toLowerCase()
          sigMap[sig] = (sigMap[sig] || 0) + 1
        }
        setSourceStats(srcMap)
        setSignalStats(sigMap)
      }
    } catch (_) { /* silent */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  const updateStatus = async (id: string, status: string) => {
    try {
      await fetch('/api/sales-agent/capture-lead', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l))
    } catch (_) { /* silent */ }
  }

  const filtered = leads.filter(l => {
    if (filterSource !== 'all' && (l.source || 'direct').toLowerCase() !== filterSource) return false
    if (filterSignal !== 'all' && (l.buyingSignal || 'cold').toLowerCase() !== filterSignal) return false
    return true
  })

  const statusOpts = ['new', 'contacted', 'converted', 'lost']

  return (
    <div className="space-y-6">
      {/* Source stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(SOURCE_META).map(([key, meta]) => (
          <Card key={key} className="p-4 cursor-pointer border dark:border-white/10 hover:shadow-md transition-all"
            style={{ background: filterSource === key ? meta.bg : undefined, borderColor: filterSource === key ? meta.color : undefined }}
            onClick={() => setFilterSource(filterSource === key ? 'all' : key)}>
            <div className="text-2xl font-bold" style={{ color: meta.color }}>{sourceStats[key] || 0}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{meta.label}</div>
          </Card>
        ))}
      </div>

      {/* Signal breakdown */}
      <div className="flex gap-3 flex-wrap">
        {Object.entries(SIGNAL_META).map(([key, meta]) => (
          <button key={key}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${filterSignal === key ? 'ring-2 ring-offset-2 dark:ring-offset-gray-900' : 'opacity-70 hover:opacity-100'}`}
            style={{ background: filterSignal === key ? `${meta.color}20` : 'transparent', borderColor: meta.color, border: '1px solid' }}
            onClick={() => setFilterSignal(filterSignal === key ? 'all' : key)}>
            <span>{meta.emoji}</span>
            <span style={{ color: meta.color }}>{meta.label}</span>
            <span className="ml-1 font-bold" style={{ color: meta.color }}>{signalStats[key] || 0}</span>
          </button>
        ))}
        {(filterSource !== 'all' || filterSignal !== 'all') && (
          <button className="text-xs text-gray-500 underline ml-2" onClick={() => { setFilterSource('all'); setFilterSignal('all') }}>
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Leads table */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-[#C4622D]" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center dark:border-white/10">
          <MessageSquare className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">No hay leads de agentes aún</p>
          <p className="text-sm text-gray-400 mt-1">Los leads aparecerán aquí cuando los visitantes interactúen con tus agentes de ventas</p>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">{filtered.length} lead{filtered.length !== 1 ? 's' : ''}</div>
          {filtered.map(lead => {
            const src = SOURCE_META[(lead.source || 'direct').toLowerCase()] || SOURCE_META.direct
            const sig = SIGNAL_META[(lead.buyingSignal || 'cold').toLowerCase()] || SIGNAL_META.cold
            return (
              <Card key={lead.id} className="p-4 dark:border-white/10 hover:shadow-md transition-all">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* Left: visitor info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 dark:text-[#F5F0E8]">{lead.visitorName || 'Visitante'}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: src.bg, color: src.color }}>{src.label}</span>
                      <span className="text-xs">{sig.emoji} <span style={{ color: sig.color }}>{sig.label}</span></span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
                      {lead.visitorEmail && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{lead.visitorEmail}</span>}
                      {lead.visitorPhone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.visitorPhone}</span>}
                      {lead.agent?.name && <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{lead.agent.name}</span>}
                    </div>
                    {lead.chatSummary && <p className="text-xs text-gray-400 mt-1 line-clamp-1">{lead.chatSummary}</p>}
                    {lead.productName && <span className="text-xs text-[#C4622D] mt-1 inline-block">{lead.productName}{lead.productPrice ? ` · $${lead.productPrice}` : ''}</span>}
                  </div>
                  {/* Right: status + date */}
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={lead.status || 'new'}
                      onChange={e => updateStatus(lead.id, e.target.value)}
                      className="text-xs rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-700 dark:text-gray-300 px-2 py-1"
                    >
                      {statusOpts.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                    </select>
                    <span className="text-xs text-gray-400">{new Date(lead.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}