'use client'

import { useState, useEffect, useCallback } from 'react'

type GateFeatureUI = 'leads' | 'creative' | 'iot' | 'agents' | 'api_keys' | 'brazos' | 'jarvis_premium' | 'data_export' | 'turbo_mode'

interface PlanUsage {
  planId: string
  leads: { current: number; limit: number }
  creative: { current: number; limit: number }
  iot: { current: number; limit: number }
  api_keys: { current: number; limit: number }
  brazos: { current: number; limit: number }
  agents: { current: number; limit: number }
  jarvis_premium: { allowed: boolean }
  turbo_mode: { allowed: boolean }
  data_export: { allowed: boolean }
}

export function usePlanGate() {
  const [upgradeModal, setUpgradeModal] = useState<{
    isOpen: boolean
    feature: GateFeatureUI
    current: number
    limit: number
    requiredPlan?: string
  }>({
    isOpen: false,
    feature: 'leads',
    current: 0,
    limit: 0,
  })

  const [usage, setUsage] = useState<PlanUsage | null>(null)

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch('/api/plan/usage')
      if (res.ok) {
        const data = await res.json()
        setUsage(data)
      }
    } catch (e) {
      console.error('Error fetching plan usage:', e)
    }
  }, [])

  useEffect(() => {
    fetchUsage()
  }, [])

  /**
   * Check an API response for plan_limit errors.
   * Returns true if it was a plan limit error (and shows the modal).
   */
  const handlePlanError = useCallback(async (
    response: Response,
    feature: GateFeatureUI
  ): Promise<boolean> => {
    if (response.status === 403) {
      try {
        const data = await response.json()
        if (data.error === 'plan_limit' && data.gate) {
          setUpgradeModal({
            isOpen: true,
            feature,
            current: data.gate.current,
            limit: data.gate.limit,
            requiredPlan: data.gate.upgradeRequired,
          })
          return true
        }
      } catch {
        // Not a JSON response, not a plan error
      }
    }
    return false
  }, [])

  /**
   * Show upgrade modal directly (for client-side checks like localStorage agents)
   */
  const showUpgradeModal = useCallback((feature: GateFeatureUI, current: number, limit: number, requiredPlan?: string) => {
    setUpgradeModal({ isOpen: true, feature, current, limit, requiredPlan: requiredPlan || 'pro' })
  }, [])

  const closeUpgradeModal = useCallback(() => {
    setUpgradeModal(prev => ({ ...prev, isOpen: false }))
  }, [])

  return {
    upgradeModal,
    closeUpgradeModal,
    handlePlanError,
    showUpgradeModal,
    usage,
    refreshUsage: fetchUsage,
  }
}
