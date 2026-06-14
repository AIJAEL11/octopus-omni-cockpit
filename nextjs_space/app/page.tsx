import { Metadata } from 'next'
import { LandingPage } from '@/components/landing/landing-page'
import { VoiceWidgetEmbed } from '@/components/voice-widget-embed'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Octopus AI | Autonomous Execution Engine for Sales & Marketing — Lead-to-Asset Automation',
  description: 'Octopus AI turns leads into personalized creative assets in seconds. AI Autonomous Cockpit with Lead-to-Asset Automation, Code Engine for AI website generation, Growth Engine, Ad Factory, Motion Graphics Studio, Ollama private local AI, and 15+ integrated modules. The all-in-one AI cockpit for autonomous sales & marketing execution.',
  keywords: [
    'AI Autonomous Cockpit',
    'Lead-to-Asset Automation',
    'Personalized AI Videos for Sales',
    'No-Code AI Workflows',
    'AI sales automation platform',
    'AI marketing automation',
    'autonomous AI agents',
    'AI lead generation tool',
    'AI ad generator',
    'AI growth engine',
    'AI video generator for marketing',
    'AI sales agent',
    'AI prospecting tool',
    'motion graphics AI generator',
    'AI campaign generator',
    'AI content creation platform',
    'marketing automation AI',
    'sales automation AI',
    'AI website generator',
    'AI code generator',
    'AI landing page builder',
    'Ollama local AI chat',
    'private AI assistant',
    'AI website builder no code',
    'generador de sitios web con IA',
    'plataforma IA marketing y ventas',
    'automatización de leads con IA',
    'videos personalizados con IA',
    'OCTOPUS AI',
    'octopuskills',
  ],
  openGraph: {
    title: 'Octopus AI | Autonomous Execution Engine for Sales & Marketing',
    description: 'Lead-to-Asset Automation. Personalized AI Videos. No-Code Workflows. Turn leads into creative assets in seconds with 15+ AI modules from one cockpit.',
    type: 'website',
    locale: 'es_ES',
    alternateLocale: 'en_US',
    siteName: 'Octopus AI',
    images: [{
      url: '/og-image-v2.png',
      width: 1200,
      height: 630,
      alt: 'Octopus AI — Autonomous Execution Engine for Sales & Marketing',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Octopus AI | Autonomous Execution Engine for Sales & Marketing',
    description: 'Lead-to-Asset Automation. Personalized AI Videos for Sales. No-Code AI Workflows. 15+ modules from one cockpit.',
    images: ['/og-image-v2.png'],
    creator: '@octopuskills',
  },
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function HomePage() {
  return (
    <>
      <LandingPage />
      <VoiceWidgetEmbed />
    </>
  )
}
