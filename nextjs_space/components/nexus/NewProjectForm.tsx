'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const CATEGORIES = [
  'Software & Apps', 'SaaS', 'Courses & Education', 'Services',
  'E-commerce', 'Health & Wellness', 'Finance', 'Marketing',
  'Art & Design', 'Music', 'Sports', 'Gastronomy', 'Travel', 'Technology', 'AI'
]

export default function NexusNewProjectForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '', description: '', url: '', imageUrl: '', category: '', tags: ''
  })

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.name || !form.description || !form.url) {
      setError('Name, description, and URL are required.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/nexus/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          tags: form.tags.split(',').map(t => t.trim()).filter(Boolean)
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create project')
      router.push(`/nexus/dashboard/projects/${data.id}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="nexus-form" onSubmit={handleSubmit}>
      {error && <div className="nexus-form-error">{error}</div>}

      <div className="nexus-input-wrap">
        <label>Project name *</label>
        <input value={form.name} onChange={e => update('name', e.target.value)} placeholder="My awesome project" maxLength={100} />
      </div>

      <div className="nexus-input-wrap">
        <label>Description *</label>
        <textarea value={form.description} onChange={e => update('description', e.target.value)} placeholder="What does your project do? Who is it for?" rows={4} maxLength={500} />
        <span className="nexus-char-count">{form.description.length}/500</span>
      </div>

      <div className="nexus-input-row">
        <div className="nexus-input-wrap">
          <label>Project URL *</label>
          <input value={form.url} onChange={e => update('url', e.target.value)} placeholder="https://myproject.com" type="url" />
        </div>
        <div className="nexus-input-wrap">
          <label>Image URL (optional)</label>
          <input value={form.imageUrl} onChange={e => update('imageUrl', e.target.value)} placeholder="https://www.shutterstock.com/image-vector/project-management-company-logo-template-260nw-2348597749.jpg" />
        </div>
      </div>

      <div className="nexus-input-row">
        <div className="nexus-input-wrap">
          <label>Category</label>
          <select value={form.category} onChange={e => update('category', e.target.value)}>
            <option value="">Select category</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="nexus-input-wrap">
          <label>Tags (comma separated)</label>
          <input value={form.tags} onChange={e => update('tags', e.target.value)} placeholder="ai, saas, productivity" />
        </div>
      </div>

      <div className="nexus-form-footer">
        <div className="nexus-price-info">
          <span className="nexus-price-amount">$19.99</span>
          <span className="nexus-price-desc">One-time launch fee</span>
        </div>
        <button type="submit" className="nexus-btn-primary nexus-btn-lg" disabled={loading}>
          {loading ? 'Creating...' : 'Create & Launch \u2192'}
        </button>
      </div>
    </form>
  )
}
