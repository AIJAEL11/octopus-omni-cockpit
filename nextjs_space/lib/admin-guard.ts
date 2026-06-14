/**
 * OCTOPUS Admin Guard
 * Protects admin routes and features — only the platform owner can access.
 */

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

import { ADMIN_EMAIL, isAdminEmail } from '@/lib/admin-email'

export { ADMIN_EMAIL, isAdminEmail }

/**
 * Server-side: Check if the current session belongs to the admin
 */
export async function isAdminSession(): Promise<{ isAdmin: boolean; session: { user: { id: string; email: string; name?: string | null } } | null }> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return { isAdmin: false, session: null }
  }
  return {
    isAdmin: session.user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase(),
    session: session as { user: { id: string; email: string; name?: string | null } },
  }
}

