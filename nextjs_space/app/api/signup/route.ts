export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// ── Promo config ──────────────────────────────────────────
// Promo window: May 7–11, 2026 (Eastern Time / New York)
// Anyone who signs up with ?promo=OCTOPUS-LIVE during this window
// gets 6 months of Pro for free.
const PROMO_CODE = 'OCTOPUS-LIVE'
const PROMO_WINDOW_START = new Date('2026-05-07T00:00:00-04:00') // May 7 midnight ET
const PROMO_WINDOW_END   = new Date('2026-05-12T04:00:00-04:00') // end of May 11 ET
const PROMO_MONTHS = 6

// Early-adopter Brazos unlimited window — all signups this week
// get 1 month of unlimited Brazos connections (no promo code needed)
const BRAZOS_PROMO_START = new Date('2026-05-08T00:00:00-04:00') // May 8 midnight ET
const BRAZOS_PROMO_END   = new Date('2026-05-15T04:00:00-04:00') // end of May 14 ET
const BRAZOS_PROMO_DAYS  = 30 // 1 month of unlimited brazos

function isPromoActive(): boolean {
  const now = new Date()
  return now >= PROMO_WINDOW_START && now <= PROMO_WINDOW_END
}

function isBrazosPromoActive(): boolean {
  const now = new Date()
  return now >= BRAZOS_PROMO_START && now <= BRAZOS_PROMO_END
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, name, promo } = body ?? {}

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 400 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    // Check if promo should be applied
    const promoValid = promo?.toUpperCase() === PROMO_CODE && isPromoActive()
    const promoTrialEndsAt = promoValid
      ? new Date(Date.now() + PROMO_MONTHS * 30 * 24 * 60 * 60 * 1000)
      : undefined

    // Early-adopter brazos promo — unlimited brazos for 1 month
    const brazosPromo = isBrazosPromoActive()
    const brazosUnlimitedUntil = brazosPromo
      ? new Date(Date.now() + BRAZOS_PROMO_DAYS * 24 * 60 * 60 * 1000)
      : undefined

    const user = await prisma.user.create({
      data: {
        email,
        name: name ?? '',
        password: hashedPassword,
        ...(promoValid && {
          promoTrialEndsAt,
          promoSource: 'event-may-2026',
        }),
        ...(brazosPromo && {
          brazosUnlimitedUntil,
        }),
      },
    })

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      promoApplied: promoValid,
    })
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
