import { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { HelpCircle, ArrowLeft, Zap, Shield, CreditCard, Palette, Globe, Users, Cpu, Mail, MessageSquare, BookOpen, Wrench, ExternalLink, Rocket } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Support Center — Octopus AI | Help & Resources',
  description: 'Get help with Octopus AI. Find answers about CRM, Growth Engine, Ad Factory, Turbo Mode, billing, integrations, and more. Support available in English and Spanish.',
  alternates: { canonical: 'https://octopuskills.com/support' },
  openGraph: {
    title: 'Support Center — Octopus AI',
    description: 'Find answers, troubleshooting guides, and resources for every Octopus AI module.',
    url: 'https://octopuskills.com/support',
    type: 'website',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  name: 'Octopus AI Support Center',
  description: 'Frequently asked questions and support resources for Octopus AI platform.',
  url: 'https://octopuskills.com/support',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is Octopus AI?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Octopus AI (octopuskills.com) is an all-in-one AI-powered marketing and business operations platform. It combines CRM, social media management, invoicing, calendar, AI creative tools, and smart home integration into a single cockpit. Built by Wildverse LLC.',
      },
    },
    {
      '@type': 'Question',
      name: 'How much does Octopus AI cost?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Octopus AI offers three plans: Starter (free forever), Pro ($29/month) with expanded limits and Turbo Mode, and Business ($99/month) with unlimited access. All plans include core operations features like CRM, Social Bridge, Invoicing, and Calendar.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is Turbo Mode?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Turbo Mode lets you connect your own OpenRouter API key to access premium AI models like GPT-5.4, Claude, Gemini Pro, FLUX.2, and more. This gives you professional-quality AI generation for images, videos, and text. The basic AI engine (RouteLLM) is always free. Turbo Mode is available on Pro and Business plans.',
      },
    },
    {
      '@type': 'Question',
      name: 'Do I need my own API key to use Octopus AI?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No. Octopus AI works out of the box with a built-in AI engine (RouteLLM) that provides basic quality generation for free. For professional campaign-quality output, you can optionally connect your own API key via Turbo Mode. All operations features (CRM, Social Bridge, Invoicing, Calendar) work without any API key.',
      },
    },
    {
      '@type': 'Question',
      name: 'What integrations does Octopus AI support?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Octopus AI integrates with Google Workspace (Gmail, Calendar, Drive, Docs, Sheets), LinkedIn (via Social Bridge), Telegram, OpenRouter (Turbo Mode), HubSpace and WiZ smart home platforms, and Stripe for payments. More integrations are planned.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is my data secure on Octopus AI?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. All data is encrypted in transit (TLS 1.3) and at rest (AES-256). Each user\'s data is logically isolated. We never sell your data or use it to train AI models. We are GDPR and CCPA compliant. See our Privacy Policy for full details.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I use Octopus AI in Spanish?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes! Octopus AI is fully bilingual (English and Spanish). You can switch languages at any time from the header. The OCTOPUS AI assistant speaks both languages naturally.',
      },
    },
  ],
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <div className="bg-white/5 hover:bg-white/8 border border-white/10 rounded-xl p-5 transition-colors">
      <h3 className="text-base font-bold text-white mb-2">{q}</h3>
      <p className="text-[#F5F0E8]/60 text-sm leading-relaxed">{a}</p>
    </div>
  )
}

function ModuleCard({ icon: Icon, title, description, color }: { icon: React.ElementType; title: string; description: string; color: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: `${color}20` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <h3 className="text-sm font-bold text-white mb-1">{title}</h3>
      <p className="text-[#F5F0E8]/50 text-xs leading-relaxed">{description}</p>
    </div>
  )
}

export default function SupportPage() {
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #1a1a1a 0%, #0d1117 100%)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="border-b border-[#FFD700]/10 py-4 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-10 h-10">
              <Image src="/octopus-core-logo.png" alt="Octopus AI" fill className="object-contain" />
            </div>
            <span className="text-lg font-bold text-white group-hover:text-[#C4622D] transition-colors">OCTOPUS</span>
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
            <HelpCircle className="w-8 h-8 text-[#C4622D]" />
            <h1 className="text-3xl sm:text-5xl font-bold text-white">Support Center</h1>
          </div>
          <p className="text-[#F5F0E8]/60 text-lg max-w-2xl mx-auto mt-4">
            Find answers to common questions, learn about platform features, and get the help you need to make the most of Octopus AI.
          </p>
        </div>

        {/* Quick Help */}
        <div className="bg-gradient-to-r from-[#C4622D]/10 to-[#4A90D9]/10 border border-[#C4622D]/20 rounded-2xl p-6 mb-12">
          <h2 className="text-lg font-bold text-white mb-3">🐙 Need instant help?</h2>
          <p className="text-[#F5F0E8]/70 text-sm mb-4">Your in-app OCTOPUS AI assistant can help you with most tasks directly. Just click the chat icon in your dashboard and ask anything — it knows every feature of the platform.</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/login" className="px-4 py-2 bg-[#C4622D] hover:bg-[#C4622D]/90 text-white text-sm font-medium rounded-xl transition-colors">Open Dashboard</Link>
            <a href="mailto:support@octopuskills.com" className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white text-sm rounded-xl transition-colors">Email Support</a>
          </div>
        </div>

        {/* Platform Modules */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6">Platform Modules</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            <ModuleCard icon={Rocket} title="Growth Engine" description="CRM, lead pipeline, AI outreach campaigns, email sequences" color="#C4622D" />
            <ModuleCard icon={Palette} title="Creative Studio" description="Ad Factory, UGC videos, Motion Graphics, AI image generation" color="#8B5CF6" />
            <ModuleCard icon={Globe} title="Social Bridge" description="LinkedIn publishing, scheduling, and analytics" color="#4A90D9" />
            <ModuleCard icon={CreditCard} title="Invoicing" description="Create, send, and track invoices with PDF generation" color="#10B981" />
            <ModuleCard icon={Users} title="Sales & Voice Agents" description="AI chatbots and voice agents for customer engagement" color="#F59E0B" />
            <ModuleCard icon={Cpu} title="Code Engine" description="AI website generator with real-time preview" color="#EC4899" />
            <ModuleCard icon={Zap} title="Turbo Mode" description="Connect your OpenRouter API key for premium AI models" color="#F97316" />
            <ModuleCard icon={Shield} title="IoT / Smart Home" description="Control HubSpace and WiZ smart devices from your dashboard" color="#06B6D4" />
          </div>
        </div>

        {/* FAQ */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6">Frequently Asked Questions</h2>
          <div className="space-y-4">
            <FaqItem q="What is Octopus AI?" a="Octopus AI (octopuskills.com) is an all-in-one AI-powered marketing and business operations platform. It combines CRM, social media management, invoicing, calendar, AI creative tools, and smart home integration into a single cockpit. Built by Wildverse LLC." />
            <FaqItem q="How much does Octopus AI cost?" a="Three plans: Starter (free forever), Pro ($29/month) with expanded limits and Turbo Mode, and Business ($99/month) with unlimited access. All plans include core operations features like CRM, Social Bridge, Invoicing, and Calendar." />
            <FaqItem q="What is Turbo Mode?" a="Turbo Mode lets you connect your own OpenRouter API key to access premium AI models (GPT-5.4, Claude, Gemini Pro, FLUX.2, etc.). The built-in RouteLLM engine provides free basic quality. Turbo Mode is available on Pro and Business plans." />
            <FaqItem q="Do I need my own API key?" a="No — Octopus AI works out of the box with a free built-in AI engine. For professional campaign-quality output, you can optionally connect your own API key via Turbo Mode. All operations features work without any API key." />
            <FaqItem q="What integrations are supported?" a="Google Workspace (Gmail, Calendar, Drive, Docs, Sheets), LinkedIn (Social Bridge), Telegram, OpenRouter (Turbo Mode), HubSpace and WiZ smart home platforms, and Stripe for payments. More integrations are coming." />
            <FaqItem q="Is my data secure?" a="Yes. All data encrypted in transit (TLS 1.3) and at rest (AES-256). User data is logically isolated. We never sell data or use it to train AI models. GDPR and CCPA compliant." />
            <FaqItem q="Can I use Octopus AI in Spanish?" a="Yes! Fully bilingual (English/Spanish). Switch languages anytime from the header. The OCTOPUS assistant speaks both languages naturally." />
            <FaqItem q="How do I cancel my subscription?" a="Go to Settings → Plan & Billing in your dashboard. Click 'Cancel Plan'. Your access continues until the end of your current billing period. No refunds for partial months." />
            <FaqItem q="Can I export my data?" a="Data export is available on the Business plan. You can always manually export leads, invoices, and creative assets from their respective modules. We also honor GDPR data portability requests." />
          </div>
        </div>

        {/* Contact CTA */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
          <h2 className="text-xl font-bold text-white mb-3">Still need help?</h2>
          <p className="text-[#F5F0E8]/60 text-sm mb-6">Our team responds within 24 hours. Available in English and Spanish.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href="mailto:support@octopuskills.com" className="flex items-center gap-2 px-5 py-2.5 bg-[#C4622D] hover:bg-[#C4622D]/90 text-white text-sm font-medium rounded-xl transition-colors">
              <Mail className="w-4 h-4" /> Email Support
            </a>
            <Link href="/contact" className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/15 text-white text-sm rounded-xl transition-colors">
              <MessageSquare className="w-4 h-4" /> Contact Page
            </Link>
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
