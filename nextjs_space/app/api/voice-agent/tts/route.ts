import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Server-side TTS proxy — uses admin's ElevenLabs key
// so we never expose API keys in client-side widget code
const ADMIN_EMAIL = '1billontopview@gmail.com'

export async function POST(request: NextRequest) {
  try {
    const { text, voiceId } = await request.json()

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 })
    }

    // Get admin user's ElevenLabs key from DB
    const admin = await prisma.user.findFirst({
      where: { email: ADMIN_EMAIL },
      select: { elevenLabsKey: true, elevenLabsVoiceId: true },
    })

    if (!admin?.elevenLabsKey) {
      console.error('[TTS Proxy] No ElevenLabs key found for admin')
      return NextResponse.json({ error: 'TTS not configured' }, { status: 503 })
    }

    // Use provided voiceId or admin's default
    const finalVoiceId = voiceId || admin.elevenLabsVoiceId || 'hA4zGnmTwX2NQiTRMt7o'

    // Clean voice ID (in case it's a URL)
    const cleanVoiceId = extractVoiceId(finalVoiceId)

    console.log('[TTS Proxy] Generating speech for', text.substring(0, 50), '... voiceId:', cleanVoiceId)

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${cleanVoiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': admin.elevenLabsKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text.substring(0, 2000), // Limit to prevent abuse
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.8 },
      }),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      console.error('[TTS Proxy] ElevenLabs error:', response.status, errText)
      return NextResponse.json({ error: `ElevenLabs error: ${response.status}` }, { status: response.status })
    }

    const audioBuffer = await response.arrayBuffer()

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[TTS Proxy] Error:', error)
    return NextResponse.json({ error: 'TTS proxy error' }, { status: 500 })
  }
}

function extractVoiceId(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return 'hA4zGnmTwX2NQiTRMt7o'
  const match = trimmed.match(/voiceId=([a-zA-Z0-9]+)/)
  if (match) return match[1]
  try {
    const url = new URL(trimmed)
    const fromParam = url.searchParams.get('voiceId')
    if (fromParam) return fromParam
  } catch { /* not a URL */ }
  if (trimmed.includes('/')) {
    const segments = trimmed.split('/').filter(Boolean)
    const last = segments[segments.length - 1]
    if (last && !last.includes('.') && !last.includes('?') && last.length > 10) return last
  }
  return trimmed
}
