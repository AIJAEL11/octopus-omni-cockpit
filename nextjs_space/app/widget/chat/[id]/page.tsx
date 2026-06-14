'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'

export const dynamic = 'force-dynamic'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface AgentConfig {
  id: string
  name: string
  productName: string
  productDesc: string
  productPrice: string | null
  purchaseLink: string | null
  greeting: string | null
  accentColor: string
  logoUrl: string | null
  isActive: boolean
}

export default function ChatWidgetPage() {
  const params = useParams()
  const agentId = params?.id as string
  const [agent, setAgent] = useState<AgentConfig | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [minimized, setMinimized] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [leadCaptured, setLeadCaptured] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const visitorId = useRef('')
  const utmParams = useRef<Record<string, string>>({})

  useEffect(() => {
    setMounted(true)
    // Generate or restore visitor ID
    try {
      const stored = localStorage.getItem(`octopus_visitor_${agentId}`)
      if (stored) {
        visitorId.current = stored
      } else {
        const id = `v_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        localStorage.setItem(`octopus_visitor_${agentId}`, id)
        visitorId.current = id
      }
    } catch {
      visitorId.current = `v_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    }

    // Capture UTM params from parent URL or current URL
    try {
      const params = new URLSearchParams(window.location.search)
      const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ad_platform', 'ad_id', 'adset_id', 'fbclid', 'gclid', 'li_fat_id']
      utmKeys.forEach(k => { if (params.get(k)) utmParams.current[k] = params.get(k)! })
      // Also try to get referrer as landing page
      if (document.referrer) utmParams.current.landingPage = document.referrer
      // Auto-detect source from click IDs
      if (params.get('fbclid')) { utmParams.current.utm_source = 'facebook'; utmParams.current.ad_platform = 'facebook_ads' }
      if (params.get('gclid')) { utmParams.current.utm_source = 'google'; utmParams.current.ad_platform = 'google_ads' }
      if (params.get('li_fat_id')) { utmParams.current.utm_source = 'linkedin'; utmParams.current.ad_platform = 'linkedin_ads' }
    } catch { /* ignore in iframes */ }
  }, [agentId])

  // Auto-capture lead when buying signals detected
  const captureLead = async (signal: string, contactInfo?: { name?: string, email?: string, phone?: string }) => {
    if (leadCaptured && !contactInfo?.email) return // Only capture once unless new contact info
    try {
      await fetch('/api/sales-agent/capture-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          visitorId: visitorId.current,
          visitorName: contactInfo?.name || null,
          visitorEmail: contactInfo?.email || null,
          visitorPhone: contactInfo?.phone || null,
          source: utmParams.current.utm_source || 'direct',
          medium: utmParams.current.utm_medium || null,
          campaign: utmParams.current.utm_campaign || null,
          adPlatform: utmParams.current.ad_platform || null,
          adId: utmParams.current.ad_id || null,
          adSetId: utmParams.current.adset_id || null,
          landingPage: utmParams.current.landingPage || null,
          messageCount: messages.length,
          buyingSignal: signal,
        }),
      })
      setLeadCaptured(true)
    } catch { /* silent */ }
  }

  useEffect(() => {
    if (!agentId) return
    fetch(`/api/sales-agent/${agentId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
        } else {
          setAgent(data)
          if (data.greeting) {
            setMessages([{ role: 'assistant', content: data.greeting }])
          }
        }
      })
      .catch(() => setError('Error al cargar el agente'))
  }, [agentId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || sending || !agent) return
    setInput('')
    const userMsg: Message = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setSending(true)

    try {
      const res = await fetch('/api/sales-agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agent.id,
          messages: newMessages,
          visitorId: visitorId.current,
        }),
      })
      const data = await res.json()
      if (data.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
      }

      // Auto-detect buying signals from user message
      const lower = text.toLowerCase()
      const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/)
      const phoneMatch = text.match(/[\+]?[\d\s\-\(\)]{7,}/)
      if (emailMatch) {
        captureLead('hot', { email: emailMatch[0] })
      } else if (phoneMatch && lower.match(/tel[eé]fono|whatsapp|llam|contacto|n[uú]mero/)) {
        captureLead('hot', { phone: phoneMatch[0].trim() })
      } else if (lower.match(/comprar|compr[oé]|lo quiero|me interesa|c[oó]mo pago|quiero pagar|d[oó]nde compro|link|enlace|precio especial/)) {
        captureLead('hot')
      } else if (newMessages.length >= 5 && !leadCaptured) {
        captureLead('warm')
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Disculpa, hubo un error. ¿Puedes intentar de nuevo?' }])
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (!mounted) return null

  const accentColor = agent?.accentColor || '#C4622D'

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1A1A1A', color: '#F5F0E8', fontFamily: 'system-ui, -apple-system, sans-serif', padding: 20, textAlign: 'center' as const }}>
        <div>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🐙</div>
          <p style={{ opacity: 0.6 }}>{error}</p>
        </div>
      </div>
    )
  }

  if (!agent) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1A1A1A' }}>
        <div style={{ width: 32, height: 32, border: `3px solid ${accentColor}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // Minimized state - just a bubble
  if (minimized) {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', height: '100vh', padding: 16 }}>
        <button
          onClick={() => setMinimized(false)}
          style={{
            width: 60, height: 60, borderRadius: '50%', background: accentColor,
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 20px ${accentColor}40`, transition: 'transform 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column' as const, height: '100vh',
      background: '#1A1A1A', fontFamily: 'system-ui, -apple-system, sans-serif',
      borderRadius: 16, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        background: accentColor, padding: '14px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }}>
            🐙
          </div>
          <div>
            <div style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>{agent.name}</div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>
              <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#4ADE80', marginRight: 4 }} />
              En l\u00ednea
            </div>
          </div>
        </div>
        <button
          onClick={() => setMinimized(true)}
          style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M18 15l-6-6-6 6" /></svg>
        </button>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto' as const, padding: 16,
        display: 'flex', flexDirection: 'column' as const, gap: 12,
      }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex',
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
          }}>
            <div style={{
              maxWidth: '85%', padding: '10px 14px', borderRadius: 16,
              fontSize: 14, lineHeight: '1.5', wordBreak: 'break-word' as const,
              ...(msg.role === 'user'
                ? { background: accentColor, color: 'white', borderBottomRightRadius: 4 }
                : { background: '#2A2A2A', color: '#F5F0E8', borderBottomLeftRadius: 4 }),
            }}>
              {msg.content}
            </div>
          </div>
        ))}
        {sending && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ background: '#2A2A2A', padding: '10px 18px', borderRadius: 16, borderBottomLeftRadius: 4 }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 7, height: 7, borderRadius: '50%', background: accentColor, opacity: 0.6,
                    animation: `bounce 1.2s ease-in-out ${i * 0.15}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '12px 16px', borderTop: '1px solid rgba(245,240,232,0.08)',
        display: 'flex', gap: 8,
      }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe un mensaje..."
          disabled={sending}
          style={{
            flex: 1, padding: '10px 14px', background: '#2A2A2A', border: '1px solid rgba(245,240,232,0.1)',
            borderRadius: 12, color: '#F5F0E8', fontSize: 14, outline: 'none',
          }}
        />
        <button
          onClick={sendMessage}
          disabled={sending || !input.trim()}
          style={{
            width: 40, height: 40, borderRadius: 12, background: accentColor,
            border: 'none', cursor: sending || !input.trim() ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: sending || !input.trim() ? 0.5 : 1, transition: 'opacity 0.2s',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>

      {/* Powered by */}
      <div style={{
        padding: '6px 16px 10px', textAlign: 'center' as const,
        fontSize: 10, color: 'rgba(245,240,232,0.3)',
      }}>
        Powered by 🐙 OCTOPUS
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0) }
          30% { transform: translateY(-6px) }
        }
        input::placeholder { color: rgba(245,240,232,0.3) }
        ::-webkit-scrollbar { width: 4px }
        ::-webkit-scrollbar-track { background: transparent }
        ::-webkit-scrollbar-thumb { background: rgba(245,240,232,0.15); border-radius: 2px }
        * { box-sizing: border-box; margin: 0; padding: 0 }
        body { margin: 0; background: transparent }
      `}</style>
    </div>
  )
}
