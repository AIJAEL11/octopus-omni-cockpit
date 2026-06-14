export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET — single invoice (public for viewing by client)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: { items: { orderBy: { sortOrder: 'asc' } }, user: { select: { name: true, email: true } } }
    })
    if (!invoice) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

    // Mark as viewed if first time
    if (!invoice.viewedAt && invoice.status === 'sent') {
      await prisma.invoice.update({ where: { id: params.id }, data: { viewedAt: new Date(), status: 'viewed' } })
    }

    return NextResponse.json({ invoice })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PATCH — update invoice
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const existing = await prisma.invoice.findFirst({ where: { id: params.id, userId: user.id } })
    if (!existing) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

    const body = await req.json()

    // If items provided, recalculate
    const data: any = {}
    if (body.clientName !== undefined) data.clientName = body.clientName
    if (body.clientEmail !== undefined) data.clientEmail = body.clientEmail
    if (body.clientPhone !== undefined) data.clientPhone = body.clientPhone
    if (body.clientCompany !== undefined) data.clientCompany = body.clientCompany
    if (body.clientAddress !== undefined) data.clientAddress = body.clientAddress
    if (body.notes !== undefined) data.notes = body.notes
    if (body.terms !== undefined) data.terms = body.terms
    if (body.currency !== undefined) data.currency = body.currency
    if (body.taxRate !== undefined) data.taxRate = body.taxRate
    if (body.discount !== undefined) data.discount = body.discount
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null
    if (body.status !== undefined) {
      data.status = body.status
      if (body.status === 'paid') data.paidAt = new Date()
    }

    if (body.items) {
      // Delete old items and recreate
      await prisma.invoiceItem.deleteMany({ where: { invoiceId: params.id } })
      const items = body.items
      const subtotal = items.reduce((s: number, i: any) => s + (i.quantity || 1) * (i.unitPrice || 0), 0)
      const discount = body.discount ?? existing.discount
      const taxRate = body.taxRate ?? existing.taxRate
      const taxAmount = (subtotal - discount) * (taxRate / 100)
      const total = subtotal - discount + taxAmount
      data.subtotal = subtotal
      data.taxAmount = taxAmount
      data.total = total

      await prisma.invoiceItem.createMany({
        data: items.map((item: any, idx: number) => ({
          invoiceId: params.id,
          description: item.description || '',
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || 0,
          total: (item.quantity || 1) * (item.unitPrice || 0),
          sortOrder: idx
        }))
      })
    }

    const invoice = await prisma.invoice.update({
      where: { id: params.id },
      data,
      include: { items: { orderBy: { sortOrder: 'asc' } } }
    })

    return NextResponse.json({ invoice })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const existing = await prisma.invoice.findFirst({ where: { id: params.id, userId: user.id } })
    if (!existing) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

    await prisma.invoice.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
