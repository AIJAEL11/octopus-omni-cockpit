import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NexusLandingClient } from '@/components/nexus/LandingClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Nexus — Decentralized Distribution Network',
  description: 'Your project reaches who needs it. No SEO, no ads, no intermediaries. Nexus connects your project directly with users looking for it.'
}

export default async function NexusPage() {
  const session = await getServerSession(authOptions)
  return <NexusLandingClient isLoggedIn={!!session} />
}
