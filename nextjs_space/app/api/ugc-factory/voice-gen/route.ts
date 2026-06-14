export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { uploadBufferToS3Public } from '@/lib/s3'

// Generate AI voice with ElevenLabs
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { script, voiceStyle } = await request.json()
    if (!script) {
      return NextResponse.json({ error: 'script is required' }, { status: 400 })
    }

    const elevenLabsKey = await prisma.apiKey.findFirst({
      where: { userId: session.user.id, serviceType: 'ugc_elevenlabs', status: 'active' },
    })

    if (!elevenLabsKey) {
      return NextResponse.json({ error: 'ElevenLabs API key not configured. Go to UGC Factory settings to add your key.' }, { status: 400 })
    }

    // ElevenLabs pre-made voices — VERIFIED active as of March 2026
    // (Bella, Rachel, Domi, Nicole, Josh were removed by ElevenLabs Feb 28 2026)
    const voiceMap: Record<string, string> = {
      // -- Mujeres --
      female: 'EXAVITQu4vr4xnSDxMaL',           // Sarah - suave, cálida
      female_energetic: 'pFZP5JQG7iQjIQuC4Bku',   // Lily - energética, británica
      female_warm: 'XrExE9yKIg1WjnnlVkGX',        // Matilda - cálida, storytelling
      female_pro: 'Xb7hH8MSUJpSbSDYk0k2',         // Alice - profesional, confiada
      // -- Hombres --
      male: 'TX3LPaxmHKxFdv7VOQHJ',              // Liam - natural, joven
      male_deep: 'bIHbv24MWmeRgasZH58o',          // Will - voz profunda, social media
      male_casual: 'iP95p4xoKVk53GoZ742B',        // Chris - casual, conversacional
      male_aussie: 'IKne3meq5aSn9XLyUdCD',        // Charlie - australiano, relajado
      male_narration: 'nPczCjzI2devNBz1zQrb',     // Brian - narración, profundo
    }

    const voiceId = voiceMap[voiceStyle || 'female'] || voiceMap.female

    const elevenResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': elevenLabsKey.apiKey,
      },
      body: JSON.stringify({
        text: script,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.5,
          use_speaker_boost: true,
        },
      }),
    })

    if (!elevenResponse.ok) {
      const errBody = await elevenResponse.text().catch(() => 'unknown')
      console.error('ElevenLabs error:', elevenResponse.status, errBody)
      return NextResponse.json({ error: `ElevenLabs error (${elevenResponse.status}): ${errBody}` }, { status: 500 })
    }

    // ElevenLabs returns audio as binary
    const audioBuffer = await elevenResponse.arrayBuffer()
    const nodeBuffer = Buffer.from(audioBuffer)

    // Upload audio to S3 so Sync Labs can fetch it via URL (avoids 413 on base64)
    const fileName = `ugc-voice-${Date.now()}.mp3`
    const { publicUrl: audioPublicUrl } = await uploadBufferToS3Public(nodeBuffer, fileName, 'audio/mpeg')
    console.log('Audio uploaded to S3:', audioPublicUrl)

    // Also create base64 data URL for in-browser preview
    const base64Audio = nodeBuffer.toString('base64')
    const audioDataUrl = `data:audio/mpeg;base64,${base64Audio}`

    // Update usage
    prisma.apiKey.update({
      where: { id: elevenLabsKey.id },
      data: { lastUsed: new Date(), usageCount: { increment: 1 } },
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      audioUrl: audioDataUrl,          // base64 for in-browser <audio> preview
      audioPublicUrl: audioPublicUrl,   // S3 URL for Sync Labs lip sync
      duration: Math.ceil(script.length / 15),
    })
  } catch (error) {
    console.error('Voice generation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
