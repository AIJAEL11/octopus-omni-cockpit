import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Providers } from '@/components/providers'
import GoogleAnalytics from '@/components/google-analytics'
import ConsoleFilter from '@/components/console-filter'
import './globals.css'

export const dynamic = 'force-dynamic'

const inter = Inter({ subsets: ['latin'] })

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL ?? 'https://octopuskills.com'),
  title: {
    default: 'Octopus AI | Autonomous Execution Engine for Sales & Marketing — Lead-to-Asset Automation',
    template: '%s | Octopus AI',
  },
  description:
    'Octopus AI is the autonomous execution engine for sales & marketing. From lead-to-asset automation to personalized AI videos, no-code AI workflows, growth prospecting, and 15+ integrated modules — all from one AI cockpit. Turn leads into creative assets in seconds.',
  keywords: [
    'AI Autonomous Cockpit',
    'Lead-to-Asset Automation',
    'Personalized AI Videos for Sales',
    'No-Code AI Workflows',
    'AI sales automation',
    'AI marketing automation',
    'autonomous AI agents',
    'AI lead generation',
    'AI ad factory',
    'AI growth engine',
    'AI voice agent',
    'AI video generator',
    'AI creative platform',
    'AI sales agent',
    'social media automation AI',
    'AI prospecting tool',
    'AI business automation',
    'motion graphics AI',
    'AI content creation',
    'AI campaign generator',
    'marketing AI platform',
    'sales AI platform',
    'plataforma IA todo en uno',
    'automatización marketing IA',
    'generador de leads IA',
    'videos personalizados con IA',
    'OCTOPUS',
    'octopuskills',
    'Wildverse',
  ],
  authors: [{ name: 'Wildverse LLC', url: 'https://octopuskills.com' }],
  creator: 'Wildverse LLC',
  publisher: 'Octopus AI by Wildverse',
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
  icons: {
    icon: '/octopus-core-logo.png',
    shortcut: '/octopus-core-logo.png',
    apple: '/octopus-core-logo.png',
  },
  alternates: {
    canonical: 'https://octopuskills.com',
    languages: {
      'es': 'https://octopuskills.com',
      'en': 'https://octopuskills.com',
    },
  },
  openGraph: {
    type: 'website',
    locale: 'es_ES',
    alternateLocale: 'en_US',
    siteName: 'Octopus AI',
    title: 'Octopus AI | Autonomous Execution Engine for Sales & Marketing',
    description:
      'From leads to personalized video assets in seconds. Octopus AI is the all-in-one autonomous cockpit with 15+ AI modules: Growth Engine, Ad Factory, Motion Graphics, Sales Agents, Social Bridge, and more.',
    url: 'https://octopuskills.com',
    images: [
      {
        url: '/og-image-v2.png',
        width: 1200,
        height: 630,
        alt: 'Octopus AI — Autonomous Execution Engine for Sales & Marketing',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Octopus AI | Autonomous Execution Engine for Sales & Marketing',
    description:
      'Lead-to-Asset Automation. Personalized AI Videos. No-Code AI Workflows. 15+ modules from one cockpit. Try free.',
    images: ['/og-image-v2.png'],
    creator: '@octopuskills',
  },
  category: 'technology',
}

const jsonLdSchemas = [
  // Schema 1: SoftwareApplication (for rich snippets with app details)
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Octopus AI',
    alternateName: ['OCTOPUS Omni Cockpit', 'OctopuSkills'],
    description:
      'Octopus AI is the autonomous execution engine for sales & marketing. Lead-to-Asset automation, personalized AI videos, no-code AI workflows, and 15+ integrated modules from one cockpit.',
    url: 'https://octopuskills.com',
    codeRepository: 'https://github.com/AJAEL11/proyecto-alfa-octopus',
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Marketing Automation',
    operatingSystem: 'Web',
    offers: {
      '@type': 'AggregateOffer',
      lowPrice: '0',
      highPrice: '299',
      priceCurrency: 'USD',
      offerCount: '3',
      offers: [
        { '@type': 'Offer', name: 'Starter', price: '0', priceCurrency: 'USD', description: 'Free plan with access to core modules' },
        { '@type': 'Offer', name: 'Pro', price: '49', priceCurrency: 'USD', description: 'Professional plan with full AI capabilities' },
        { '@type': 'Offer', name: 'Enterprise', price: '299', priceCurrency: 'USD', description: 'Enterprise plan with unlimited everything' },
      ],
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      reviewCount: '47',
      bestRating: '5',
      worstRating: '1',
    },
    featureList: [
      'Lead-to-Asset Automation — Turn leads into personalized video, image, audio & document assets',
      'AI Growth Engine — Smart prospecting with automated outreach and lead scoring',
      'Ad Factory — Generate ads for Facebook, Instagram, Google & TikTok with AI',
      'Motion Graphics Studio — AI-powered video generation with Veo 3.1, Kling, Seedance',
      'Sales Agent — Embeddable AI sales agents with real-time lead capture',
      'Social Bridge — Auto-publish to 8+ social networks',
      'AI Voice Agent — Premium TTS with ElevenLabs and real-time STT',
      'No-Code AI Workflows — Autonomous task execution without programming',
      'Campaign Generator — Auto-create full ad campaigns (copies, CTAs, landing pages)',
      'Smart Home IoT — Voice and web control of Shelly devices',
      'Code Engine — AI website generator with real-time preview and one-click deploy',
      'Ollama Chat — Private local AI with Llama, Mistral, DeepSeek models',
    ],
    screenshot: 'https://www.opengraph.io/images/before-and-after-link-preview.webp',
    creator: {
      '@type': 'Organization',
      name: 'Wildverse LLC',
      url: 'https://octopuskills.com',
    },
    inLanguage: ['es', 'en'],
  },
  // Schema 2: Organization (for Knowledge Panel)
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Wildverse LLC',
    alternateName: 'Octopus AI',
    url: 'https://octopuskills.com',
    logo: 'https://octopuskills.com/octopus-core-logo.png',
    description: 'Wildverse LLC builds Octopus AI — the autonomous execution engine for sales & marketing with 15+ AI-powered modules.',
    sameAs: [
      'https://x.com/octopuskills',
      'https://github.com/AJAEL11/proyecto-alfa-octopus',
      'https://citablehub.com/project/octopus-ai',
    ],
    foundingDate: '2025',
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      availableLanguage: ['English', 'Spanish'],
    },
  },
  // Schema 3: Product (for Google Merchant-style rich snippets)
  {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Octopus AI — Autonomous Execution Engine',
    description: 'All-in-one AI cockpit for sales & marketing: lead-to-asset automation, personalized AI videos, autonomous agents, growth prospecting, and no-code workflows.',
    brand: { '@type': 'Brand', name: 'Octopus AI' },
    url: 'https://octopuskills.com',
    image: 'https://i.fbcd.co/products/original/2-octopus-logo-template-b4373bc4bebbb0dd8cb9d8b0b994391498b1213e673c60984d5ec1ef04440501.jpg',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: 'https://octopuskills.com/pricing',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      reviewCount: '47',
      bestRating: '5',
    },
    category: 'Software > Business & Productivity Software > Marketing Software',
  },
]

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <head>
        {/* DNS prefetch & preconnect for external resources */}
        <link rel="dns-prefetch" href="https://apps.abacus.ai" />
        <link rel="preconnect" href="https://apps.abacus.ai" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
        {/* Priority preload for the hero video so it starts fetching before JS hydrates */}
        <link rel="preload" as="video" type="video/mp4" href="/videos/octopus-hero-v2.mp4" />
        <script src="https://apps.abacus.ai/chatllm/appllm-lib.js" async></script>
        {jsonLdSchemas.map((schema, i) => (
          <script
            key={i}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
          />
        ))}
      </head>
      <body className={`${inter.className} overflow-x-hidden`}>
        <GoogleAnalytics />
        <ConsoleFilter />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}