import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hubspaceLogin, hubspaceListDevices, hubspaceInvalidateToken } from '@/lib/hubspace'

export const dynamic = 'force-dynamic'

// GET — Check if HubSpace is configured + connection status
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const creds = await prisma.apiKey.findFirst({
      where: { userId: session.user.id, serviceType: 'hubspace' },
    })

    if (!creds) {
      return NextResponse.json({ configured: false, connected: false })
    }

    // Try to login to verify credentials
    try {
      await hubspaceLogin(creds.name, creds.apiKey) // name=email, apiKey=password
      return NextResponse.json({ configured: true, connected: true, email: creds.name })
    } catch {
      return NextResponse.json({ configured: true, connected: false, email: creds.name, error: 'Credenciales inválidas' })
    }
  } catch (error: unknown) {
    console.error('[HubSpace] Config check error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST — Save HubSpace credentials
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email y password requeridos' }, { status: 400 })
    }

    // Validate credentials by trying to login
    try {
      await hubspaceLogin(email, password)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed'
      return NextResponse.json({ error: `Credenciales inválidas: ${msg}` }, { status: 400 })
    }

    // Upsert credentials in ApiKey table
    const existing = await prisma.apiKey.findFirst({
      where: { userId: session.user.id, serviceType: 'hubspace' },
    })

    if (existing) {
      await prisma.apiKey.update({
        where: { id: existing.id },
        data: { name: email, apiKey: password, status: 'active', lastTested: new Date() },
      })
    } else {
      await prisma.apiKey.create({
        data: {
          userId: session.user.id,
          serviceType: 'hubspace',
          name: email,
          apiKey: password,
          status: 'active',
          lastTested: new Date(),
        },
      })
    }

    return NextResponse.json({ success: true, message: 'Credenciales HubSpace guardadas' })
  } catch (error: unknown) {
    console.error('[HubSpace] Save creds error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE — Remove HubSpace credentials
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const creds = await prisma.apiKey.findFirst({
      where: { userId: session.user.id, serviceType: 'hubspace' },
    })

    if (creds) {
      hubspaceInvalidateToken(creds.name)
      await prisma.apiKey.delete({ where: { id: creds.id } })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('[HubSpace] Delete creds error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
