export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma, withDbRetry } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, source = 'hero' } = body ?? {}

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
      )
    }

    const cleanEmail = email.trim().toLowerCase()

    // Extract UTM params from referrer or body
    const utmSource = body.utmSource || null
    const utmMedium = body.utmMedium || null
    const utmCampaign = body.utmCampaign || null

    // Check if this email already exists as a user
    const existingUser = await withDbRetry(() =>
      prisma.user.findUnique({ where: { email: cleanEmail } })
    )

    if (existingUser) {
      return NextResponse.json(
        { success: true, message: 'already_registered', redirect: '/login' },
        { status: 200 }
      )
    }

    // Check if lead already captured
    const existingLead = await withDbRetry(() =>
      prisma.landingLead.findFirst({ where: { email: cleanEmail } })
    )

    if (existingLead) {
      return NextResponse.json(
        { success: true, message: 'already_captured' },
        { status: 200 }
      )
    }

    // Create new landing lead
    await withDbRetry(() =>
      prisma.landingLead.create({
        data: {
          email: cleanEmail,
          source,
          utmSource,
          utmMedium,
          utmCampaign,
        },
      })
    )

    return NextResponse.json(
      { success: true, message: 'captured', redirect: `/login?email=${encodeURIComponent(cleanEmail)}` },
      { status: 201 }
    )
  } catch (error) {
    console.error('Lead capture error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
