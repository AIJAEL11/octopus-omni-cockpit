import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { classifyEmail, autoScoreLead, getPriority } from '@/lib/growth-engine'

export const dynamic = 'force-dynamic'

// GET — Obtener un lead con historial
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const lead = await prisma.growthLead.findFirst({
      where: { id: params.id, userId: session.user.id },
      include: {
        actions: { orderBy: { createdAt: 'desc' }, take: 20 },
        messages: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    })
    if (!lead) return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })
    return NextResponse.json(lead)
  } catch (error) {
    console.error('Error fetching lead:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

// PATCH — Actualizar un lead
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json()
    const { businessName, businessType, contactName, email, phone, website, city, state, country, googleRating, status, leadTier, notes, painPoints } = body

    const existing = await prisma.growthLead.findFirst({ where: { id: params.id, userId: session.user.id } })
    if (!existing) return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })

    const emailToUse = email !== undefined ? email : existing.email
    const emailClass = emailToUse ? classifyEmail(emailToUse) : { category: existing.emailCategory || 'B' }
    const scoreData = {
      email: emailToUse,
      phone: phone !== undefined ? phone : existing.phone,
      website: website !== undefined ? website : existing.website,
      city: city !== undefined ? city : existing.city,
      googleRating: googleRating !== undefined ? parseFloat(googleRating) : existing.googleRating,
      businessType: businessType !== undefined ? businessType : existing.businessType,
      emailCategory: typeof emailClass === 'object' ? emailClass.category : emailClass,
    }
    const score = autoScoreLead(scoreData)

    const lead = await prisma.growthLead.update({
      where: { id: params.id },
      data: {
        ...(businessName !== undefined && { businessName }),
        ...(businessType !== undefined && { businessType }),
        ...(contactName !== undefined && { contactName }),
        ...(email !== undefined && { email, emailCategory: typeof emailClass === 'object' ? emailClass.category : emailClass }),
        ...(phone !== undefined && { phone }),
        ...(website !== undefined && { website }),
        ...(city !== undefined && { city }),
        ...(state !== undefined && { state }),
        ...(country !== undefined && { country }),
        ...(googleRating !== undefined && { googleRating: parseFloat(googleRating) }),
        ...(status !== undefined && { status }),
        ...(leadTier !== undefined && { leadTier }),
        ...(notes !== undefined && { notes }),
        ...(painPoints !== undefined && { painPoints: typeof painPoints === 'string' ? painPoints : JSON.stringify(painPoints) }),
        qualificationScore: score,
        priority: getPriority(score),
      },
    })
    return NextResponse.json(lead)
  } catch (error) {
    console.error('Error updating lead:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

// DELETE — Eliminar un lead
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const existing = await prisma.growthLead.findFirst({ where: { id: params.id, userId: session.user.id } })
    if (!existing) return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })

    await prisma.growthLead.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting lead:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
