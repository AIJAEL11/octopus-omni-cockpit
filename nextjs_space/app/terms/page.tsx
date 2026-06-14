import { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { FileText, Scale, Gavel, Shield, CreditCard, AlertTriangle, Users, Globe, ArrowLeft, Ban, RefreshCw, BookOpen, Lock } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Terms of Service — Octopus AI | Platform Usage Agreement',
  description: 'Terms of Service for Octopus AI (octopuskills.com). Understand your rights, responsibilities, subscription terms, and acceptable use policies for our AI marketing platform.',
  alternates: { canonical: 'https://octopuskills.com/terms' },
  openGraph: {
    title: 'Terms of Service — Octopus AI',
    description: 'Platform usage agreement covering subscriptions, data ownership, and acceptable use.',
    url: 'https://octopuskills.com/terms',
    type: 'website',
  },
}

const LAST_UPDATED = '2026-06-01'

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Terms of Service — Octopus AI',
  description: 'Terms of Service and user agreement for Octopus AI SaaS marketing platform.',
  url: 'https://octopuskills.com/terms',
  dateModified: LAST_UPDATED,
  inLanguage: ['en', 'es'],
  isPartOf: {
    '@type': 'WebSite',
    name: 'Octopus AI',
    url: 'https://octopuskills.com',
  },
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl bg-[#4A90D9]/20 flex items-center justify-center">
          <Icon className="w-5 h-5 text-[#4A90D9]" />
        </span>
        {title}
      </h2>
      <div className="text-[#F5F0E8]/70 leading-relaxed space-y-4 pl-[52px]">
        {children}
      </div>
    </section>
  )
}

export default function TermsPage() {
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #1a1a1a 0%, #0d1117 100%)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="border-b border-[#FFD700]/10 py-4 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-10 h-10">
              <Image src="/octopus-core-logo.png" alt="Octopus AI" fill className="object-contain" />
            </div>
            <span className="text-lg font-bold text-white group-hover:text-[#4A90D9] transition-colors">OCTOPUS</span>
          </Link>
          <Link href="/" className="flex items-center gap-2 text-sm text-[#F5F0E8]/60 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <Scale className="w-8 h-8 text-[#4A90D9]" />
            <h1 className="text-3xl sm:text-4xl font-bold text-white">Terms of Service</h1>
          </div>
          <p className="text-[#F5F0E8]/50 text-sm">Last updated: {LAST_UPDATED} · Effective immediately</p>
          <p className="text-[#F5F0E8]/70 mt-4 text-lg leading-relaxed">
            Welcome to Octopus AI. By using our platform at octopuskills.com, you agree to these terms. Please read them carefully — they outline your rights and responsibilities as a user of our AI-powered marketing platform.
          </p>
        </div>

        <Section icon={FileText} title="1. Acceptance of Terms">
          <p>By creating an account or using Octopus AI, you agree to be bound by these Terms of Service, our <Link href="/privacy" className="text-[#4A90D9] hover:underline">Privacy Policy</Link>, and any additional terms that apply to specific features.</p>
          <p>If you are using Octopus AI on behalf of a company or organization, you represent that you have the authority to bind that entity to these terms.</p>
        </Section>

        <Section icon={BookOpen} title="2. Description of Service">
          <p>Octopus AI is a SaaS (Software as a Service) marketing and business operations platform that provides:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-white">CRM & Growth Engine:</strong> Lead management, pipeline tracking, AI-powered outreach campaigns</li>
            <li><strong className="text-white">Social Bridge:</strong> Social media management and scheduling (currently LinkedIn)</li>
            <li><strong className="text-white">Creative Studio:</strong> AI-powered image, video, and content generation</li>
            <li><strong className="text-white">Invoicing:</strong> Invoice creation, PDF generation, and payment tracking</li>
            <li><strong className="text-white">Calendar:</strong> Event management and booking pages</li>
            <li><strong className="text-white">IoT Integration:</strong> Smart home device control (HubSpace/WiZ)</li>
            <li><strong className="text-white">AI Assistants:</strong> OCTOPUS chat, Voice Agents, Sales Agents</li>
          </ul>
          <p className="mt-4">The platform includes a basic AI engine (RouteLLM). Professional-grade AI generation requires connecting your own API key via Turbo Mode.</p>
        </Section>

        <Section icon={CreditCard} title="3. Subscription Plans & Billing">
          <p>Octopus AI offers three subscription tiers:</p>
          <div className="bg-white/5 rounded-xl p-4 mt-2">
            <div className="grid gap-3">
              <div className="flex justify-between items-center"><span className="font-semibold text-white">Starter</span><span>$0/month — Free forever</span></div>
              <div className="flex justify-between items-center"><span className="font-semibold text-white">Pro</span><span>$29/month</span></div>
              <div className="flex justify-between items-center"><span className="font-semibold text-white">Business</span><span>$99/month</span></div>
            </div>
          </div>
          <p className="mt-4">Paid subscriptions are billed monthly via Stripe. You may cancel at any time — your access continues until the end of the current billing period. No refunds for partial months.</p>
          <p>Prices may change with 30 days advance notice. Existing subscribers will be grandfathered at their current rate for at least 60 days after any price increase.</p>
        </Section>

        <Section icon={Shield} title="4. Your Data & Intellectual Property">
          <p><strong className="text-white">You own your data.</strong> All content you create, upload, or generate through Octopus AI — including leads, creative assets, invoices, campaigns, and agent configurations — belongs to you.</p>
          <p>We do not claim ownership over your content. We do not use your business data to train AI models. You grant us a limited license to process your data solely for the purpose of providing the platform services.</p>
          <p>You may export your data at any time. Upon account deletion, all your data is permanently removed within 30 days.</p>
        </Section>

        <Section icon={Ban} title="5. Acceptable Use">
          <p>You agree NOT to use Octopus AI for:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Sending spam, unsolicited bulk messages, or phishing emails</li>
            <li>Generating illegal, defamatory, or harmful content</li>
            <li>Attempting to access other users&apos; data or accounts</li>
            <li>Reverse-engineering, scraping, or copying the platform</li>
            <li>Using the platform to compete directly with Octopus AI</li>
            <li>Violating any applicable laws or regulations</li>
          </ul>
          <p className="mt-4">Violation of these terms may result in immediate account suspension without refund.</p>
        </Section>

        <Section icon={AlertTriangle} title="6. Limitation of Liability">
          <p>Octopus AI is provided &quot;as is&quot; without warranties of any kind. We make reasonable efforts to maintain uptime and data integrity, but we are not liable for:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Service interruptions, downtime, or data loss</li>
            <li>Results or outcomes from AI-generated content</li>
            <li>Third-party service failures (Google, Stripe, OpenRouter, etc.)</li>
            <li>Lost profits or business opportunities</li>
          </ul>
          <p className="mt-4">Our total liability is limited to the amount you have paid us in the 12 months preceding the claim.</p>
        </Section>

        <Section icon={RefreshCw} title="7. Service Changes & Termination">
          <p>We reserve the right to modify, suspend, or discontinue any feature of the platform with reasonable notice. We will:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Provide 30 days notice for significant feature removals</li>
            <li>Allow data export before any account termination</li>
            <li>Honor active subscriptions through their current billing period</li>
          </ul>
          <p className="mt-4">You may terminate your account at any time from Settings → Account.</p>
        </Section>

        <Section icon={Gavel} title="8. Governing Law">
          <p>These terms are governed by the laws of the State of Florida, United States. Any disputes will be resolved through binding arbitration in accordance with the rules of the American Arbitration Association, unless otherwise required by local law.</p>
          <p className="mt-4">For EU users: Nothing in these terms affects your statutory rights under EU consumer protection law.</p>
        </Section>

        <Section icon={Lock} title="9. AI-Specific Terms">
          <p>Regarding AI-generated content on the platform:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>AI outputs (images, text, videos) are generated based on your inputs and prompts</li>
            <li>You retain rights to AI-generated content created through your account</li>
            <li>AI outputs may not be perfect — always review before publishing or sending</li>
            <li>The quality of AI outputs depends on the model used (basic RouteLLM vs. premium Turbo Mode models)</li>
            <li>We are not responsible for how you use AI-generated content</li>
          </ul>
        </Section>

        <Section icon={Globe} title="10. Contact">
          <p>Questions about these terms? Reach us at:</p>
          <div className="bg-white/5 rounded-xl p-4 mt-2">
            <p><strong className="text-white">Wildverse LLC</strong></p>
            <p>Email: <a href="mailto:legal@octopuskills.com" className="text-[#4A90D9] hover:underline">legal@octopuskills.com</a></p>
            <p>General: <a href="mailto:1billontopview@gmail.com" className="text-[#4A90D9] hover:underline">1billontopview@gmail.com</a></p>
            <p>Web: <a href="https://octopuskills.com" className="text-[#4A90D9] hover:underline">octopuskills.com</a></p>
          </div>
        </Section>

        <div className="border-t border-white/10 pt-8 mt-12">
          <p className="text-sm text-[#F5F0E8]/50 mb-4">Related Pages</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/privacy" className="text-sm text-[#4A90D9] hover:text-[#4A90D9]/80 transition-colors">Privacy Policy →</Link>
            <Link href="/contact" className="text-sm text-[#4A90D9] hover:text-[#4A90D9]/80 transition-colors">Contact Us →</Link>
            <Link href="/support" className="text-sm text-[#4A90D9] hover:text-[#4A90D9]/80 transition-colors">Support Center →</Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-white/10 py-6 px-4">
        <div className="max-w-4xl mx-auto text-center text-xs text-[#F5F0E8]/40">
          © {new Date().getFullYear()} Wildverse LLC · Octopus AI · All rights reserved
        </div>
      </footer>
    </div>
  )
}
