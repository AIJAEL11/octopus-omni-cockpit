'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { Mail, ArrowLeft, Loader2, CheckCircle } from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Error al enviar')
      } else {
        setSent(true)
      }
    } catch {
      setError(t('login.connection_error'))
    } finally {
      setLoading(false)
    }
  }

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
              <h1 className="text-xl font-bold text-[#F5F0E8]">{t('login.reset_title')}</h1>
              <p className="text-sm text-white/50 mt-2 text-center">{t('login.reset_desc')}</p>
            </div>

            {sent ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-4"
              >
                <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto" />
                <p className="text-emerald-300 text-sm">{t('login.reset_sent')}</p>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 text-[#FFD700] text-sm hover:underline mt-4"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {t('login.reset_back')}
                </Link>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-white/30" />
                  <input
                    type="email"
                    placeholder={t('login.email')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-[#1a2744] border border-white/25 rounded-xl text-white placeholder-white/40 text-sm focus:outline-none focus:border-[#FFD700]/50 focus:ring-1 focus:ring-[#FFD700]/30 focus:bg-[#1e2d4d] transition-all"
                    required
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
                    t('login.reset_send')
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
            )}
          </div>
        </motion.div>
      </div>
    </>
  )
}
