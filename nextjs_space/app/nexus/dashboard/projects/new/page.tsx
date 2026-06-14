import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import NexusNewProjectForm from '@/components/nexus/NewProjectForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'New project \u2014 Nexus' }

export default async function NewProjectPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login?callbackUrl=/nexus/dashboard/projects/new')

  return (
    <main className="nexus-dashboard">
      <header className="nexus-dash-header">
        <div className="nexus-container">
          <div className="nexus-dash-header-inner">
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <a href="/nexus" className="nexus-logo">NEXUS</a>
              <span className="nexus-dash-label">New project</span>
            </div>
            <a href="/nexus/dashboard" className="nexus-btn-ghost nexus-btn-sm">\u2190 Back</a>
          </div>
        </div>
      </header>
      <div className="nexus-container nexus-dash-body">
        <div className="nexus-form-wrapper">
          <div className="nexus-form-header">
            <h1>Launch your project</h1>
            <p>Fill in the details and pay $19.99 to start distribution.</p>
          </div>
          <NexusNewProjectForm />
        </div>
      </div>
    </main>
  )
}
