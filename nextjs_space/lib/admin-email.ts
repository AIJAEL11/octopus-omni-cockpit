/**
 * OCTOPUS Admin Email — client-safe (no server imports).
 * Used by both client components and server-side admin-guard.
 */

// The supreme admin email — Rafael, Founder & CEO
export const ADMIN_EMAIL = '1billontopview@gmail.com'

/**
 * Check if an email is the admin email (safe on client and server)
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return email.toLowerCase() === ADMIN_EMAIL.toLowerCase()
}
