// ═══════════════════════════════════════════════════════════════════════════════
// 🩹 ENSURE SCHEMA — Auto-migración idempotente en runtime
// ───────────────────────────────────────────────────────────────────────────────
// Aplica columnas ADITIVAS sin necesidad de `prisma db push` manual en el deploy.
// Postgres soporta `ADD COLUMN IF NOT EXISTS`, así que esto es 100% seguro e
// idempotente: si las columnas ya existen (db push corrido a mano), no hace nada.
//
// Se ejecuta UNA sola vez por proceso (cache de promesa). El usuario no corre
// ningún comando ni adivina nada — la app se auto-repara en la primera petición.
// ═══════════════════════════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'

let ensured: Promise<void> | null = null

/**
 * Garantiza que existan las columnas de token tracking (Fase 4) en CodeSession
 * y CodeMessage. Idempotente y cacheado por proceso.
 */
export function ensureTokenColumns(): Promise<void> {
  if (ensured) return ensured
  ensured = (async () => {
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "CodeSession"
           ADD COLUMN IF NOT EXISTS "promptTokens" INTEGER NOT NULL DEFAULT 0,
           ADD COLUMN IF NOT EXISTS "completionTokens" INTEGER NOT NULL DEFAULT 0,
           ADD COLUMN IF NOT EXISTS "totalTokens" INTEGER NOT NULL DEFAULT 0,
           ADD COLUMN IF NOT EXISTS "estCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0;`,
      )
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "CodeMessage"
           ADD COLUMN IF NOT EXISTS "promptTokens" INTEGER NOT NULL DEFAULT 0,
           ADD COLUMN IF NOT EXISTS "completionTokens" INTEGER NOT NULL DEFAULT 0;`,
      )
      console.log('[ensureSchema] Token tracking columns ensured (Fase 4)')
    } catch (err) {
      // Si falla (p.ej. DB temporalmente inalcanzable), permite reintento en la
      // siguiente petición en vez de cachear el fallo permanentemente.
      ensured = null
      console.error('[ensureSchema] Could not ensure token columns:', err instanceof Error ? err.message : err)
    }
  })()
  return ensured
}
