'use client'

import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { Lock, ArrowLeft, Loader2, CheckCircle, AlertTriangle } from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'
import Link from 'next/link'

function ResetPasswordForm() {
  const { t } = useI18n()
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  if (!token) {
    return (
      <div className="text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto" />
        <p className="text-amber-300 text-sm">{t('login.reset_invalid')}</p>
        <Link
          href="/forgot-password"
          className="inline-flex items-center gap-2 text-[#FFD700] text-sm hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('login.forgot_password')}
        </Link>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError(t('login.passwords_mismatch'))
      return
    }

    if (password.length < 6) {
      setError('Mínimo 6 caracteres')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || t('login.reset_invalid'))
      } else {
        setSuccess(true)
        setTimeout(() => router.replace('/login'), 2500)
      }
    } catch {
      setError(t('login.connection_error'))
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center space-y-4"
      >
        <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto" />
        <p className="text-emerald-300 text-sm">{t('login.reset_success')}</p>
      </motion.div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="relative">
        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-white/30" />
        <input
          type="password"
          placeholder={t('login.new_password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-[#1a2744] border border-white/25 rounded-xl text-white placeholder-white/40 text-sm focus:outline-none focus:border-[#FFD700]/50 focus:ring-1 focus:ring-[#FFD700]/30 focus:bg-[#1e2d4d] transition-all"
          required
          minLength={6}
        />
      </div>

      <div className="relative">
        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-white/30" />
        <input
          type="password"
          placeholder={t('login.confirm_new_password')}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-[#1a2744] border border-white/25 rounded-xl text-white placeholder-white/40 text-sm focus:outline-none focus:border-[#FFD700]/50 focus:ring-1 focus:ring-[#FFD700]/30 focus:bg-[#1e2d4d] transition-all"
          required
          minLength={6}
        />
      </div>

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
          t('login.reset_password')
        )}
      </button>

      <div className="text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-white/40 text-sm hover:text-white/60 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('login.reset_back')}
        </Link>
      </div>
    </form>
  )
}

export default function ResetPasswordPage() {
  const { t } = useI18n()

  return (
    <>
      {/* Background */}
      <div className="fixed inset-0 bg-[#0a1628] -z-10" />
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#2D4A3E]/20 via-transparent to-[#C4622D]/10" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#FFD700]/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#2D4A3E]/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="min-h-screen flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="bg-[#0a1628]/50 backdrop-blur-2xl rounded-3xl p-8 shadow-2xl shadow-black/40 border border-white/10">
            {/* Logo */}
            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 relative mb-3">
                <Image src="/octopus-core-logo.png" alt="OCTOPUS" fill className="object-contain" />
              </div>
              <h1 className="text-xl font-bold text-[#F5F0E8]">{t('login.reset_password')}</h1>
            </div>

            <Suspense fallback={<div className="flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-white/50" /></div>}>
              <ResetPasswordForm />
            </Suspense>
          </div>
        </motion.div>
      </div>
    </>
  )
}
