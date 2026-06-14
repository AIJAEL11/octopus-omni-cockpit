'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Check, X, Zap, Crown, Rocket, ArrowLeft, Loader2, Star, TrendingUp, Share2, Receipt, CalendarDays } from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'

const plans = [
  {
    id: 'starter',
    icon: Zap,
    color: '#2D4A3E',
    monthlyPrice: 0,
    annualPrice: 0,
    popular: false,
    opsFeatures: [
      'features.starter_ops_1',
      'features.starter_ops_2',
      'features.starter_ops_3',
      'features.starter_ops_4',
      'features.starter_ops_5',
      'features.starter_ops_6',
    ],
    creativeFeatures: [
      'features.starter_creative_1',
      'features.starter_creative_2',
    ],
    creativeNote: 'features.starter_creative_note',
  },
  {
    id: 'pro',
    icon: Crown,
    color: '#FFD700',
    monthlyPrice: 29,
    annualPrice: 290,
    popular: true,
    opsFeatures: [
      'features.pro_ops_1',
      'features.pro_ops_2',
      'features.pro_ops_3',
      'features.pro_ops_4',
      'features.pro_ops_5',
      'features.pro_ops_6',
      'features.pro_ops_7',
    ],
    creativeFeatures: [
      'features.pro_creative_1',
      'features.pro_creative_2',
      'features.pro_creative_3',
      'features.pro_creative_4',
      'features.pro_creative_5',
    ],
    creativeNote: 'features.pro_creative_note',
  },
  {
    id: 'business',
    icon: Rocket,
    color: '#C4622D',
    monthlyPrice: 99,
    annualPrice: 990,
    popular: false,
    opsFeatures: [
      'features.business_ops_1',
      'features.business_ops_2',
      'features.business_ops_3',
      'features.business_ops_4',
      'features.business_ops_5',
      'features.business_ops_6',
      'features.business_ops_7',
    ],
    creativeFeatures: [
      'features.business_creative_1',
      'features.business_creative_2',
      'features.business_creative_3',
      'features.business_creative_4',
      'features.business_creative_5',
    ],
    creativeNote: 'features.business_creative_note',
  },
]

export default function PricingPage() {
  const { t, locale, setLocale } = useI18n()
  const { data: session } = useSession() || {}
  const router = useRouter()
  const [isAnnual, setIsAnnual] = useState(false)
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)

  const handleSubscribe = async (planId: string) => {
    if (planId === 'starter') {
      router.push(session ? '/dashboard' : '/login')
      return
    }

    if (!session) {
      router.push('/login')
      return
    }

    setLoadingPlan(planId)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          period: isAnnual ? 'annual' : 'monthly',
        }),
      })

      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error('Checkout error:', error)
    } finally {
      setLoadingPlan(null)
    }
  }

  const annualSavings = (monthly: number, annual: number) => {
    if (monthly === 0) return 0
    return Math.round(((monthly * 12 - annual) / (monthly * 12)) * 100)
  }

  return (
    <div className="min-h-screen bg-[#0a1628] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a1628]/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FFD700]/20 to-[#C4622D]/20 flex items-center justify-center overflow-hidden">
              <Image src="/octopus-core-logo.png" alt="OCTOPUS" width={36} height={36} className="w-9 h-9 object-cover scale-[1.35]" />
            </div>
            <span className="font-bold text-lg">OctopusSkills</span>
          </Link>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocale(locale === 'en' ? 'es' : 'en')}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            >
              {locale === 'en' ? 'EN' : 'ES'}
            </button>
            {session ? (
              <Link href="/dashboard" className="text-sm text-white/60 hover:text-white transition-colors flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Dashboard
              </Link>
            ) : (
              <Link href="/login" className="text-sm px-4 py-2 rounded-xl bg-[#FFD700]/10 text-[#FFD700] hover:bg-[#FFD700]/20 transition-colors">
                {t('pricing.login')}
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 sm:py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
              {t('pricing.title')}
            </h1>
            <p className="text-lg text-white/50 max-w-2xl mx-auto mb-10">
              {t('pricing.subtitle')}
            </p>
          </motion.div>

          {/* Period Toggle */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center justify-center gap-4 mb-16"
          >
            <span className={`text-sm font-medium transition-colors ${!isAnnual ? 'text-white' : 'text-white/40'}`}>
              {t('pricing.monthly')}
            </span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className={`relative w-14 h-7 rounded-full transition-colors duration-300 ${
                isAnnual ? 'bg-[#FFD700]' : 'bg-white/20'
              }`}
            >
              <div
                className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-lg transition-transform duration-300 ${
                  isAnnual ? 'translate-x-7' : 'translate-x-0.5'
                }`}
              />
            </button>
            <span className={`text-sm font-medium transition-colors ${isAnnual ? 'text-white' : 'text-white/40'}`}>
              {t('pricing.annual')}
            </span>
            {isAnnual && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-xs px-3 py-1 rounded-full bg-[#FFD700]/10 text-[#FFD700] font-bold border border-[#FFD700]/20"
              >
                {t('pricing.save_2_months')}
              </motion.span>
            )}
          </motion.div>
        </div>

        {/* Value Proposition */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="max-w-5xl mx-auto mb-16"
        >
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">{t('pricing.value_title')}</h2>
            <p className="text-white/40 text-sm">{t('pricing.value_subtitle')}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: TrendingUp, titleKey: 'pricing.value_1_title', descKey: 'pricing.value_1_desc', color: '#FFD700' },
              { icon: Share2, titleKey: 'pricing.value_2_title', descKey: 'pricing.value_2_desc', color: '#0ea5e9' },
              { icon: Receipt, titleKey: 'pricing.value_3_title', descKey: 'pricing.value_3_desc', color: '#10b981' },
              { icon: CalendarDays, titleKey: 'pricing.value_4_title', descKey: 'pricing.value_4_desc', color: '#C4622D' },
            ].map((item) => (
              <div key={item.titleKey} className="bg-[#1A2332]/60 border border-white/5 rounded-xl p-4 text-center hover:border-white/10 transition-colors">
                <div className="w-10 h-10 rounded-lg mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: `${item.color}15` }}>
                  <item.icon className="w-5 h-5" style={{ color: item.color }} />
                </div>
                <p className="text-sm font-semibold text-white mb-1">{t(item.titleKey)}</p>
                <p className="text-[11px] text-white/40 leading-relaxed">{t(item.descKey)}</p>
              </div>
            ))}
          </div>
          <p className="text-center mt-6 text-sm font-semibold text-[#FFD700]/80">
            {t('pricing.value_equiv')}
          </p>
        </motion.div>

        {/* Plans Grid */}
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {plans.map((plan, index) => {
            const Icon = plan.icon
            const price = isAnnual ? plan.annualPrice : plan.monthlyPrice
            const savings = annualSavings(plan.monthlyPrice, plan.annualPrice)

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + index * 0.1 }}
                whileHover={{ y: -6, transition: { duration: 0.3 } }}
                className={`relative rounded-2xl border transition-all duration-300 ${
                  plan.id === 'business'
                    ? 'bg-[#1A2332]/80 border-[#0ea5e9]/30 hover:border-[#0ea5e9]/50'
                    : plan.popular
                    ? 'bg-[#1A2332]/80 border-[#FFD700]/30 scale-[1.02] md:scale-105'
                    : 'bg-[#1A2332]/40 border-white/5 hover:border-white/10'
                }`}
                style={{
                  boxShadow: plan.id === 'business'
                    ? '0 8px 40px rgba(14, 165, 233, 0.15), 0 4px 20px rgba(16, 185, 129, 0.12), inset 0 1px 0 rgba(14, 165, 233, 0.1)'
                    : plan.popular
                    ? '0 8px 40px rgba(255, 215, 0, 0.08), 0 4px 20px rgba(196, 98, 45, 0.06), inset 0 1px 0 rgba(255, 215, 0, 0.08)'
                    : '0 4px 24px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
                }}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1.5 rounded-full bg-gradient-to-r from-[#FFD700] to-[#C4622D] text-black text-xs font-bold flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5" fill="currentColor" />
                      {t('pricing.most_popular')}
                    </span>
                  </div>
                )}

                <div className="p-8">
                  {/* Plan Header */}
                  <div className="flex items-center gap-3 mb-6">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${plan.color}20` }}
                    >
                      <Icon className="w-5.5 h-5.5" style={{ color: plan.color }} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{t(`pricing.plan_${plan.id}`)}</h3>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mb-8">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl sm:text-5xl font-bold">
                        ${isAnnual ? Math.round(price / 12) : price}
                      </span>
                      <span className="text-white/40 text-sm">
                        /{t('pricing.per_month')}
                      </span>
                    </div>
                    {isAnnual && price > 0 && (
                      <p className="text-sm text-[#FFD700]/70 mt-2">
                        ${price}/{t('pricing.per_year')} · {t('pricing.save')} {savings}%
                      </p>
                    )}
                    {price === 0 && (
                      <p className="text-sm text-white/40 mt-2">{t('pricing.free_forever')}</p>
                    )}
                    {price > 0 && (
                      <p className="text-sm text-[#2D4A3E] mt-2">{t('pricing.trial_14')}</p>
                    )}
                  </div>

                  {/* CTA Button */}
                  <button
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={loadingPlan === plan.id}
                    className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-300 mb-8 flex items-center justify-center gap-2 ${
                      plan.popular
                        ? 'bg-gradient-to-r from-[#FFD700] to-[#C4622D] text-black hover:shadow-lg hover:shadow-[#FFD700]/20 hover:scale-[1.02]'
                        : plan.id === 'business'
                        ? 'bg-gradient-to-r from-[#0ea5e9] to-[#10b981] text-white hover:shadow-lg hover:shadow-[#0ea5e9]/20 hover:scale-[1.02]'
                        : 'bg-white/10 text-white hover:bg-white/15'
                    }`}
                  >
                    {loadingPlan === plan.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        {plan.id === 'starter'
                          ? t('pricing.get_started')
                          : t('pricing.start_trial')}
                      </>
                    )}
                  </button>

                  {/* Operations Features */}
                  <div className="space-y-2.5 mb-5">
                    <p className="text-xs font-semibold text-emerald-400/70 uppercase tracking-wider mb-3">
                      {t('features.section_ops')}
                    </p>
                    {plan.opsFeatures.map((key) => (
                      <div key={key} className="flex items-start gap-2.5">
                        <div className="w-4.5 h-4.5 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="w-3 h-3 text-emerald-400" />
                        </div>
                        <span className="text-sm leading-tight text-white/70">{t(key)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Divider */}
                  <div className="border-t border-white/5 my-4" />

                  {/* Creative Features */}
                  <div className="space-y-2.5">
                    <p className="text-xs font-semibold text-purple-400/70 uppercase tracking-wider mb-3">
                      {t('features.section_creative')}
                    </p>
                    {plan.creativeFeatures.map((key) => (
                      <div key={key} className="flex items-start gap-2.5">
                        <div className="w-4.5 h-4.5 rounded-full bg-purple-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="w-3 h-3 text-purple-400" />
                        </div>
                        <span className="text-sm leading-tight text-white/60">{t(key)}</span>
                      </div>
                    ))}
                    <p className="text-[10px] text-white/30 italic mt-2 pl-7">
                      {t(plan.creativeNote)}
                    </p>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
        {/* Creative Studio Note */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="max-w-4xl mx-auto mt-12"
        >
          <div className="bg-[#1A2332]/50 border border-purple-500/10 rounded-2xl px-6 py-5 text-center">
            <p className="text-sm text-white/50 leading-relaxed">
              {t('pricing.creative_note')}
            </p>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#FFD700]/20 to-[#C4622D]/20 flex items-center justify-center overflow-hidden">
              <Image src="/octopus-core-logo.png" alt="OCTOPUS" width={32} height={32} className="w-8 h-8 object-cover scale-[1.35]" />
            </div>
            <span className="text-sm text-white/40">OctopusSkills</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/legal" className="text-xs text-white/30 hover:text-white/50 transition-colors">
              {t('pricing.legal')}
            </Link>
          </div>
          <p className="text-xs text-white/30">© 2026 OCTOPUS Omni Cockpit</p>
        </div>
      </footer>
    </div>
  )
}
