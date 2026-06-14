'use client'

import { useState, useCallback, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { m, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { X, Copy, ArrowRight, Sparkles, Eye, Code2, ExternalLink, Globe, Users } from 'lucide-react'

// ============================================
// SHOWCASE DATA — Curated examples
// ============================================
interface ShowcaseItem {
  id: string
  title: { es: string; en: string }
  description: { es: string; en: string }
  category: { es: string; en: string }
  image: string
  icon: string
  color: string
  gradient: string
  prompt: string // The prompt that generates this project
  tags: string[]
  stats: { es: string; en: string }
}

const SHOWCASE_ITEMS: ShowcaseItem[] = [
  {
    id: 'snake-game',
    title: { es: 'Snake Neon Arcade', en: 'Neon Snake Arcade' },
    description: {
      es: 'Juego Snake retro con estética neon, efectos de brillo, sistema de puntuación y controles táctiles para móvil.',
      en: 'Retro Snake game with neon aesthetic, glow effects, scoring system and mobile touch controls.'
    },
    category: { es: 'Juego', en: 'Game' },
    image: '/showcase/showcase-snake-game.png',
    icon: '🎮',
    color: '#22C55E',
    gradient: 'from-[#22C55E] to-[#15803D]',
    prompt: 'Create a full-screen dark neon Snake game with glowing green snake on a black grid, score tracking, high scores, responsive touch controls for mobile, retro arcade aesthetic with CRT glow effects, game over screen with restart button',
    tags: ['HTML5', 'Canvas', 'JavaScript', 'Mobile'],
    stats: { es: 'Creado en 2 min', en: 'Built in 2 min' },
  },
  {
    id: 'luxury-realtor',
    title: { es: 'Luxury Real Estate', en: 'Luxury Real Estate' },
    description: {
      es: 'Landing page premium para bienes raíces de lujo con galería de propiedades, filtros de búsqueda y formulario de contacto.',
      en: 'Premium real estate landing page with property gallery, search filters and contact form.'
    },
    category: { es: 'Inmobiliaria', en: 'Real Estate' },
    image: '/showcase/showcase-realtor.png',
    icon: '🏠',
    color: '#D4AF37',
    gradient: 'from-[#D4AF37] to-[#B8860B]',
    prompt: 'Create a luxury real estate website with dark navy theme, gold accents, hero section with mansion photo, property listings grid with filters by price/location/bedrooms, individual property modal with gallery, contact form, elegant serif typography, responsive design',
    tags: ['Landing', 'Forms', 'Gallery', 'Responsive'],
    stats: { es: 'Creado en 3 min', en: 'Built in 3 min' },
  },
  {
    id: 'motion-portfolio',
    title: { es: 'Creative Portfolio', en: 'Creative Portfolio' },
    description: {
      es: 'Portfolio creativo con animaciones fluidas, gradientes dinámicos, galería de proyectos y efectos glassmorphism.',
      en: 'Creative portfolio with fluid animations, dynamic gradients, project gallery and glassmorphism effects.'
    },
    category: { es: 'Portfolio', en: 'Portfolio' },
    image: '/showcase/showcase-motion-portfolio.png',
    icon: '🎨',
    color: '#8B5CF6',
    gradient: 'from-[#8B5CF6] to-[#6D28D9]',
    prompt: 'Create a creative motion designer portfolio website with dark theme, animated gradient backgrounds from purple to cyan, bold 3D typography, project gallery grid with hover effects, about section, skills showcase, contact form, glassmorphism UI cards, smooth scroll animations',
    tags: ['Animaciones', 'CSS', 'Gallery', 'Glassmorphism'],
    stats: { es: 'Creado en 3 min', en: 'Built in 3 min' },
  },
  {
    id: 'restaurant',
    title: { es: 'Fine Dining Restaurant', en: 'Fine Dining Restaurant' },
    description: {
      es: 'Sitio web elegante para restaurante con menú interactivo, reservas online, galería de platos y horarios.',
      en: 'Elegant restaurant website with interactive menu, online reservations, dish gallery and hours.'
    },
    category: { es: 'Restaurante', en: 'Restaurant' },
    image: '/showcase/showcase-restaurant.png',
    icon: '🍽️',
    color: '#C9A961',
    gradient: 'from-[#C9A961] to-[#8B6914]',
    prompt: 'Create an elegant fine dining restaurant website with dark charcoal background, warm amber/gold accents, hero section with professional food photography, interactive menu with appetizers/entrees/desserts categories, reservation form with date/time picker, photo gallery, location map section, opening hours, responsive design',
    tags: ['Menú', 'Reservas', 'Gallery', 'Elegante'],
    stats: { es: 'Creado en 2 min', en: 'Built in 2 min' },
  },
  {
    id: 'fitness-app',
    title: { es: 'FitPro Landing', en: 'FitPro Landing' },
    description: {
      es: 'Landing page energética para app de fitness con dashboard de estadísticas, planes de entrenamiento y testimonios.',
      en: 'Energetic fitness app landing with stats dashboard, workout plans and testimonials.'
    },
    category: { es: 'Fitness', en: 'Fitness' },
    image: '/showcase/showcase-fitness.png',
    icon: '💪',
    color: '#EF4444',
    gradient: 'from-[#EF4444] to-[#DC2626]',
    prompt: 'Create a modern fitness app landing page with dark black background, energetic red to orange gradient accents, hero section with athletic silhouette, workout stats dashboard with circular progress indicators, pricing plans section with 3 tiers, testimonials carousel, download CTA buttons for iOS and Android, responsive design',
    tags: ['Landing', 'Stats', 'Pricing', 'CTA'],
    stats: { es: 'Creado en 2 min', en: 'Built in 2 min' },
  },
  {
    id: 'ecommerce',
    title: { es: 'TechStore Pro', en: 'TechStore Pro' },
    description: {
      es: 'Tienda online minimalista con grid de productos, carrito de compras, filtros y diseño cyberpunk oscuro.',
      en: 'Minimalist online store with product grid, shopping cart, filters and dark cyberpunk design.'
    },
    category: { es: 'E-commerce', en: 'E-commerce' },
    image: '/showcase/showcase-ecommerce.png',
    icon: '🛒',
    color: '#06B6D4',
    gradient: 'from-[#06B6D4] to-[#0891B2]',
    prompt: 'Create a sleek dark-themed e-commerce store website with black background, product grid showing 6 tech products (headphones, watches, accessories), minimalist product cards with hover zoom, shopping cart sidebar, category filters, search bar, neon cyan accent colors, add to cart functionality with quantity, responsive grid layout',
    tags: ['Tienda', 'Cart', 'Filtros', 'Responsive'],
    stats: { es: 'Creado en 4 min', en: 'Built in 4 min' },
  },
  {
    id: 'saas-dashboard',
    title: { es: 'Analytics Dashboard', en: 'Analytics Dashboard' },
    description: {
      es: 'Dashboard SaaS con gráficas interactivas, KPIs en tiempo real, tablas de datos y navegación lateral.',
      en: 'SaaS dashboard with interactive charts, real-time KPIs, data tables and sidebar navigation.'
    },
    category: { es: 'SaaS', en: 'SaaS' },
    image: '/showcase/showcase-saas-dashboard.png',
    icon: '📊',
    color: '#14B8A6',
    gradient: 'from-[#14B8A6] to-[#0D9488]',
    prompt: 'Create a modern SaaS analytics dashboard with dark navy background, sidebar navigation with icons, main content showing line charts for revenue/growth trends, KPI cards (Users, Revenue, Growth Rate, Conversions) with large numbers, data table with sortable columns, date range picker, teal and cyan accent colors, responsive layout that stacks on mobile',
    tags: ['Dashboard', 'Charts', 'KPIs', 'Data'],
    stats: { es: 'Creado en 3 min', en: 'Built in 3 min' },
  },
  {
    id: 'music-artist',
    title: { es: 'Neon Waves Artist', en: 'Neon Waves Artist' },
    description: {
      es: 'Página de artista musical con reproductor, fechas de tour, links de streaming y estética moody púrpura.',
      en: 'Music artist page with player, tour dates, streaming links and moody purple aesthetic.'
    },
    category: { es: 'Música', en: 'Music' },
    image: '/showcase/showcase-music.png',
    icon: '🎵',
    color: '#A855F7',
    gradient: 'from-[#A855F7] to-[#7C3AED]',
    prompt: 'Create a music artist website with deep black background, moody purple and magenta lighting effects, hero section with album artwork, artist name with glow effect, embedded music player, tour dates section with upcoming concerts, streaming platform links (Spotify, Apple Music, YouTube), photo gallery, mailing list signup, atmospheric dark aesthetic',
    tags: ['Música', 'Player', 'Tour', 'Streaming'],
    stats: { es: 'Creado en 3 min', en: 'Built in 3 min' },
  },
  {
    id: 'crypto-trading',
    title: { es: 'CryptoTrader Pro', en: 'CryptoTrader Pro' },
    description: {
      es: 'Plataforma de trading crypto con gráficas de velas, portfolio, libro de órdenes y indicadores en tiempo real.',
      en: 'Crypto trading platform with candlestick charts, portfolio, order book and real-time indicators.'
    },
    category: { es: 'FinTech', en: 'FinTech' },
    image: '/showcase/showcase-crypto.png',
    icon: '💹',
    color: '#F59E0B',
    gradient: 'from-[#F59E0B] to-[#D97706]',
    prompt: 'Create a cryptocurrency trading platform UI with dark background, prominent candlestick chart showing Bitcoin price with green bullish and red bearish candles, top ticker showing BTC/ETH/SOL prices with percent changes, portfolio sidebar with total balance and asset allocation, order book with buy/sell columns in green/red, trading pair selector, volume chart, dark professional fintech design',
    tags: ['FinTech', 'Charts', 'Trading', 'Real-time'],
    stats: { es: 'Creado en 4 min', en: 'Built in 4 min' },
  },
]

// ============================================
// SHOWCASE SECTION
// ============================================
// ============================================
// Community site type
// ============================================
interface CommunitySite {
  id: string
  slug: string
  name: string
  fileCount: number
  createdAt: string
  author: string
  url: string
}

export function ShowcaseSection({ locale }: { locale: string }) {
  const es = locale === 'es'
  const { status } = useSession() || {}
  const router = useRouter()
  const [selected, setSelected] = useState<ShowcaseItem | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [communitySites, setCommunitySites] = useState<CommunitySite[]>([])
  const [expandedSite, setExpandedSite] = useState<CommunitySite | null>(null)

  // Fetch published community sites
  useEffect(() => {
    fetch('/api/hosted-sites/community')
      .then(r => r.json())
      .then(d => { if (d.sites?.length) setCommunitySites(d.sites) })
      .catch(() => {})
  }, [])

  const handleReplicate = useCallback((item: ShowcaseItem) => {
    // Encode the prompt to pass to Code Engine
    const encodedPrompt = encodeURIComponent(item.prompt)
    const redirectUrl = `/dashboard/claude-code?showcase=${item.id}&prompt=${encodedPrompt}`

    if (status === 'authenticated') {
      // User is logged in — go directly to Code Engine
      router.push(redirectUrl)
    } else {
      // Not logged in — redirect to signup, then to Code Engine
      const callbackUrl = encodeURIComponent(redirectUrl)
      router.push(`/login?callbackUrl=${callbackUrl}&showcase=true`)
    }
    setSelected(null)
  }, [status, router])

  return (
    <>
      <section id="showcase" className="py-20 sm:py-28 bg-gradient-to-b from-[#1A1A1A] via-[#0F1419] to-[#0C1222] relative z-20 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#FFD700]/[0.02] rounded-full blur-[120px]" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#C4622D]/[0.03] rounded-full blur-[100px]" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Header */}
          <m.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#FFD700]/10 border border-[#FFD700]/20 rounded-full text-sm text-[#FFD700]/90 mb-6">
              <Code2 className="w-4 h-4" />
              {es ? 'Code Engine — Creado con IA' : 'Code Engine — Built with AI'}
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
              {es ? 'Mira lo que ' : 'See What '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FFD700] via-[#F0C030] to-[#C4622D]">
                {es ? 'puedes crear' : 'you can build'}
              </span>
            </h2>
            <p className="text-lg text-[#F5F0E8]/60 max-w-3xl mx-auto">
              {es
                ? 'Proyectos reales generados por nuestra IA en minutos. Haz clic en cualquiera para replicarlo al instante.'
                : 'Real projects generated by our AI in minutes. Click any to replicate it instantly.'}
            </p>
          </m.div>

          {/* Grid — 3×3 on desktop, 2 cols on tablet, 1 on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {SHOWCASE_ITEMS.map((item, i) => (
              <m.div
                key={item.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                onHoverStart={() => setHoveredId(item.id)}
                onHoverEnd={() => setHoveredId(null)}
                onClick={() => setSelected(item)}
                className="group cursor-pointer relative rounded-2xl overflow-hidden bg-[#111827] border border-white/[0.06] hover:border-white/[0.15] transition-all duration-300"
                style={{ boxShadow: hoveredId === item.id ? `0 0 40px ${item.color}15` : 'none' }}
              >
                {/* Thumbnail */}
                <div className="relative aspect-video overflow-hidden">
                  <Image
                    src={item.image}
                    alt={es ? item.title.es : item.title.en}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <m.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={hoveredId === item.id ? { scale: 1, opacity: 1 } : { scale: 0.8, opacity: 0 }}
                      className="flex items-center gap-2 px-5 py-2.5 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 text-white text-sm font-medium"
                    >
                      <Eye className="w-4 h-4" />
                      {es ? 'Ver Detalle' : 'View Detail'}
                    </m.div>
                  </div>
                  {/* Category badge */}
                  <div className="absolute top-3 left-3">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white/90"
                      style={{ background: `${item.color}30`, backdropFilter: 'blur(8px)' }}>
                      {item.icon} {es ? item.category.es : item.category.en}
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3 className="text-base font-semibold text-[#F5F0E8] mb-1 group-hover:text-[#FFD700] transition-colors">
                    {es ? item.title.es : item.title.en}
                  </h3>
                  <p className="text-xs text-[#F5F0E8]/50 mb-3 line-clamp-2">
                    {es ? item.description.es : item.description.en}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1.5 flex-wrap">
                      {item.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-white/[0.05] text-[#F5F0E8]/40 border border-white/[0.05]">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <span className="text-[10px] text-[#FFD700]/60 font-medium flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      {es ? item.stats.es : item.stats.en}
                    </span>
                  </div>
                </div>
              </m.div>
            ))}
          </div>

          {/* ============================================ */}
          {/* COMMUNITY LIVE GALLERY — Real published sites */}
          {/* ============================================ */}
          {communitySites.length > 0 && (
            <m.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mt-20"
            >
              <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-sm text-emerald-400/90 mb-4">
                  <Globe className="w-4 h-4" />
                  {es ? 'Publicados por la Comunidad' : 'Published by Community'}
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-[#F5F0E8] mb-2">
                  {es ? 'Sitios en Vivo' : 'Live Sites'}
                </h3>
                <p className="text-sm text-[#F5F0E8]/50 max-w-xl mx-auto">
                  {es
                    ? 'Proyectos reales publicados con Code Engine — interactúa con ellos en vivo.'
                    : 'Real projects published with Code Engine — interact with them live.'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {communitySites.map((site, i) => (
                  <m.div
                    key={site.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="group relative rounded-2xl overflow-hidden bg-[#111827] border border-white/[0.06] hover:border-emerald-500/30 transition-all duration-300"
                  >
                    {/* Live iframe preview */}
                    <div className="relative aspect-video overflow-hidden bg-white">
                      <iframe
                        src={site.url}
                        className="w-full h-full border-0 pointer-events-none"
                        title={site.name}
                        sandbox="allow-scripts allow-same-origin"
                        loading="lazy"
                        style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: '200%', height: '200%' }}
                      />
                      {/* Click overlay to expand */}
                      <div
                        onClick={() => setExpandedSite(site)}
                        className="absolute inset-0 cursor-pointer bg-transparent group-hover:bg-black/20 transition-colors flex items-center justify-center"
                      >
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 text-white text-sm font-medium">
                          <Eye className="w-4 h-4" />
                          {es ? 'Ver en Vivo' : 'View Live'}
                        </div>
                      </div>
                      {/* Live badge */}
                      <div className="absolute top-2 left-2">
                        <span className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold text-emerald-300 bg-emerald-900/80 backdrop-blur-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          LIVE
                        </span>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-4">
                      <h3 className="text-sm font-semibold text-[#F5F0E8] mb-1 truncate group-hover:text-emerald-400 transition-colors">
                        {site.name}
                      </h3>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-[#F5F0E8]/40 flex items-center gap-1">
                          <Users className="w-3 h-3" /> {site.author}
                        </span>
                        <a
                          href={site.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-[11px] text-emerald-400/70 hover:text-emerald-300 flex items-center gap-1 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          {es ? 'Abrir' : 'Open'}
                        </a>
                      </div>
                    </div>
                  </m.div>
                ))}
              </div>
            </m.div>
          )}

          {/* CTA under grid */}
          <m.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
            className="text-center mt-12"
          >
            <button
              onClick={() => {
                if (status === 'authenticated') {
                  router.push('/dashboard/claude-code')
                } else {
                  router.push('/login?callbackUrl=' + encodeURIComponent('/dashboard/claude-code'))
                }
              }}
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[#FFD700] to-[#F0C030] text-[#0a1628] font-bold rounded-2xl hover:shadow-xl hover:shadow-[#FFD700]/20 transition-all hover:scale-105 active:scale-95 text-sm"
            >
              <Code2 className="w-5 h-5" />
              {es ? 'Crea el Tuyo Gratis' : 'Build Yours Free'}
              <ArrowRight className="w-5 h-5" />
            </button>
            <p className="mt-3 text-xs text-[#F5F0E8]/30">
              {es ? 'No se requiere tarjeta de crédito • IA genera en minutos' : 'No credit card required • AI builds in minutes'}
            </p>
          </m.div>
        </div>
      </section>

      {/* ============================================ */}
      {/* EXPANDED MODAL — Full detail + Replicate    */}
      {/* ============================================ */}
      <AnimatePresence>
        {selected && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-8"
            onClick={() => setSelected(null)}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

            {/* Modal */}
            <m.div
              initial={{ scale: 0.9, y: 40, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 40, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={e => e.stopPropagation()}
              className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#111827] border border-white/10 shadow-2xl"
              style={{ boxShadow: `0 0 80px ${selected.color}15` }}
            >
              {/* Close button */}
              <button
                onClick={() => setSelected(null)}
                className="absolute top-4 right-4 z-50 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Hero image */}
              <div className="relative aspect-video w-full overflow-hidden rounded-t-3xl">
                <Image
                  src={selected.image}
                  alt={es ? selected.title.es : selected.title.en}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 1024px"
                  priority
                />
                {/* Gradient overlay on bottom */}
                <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#111827] to-transparent" />
              </div>

              {/* Content */}
              <div className="px-6 sm:px-10 pb-8 -mt-12 relative z-10">
                {/* Title area */}
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div>
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3"
                      style={{ background: `${selected.color}20`, color: selected.color }}
                    >
                      {selected.icon} {es ? selected.category.es : selected.category.en}
                    </span>
                    <h3 className="text-2xl sm:text-3xl font-bold text-white">
                      {es ? selected.title.es : selected.title.en}
                    </h3>
                    <p className="text-[#F5F0E8]/60 mt-2 text-sm sm:text-base max-w-2xl">
                      {es ? selected.description.es : selected.description.en}
                    </p>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex gap-2 flex-wrap mb-6">
                  {selected.tags.map(tag => (
                    <span key={tag} className="px-3 py-1 rounded-lg text-xs font-medium bg-white/[0.05] text-[#F5F0E8]/50 border border-white/[0.08]">
                      {tag}
                    </span>
                  ))}
                  <span className="px-3 py-1 rounded-lg text-xs font-medium bg-[#FFD700]/10 text-[#FFD700]/80 border border-[#FFD700]/20 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    {es ? selected.stats.es : selected.stats.en}
                  </span>
                </div>

                {/* Prompt preview */}
                <div className="mb-8 p-4 rounded-xl bg-black/30 border border-white/[0.06]">
                  <p className="text-[10px] text-[#F5F0E8]/30 uppercase tracking-wider font-bold mb-2 flex items-center gap-1.5">
                    <Code2 className="w-3 h-3" />
                    {es ? 'Prompt utilizado' : 'Prompt used'}
                  </p>
                  <p className="text-sm text-[#F5F0E8]/70 leading-relaxed font-mono">
                    {selected.prompt}
                  </p>
                </div>

                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  {/* REPLICATE BUTTON — Main CTA */}
                  <button
                    onClick={() => handleReplicate(selected)}
                    className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r ${selected.gradient} text-white font-bold rounded-2xl hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] text-sm sm:text-base`}
                  >
                    <Copy className="w-5 h-5" />
                    {es ? '🐙 Replicar este Proyecto' : '🐙 Replicate this Project'}
                    <ArrowRight className="w-5 h-5" />
                  </button>

                  {/* Secondary — just explore */}
                  <button
                    onClick={() => setSelected(null)}
                    className="px-6 py-4 bg-white/[0.05] border border-white/10 text-[#F5F0E8]/70 font-medium rounded-2xl hover:bg-white/[0.08] transition-colors text-sm"
                  >
                    {es ? 'Seguir Explorando' : 'Keep Exploring'}
                  </button>
                </div>

                {/* Auth notice */}
                {status !== 'authenticated' && (
                  <p className="mt-3 text-xs text-[#F5F0E8]/30 text-center">
                    {es
                      ? '💡 Al replicar, crearás tu cuenta gratis y la IA generará este proyecto para ti.'
                      : '💡 By replicating, you\'ll create a free account and AI will generate this project for you.'}
                  </p>
                )}
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>

      {/* ============================================ */}
      {/* LIVE SITE EXPANDED MODAL — Full iframe       */}
      {/* ============================================ */}
      <AnimatePresence>
        {expandedSite && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            onClick={() => setExpandedSite(null)}
          >
            <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" />
            <m.div
              initial={{ scale: 0.9, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 30, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={e => e.stopPropagation()}
              className="relative w-full max-w-6xl h-[85vh] rounded-3xl overflow-hidden bg-[#111827] border border-white/10 shadow-2xl flex flex-col"
            >
              {/* Top bar */}
              <div className="flex items-center justify-between px-5 py-3 bg-[#0a0e1a] border-b border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold text-emerald-300 bg-emerald-900/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE
                  </span>
                  <span className="text-sm font-semibold text-white truncate max-w-[300px]">{expandedSite.name}</span>
                  <span className="text-xs text-[#F5F0E8]/40">
                    {es ? 'por' : 'by'} {expandedSite.author}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={expandedSite.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] text-[11px] text-[#F5F0E8]/70 hover:bg-white/[0.1] hover:text-white transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {es ? 'Abrir en nueva pestaña' : 'Open in new tab'}
                  </a>
                  <button
                    onClick={() => setExpandedSite(null)}
                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              {/* Full iframe */}
              <div className="flex-1 min-h-0">
                <iframe
                  src={expandedSite.url}
                  className="w-full h-full border-0 bg-white"
                  title={expandedSite.name}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                />
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </>
  )
}
