import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// POST — Capture a lead from Sales Agent chat (public endpoint - called from widget)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { agentId, visitorId, visitorName, visitorEmail, visitorPhone, source, medium, campaign, adPlatform, adId, adSetId, landingPage, messageCount, buyingSignal } = body

    if (!agentId || !visitorId) {
      return NextResponse.json({ error: 'agentId y visitorId son requeridos' }, { status: 400 })
    }

    // Get agent + owner
    const agent = await prisma.salesAgent.findUnique({ where: { id: agentId } })
    if (!agent) return NextResponse.json({ error: 'Agente no encontrado' }, { status: 404 })

    // Check if lead already exists for this visitor+agent
    const existing = await prisma.salesAgentLead.findFirst({
      where: { agentId, visitorId }
    })

    if (existing) {
      // Update existing lead with new info
      const updated = await prisma.salesAgentLead.update({
        where: { id: existing.id },
        data: {
          visitorName: visitorName || existing.visitorName,
          visitorEmail: visitorEmail || existing.visitorEmail,
          visitorPhone: visitorPhone || existing.visitorPhone,
          buyingSignal: buyingSignal || existing.buyingSignal,
          messageCount: messageCount || existing.messageCount,
          ...(visitorEmail && !existing.visitorEmail ? { status: 'new' } : {}),
        }
      })
      return NextResponse.json(updated)
    }

    // Detect source from UTM params
    let detectedSource = source || 'direct'
    if (!source && medium === 'cpc') {
      if (adPlatform?.includes('facebook') || campaign?.toLowerCase().includes('fb')) detectedSource = 'facebook'
      else if (adPlatform?.includes('google') || campaign?.toLowerCase().includes('gads')) detectedSource = 'google'
      else if (adPlatform?.includes('linkedin')) detectedSource = 'linkedin'
      else if (adPlatform?.includes('tiktok')) detectedSource = 'tiktok'
    } else if (!source && medium === 'social') {
      detectedSource = 'social'
    }

    const lead = await prisma.salesAgentLead.create({
      data: {
        userId: agent.userId,
        agentId,
        visitorId,
        visitorName: visitorName || null,
        visitorEmail: visitorEmail || null,
        visitorPhone: visitorPhone || null,
        source: detectedSource,
        medium: medium || null,
        campaign: campaign || null,
        adPlatform: adPlatform || null,
        adId: adId || null,
        adSetId: adSetId || null,
        landingPage: landingPage || null,
        productName: agent.productName,
        productPrice: agent.productPrice,
        buyingSignal: buyingSignal || 'warm',
        messageCount: messageCount || 0,
        status: 'new',
      }
    })

    return NextResponse.json(lead, { status: 201 })
  } catch (error) {
    console.error('Error capturing lead:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// GET — List leads for a specific agent or all agents (auth required)
export async function GET(req: NextRequest) {
  try {
    const { getServerSession } = await import('next-auth')
    const { authOptions } = await import('@/lib/auth')
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const url = new URL(req.url)
    const agentId = url.searchParams.get('agentId')
    const source = url.searchParams.get('source')
    const status = url.searchParams.get('status')
    const signal = url.searchParams.get('signal')

    const where: any = { userId: user.id }
    if (agentId) where.agentId = agentId
    if (source) where.source = source
    if (status) where.status = status
    if (signal) where.buyingSignal = signal

    const leads = await prisma.salesAgentLead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: {
        agent: { select: { name: true, productName: true, accentColor: true } }
      }
    })

    // Stats by source
    const sourceStats = leads.reduce((acc: Record<string, number>, l) => {
      acc[l.source] = (acc[l.source] || 0) + 1
      return acc
    }, {})

    // Stats by agent
    const agentStats = leads.reduce((acc: Record<string, { name: string, count: number }>, l) => {
      if (!acc[l.agentId]) acc[l.agentId] = { name: l.agent.name, count: 0 }
      acc[l.agentId].count++
      return acc
    }, {})

    return NextResponse.json({
      leads,
      total: leads.length,
      sourceStats,
      agentStats,
      signalStats: {
        hot: leads.filter(l => l.buyingSignal === 'hot').length,
        warm: leads.filter(l => l.buyingSignal === 'warm').length,
        cold: leads.filter(l => l.buyingSignal === 'cold').length,
      }
    })
  } catch (error) {
    console.error('Error fetching agent leads:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// PATCH — Update lead status (auth required)
export async function PATCH(req: NextRequest) {
  try {
    const { getServerSession } = await import('next-auth')
    const { authOptions } = await import('@/lib/auth')
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const body = await req.json()
    const { id, status, notes } = body
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    const lead = await prisma.salesAgentLead.findFirst({ where: { id, userId: user.id } })
    if (!lead) return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })

    const updated = await prisma.salesAgentLead.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(status === 'converted' && lead.status !== 'converted' ? { convertedAt: new Date() } : {}),
      }
    })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating agent lead:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}