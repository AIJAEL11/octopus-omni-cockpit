import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { NexusAdminClient } from '@/components/nexus/AdminClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Admin \u2014 Nexus' }

export default async function NexusAdminPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || session.user.email !== '1billontopview@gmail.com') {
    redirect('/nexus')
  }
  return <NexusAdminClient />
}
