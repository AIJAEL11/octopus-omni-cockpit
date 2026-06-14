import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Boost connection pool to handle concurrent operations (campaigns, polling, etc.)
function buildDatasourceUrl(): string {
  const base = process.env.DATABASE_URL || ''
  const sep = base.includes('?') ? '&' : '?'
  // Only add pool params if not already present
  const extras: string[] = []
  if (!base.includes('connection_limit')) extras.push('connection_limit=10')
  if (!base.includes('pool_timeout')) extras.push('pool_timeout=30')
  return extras.length > 0 ? `${base}${sep}${extras.join('&')}` : base
}

// Patterns for expected/benign connection-lifecycle errors that should NOT spam logs.
// The platform DB enforces a short idle_session_timeout, so idle connections being
// terminated (E57P05 / 57P05) is normal behavior — Prisma reconnects transparently.
const BENIGN_DB_ERROR_PATTERNS = [
  'idle-session timeout',
  '57P05',
  'terminating connection due to administrator command',
  'server closed the connection unexpectedly',
]

function isBenignDbError(message: string): boolean {
  return BENIGN_DB_ERROR_PATTERNS.some(p => message.includes(p))
}

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'warn', { emit: 'event', level: 'error' }]
        : [{ emit: 'event', level: 'error' }],
    datasourceUrl: buildDatasourceUrl(),
  })

  // Intercept error events: silence benign idle-session/connection-recycle noise,
  // but keep every other DB error visible in the logs.
  ;(client as unknown as { $on: (event: string, cb: (e: { message?: string; target?: string }) => void) => void }).$on(
    'error',
    (e) => {
      const msg = e?.message || ''
      if (isBenignDbError(msg)) return
      console.error('[prisma:error]', msg, e?.target || '')
    }
  )

  return client
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

/**
 * Retry wrapper for Prisma operations that may fail due to connection pool
 * exhaustion (P2024) or server unreachable (P1001) errors.
 *
 * The generic captures the whole thenable (P) and unwraps it with Awaited:
 * Prisma returns PrismaPromise (not the global Promise), and inferring
 * against `() => Promise<T>` collapses T to unknown.
 */
export async function withDbRetry<P extends PromiseLike<unknown>>(
  operation: () => P,
  { retries = 3, delayMs = 500, label = 'DB' }: { retries?: number; delayMs?: number; label?: string } = {}
): Promise<Awaited<P>> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await operation()
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code
      const msg = (err as { message?: string })?.message || ''
      const isRetryable =
        code === 'P2024' || code === 'P1001' || code === 'P1008' || code === 'P1017' || code === 'P2037' ||
        isBenignDbError(msg)
      if (isRetryable && attempt < retries) {
        const wait = delayMs * attempt
        console.warn(`[${label}] Retryable error ${code} on attempt ${attempt}/${retries}, retrying in ${wait}ms...`)
        await new Promise(r => setTimeout(r, wait))
        continue
      }
      throw err
    }
  }
  throw new Error(`[${label}] Exhausted ${retries} retries`)
}
