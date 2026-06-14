export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET — list user's custom MCP servers
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const servers = await prisma.customMcp.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ servers })
  } catch (error) {
    console.error('[MCP API] GET error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// POST — create a new MCP server
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { name, description, category, icon, color, endpoint, apiKey, isConnected, capabilities, version } = body

    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const server = await prisma.customMcp.create({
      data: {
        userId: session.user.id,
        name,
        description: description || '',
        category: category || 'custom',
        icon: icon || 'Plug',
        color: color || '#6366F1',
        endpoint: endpoint || '',
        apiKey: apiKey || null,
        isConnected: isConnected !== false,
        capabilities: capabilities || [],
        version: version || '1.0.0',
        lastSync: new Date(),
      },
    })

    return NextResponse.json({ server })
  } catch (error) {
    console.error('[MCP API] POST error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// PATCH — update an MCP server
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { id, ...updates } = body

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const existing = await prisma.customMcp.findFirst({ where: { id, userId: session.user.id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const server = await prisma.customMcp.update({
      where: { id },
      data: {
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.category !== undefined && { category: updates.category }),
        ...(updates.endpoint !== undefined && { endpoint: updates.endpoint }),
        ...(updates.apiKey !== undefined && { apiKey: updates.apiKey }),
        ...(updates.isConnected !== undefined && { isConnected: updates.isConnected }),
        ...(updates.capabilities !== undefined && { capabilities: updates.capabilities }),
        ...(updates.version !== undefined && { version: updates.version }),
        ...(updates.lastSync !== undefined && { lastSync: new Date(updates.lastSync) }),
      },
    })

    return NextResponse.json({ server })
  } catch (error) {
    console.error('[MCP API] PATCH error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// DELETE — remove an MCP server
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const existing = await prisma.customMcp.findFirst({ where: { id, userId: session.user.id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.customMcp.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[MCP API] DELETE error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
