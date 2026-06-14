'use client'

import { useState, useEffect, useRef } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

const PROMO_CODE = 'OCTOPUS-LIVE'
const PROMO_START = new Date('2026-05-07T00:00:00-04:00')
const PROMO_END   = new Date('2026-05-12T04:00:00-04:00')

function getPromoStatus(): 'before' | 'active' | 'expired' {
  const now = new Date()
  if (now < PROMO_START) return 'before'
  if (now > PROMO_END) return 'expired'
  return 'active'
}

function getCountdown(): { days: number; hours: number; mins: number; secs: number } | null {
  const now = new Date()
  const diff = PROMO_END.getTime() - now.getTime()
  if (diff <= 0) return null
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    mins: Math.floor((diff % 3600000) / 60000),
    secs: Math.floor((diff % 60000) / 1000),
  }
}

export default function PromoPage() {
  const [status, setStatus] = useState<'before' | 'active' | 'expired'>('active')
  const [step, setStep] = useState<'landing' | 'signup' | 'success'>('landing')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mounted, setMounted] = useState(false)
  const [countdown, setCountdown] = useState<ReturnType<typeof getCountdown>>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { data: session, status: authStatus } = useSession() || {}

  useEffect(() => {
    setMounted(true)
    setStatus(getPromoStatus())
    setCountdown(getCountdown())
    const iv = setInterval(() => {
      setCountdown(getCountdown())
      setStatus(getPromoStatus())
    }, 1000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    if (step === 'signup' && nameRef.current) nameRef.current.focus()
  }, [step])

  if (authStatus === 'authenticated') {
    router.replace('/dashboard')
    return null
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, promo: PROMO_CODE }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error === 'User already exists'
          ? 'This email already has an account \u2014 sign in at octopuskills.com'
          : data?.error ?? 'Error creating account')
        return
      }
      // Set locale to English for new promo users
      try {
        localStorage.setItem('octopus-locale', 'en')
        document.documentElement.lang = 'en'
      } catch {}
      const result = await signIn('credentials', { redirect: false, email, password })
      if (result?.ok) {
        setStep('success')
        setTimeout(() => router.replace('/onboarding'), 3500)
      }
    } catch {
      setError('Connection error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!mounted) return (
    <div className="min-h-screen bg-[#0a0e17] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-[100dvh] bg-[#0a0e17] relative overflow-hidden flex flex-col">
      {/* \u2500\u2500 CSS Animations \u2500\u2500 */}
      <style jsx>{`
        @keyframes float { 0%,100% { transform: translateY(0) rotate(0deg); opacity:0.3; } 50% { transform: translateY(-40px) rotate(180deg); opacity:0.6; } }
        @keyframes pulse-glow { 0%,100% { box-shadow: 0 0 20px rgba(196,98,45,0.2); } 50% { box-shadow: 0 0 40px rgba(196,98,45,0.4); } }
        @keyframes slide-up { from { opacity:0; transform:translateY(30px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slide-in-left { from { opacity:0; transform:translateX(-20px); } to { opacity:1; transform:translateX(0); } }
        @keyframes scale-in { from { opacity:0; transform:scale(0.8); } to { opacity:1; transform:scale(1); } }
        @keyframes count-pop { 0% { transform:scale(1); } 50% { transform:scale(1.1); } 100% { transform:scale(1); } }
        @keyframes progress-fill { from { width:0; } to { width:100%; } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .anim-float { animation: float var(--dur,8s) ease-in-out infinite; animation-delay: var(--delay,0s); }
        .anim-pulse { animation: pulse-glow 3s ease-in-out infinite; }
        .anim-up { animation: slide-up 0.6s ease-out both; }
        .anim-left { animation: slide-in-left 0.5s ease-out both; }
        .anim-scale { animation: scale-in 0.5s cubic-bezier(0.34,1.56,0.64,1) both; }
        .anim-pop { animation: count-pop 0.3s ease; }
        .anim-progress { animation: progress-fill 2.5s ease-out both; }
        .shimmer-bg { background: linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent); background-size:200% 100%; animation:shimmer 2s infinite; }
      `}</style>

      {/* \u2500\u2500 Ambient particles \u2500\u2500 */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div className="absolute top-[10%] left-[15%] w-2 h-2 bg-[#C4622D]/40 rounded-full anim-float" style={{ '--dur': '7s', '--delay': '0s' } as React.CSSProperties} />
        <div className="absolute top-[30%] right-[20%] w-1.5 h-1.5 bg-emerald-400/30 rounded-full anim-float" style={{ '--dur': '9s', '--delay': '1s' } as React.CSSProperties} />
        <div className="absolute top-[60%] left-[70%] w-2.5 h-2.5 bg-[#C4622D]/25 rounded-full anim-float" style={{ '--dur': '11s', '--delay': '2s' } as React.CSSProperties} />
        <div className="absolute top-[80%] left-[30%] w-1 h-1 bg-amber-300/20 rounded-full anim-float" style={{ '--dur': '6s', '--delay': '3s' } as React.CSSProperties} />
        <div className="absolute top-[45%] left-[5%] w-2 h-2 bg-emerald-500/20 rounded-full anim-float" style={{ '--dur': '10s', '--delay': '4s' } as React.CSSProperties} />
        {/* Radial glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[min(800px,100vw)] h-[500px] bg-[#C4622D]/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-emerald-600/6 rounded-full blur-[100px]" />
      </div>

      {/* \u2500\u2500 Content \u2500\u2500 */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12">

        {/* Logo */}
        <div className="mb-6 sm:mb-8 anim-up" style={{ animationDelay: '0.1s' }}>
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden ring-2 ring-[#C4622D]/30 mx-auto">
            <Image src="/octopus-core-logo.png" alt="Octopus Skills" width={64} height={64} className="w-full h-full object-cover scale-[1.45]" priority />
          </div>
        </div>

        {/* \u2550\u2550\u2550\u2550 EXPIRED \u2550\u2550\u2550\u2550 */}
        {status === 'expired' && (
          <div className="max-w-sm w-full text-center anim-up">
            <div className="bg-[#141a24]/80 backdrop-blur-xl border border-zinc-700/40 rounded-2xl p-6 sm:p-8">
              <div className="text-4xl mb-3">\u23f0</div>
              <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">Promo Expired</h1>
              <p className="text-zinc-400 text-sm mb-5">This promotion is no longer available, but you can create a free account.</p>
              <a href="/login" className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#C4622D] text-white text-sm font-semibold rounded-xl hover:bg-[#b5551f] active:scale-95 transition-all">
                Create Free Account \u2192
              </a>
            </div>
          </div>
        )}

        {/* \u2550\u2550\u2550\u2550 BEFORE \u2550\u2550\u2550\u2550 */}
        {status === 'before' && (
          <div className="max-w-sm w-full text-center anim-up">
            <div className="bg-[#141a24]/80 backdrop-blur-xl border border-[#C4622D]/20 rounded-2xl p-6 sm:p-8">
              <div className="text-4xl mb-3">\u2728</div>
              <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">Coming Soon!</h1>
              <p className="text-zinc-400 text-sm mb-1">This promotion will be available on</p>
              <p className="text-lg font-bold text-[#C4622D]">Wednesday, May 7th</p>
              <p className="text-zinc-600 text-xs mt-3">Valid until Sunday, May 11th</p>
            </div>
          </div>
        )}

        {/* \u2550\u2550\u2550\u2550 ACTIVE \u2014 LANDING \u2550\u2550\u2550\u2550 */}
        {status === 'active' && step === 'landing' && (
          <div className="max-w-lg w-full">
            {/* Badge */}
            <div className="text-center mb-5 sm:mb-6 anim-up" style={{ animationDelay: '0.15s' }}>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#C4622D]/15 border border-[#C4622D]/30 rounded-full text-[#e8864f] text-xs sm:text-sm font-medium">
                \ud83c\udf81 Exclusive Event Offer
              </span>
            </div>

            {/* Headline */}
            <div className="text-center mb-6 sm:mb-8 anim-up" style={{ animationDelay: '0.25s' }}>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white leading-tight mb-3">
                6 Months <span className="text-[#C4622D]">Pro</span>
                <br />
                <span className="text-2xl sm:text-3xl md:text-4xl">Completely Free</span>
              </h1>
              <p className="text-zinc-400 text-sm sm:text-base max-w-md mx-auto leading-relaxed">
                Your AI marketing platform. Create ads, videos and websites in seconds.
              </p>
            </div>

            {/* Benefits grid */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 mb-6 sm:mb-8">
              {[
                { emoji: '\u26a1', text: 'Unlimited AI Ads' },
                { emoji: '\ud83c\udfac', text: 'UGC Videos with AI Avatar' },
                { emoji: '\ud83d\udda5\ufe0f', text: 'Build websites in seconds' },
                { emoji: '\ud83d\udd13', text: 'All Pro features unlocked' },
              ].map((b, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2.5 bg-[#141a24]/60 backdrop-blur border border-[#2D4A3E]/20 rounded-xl px-3 py-2.5 sm:px-4 sm:py-3 anim-left"
                  style={{ animationDelay: `${0.35 + i * 0.08}s` }}
                >
                  <span className="text-lg sm:text-xl flex-shrink-0">{b.emoji}</span>
                  <span className="text-zinc-300 text-xs sm:text-sm leading-tight">{b.text}</span>
                </div>
              ))}
            </div>

            {/* Countdown */}
            {countdown && (
              <div className="flex justify-center gap-3 sm:gap-4 mb-6 anim-up" style={{ animationDelay: '0.6s' }}>
                {[
                  { val: countdown.days, lbl: 'days' },
                  { val: countdown.hours, lbl: 'hrs' },
                  { val: countdown.mins, lbl: 'min' },
                  { val: countdown.secs, lbl: 'sec' },
                ].map((u, i) => (
                  <div key={i} className="text-center">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#141a24]/80 border border-[#2D4A3E]/30 rounded-xl flex items-center justify-center">
                      <span className="text-white text-lg sm:text-xl font-bold font-mono">{String(u.val).padStart(2, '0')}</span>
                    </div>
                    <span className="text-zinc-600 text-[10px] sm:text-xs mt-1 block">{u.lbl}</span>
                  </div>
                ))}
              </div>
            )}

            {/* CTA */}
            <div className="anim-up" style={{ animationDelay: '0.7s' }}>
              <button
                onClick={() => setStep('signup')}
                className="w-full py-3.5 sm:py-4 bg-gradient-to-r from-[#C4622D] to-[#d4793e] text-white font-bold text-base sm:text-lg rounded-2xl hover:shadow-lg hover:shadow-[#C4622D]/25 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 anim-pulse"
              >
                Get Started Free
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </button>
              <p className="text-center text-zinc-600 text-[11px] sm:text-xs mt-3">
                No credit card required \u00b7 Valid until May 11th
              </p>
            </div>
          </div>
        )}

        {/* \u2550\u2550\u2550\u2550 ACTIVE \u2014 SIGNUP \u2550\u2550\u2550\u2550 */}
        {status === 'active' && step === 'signup' && (
          <div className="max-w-sm w-full anim-scale">
            <div className="bg-[#141a24]/80 backdrop-blur-xl border border-[#2D4A3E]/30 rounded-2xl p-5 sm:p-7">
              {/* Header */}
              <div className="text-center mb-5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400 text-[11px] font-medium mb-3">
                  \u2705 6 months Pro included
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-white">Create Your Account</h2>
                <p className="text-zinc-500 text-xs mt-1">Full access in 30 seconds</p>
              </div>

              <form onSubmit={handleSignup} className="space-y-3">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">\ud83d\udc64</span>
                  <input
                    ref={nameRef}
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 sm:py-3 bg-[#0F1419] border border-[#2D4A3E]/30 rounded-xl text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-[#C4622D]/50 focus:ring-1 focus:ring-[#C4622D]/20 transition"
                    required
                    autoComplete="name"
                  />
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">\u2709\ufe0f</span>
                  <input
                    type="email"
                    placeholder="you@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 sm:py-3 bg-[#0F1419] border border-[#2D4A3E]/30 rounded-xl text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-[#C4622D]/50 focus:ring-1 focus:ring-[#C4622D]/20 transition"
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">\ud83d\udd12</span>
                  <input
                    type="password"
                    placeholder="Password (min. 6 characters)"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    minLength={6}
                    className="w-full pl-9 pr-4 py-2.5 sm:py-3 bg-[#0F1419] border border-[#2D4A3E]/30 rounded-xl text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-[#C4622D]/50 focus:ring-1 focus:ring-[#C4622D]/20 transition"
                    required
                    autoComplete="new-password"
                  />
                </div>

                {error && (
                  <p className="text-red-400 text-xs text-center bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2 anim-scale">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-[#C4622D] to-[#d4793e] text-white font-bold text-sm sm:text-base rounded-xl hover:shadow-lg hover:shadow-[#C4622D]/25 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating your account...</>
                  ) : (
                    <>Activate 6 Months Pro Free \u2728</>
                  )}
                </button>
              </form>

              <button
                onClick={() => setStep('landing')}
                className="w-full text-center text-zinc-600 text-xs mt-3 hover:text-zinc-400 active:text-zinc-300 transition py-1"
              >
                \u2190 Back
              </button>
            </div>
          </div>
        )}

        {/* \u2550\u2550\u2550\u2550 SUCCESS \u2550\u2550\u2550\u2550 */}
        {step === 'success' && (
          <div className="max-w-sm w-full text-center anim-scale">
            <div className="bg-[#141a24]/80 backdrop-blur-xl border border-emerald-500/30 rounded-2xl p-6 sm:p-8">
              <div className="text-5xl sm:text-6xl mb-3 anim-scale" style={{ animationDelay: '0.15s' }}>\ud83d\udc19</div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Welcome!</h2>
              <p className="text-zinc-400 text-sm mb-1">Your Pro account is active</p>
              <p className="text-emerald-400 font-semibold text-base sm:text-lg mb-5">6 months free until Nov 2026</p>
              <div className="w-full bg-[#0F1419] rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#C4622D] to-emerald-400 rounded-full anim-progress" />
              </div>
              <p className="text-zinc-600 text-xs mt-3">Entering your dashboard...</p>
            </div>
          </div>
        )}

      </div>

      {/* \u2500\u2500 Footer \u2500\u2500 */}
      <div className="relative z-10 text-center py-4 px-4">
        <p className="text-zinc-700 text-[10px] sm:text-xs">octopuskills.com \u00b7 The AI Marketing Omni Cockpit</p>
      </div>
    </div>
  )
}
