// ============================================
// OCTOPUS Plan Gate — Server-side usage checker
// ============================================

import { prisma } from '@/lib/prisma'
import { getPlanLimits, type GateFeature } from '@/lib/plan-limits'
import { isAdminEmail } from '@/lib/admin-guard'

const UNLIMITED = 999999

export type { GateFeature } from '@/lib/plan-limits'

export interface GateResult {
  allowed: boolean
  current: number
  limit: number
  planId: string
  upgradeRequired?: string  // 'pro' | 'business'
}

/**
 * Check if user can create more of a resource based on their plan.
 * Call this BEFORE creating a new resource.
 */
export async function checkPlanGate(userId: string, feature: GateFeature): Promise<GateResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { planId: true, promoTrialEndsAt: true, email: true, brazosUnlimitedUntil: true },
  })
  // Admin gets unlimited access — Rafael, Founder & CEO
  if (isAdminEmail(user?.email)) {
    return { allowed: true, current: 0, limit: UNLIMITED, planId: 'admin' }
  }
  // Early-adopter: unlimited brazos for privileged users
  const hasBrazosPromo = user?.brazosUnlimitedUntil && new Date(user.brazosUnlimitedUntil) > new Date()
  // If user has an active promo trial, treat them as 'pro'
  const hasActivePromo = user?.promoTrialEndsAt && new Date(user.promoTrialEndsAt) > new Date()
  const planId = hasActivePromo ? 'pro' : (user?.planId || 'starter')
  const limits = getPlanLimits(planId)

  let current = 0

  switch (feature) {
    case 'leads': {
      current = await prisma.growthLead.count({ where: { userId } })
      const limit = limits.maxLeads
      if (current >= limit) {
        return { allowed: false, current, limit, planId, upgradeRequired: planId === 'starter' ? 'pro' : 'business' }
      }
      return { allowed: true, current, limit, planId }
    }

    case 'creative': {
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)
      current = await prisma.creativeAsset.count({
        where: { userId, createdAt: { gte: startOfMonth } },
      })
      const limit = limits.maxCreativeAssets
      if (current >= limit) {
        return { allowed: false, current, limit, planId, upgradeRequired: 'pro' }
      }
      return { allowed: true, current, limit, planId }
    }

    case 'iot': {
      current = await prisma.smartDevice.count({ where: { userId } })
      const limit = limits.maxIotDevices
      if (current >= limit) {
        return { allowed: false, current, limit, planId, upgradeRequired: planId === 'starter' ? 'pro' : 'business' }
      }
      return { allowed: true, current, limit, planId }
    }

    case 'api_keys': {
      current = await prisma.apiKey.count({ where: { userId } })
      const limit = limits.maxApiKeys
      if (current >= limit) {
        return { allowed: false, current, limit, planId, upgradeRequired: planId === 'starter' ? 'pro' : 'business' }
      }
      return { allowed: true, current, limit, planId }
    }

    case 'brazos': {
      // Early-adopter promo: unlimited brazos
      if (hasBrazosPromo) {
        return { allowed: true, current: 0, limit: UNLIMITED, planId }
      }
      current = await prisma.armConnection.count({ where: { userId } })
      const limit = limits.maxBrazos
      if (current >= limit) {
        return { allowed: false, current, limit, planId, upgradeRequired: planId === 'starter' ? 'pro' : 'business' }
      }
      return { allowed: true, current, limit, planId }
    }

    case 'agents': {
      // Server-side count of custom agents (Agent Factory persists in DB)
      current = await prisma.customAgent.count({ where: { userId } })
      const limit = limits.maxAgents
      if (current >= limit) {
        return { allowed: false, current, limit, planId, upgradeRequired: planId === 'starter' ? 'pro' : 'business' }
      }
      return { allowed: true, current, limit, planId }
    }

    case 'emails_daily': {
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      current = await prisma.growthMessage.count({
        where: {
          userId,
          direction: 'outbound',
          channel: 'email',
          createdAt: { gte: startOfDay },
        },
      })
      const limit = limits.maxEmailsPerDay
      if (current >= limit) {
        return { allowed: false, current, limit, planId, upgradeRequired: planId === 'starter' ? 'pro' : 'business' }
      }
      return { allowed: true, current, limit, planId }
    }

    case 'jarvis_premium': {
      if (!limits.jarvisPremium) {
        return { allowed: false, current: 0, limit: 0, planId, upgradeRequired: 'pro' }
      }
      return { allowed: true, current: 0, limit: 0, planId }
    }

    case 'turbo_mode': {
      if (!limits.turboMode) {
        return { allowed: false, current: 0, limit: 0, planId, upgradeRequired: 'pro' }
      }
      return { allowed: true, current: 0, limit: 0, planId }
    }

    case 'data_export': {
      if (!limits.dataExport) {
        return { allowed: false, current: 0, limit: 0, planId, upgradeRequired: 'business' }
      }
      return { allowed: true, current: 0, limit: 0, planId }
    }

    default:
      return { allowed: true, current: 0, limit: 999999, planId }
  }
}

/**
 * Get usage summary for a user (for UI display)
 */
export async function getUsageSummary(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { planId: true, promoTrialEndsAt: true, email: true, brazosUnlimitedUntil: true },
  })
  const isAdmin = isAdminEmail(user?.email)
  const hasBrazosPromo = !isAdmin && user?.brazosUnlimitedUntil && new Date(user.brazosUnlimitedUntil) > new Date()
  const hasActivePromo = user?.promoTrialEndsAt && new Date(user.promoTrialEndsAt) > new Date()
  const planId = isAdmin ? 'admin' : (hasActivePromo ? 'pro' : (user?.planId || 'starter'))
  const baseLimits = getPlanLimits(isAdmin ? 'business' : planId)
  const limits = isAdmin
    ? {
        ...baseLimits,
        maxLeads: UNLIMITED,
        maxCreativeAssets: UNLIMITED,
        maxIotDevices: UNLIMITED,
        maxApiKeys: UNLIMITED,
        maxBrazos: UNLIMITED,
        maxAgents: UNLIMITED,
        maxEmailsPerDay: UNLIMITED,
        jarvisPremium: true,
        turboMode: true,
        dataExport: true,
      }
    : baseLimits

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const [leadsCount, creativeCount, iotCount, apiKeysCount, brazosCount, emailsTodayCount] = await Promise.all([
    prisma.growthLead.count({ where: { userId } }),
    prisma.creativeAsset.count({ where: { userId, createdAt: { gte: startOfMonth } } }),
    prisma.smartDevice.count({ where: { userId } }),
    prisma.apiKey.count({ where: { userId } }),
    prisma.armConnection.count({ where: { userId } }),
    prisma.growthMessage.count({ where: { userId, direction: 'outbound', channel: 'email', createdAt: { gte: startOfDay } } }),
  ])

  return {
    planId,
    leads: { current: leadsCount, limit: limits.maxLeads },
    creative: { current: creativeCount, limit: limits.maxCreativeAssets },
    iot: { current: iotCount, limit: limits.maxIotDevices },
    api_keys: { current: apiKeysCount, limit: limits.maxApiKeys },
    brazos: { current: brazosCount, limit: hasBrazosPromo ? UNLIMITED : limits.maxBrazos },
    agents: { current: 0, limit: limits.maxAgents }, // Client-side count
    emails_daily: { current: emailsTodayCount, limit: limits.maxEmailsPerDay },
    jarvis_premium: { allowed: limits.jarvisPremium },
    turbo_mode: { allowed: limits.turboMode },
    data_export: { allowed: limits.dataExport },
  }
}
