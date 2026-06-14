import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import NexusMetricsChart from '@/components/nexus/MetricsChart'
import NexusLaunchButton from '@/components/nexus/LaunchButton'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Project metrics \u2014 Nexus' }

type Props = { params: { id: string } }

export default async function ProjectDetailPage({ params }: Props) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login?callbackUrl=/nexus/dashboard')

  const project = await prisma.nexusProject.findUnique({
    where: { id: params.id },
    include: {
      launches: {
        orderBy: { createdAt: 'desc' },
        include: { events: { select: { eventType: true, createdAt: true }, orderBy: { createdAt: 'asc' }, take: 1000 } }
      },
      guardianReview: true
    }
  })

  if (!project) notFound()
  // Allow admin or owner
  const isAdmin = session.user.email === '1billontopview@gmail.com'
  if (project.userId !== session.user.id && !isAdmin) redirect('/nexus/dashboard')

  const activeLaunch = project.launches.find(l => l.status === 'ACTIVE')
  const totalImpressions = project.launches.reduce((s, l) => s + l.impressions, 0)
  const totalClicks = project.launches.reduce((s, l) => s + l.clicks, 0)
  const totalReaches = project.launches.reduce((s, l) => s + l.reaches, 0)
  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00'

  // Chart data: last 30 days
  const last30: string[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    last30.push(d.toISOString().split('T')[0])
  }
  const byDay: Record<string, { impressions: number; clicks: number }> = {}
  last30.forEach(d => { byDay[d] = { impressions: 0, clicks: 0 } })
  project.launches.forEach(launch => {
    launch.events.forEach(event => {
      const day = event.createdAt.toISOString().split('T')[0]
      if (byDay[day]) {
        if (event.eventType === 'IMPRESSION') byDay[day].impressions++
        if (event.eventType === 'CLICK') byDay[day].clicks++
      }
    })
  })
  const chartData = last30.map(date => ({ date: date.slice(5), impressions: byDay[date].impressions, clicks: byDay[date].clicks }))

  const statusMap: Record<string, { label: string; color: string }> = {
    PENDING_PAYMENT: { label: 'Pending payment', color: 'nexus-status-warning' },
    PENDING_REVIEW: { label: 'Under Guardian review', color: 'nexus-status-warning' },
    APPROVED: { label: 'Approved \u2014 ready to launch', color: 'nexus-status-success' },
    ACTIVE: { label: 'Active \u2014 in distribution', color: 'nexus-status-success' },
    REJECTED: { label: 'Rejected', color: 'nexus-status-error' },
    EXHAUSTED: { label: 'Exhausted', color: 'nexus-status-muted' },
    PAUSED: { label: 'Paused', color: 'nexus-status-muted' }
  }
  const status = statusMap[project.status] || { label: project.status, color: 'nexus-status-muted' }

  return (
    <main className="nexus-dashboard">
      <header className="nexus-dash-header">
        <div className="nexus-container">
          <div className="nexus-dash-header-inner">
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Link href="/nexus" className="nexus-logo">NEXUS</Link>
              <span className="nexus-dash-label">{project.name}</span>
            </div>
            <Link href="/nexus/dashboard" className="nexus-btn-ghost nexus-btn-sm">\u2190 Dashboard</Link>
          </div>
        </div>
      </header>

      <div className="nexus-container nexus-dash-body">
        <div className={`nexus-status-banner ${status.color}`}>
          <span>{status.label}</span>
          {project.guardianReview?.flags && project.guardianReview.flags.length > 0 && (
            <div className="nexus-flags">
              {project.guardianReview.flags.map((flag: string) => <span key={flag} className="nexus-flag">{flag.replace(/_/g, ' ')}</span>)}
            </div>
          )}
        </div>

        <div className="nexus-stats-grid">
          <div className="nexus-stat-card"><span className="nexus-stat-label">Impressions</span><span className="nexus-stat-value">{totalImpressions.toLocaleString()}</span></div>
          <div className="nexus-stat-card"><span className="nexus-stat-label">Clicks</span><span className="nexus-stat-value">{totalClicks.toLocaleString()}</span></div>
          <div className="nexus-stat-card"><span className="nexus-stat-label">Unique reach</span><span className="nexus-stat-value">{totalReaches.toLocaleString()}</span></div>
          <div className="nexus-stat-card"><span className="nexus-stat-label">CTR</span><span className="nexus-stat-value">{ctr}%</span></div>
        </div>

        <div className="nexus-chart-card">
          <h3>Activity \u2014 last 30 days</h3>
          <NexusMetricsChart data={chartData} />
        </div>

        <div className="nexus-project-detail-grid">
          <div className="nexus-project-info-card">
            <h3>Project info</h3>
            <div className="nexus-info-row"><span>Name</span><strong>{project.name}</strong></div>
            <div className="nexus-info-row"><span>URL</span><a href={project.url} target="_blank" rel="noopener noreferrer">{project.url}</a></div>
            <div className="nexus-info-row"><span>Category</span><strong>{project.category || '\u2014'}</strong></div>
            <div className="nexus-info-row"><span>Created</span><strong>{new Date(project.createdAt).toLocaleDateString()}</strong></div>
            {activeLaunch?.activatedAt && <div className="nexus-info-row"><span>Active since</span><strong>{new Date(activeLaunch.activatedAt).toLocaleDateString()}</strong></div>}
          </div>
          <div className="nexus-launch-card">
            <h3>Launch</h3>
            {project.status === 'PENDING_PAYMENT' && <><p className="nexus-launch-info">Your project is ready. Pay to start distribution.</p><NexusLaunchButton projectId={project.id} /></>}
            {project.status === 'PENDING_REVIEW' && <p className="nexus-launch-info">The Guardian Agent is reviewing your project. You will receive an email when approved.</p>}
            {project.status === 'ACTIVE' && <p className="nexus-launch-info nexus-text-success">Your project is in active distribution. Metrics update in real time.</p>}
            {project.status === 'REJECTED' && <p className="nexus-launch-info nexus-text-error">Your project was rejected. Fix the issues and relaunch.</p>}
            {project.status === 'EXHAUSTED' && <><p className="nexus-launch-info">This launch is exhausted. You can relaunch to continue distribution.</p><NexusLaunchButton projectId={project.id} label="Relaunch \u2014 $19.99" /></>}
          </div>
        </div>
      </div>
    </main>
  )
}
