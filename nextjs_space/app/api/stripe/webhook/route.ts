export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let event: any

    if (webhookSecret && signature) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
      } catch (err) {
        console.error('Webhook signature verification failed:', err)
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
      }
    } else {
      event = JSON.parse(body)
    }

    console.log(`[Stripe Webhook] Event: ${event.type}`)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = event.data?.object as any

    switch (event.type) {
      case 'checkout.session.completed': {
        // Handle one-time data export purchase
        if (obj.metadata?.type === 'data_export' && obj.metadata?.userId) {
          const exportUserId = obj.metadata.userId
          console.log(`[Stripe Webhook] Data Export purchased by user ${exportUserId}`)
          await prisma.user.update({
            where: { id: exportUserId },
            data: { dataExportPurchased: true },
          })
          break
        }

        const userId = obj.metadata?.userId
        const planId = obj.metadata?.planId
        const period = obj.metadata?.period || 'monthly'
        const subId = typeof obj.subscription === 'string' ? obj.subscription : obj.subscription?.id

        if (userId && planId && subId) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sub = await stripe.subscriptions.retrieve(subId) as any
          const periodEnd = sub.current_period_end ?? sub.currentPeriodEnd ?? Math.floor(Date.now() / 1000)
          const trialEnd = sub.trial_end ?? sub.trialEnd ?? null

          await prisma.subscription.upsert({
            where: { userId },
            update: {
              stripeSubscriptionId: sub.id,
              stripePriceId: sub.items.data[0].price.id,
              stripeCurrentPeriodEnd: new Date(periodEnd * 1000),
              status: sub.status,
              trialEnd: trialEnd ? new Date(trialEnd * 1000) : null,
            },
            create: {
              userId,
              stripeSubscriptionId: sub.id,
              stripePriceId: sub.items.data[0].price.id,
              stripeCurrentPeriodEnd: new Date(periodEnd * 1000),
              status: sub.status,
              trialEnd: trialEnd ? new Date(trialEnd * 1000) : null,
            },
          })

          await prisma.user.update({
            where: { id: userId },
            data: {
              planId,
              planPeriod: period,
              stripeCustomerId: typeof obj.customer === 'string' ? obj.customer : obj.customer?.id,
            },
          })
        }
        break
      }

      case 'customer.subscription.updated': {
        const userId = obj.metadata?.userId
        if (userId) {
          const periodEnd = obj.current_period_end ?? obj.currentPeriodEnd ?? Math.floor(Date.now() / 1000)
          const trialEnd = obj.trial_end ?? obj.trialEnd ?? null

          await prisma.subscription.upsert({
            where: { userId },
            update: {
              stripePriceId: obj.items.data[0].price.id,
              stripeCurrentPeriodEnd: new Date(periodEnd * 1000),
              status: obj.status,
              cancelAtPeriodEnd: obj.cancel_at_period_end ?? false,
              trialEnd: trialEnd ? new Date(trialEnd * 1000) : null,
            },
            create: {
              userId,
              stripeSubscriptionId: obj.id,
              stripePriceId: obj.items.data[0].price.id,
              stripeCurrentPeriodEnd: new Date(periodEnd * 1000),
              status: obj.status,
              cancelAtPeriodEnd: obj.cancel_at_period_end ?? false,
              trialEnd: trialEnd ? new Date(trialEnd * 1000) : null,
            },
          })

          const price = await stripe.prices.retrieve(obj.items.data[0].price.id)
          if (price.metadata?.plan_id) {
            await prisma.user.update({
              where: { id: userId },
              data: {
                planId: price.metadata.plan_id,
                planPeriod: price.metadata.period || 'monthly',
              },
            })
          }
        }
        break
      }

      case 'customer.subscription.deleted': {
        const userId = obj.metadata?.userId
        if (userId) {
          await prisma.subscription.updateMany({
            where: { stripeSubscriptionId: obj.id },
            data: { status: 'canceled' },
          })
          await prisma.user.update({
            where: { id: userId },
            data: { planId: 'starter', planPeriod: 'monthly' },
          })
        }
        break
      }

      case 'invoice.payment_failed': {
        const subscriptionId = typeof obj.subscription === 'string' ? obj.subscription : obj.subscription?.id
        if (subscriptionId) {
          await prisma.subscription.updateMany({
            where: { stripeSubscriptionId: subscriptionId },
            data: { status: 'past_due' },
          })
        }
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
