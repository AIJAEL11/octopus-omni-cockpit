'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ChevronLeft, Clock, Eye, Calendar, Share2, ArrowRight } from 'lucide-react'

interface Post {
  id: string
  title: string
  slug: string
  content: string
  keyword: string | null
  metaDescription: string | null
  excerpt: string | null
  coverImage: string | null
  category: string
  language: string
  author: string
  status: string
  readTime: number | null
  wordCount: number | null
  seriesId: string | null
  seriesPosition: number | null
  seriesTheme: string | null
  views: number
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

interface RelatedPost {
  title: string
  slug: string
  coverImage: string | null
  excerpt: string | null
  readTime: number | null
  publishedAt: string | null
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export function BlogArticleClient({ post, relatedPosts }: { post: Post; relatedPosts: RelatedPost[] }) {
  const handleShare = async () => {
    const url = `https://octopuskills.com/blog/${post.slug}`
    if (navigator.share) {
      try { await navigator.share({ title: post.title, url }) } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(url)
      alert('Link copied!')
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* Hero */}
      <header className="relative">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #0F1419 0%, #1A2332 50%, #2D4A3E 100%)' }} />
        <div className="relative max-w-4xl mx-auto px-4 py-12 sm:py-16">
          <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-emerald-400 hover:text-emerald-300 mb-6 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Back to Blog
          </Link>
          <div className="flex items-center gap-3 mb-4 text-sm text-slate-400">
            <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 font-semibold rounded-lg text-xs uppercase tracking-wider">
              {post.category.replace('-', ' ')}
            </span>
            {post.language !== 'en' && (
              <span className="px-2.5 py-1 bg-blue-500/20 text-blue-400 font-semibold rounded-lg text-xs uppercase">
                {post.language.toUpperCase()}
              </span>
            )}
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-6">
            {post.title}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
            <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {formatDate(post.publishedAt)}</span>
            {post.readTime && <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {post.readTime} min read</span>}
            <span className="flex items-center gap-1.5"><Eye className="w-4 h-4" /> {post.views} views</span>
            <span>By {post.author}</span>
            <button onClick={handleShare} className="ml-auto flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 transition">
              <Share2 className="w-4 h-4" /> Share
            </button>
          </div>
        </div>
      </header>

      {/* Cover Image */}
      {post.coverImage && (
        <div className="max-w-4xl mx-auto px-4 -mt-4 relative z-10">
          <div className="relative aspect-video rounded-2xl overflow-hidden shadow-2xl">
            <Image src={post.coverImage} alt={post.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 900px" priority />
          </div>
        </div>
      )}

      {/* Series Banner */}
      {post.seriesTheme && (
        <div className="max-w-4xl mx-auto px-4 mt-8">
          <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
            <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
              📚 Series: {post.seriesTheme} — Part {post.seriesPosition} of 3
            </p>
          </div>
        </div>
      )}

      {/* Article Content */}
      <article className="max-w-4xl mx-auto px-4 py-10 sm:py-14">
        <div
          className="prose prose-lg dark:prose-invert max-w-none
            prose-headings:font-bold prose-headings:tracking-tight
            prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
            prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
            prose-p:leading-relaxed prose-p:mb-4
            prose-a:text-emerald-600 dark:prose-a:text-emerald-400 prose-a:font-medium
            prose-strong:font-bold
            prose-ul:my-4 prose-ol:my-4
            prose-li:my-1
            prose-img:rounded-xl prose-img:shadow-lg"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />
      </article>

      {/* Related Articles */}
      {relatedPosts.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 pb-16">
          <h2 className="text-2xl font-bold mb-8" style={{ color: 'var(--text-primary)' }}>Related Articles</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {relatedPosts.map(rp => (
              <Link
                key={rp.slug}
                href={`/blog/${rp.slug}`}
                className="group rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
              >
                <div className="relative aspect-video bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  {rp.coverImage ? (
                    <Image src={rp.coverImage} alt={rp.title} fill className="object-cover transition-transform duration-500 group-hover:scale-105" sizes="(max-width: 768px) 100vw, 33vw" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center"><span className="text-3xl">🐙</span></div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold line-clamp-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" style={{ color: 'var(--text-primary)' }}>
                    {rp.title}
                  </h3>
                  <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {rp.readTime && <span><Clock className="w-3 h-3 inline mr-1" />{rp.readTime} min</span>}
                    <span>{formatDate(rp.publishedAt)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Bottom CTA */}
      <section className="py-16" style={{ background: 'linear-gradient(135deg, #2D4A3E, #1A2332)' }}>
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Ready to Automate Your Business with AI?
          </h2>
          <p className="text-slate-300 mb-8 text-lg">
            Octopus Skills puts the power of AI automation in your hands — no coding required.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/25"
          >
            Get Started Free <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      <footer className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)', background: 'var(--bg-primary)' }}>
        <p>© {new Date().getFullYear()} Octopus Skills. All rights reserved.</p>
      </footer>
    </div>
  )
}
