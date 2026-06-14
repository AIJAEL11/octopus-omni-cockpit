import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// GET — Get existing bridge token
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const existing = await prisma.apiKey.findFirst({
      where: { userId: session.user.id, serviceType: 'hogar_bridge' },
    })

    return NextResponse.json({
      hasToken: !!existing,
      token: existing?.apiKey || null,
      createdAt: existing?.createdAt || null,
    })
  } catch (error) {
    console.error('Error fetching bridge token:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST — Generate new bridge token
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // Verify user exists in DB (session JWT may have stale ID after DB reset)
    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user) {
      // Try to find by email as fallback
      const email = session.user.email
      if (email) {
        const userByEmail = await prisma.user.findUnique({ where: { email } })
        if (userByEmail) {
          // Use the correct DB user ID
          await prisma.apiKey.deleteMany({
            where: { userId: userByEmail.id, serviceType: 'hogar_bridge' },
          })
          const token = `oct_bridge_${crypto.randomBytes(32).toString('hex')}`
          await prisma.apiKey.create({
            data: {
              userId: userByEmail.id,
              serviceType: 'hogar_bridge',
              name: 'OCTOPUS Bridge',
              apiKey: token,
            },
          })
          return NextResponse.json({ success: true, token })
        }
      }
      return NextResponse.json({ error: 'Usuario no encontrado. Cierra sesión y vuelve a iniciar.' }, { status: 404 })
    }

    // Delete existing
    await prisma.apiKey.deleteMany({
      where: { userId: session.user.id, serviceType: 'hogar_bridge' },
    })

    // Generate secure token
    const token = `oct_bridge_${crypto.randomBytes(32).toString('hex')}`

    await prisma.apiKey.create({
      data: {
        userId: session.user.id,
        serviceType: 'hogar_bridge',
        name: 'OCTOPUS Bridge',
        apiKey: token,
      },
    })

    return NextResponse.json({ success: true, token })
  } catch (error) {
    console.error('Error generating bridge token:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
