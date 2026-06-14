import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Dashboard \u2014 Nexus' }

export default async function NexusDashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login?callbackUrl=/nexus/dashboard')

  const projects = await prisma.nexusProject.findMany({
    where: { userId: session.user.id },
    include: {
      launches: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, status: true, impressions: true, clicks: true, reaches: true, activatedAt: true }
      },
      guardianReview: { select: { status: true, flags: true } }
    },
    orderBy: { createdAt: 'desc' }
  })

  const totalImpressions = projects.reduce((sum, p) => sum + p.launches.reduce((s, l) => s + l.impressions, 0), 0)
  const totalClicks = projects.reduce((sum, p) => sum + p.launches.reduce((s, l) => s + l.clicks, 0), 0)
  const activeProjects = projects.filter(p => p.status === 'ACTIVE').length

  const statusMap: Record<string, { label: string; color: string }> = {
    PENDING_PAYMENT: { label: 'Pending payment', color: 'nexus-status-warning' },
    PENDING_REVIEW: { label: 'In review', color: 'nexus-status-warning' },
    APPROVED: { label: 'Approved', color: 'nexus-status-success' },
    ACTIVE: { label: 'Active', color: 'nexus-status-success' },
    REJECTED: { label: 'Rejected', color: 'nexus-status-error' },
    EXHAUSTED: { label: 'Exhausted', color: 'nexus-status-muted' },
    PAUSED: { label: 'Paused', color: 'nexus-status-muted' }
  }

  return (
    <main className="nexus-dashboard">
      <header className="nexus-dash-header">
        <div className="nexus-container">
          <div className="nexus-dash-header-inner">
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Link href="/nexus" className="nexus-logo">NEXUS</Link>
              <span className="nexus-dash-label">Dashboard</span>
            </div>
            <div className="nexus-dash-header-right">
              <span className="nexus-dash-user">{session.user.email}</span>
              <Link href="/dashboard" className="nexus-btn-ghost nexus-btn-sm">\u2190 Octopus</Link>
            </div>
          </div>
        </div>
      </header>

      <div className="nexus-container nexus-dash-body">
        <div className="nexus-stats-grid">
          <div className="nexus-stat-card"><span className="nexus-stat-label">Active projects</span><span className="nexus-stat-value">{activeProjects}</span></div>
          <div className="nexus-stat-card"><span className="nexus-stat-label">Total impressions</span><span className="nexus-stat-value">{totalImpressions.toLocaleString()}</span></div>
          <div className="nexus-stat-card"><span className="nexus-stat-label">Total clicks</span><span className="nexus-stat-value">{totalClicks.toLocaleString()}</span></div>
          <div className="nexus-stat-card"><span className="nexus-stat-label">Avg CTR</span><span className="nexus-stat-value">{totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00'}%</span></div>
        </div>

        <div className="nexus-dash-section">
          <div className="nexus-dash-section-header">
            <h2>My projects</h2>
            <Link href="/nexus/dashboard/projects/new" className="nexus-btn-primary">+ New project</Link>
          </div>

          {projects.length === 0 ? (
            <div className="nexus-empty">
              <div className="nexus-empty-icon">{"\uD83D\uDE80"}</div>
              <h3>No projects yet</h3>
              <p>Launch your first project and reach your audience today.</p>
              <Link href="/nexus/dashboard/projects/new" className="nexus-btn-primary">Create my first project \u2192</Link>
            </div>
          ) : (
            <div className="nexus-projects-list">
              {projects.map(project => {
                const launch = project.launches[0]
                const ctr = launch && launch.impressions > 0 ? ((launch.clicks / launch.impressions) * 100).toFixed(2) : '0.00'
                const status = statusMap[project.status] || { label: project.status, color: 'nexus-status-muted' }
                return (
                  <div key={project.id} className="nexus-project-card">
                    <div className="nexus-project-card-left">
                      {project.imageUrl && <img src={project.imageUrl} alt={project.name} className="nexus-project-thumb" />}
                      <div>
                        <div className="nexus-project-card-top">
                          <h3 className="nexus-project-name">{project.name}</h3>
                          <span className={`nexus-status-badge ${status.color}`}>{status.label}</span>
                        </div>
                        <p className="nexus-project-desc">{project.description.slice(0, 120)}...</p>
                        {project.category && <span className="nexus-project-category">{project.category}</span>}
                      </div>
                    </div>
                    <div className="nexus-project-card-metrics">
                      <div className="nexus-metric"><span className="nexus-metric-val">{launch?.impressions.toLocaleString() || '0'}</span><span className="nexus-metric-label">Impressions</span></div>
                      <div className="nexus-metric"><span className="nexus-metric-val">{launch?.clicks.toLocaleString() || '0'}</span><span className="nexus-metric-label">Clicks</span></div>
                      <div className="nexus-metric"><span className="nexus-metric-val">{ctr}%</span><span className="nexus-metric-label">CTR</span></div>
                    </div>
                    <div className="nexus-project-card-actions">
                      <Link href={`/nexus/dashboard/projects/${project.id}`} className="nexus-btn-ghost nexus-btn-sm">Metrics</Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
