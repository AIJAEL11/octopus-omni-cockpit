export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET — list user's custom skills
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const skills = await prisma.customSkill.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ skills })
  } catch (error) {
    console.error('[Skills API] GET error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// POST — create a new skill
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { name, description, category, code, isActive, createdBy } = body

    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const skill = await prisma.customSkill.create({
      data: {
        userId: session.user.id,
        name,
        description: description || '',
        category: category || 'custom',
        code: code || '',
        isActive: isActive !== false,
        createdBy: createdBy || 'jarvis',
      },
    })

    return NextResponse.json({ skill })
  } catch (error) {
    console.error('[Skills API] POST error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// PATCH — update a skill
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { id, ...updates } = body

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    // Verify ownership
    const existing = await prisma.customSkill.findFirst({ where: { id, userId: session.user.id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const skill = await prisma.customSkill.update({
      where: { id },
      data: {
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.category !== undefined && { category: updates.category }),
        ...(updates.code !== undefined && { code: updates.code }),
        ...(updates.isActive !== undefined && { isActive: updates.isActive }),
        ...(updates.usageCount !== undefined && { usageCount: updates.usageCount }),
      },
    })

    return NextResponse.json({ skill })
  } catch (error) {
    console.error('[Skills API] PATCH error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// DELETE — remove a skill
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    // Verify ownership
    const existing = await prisma.customSkill.findFirst({ where: { id, userId: session.user.id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.customSkill.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Skills API] DELETE error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
