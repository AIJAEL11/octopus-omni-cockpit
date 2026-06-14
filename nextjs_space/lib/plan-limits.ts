// ============================================
// OCTOPUS Plan Limits — Central Configuration
// ============================================

export type PlanId = 'starter' | 'pro' | 'business'

export type GateFeature = 'leads' | 'creative' | 'iot' | 'agents' | 'api_keys' | 'brazos' | 'jarvis_premium' | 'data_export' | 'turbo_mode' | 'emails_daily'

export interface PlanLimits {
  // Phase 1
  maxLeads: number          // Total leads allowed
  maxCreativeAssets: number  // Per month
  maxIotDevices: number
  // Phase 2
  maxAgents: number          // Agent Factory custom agents
  maxApiKeys: number         // API Hub keys
  maxBrazos: number          // Brazos connections
  maxEmailsPerDay: number    // Outbound growth emails per day (rate limit)
  jarvisPremium: boolean     // Voice mode, image gen, web search
  // Phase 4
  dataExport: boolean        // Full data export
  turboMode: boolean         // Turbo Mode (own API key)
  // Labels
  label: string
  labelEn: string
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  starter: {
    maxLeads: 150,
    maxCreativeAssets: 3,     // Reduced from 5 → 3
    maxIotDevices: 3,         // Reduced from 5 → 3
    maxAgents: 2,             // Reduced from 3 → 2
    maxApiKeys: 1,            // Reduced from 2 → 1
    maxBrazos: 1,             // Reduced from 2 → 1
    maxEmailsPerDay: 25,
    jarvisPremium: false,
    dataExport: false,
    turboMode: false,
    label: 'Starter',
    labelEn: 'Starter',
  },
  pro: {
    maxLeads: 500,
    maxCreativeAssets: 999999,
    maxIotDevices: 25,
    maxAgents: 999999,
    maxApiKeys: 10,
    maxBrazos: 10,
    maxEmailsPerDay: 200,
    jarvisPremium: true,
    dataExport: false,         // Pro gets basic CSV export only
    turboMode: true,
    label: 'Pro',
    labelEn: 'Pro',
  },
  business: {
    maxLeads: 999999,
    maxCreativeAssets: 999999,
    maxIotDevices: 999999,
    maxAgents: 999999,
    maxApiKeys: 999999,
    maxBrazos: 999999,
    maxEmailsPerDay: 1000,
    jarvisPremium: true,
    dataExport: true,          // Full export included after 1 month
    turboMode: true,
    label: 'Business',
    labelEn: 'Business',
  },
}

export function getPlanLimits(planId: string): PlanLimits {
  return PLAN_LIMITS[(planId as PlanId)] || PLAN_LIMITS.starter
}

// Minimum plan required for a feature at a given count
export function getMinPlanForFeature(feature: GateFeature, currentCount: number): PlanId | null {
  const limitKey: Record<string, keyof PlanLimits> = {
    leads: 'maxLeads',
    creative: 'maxCreativeAssets',
    iot: 'maxIotDevices',
    agents: 'maxAgents',
    api_keys: 'maxApiKeys',
    brazos: 'maxBrazos',
    emails_daily: 'maxEmailsPerDay',
  }

  // Boolean features (no count-based limit)
  if (feature === 'jarvis_premium') return 'pro'
  if (feature === 'turbo_mode') return 'pro'
  if (feature === 'data_export') return 'business'

  const key = limitKey[feature]
  if (!key) return null

  for (const plan of ['starter', 'pro', 'business'] as PlanId[]) {
    if (currentCount < (PLAN_LIMITS[plan][key] as number)) return plan === 'starter' ? null : plan
  }
  return 'business'
}
