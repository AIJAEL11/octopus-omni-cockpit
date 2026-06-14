import { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Shield, Eye, Database, Lock, Globe, Mail, Cookie, Users, ArrowLeft, Server, Trash2, Bell } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Privacy Policy — Octopus AI | How We Protect Your Data',
  description: 'Learn how Octopus AI (octopuskills.com) collects, uses, and protects your personal data. GDPR & CCPA compliant. Transparent data practices for our AI marketing platform.',
  alternates: { canonical: 'https://octopuskills.com/privacy' },
  openGraph: {
    title: 'Privacy Policy — Octopus AI',
    description: 'Transparent data protection practices. Learn how we handle your data securely.',
    url: 'https://octopuskills.com/privacy',
    type: 'website',
  },
}

const LAST_UPDATED = '2026-06-01'

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Privacy Policy — Octopus AI',
  description: 'Privacy policy for Octopus AI SaaS platform. Details on data collection, usage, storage, and user rights.',
  url: 'https://octopuskills.com/privacy',
  dateModified: LAST_UPDATED,
  inLanguage: ['en', 'es'],
  isPartOf: {
    '@type': 'WebSite',
    name: 'Octopus AI',
    url: 'https://octopuskills.com',
  },
  publisher: {
    '@type': 'Organization',
    name: 'Wildverse LLC',
    url: 'https://octopuskills.com',
  },
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl bg-[#C4622D]/20 flex items-center justify-center">
          <Icon className="w-5 h-5 text-[#C4622D]" />
        </span>
        {title}
      </h2>
      <div className="text-[#F5F0E8]/70 leading-relaxed space-y-4 pl-[52px]">
        {children}
      </div>
    </section>
  )
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #1a1a1a 0%, #0d1117 100%)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Header */}
      <header className="border-b border-[#FFD700]/10 py-4 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
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

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        {/* Page Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-8 h-8 text-[#C4622D]" />
            <h1 className="text-3xl sm:text-4xl font-bold text-white">Privacy Policy</h1>
          </div>
          <p className="text-[#F5F0E8]/50 text-sm">Last updated: {LAST_UPDATED} · Applies to octopuskills.com</p>
          <p className="text-[#F5F0E8]/70 mt-4 text-lg leading-relaxed">
            At Octopus AI (operated by Wildverse LLC), we believe your data belongs to you. This policy explains what we collect, why, and how we protect it. We are committed to transparency and compliance with GDPR, CCPA, and applicable data protection laws.
          </p>
        </div>

        {/* Quick Summary */}
        <div className="bg-[#C4622D]/10 border border-[#C4622D]/20 rounded-2xl p-6 mb-12">
          <h2 className="text-lg font-bold text-white mb-3">🔒 Quick Summary</h2>
          <ul className="space-y-2 text-[#F5F0E8]/70 text-sm">
            <li>✅ We never sell your personal data to third parties</li>
            <li>✅ Your CRM leads, creative assets, and business data are yours — we don&apos;t use them to train AI models</li>
            <li>✅ You can export or delete your data at any time</li>
            <li>✅ We use industry-standard encryption (TLS 1.3 in transit, AES-256 at rest)</li>
            <li>✅ GDPR & CCPA compliant — we respect your rights regardless of location</li>
          </ul>
        </div>

        <Section icon={Database} title="1. Information We Collect">
          <p><strong className="text-white">Account Information:</strong> Name, email address, and password hash when you sign up. If you use Google SSO, we receive your Google profile name and email.</p>
          <p><strong className="text-white">Business Data You Create:</strong> CRM leads, campaigns, invoices, creative assets, projects, voice agent configurations, and calendar events. This data is created by you and stored securely in your account.</p>
          <p><strong className="text-white">API Keys (Optional):</strong> If you connect external services (OpenRouter, fal.ai, ElevenLabs, etc.) via the API Hub or Turbo Mode, your API keys are stored encrypted. We never use your keys for any purpose other than processing your requests.</p>
          <p><strong className="text-white">Usage Analytics:</strong> We collect anonymized usage patterns (pages visited, features used, session duration) to improve the platform. We do NOT track individual user behavior for advertising.</p>
          <p><strong className="text-white">Device Information:</strong> Browser type, operating system, and IP address for security and fraud prevention.</p>
        </Section>

        <Section icon={Eye} title="2. How We Use Your Information">
          <p>We use your information exclusively to:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Provide and maintain the Octopus AI platform services</li>
            <li>Process your CRM leads, campaigns, and creative generation requests</li>
            <li>Send transactional emails (password resets, campaign notifications, invoice deliveries)</li>
            <li>Improve platform performance and develop new features</li>
            <li>Detect and prevent security threats and abuse</li>
          </ul>
          <p className="mt-4"><strong className="text-white">We do NOT:</strong> Sell your data · Use your content to train AI models · Share your leads or business data with competitors · Send unsolicited marketing emails without consent</p>
        </Section>

        <Section icon={Server} title="3. Data Storage & Security">
          <p>Your data is hosted on secure cloud infrastructure with enterprise-grade protections:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-white">Encryption:</strong> All data encrypted in transit (TLS 1.3) and at rest (AES-256)</li>
            <li><strong className="text-white">Database:</strong> Isolated PostgreSQL instances with automated backups</li>
            <li><strong className="text-white">Access Control:</strong> Role-based access with multi-factor authentication for team members</li>
            <li><strong className="text-white">Monitoring:</strong> 24/7 security monitoring and intrusion detection</li>
            <li><strong className="text-white">Data Isolation:</strong> Each user&apos;s data is logically isolated — no user can access another user&apos;s data</li>
          </ul>
        </Section>

        <Section icon={Globe} title="4. Third-Party Services">
          <p>Octopus AI integrates with the following third-party services when you choose to connect them:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-white">Google Workspace:</strong> Gmail, Calendar, Drive (via OAuth 2.0 — we request only the permissions you authorize)</li>
            <li><strong className="text-white">OpenRouter:</strong> For Turbo Mode AI model access (your API key, your costs)</li>
            <li><strong className="text-white">Stripe:</strong> Payment processing (we never store full credit card numbers)</li>
            <li><strong className="text-white">LinkedIn:</strong> Social Bridge publishing (via your authorized connection)</li>
          </ul>
          <p className="mt-4">Each integration is optional and can be disconnected at any time from the Brazos (Arms) settings.</p>
        </Section>

        <Section icon={Cookie} title="5. Cookies & Tracking">
          <p>We use minimal cookies necessary for platform functionality:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-white">Session Cookie:</strong> Required for authentication (expires on logout)</li>
            <li><strong className="text-white">Preference Cookie:</strong> Stores your language and theme preference</li>
            <li><strong className="text-white">Analytics:</strong> Google Analytics with anonymized IP addresses (can be disabled)</li>
          </ul>
          <p className="mt-4">We do NOT use advertising cookies, cross-site tracking pixels, or fingerprinting techniques.</p>
        </Section>

        <Section icon={Users} title="6. Your Rights (GDPR & CCPA)">
          <p>Regardless of your location, you have the right to:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-white">Access:</strong> Request a copy of all data we hold about you</li>
            <li><strong className="text-white">Rectification:</strong> Correct inaccurate personal data</li>
            <li><strong className="text-white">Deletion:</strong> Request complete deletion of your account and data</li>
            <li><strong className="text-white">Portability:</strong> Export your data in standard formats</li>
            <li><strong className="text-white">Restriction:</strong> Limit how we process your data</li>
            <li><strong className="text-white">Objection:</strong> Object to specific data processing activities</li>
          </ul>
          <p className="mt-4">To exercise any of these rights, contact us at <a href="mailto:privacy@octopuskills.com" className="text-[#C4622D] hover:underline">privacy@octopuskills.com</a> or <a href="mailto:1billontopview@gmail.com" className="text-[#C4622D] hover:underline">1billontopview@gmail.com</a>. We respond within 30 days.</p>
        </Section>

        <Section icon={Trash2} title="7. Data Retention & Deletion">
          <p>We retain your data only as long as your account is active or as needed to provide services:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-white">Account Data:</strong> Retained while your account exists. Deleted within 30 days of account deletion request.</li>
            <li><strong className="text-white">Business Data:</strong> CRM leads, assets, invoices — deleted with your account</li>
            <li><strong className="text-white">Billing Records:</strong> Retained for 7 years as required by tax law</li>
            <li><strong className="text-white">Server Logs:</strong> Anonymized after 90 days, deleted after 1 year</li>
          </ul>
        </Section>

        <Section icon={Bell} title="8. Changes to This Policy">
          <p>We may update this privacy policy from time to time. When we make significant changes, we will:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Update the &quot;Last updated&quot; date at the top of this page</li>
            <li>Notify you via email for material changes</li>
            <li>Provide a summary of what changed</li>
          </ul>
        </Section>

        <Section icon={Mail} title="9. Contact Us">
          <p>If you have questions about this privacy policy or our data practices:</p>
          <div className="bg-white/5 rounded-xl p-4 mt-2">
            <p><strong className="text-white">Wildverse LLC</strong> (DBA Octopus AI)</p>
            <p>Email: <a href="mailto:privacy@octopuskills.com" className="text-[#C4622D] hover:underline">privacy@octopuskills.com</a></p>
            <p>Website: <a href="https://octopuskills.com" className="text-[#C4622D] hover:underline">octopuskills.com</a></p>
            <p>General: <a href="mailto:1billontopview@gmail.com" className="text-[#C4622D] hover:underline">1billontopview@gmail.com</a></p>
          </div>
        </Section>

        {/* Related Pages */}
        <div className="border-t border-white/10 pt-8 mt-12">
          <p className="text-sm text-[#F5F0E8]/50 mb-4">Related Pages</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/terms" className="text-sm text-[#C4622D] hover:text-[#C4622D]/80 transition-colors">Terms of Service →</Link>
            <Link href="/contact" className="text-sm text-[#C4622D] hover:text-[#C4622D]/80 transition-colors">Contact Us →</Link>
            <Link href="/support" className="text-sm text-[#C4622D] hover:text-[#C4622D]/80 transition-colors">Support Center →</Link>
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
