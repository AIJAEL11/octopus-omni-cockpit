'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { LazyMotion, domAnimation, m } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { useI18n } from '@/lib/i18n-context'
import {
  Zap,
  Brain,
  Palette,
  Bot,
  ArrowRight,
  Sparkles,
  Globe,
  MessageSquare,
  ImageIcon,
  Video,
  PenTool,
  Rocket,
  Shield,
  ChevronRight,
  TrendingUp,
  Target,
  Mail,
  BarChart3,
  Users,
  Search,
  Home,
  Volume2,
  VolumeX,
  Mic,
  Megaphone,
  Share2,
  CalendarDays,
  Cpu,
  Code2,
  Server,
  Star,
  Quote,
  Play,
  CheckCircle2,
  Loader2,
  ChevronDown,
  HelpCircle,
  Clock,
  Eye,
  BookOpen,
} from 'lucide-react'
import { ShowcaseSection } from './showcase-section'

const featureDefs = [
  { icon: TrendingUp, titleKey: 'feat.growth', descKey: 'feat.growth_desc', color: '#C4622D', badgeKey: 'common.new' },
  { icon: Palette, titleKey: 'feat.creative', descKey: 'feat.creative_desc', color: '#4A90D9' },
  { icon: Mic, titleKey: 'feat.voiceAgent', descKey: 'feat.voiceAgent_desc', color: '#8B5CF6', badgeKey: 'common.new' },
  { icon: Megaphone, titleKey: 'feat.adFactory', descKey: 'feat.adFactory_desc', color: '#F59E0B', badgeKey: 'common.new' },
  { icon: Bot, titleKey: 'feat.salesAgent', descKey: 'feat.salesAgent_desc', color: '#0EA5E9', badgeKey: 'common.new' },
  { icon: Brain, titleKey: 'feat.octopus', descKey: 'feat.octopus_desc', color: '#2D4A3E' },
  { icon: Share2, titleKey: 'feat.socialBridge', descKey: 'feat.socialBridge_desc', color: '#EC4899', badgeKey: 'common.new' },
  { icon: CalendarDays, titleKey: 'feat.calendar', descKey: 'feat.calendar_desc', color: '#10B981' },
  { icon: Home, titleKey: 'feat.smarthome', descKey: 'feat.smarthome_desc', color: '#2D8A6E', badgeKey: 'common.new' },
  { icon: Cpu, titleKey: 'feat.brazos', descKey: 'feat.brazos_desc', color: '#4A90D9' },
  { icon: Code2, titleKey: 'feat.codeEngine', descKey: 'feat.codeEngine_desc', color: '#6366F1', badgeKey: 'common.new' },
  { icon: Server, titleKey: 'feat.ollama', descKey: 'feat.ollama_desc', color: '#94A3B8', badgeKey: 'common.new' },
]

const growthFeatureDefs = [
  { icon: Search, textKey: 'gf.prospect' },
  { icon: Target, textKey: 'gf.scoring' },
  { icon: Mail, textKey: 'gf.outreach' },
  { icon: BarChart3, textKey: 'gf.dashboard' },
  { icon: Users, textKey: 'gf.crm' },
  { icon: TrendingUp, textKey: 'gf.strategies' },
]

const capabilityDefs = [
  { icon: ImageIcon, textKey: 'cap.images' },
  { icon: Video, textKey: 'cap.video' },
  { icon: PenTool, textKey: 'cap.copy' },
  { icon: MessageSquare, textKey: 'cap.telegram' },
  { icon: Globe, textKey: 'cap.search' },
  { icon: Shield, textKey: 'cap.docs' },
]

/* ── Animation Variants ── */
const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
}
const fadeInLeft = {
  initial: { opacity: 0, x: -40 },
  animate: { opacity: 1, x: 0 },
}
const fadeInRight = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0 },
}
const fadeInScale = {
  initial: { opacity: 0, scale: 0.85 },
  animate: { opacity: 1, scale: 1 },
}
const staggerContainer = {
  initial: {},
  animate: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
}
const staggerItem = {
  initial: { opacity: 0, y: 25 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
}
const staggerItemLeft = {
  initial: { opacity: 0, x: -30 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
}
const staggerItemRight = {
  initial: { opacity: 0, x: 30 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
}

/* ============================================ */
/* FAQ Sub-component                            */
/* ============================================ */
const FAQ_ITEMS = [
  {
    qEs: '¿Qué es OCTOPUS Omni Cockpit?',
    qEn: 'What is OCTOPUS Omni Cockpit?',
    aEs: 'Es una plataforma SaaS todo-en-uno que combina IA generativa, automatización de marketing, CRM inteligente y herramientas creativas en un solo cockpit. Diseñada para solopreneurs, agencias y equipos que quieren escalar sin multiplicar herramientas.',
    aEn: 'It\'s an all-in-one SaaS platform that combines generative AI, marketing automation, smart CRM, and creative tools in a single cockpit. Built for solopreneurs, agencies, and teams who want to scale without multiplying tools.',
  },
  {
    qEs: '¿Necesito conocimientos técnicos para usar la plataforma?',
    qEn: 'Do I need technical knowledge to use the platform?',
    aEs: 'No. OCTOPUS está diseñado para ser intuitivo y no-code. Nuestro asistente de IA te guía paso a paso. Si sabes usar redes sociales, puedes usar OCTOPUS.',
    aEn: 'No. OCTOPUS is designed to be intuitive and no-code. Our AI assistant guides you step by step. If you can use social media, you can use OCTOPUS.',
  },
  {
    qEs: '¿Puedo probar gratis antes de pagar?',
    qEn: 'Can I try it for free before paying?',
    aEs: 'Sí. Ofrecemos un plan gratuito con acceso a las funciones principales. No necesitas tarjeta de crédito para comenzar. Puedes actualizar a Pro cuando estés listo.',
    aEn: 'Yes. We offer a free plan with access to core features. No credit card needed to start. You can upgrade to Pro when you\'re ready.',
  },
  {
    qEs: '¿Qué herramientas incluye la plataforma?',
    qEn: 'What tools does the platform include?',
    aEs: 'Incluye Growth Engine (campañas & leads), Ad Factory (generación de anuncios con IA), Voice Agents, Sales Agents, Code Engine, Motion Graphics Studio, Social Bridge, CRM integrado con HubSpot, y más de 15 módulos especializados.',
    aEn: 'It includes Growth Engine (campaigns & leads), Ad Factory (AI ad generation), Voice Agents, Sales Agents, Code Engine, Motion Graphics Studio, Social Bridge, HubSpot-integrated CRM, and 15+ specialized modules.',
  },
  {
    qEs: '¿Mis datos están seguros?',
    qEn: 'Is my data secure?',
    aEs: 'Absolutamente. Usamos encriptación AES-256, servidores AWS seguros, y cumplimos con las regulaciones GDPR y CCPA. Tu información nunca se comparte con terceros.',
    aEn: 'Absolutely. We use AES-256 encryption, secure AWS servers, and comply with GDPR and CCPA regulations. Your data is never shared with third parties.',
  },
  {
    qEs: '¿Puedo cancelar en cualquier momento?',
    qEn: 'Can I cancel at any time?',
    aEs: 'Sí, puedes cancelar tu suscripción en cualquier momento sin penalidades. Tus datos se mantienen disponibles por 30 días después de cancelar.',
    aEn: 'Yes, you can cancel your subscription at any time without penalties. Your data remains available for 30 days after cancellation.',
  },
]

function FAQSection({ es }: { es: boolean }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section className="py-20 sm:py-28 text-white relative z-20" style={{ background: 'linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 50%, rgba(45,74,62,0.15) 100%)' }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <m.div
          className="text-center mb-14"
          {...fadeInUp}
          whileInView="animate"
          initial="initial"
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FFD700]/10 border border-[#FFD700]/20 text-[#FFD700] text-xs font-semibold mb-6 tracking-wide uppercase">
            <HelpCircle className="w-3.5 h-3.5" />
            FAQ
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white">
            {es ? 'Preguntas ' : 'Frequently Asked '}
            <span className="bg-gradient-to-r from-[#FFD700] to-[#C4622D] bg-clip-text text-transparent">
              {es ? 'Frecuentes' : 'Questions'}
            </span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-white/60 max-w-2xl mx-auto leading-relaxed">
            {es ? 'Todo lo que necesitas saber sobre OCTOPUS' : 'Everything you need to know about OCTOPUS'}
          </p>
        </m.div>
        <m.div
          className="space-y-3"
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, amount: 0.15 }}
        >
          {FAQ_ITEMS.map((item, i) => (
            <m.div
              key={i}
              variants={staggerItem}
              className={`rounded-xl border transition-all duration-300 ${
                openIndex === i
                  ? 'border-[#FFD700]/30 bg-[#FFD700]/[0.04]'
                  : 'border-white/[0.06] bg-white/[0.02] hover:border-white/10'
              }`}
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-5 text-left gap-4"
              >
                <span className="text-base sm:text-lg font-semibold text-white/90">
                  {es ? item.qEs : item.qEn}
                </span>
                <ChevronDown
                  className={`w-5 h-5 text-[#FFD700] shrink-0 transition-transform duration-300 ${
                    openIndex === i ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ${
                  openIndex === i ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <p className="px-6 pb-5 text-sm sm:text-base text-white/60 leading-relaxed">
                  {es ? item.aEs : item.aEn}
                </p>
              </div>
            </m.div>
          ))}
        </m.div>
      </div>
    </section>
  )
}

/* ============================================ */
/* Blog Preview Sub-component                   */
/* ============================================ */
interface BlogPost {
  id: string
  title: string
  slug: string
  excerpt: string | null
  coverImage: string | null
  category: string | null
  readTime: number | null
  views: number | null
  publishedAt: string | null
}

function BlogPreviewSection({ es }: { es: boolean }) {
  const [posts, setPosts] = useState<BlogPost[]>([])

  useEffect(() => {
    fetch('/api/blog?limit=3&lang=en')
      .then(r => r.json())
      .then(d => { if (d.posts?.length) setPosts(d.posts.slice(0, 3)) })
      .catch(() => {})
  }, [])

  if (!posts.length) return null

  return (
    <section className="py-20 sm:py-28 text-white relative z-20" style={{ background: 'linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <m.div
          className="text-center mb-14"
          {...fadeInUp}
          whileInView="animate"
          initial="initial"
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-6 tracking-wide uppercase">
            <BookOpen className="w-3.5 h-3.5" />
            Blog
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white">
            {es ? 'Últimos ' : 'Latest '}
            <span className="bg-gradient-to-r from-emerald-400 to-[#2D4A3E] bg-clip-text text-transparent">
              {es ? 'Artículos' : 'Articles'}
            </span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-white/60 max-w-2xl mx-auto leading-relaxed">
            {es ? 'Estrategias, tutoriales y tendencias en IA y automatización' : 'Strategies, tutorials, and trends in AI and automation'}
          </p>
        </m.div>
        <m.div
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, amount: 0.15 }}
        >
          {posts.map((post, postIdx) => (
            <m.div
              key={post.id}
              variants={postIdx === 0 ? staggerItemLeft : postIdx === 2 ? staggerItemRight : staggerItem}
              whileHover={{ y: -8, transition: { duration: 0.25 } }}
            >
            <Link
              href={`/blog/${post.slug}`}
              className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-emerald-500/30 hover:bg-emerald-500/[0.04] transition-all duration-300 overflow-hidden flex flex-col h-full"
            >
              {post.coverImage && (
                <div className="relative aspect-[16/9] bg-white/5">
                  <Image
                    src={post.coverImage}
                    alt={post.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
              )}
              <div className="p-5 flex flex-col flex-1">
                {post.category && (
                  <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">
                    🐙 {post.category.replace(/-/g, ' ')}
                  </span>
                )}
                <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors line-clamp-2 mb-2">
                  {post.title}
                </h3>
                <p className="text-sm text-white/50 line-clamp-2 flex-1">
                  {post.excerpt || ''}
                </p>
                <div className="flex items-center gap-4 mt-4 text-xs text-white/40">
                  {post.readTime && (
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{post.readTime} min</span>
                  )}
                  {typeof post.views === 'number' && (
                    <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{post.views}</span>
                  )}
                  {post.publishedAt && (
                    <span>{new Date(post.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  )}
                </div>
              </div>
            </Link>
            </m.div>
          ))}
        </m.div>
        <m.div
          className="text-center mt-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
        >
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all text-sm font-semibold"
          >
            {es ? 'Ver todos los artículos' : 'View all articles'}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </m.div>
      </div>
    </section>
  )
}

/* ============================================ */
/* Testimonials Sub-component                  */
/* ============================================ */
function TestimonialsSection({ es }: { es: boolean }) {
  const [reviews, setReviews] = useState<Array<{ id: string; rating: number; comment: string; displayName: string; plan: string; createdAt: string }>>([])
  const [stats, setStats] = useState<{ averageRating: number; totalReviews: number } | null>(null)

  useEffect(() => {
    fetch('/api/reviews/public')
      .then(r => r.json())
      .then(data => {
        if (data.reviews) setReviews(data.reviews)
        if (data.aggregate) setStats({ averageRating: data.aggregate.avgRating, totalReviews: data.aggregate.totalReviews })
      })
      .catch(() => {})
  }, [])

  if (reviews.length === 0) return null

  const planLabels: Record<string, string> = { free: 'Free', starter: 'Starter', business: 'Business', enterprise: 'Enterprise' }

  return (
    <>
      {/* Schema.org structured data */}
      {stats && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'OCTOPUS Omni Cockpit',
              applicationCategory: 'BusinessApplication',
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: stats.averageRating.toFixed(1),
                bestRating: '5',
                worstRating: '1',
                ratingCount: stats.totalReviews,
              },
              review: reviews.map(r => ({
                '@type': 'Review',
                author: { '@type': 'Person', name: r.displayName },
                reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
                reviewBody: r.comment,
                datePublished: r.createdAt.split('T')[0],
              })),
            }),
          }}
        />
      )}
      <section className="py-20 sm:py-28 text-white relative z-20" style={{ background: 'linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-elevated) 50%, rgba(45,74,62,0.12) 100%)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <m.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 bg-[#FFD700]/10 border border-[#FFD700]/20 rounded-full px-4 py-1.5 mb-6">
              <Star className="w-4 h-4 text-[#FFD700]" />
              <span className="text-sm text-[#FFD700] font-medium">{es ? 'Opiniones de usuarios' : 'User Reviews'}</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 text-white">
              {es ? 'Lo que dicen nuestros' : 'What our'}{' '}
              <span className="text-[#FFD700]">{es ? 'usuarios' : 'users say'}</span>
            </h2>
            {stats && (
              <div className="flex items-center justify-center gap-3 mt-4">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Star key={i} className={`w-5 h-5 ${i <= Math.round(stats.averageRating) ? 'text-[#FFD700] fill-[#FFD700]' : 'text-white/20'}`} />
                  ))}
                </div>
                <span className="text-lg font-semibold text-white">{stats.averageRating.toFixed(1)}</span>
                <span className="text-white/50">({stats.totalReviews} {es ? 'opiniones' : 'reviews'})</span>
              </div>
            )}
          </m.div>

          <m.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, amount: 0.1 }}
          >
            {reviews.slice(0, 6).map((review, idx) => (
              <m.div
                key={review.id}
                variants={idx % 3 === 0 ? staggerItemLeft : idx % 3 === 2 ? staggerItemRight : staggerItem}
                whileHover={{ y: -5, scale: 1.02, transition: { duration: 0.2 } }}
                className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-[#FFD700]/30 transition-all"
              >
                <div className="flex items-center gap-1 mb-3">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Star key={i} className={`w-4 h-4 ${i <= review.rating ? 'text-[#FFD700] fill-[#FFD700]' : 'text-white/20'}`} />
                  ))}
                </div>
                <div className="relative mb-4">
                  <Quote className="w-6 h-6 text-[#FFD700]/20 absolute -top-1 -left-1" />
                  <p className="text-white/80 text-sm leading-relaxed pl-5 line-clamp-4">{review.comment}</p>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-white/10">
                  <span className="text-white/60 text-sm font-medium">{review.displayName}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#C4622D]/20 text-[#C4622D] font-medium">
                    {planLabels[review.plan] || review.plan}
                  </span>
                </div>
              </m.div>
            ))}
          </m.div>
        </div>
      </section>
    </>
  )
}

/* ============================================ */
/* LeadCapture Sub-component                    */
/* ============================================ */
function LeadCapture({ t, variant = 'hero' }: { t: (k: string) => string; variant?: 'hero' | 'cta' }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'exists' | 'captured' | 'error'>('idle')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (status === 'loading') return

    // No email? Go directly to signup
    if (!email.trim()) {
      router.push('/login')
      return
    }
    if (!email.includes('@')) return

    setStatus('loading')
    try {
      // Extract UTM from URL
      const params = new URLSearchParams(window.location.search)
      const res = await fetch('/api/leads/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          source: variant,
          utmSource: params.get('utm_source'),
          utmMedium: params.get('utm_medium'),
          utmCampaign: params.get('utm_campaign'),
        }),
      })
      const data = await res.json()

      if (data.message === 'already_registered') {
        setStatus('exists')
        setTimeout(() => router.push('/login'), 1500)
      } else if (data.message === 'already_captured') {
        setStatus('captured')
      } else if (data.success) {
        setStatus('success')
        setTimeout(() => router.push(data.redirect || `/login?email=${encodeURIComponent(email.trim())}`), 1800)
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }, [email, status, variant, router])

  const isHero = variant === 'hero'
  const showFeedback = status !== 'idle' && status !== 'loading'

  return (
    <div className="w-full max-w-xl mx-auto">
      <form onSubmit={handleSubmit} className="relative">
        <div className={`flex flex-col sm:flex-row gap-3 ${isHero ? '' : 'justify-center'}`}>
          <div className="relative flex-1">
            <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${isHero ? 'text-[#FFD700]/60' : 'text-[#FFD700]/60'}`} />
            <input
              ref={inputRef}
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); if (showFeedback) setStatus('idle') }}
              placeholder={t('landing.hero_email_placeholder')}
              className={`w-full pl-12 pr-4 py-4 sm:py-5 rounded-2xl text-base sm:text-lg font-medium transition-all duration-300 outline-none
                ${isHero
                  ? 'bg-[#1A2332]/80 backdrop-blur-xl text-white placeholder-white/40 border-2 border-[#FFD700]/20 focus:border-[#FFD700]/60 focus:shadow-[0_0_30px_rgba(255,215,0,0.15)]'
                  : 'bg-white/10 backdrop-blur-xl text-white placeholder-white/40 border-2 border-[#FFD700]/20 focus:border-[#FFD700]/60 focus:shadow-[0_0_30px_rgba(255,215,0,0.15)]'
                }`}
              disabled={status === 'loading'}
            />
          </div>
          <button
            type="submit"
            disabled={status === 'loading'}
            className={`group relative px-6 sm:px-8 py-4 sm:py-5 rounded-2xl font-bold text-base sm:text-lg transition-all duration-300 overflow-hidden whitespace-nowrap
              ${status === 'loading'
                ? 'bg-[#FFD700]/50 cursor-wait text-[#0a1628]'
                : 'bg-gradient-to-r from-[#FFD700] to-[#F0C030] text-[#0a1628] hover:shadow-[0_8px_40px_rgba(255,215,0,0.4)] hover:scale-[1.02] active:scale-[0.98]'
              }`}
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              {status === 'loading' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {t('landing.hero_email_cta')}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </span>
            {/* Shimmer effect on hover */}
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          </button>
        </div>
      </form>

      {/* Feedback messages */}
      {showFeedback && (
        <m.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mt-3 flex items-center justify-center gap-2 text-sm font-medium ${
            status === 'success' || status === 'captured' ? 'text-emerald-400' :
            status === 'exists' ? 'text-[#FFD700]' :
            'text-red-400'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          {t(`landing.hero_email_${status}`)}
        </m.div>
      )}

      {/* Trust hint */}
      {!showFeedback && (
        <p className={`mt-3 text-center text-sm ${isHero ? 'text-white/40' : 'text-white/40'}`}>
          {t('landing.hero_email_hint')}
        </p>
      )}
    </div>
  )
}

/* ============================================ */
/* MacBook Video Mockup Sub-component           */
/* ============================================ */
/**
 * SHOWCASE VIDEOS — cycles through 4 clips inside the MacBook mockup.
 * When a clip ends, automatically advances to the next (with looping from #4 → #1).
 * Users can jump between them by clicking the pagination chips below.
 */
const SHOWCASE_VIDEOS: { src: string; title: string; emoji: string }[] = [
  { src: '/videos/octopus-hero-v2.mp4',    title: 'Brand Story',   emoji: '🐙' },
  { src: '/videos/octopus-showcase-01.mp4', title: 'Lead-to-Asset', emoji: '⚡' },
  { src: '/videos/octopus-showcase-02.mp4', title: 'Agents Swarm',  emoji: '🤖' },
  { src: '/videos/octopus-showcase-03.mp4', title: 'Autonomous',    emoji: '🚀' },
]

function MacBookVideo({ t }: { t: (k: string) => string }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [videoFailed, setVideoFailed] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [hasInteracted, setHasInteracted] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const currentVideo = SHOWCASE_VIDEOS[currentIndex]

  // Aggressive autoplay: attempt on mount + on any visibility change + whenever index changes
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const tryPlay = () => {
      v.play().catch(() => {/* muted autoplay should work; fallback to user click */})
    }
    tryPlay()
    const onVis = () => { if (!document.hidden) tryPlay() }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [currentIndex])

  // When current clip ends → advance to the next
  const handleEnded = useCallback(() => {
    setCurrentIndex(prev => (prev + 1) % SHOWCASE_VIDEOS.length)
  }, [])

  const handlePlayClick = useCallback(() => {
    if (!videoRef.current) return
    setHasInteracted(true)
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {})
    } else {
      videoRef.current.pause()
    }
  }, [])

  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (!videoRef.current) return
    const newMuted = !videoRef.current.muted
    videoRef.current.muted = newMuted
    setIsMuted(newMuted)
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {})
    }
  }, [])

  const selectVideo = useCallback((idx: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setHasInteracted(true)
    setCurrentIndex(idx)
  }, [])

  return (
    <m.div
      initial={{ opacity: 0, y: 60 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, delay: 1.2 }}
      className="w-full max-w-5xl mx-auto px-4 sm:px-6"
    >
      {/* Badge above video */}
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="flex items-center justify-center gap-2 mb-6"
      >
        <div className="flex items-center gap-2 px-4 py-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full">
          <Play className="w-4 h-4 text-[#FFD700]" />
          <span className="text-sm text-white/60 font-medium">{t('landing.video_badge')}</span>
        </div>
      </m.div>

      {/* MacBook Frame with Golden Glow */}
      <div className="relative">
        {/* Golden glow halo — layered behind frame for depth */}
        <div
          aria-hidden="true"
          className="absolute -inset-6 sm:-inset-10 rounded-[32px] pointer-events-none opacity-80"
          style={{
            background:
              'radial-gradient(60% 55% at 50% 45%, rgba(255,215,0,0.28) 0%, rgba(255,215,0,0.12) 40%, rgba(196,98,45,0.08) 65%, transparent 80%)',
            filter: 'blur(24px)',
          }}
        />

        {/* Screen bezel */}
        <div
          className="relative bg-[#1a1a1a] rounded-t-[16px] sm:rounded-t-[20px] p-[6px] sm:p-[10px]"
          style={{
            boxShadow:
              '0 0 0 1px rgba(255,215,0,0.25), 0 0 40px rgba(255,215,0,0.18), 0 20px 80px rgba(255,215,0,0.15), 0 -10px 60px rgba(255,215,0,0.12)',
          }}
        >
          {/* Camera notch */}
          <div className="absolute top-[2px] sm:top-[3px] left-1/2 -translate-x-1/2 w-3 h-3 sm:w-4 sm:h-4 bg-[#2a2a2a] rounded-full flex items-center justify-center z-10">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full" style={{ background: 'var(--bg-primary)' }} />
          </div>

          {/* Screen */}
          <div
            className="relative aspect-video rounded-[8px] sm:rounded-[12px] overflow-hidden cursor-pointer group" style={{ background: 'var(--bg-primary)' }}
            onClick={handlePlayClick}
          >
            {!videoFailed ? (
              <>
                {/* Key on src forces React to remount → guarantees autoplay of new clip */}
                <video
                  key={currentVideo.src}
                  ref={videoRef}
                  src={currentVideo.src}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                  autoPlay
                  preload="auto"
                  // @ts-expect-error fetchpriority is valid HTML5 but not in React TS types yet
                  fetchpriority={currentIndex === 0 ? 'high' : 'auto'}
                  onError={() => setVideoFailed(true)}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={handleEnded}
                />

                {/* Clip title overlay — top-left */}
                <m.div
                  key={`label-${currentIndex}`}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="absolute top-3 left-3 sm:top-4 sm:left-4 z-20 flex items-center gap-2 px-3 py-1.5 bg-black/55 backdrop-blur-sm rounded-full border border-white/10 shadow-lg pointer-events-none"
                >
                  <span className="text-base">{currentVideo.emoji}</span>
                  <span className="text-[11px] sm:text-xs font-semibold text-white/90 tracking-wide">
                    {currentVideo.title}
                  </span>
                  <span className="text-[10px] text-[#FFD700]/80 font-mono ml-1">
                    {String(currentIndex + 1).padStart(2, '0')}/{String(SHOWCASE_VIDEOS.length).padStart(2, '0')}
                  </span>
                </m.div>

                {/* Mute/Unmute button — always visible so user can hear audio */}
                <button
                  onClick={toggleMute}
                  className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-20 w-10 h-10 sm:w-11 sm:h-11 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-black/80 transition-all hover:scale-110 border border-white/15 shadow-lg"
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? (
                    <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 text-white/90" />
                  ) : (
                    <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-[#FFD700]" />
                  )}
                </button>
                {/* Subtle "click para sonido" hint */}
                {isMuted && !hasInteracted && (
                  <m.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 2, duration: 0.4 }}
                    className="absolute bottom-14 sm:bottom-16 right-3 sm:right-4 z-20 text-[10px] sm:text-xs text-white/70 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/10 pointer-events-none"
                  >
                    🔊 Click para sonido
                  </m.div>
                )}
                {/* Pause indicator — only shown if user explicitly paused */}
                {!isPlaying && hasInteracted && (
                  <div className="absolute inset-0 flex items-center justify-center transition-colors" style={{ background: 'rgba(15,20,25,0.6)' }}>
                    <m.div
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-[#FFD700] to-[#C4622D] rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(255,215,0,0.3)]"
                    >
                      <Play className="w-7 h-7 sm:w-9 sm:h-9 text-[#0a1628] ml-1" fill="#0a1628" />
                    </m.div>
                  </div>
                )}
              </>
            ) : (
              /* Fallback: elegant placeholder if video fails to load */
              <div className="absolute inset-0 bg-gradient-to-br from-[#0C1222] via-[#162035] to-[#0C1222] flex flex-col items-center justify-center">
                <div className="w-20 h-20 bg-gradient-to-br from-[#FFD700]/20 to-[#C4622D]/20 rounded-3xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Video className="w-10 h-10 text-[#FFD700]/60" />
                </div>
                <p className="text-white/30 text-sm font-medium">Video Demo Coming Soon</p>
              </div>
            )}
          </div>
        </div>

        {/* MacBook base/keyboard */}
        <div className="relative h-3 sm:h-4 bg-gradient-to-b from-[#2a2a2a] to-[#1a1a1a] rounded-b-lg mx-[2%]" />
        <div className="relative h-1.5 sm:h-2 bg-gradient-to-b from-[#3a3a3a] to-[#2a2a2a] rounded-b-xl mx-[8%]" />

        {/* Extra glow accents — bottom bloom */}
        <div
          aria-hidden="true"
          className="absolute -inset-x-6 -bottom-16 h-24 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 55% 100% at 50% 0%, rgba(255,215,0,0.18) 0%, rgba(196,98,45,0.08) 50%, transparent 80%)',
            filter: 'blur(20px)',
          }}
        />
      </div>

      {/* Pagination chips — one per showcase clip */}
      <div className="mt-10 sm:mt-12 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        {SHOWCASE_VIDEOS.map((v, idx) => {
          const isActive = idx === currentIndex
          return (
            <m.button
              key={v.src}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={(e) => selectVideo(idx, e)}
              className={`group relative flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-full border transition-all overflow-hidden ${
                isActive
                  ? 'bg-gradient-to-r from-[#FFD700]/25 to-[#C4622D]/20 border-[#FFD700]/50 shadow-[0_0_20px_rgba(255,215,0,0.25)]'
                  : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
              }`}
              aria-label={`Play clip ${idx + 1}: ${v.title}`}
              aria-pressed={isActive}
            >
              {/* Animated progress bar (only for active chip) */}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full pointer-events-none"
                  style={{
                    background:
                      'linear-gradient(90deg, rgba(255,215,0,0.12) 0%, rgba(196,98,45,0.06) 100%)',
                  }}
                />
              )}
              <span className={`relative text-sm sm:text-base ${isActive ? '' : 'opacity-70'}`}>
                {v.emoji}
              </span>
              <span
                className={`relative text-[11px] sm:text-xs font-mono tracking-wider ${
                  isActive ? 'text-[#FFD700]' : 'text-white/50 group-hover:text-white/70'
                }`}
              >
                {String(idx + 1).padStart(2, '0')}
              </span>
              <span
                className={`relative text-xs sm:text-sm font-medium whitespace-nowrap ${
                  isActive ? 'text-white' : 'text-white/60 group-hover:text-white/85'
                }`}
              >
                {v.title}
              </span>
            </m.button>
          )
        })}
      </div>
    </m.div>
  )
}

// ── Promo Banner — shows only during May 7-11 2026 event window ──
function PromoBanner() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const now = new Date()
    const start = new Date('2026-05-07T00:00:00-04:00')
    const end   = new Date('2026-05-12T04:00:00-04:00')
    if (now >= start && now <= end) setVisible(true)
  }, [])
  if (!visible) return null
  return (
    <div className="relative z-50 bg-gradient-to-r from-[#C4622D] via-[#d4793e] to-[#C4622D] text-white">
      <a href="/promo" className="block max-w-7xl mx-auto px-4 py-3 flex items-center justify-center gap-3 text-sm sm:text-base font-medium hover:opacity-90 transition">
        <span className="text-lg">🎉</span>
        <span>Exclusive offer — <strong>6 months Pro FREE</strong></span>
        <span className="hidden sm:inline bg-white/20 px-3 py-0.5 rounded-full text-xs font-bold">ACTIVATE →</span>
      </a>
    </div>
  )
}

export function LandingPage() {
  const { status } = useSession() || {}
  const router = useRouter()
  const { t, locale, setLocale } = useI18n()

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/dashboard')
    }
  }, [status, router])

  if (status === 'authenticated') {
    return (
      <div className="dark min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFD700]"></div>
      </div>
    )
  }

  return (
    <LazyMotion features={domAnimation}>
    <div className="dark min-h-screen text-[var(--text-primary)] relative" style={{ background: 'var(--bg-primary)' }}>
      {/* ── PROMO BANNER ── Only visible May 8-11 2026 */}
      <PromoBanner />
      {/* ============================================ */}
      {/* HERO SECTION — Navy/Gold Premium             */}
      {/* ============================================ */}
      <div className="relative z-10">
        <header className="relative overflow-hidden" style={{ background: 'linear-gradient(180deg, var(--bg-primary) 0%, var(--bg-secondary) 100%)' }}>
          {/* Animated background elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Radial glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[#FFD700]/[0.04] rounded-full blur-[120px]" />
            <div className="absolute bottom-0 right-0 w-[500px] h-[400px] bg-[#C4622D]/[0.04] rounded-full blur-[100px]" />
            {/* Grid pattern */}
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,215,0,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,215,0,0.3) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
          </div>

          {/* Nav — Premium Navy/Gold */}
          <nav className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg overflow-hidden ring-2 ring-[#FFD700]/20" style={{width: '48px', height: '48px'}}>
                <Image
                  src="/octopus-core-logo.png"
                  alt="OCTOPUS Core"
                  width={48}
                  height={48}
                  className="w-12 h-12 object-cover scale-[1.45]"
                  priority
                />
              </div>
              <div className="flex flex-col justify-center">
                {/* OCTOPUS wordmark — metallic sci-fi typography */}
                <span className="sr-only">OCTOPUS</span>
                <Image
                  src="/brand/octopus-wordmark.png"
                  alt="OCTOPUS"
                  width={520}
                  height={104}
                  priority
                  className="h-5 sm:h-6 w-auto object-contain select-none"
                  style={{ filter: 'drop-shadow(0 0 10px rgba(255,215,0,0.3))' }}
                />
                <span className="text-[10px] tracking-[0.3em] text-white/40 mt-1 uppercase">Omni Cockpit</span>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setLocale(locale === 'en' ? 'es' : 'en')}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-white/60 hover:text-[#FFD700] transition-all bg-white/5 rounded-lg border border-white/10 hover:border-[#FFD700]/30 hover:bg-[#FFD700]/5"
                title={locale === 'en' ? 'Cambiar a Español' : 'Switch to English'}
              >
                <Globe className="w-4 h-4" />
                <span className="font-medium text-xs">{locale === 'en' ? 'EN' : 'ES'}</span>
              </button>
              <Link
                href="/blog"
                className="hidden sm:inline-block px-4 py-2 text-sm text-white/60 hover:text-[#FFD700] transition-colors font-medium"
              >
                Blog
              </Link>
              <Link
                href="/login"
                className="hidden sm:inline-block px-4 py-2 text-sm text-white/60 hover:text-[#FFD700] transition-colors font-medium"
              >
                {t('landing.nav_login')}
              </Link>
              <Link
                href="/login"
                className="px-4 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-[#FFD700] to-[#F0C030] text-[#0a1628] text-xs sm:text-sm font-bold rounded-xl hover:shadow-lg hover:shadow-[#FFD700]/20 transition-all hover:scale-105 active:scale-95"
              >
                {t('landing.nav_cta')}
              </Link>
            </div>
          </nav>

          {/* Hero Content — Mobile First: Compact, CTA visible immediately */}
          <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 lg:pt-16 pb-12 sm:pb-16 lg:pb-20">
            {/* OCTOPUS Wordmark — Cinematic Brand Signature */}
            <m.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="flex justify-center mb-6 sm:mb-8"
            >
              <Image
                src="/brand/octopus-wordmark.png"
                alt="OCTOPUS"
                width={1400}
                height={280}
                priority
                className="w-full max-w-md sm:max-w-lg lg:max-w-xl h-auto object-contain select-none"
                style={{ filter: 'drop-shadow(0 0 30px rgba(255,215,0,0.15)) drop-shadow(0 0 60px rgba(74,144,217,0.1))' }}
              />
            </m.div>

            {/* ATTENTION: Badge */}
            <m.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, type: 'spring', stiffness: 200 }}
              className="flex justify-center mb-6 sm:mb-8"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#FFD700]/10 border border-[#FFD700]/20 rounded-full">
                <Sparkles className="w-4 h-4 text-[#FFD700]" />
                <span className="text-sm text-[#FFD700]/90 font-medium">{t('landing.hero_badge')}</span>
              </div>
            </m.div>

            {/* ATTENTION: H1 */}
            <m.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="text-center text-3xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold leading-[1.08] mb-4 sm:mb-6 tracking-tight"
            >
              <span className="text-white">{t('landing.hero_h1a')}</span>
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FFD700] via-[#F0C030] to-[#C4622D]">
                {t('landing.hero_h1b')}
              </span>
            </m.h1>

            {/* DESIRE: Subheadline */}
            <m.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="text-center text-base sm:text-lg lg:text-xl text-white/55 max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed font-light"
            >
              {t('landing.hero_sub')}
            </m.p>

            {/* ACTION: LeadCapture — Center of attention */}
            <m.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
            >
              <LeadCapture t={t} variant="hero" />
            </m.div>

            {/* Stats — Compact row */}
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.0 }}
              className="mt-10 sm:mt-14 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 max-w-3xl mx-auto"
            >
              {[
                { value: '500+', labelKey: 'landing.stat_leads' },
                { value: '15+', labelKey: 'landing.stat_modules' },
                { value: '7', labelKey: 'landing.stat_engines' },
                { value: '24/7', labelKey: 'landing.stat_auto' },
              ].map((stat, i) => (
                <m.div
                  key={i}
                  whileHover={{ scale: 1.05, borderColor: 'rgba(255,215,0,0.3)' }}
                  className="text-center bg-white/[0.03] backdrop-blur-sm rounded-xl py-3 px-2 border border-white/[0.06] transition-colors"
                >
                  <p className="text-xl sm:text-2xl font-bold text-[#FFD700]">{stat.value}</p>
                  <p className="text-[10px] sm:text-xs text-white/40 mt-1 uppercase tracking-wider">{t(stat.labelKey)}</p>
                </m.div>
              ))}
            </m.div>

            {/* Social Proof Micro-bar — trust signals near CTA */}
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="mt-6 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs text-white/45"
            >
              <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-emerald-400/70" />{locale === 'es' ? 'Datos encriptados SSL' : 'SSL Encrypted'}</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400/70" />{locale === 'es' ? 'Sin tarjeta requerida' : 'No credit card'}</span>
              <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-[#FFD700]/70" />{locale === 'es' ? '500+ profesionales activos' : '500+ active professionals'}</span>
              <span className="flex items-center gap-1.5"><Star className="w-3.5 h-3.5 text-[#FFD700]/70 fill-[#FFD700]/70" />4.8/5 rating</span>
            </m.div>
          </div>

          {/* Video Demo — Immediately after hero on all devices */}
          <div className="relative z-10 pb-16 sm:pb-24">
            <MacBookVideo t={t} />
          </div>
        </header>

      {/* ============================================ */}
      {/* TECH ECOSYSTEM — Infinite Logo Slider */}
      {/* ============================================ */}
      <section className="py-12 sm:py-16 border-y overflow-hidden relative z-20" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
          <m.p
            initial={{ opacity: 0, letterSpacing: '0.5em' }}
            whileInView={{ opacity: 1, letterSpacing: '0.25em' }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center text-sm uppercase tracking-[0.25em] text-white/40 font-medium"
          >
            {locale === 'es' ? 'Nuestro Ecosistema Tecnológico' : 'Our Technology Ecosystem'}
          </m.p>
        </div>

        {/* Infinite scroll track */}
        <div className="relative">
          {/* Fade edges */}
          <div className="absolute left-0 top-0 bottom-0 w-24 sm:w-40 bg-gradient-to-r from-[#0F1419] to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-24 sm:w-40 bg-gradient-to-l from-[#0F1419] to-transparent z-10 pointer-events-none" />

          <div className="flex animate-scroll-logos">
            {[...Array(3)].map((_, setIdx) => (
              <div key={setIdx} className="flex items-center gap-12 sm:gap-20 px-6 sm:px-10 shrink-0">
                {[
                  { src: '/partners/elevenlabs.png', name: 'ElevenLabs', w: 140, h: 36 },
                  { src: '/partners/wiz-v2.png', name: 'WiZ', w: 120, h: 68 },
                  { src: '/partners/hubspot.png', name: 'HubSpot', w: 140, h: 40 },
                  { src: '/partners/hubspace.png', name: 'Hubspace', w: 140, h: 40 },
                  { src: '/partners/spline.png', name: 'Spline', w: 120, h: 36 },
                  { src: '/partners/falai.png', name: 'fal.ai', w: 120, h: 50 },
                  { src: '/partners/openrouter.png', name: 'OpenRouter', w: 140, h: 24 },
                ].map((logo: { src: string; name: string; w: number; h: number; noInvert?: boolean }) => (
                  <div
                    key={`${setIdx}-${logo.name}`}
                    className="flex items-center justify-center opacity-50 hover:opacity-90 transition-opacity duration-300 shrink-0"
                    title={logo.name}
                  >
                    <Image
                      src={logo.src}
                      alt={logo.name}
                      width={logo.w}
                      height={logo.h}
                      loading="lazy"
                      className={`object-contain ${logo.noInvert ? 'rounded-xl' : 'brightness-0 invert'}`}
                      style={{ maxHeight: '52px' }}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <style jsx global>{`
          @keyframes scroll-logos {
            0% { transform: translateX(0); }
            100% { transform: translateX(-33.333%); }
          }
          .animate-scroll-logos {
            animation: scroll-logos 25s linear infinite;
          }
          .animate-scroll-logos:hover {
            animation-play-state: paused;
          }
        `}</style>
      </section>

      {/* ============================================ */}
      {/* TRUST SIGNALS — Social Proof Section          */}
      {/* ============================================ */}
      <section className="py-16 sm:py-20 relative z-20 border-b" style={{ background: 'linear-gradient(180deg, var(--bg-primary) 0%, var(--bg-secondary) 50%, rgba(45,74,62,0.1) 100%)', borderColor: 'var(--border-color)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <m.div
            {...fadeInUp}
            viewport={{ once: true }}
            whileInView="animate"
            initial="initial"
            className="text-center mb-10"
          >
            <p className="text-sm uppercase tracking-[0.25em] text-white/40 font-medium mb-3">
              {locale === 'es' ? 'Confianza y Resultados' : 'Trusted & Proven'}
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              {locale === 'es' ? 'Empresas y profesionales que ' : 'Businesses & professionals who '}
              <span className="text-[#FFD700]">{locale === 'es' ? 'confían en OCTOPUS' : 'trust OCTOPUS'}</span>
            </h2>
          </m.div>

          {/* Trust metrics grid */}
          <m.div
            className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 mb-12"
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, amount: 0.3 }}
          >
            {[
              { value: '500+', label: locale === 'es' ? 'Usuarios activos' : 'Active users', icon: Users },
              { value: '50K+', label: locale === 'es' ? 'Leads procesados' : 'Leads processed', icon: Target },
              { value: '12K+', label: locale === 'es' ? 'Assets creados con IA' : 'AI assets created', icon: Sparkles },
              { value: '99.9%', label: 'Uptime SLA', icon: Shield },
            ].map((metric, i) => (
              <m.div
                key={i}
                variants={fadeInScale}
                whileHover={{ scale: 1.06, transition: { duration: 0.2 } }}
                className="text-center p-5 bg-white/[0.03] border border-white/[0.06] rounded-2xl hover:border-[#FFD700]/20 transition-colors"
              >
                <metric.icon className="w-5 h-5 text-[#FFD700]/60 mx-auto mb-2" />
                <p className="text-2xl sm:text-3xl font-extrabold text-[#FFD700]">{metric.value}</p>
                <p className="text-xs text-white/40 mt-1 uppercase tracking-wider">{metric.label}</p>
              </m.div>
            ))}
          </m.div>

          {/* Security & compliance badges */}
          <m.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="flex flex-wrap items-center justify-center gap-6 sm:gap-8"
          >
            {[
              { icon: Shield, text: locale === 'es' ? 'Encriptación AES-256' : 'AES-256 Encryption' },
              { icon: Globe, text: 'GDPR & CCPA Compliant' },
              { icon: Server, text: locale === 'es' ? 'Servidores seguros AWS' : 'Secure AWS Servers' },
              { icon: CheckCircle2, text: 'SOC 2 Type II' },
            ].map((badge, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-white/35">
                <badge.icon className="w-4 h-4 text-emerald-400/50" />
                <span className="font-medium">{badge.text}</span>
              </div>
            ))}
          </m.div>
        </div>
      </section>

      {/* ============================================ */}
      {/* FEATURES SECTION */}
      {/* ============================================ */}
      <section id="features" className="py-20 sm:py-28 text-white relative z-20 overflow-hidden" style={{ background: 'linear-gradient(180deg, var(--bg-primary) 0%, var(--bg-secondary) 60%, rgba(45,74,62,0.08) 100%)' }}>
        {/* Floating orbs — decorative parallax (kept away from hero to avoid throttling video) */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[10%] left-[5%] w-32 h-32 rounded-full bg-[#FFD700]/[0.05] animate-float-slow" />
          <div className="absolute top-[50%] right-[4%] w-24 h-24 rounded-full bg-[#C4622D]/[0.06] animate-float-medium" style={{ animationDelay: '-3s' }} />
          <div className="absolute bottom-[15%] left-[12%] w-20 h-20 rounded-full bg-[#4A90D9]/[0.05] animate-float-slow" style={{ animationDelay: '-7s' }} />
          <div className="absolute top-[30%] right-[18%] w-3 h-3 rounded-full bg-[#FFD700]/25 animate-float-rotate" />
          <div className="absolute bottom-[40%] left-[35%] w-2 h-2 rounded-full bg-[#6366F1]/30 animate-float-rotate" style={{ animationDelay: '-10s' }} />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <m.div
            {...fadeInUp}
            viewport={{ once: true }}
            whileInView="animate"
            initial="initial"
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 bg-[#6366F1]/10 border border-[#6366F1]/20 rounded-full px-4 py-1.5 mb-6">
              <Cpu className="w-4 h-4 text-[#6366F1]" />
              <span className="text-sm text-[#6366F1] font-medium">{locale === 'es' ? 'Plataforma Todo-en-Uno' : 'All-in-One Platform'}</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-4 text-white drop-shadow-lg tracking-tight">
              {t('landing.features_h2a')}{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FFD700] to-[#F0C030]">{t('landing.features_h2b')}</span>
            </h2>
            <p className="text-base sm:text-lg text-white/60 max-w-2xl mx-auto leading-relaxed">
              {t('landing.features_desc')}
            </p>
          </m.div>

          <m.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5 lg:gap-6"
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, amount: 0.1 }}
          >
            {featureDefs.map((feature, index) => (
              <m.article
                key={feature.titleKey}
                variants={index % 3 === 0 ? staggerItemLeft : index % 3 === 2 ? staggerItemRight : staggerItem}
                whileHover={{ y: -6, scale: 1.02, transition: { duration: 0.25 } }}
                className="group p-6 sm:p-8 bg-[#1A2332]/80 rounded-2xl border border-[#FFD700]/15 hover:shadow-xl hover:shadow-[#FFD700]/10 hover:border-[#FFD700]/30 transition-all duration-300 backdrop-blur-sm"
              >
                <div className="flex items-center gap-3 mb-5">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform"
                    style={{ backgroundColor: `${feature.color}25` }}
                  >
                    <feature.icon className="w-6 h-6" style={{ color: feature.color }} />
                  </div>
                  {feature.badgeKey && (
                    <span className="px-2.5 py-1 bg-gradient-to-r from-[#C4622D] to-[#A04D22] text-white text-[10px] font-bold rounded-full uppercase tracking-wider animate-pulse">
                      {t(feature.badgeKey)}
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-bold mb-3 text-white group-hover:text-[#FFD700] transition-colors">
                  {t(feature.titleKey)}
                </h3>
                <p className="text-white/65 leading-relaxed">
                  {t(feature.descKey)}
                </p>
              </m.article>
            ))}
          </m.div>
        </div>
      </section>

      {/* ============================================ */}
      {/* GROWTH ENGINE HIGHLIGHT SECTION */}
      {/* ============================================ */}
      <section id="growth-engine" className="py-20 sm:py-28 relative z-20" style={{ background: 'linear-gradient(180deg, var(--bg-secondary) 0%, rgba(45,74,62,0.2) 50%, var(--bg-primary) 100%)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <m.div
            {...fadeInLeft}
            viewport={{ once: true }}
            whileInView="animate"
            initial="initial"
            transition={{ duration: 0.7 }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#C4622D]/20 border border-[#C4622D]/30 rounded-full text-sm text-[#F0A070] mb-6">
              <TrendingUp className="w-4 h-4" />
              {t('landing.growth_badge')}
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-4 tracking-tight">
              {t('landing.growth_h2a')}{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C4622D] to-[#F0A070]">{t('landing.growth_h2b')}</span>
            </h2>
            <p className="text-base sm:text-lg text-[#F5F0E8]/60 max-w-3xl mx-auto leading-relaxed">
              {t('landing.growth_desc')}
            </p>
          </m.div>

          <m.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-4xl mx-auto"
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, amount: 0.2 }}
          >
            {growthFeatureDefs.map((item, i) => (
              <m.div
                key={i}
                variants={i % 2 === 0 ? staggerItemLeft : staggerItemRight}
                whileHover={{ scale: 1.04, transition: { duration: 0.2 } }}
                className="flex items-center gap-4 p-4 sm:p-5 bg-[#F5F0E8]/5 border border-[#C4622D]/20 rounded-2xl hover:bg-[#C4622D]/10 hover:border-[#C4622D]/40 transition-colors"
              >
                <item.icon className="w-5 h-5 text-[#C4622D] flex-shrink-0" />
                <span className="text-[#F5F0E8]/90 font-medium text-sm sm:text-base">{t(item.textKey)}</span>
              </m.div>
            ))}
          </m.div>

          <m.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.6 }}
            className="text-center mt-12"
          >
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[#C4622D] to-[#A04D22] text-white font-semibold rounded-2xl hover:shadow-xl hover:shadow-[#C4622D]/30 transition-all"
            >
              {t('landing.growth_cta')}
              <ArrowRight className="w-5 h-5" />
            </Link>
          </m.div>
        </div>
      </section>

      {/* ============================================ */}
      {/* CAPABILITIES SECTION */}
      {/* ============================================ */}
      <section className="py-20 sm:py-28 relative z-20" style={{ background: 'linear-gradient(180deg, rgba(45,74,62,0.2) 0%, var(--bg-secondary) 50%, var(--bg-primary) 100%)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <m.div
            {...fadeInRight}
            viewport={{ once: true }}
            whileInView="animate"
            initial="initial"
            transition={{ duration: 0.7 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-4 tracking-tight">
              {t('landing.cap_h2a')}{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C4622D] to-[#F0A070]">{t('landing.cap_h2b')}</span>
            </h2>
            <p className="text-base sm:text-lg text-[#F5F0E8]/60 max-w-2xl mx-auto leading-relaxed">
              {t('landing.cap_desc')}
            </p>
          </m.div>

          <m.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-4xl mx-auto"
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, amount: 0.2 }}
          >
            {capabilityDefs.map((cap, i) => (
              <m.div
                key={i}
                variants={i % 2 === 0 ? staggerItemRight : staggerItemLeft}
                whileHover={{ scale: 1.04, transition: { duration: 0.2 } }}
                className="flex items-center gap-4 p-4 sm:p-5 bg-[#F5F0E8]/5 border border-[#F5F0E8]/10 rounded-2xl hover:bg-[#F5F0E8]/10 transition-colors"
              >
                <cap.icon className="w-5 h-5 text-[#C4622D] flex-shrink-0" />
                <span className="text-[#F5F0E8]/90 font-medium">{t(cap.textKey)}</span>
              </m.div>
            ))}
          </m.div>
        </div>
      </section>

      {/* ============================================ */}
      {/* SHOWCASE — AI-Generated Examples Gallery    */}
      {/* ============================================ */}
      <ShowcaseSection locale={locale} />

      {/* ============================================ */}
      {/* TESTIMONIALS / REPUTATION SECTION */}
      {/* ============================================ */}
      <TestimonialsSection es={locale === 'es'} />

      {/* ============================================ */}
      {/* FAQ SECTION                                  */}
      {/* ============================================ */}
      <FAQSection es={locale === 'es'} />

      {/* ============================================ */}
      {/* LATEST BLOG ARTICLES                        */}
      {/* ============================================ */}
      <BlogPreviewSection es={locale === 'es'} />

      {/* ============================================ */}
      {/* CTA SECTION — With LeadCapture              */}
      {/* ============================================ */}
      <section className="py-20 sm:py-28 text-white relative z-20 overflow-hidden" style={{ background: 'linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 50%, rgba(45,74,62,0.15) 100%)' }}>
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[#FFD700]/[0.04] rounded-full animate-pulse-glow" />
          <div className="absolute top-[20%] left-[10%] w-20 h-20 rounded-full bg-[#C4622D]/[0.06] animate-float-medium" />
          <div className="absolute bottom-[25%] right-[12%] w-16 h-16 rounded-full bg-[#FFD700]/[0.05] animate-float-slow" style={{ animationDelay: '-4s' }} />
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <m.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <m.div
              className="w-16 h-16 bg-gradient-to-br from-[#FFD700] to-[#C4622D] rounded-2xl flex items-center justify-center mx-auto mb-8"
              whileInView={{ rotate: [0, -10, 10, -5, 0], scale: [1, 1.1, 1] }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              <Rocket className="w-8 h-8 text-white" />
            </m.div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 text-white drop-shadow-lg">
              {t('landing.cta_h2a')}{' '}
              <span className="text-[#FFD700]">{t('landing.cta_h2b')}</span>?
            </h2>
            <p className="text-lg text-white/70 max-w-2xl mx-auto mb-6">
              {t('landing.cta_desc')}
            </p>
            {/* Benefit bullets — conversion booster */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-10 text-sm text-white/50">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-400" />{locale === 'es' ? 'Setup en 60 segundos' : '60-second setup'}</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-400" />{locale === 'es' ? 'Sin tarjeta de crédito' : 'No credit card'}</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-400" />{locale === 'es' ? 'Cancela cuando quieras' : 'Cancel anytime'}</span>
            </div>
            <LeadCapture t={t} variant="cta" />
            {/* Live activity indicator — urgency */}
            <m.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
              className="mt-6 flex items-center justify-center gap-2 text-xs text-white/40"
            >
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span></span>
              {locale === 'es' ? '12 personas se registraron en las últimas 24h' : '12 people signed up in the last 24h'}
            </m.div>
            <div className="mt-6">
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-[#FFD700] transition-colors font-medium"
              >
                {t('landing.cta_pricing')}
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </m.div>
        </div>
      </section>

      {/* ============================================ */}
      {/* FOOTER */}
      {/* ============================================ */}
      <footer className="border-t border-[#FFD700]/10 py-12 relative z-20" style={{ background: 'var(--bg-primary)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full flex items-center justify-center shadow-md overflow-hidden">
                <Image
                  src="/octopus-core-logo.png"
                  alt="OCTOPUS Omni Cockpit Footer Logo"
                  width={44}
                  height={44}
                  className="w-11 h-11 object-cover scale-[1.45]"
                />
              </div>
              <span className="font-bold text-[#F5F0E8]">OCTOPUS Omni Cockpit</span>
            </div>
            <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              <Link href="/blog" className="text-sm text-[#F5F0E8]/60 hover:text-[#F5F0E8] transition-colors">
                Blog
              </Link>
              <Link href="/pricing" className="text-sm text-[#F5F0E8]/60 hover:text-[#F5F0E8] transition-colors">
                {t('landing.footer_pricing')}
              </Link>
              <Link href="/support" className="text-sm text-[#F5F0E8]/60 hover:text-[#F5F0E8] transition-colors">
                Support
              </Link>
              <Link href="/contact" className="text-sm text-[#F5F0E8]/60 hover:text-[#F5F0E8] transition-colors">
                Contact
              </Link>
              <Link href="/privacy" className="text-sm text-[#F5F0E8]/60 hover:text-[#F5F0E8] transition-colors">
                Privacy
              </Link>
              <Link href="/terms" className="text-sm text-[#F5F0E8]/60 hover:text-[#F5F0E8] transition-colors">
                Terms
              </Link>
              <Link href="/login" className="text-sm text-[#F5F0E8]/60 hover:text-[#F5F0E8] transition-colors">
                {t('landing.footer_login')}
              </Link>
            </nav>
            <div className="text-center sm:text-right">
              <a href="https://octopuskills.com" target="_blank" rel="noopener noreferrer" className="text-xs text-[#C4622D]/70 hover:text-[#C4622D] transition-colors font-medium">
                octopuskills.com
              </a>
              <p className="text-xs text-[#F5F0E8]/40 mt-1">
                {t('landing.footer_rights')}
              </p>
            </div>
          </div>
        </div>
      </footer>
      </div>{/* end z-10 content wrapper */}
    </div>
    </LazyMotion>
  )
}