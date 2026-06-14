import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  typescript: true,
})

export const PLANS = {
  starter: {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 0,
    annualPrice: 0,
    stripePriceIdMonthly: null as string | null,
    stripePriceIdAnnual: null as string | null,
    features: [
      'features.starter_ops_1',
      'features.starter_ops_2',
      'features.starter_ops_3',
      'features.starter_ops_4',
      'features.starter_ops_5',
      'features.starter_ops_6',
    ],
    limits: {
      projects: 5,
      devices: 5,
      leads: 50,
      connections: 2,
      turboMode: false,
      agentFactory: false,
      apiHub: false,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 29,
    annualPrice: 290,
    stripePriceIdMonthly: null as string | null,
    stripePriceIdAnnual: null as string | null,
    features: [
      'features.pro_ops_1',
      'features.pro_ops_2',
      'features.pro_ops_3',
      'features.pro_ops_4',
      'features.pro_ops_5',
      'features.pro_ops_6',
      'features.pro_ops_7',
    ],
    limits: {
      projects: -1,
      devices: 25,
      leads: 500,
      connections: -1,
      turboMode: true,
      agentFactory: true,
      apiHub: false,
    },
  },
  business: {
    id: 'business',
    name: 'Business',
    monthlyPrice: 99,
    annualPrice: 990,
    stripePriceIdMonthly: null as string | null,
    stripePriceIdAnnual: null as string | null,
    features: [
      'features.business_ops_1',
      'features.business_ops_2',
      'features.business_ops_3',
      'features.business_ops_4',
      'features.business_ops_5',
      'features.business_ops_6',
      'features.business_ops_7',
    ],
    limits: {
      projects: -1,
      devices: -1,
      leads: -1,
      connections: -1,
      turboMode: true,
      agentFactory: true,
      apiHub: true,
    },
  },
} as const

export type PlanId = keyof typeof PLANS

// Dynamically ensure Stripe products/prices exist
let _pricesInitialized = false
let _priceMap: Record<string, { monthly: string | null; annual: string | null }> = {}

export async function ensureStripePrices() {
  if (_pricesInitialized) return _priceMap
  
  for (const [planId, plan] of Object.entries(PLANS)) {
    if (planId === 'starter') {
      _priceMap[planId] = { monthly: null, annual: null }
      continue
    }

    // Search for existing product
    const products = await stripe.products.search({
      query: `metadata["plan_id"]:"${planId}"`,
    })

    let product: Stripe.Product
    if (products.data.length > 0) {
      product = products.data[0]
    } else {
      product = await stripe.products.create({
        name: `OctopusSkills ${plan.name}`,
        description: `Plan ${plan.name} - OCTOPUS Omni Cockpit`,
        metadata: { plan_id: planId },
      })
    }

    // Get or create monthly price
    const prices = await stripe.prices.list({
      product: product.id,
      active: true,
    })

    let monthlyPriceId: string | null = null
    let annualPriceId: string | null = null

    for (const p of prices.data) {
      if (p.recurring?.interval === 'month' && p.unit_amount === plan.monthlyPrice * 100) {
        monthlyPriceId = p.id
      }
      if (p.recurring?.interval === 'year' && p.unit_amount === plan.annualPrice * 100) {
        annualPriceId = p.id
      }
    }

    if (!monthlyPriceId) {
      const mp = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.monthlyPrice * 100,
        currency: 'usd',
        recurring: { interval: 'month' },
        metadata: { plan_id: planId, period: 'monthly' },
      })
      monthlyPriceId = mp.id
    }

    if (!annualPriceId) {
      const ap = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.annualPrice * 100,
        currency: 'usd',
        recurring: { interval: 'year' },
        metadata: { plan_id: planId, period: 'annual' },
      })
      annualPriceId = ap.id
    }

    _priceMap[planId] = { monthly: monthlyPriceId, annual: annualPriceId }
  }

  _pricesInitialized = true
  return _priceMap
}

// ─── One-time Data Export Price ($199) ───
let _exportPriceId: string | null = null

export async function ensureExportPrice(): Promise<string> {
  if (_exportPriceId) return _exportPriceId

  // Check env first (manual override)
  if (process.env.STRIPE_EXPORT_PRICE_ID) {
    _exportPriceId = process.env.STRIPE_EXPORT_PRICE_ID
    return _exportPriceId
  }

  // Search for existing product
  const products = await stripe.products.search({
    query: 'metadata["type"]:"data_export"',
  })

  let product: Stripe.Product
  if (products.data.length > 0) {
    product = products.data[0]
  } else {
    product = await stripe.products.create({
      name: 'OctopusSkills Data Export',
      description: 'One-time full data export - OCTOPUS Omni Cockpit',
      metadata: { type: 'data_export' },
    })
  }

  // Find or create $199 one-time price
  const prices = await stripe.prices.list({ product: product.id, active: true })
  const existing = prices.data.find(
    (p) => !p.recurring && p.unit_amount === 19900
  )

  if (existing) {
    _exportPriceId = existing.id
  } else {
    const newPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: 19900,
      currency: 'usd',
      metadata: { type: 'data_export' },
    })
    _exportPriceId = newPrice.id
  }

  return _exportPriceId
}
