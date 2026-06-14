'use client'

import { useSession } from 'next-auth/react'
import { redirect, usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { MetricsProvider } from '@/lib/metrics-context'
import { WorkspaceProvider } from '@/lib/workspace-context'

// Pages that act as full-height shells — no layout padding
const FULL_HEIGHT_ROUTES = new Set(['/dashboard', '/dashboard/jarvis', '/dashboard/claude-code', '/dashboard/ollama-chat'])

// Lazy-load non-critical monitors and helpers (they run in background, no visible UI needed immediately)
const BrazosHealthMonitor = dynamic(() => import('@/components/brazos-health-monitor').then(m => m.BrazosHealthMonitor), { ssr: false })
const SchedulerMonitor = dynamic(() => import('@/components/scheduler-monitor').then(m => m.SchedulerMonitor), { ssr: false })
const OctoGuideBubble = dynamic(() => import('@/components/octo-guide-bubble').then(m => m.OctoGuideBubble), { ssr: false })
const PlanLimitToast = dynamic(() => import('@/components/plan-limit-toast').then(m => m.PlanLimitToast), { ssr: false })
const OnboardingTour = dynamic(() => import('@/components/onboarding-tour').then(m => m.OnboardingTour), { ssr: false })
const RouteLightSweep = dynamic(() => import('@/components/fx/route-light-sweep').then(m => m.RouteLightSweep), { ssr: false })

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { status } = useSession() || {}
  const pathname = usePathname()
  const isShell = FULL_HEIGHT_ROUTES.has(pathname)

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2D4A3E]"></div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    redirect('/login')
  }

  return (
    <MetricsProvider>
      <WorkspaceProvider>
        <BrazosHealthMonitor />
        <SchedulerMonitor />
        <OctoGuideBubble />
        <PlanLimitToast />
        <OnboardingTour />
        <RouteLightSweep />
        <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-500">
          <Sidebar />
          <div className="lg:ml-[280px] transition-[margin] duration-300">
            <Header />
            <main className={isShell ? 'p-0' : 'p-4 sm:p-6 lg:p-8'}>{children}</main>
          </div>
        </div>
      </WorkspaceProvider>
    </MetricsProvider>
  )
}
