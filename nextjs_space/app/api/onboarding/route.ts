export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { projectName, projectType, objective } = body ?? {}

    if (!projectName || !projectType || !objective) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    const onboarding = await prisma.onboardingData.upsert({
      where: { userId: session.user.id },
      update: {
        projectName,
        projectType,
        objective,
        completed: true,
      },
      create: {
        userId: session.user.id,
        projectName,
        projectType,
        objective,
        completed: true,
      },
    })

    return NextResponse.json(onboarding)
  } catch (error) {
    console.error('Onboarding error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const onboarding = await prisma.onboardingData.findUnique({
      where: { userId: session.user.id },
    })

    return NextResponse.json(onboarding ?? { completed: false })
  } catch (error) {
    console.error('Get onboarding error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
