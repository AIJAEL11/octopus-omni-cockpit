import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { classifyEmail, autoScoreLead, getPriority } from '@/lib/growth-engine'

export const dynamic = 'force-dynamic'

// POST — Importar leads en bulk (JSON array)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json()
    const { leads: rawLeads } = body

    if (!Array.isArray(rawLeads) || rawLeads.length === 0) {
      return NextResponse.json({ error: 'Se requiere un array de leads' }, { status: 400 })
    }

    // Get existing emails for dedup
    const existingLeads = await prisma.growthLead.findMany({
      where: { userId: session.user.id, email: { not: null } },
      select: { email: true },
    })
    const existingEmails = new Set(existingLeads.map(l => l.email?.toLowerCase()))

    let imported = 0
    let skipped = 0
    const errors: string[] = []

    for (const raw of rawLeads) {
      try {
        const bName = raw.businessName || raw.business_name || raw.nombre || raw.name
        if (!bName) { skipped++; continue }

        const email = (raw.email || raw.correo || '').trim().toLowerCase() || null
        if (email && existingEmails.has(email)) { skipped++; continue }

        const emailClass = email ? classifyEmail(email) : { category: 'B', boost: 0 }
        const leadData = {
          userId: session.user.id,
          businessName: bName,
          businessType: raw.businessType || raw.business_type || raw.tipo || null,
          contactName: raw.contactName || raw.contact_name || raw.contacto || null,
          email,
          emailCategory: emailClass.category,
          phone: raw.phone || raw.telefono || raw.tel || null,
          website: raw.website || raw.web || raw.url || null,
          city: raw.city || raw.ciudad || null,
          state: raw.state || raw.estado || null,
          country: raw.country || raw.pais || 'US',
          googleRating: raw.googleRating || raw.google_rating || raw.rating ? parseFloat(raw.googleRating || raw.google_rating || raw.rating) : null,
          leadTier: raw.leadTier || raw.lead_tier || raw.tier || 'diamond',
          leadSource: raw.leadSource || raw.lead_source || raw.source || 'csv-import',
          sourceUrl: raw.sourceUrl || raw.source_url || null,
          tags: raw.tags ? (typeof raw.tags === 'string' ? raw.tags : JSON.stringify(raw.tags)) : null,
          notes: raw.notes || raw.notas || null,
          painPoints: raw.painPoints || raw.pain_points ? JSON.stringify(raw.painPoints || raw.pain_points) : null,
          qualificationScore: 0,
          priority: 'medium' as string,
        }
        leadData.qualificationScore = autoScoreLead(leadData)
        leadData.priority = getPriority(leadData.qualificationScore)

        await prisma.growthLead.create({ data: leadData })
        if (email) existingEmails.add(email)
        imported++
      } catch (e: any) {
        errors.push(`Error con ${raw.businessName || 'lead'}: ${e.message}`)
        skipped++
      }
    }

    return NextResponse.json({ imported, skipped, errors: errors.slice(0, 10), total: rawLeads.length })
  } catch (error) {
    console.error('Error importing leads:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
