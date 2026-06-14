'use client'

import { useState } from 'react'

export default function NexusLaunchButton({ projectId, label }: { projectId: string; label?: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLaunch() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/nexus/launches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create launch')
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      } else {
        window.location.reload()
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {error && <p style={{ color: 'var(--nexus-error)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <button
        className="nexus-btn-primary nexus-btn-full"
        onClick={handleLaunch}
        disabled={loading}
      >
        {loading ? 'Processing...' : (label || 'Pay & Launch \u2014 $19.99')}
      </button>
    </div>
  )
}
