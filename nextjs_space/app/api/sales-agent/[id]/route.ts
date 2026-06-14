import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET: Get agent by ID (public - for widget)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const agent = await prisma.salesAgent.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        productName: true,
        productDesc: true,
        productPrice: true,
        purchaseLink: true,
        greeting: true,
        accentColor: true,
        logoUrl: true,
        isActive: true,
      }
    })

    if (!agent) return NextResponse.json({ error: 'Agente no encontrado' }, { status: 404 })
    if (!agent.isActive) return NextResponse.json({ error: 'Agente inactivo' }, { status: 403 })

    return NextResponse.json(agent)
  } catch (error) {
    console.error('Error fetching agent:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// PATCH: Update agent (auth required)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const { id } = params
    const existing = await prisma.salesAgent.findFirst({ where: { id, userId: user.id } })
    if (!existing) return NextResponse.json({ error: 'Agente no encontrado' }, { status: 404 })

    const body = await req.json()
    const allowedFields = ['name', 'productName', 'productDesc', 'productPrice', 'purchaseLink', 'brandVoice', 'greeting', 'objections', 'accentColor', 'logoUrl', 'isActive', 'targetAudience', 'keyBenefits', 'faq', 'socialProof', 'guarantee', 'urgencyTriggers', 'closingStyle', 'agentLanguage', 'maxDiscount', 'competitorInfo']
    const data: any = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) data[field] = body[field]
    }

    const updated = await prisma.salesAgent.update({ where: { id }, data })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating agent:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE: Delete agent (auth required)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const { id } = params
    const existing = await prisma.salesAgent.findFirst({ where: { id, userId: user.id } })
    if (!existing) return NextResponse.json({ error: 'Agente no encontrado' }, { status: 404 })

    await prisma.salesAgent.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting agent:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
