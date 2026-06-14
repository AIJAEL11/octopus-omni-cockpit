import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing | Octopus AI — Free, Pro & Enterprise Plans for AI Sales & Marketing Automation',
  description: 'Choose your Octopus AI plan. Start free with core modules, upgrade to Pro for full Lead-to-Asset Automation and Personalized AI Videos, or go Enterprise for unlimited autonomous AI workflows. No credit card required.',
  keywords: [
    'AI marketing pricing',
    'AI sales automation pricing',
    'Lead-to-Asset Automation pricing',
    'AI cockpit plans',
    'marketing AI free plan',
    'AI video generator pricing',
  ],
  openGraph: {
    title: 'Pricing | Octopus AI — Plans for Every Business',
    description: 'Start free. Scale with AI. From Lead-to-Asset Automation to Personalized AI Videos — choose the plan that fits your growth.',
    images: [{ url: '/og-image-v2.png', width: 1200, height: 630, alt: 'Octopus AI Pricing Plans' }],
  },
  alternates: { canonical: '/pricing' },
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
