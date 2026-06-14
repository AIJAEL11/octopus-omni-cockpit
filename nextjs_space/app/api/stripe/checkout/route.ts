export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe, ensureStripePrices, ensureExportPrice, PlanId } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const origin = request.headers.get('origin') || ''

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Create or retrieve Stripe customer
    let customerId = user.stripeCustomerId
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name || undefined,
        metadata: { userId: user.id },
      })
      customerId = customer.id
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      })
    }

    // ─── One-time Data Export Purchase ($199) ───
    if (body.mode === 'one_time_export') {
      const exportPriceId = await ensureExportPrice()
      if (!exportPriceId) {
        return NextResponse.json({ error: 'Export price not configured' }, { status: 500 })
      }

      const checkoutSession = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{ price: exportPriceId, quantity: 1 }],
        success_url: `${origin}/dashboard/settings?tab=billing&export_success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/dashboard/settings?tab=billing&export_canceled=true`,
        metadata: { type: 'data_export', userId: user.id },
      })

      return NextResponse.json({ url: checkoutSession.url })
    }

    // ─── Subscription Checkout ───
    const { planId, period } = body as { planId: PlanId; period: 'monthly' | 'annual' }

    if (!planId || planId === 'starter') {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const priceMap = await ensureStripePrices()
    const priceId = period === 'annual' ? priceMap[planId]?.annual : priceMap[planId]?.monthly

    if (!priceId) {
      return NextResponse.json({ error: 'Price not found' }, { status: 400 })
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 14,
        metadata: { planId, period, userId: user.id },
      },
      success_url: `${origin}/dashboard/settings?tab=billing&success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing?canceled=true`,
      metadata: { planId, period, userId: user.id },
      allow_promotion_codes: true,
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
