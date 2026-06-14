import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { classifyEmail, autoScoreLead, getPriority } from '@/lib/growth-engine'
import { checkPlanGate } from '@/lib/plan-gate'

export const dynamic = 'force-dynamic'

// GET — Obtener todos los leads del usuario
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const tier = url.searchParams.get('tier')
    const city = url.searchParams.get('city')
    const search = url.searchParams.get('search')
    const source = url.searchParams.get('source')
    const hasTags = url.searchParams.get('hasTags') // filter leads that have any tags

    const where: Record<string, unknown> = { userId: session.user.id }
    if (status) where.status = status
    if (tier) where.leadTier = tier
    if (city) where.city = { contains: city, mode: 'insensitive' }
    if (source) where.leadSource = source
    if (hasTags === 'true') where.tags = { not: null }
    if (search) {
      where.OR = [
        { businessName: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Get real pipeline counts (all leads, no limit)
    const [leads, pipelineCounts] = await Promise.all([
      prisma.growthLead.findMany({
        where: where as any,
        orderBy: [{ qualificationScore: 'desc' }, { createdAt: 'desc' }],
        take: 500,
        include: { _count: { select: { actions: true, messages: true } } },
      }),
      prisma.growthLead.groupBy({
        by: ['status'],
        where: { userId: session.user.id },
        _count: true,
      }),
    ])

    // Build status counts from DB
    const statusCounts: Record<string, number> = {}
    let totalAll = 0
    for (const g of pipelineCounts) {
      statusCounts[g.status] = g._count
      totalAll += g._count
    }

    return NextResponse.json({ leads, total: leads.length, totalAll, statusCounts })
  } catch (error) {
    console.error('Error fetching leads:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

// POST — Crear un lead manualmente
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json()
    const { businessType, contactName, email, phone, website, city, state, country, googleRating, leadTier, notes, painPoints, leadSource: requestedSource, sourceUrl, tags } = body

    // Auto-derive businessName from email domain if not provided
    let businessName = body.businessName || ''
    if (!businessName && email && typeof email === 'string' && email.includes('@')) {
      const domain = email.split('@')[1]?.split('.')[0] || ''
      businessName = domain.charAt(0).toUpperCase() + domain.slice(1)
    }
    if (!businessName && contactName) {
      businessName = contactName
    }
    if (!businessName) return NextResponse.json({ error: 'El nombre del negocio o email es obligatorio' }, { status: 400 })

    // Plan gate — check lead limit
    const gate = await checkPlanGate(session.user.id, 'leads')
    if (!gate.allowed) {
      return NextResponse.json({
        error: 'plan_limit',
        message: `Límite de leads alcanzado (${gate.current}/${gate.limit})`,
        gate,
      }, { status: 403 })
    }

    // Classify email & auto-score
    const emailClass = email ? classifyEmail(email) : { category: 'B', boost: 0 }
    let score = autoScoreLead({ email, phone, website, city, googleRating, businessType, emailCategory: emailClass.category })

    // Boost score based on Gold Standard enrichment data
    let painPointsStr = painPoints || null
    if (painPoints && typeof painPoints === 'string') {
      try {
        const ppData = JSON.parse(painPoints)
        // Boost based on urgency and conversion probability
        if (ppData.urgencia && ppData.urgencia >= 8) score = Math.min(100, score + 15)
        else if (ppData.urgencia && ppData.urgencia >= 5) score = Math.min(100, score + 8)
        if (ppData.probabilidad_conversion === 'garantizada') score = Math.min(100, score + 10)
        else if (ppData.probabilidad_conversion === 'muy alta') score = Math.min(100, score + 7)
        painPointsStr = painPoints
      } catch {
        painPointsStr = painPoints // Store as-is if not valid JSON
      }
    } else if (painPoints && typeof painPoints === 'object') {
      painPointsStr = JSON.stringify(painPoints)
      // Boost based on urgency and conversion probability from object
      if (painPoints.urgencia && painPoints.urgencia >= 8) score = Math.min(100, score + 15)
      else if (painPoints.urgencia && painPoints.urgencia >= 5) score = Math.min(100, score + 8)
      if (painPoints.probabilidad_conversion === 'garantizada') score = Math.min(100, score + 10)
      else if (painPoints.probabilidad_conversion === 'muy alta') score = Math.min(100, score + 7)
    }

    const lead = await prisma.growthLead.create({
      data: {
        userId: session.user.id,
        businessName,
        businessType: businessType || null,
        contactName: contactName || null,
        email: email || null,
        emailCategory: emailClass.category,
        phone: phone || null,
        website: website || null,
        city: city || null,
        state: state || null,
        country: country || 'US',
        googleRating: googleRating ? parseFloat(googleRating) : null,
        leadTier: leadTier || 'diamond',
        leadSource: requestedSource || 'octopus-prospecting',
        sourceUrl: sourceUrl || null,
        tags: tags ? (typeof tags === 'string' ? tags : JSON.stringify(tags)) : null,
        painPoints: painPointsStr,
        notes: notes || null,
        qualificationScore: score,
        priority: getPriority(score),
      },
    })

    return NextResponse.json(lead, { status: 201 })
  } catch (error) {
    console.error('Error creating lead:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
