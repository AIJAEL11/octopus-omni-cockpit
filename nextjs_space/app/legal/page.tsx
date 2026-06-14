'use client'

import { useI18n } from '@/lib/i18n-context'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Shield, FileText, Globe, Mail, Scale, Lock, Eye, Database, Cookie, Users, Cpu, Wifi, AlertTriangle, Gavel, BookOpen } from 'lucide-react'

const LAST_UPDATED = '2026-03-22'

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-10 scroll-mt-24">
      <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 flex items-center gap-3">
        {title}
      </h3>
      {children}
    </section>
  )
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h4 className="text-lg font-semibold text-white/90 mb-2">{title}</h4>
      {children}
    </div>
  )
}

function Paragraph({ text }: { text: string }) {
  // Split by · to make bullet-like items
  const parts = text.split(' · ')
  if (parts.length > 1) {
    return (
      <ul className="space-y-2 text-white/60 leading-relaxed">
        {parts.map((part, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="text-[#FFD700] mt-1.5 text-xs">●</span>
            <span>{part}</span>
          </li>
        ))}
      </ul>
    )
  }
  return <p className="text-white/60 leading-relaxed">{text}</p>
}

export default function LegalPage() {
  const { t, locale, setLocale } = useI18n()

  const ppSections = [
    { id: 'pp-1', titleKey: 'legal.pp_s1_title', subs: [
      { titleKey: 'legal.pp_s1_1_title', textKey: 'legal.pp_s1_1' },
      { titleKey: 'legal.pp_s1_2_title', textKey: 'legal.pp_s1_2' },
      { titleKey: 'legal.pp_s1_3_title', textKey: 'legal.pp_s1_3' },
    ]},
    { id: 'pp-2', titleKey: 'legal.pp_s2_title', textKey: 'legal.pp_s2' },
    { id: 'pp-3', titleKey: 'legal.pp_s3_title', textKey: 'legal.pp_s3' },
    { id: 'pp-4', titleKey: 'legal.pp_s4_title', textKey: 'legal.pp_s4' },
    { id: 'pp-5', titleKey: 'legal.pp_s5_title', textKey: 'legal.pp_s5' },
    { id: 'pp-6', titleKey: 'legal.pp_s6_title', textKey: 'legal.pp_s6' },
    { id: 'pp-7', titleKey: 'legal.pp_s7_title', textKey: 'legal.pp_s7' },
    { id: 'pp-8', titleKey: 'legal.pp_s8_title', textKey: 'legal.pp_s8' },
    { id: 'pp-9', titleKey: 'legal.pp_s9_title', textKey: 'legal.pp_s9' },
    { id: 'pp-10', titleKey: 'legal.pp_s10_title', textKey: 'legal.pp_s10' },
    { id: 'pp-11', titleKey: 'legal.pp_s11_title', introKey: 'legal.pp_s11_intro', textKey: 'legal.pp_s11', subs: [
      { titleKey: 'legal.pp_s11_network_title', textKey: 'legal.pp_s11_network' },
    ]},
  ]

  const tosSections = [
    { id: 'tos-1', titleKey: 'legal.tos_s1_title', textKey: 'legal.tos_s1' },
    { id: 'tos-2', titleKey: 'legal.tos_s2_title', textKey: 'legal.tos_s2' },
    { id: 'tos-3', titleKey: 'legal.tos_s3_title', textKey: 'legal.tos_s3', prefixKey: 'legal.tos_s3_prohibited_title' },
    { id: 'tos-4', titleKey: 'legal.tos_s4_title', textKey: 'legal.tos_s4' },
    { id: 'tos-5', titleKey: 'legal.tos_s5_title', textKey: 'legal.tos_s5' },
    { id: 'tos-6', titleKey: 'legal.tos_s6_title', textKey: 'legal.tos_s6' },
    { id: 'tos-7', titleKey: 'legal.tos_s7_title', textKey: 'legal.tos_s7' },
    { id: 'tos-8', titleKey: 'legal.tos_s8_title', introKey: 'legal.tos_s8', subs: [
      { titleKey: 'legal.tos_s8_1_title', textKey: 'legal.tos_s8_1' },
      { titleKey: 'legal.tos_s8_2_title', textKey: 'legal.tos_s8_2' },
      { titleKey: 'legal.tos_s8_3_title', textKey: 'legal.tos_s8_3' },
      { titleKey: 'legal.tos_s8_4_title', textKey: 'legal.tos_s8_4' },
    ]},
    { id: 'tos-9', titleKey: 'legal.tos_s9_title', textKey: 'legal.tos_s9' },
    { id: 'tos-10', titleKey: 'legal.tos_s10_title', textKey: 'legal.tos_s10' },
    { id: 'tos-11', titleKey: 'legal.tos_s11_title', textKey: 'legal.tos_s11' },
    { id: 'tos-12', titleKey: 'legal.tos_s12_title', textKey: 'legal.tos_s12' },
  ]

  const ppTocIcons = [Database, Eye, Cpu, Users, Lock, Database, Scale, Cookie, Globe, Users, Wifi]
  const tosTocIcons = [FileText, Users, AlertTriangle, BookOpen, Shield, Gavel, Wifi, Wifi, FileText, Lock, Scale, FileText]

  return (
    <div className="min-h-screen bg-[#0a1628] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a1628]/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm">
              <ArrowLeft className="w-4 h-4" />
              {t('legal.back_home')}
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocale(locale === 'en' ? 'es' : 'en')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white/60 hover:text-white transition-colors bg-white/5 rounded-lg border border-white/10 hover:bg-white/10"
            >
              <Globe className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">{locale === 'en' ? 'EN' : 'ES'}</span>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full overflow-hidden">
                <Image src="/octopus-core-logo.png" alt="OCTOPUS" width={32} height={32} className="w-8 h-8 object-cover scale-[1.35]" />
              </div>
              <span className="text-sm font-bold text-white/80 hidden sm:block">OCTOPUS</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 text-center"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#FFD700]/10 border border-[#FFD700]/20 rounded-full text-sm text-[#FFD700] mb-6">
            <Shield className="w-4 h-4" />
            {t('legal.last_updated')}: {LAST_UPDATED}
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            {t('legal.title')}
          </h1>
          <p className="text-white/50 max-w-2xl mx-auto">
            OCTOPUS Omni Cockpit
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 lg:gap-12">
          {/* Sticky Table of Contents */}
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-4">{t('legal.toc')}</h4>
              
              {/* Privacy Policy TOC */}
              <div className="mb-6">
                <a href="#privacy-policy" className="flex items-center gap-2 text-sm font-semibold text-[#FFD700] mb-2 hover:text-[#FFD700]/80 transition-colors">
                  <Shield className="w-3.5 h-3.5" />
                  {t('legal.pp_title')}
                </a>
                <nav className="space-y-1 pl-5 border-l border-white/5">
                  {ppSections.map((s, i) => {
                    const Icon = ppTocIcons[i]
                    return (
                      <a key={s.id} href={`#${s.id}`} className="flex items-center gap-2 text-xs text-white/40 hover:text-white/70 transition-colors py-0.5">
                        <Icon className="w-3 h-3 flex-shrink-0" />
                        {t(s.titleKey)}
                      </a>
                    )
                  })}
                </nav>
              </div>

              {/* Terms TOC */}
              <div>
                <a href="#terms-of-use" className="flex items-center gap-2 text-sm font-semibold text-[#C4622D] mb-2 hover:text-[#C4622D]/80 transition-colors">
                  <FileText className="w-3.5 h-3.5" />
                  {t('legal.tos_title')}
                </a>
                <nav className="space-y-1 pl-5 border-l border-white/5">
                  {tosSections.map((s, i) => {
                    const Icon = tosTocIcons[i]
                    return (
                      <a key={s.id} href={`#${s.id}`} className="flex items-center gap-2 text-xs text-white/40 hover:text-white/70 transition-colors py-0.5">
                        <Icon className="w-3 h-3 flex-shrink-0" />
                        {t(s.titleKey)}
                      </a>
                    )
                  })}
                </nav>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <div>
            {/* ===== PRIVACY POLICY ===== */}
            <motion.div
              id="privacy-policy"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-16 scroll-mt-24"
            >
              <div className="flex items-center gap-3 mb-8 pb-4 border-b border-[#FFD700]/20">
                <div className="w-10 h-10 rounded-xl bg-[#FFD700]/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-[#FFD700]" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-[#FFD700]">{t('legal.pp_title')}</h2>
              </div>

              <p className="text-white/60 leading-relaxed mb-8">{t('legal.pp_intro')}</p>

              {ppSections.map((section) => (
                <Section key={section.id} id={section.id} title={t(section.titleKey)}>
                  {'introKey' in section && section.introKey && (
                    <p className="text-white/60 leading-relaxed mb-4">{t(section.introKey)}</p>
                  )}
                  {'textKey' in section && section.textKey && (
                    <Paragraph text={t(section.textKey)} />
                  )}
                  {'subs' in section && section.subs && (
                    section.subs.map((sub: { titleKey: string; textKey: string }) => (
                      <SubSection key={sub.titleKey} title={t(sub.titleKey)}>
                        <Paragraph text={t(sub.textKey)} />
                      </SubSection>
                    ))
                  )}
                </Section>
              ))}
            </motion.div>

            {/* ===== TERMS OF USE ===== */}
            <motion.div
              id="terms-of-use"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mb-16 scroll-mt-24"
            >
              <div className="flex items-center gap-3 mb-8 pb-4 border-b border-[#C4622D]/30">
                <div className="w-10 h-10 rounded-xl bg-[#C4622D]/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-[#C4622D]" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-[#C4622D]">{t('legal.tos_title')}</h2>
              </div>

              <p className="text-white/60 leading-relaxed mb-8">{t('legal.tos_intro')}</p>

              {tosSections.map((section) => (
                <Section key={section.id} id={section.id} title={t(section.titleKey)}>
                  {'prefixKey' in section && section.prefixKey && (
                    <p className="text-white/70 font-semibold mb-3">{t(section.prefixKey)}</p>
                  )}
                  {'introKey' in section && section.introKey && (
                    <Paragraph text={t(section.introKey)} />
                  )}
                  {'subs' in section && section.subs ? (
                    section.subs.map((sub: { titleKey: string; textKey: string }) => (
                      <SubSection key={sub.titleKey} title={t(sub.titleKey)}>
                        <Paragraph text={t(sub.textKey)} />
                      </SubSection>
                    ))
                  ) : 'textKey' in section && section.textKey ? (
                    <Paragraph text={t(section.textKey)} />
                  ) : null}
                </Section>
              ))}
            </motion.div>

            {/* ===== CONTACT ===== */}
            <motion.div
              id="contact"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-[#1A2332]/60 backdrop-blur-sm rounded-2xl p-8 border border-white/5"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#FFD700]/10 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-[#FFD700]" />
                </div>
                <h2 className="text-xl font-bold text-white">{t('legal.contact_title')}</h2>
              </div>
              <p className="text-white/70 mb-4">{t('legal.contact')}</p>
              <div className="space-y-2 text-white/80">
                <p>{t('legal.contact_email')}</p>
                <p>{t('legal.contact_privacy')}</p>
                <p className="text-white/50 text-sm mt-4">{t('legal.contact_entity')}</p>
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full overflow-hidden">
              <Image src="/octopus-core-logo.png" alt="OCTOPUS" width={32} height={32} className="w-8 h-8 object-cover scale-[1.35]" />
            </div>
            <span className="text-sm text-white/40">OCTOPUS Omni Cockpit</span>
          </div>
          <p className="text-xs text-white/30">© 2026 OCTOPUS Omni Cockpit. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
