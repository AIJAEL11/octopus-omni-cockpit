import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPlanGate } from '@/lib/plan-gate'

export const dynamic = 'force-dynamic'

// Data Export tiers:
// Starter: blocked entirely
// Pro: basic CSV (leads only)
// Business: full JSON export (leads, projects, creative, agents, brazos, IoT, invoices)
// One-time purchase: $199 via special Stripe checkout (future)

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') || 'json' // json | csv
  const scope = searchParams.get('scope') || 'full'   // basic | full

  // Check user plan
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { planId: true, createdAt: true, dataExportPurchased: true },
  })
  const planId = user?.planId || 'starter'
  const hasPurchasedExport = user?.dataExportPurchased === true

  // One-time export purchasers get full access regardless of plan
  if (!hasPurchasedExport) {
    // Starter: blocked entirely
    if (planId === 'starter') {
      const gate = await checkPlanGate(userId, 'data_export')
      return NextResponse.json(
        { error: 'plan_limit', gate },
        { status: 403 }
      )
    }

    // Pro: basic export only (leads CSV)
    if (planId === 'pro' && scope === 'full') {
      return NextResponse.json(
        { error: 'plan_limit', gate: { allowed: false, current: 0, limit: 0, planId, upgradeRequired: 'business' } },
        { status: 403 }
      )
    }

    // Business: check minimum 1 month active
    if (planId === 'business' && scope === 'full') {
      const subscription = await prisma.subscription.findUnique({ where: { userId } })
      if (subscription) {
        const startDate = subscription.createdAt
        const oneMonthAgo = new Date()
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
        if (new Date(startDate) > oneMonthAgo) {
          return NextResponse.json(
            { error: 'export_too_early', message: 'Full export requires at least 1 month on Business plan.' },
            { status: 403 }
          )
        }
      }
    }
  }

  try {
    // === BASIC EXPORT (Pro + Business) ===
    if (scope === 'basic' || format === 'csv') {
      const leads = await prisma.growthLead.findMany({
        where: { userId },
        select: {
          id: true, businessName: true, contactName: true, email: true, phone: true,
          city: true, leadTier: true, qualificationScore: true, status: true, leadSource: true,
          createdAt: true, lastContactedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      })

      if (format === 'csv') {
        const headers = ['id','businessName','contactName','email','phone','city','leadTier','qualificationScore','status','leadSource','createdAt','lastContactedAt']
        const rows = leads.map(l => headers.map(h => {
          const val = (l as Record<string, unknown>)[h]
          if (val instanceof Date) return val.toISOString()
          if (val === null || val === undefined) return ''
          return String(val).replace(/,/g, ';').replace(/\n/g, ' ')
        }).join(','))
        const csv = [headers.join(','), ...rows].join('\n')
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="octopus-leads-${new Date().toISOString().slice(0,10)}.csv"`,
          },
        })
      }

      return NextResponse.json({ export_type: 'basic', leads, exportedAt: new Date().toISOString() })
    }

    // === FULL EXPORT (Business only) ===
    const [leads, projects, creativeAssets, armConnections, apiKeys, devices, salesAgents, invoices, calendarEvents] = await Promise.all([
      prisma.growthLead.findMany({
        where: { userId },
        select: {
          id: true, businessName: true, contactName: true, email: true, phone: true,
          city: true, state: true, country: true, leadTier: true, qualificationScore: true,
          status: true, leadSource: true, notes: true, painPoints: true,
          createdAt: true, lastContactedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.project.findMany({
        where: { userId },
        select: {
          id: true, name: true, projectType: true, description: true,
          status: true, progress: true, createdAt: true, updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.creativeAsset.findMany({
        where: { userId },
        select: {
          id: true, title: true, type: true, prompt: true, content: true,
          thumbnail: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      prisma.armConnection.findMany({
        where: { userId },
        select: {
          id: true, armType: true, name: true, status: true, createdAt: true,
        },
      }),
      prisma.apiKey.findMany({
        where: { userId },
        select: {
          id: true, name: true, serviceType: true, status: true, createdAt: true,
        },
      }),
      prisma.smartDevice.findMany({
        where: { userId },
        select: {
          id: true, name: true, type: true, room: true, platform: true,
          isOnline: true, createdAt: true,
        },
      }),
      prisma.salesAgent.findMany({
        where: { userId },
        select: {
          id: true, name: true, productName: true,
          isActive: true, conversations: true, conversions: true, createdAt: true,
        },
      }),
      prisma.invoice.findMany({
        where: { userId },
        select: {
          id: true, invoiceNumber: true, clientName: true, clientEmail: true,
          status: true, total: true, currency: true, issueDate: true, dueDate: true,
        },
        orderBy: { issueDate: 'desc' },
        take: 200,
      }),
      prisma.calendarEvent.findMany({
        where: { userId },
        select: {
          id: true, title: true, description: true, startTime: true,
          endTime: true, location: true, type: true, createdAt: true,
        },
        orderBy: { startTime: 'desc' },
        take: 500,
      }),
    ])

    const exportData = {
      export_type: 'full',
      platform: 'OCTOPUS Omni Cockpit',
      exportedAt: new Date().toISOString(),
      exportedBy: session.user.email,
      summary: {
        leads: leads.length,
        projects: projects.length,
        creativeAssets: creativeAssets.length,
        connections: armConnections.length,
        apiKeys: apiKeys.length,
        devices: devices.length,
        salesAgents: salesAgents.length,
        invoices: invoices.length,
        calendarEvents: calendarEvents.length,
      },
      data: {
        leads,
        projects,
        creativeAssets,
        armConnections,
        apiKeys,
        devices,
        salesAgents,
        invoices,
        calendarEvents,
      },
    }

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="octopus-export-${new Date().toISOString().slice(0,10)}.json"`,
      },
    })
  } catch (error) {
    console.error('Data export error:', error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
