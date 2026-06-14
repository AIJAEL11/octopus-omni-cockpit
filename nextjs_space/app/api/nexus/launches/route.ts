import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

const LAUNCH_PRICE = 19.99
const LAUNCH_CURRENCY = 'usd'
const LAUNCH_DURATION_DAYS = 30

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/nexus/launches — List launches for a project
// POST /api/nexus/launches — Create a launch (initiate Stripe checkout)
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 })
    }

    // Verify project ownership
    const project = await prisma.nexusProject.findFirst({
      where: { id: projectId, userId: session.user.id },
    })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const launches = await prisma.nexusLaunch.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { events: true } },
      },
    })

    return NextResponse.json({ launches })
  } catch (error: unknown) {
    console.error('[Nexus Launches GET]', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { projectId } = body

    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 })
    }

    // Verify project ownership
    const project = await prisma.nexusProject.findFirst({
      where: { id: projectId, userId: session.user.id },
    })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Check for existing active launch
    const activeLaunch = await prisma.nexusLaunch.findFirst({
      where: { projectId, status: 'ACTIVE' },
    })
    if (activeLaunch) {
      return NextResponse.json(
        { error: 'Project already has an active launch' },
        { status: 409 }
      )
    }

    // Create pending launch record
    const launch = await prisma.nexusLaunch.create({
      data: {
        projectId,
        userId: session.user.id,
        amountPaid: LAUNCH_PRICE,
        currency: LAUNCH_CURRENCY,
        status: 'PENDING',
      },
    })

    // Create Stripe Checkout session
    const baseUrl = process.env.NEXTAUTH_URL || 'https://octopuskills.com'
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: LAUNCH_CURRENCY,
            product_data: {
              name: `Nexus Launch: ${project.name}`,
              description: `${LAUNCH_DURATION_DAYS}-day product launch on Nexus Discovery Network`,
            },
            unit_amount: Math.round(LAUNCH_PRICE * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        nexus_launch_id: launch.id,
        nexus_project_id: projectId,
        user_id: session.user.id,
        type: 'nexus_launch',
      },
      success_url: `${baseUrl}/dashboard/nexus/projects/${projectId}?launch=success`,
      cancel_url: `${baseUrl}/dashboard/nexus/projects/${projectId}?launch=cancelled`,
    })

    // Update launch with Stripe session ID
    await prisma.nexusLaunch.update({
      where: { id: launch.id },
      data: { stripeSessionId: checkoutSession.id },
    })

    console.log(`[Nexus] Launch created: ${launch.id} for project ${projectId}, Stripe session: ${checkoutSession.id}`)
    return NextResponse.json({
      launch,
      checkoutUrl: checkoutSession.url,
    }, { status: 201 })
  } catch (error: unknown) {
    console.error('[Nexus Launches POST]', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
