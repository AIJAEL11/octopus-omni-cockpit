import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET — Get smart home config status
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // Check how many devices user has
    const deviceCount = await prisma.smartDevice.count({
      where: { userId: session.user.id },
    })

    // Check for WiZ API keys
    const wizKeys = await prisma.apiKey.findMany({
      where: {
        userId: session.user.id,
        serviceType: { startsWith: 'wiz_' },
      },
    })

    const hasWizEmail = wizKeys.some(k => k.serviceType === 'wiz_email')
    const hasWizPassword = wizKeys.some(k => k.serviceType === 'wiz_password')

    return NextResponse.json({
      configured: deviceCount > 0,
      deviceCount,
      wizConfigured: hasWizEmail && hasWizPassword,
      hasWizEmail,
      hasWizPassword,
    })
  } catch (error) {
    console.error('Error fetching config:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
