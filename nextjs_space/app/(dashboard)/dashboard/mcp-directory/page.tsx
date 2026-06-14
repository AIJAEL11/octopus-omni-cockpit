'use client'

import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Star, ExternalLink, ArrowLeft, TrendingUp, Filter, Grid3X3, List, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { MCP_SERVERS, MCP_CATEGORIES, type MCPServer, type MCPCategory } from '@/lib/mcp-directory-data'
import { useI18n } from '@/lib/i18n-context'

const CATEGORY_ICONS: Record<string, string> = {
  'All': '\u{1F310}',
  'Developer Tools': '\u{1F6E0}\u{FE0F}',
  'API Development': '\u{1F50C}',
  'Database Management': '\u{1F5C4}\u{FE0F}',
  'Data Science & ML': '\u{1F9EA}',
  'Productivity & Workflow': '\u26A1',
  'Deployment & DevOps': '\u{1F680}',
  'Web Scraping & Data Collection': '\u{1F577}\u{FE0F}',
  'Collaboration Tools': '\u{1F91D}',
  'Other': '\u{1F4E6}',
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  'Developer Tools': { bg: 'bg-blue-500/10', text: 'text-blue-600' },
  'API Development': { bg: 'bg-purple-500/10', text: 'text-purple-600' },
  'Database Management': { bg: 'bg-emerald-500/10', text: 'text-emerald-600' },
  'Data Science & ML': { bg: 'bg-amber-500/10', text: 'text-amber-600' },
  'Productivity & Workflow': { bg: 'bg-orange-500/10', text: 'text-orange-600' },
  'Deployment & DevOps': { bg: 'bg-red-500/10', text: 'text-red-600' },
  'Web Scraping & Data Collection': { bg: 'bg-teal-500/10', text: 'text-teal-600' },
  'Collaboration Tools': { bg: 'bg-pink-500/10', text: 'text-pink-600' },
  'Other': { bg: 'bg-gray-500/10', text: 'text-gray-600' },
}

function formatStars(stars: number): string {
  if (stars >= 1000) return (stars / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return stars.toLocaleString()
}

type SortBy = 'stars' | 'name' | 'author'
type ViewMode = 'grid' | 'list'

export default function MCPDirectoryPage() {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<MCPCategory>('All')
  const [sortBy, setSortBy] = useState<SortBy>('stars')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [visibleCount, setVisibleCount] = useState(30)

  const filtered = useMemo(() => {
    let results = [...MCP_SERVERS]
    if (activeCategory !== 'All') {
      results = results.filter(s => s.category === activeCategory)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      results = results.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.author.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
      )
    }
    if (sortBy === 'stars') {
      results.sort((a, b) => b.stars - a.stars)
    } else if (sortBy === 'name') {
      results.sort((a, b) => a.name.localeCompare(b.name))
    } else {
      results.sort((a, b) => a.author.localeCompare(b.author))
    }
    return results
  }, [search, activeCategory, sortBy])

  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount])

  const loadMore = useCallback(() => {
    setVisibleCount(prev => prev + 30)
  }, [])

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: MCP_SERVERS.length }
    for (const s of MCP_SERVERS) {
      counts[s.category] = (counts[s.category] || 0) + 1
    }
    return counts
  }, [])

  const totalStars = useMemo(() => MCP_SERVERS.reduce((sum, s) => sum + s.stars, 0), [])

  return (
    <div className="space-y-6 max-w-7xl">
      <Link href="/dashboard">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('common.back')}
        </Button>
      </Link>

      {/* HERO HEADER */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1A1A1A] via-[#2D4A3E] to-[#1A1A1A] p-8 md:p-12">
        <div className="absolute inset-0 opacity-5">
          <div className="w-full h-full" style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)',
            backgroundSize: '24px 24px'
          }} />
        </div>
        <div className="relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl mb-4"
          >
            {'🐙'}
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-3xl md:text-4xl font-bold text-white mb-3"
          >
            {t('mcp_dir.title')}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-white/60 text-lg max-w-2xl mx-auto mb-6"
          >
            {t('mcp_dir.subtitle_prefix')} {MCP_SERVERS.length} {t('mcp_dir.subtitle_suffix')}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="max-w-xl mx-auto relative"
          >
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setVisibleCount(30) }}
              placeholder={t('mcp_dir.search_placeholder')}
              className="w-full bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl pl-12 pr-4 py-3.5 text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 focus:bg-white/15 transition-all"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex items-center justify-center gap-6 mt-6 text-sm text-white/40"
          >
            <span className="flex items-center gap-1.5">
              <Grid3X3 className="w-4 h-4" /> {MCP_SERVERS.length} {t('mcp_dir.servers')}
            </span>
            <span className="flex items-center gap-1.5">
              <Star className="w-4 h-4" /> {formatStars(totalStars)} {t('mcp_dir.total')}
            </span>
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4" /> {Object.keys(categoryCounts).length - 1} {t('mcp_dir.categories')}
            </span>
          </motion.div>
        </div>
      </div>

      {/* CATEGORY TABS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {MCP_CATEGORIES.map(cat => {
          const isActive = activeCategory === cat
          const count = categoryCounts[cat] || 0
          return (
            <button
              key={cat}
              onClick={() => { setActiveCategory(cat); setVisibleCount(30) }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-[#2D4A3E] text-white shadow-md'
                  : 'bg-[#F5F0E8] text-[#1A1A1A]/60 hover:bg-[#2D4A3E]/10 hover:text-[#1A1A1A]'
              }`}
            >
              <span>{CATEGORY_ICONS[cat] || '\u{1F4E6}'}</span>
              <span>{cat === 'All' ? t('mcp_dir.all') : cat}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                isActive ? 'bg-white/20 text-white' : 'bg-[#2D4A3E]/10 text-[#1A1A1A]/40'
              }`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* TOOLBAR */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#1A1A1A]/50">
          {filtered.length === MCP_SERVERS.length
            ? `${t('mcp_dir.showing_prefix')} ${Math.min(visibleCount, filtered.length)} ${t('mcp_dir.showing_of')} ${filtered.length} ${t('mcp_dir.servers')}`
            : `${filtered.length} ${filtered.length !== 1 ? t('mcp_dir.results') : t('mcp_dir.result')}`}
        </p>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-[#F5F0E8] rounded-lg p-1">
            <Filter className="w-3.5 h-3.5 text-[#1A1A1A]/40 ml-1.5" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="bg-transparent text-xs text-[#1A1A1A]/60 focus:outline-none cursor-pointer pr-1"
            >
              <option value="stars">{t('mcp_dir.sort_popular')}</option>
              <option value="name">{t('mcp_dir.sort_name')}</option>
              <option value="author">{t('mcp_dir.sort_author')}</option>
            </select>
          </div>
          <div className="flex items-center bg-[#F5F0E8] rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm' : ''}`}
            >
              <Grid3X3 className="w-4 h-4 text-[#1A1A1A]/60" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm' : ''}`}
            >
              <List className="w-4 h-4 text-[#1A1A1A]/60" />
            </button>
          </div>
        </div>
      </div>

      {/* SERVER GRID / LIST */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">{'🔍'}</div>
          <p className="text-[#1A1A1A]/50 text-lg">{t('mcp_dir.no_results') || 'No MCP servers found'}</p>
          <p className="text-[#1A1A1A]/30 text-sm mt-1">{t('mcp_dir.try_another') || 'Try another search or category'}</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {visible.map((server, idx) => (
              <MCPServerCard key={`${server.name}-${server.author}`} server={server} index={idx} />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {visible.map((server, idx) => (
              <MCPServerRow key={`${server.name}-${server.author}`} server={server} index={idx} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {visibleCount < filtered.length && (
        <div className="flex justify-center pt-4 pb-8">
          <Button onClick={loadMore} variant="outline" size="sm">
            {t('mcp_dir.load_more')} ({Math.min(30, filtered.length - visibleCount)})
          </Button>
        </div>
      )}
    </div>
  )
}

function MCPServerCard({ server, index }: { server: MCPServer; index: number }) {
  const colors = CATEGORY_COLORS[server.category] || CATEGORY_COLORS['Other']
  const mcpUrl = `https://mcpmarket.com/server/${encodeURIComponent(server.name.toLowerCase().replace(/\s+/g, '-'))}`

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: Math.min(index * 0.02, 0.3) }}
    >
      <a
        href={mcpUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block group"
      >
        <Card className="p-5 h-full hover:shadow-lg hover:border-[#2D4A3E]/20 transition-all duration-300 group-hover:-translate-y-0.5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2D4A3E] to-[#1A1A1A] flex items-center justify-center text-white text-xs font-bold shrink-0">
                {server.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm text-[#1A1A1A] truncate font-mono group-hover:text-[#C4622D] transition-colors">
                  {server.name}
                </h3>
                <p className="text-[10px] text-[#1A1A1A]/40 truncate">{server.author}</p>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-[#1A1A1A]/20 group-hover:text-[#C4622D] transition-colors shrink-0 mt-1" />
          </div>

          <p className="text-xs text-[#1A1A1A]/60 leading-relaxed line-clamp-2 mb-4">
            {server.description}
          </p>

          <div className="flex items-center justify-between mt-auto">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${colors.bg} ${colors.text}`}>
              {server.category}
            </span>
            <span className="flex items-center gap-1 text-xs text-[#1A1A1A]/40">
              <Star className="w-3 h-3" />
              {formatStars(server.stars)}
            </span>
          </div>
        </Card>
      </a>
    </motion.div>
  )
}

function MCPServerRow({ server, index }: { server: MCPServer; index: number }) {
  const colors = CATEGORY_COLORS[server.category] || CATEGORY_COLORS['Other']
  const mcpUrl = `https://mcpmarket.com/server/${encodeURIComponent(server.name.toLowerCase().replace(/\s+/g, '-'))}`

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={{ delay: Math.min(index * 0.015, 0.2) }}
    >
      <a
        href={mcpUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-4 p-3.5 rounded-xl border border-[#2D4A3E]/5 hover:border-[#2D4A3E]/15 hover:bg-[#F5F0E8]/50 transition-all group"
      >
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#2D4A3E] to-[#1A1A1A] flex items-center justify-center text-white text-xs font-bold shrink-0">
          {server.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-[#1A1A1A] font-mono group-hover:text-[#C4622D] transition-colors truncate">
              {server.name}
            </h3>
            <span className="text-[10px] text-[#1A1A1A]/30">by {server.author}</span>
          </div>
          <p className="text-xs text-[#1A1A1A]/50 truncate">{server.description}</p>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${colors.bg} ${colors.text}`}>
          {server.category}
        </span>
        <span className="flex items-center gap-1 text-xs text-[#1A1A1A]/40 whitespace-nowrap">
          <Star className="w-3 h-3" />
          {formatStars(server.stars)}
        </span>
        <ChevronRight className="w-4 h-4 text-[#1A1A1A]/20 group-hover:text-[#C4622D] shrink-0" />
      </a>
    </motion.div>
  )
}