export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET — list invoices
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const type = url.searchParams.get('type')

    const where: any = { userId: user.id }
    if (status) where.status = status
    if (type) where.type = type

    const invoices = await prisma.invoice.findMany({
      where,
      include: { items: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      take: 100
    })

    return NextResponse.json({ invoices })
  } catch (err: any) {
    console.error('GET /api/invoices error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST — create invoice
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const body = await req.json()

    // Auto-generate invoice number
    const count = await prisma.invoice.count({ where: { userId: user.id } })
    const prefix = body.type === 'quote' ? 'COT' : 'FAC'
    const invoiceNumber = `${prefix}-${String(count + 1).padStart(4, '0')}`

    // Calculate totals
    const items = body.items || []
    const subtotal = items.reduce((s: number, i: any) => s + (i.quantity || 1) * (i.unitPrice || 0), 0)
    const discount = body.discount || 0
    const taxRate = body.taxRate || 0
    const taxAmount = (subtotal - discount) * (taxRate / 100)
    const total = subtotal - discount + taxAmount

    const invoice = await prisma.invoice.create({
      data: {
        userId: user.id,
        invoiceNumber,
        type: body.type || 'invoice',
        status: 'draft',
        clientName: body.clientName || '',
        clientEmail: body.clientEmail || null,
        clientPhone: body.clientPhone || null,
        clientCompany: body.clientCompany || null,
        clientAddress: body.clientAddress || null,
        leadId: body.leadId || null,
        leadSource: body.leadSource || null,
        subtotal,
        taxRate,
        taxAmount,
        discount,
        total,
        currency: body.currency || 'USD',
        issueDate: body.issueDate ? new Date(body.issueDate) : new Date(),
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        notes: body.notes || null,
        terms: body.terms || null,
        brandColor: body.brandColor || '#C4622D',
        items: {
          create: items.map((item: any, idx: number) => ({
            description: item.description || '',
            quantity: item.quantity || 1,
            unitPrice: item.unitPrice || 0,
            total: (item.quantity || 1) * (item.unitPrice || 0),
            sortOrder: idx
          }))
        }
      },
      include: { items: true }
    })

    return NextResponse.json({ invoice })
  } catch (err: any) {
    console.error('POST /api/invoices error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
