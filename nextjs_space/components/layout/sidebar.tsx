'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Boxes,
  Wrench,
  Cpu,
  Link2,
  Settings,
  ChevronLeft,
  ChevronRight,
  Home,
  Sparkles,
  Zap,
  Bot,
  Plug,
  Brain,
  Palette,
  Search,
  TrendingUp,
  Megaphone,
  Video,
  Menu,
  MessageSquare,
  X,
  HomeIcon,
  CreditCard,
  Crown,
  Rocket,
  Radar,
  CalendarDays,
  Receipt,
  Share2,
  Mic,
  Wand2,
  Terminal,
  Code2,
  ListTodo,
  Users,
  Monitor,
  Radio,
  Gauge,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n-context'
import { useSession } from 'next-auth/react'
import { isAdminEmail } from '@/lib/admin-email'
import { useMetrics } from '@/lib/metrics-context'
import { usePlanGate } from '@/hooks/use-plan-gate'

const navItemDefs = [
  { icon: Home, labelKey: 'nav.dashboard', href: '/dashboard' },
  { icon: Gauge, labelKey: 'nav.cockpit', href: '/dashboard/cockpit' },
  { icon: Palette, labelKey: 'nav.creative', href: '/dashboard/chat', badge: 'NEW' },
  { icon: Brain, labelKey: 'nav.octopus', href: '/dashboard/jarvis', badge: 'RAG 2.0+' },
  { icon: Boxes, labelKey: 'nav.projects', href: '/dashboard/projects' },
  // Project Builder oculto — código intacto, se reactiva cuando esté listo
  // { icon: Rocket, labelKey: 'nav.projectBuilder', href: '/dashboard/project-builder' },
  { icon: Radar, labelKey: 'nav.webIntel', href: '/dashboard/website-intelligence', badge: 'NEW' },
  { icon: Cpu, labelKey: 'nav.brazos', href: '/dashboard/brazos' },
  { icon: Terminal, labelKey: 'nav.ollamaChat', href: '/dashboard/ollama-chat', badge: 'ALFA' },
  { icon: Code2, labelKey: 'nav.codeEngine', href: '/dashboard/claude-code', badge: 'ALFA' },
  { icon: ListTodo, labelKey: 'nav.tasks', href: '/dashboard/tasks' },
  { icon: Wrench, labelKey: 'nav.skills', href: '/dashboard/skill-factory' },
  { icon: Bot, labelKey: 'nav.agents', href: '/dashboard/agent-factory' },
  { icon: Users, labelKey: 'nav.multiAgent', href: '/dashboard/multi-agent-chat', badge: 'NEW' },
  // MCP Factory y Directory ocultos — requieren arquitectura MCP client real (protocolo stdio/SSE)
  // { icon: Plug, labelKey: 'nav.mcp', href: '/dashboard/mcp-factory' },
  // { icon: Search, labelKey: 'nav.mcp_dir', href: '/dashboard/mcp-directory' },
  { icon: TrendingUp, labelKey: 'nav.growth', href: '/dashboard/growth', badge: 'NEW' },
  { icon: Megaphone, labelKey: 'nav.adFactory', href: '/dashboard/ad-factory', badge: 'NEW' },
  { icon: Video, labelKey: 'nav.ugcFactory', href: '/dashboard/ugc-factory', badge: 'NEW' },
  { icon: Wand2, labelKey: 'nav.motionGraphics', href: '/dashboard/motion-graphics', badge: 'NEW' },
  { icon: MessageSquare, labelKey: 'nav.salesAgent', href: '/dashboard/sales-agent', badge: 'NEW' },
  { icon: Mic, labelKey: 'nav.voiceAgent', href: '/dashboard/voice-agent', badge: 'NEW' },
  { icon: CalendarDays, labelKey: 'nav.calendar', href: '/dashboard/calendar', badge: 'NEW' },
  { icon: Receipt, labelKey: 'nav.invoices', href: '/dashboard/invoices', badge: 'NEW' },
  { icon: Share2, labelKey: 'nav.automation', href: '/dashboard/automation', badge: 'NEW' },
  { icon: Radio, labelKey: 'nav.channels', href: '/dashboard/channels', badge: 'NEW' },
  { icon: HomeIcon, labelKey: 'nav.hogar', href: '/dashboard/hogar', badge: 'IoT' },
  { icon: Monitor, labelKey: 'nav.browserAutomation', href: '/dashboard/browser-automation', badge: 'NEW' },
  { icon: Link2, labelKey: 'nav.api', href: '/dashboard/api-hub' },
  // { icon: Sparkles, labelKey: 'nav.onboarding', href: '/onboarding' },
  { icon: CreditCard, labelKey: 'nav.pricing', href: '/pricing' },
  { icon: Settings, labelKey: 'nav.settings', href: '/dashboard/settings' },
]

export function Sidebar() {
  const { t } = useI18n()
  const { data: session } = useSession() || {}
  const { activities } = useMetrics()
  const { usage } = usePlanGate()
  const showAdmin = isAdminEmail(session?.user?.email)
  
  const allDefs = showAdmin
    ? [...navItemDefs, { icon: Crown, labelKey: 'nav.admin', href: '/dashboard/admin', badge: 'ADMIN' }]
    : navItemDefs
  const navItems = allDefs.map(item => ({
    ...item,
    label: t(item.labelKey),
  }))
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(true)
  const [glowPulse, setGlowPulse] = useState(false)
  const lastActivityCount = useRef(0)
  const pathname = usePathname()

  // Detectar nuevas actividades de tipo success para disparar el pulso
  useEffect(() => {
    if (activities.length > lastActivityCount.current && lastActivityCount.current > 0) {
      const latest = activities[0]
      if (latest && latest.type === 'success') {
        setGlowPulse(true)
        const timer = setTimeout(() => setGlowPulse(false), 2400)
        return () => clearTimeout(timer)
      }
    }
    lastActivityCount.current = activities.length
  }, [activities])

  // Detectar desktop vs movil
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    setIsDesktop(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Cerrar sidebar movil al navegar
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Cerrar con Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [])

  // Calcular ancho y posición para framer-motion
  const sidebarWidth = isDesktop ? (collapsed ? 80 : 280) : 280
  const sidebarX = isDesktop ? 0 : (mobileOpen ? 0 : -280)

  return (
    <>
      {/* Estilos de sombra 3D y pulso dinámico */}
      <style jsx global>{`
        @keyframes octopus-ambient {
          0%, 100% {
            box-shadow:
              4px 0 24px -4px rgba(30, 120, 180, 0.25),
              6px 0 40px -8px rgba(45, 74, 62, 0.20),
              inset -1px 0 20px -10px rgba(30, 120, 180, 0.08);
          }
          33% {
            box-shadow:
              5px 0 28px -4px rgba(45, 74, 62, 0.28),
              8px 0 44px -8px rgba(30, 120, 180, 0.22),
              inset -1px 0 24px -10px rgba(45, 74, 62, 0.10);
          }
          66% {
            box-shadow:
              3px 0 20px -4px rgba(74, 144, 217, 0.22),
              5px 0 36px -8px rgba(45, 74, 62, 0.18),
              inset -1px 0 18px -10px rgba(74, 144, 217, 0.06);
          }
        }
        @keyframes octopus-pulse-burst {
          0% {
            box-shadow:
              4px 0 24px -4px rgba(30, 120, 180, 0.25),
              6px 0 40px -8px rgba(45, 74, 62, 0.20),
              inset -1px 0 20px -10px rgba(30, 120, 180, 0.08);
          }
          15% {
            box-shadow:
              8px 0 50px -2px rgba(74, 144, 217, 0.55),
              12px 0 70px -4px rgba(45, 74, 62, 0.45),
              0 0 60px -8px rgba(30, 200, 140, 0.30),
              inset -2px 0 30px -6px rgba(74, 144, 217, 0.20);
          }
          35% {
            box-shadow:
              6px 0 40px -2px rgba(45, 200, 130, 0.50),
              10px 0 60px -4px rgba(74, 144, 217, 0.40),
              0 0 50px -8px rgba(255, 215, 0, 0.15),
              inset -2px 0 28px -6px rgba(45, 200, 130, 0.15);
          }
          55% {
            box-shadow:
              8px 0 55px -2px rgba(74, 144, 217, 0.48),
              14px 0 75px -4px rgba(45, 74, 62, 0.38),
              0 0 45px -8px rgba(30, 200, 140, 0.25),
              inset -2px 0 32px -6px rgba(74, 144, 217, 0.18);
          }
          80% {
            box-shadow:
              5px 0 32px -3px rgba(30, 120, 180, 0.32),
              7px 0 48px -6px rgba(45, 74, 62, 0.25),
              inset -1px 0 22px -8px rgba(30, 120, 180, 0.10);
          }
          100% {
            box-shadow:
              4px 0 24px -4px rgba(30, 120, 180, 0.25),
              6px 0 40px -8px rgba(45, 74, 62, 0.20),
              inset -1px 0 20px -10px rgba(30, 120, 180, 0.08);
          }
        }
        .sidebar-3d-glow {
          animation: octopus-ambient 8s ease-in-out infinite;
          border-right: 1px solid rgba(74, 144, 217, 0.12);
        }
        .sidebar-3d-glow.pulse-active {
          animation: octopus-pulse-burst 2.4s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
        }
        .sidebar-3d-glow::before {
          content: '';
          position: absolute;
          top: 0;
          right: -1px;
          width: 2px;
          height: 100%;
          background: linear-gradient(
            180deg,
            transparent 0%,
            rgba(74, 144, 217, 0.3) 20%,
            rgba(45, 200, 130, 0.25) 50%,
            rgba(74, 144, 217, 0.3) 80%,
            transparent 100%
          );
          z-index: 1;
        }
        .sidebar-3d-glow::after {
          content: '';
          position: absolute;
          top: 0;
          right: -6px;
          width: 6px;
          height: 100%;
          background: linear-gradient(
            90deg,
            rgba(45, 74, 62, 0.08) 0%,
            transparent 100%
          );
          z-index: 0;
          pointer-events: none;
        }
      `}</style>

      {/* Boton hamburguesa movil */}
      {!mobileOpen && (
        <button
          onClick={() => setMobileOpen(true)}
          className="lg:hidden fixed top-4 left-4 z-[60] p-2.5 rounded-xl bg-[#1A1A1A] text-[#F5F0E8] shadow-lg active:scale-95 transition-transform"
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      {/* Overlay movil */}
      <AnimatePresence>
        {mobileOpen && !isDesktop && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 bg-black/50 z-[55] backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Sidebar con sombra 3D azul-verde */}
      <motion.aside
        initial={false}
        animate={{
          width: sidebarWidth,
          x: sidebarX,
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={cn(
          'h-screen bg-[#1A1A1A] flex flex-col fixed left-0 top-0 z-[60] sidebar-3d-glow',
          glowPulse && 'pulse-active'
        )}
      >
        {/* Logo Section */}
        <div className="p-6 flex items-center gap-3">
          <motion.div
            whileHover={{ scale: 1.1 }}
            transition={{ duration: 0.3 }}
            className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden transition-shadow duration-700',
              glowPulse
                ? 'shadow-[0_0_20px_rgba(74,144,217,0.5),0_0_40px_rgba(45,200,130,0.3)]'
                : 'shadow-lg'
            )}
          >
            <Image
              src="/octopus-core-logo.png"
              alt="OCTOPUS Core"
              width={48}
              height={48}
              className="w-12 h-12 object-cover scale-[1.45]"
              priority
            />
          </motion.div>
          <AnimatePresence>
            {(!collapsed || !isDesktop) && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex-1 min-w-0"
              >
                {/* OCTOPUS wordmark (sci-fi metallic typography) */}
                <h1 className="leading-none">
                  <span className="sr-only">Octopus</span>
                  <Image
                    src="/brand/octopus-wordmark.png"
                    alt="OCTOPUS"
                    width={520}
                    height={104}
                    priority
                    className="h-6 w-auto object-contain select-none"
                    style={{ filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.25))' }}
                  />
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-[10px] text-[#F5F0E8]/60 tracking-[0.25em] uppercase">Omni Cockpit</p>
                  {usage && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      usage.planId === 'business' ? 'bg-[#FFD700]/20 text-[#FFD700]' :
                      usage.planId === 'pro' ? 'bg-[#C4622D]/20 text-[#F0A070]' :
                      'bg-white/10 text-white/50'
                    }`}>
                      {usage.planId}
                    </span>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Boton cerrar en movil */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1 rounded-lg text-[#F5F0E8]/60 hover:text-[#F5F0E8] hover:bg-[#F5F0E8]/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-hide">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            const isOctopus = item.label === 'OCTOPUS'
            const showLabel = !collapsed || !isDesktop
            return (
              <Link key={item.href} href={item.href} data-tour-id={item.href.replace('/dashboard/', 'nav-').replace('/dashboard', 'nav-dashboard').replace('/pricing', 'nav-pricing').replace('/settings', 'nav-settings')}>
                <motion.div
                  whileHover={{ x: 4 }}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 cursor-pointer',
                    isActive
                      ? isOctopus
                        ? 'bg-[#4A90D9] text-[#F5F0E8]'
                        : 'bg-[#2D4A3E] text-[#F5F0E8]'
                      : 'text-[#F5F0E8]/60 hover:bg-[#F5F0E8]/10 hover:text-[#F5F0E8]'
                  )}
                >
                  <item.icon className={cn(
                    'w-5 h-5 flex-shrink-0',
                    isOctopus && !isActive && 'text-[#4A90D9]'
                  )} />
                  <AnimatePresence>
                    {showLabel && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center justify-between flex-1 min-w-0"
                      >
                        <span className="font-medium truncate">{item.label}</span>
                        {item.badge && (
                          <span className={cn(
                            'text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ml-2',
                            item.badge === 'AI'
                              ? 'bg-[#4A90D9]/30 text-[#7BB8FF]'
                              : item.badge === 'ADMIN'
                              ? 'bg-[#FFD700]/20 text-[#FFD700]'
                              : 'bg-[#C4622D]/30 text-[#F0A070]'
                          )}>
                            {item.badge}
                          </span>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </Link>
            )
          })}
        </nav>

        {/* Plan Usage — compact widget */}
        {usage && usage.planId === 'starter' && !collapsed && (
          <div className="px-4 py-3 mx-3 mb-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
                {t('nav.plan') || 'Plan'} Starter
              </span>
              <Link href="/pricing">
                <span className="text-[10px] font-semibold text-[#FFD700] hover:text-[#FFD700]/80 cursor-pointer">
                  Upgrade
                </span>
              </Link>
            </div>
            {[
              { label: 'Leads', c: usage.leads.current, l: usage.leads.limit, color: '#FFD700' },
              { label: 'Creative', c: usage.creative.current, l: usage.creative.limit, color: '#8B5CF6' },
              { label: 'IoT', c: usage.iot.current, l: usage.iot.limit, color: '#0EA5E9' },
              { label: 'API Keys', c: usage.api_keys.current, l: usage.api_keys.limit, color: '#6366F1' },
              { label: 'Brazos', c: usage.brazos.current, l: usage.brazos.limit, color: '#14B8A6' },
            ].map(({ label, c, l, color }) => (
              <div key={label} className="mb-1.5 last:mb-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] text-white/40">{label}</span>
                  <span className="text-[10px] font-mono text-white/30">{c}/{l > 99999 ? '∞' : l}</span>
                </div>
                <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.min(100, (c / Math.max(l, 1)) * 100)}%`,
                      backgroundColor: c >= l ? '#EF4444' : color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Collapse Button - solo desktop */}
        <div className="p-4 hidden lg:block">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center p-3 rounded-2xl bg-[#F5F0E8]/10 text-[#F5F0E8]/60 hover:bg-[#F5F0E8]/20 hover:text-[#F5F0E8] transition-all duration-300"
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>
      </motion.aside>
    </>
  )
}
