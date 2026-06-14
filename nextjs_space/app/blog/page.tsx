'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Search, Clock, Eye, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface BlogPost {
  id: string
  title: string
  slug: string
  excerpt: string | null
  metaDescription: string | null
  coverImage: string | null
  category: string
  language: string
  author: string
  readTime: number | null
  wordCount: number | null
  seriesTheme: string | null
  seriesPosition: number | null
  publishedAt: string | null
  views: number
}

const CATEGORIES = [
  { id: 'all', label: 'All Posts', emoji: '📚' },
  { id: 'ai-automation', label: 'AI Automation', emoji: '🤖' },
  { id: 'marketing', label: 'Marketing', emoji: '📣' },
  { id: 'productivity', label: 'Productivity', emoji: '⚡' },
  { id: 'no-code', label: 'No-Code', emoji: '🔧' },
  { id: 'case-studies', label: 'Case Studies', emoji: '📊' },
  { id: 'freelancers', label: 'Freelancers', emoji: '💼' },
]

function formatDate(dateStr: string | null) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (category !== 'all') params.set('category', category)
      params.set('page', page.toString())
      params.set('limit', '12')
      if (search) params.set('search', search)
      const res = await fetch(`/api/blog?${params}`)
      const data = await res.json()
      setPosts(data.posts || [])
      setTotal(data.total || 0)
      setTotalPages(data.totalPages || 1)
    } catch { setPosts([]) }
    setLoading(false)
  }, [category, page, search])

  useEffect(() => { fetchPosts() }, [fetchPosts])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  if (!mounted) return null

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* Hero Header */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #0F1419 0%, #1A2332 50%, #2D4A3E 100%)' }} />
        <div className="relative max-w-6xl mx-auto px-4 py-16 sm:py-24 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 mb-6 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Back to Octopus Skills
          </Link>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 tracking-tight">
            Octopus Skills <span className="text-emerald-400">Blog</span>
          </h1>
          <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto mb-8">
            AI automation strategies, no-code tools, and growth tactics for solopreneurs and small businesses.
          </p>
          {/* Search */}
          <form onSubmit={handleSearch} className="max-w-xl mx-auto flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search articles..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 backdrop-blur border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition"
              />
            </div>
            <button type="submit" className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-colors">
              Search
            </button>
          </form>
        </div>
      </header>

      {/* Categories */}
      <nav className="max-w-6xl mx-auto px-4 -mt-6 relative z-10">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => { setCategory(cat.id); setPage(1) }}
              className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                category === cat.id
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                  : 'bg-white/80 dark:bg-slate-800/80 backdrop-blur hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {cat.emoji} {cat.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Posts Grid */}
      <main className="max-w-6xl mx-auto px-4 py-12">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden animate-pulse" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
                <div className="aspect-video bg-slate-200 dark:bg-slate-700" />
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                  <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">🐙</p>
            <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>No articles yet</h3>
            <p style={{ color: 'var(--text-secondary)' }}>New content is coming soon — stay tuned!</p>
          </div>
        ) : (
          <>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
              {total} article{total !== 1 ? 's' : ''} found
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map(post => (
                <Link
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  className="group rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                  style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
                >
                  {/* Cover Image */}
                  <div className="relative aspect-video bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    {post.coverImage ? (
                      <Image
                        src={post.coverImage}
                        alt={post.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-4xl">🐙</span>
                      </div>
                    )}
                    {post.seriesTheme && (
                      <div className="absolute top-3 left-3 px-2.5 py-1 bg-blue-500/90 backdrop-blur text-white text-xs font-semibold rounded-lg">
                        📚 Series: Part {post.seriesPosition} of 3
                      </div>
                    )}
                  </div>
                  {/* Content */}
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        {CATEGORIES.find(c => c.id === post.category)?.emoji || '📝'} {post.category.replace('-', ' ')}
                      </span>
                    </div>
                    <h2 className="text-lg font-bold leading-snug mb-2 line-clamp-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" style={{ color: 'var(--text-primary)' }}>
                      {post.title}
                    </h2>
                    <p className="text-sm line-clamp-2 mb-4" style={{ color: 'var(--text-secondary)' }}>
                      {post.excerpt || post.metaDescription || ''}
                    </p>
                    <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                      <div className="flex items-center gap-3">
                        {post.readTime && (
                          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {post.readTime} min</span>
                        )}
                        <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {post.views}</span>
                      </div>
                      <span>{formatDate(post.publishedAt)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-12">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg disabled:opacity-30 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg disabled:opacity-30 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* CTA Section */}
      <section className="py-16" style={{ background: 'linear-gradient(135deg, #2D4A3E, #1A2332)' }}>
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Ready to Automate Your Business with AI?
          </h2>
          <p className="text-slate-300 mb-8 text-lg">
            Join thousands of solopreneurs using Octopus Skills to automate marketing, sales, and content creation.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40"
          >
            Explore Octopus Skills <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)', background: 'var(--bg-primary)' }}>
        <p>© {new Date().getFullYear()} Octopus Skills. All rights reserved.</p>
      </footer>
    </div>
  )
}
