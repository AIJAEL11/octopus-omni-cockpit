'use client'

import { motion } from 'framer-motion'
import { useSession, signOut } from 'next-auth/react'
import {
  Zap,
  Cpu,
  Brain,
  Link2,
  LogOut,
  Boxes,
  Settings,
} from 'lucide-react'
import Link from 'next/link'
import { useMetrics } from '@/lib/metrics-context'
import { useI18n } from '@/lib/i18n-context'
import { WorkspaceSelector } from '@/components/workspace-selector'
import { ThemePicker } from '@/components/theme-picker'

interface MetricCardProps {
  icon: React.ElementType
  label: string
  value: string | number
  pulse?: boolean
}

function MetricCard({ icon: Icon, label, value, pulse }: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 bg-[var(--bg-primary)] rounded-2xl border border-[var(--border-color)]"
    >
      <div className={`p-1.5 sm:p-2 rounded-xl bg-[#2D4A3E]/10 dark:bg-[#2D4A3E]/30 ${pulse ? 'animate-pulse' : ''}`}>
        <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#2D4A3E] dark:text-[#5B9A7E]" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] sm:text-xs text-[var(--text-muted)] truncate">{label}</p>
        <p className="font-bold text-xs sm:text-sm text-[var(--text-primary)]">{value}</p>
      </div>
    </motion.div>
  )
}

export function Header() {
  const { data: session } = useSession() || {}
  const { metrics, turbo, toggleTurbo } = useMetrics()
  const { locale, setLocale } = useI18n()

  return (
    <header className="h-16 sm:h-20 bg-[var(--bg-secondary)]/80 backdrop-blur-xl border-b border-[var(--border-color)] flex items-center justify-between px-4 sm:px-6 lg:px-8 sticky top-0 z-40 transition-colors duration-500">
      {/* Spacer for mobile hamburger */}
      <div className="w-10 lg:hidden" />

      {/* Metrics - ocultar en pantallas pequenas, mostrar progresivamente */}
      <div className="hidden md:flex items-center gap-2 lg:gap-4 flex-shrink-0">
        <MetricCard
          icon={Zap}
          label="Tasks"
          value={metrics.tasksRunning}
          pulse={metrics.tasksRunning > 0}
        />
        <MetricCard
          icon={Boxes}
          label="Brazos"
          value={`${metrics.brazosActivos}/4`}
        />
        <div className="hidden lg:block">
          <MetricCard
            icon={Brain}
            label="Skills"
            value={metrics.skillsActive}
          />
        </div>
        <div className="hidden xl:block">
          <MetricCard
            icon={Link2}
            label="APIs"
            value={metrics.apiConnections}
          />
        </div>
      </div>

      {/* User Info & System Status */}
      <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 flex-shrink-0">
        {/* System Status - solo en pantallas grandes */}
        <div className="hidden xl:flex items-center gap-4 text-xs text-[var(--text-muted)]">
          <span className="flex items-center gap-1">
            <Cpu className="w-3 h-3" />
            CPU: {metrics.cpuUsage}%
          </span>
          <span>RAM: {metrics.ramUsage}</span>
        </div>

        {/* Theme Picker */}
        <ThemePicker />

        {/* Language Toggle */}
        <motion.button
          onClick={() => setLocale(locale === 'es' ? 'en' : 'es')}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-semibold text-xs transition-all border ${
            locale === 'en'
              ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
              : 'bg-[var(--bg-primary)] text-[var(--text-muted)] border-[var(--border-color)] hover:bg-[var(--hover-bg)]'
          }`}
          title={locale === 'es' ? 'Switch to English' : 'Cambiar a Español'}
        >
          <span className="text-sm">🌐</span>
          <span className="uppercase">{locale}</span>
        </motion.button>

        {/* Turbo Mode Toggle */}
        <motion.button
          onClick={toggleTurbo}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-2xl font-semibold text-xs transition-all ${
            turbo.enabled
              ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-400/30'
              : 'bg-[var(--bg-primary)] text-[var(--text-muted)] hover:bg-[var(--hover-bg)] border border-[var(--border-color)]'
          }`}
          title={turbo.enabled ? `Turbo: ${turbo.model || 'activo'} -- Click para desactivar` : 'Activar Turbo Mode'}
        >
          <motion.span
            animate={turbo.enabled ? { rotate: [0, 15, -15, 0], scale: [1, 1.2, 1] } : {}}
            transition={{ repeat: turbo.enabled ? Infinity : 0, duration: 1.5 }}
          >
            ⚡
          </motion.span>
          <span className="hidden sm:inline">
            {turbo.enabled ? 'TURBO' : 'Turbo'}
          </span>
          {turbo.enabled && turbo.model && (
            <span className="hidden xl:inline text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">
              {turbo.model.includes('/') ? turbo.model.split('/')[1]?.split('-').slice(0, 2).join('-') : turbo.model}
            </span>
          )}
        </motion.button>

        {/* Workspace Selector */}
        <div className="hidden md:block">
          <WorkspaceSelector />
        </div>

        {/* User Profile */}
        <div className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 bg-[var(--bg-primary)] rounded-2xl flex-shrink-0">
          {/* Avatar */}
          <Link href="/dashboard/settings" className="shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#2D4A3E] to-[#C4622D] flex items-center justify-center overflow-hidden">
              {session?.user?.image ? (
                <img src={session.user.image} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-bold text-white">
                  {session?.user?.name?.charAt(0)?.toUpperCase() || '🐙'}
                </span>
              )}
            </div>
          </Link>
          <div className="text-right hidden sm:block">
            <p className="font-bold text-[var(--text-primary)] text-sm truncate max-w-[120px]">
              {session?.user?.name?.split(' ')?.[0] ?? 'Usuario'}
            </p>
            <p className="text-xs text-[var(--text-muted)] truncate max-w-[120px]">
              {session?.user?.email ?? ''}
            </p>
          </div>
          <Link
            href="/dashboard/settings"
            className="p-2 rounded-xl bg-[#2D4A3E]/10 text-[#2D4A3E] dark:bg-[#2D4A3E]/30 dark:text-[#5B9A7E] hover:bg-[#2D4A3E]/20 transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="p-2 rounded-xl bg-[#C4622D]/10 text-[#C4622D] hover:bg-[#C4622D]/20 transition-colors"
            title="Cerrar sesion"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
