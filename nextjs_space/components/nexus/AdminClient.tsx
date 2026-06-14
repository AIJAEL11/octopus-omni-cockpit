'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface AdminStats {
  totalProjects: number
  activeProjects: number
  pendingReview: number
  totalLaunches: number
  totalRevenue: number
  totalEvents: number
}

interface AdminProject {
  id: string
  name: string
  url: string
  category: string
  status: string
  createdAt: string
  user: { email: string; name: string | null }
  launches: { impressions: number; clicks: number; status: string }[]
  guardianReview: { status: string; overallScore: number } | null
}

export function NexusAdminClient() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [projects, setProjects] = useState<AdminProject[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, projRes] = await Promise.all([
        fetch('/api/nexus/admin?view=overview'),
        fetch('/api/nexus/admin?view=projects')
      ])
      const statsData = await statsRes.json()
      const projData = await projRes.json()
      setStats(statsData)
      setProjects(projData.projects || [])
    } catch (err) { console.error(err) }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleAction(projectId: string, action: string) {
    setActionLoading(projectId)
    try {
      await fetch('/api/nexus/admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, action })
      })
      await fetchData()
    } catch (err) { console.error(err) }
    setActionLoading(null)
  }

  const statusColors: Record<string, string> = {
    ACTIVE: 'nexus-status-success', APPROVED: 'nexus-status-success',
    PENDING_PAYMENT: 'nexus-status-warning', PENDING_REVIEW: 'nexus-status-warning',
    REJECTED: 'nexus-status-error', EXHAUSTED: 'nexus-status-muted', PAUSED: 'nexus-status-muted'
  }

  if (loading) return (
    <main className="nexus-dashboard">
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--nexus-muted)' }}>
        Loading admin panel...
      </div>
    </main>
  )

  return (
    <main className="nexus-dashboard">
      <header className="nexus-dash-header">
        <div className="nexus-container">
          <div className="nexus-dash-header-inner">
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Link href="/nexus" className="nexus-logo">NEXUS</Link>
              <span className="nexus-dash-label" style={{ color: 'var(--nexus-error)' }}>ADMIN</span>
            </div>
            <div className="nexus-dash-header-right">
              <Link href="/nexus/dashboard" className="nexus-btn-ghost nexus-btn-sm">\u2190 Dashboard</Link>
            </div>
          </div>
        </div>
      </header>

      <div className="nexus-container nexus-dash-body">
        {stats && (
          <div className="nexus-stats-grid">
            <div className="nexus-stat-card"><span className="nexus-stat-label">Total projects</span><span className="nexus-stat-value">{stats.totalProjects}</span></div>
            <div className="nexus-stat-card"><span className="nexus-stat-label">Active</span><span className="nexus-stat-value" style={{ color: 'var(--nexus-success)' }}>{stats.activeProjects}</span></div>
            <div className="nexus-stat-card"><span className="nexus-stat-label">Pending review</span><span className="nexus-stat-value" style={{ color: 'var(--nexus-warning)' }}>{stats.pendingReview}</span></div>
            <div className="nexus-stat-card"><span className="nexus-stat-label">Revenue</span><span className="nexus-stat-value">${stats.totalRevenue.toFixed(2)}</span></div>
            <div className="nexus-stat-card"><span className="nexus-stat-label">Total launches</span><span className="nexus-stat-value">{stats.totalLaunches}</span></div>
            <div className="nexus-stat-card"><span className="nexus-stat-label">Total events</span><span className="nexus-stat-value">{stats.totalEvents.toLocaleString()}</span></div>
          </div>
        )}

        <div className="nexus-dash-section">
          <div className="nexus-dash-section-header">
            <h2>All projects ({projects.length})</h2>
            <button className="nexus-btn-ghost nexus-btn-sm" onClick={fetchData}>\u21bb Refresh</button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="nexus-admin-table">
              <thead>
                <tr>
                  <th>Project</th><th>Owner</th><th>Category</th><th>Status</th>
                  <th>Impressions</th><th>Clicks</th><th>Guardian</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map(p => {
                  const launch = p.launches[0]
                  return (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/nexus/dashboard/projects/${p.id}`} style={{ color: 'var(--nexus-text)', textDecoration: 'none', fontWeight: 600 }}>
                          {p.name}
                        </Link>
                      </td>
                      <td style={{ color: 'var(--nexus-muted)', fontSize: 13 }}>{p.user.email}</td>
                      <td><span className="nexus-project-category">{p.category || '\u2014'}</span></td>
                      <td><span className={`nexus-status-badge ${statusColors[p.status] || 'nexus-status-muted'}`}>{p.status}</span></td>
                      <td>{launch?.impressions || 0}</td>
                      <td>{launch?.clicks || 0}</td>
                      <td style={{ fontSize: 13 }}>{p.guardianReview ? `${p.guardianReview.status} (${p.guardianReview.overallScore})` : '\u2014'}</td>
                      <td>
                        <div className="nexus-admin-actions">
                          {(p.status === 'PENDING_REVIEW' || p.status === 'REJECTED') && (
                            <button className="nexus-btn-primary nexus-btn-sm" disabled={actionLoading === p.id}
                              onClick={() => handleAction(p.id, 'approve')}>\u2713 Approve</button>
                          )}
                          {p.status === 'ACTIVE' && (
                            <button className="nexus-btn-ghost nexus-btn-sm" disabled={actionLoading === p.id}
                              onClick={() => handleAction(p.id, 'pause')}>\u23F8 Pause</button>
                          )}
                          {p.status === 'PAUSED' && (
                            <button className="nexus-btn-primary nexus-btn-sm" disabled={actionLoading === p.id}
                              onClick={() => handleAction(p.id, 'activate')}>\u25B6 Activate</button>
                          )}
                          {p.status !== 'ACTIVE' && (
                            <button className="nexus-btn-ghost nexus-btn-sm" style={{ color: 'var(--nexus-error)' }} disabled={actionLoading === p.id}
                              onClick={() => { if (confirm('Delete this project?')) handleAction(p.id, 'delete') }}>\u2717</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  )
}
