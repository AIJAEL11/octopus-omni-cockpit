import { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Mail, MessageSquare, Globe, ArrowLeft, MapPin, Clock, ExternalLink, Headphones, Building2 } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Contact Us — Octopus AI | Get in Touch',
  description: 'Contact the Octopus AI team. Reach us for sales inquiries, partnerships, support, or general questions about our AI marketing platform.',
  alternates: { canonical: 'https://octopuskills.com/contact' },
  openGraph: {
    title: 'Contact Us — Octopus AI',
    description: 'Get in touch with the Octopus AI team for sales, partnerships, or support.',
    url: 'https://octopuskills.com/contact',
    type: 'website',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ContactPage',
  name: 'Contact Octopus AI',
  description: 'Contact page for Octopus AI — AI-powered marketing and business operations platform.',
  url: 'https://octopuskills.com/contact',
  mainEntity: {
    '@type': 'Organization',
    name: 'Wildverse LLC',
    alternateName: 'Octopus AI',
    url: 'https://octopuskills.com',
    email: '1billontopview@gmail.com',
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: 'support@octopuskills.com',
        availableLanguage: ['English', 'Spanish'],
      },
      {
        '@type': 'ContactPoint',
        contactType: 'sales',
        email: '1billontopview@gmail.com',
        availableLanguage: ['English', 'Spanish'],
      },
    ],
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'US',
      addressRegion: 'FL',
    },
    sameAs: [
      'https://x.com/octopuskills',
    ],
  },
}

function ContactCard({ icon: Icon, title, description, action, actionLabel, color }: {
  icon: React.ElementType; title: string; description: string; action: string; actionLabel: string; color: string
}) {
  return (
    <a href={action} className="block group">
      <div className="bg-white/5 hover:bg-white/8 border border-white/10 hover:border-white/20 rounded-2xl p-6 transition-all duration-300 h-full">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4`} style={{ backgroundColor: `${color}20` }}>
          <Icon className="w-6 h-6" style={{ color }} />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
        <p className="text-[#F5F0E8]/60 text-sm leading-relaxed mb-4">{description}</p>
        <span className="text-sm font-medium group-hover:underline transition-all" style={{ color }}>
          {actionLabel} <ExternalLink className="w-3 h-3 inline ml-1" />
        </span>
      </div>
    </a>
  )
}

export default function ContactPage() {
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #1a1a1a 0%, #0d1117 100%)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="border-b border-[#FFD700]/10 py-4 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-10 h-10">
              <Image src="/octopus-core-logo.png" alt="Octopus AI" fill className="object-contain" />
            </div>
            <span className="text-lg font-bold text-white group-hover:text-[#2D4A3E] transition-colors">OCTOPUS</span>
          </Link>
          <Link href="/" className="flex items-center gap-2 text-sm text-[#F5F0E8]/60 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-3 mb-4">
            <MessageSquare className="w-8 h-8 text-[#2D4A3E]" />
            <h1 className="text-3xl sm:text-5xl font-bold text-white">Get in Touch</h1>
          </div>
          <p className="text-[#F5F0E8]/60 text-lg max-w-2xl mx-auto mt-4">
            Whether you have a question about features, pricing, partnerships, or anything else — our team is here to help.
          </p>
        </div>

        {/* Contact Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          <ContactCard
            icon={Headphones}
            title="Customer Support"
            description="Need help with your account, features, or technical issues? Our support team responds within 24 hours."
            action="mailto:support@octopuskills.com"
            actionLabel="support@octopuskills.com"
            color="#C4622D"
          />
          <ContactCard
            icon={Building2}
            title="Sales & Partnerships"
            description="Interested in enterprise plans, white-label solutions, or strategic partnerships? Let's talk."
            action="mailto:1billontopview@gmail.com"
            actionLabel="1billontopview@gmail.com"
            color="#4A90D9"
          />
          <ContactCard
            icon={Mail}
            title="General Inquiries"
            description="Press, media, feedback, or general questions about Octopus AI and Wildverse LLC."
            action="mailto:1billontopview@gmail.com"
            actionLabel="1billontopview@gmail.com"
            color="#2D4A3E"
          />
        </div>

        {/* Company Info */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 mb-16">
          <h2 className="text-2xl font-bold text-white mb-6">About Octopus AI</h2>
          <div className="grid sm:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Building2 className="w-5 h-5 text-[#C4622D] mt-0.5" />
                <div>
                  <p className="text-white font-semibold">Wildverse LLC</p>
                  <p className="text-[#F5F0E8]/60 text-sm">Operating as Octopus AI</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-[#C4622D] mt-0.5" />
                <div>
                  <p className="text-white font-semibold">United States</p>
                  <p className="text-[#F5F0E8]/60 text-sm">Florida, USA</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-[#C4622D] mt-0.5" />
                <div>
                  <p className="text-white font-semibold">Business Hours</p>
                  <p className="text-[#F5F0E8]/60 text-sm">Mon—Fri, 9 AM — 6 PM EST</p>
                  <p className="text-[#F5F0E8]/40 text-xs">Support available 24/7 via OCTOPUS AI assistant</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Globe className="w-5 h-5 text-[#4A90D9] mt-0.5" />
                <div>
                  <p className="text-white font-semibold">Website</p>
                  <a href="https://octopuskills.com" className="text-[#4A90D9] hover:underline text-sm">octopuskills.com</a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <ExternalLink className="w-5 h-5 text-[#4A90D9] mt-0.5" />
                <div>
                  <p className="text-white font-semibold">X (Twitter)</p>
                  <a href="https://x.com/octopuskills" target="_blank" rel="noopener noreferrer" className="text-[#4A90D9] hover:underline text-sm">x.com/octopuskills</a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MessageSquare className="w-5 h-5 text-[#4A90D9] mt-0.5" />
                <div>
                  <p className="text-white font-semibold">Languages</p>
                  <p className="text-[#F5F0E8]/60 text-sm">English · Español</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ Quick Links */}
        <div className="text-center">
          <h2 className="text-xl font-bold text-white mb-4">Looking for something specific?</h2>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/support" className="px-5 py-2.5 bg-[#C4622D]/10 hover:bg-[#C4622D]/20 border border-[#C4622D]/20 rounded-xl text-sm text-[#C4622D] transition-colors">Support Center</Link>
            <Link href="/pricing" className="px-5 py-2.5 bg-[#4A90D9]/10 hover:bg-[#4A90D9]/20 border border-[#4A90D9]/20 rounded-xl text-sm text-[#4A90D9] transition-colors">Pricing Plans</Link>
            <Link href="/privacy" className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-white/70 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-white/70 transition-colors">Terms of Service</Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-white/10 py-6 px-4 mt-12">
        <div className="max-w-5xl mx-auto text-center text-xs text-[#F5F0E8]/40">
          © {new Date().getFullYear()} Wildverse LLC · Octopus AI · All rights reserved
        </div>
      </footer>
    </div>
  )
}
