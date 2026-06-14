export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/voice-agent — list all voice agents for current user
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const agents = await prisma.voiceAgent.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(agents)
  } catch (err) {
    console.error('Error fetching voice agents:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// POST /api/voice-agent — create a new voice agent
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { agentName, systemPrompt, model, temperature, ttsTier, ttsVoice, accentColor, greeting, language, openRouterKey, elevenLabsKey, elevenLabsVoiceId, isActive } = body

    if (!agentName?.trim()) return NextResponse.json({ error: 'agentName is required' }, { status: 400 })

    const agent = await prisma.voiceAgent.create({
      data: {
        userId: session.user.id,
        agentName: agentName.trim(),
        systemPrompt: systemPrompt?.trim() || 'Eres un asistente virtual útil y amigable.',
        model: model || 'gpt-4.1',
        temperature: typeof temperature === 'number' ? temperature : 0.7,
        ttsTier: ttsTier || 'free',
        ttsVoice: ttsVoice || 'es-ES',
        accentColor: accentColor || '#C4622D',
        greeting: greeting?.trim() || '¡Hola! ¿En qué puedo ayudarte hoy?',
        language: language || 'es',
        openRouterKey: openRouterKey || null,
        elevenLabsKey: elevenLabsKey || null,
        elevenLabsVoiceId: elevenLabsVoiceId || null,
        isActive: isActive !== false,
      },
    })
    return NextResponse.json(agent, { status: 201 })
  } catch (err) {
    console.error('Error creating voice agent:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
