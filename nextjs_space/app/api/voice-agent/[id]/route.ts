export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/voice-agent/[id] — get a single voice agent
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const agent = await prisma.voiceAgent.findFirst({
      where: { id: params.id, userId: session.user.id },
    })
    if (!agent) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(agent)
  } catch (err) {
    console.error('Error fetching voice agent:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// PATCH /api/voice-agent/[id] — update a voice agent
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Verify ownership
    const existing = await prisma.voiceAgent.findFirst({
      where: { id: params.id, userId: session.user.id },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json()
    const allowedFields = ['agentName', 'systemPrompt', 'model', 'temperature', 'ttsTier', 'ttsVoice', 'accentColor', 'greeting', 'language', 'openRouterKey', 'elevenLabsKey', 'elevenLabsVoiceId', 'isActive']
    const data: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) data[field] = body[field]
    }

    const updated = await prisma.voiceAgent.update({
      where: { id: params.id },
      data,
    })
    return NextResponse.json(updated)
  } catch (err) {
    console.error('Error updating voice agent:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// DELETE /api/voice-agent/[id] — delete a voice agent
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const existing = await prisma.voiceAgent.findFirst({
      where: { id: params.id, userId: session.user.id },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.voiceAgent.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error deleting voice agent:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
