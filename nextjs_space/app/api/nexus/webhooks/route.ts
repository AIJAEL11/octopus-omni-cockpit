import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

const LAUNCH_DURATION_DAYS = 30

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/nexus/webhooks — Stripe webhook handler for Nexus payments
// Handles: checkout.session.completed, charge.refunded
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    const webhookSecret = process.env.STRIPE_NEXUS_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error('[Nexus Webhook] STRIPE_NEXUS_WEBHOOK_SECRET not configured')
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
    }

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
    } catch (err: unknown) {
      console.error('[Nexus Webhook] Signature verification failed:', err)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    console.log(`[Nexus Webhook] Event: ${event.type}`)

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const meta = session.metadata || {}

        // Only handle Nexus launches
        if (meta.type !== 'nexus_launch' || !meta.nexus_launch_id) {
          console.log('[Nexus Webhook] Not a Nexus event, skipping')
          break
        }

        const launchId = meta.nexus_launch_id
        const projectId = meta.nexus_project_id

        const now = new Date()
        const expiresAt = new Date(now)
        expiresAt.setDate(expiresAt.getDate() + LAUNCH_DURATION_DAYS)

        // Activate the launch
        await prisma.nexusLaunch.update({
          where: { id: launchId },
          data: {
            status: 'ACTIVE',
            stripePaymentId: session.payment_intent as string,
            activatedAt: now,
            expiresAt,
          },
        })

        // Update project status to ACTIVE
        if (projectId) {
          await prisma.nexusProject.update({
            where: { id: projectId },
            data: {
              status: 'ACTIVE',
              launchedAt: now,
            },
          })
        }

        console.log(`[Nexus Webhook] Launch ${launchId} ACTIVATED, expires ${expiresAt.toISOString()}`)
        break
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session
        const meta = session.metadata || {}

        if (meta.type !== 'nexus_launch' || !meta.nexus_launch_id) break

        await prisma.nexusLaunch.update({
          where: { id: meta.nexus_launch_id },
          data: { status: 'CANCELLED' },
        })

        console.log(`[Nexus Webhook] Launch ${meta.nexus_launch_id} CANCELLED (session expired)`)
        break
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        const paymentIntentId = typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : charge.payment_intent?.id

        if (!paymentIntentId) break

        const launch = await prisma.nexusLaunch.findFirst({
          where: { stripePaymentId: paymentIntentId },
        })

        if (launch) {
          await prisma.nexusLaunch.update({
            where: { id: launch.id },
            data: { status: 'REFUNDED' },
          })

          // Pause the project
          await prisma.nexusProject.update({
            where: { id: launch.projectId },
            data: { status: 'PAUSED' },
          })

          console.log(`[Nexus Webhook] Launch ${launch.id} REFUNDED`)
        }
        break
      }

      default:
        console.log(`[Nexus Webhook] Unhandled event: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error: unknown) {
    console.error('[Nexus Webhook] Error:', error)
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 })
  }
}
