'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Wrench, 
  Clock, 
  ArrowLeft, 
  Image, 
  Gamepad2, 
  LayoutGrid, 
  TestTube, 
  Code, 
  Rocket,
  Radio,
  CheckCircle,
  Sparkles,
  Bot,
  Cpu,
  Eye,
  Trash2,
  Play,
  BarChart3,
  TrendingUp,
  Zap,
  Timer,
  Activity,
  ChevronDown,
  ChevronUp,
  Loader2
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n-context'

interface Skill {
  id: string
  name: string
  descKey: string
  icon: React.ReactNode
  color: string
  status: 'active' | 'coming_soon'
  capKeys: string[]
}

interface CustomSkill {
  id: string
  name: string
  description: string
  category: string
  code: string
  usageCount: number
  isActive: boolean
  createdAt: string
  createdBy: string
}

interface SkillStats {
  total: number
  success: number
  failed: number
  successRate: number
  avgDuration: number
  last7Days: number[]
  lastUsed: string | null
  topCategories: Record<string, number>
  recentExecutions: Array<{
    id: string
    method: string
    success: boolean
    duration: number
    category: string | null
    trigger: string
    createdAt: string
  }>
}

interface StatsData {
  skills: Record<string, SkillStats>
  global: {
    total: number
    success: number
    successRate: number
    thisWeek: number
  }
}

const categoryIcons: Record<string, React.ReactNode> = {
  ai: <Cpu className="w-6 h-6" />,
  code: <Code className="w-6 h-6" />,
  design: <Image className="w-6 h-6" />,
  automation: <Bot className="w-6 h-6" />,
  media: <Image className="w-6 h-6" />,
  general: <Wrench className="w-6 h-6" />,
}

const categoryColors: Record<string, string> = {
  ai: '#4A90D9',
  code: '#2D4A3E',
  design: '#C4622D',
  automation: '#9B59B6',
  media: '#f59e0b',
  general: '#1ABC9C',
}

const SKILLS: Skill[] = [
  {
    id: 'image-skill',
    name: '🖼️ Image Skill',
    descKey: 'skills.image_desc',
    icon: <Image className="w-6 h-6" />,
    color: '#f59e0b',
    status: 'active',
    capKeys: ['skills.image_cap1', 'skills.image_cap2', 'skills.image_cap3', 'skills.image_cap4'],
  },
  {
    id: 'game-skill',
    name: '🎮 Game Agent',
    descKey: 'skills.game_desc',
    icon: <Gamepad2 className="w-6 h-6" />,
    color: '#ec4899',
    status: 'active',
    capKeys: ['skills.game_cap1', 'skills.game_cap2', 'skills.game_cap3', 'skills.game_cap4'],
  },
  {
    id: 'layout-analyzer',
    name: '📐 Layout Analyzer',
    descKey: 'skills.layout_desc',
    icon: <LayoutGrid className="w-6 h-6" />,
    color: '#8b5cf6',
    status: 'coming_soon',
    capKeys: ['skills.layout_cap1', 'skills.layout_cap2', 'skills.layout_cap3'],
  },
  {
    id: 'code-refiner',
    name: '🔧 Code Refiner',
    descKey: 'skills.code_desc',
    icon: <Code className="w-6 h-6" />,
    color: '#2D4A3E',
    status: 'active',
    capKeys: ['skills.code_cap1', 'skills.code_cap2', 'skills.code_cap3'],
  },
  {
    id: 'test-agent',
    name: '🧪 Test Agent',
    descKey: 'skills.test_desc',
    icon: <TestTube className="w-6 h-6" />,
    color: '#22c55e',
    status: 'coming_soon',
    capKeys: ['skills.test_cap1', 'skills.test_cap2', 'skills.test_cap3'],
  },
  {
    id: 'wildverse-seo',
    name: '🦖 Wildverse SEO',
    descKey: 'skills.seo_desc',
    icon: <TrendingUp className="w-6 h-6" />,
    color: '#16a34a',
    status: 'active',
    capKeys: ['skills.seo_cap1', 'skills.seo_cap2', 'skills.seo_cap3', 'skills.seo_cap4', 'skills.seo_cap5'],
  },
  {
    id: 'content-publisher',
    name: '📡 Content Publisher',
    descKey: 'skills.cpub_desc',
    icon: <Radio className="w-6 h-6" />,
    color: '#0EA5E9',
    status: 'active',
    capKeys: ['skills.cpub_cap1', 'skills.cpub_cap2', 'skills.cpub_cap3', 'skills.cpub_cap4'],
  },
  {
    id: 'deploy-agent',
    name: '🚀 Deploy Agent',
    descKey: 'skills.deploy_desc',
    icon: <Rocket className="w-6 h-6" />,
    color: '#ef4444',
    status: 'coming_soon',
    capKeys: ['skills.deploy_cap1', 'skills.deploy_cap2', 'skills.deploy_cap3'],
  },
]

/* ── Mini sparkline chart ─────────────────────────────────────────────── */
function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1)
  const h = 28
  const w = 80
  const step = w / (data.length - 1 || 1)
  const points = data.map((v, i) => `${i * step},${h - (v / max) * (h - 4)}`).join(' ')
  const fillPoints = `0,${h} ${points} ${w},${h}`

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polygon points={fillPoints} fill={`${color}15`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      {data.map((v, i) => (
        <circle key={i} cx={i * step} cy={h - (v / max) * (h - 4)} r="2" fill={color} opacity={i === data.length - 1 ? 1 : 0.4} />
      ))}
    </svg>
  )
}

/* ── Trigger badge ────────────────────────────────────────────────────── */
function TriggerBadge({ trigger, t }: { trigger: string; t: (k: string) => string }) {
  const styles: Record<string, string> = {
    auto: 'bg-amber-100 text-amber-700',
    manual: 'bg-blue-100 text-blue-700',
    refine: 'bg-purple-100 text-purple-700',
  }
  return (
    <span className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${styles[trigger] || 'bg-gray-100 text-gray-600'}`}>
      {t(`skills.trigger_${trigger}`) || trigger}
    </span>
  )
}

export default function SkillFactoryPage() {
  const activeSkills = SKILLS.filter(s => s.status === 'active')
  const { t } = useI18n()
  const comingSkills = SKILLS.filter(s => s.status === 'coming_soon')
  
  // Custom skills from DB (per-user isolated)
  const [customSkills, setCustomSkills] = useState<CustomSkill[]>([])
  const [selectedSkill, setSelectedSkill] = useState<CustomSkill | null>(null)
  const [mounted, setMounted] = useState(false)

  // Ejecución real de skills
  const [executing, setExecuting] = useState(false)
  const [executionResult, setExecutionResult] = useState<string | null>(null)
  const [executionError, setExecutionError] = useState<string | null>(null)
  const [executionInput, setExecutionInput] = useState('')

  const executeSkill = useCallback(async (skill: CustomSkill, input: string) => {
    setExecuting(true)
    setExecutionResult(null)
    setExecutionError(null)
    try {
      const res = await fetch('/api/skill-factory/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId: skill.id, input: input.trim() || undefined }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setExecutionResult(data.result)
      } else {
        setExecutionError(data.error || 'Error ejecutando la skill')
      }
    } catch {
      setExecutionError('Error de conexión. Intenta de nuevo.')
    } finally {
      setExecuting(false)
    }
  }, [])
  
  // Skill stats
  const [stats, setStats] = useState<StatsData | null>(null)
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null)
  
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/skills/stats')
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch (err) {
      console.error('[SkillFactory] Stats fetch error:', err)
    }
  }, [])

  const loadSkills = useCallback(async () => {
    try {
      const res = await fetch('/api/skill-factory/skills')
      if (res.ok) {
        const data = await res.json()
        const dbSkills = (data.skills || []).map((s: CustomSkill & { createdAt: string }) => ({
          ...s,
          createdAt: typeof s.createdAt === 'string' ? s.createdAt : new Date(s.createdAt).toISOString(),
        }))
        // Clean up stale localStorage (migration period ended)
        try { localStorage.removeItem('octopus-skills') } catch {}
        setCustomSkills(dbSkills)
      }
    } catch (err) {
      console.error('[SkillFactory] Error loading skills:', err)
    }
  }, [])
  
  useEffect(() => {
    setMounted(true)
    loadSkills()
    fetchStats()
  }, [loadSkills, fetchStats])
  
  const deleteSkill = async (id: string) => {
    try {
      await fetch(`/api/skill-factory/skills?id=${id}`, { method: 'DELETE' })
      await loadSkills()
    } catch (err) {
      console.error('[SkillFactory] Error deleting skill:', err)
    }
  }

  const toggleExpand = (skillId: string) => {
    setExpandedSkill(prev => prev === skillId ? null : skillId)
  }

  const getSkillStats = (skillId: string): SkillStats | null => {
    return stats?.skills?.[skillId] || null
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 60000) return 'just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return d.toLocaleDateString()
  }

  return (
    <div className="space-y-6">
      <Link href="/dashboard">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('common.back')}
        </Button>
      </Link>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-[#2D4A3E] to-[#1A1A1A] rounded-3xl p-6 text-[#F5F0E8]"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#C4622D]/20 rounded-2xl flex items-center justify-center">
            <Wrench className="w-6 h-6 text-[#C4622D]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {t('skills.title')}
              <Sparkles className="w-5 h-5 text-[#C4622D]" />
            </h1>
            <p className="text-[#F5F0E8]/70">
              {t('skills.subtitle')}
            </p>
          </div>
        </div>
      </motion.div>

      {/* ═══ Global Stats Banner ═══ */}
      {stats && stats.global.total > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-gradient-to-r from-[#1A1A1A] to-[#2D4A3E] border-0 !p-0 overflow-hidden">
            <div className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-[#C4622D]" />
                <h3 className="text-sm font-semibold text-[#F5F0E8]/80 uppercase tracking-wider">
                  {t('skills.stats_title')}
                </h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-[#F5F0E8]">{stats.global.total}</div>
                  <div className="text-xs text-[#F5F0E8]/50">{t('skills.total_executions')}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">{stats.global.successRate}%</div>
                  <div className="text-xs text-[#F5F0E8]/50">{t('skills.success_rate')}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-amber-400">{stats.global.thisWeek}</div>
                  <div className="text-xs text-[#F5F0E8]/50">{t('skills.this_week')}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-[#C4622D]">{stats.global.success}</div>
                  <div className="text-xs text-[#F5F0E8]/50">✓ OK</div>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Active Skills */}
      <div>
        <h2 className="text-lg font-bold text-[#1A1A1A] mb-4 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-500" />
          {t('skills.active_skills')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeSkills.map((skill, index) => {
            const skillStats = getSkillStats(skill.id)
            const isExpanded = expandedSkill === skill.id

            return (
              <motion.div
                key={skill.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full">
                  <div className="flex items-start gap-4">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${skill.color}20` }}
                    >
                      <span style={{ color: skill.color }}>{skill.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-[#1A1A1A]">{skill.name}</h3>
                        <span className="px-2 py-0.5 bg-green-600 text-white text-xs rounded-full font-medium">
                          {t('skills.active')}
                        </span>
                        {skillStats && skillStats.total > 0 && (
                          <span className="px-2 py-0.5 bg-[#1A1A1A]/10 text-[#1A1A1A]/70 text-xs rounded-full font-mono">
                            {skillStats.total}×
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-[#1A1A1A]/80 mb-3">
                        {t(skill.descKey)}
                      </p>

                      {/* ── Inline stats row ── */}
                      {skillStats && skillStats.total > 0 && (
                        <div className="flex items-center gap-3 mb-3">
                          <div className="flex items-center gap-1 text-xs text-[#1A1A1A]/60">
                            <TrendingUp className="w-3 h-3 text-green-500" />
                            <span className="font-medium text-green-600">{skillStats.successRate}%</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-[#1A1A1A]/60">
                            <Timer className="w-3 h-3" />
                            <span>{formatDuration(skillStats.avgDuration)}</span>
                          </div>
                          <MiniSparkline data={skillStats.last7Days} color={skill.color} />
                          <button
                            onClick={() => toggleExpand(skill.id)}
                            className="ml-auto text-xs text-[#1A1A1A]/40 hover:text-[#1A1A1A]/70 flex items-center gap-0.5 transition-colors"
                          >
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      )}

                      {/* ── Expanded: recent executions ── */}
                      <AnimatePresence>
                        {isExpanded && skillStats && skillStats.recentExecutions.length > 0 && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="border-t border-[#1A1A1A]/10 pt-2 mb-3">
                              <div className="text-[10px] uppercase tracking-wider text-[#1A1A1A]/40 mb-1.5 font-semibold">
                                {t('skills.recent_history')}
                              </div>
                              <div className="space-y-1">
                                {skillStats.recentExecutions.map(exec => (
                                  <div key={exec.id} className="flex items-center gap-2 text-xs">
                                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${exec.success ? 'bg-green-500' : 'bg-red-400'}`} />
                                    <span className="text-[#1A1A1A]/70 font-mono truncate">{exec.method}</span>
                                    {exec.category && (
                                      <span className="text-[10px] text-[#1A1A1A]/40 truncate">{exec.category}</span>
                                    )}
                                    <TriggerBadge trigger={exec.trigger} t={t} />
                                    <span className="text-[#1A1A1A]/40 ml-auto flex-shrink-0">{formatDuration(exec.duration)}</span>
                                    <span className="text-[#1A1A1A]/30 flex-shrink-0">{formatTime(exec.createdAt)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Top categories for image skill */}
                            {Object.keys(skillStats.topCategories).length > 0 && (
                              <div className="border-t border-[#1A1A1A]/10 pt-2 mb-2">
                                <div className="flex flex-wrap gap-1">
                                  {Object.entries(skillStats.topCategories)
                                    .sort((a, b) => b[1] - a[1])
                                    .slice(0, 6)
                                    .map(([cat, count]) => (
                                      <span key={cat} className="px-1.5 py-0.5 bg-[#1A1A1A]/5 text-[#1A1A1A]/50 text-[10px] rounded">
                                        {cat} ({count})
                                      </span>
                                    ))}
                                </div>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="flex flex-wrap gap-1">
                        {skill.capKeys.map((capKey, i) => (
                          <span 
                            key={i}
                            className="px-2 py-0.5 bg-[#2D4A3E]/10 text-[#2D4A3E] text-xs rounded-full"
                          >
                            {t(capKey)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Custom Skills Created by JARVIS */}
      {mounted && customSkills.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-[#1A1A1A] mb-4 flex items-center gap-2">
            <Bot className="w-5 h-5 text-[#4A90D9]" />
            {t('skills.created_by_jarvis')}
            <span className="px-2 py-0.5 bg-[#4A90D9]/10 text-[#4A90D9] text-xs rounded-full">
              {customSkills.length}
            </span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customSkills.map((skill, index) => {
              const color = categoryColors[skill.category] || categoryColors.general
              const icon = categoryIcons[skill.category] || categoryIcons.general
              
              return (
                <motion.div
                  key={skill.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="h-full hover:shadow-lg transition-shadow">
                    <div className="flex items-start gap-4">
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${color}20` }}
                      >
                        <span style={{ color }}>{icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-[#1A1A1A] truncate">{skill.name}</h3>
                          <span className="px-2 py-0.5 bg-[#4A90D9]/10 text-[#4A90D9] text-xs rounded-full flex-shrink-0">
                            JARVIS
                          </span>
                        </div>
                        <p className="text-sm text-[#1A1A1A]/60 mb-3 line-clamp-2">
                          {skill.description}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-[#1A1A1A]/40">
                            {new Date(skill.createdAt).toLocaleDateString()}
                          </span>
                          <div className="flex gap-1">
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => setSelectedSkill(skill)}
                              className="h-7 px-2"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => deleteSkill(skill.id)}
                              className="h-7 px-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        </div>
      )}

      {/* Coming Soon Skills */}
      <div>
        <h2 className="text-lg font-bold text-[#1A1A1A] mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-[#C4622D]" />
          {t('skills.coming_soon')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {comingSkills.map((skill, index) => (
            <motion.div
              key={skill.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
            >
              <Card className="h-full border-dashed border-[#C4B99A]" style={{ backgroundColor: '#D5D0C7' }}>
                <div className="text-center">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
                    style={{ backgroundColor: `${skill.color}20` }}
                  >
                    <span style={{ color: skill.color }}>{skill.icon}</span>
                  </div>
                  <h3 className="font-bold text-sm mb-1" style={{ color: '#1A1A1A' }}>{skill.name}</h3>
                  <p className="text-xs" style={{ color: '#2A2A2A' }}>
                    {t(skill.descKey)}
                  </p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Skill Code Modal */}
      <AnimatePresence>
        {selectedSkill && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => { setSelectedSkill(null); setExecutionResult(null); setExecutionError(null); setExecutionInput('') }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${categoryColors[selectedSkill.category] || categoryColors.general}20` }}
                    >
                      <span style={{ color: categoryColors[selectedSkill.category] || categoryColors.general }}>
                        {categoryIcons[selectedSkill.category] || categoryIcons.general}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{selectedSkill.name}</h3>
                      <p className="text-sm text-[#1A1A1A]/60">{t('skills.created_by')} {selectedSkill.createdBy}</p>
                    </div>
                  </div>
                  <Button variant="ghost" onClick={() => setSelectedSkill(null)}>
                    ✕
                  </Button>
                </div>
              </div>
              <div className="p-6">
                <p className="text-sm text-[#1A1A1A]/70 mb-4">{selectedSkill.description}</p>
                <div className="bg-[#1A1A1A] rounded-xl p-4 overflow-auto max-h-[35vh]">
                  <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">
                    {selectedSkill.code}
                  </pre>
                </div>

                {/* Input opcional para la ejecución */}
                <div className="mt-4">
                  <label className="text-xs font-medium text-[#1A1A1A]/60 mb-1 block">Input para la ejecución (opcional)</label>
                  <textarea
                    value={executionInput}
                    onChange={(e) => setExecutionInput(e.target.value)}
                    placeholder="Ej: genera el email para el cliente Acme sobre la propuesta de marketing..."
                    rows={2}
                    className="w-full rounded-xl border border-[#1A1A1A]/10 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D4A3E]/30 resize-none"
                  />
                </div>

                {/* Resultado de la ejecución */}
                {executing && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-[#2D4A3E]">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Ejecutando skill con el motor de OCTOPUS...
                  </div>
                )}
                {executionError && (
                  <div className="mt-3 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                    ❌ {executionError}
                  </div>
                )}
                {executionResult && (
                  <div className="mt-3 rounded-xl bg-[#2D4A3E]/5 border border-[#2D4A3E]/20 p-4 overflow-auto max-h-[35vh]">
                    <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-[#2D4A3E]">
                      <CheckCircle className="w-4 h-4" /> Resultado de la ejecución
                    </div>
                    <pre className="text-sm text-[#1A1A1A]/80 whitespace-pre-wrap font-sans">{executionResult}</pre>
                  </div>
                )}
              </div>
              <div className="p-6 border-t bg-[#F5F5F5]">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#1A1A1A]/40">
                    {t('skills.category')}: {selectedSkill.category} • {t('skills.uses')}: {selectedSkill.usageCount}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => { setSelectedSkill(null); setExecutionResult(null); setExecutionError(null); setExecutionInput('') }}>
                      {t('skills.close')}
                    </Button>
                    <Button
                      className="bg-[#2D4A3E] hover:bg-[#2D4A3E]/90"
                      disabled={executing}
                      onClick={() => selectedSkill && executeSkill(selectedSkill, executionInput)}
                    >
                      {executing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                      {t('skills.execute')}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}