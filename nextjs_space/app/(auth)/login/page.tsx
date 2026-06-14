'use client'

import { useState, useEffect } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { Mail, Lock, User, ArrowRight, Loader2 } from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'

export default function LoginPage() {
  const { t } = useI18n()
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [splineMounted, setSplineMounted] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
  })
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession() || {}

  // Resolve callbackUrl from query params (used by showcase replicate flow)
  const callbackUrl = searchParams?.get('callbackUrl') || '/dashboard'
  const isShowcase = searchParams?.get('showcase') === 'true'

  useEffect(() => {
    setSplineMounted(true)
    // Pre-fill email from query param (from lead capture)
    const emailParam = searchParams?.get('email')
    if (emailParam) {
      setFormData(prev => ({ ...prev, email: emailParam }))
      setIsLogin(false) // Switch to signup mode
    }
    // If coming from showcase, default to signup
    if (isShowcase) {
      setIsLogin(false)
    }
  }, [searchParams, isShowcase])

  // Redirect if already logged in — respect callbackUrl
  if (status === 'authenticated') {
    router.replace(callbackUrl)
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (isLogin) {
        const result = await signIn('credentials', {
          redirect: false,
          email: formData.email,
          password: formData.password,
        })

        if (result?.error) {
          setError(t('login.invalid_credentials'))
        } else {
          router.replace(callbackUrl)
        }
      } else {
        // Signup
        const response = await fetch('/api/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })

        const data = await response.json()

        if (!response.ok) {
          setError(data?.error ?? t('login.signup_error'))
        } else {
          // Auto-login after signup
          const result = await signIn('credentials', {
            redirect: false,
            email: formData.email,
            password: formData.password,
          })

          if (result?.ok) {
            // If from showcase, go directly to Code Engine with prompt; otherwise onboarding
            router.replace(isShowcase ? callbackUrl : '/onboarding')
          }
        }
      }
    } catch (err) {
      console.error('Auth error:', err)
      setError(t('login.connection_error'))
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = () => {
    setGoogleLoading(true)
    signIn('google', { redirect: true, callbackUrl })
  }

  return (
    <>
      {/* Spline 3D Octopus Swimming Background — full screen */}
      {splineMounted && (
        <div className="fixed inset-0 z-0">
          <iframe
            src="/spline-login.html"
            className="w-full h-full border-0 block"
            title="OCTOPUS Underwater Login Experience"
            allow="autoplay"
            loading="eager"
          />
          {/* Fade out the Spline watermark in the bottom-right corner */}
          <div className="absolute bottom-0 right-0 w-56 h-20 bg-gradient-to-tl from-[#0a1628] via-[#0a1628]/90 to-transparent pointer-events-none" />
        </div>
      )}

      {/* Gradient overlay — darker on the right for card, transparent left to show octopus */}
      <div className="fixed inset-0 z-[1] bg-gradient-to-r from-transparent via-transparent to-[#0a1628]/60 pointer-events-none" />
      <div className="fixed inset-0 z-[1] bg-gradient-to-b from-[#0a1628]/20 via-transparent to-[#0a1628]/40 pointer-events-none" />

      {/* Layout: card pushed to the right, octopus visible on left */}
      <div className="relative z-10 min-h-screen flex items-center justify-end p-4 sm:p-8 lg:p-12">
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="w-full max-w-[420px]"
        >
          <div className="bg-[#0a1628]/50 backdrop-blur-2xl rounded-3xl p-8 shadow-2xl shadow-black/40 border border-white/10">
            {/* Logo */}
            <motion.div
              className="flex justify-center mb-6"
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <div className="w-24 h-24 rounded-full flex items-center justify-center overflow-hidden shadow-xl ring-4 ring-[#FFD700]/20">
                <Image
                  src="/octopus-core-logo.png"
                  alt="OCTOPUS Core"
                  width={96}
                  height={96}
                  className="w-24 h-24 object-cover scale-[1.35]"
                  priority
                />
              </div>
            </motion.div>

            <h1 className="text-2xl font-bold text-center text-white mb-1.5 drop-shadow-lg">
              {isLogin ? t('login.welcome_back') : t('login.create_account')}
            </h1>
            <p className="text-center text-white/50 mb-7 text-sm">
              {isLogin
                ? t('login.access')
                : t('login.start_experience')}
            </p>

            {/* Google SSO Button */}
            <button
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="w-full mb-5 flex items-center justify-center gap-3 px-4 py-3 bg-white/10 hover:bg-white/15 border border-white/15 rounded-xl text-white/80 hover:text-white transition-all text-sm font-medium disabled:opacity-50"
            >
              {googleLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )}
              {t('login.google')}
            </button>

            <div className="relative mb-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-[#0a1628]/50 text-white/40">{t('login.or')}</span>
              </div>
            </div>

            {/* Email/Password Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {!isLogin && (
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-white/30" />
                  <input
                    type="text"
                    placeholder={t('login.name')}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 bg-[#1a2744] border border-white/25 rounded-xl text-white placeholder-white/40 text-sm focus:outline-none focus:border-[#FFD700]/50 focus:ring-1 focus:ring-[#FFD700]/30 focus:bg-[#1e2d4d] transition-all"
                    required
                  />
                </div>
              )}

              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-white/30" />
                <input
                  type="email"
                  placeholder={t('login.email')}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-[#1a2744] border border-white/25 rounded-xl text-white placeholder-white/40 text-sm focus:outline-none focus:border-[#FFD700]/50 focus:ring-1 focus:ring-[#FFD700]/30 focus:bg-[#1e2d4d] transition-all"
                  required
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-white/30" />
                <input
                  type="password"
                  placeholder={t('login.password')}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-[#1a2744] border border-white/25 rounded-xl text-white placeholder-white/40 text-sm focus:outline-none focus:border-[#FFD700]/50 focus:ring-1 focus:ring-[#FFD700]/30 focus:bg-[#1e2d4d] transition-all"
                  required
                />
              </div>

              {isLogin && (
                <div className="text-right -mt-1">
                  <a
                    href="/forgot-password"
                    className="text-xs text-[#FFD700]/70 hover:text-[#FFD700] transition-colors hover:underline"
                  >
                    {t('login.forgot_password') || '¿Olvidaste tu contraseña?'}
                  </a>
                </div>
              )}

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-[#ff6b4a] text-sm text-center"
                >
                  {error}
                </motion.p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-[#FFD700] to-[#C4622D] text-[#1A1A1A] font-semibold rounded-xl hover:shadow-lg hover:shadow-[#FFD700]/20 transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {isLogin ? t('login.sign_in') : t('login.sign_up')}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Toggle Login/Signup */}
            <p className="text-center text-white/40 mt-5 text-sm">
              {isLogin ? t('login.no_account') : t('login.have_account')}{' '}
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-[#FFD700] font-medium hover:underline"
              >
                {isLogin ? t('login.register') : t('login.login')}
              </button>
            </p>
          </div>
        </motion.div>
      </div>
    </>
  )
}
