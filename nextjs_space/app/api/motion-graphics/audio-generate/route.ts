export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, withDbRetry } from '@/lib/prisma'
import { uploadBufferToS3Public } from '@/lib/s3'

// Voice profiles mapped to ElevenLabs pre-made voices
const VOICE_PROFILES: Record<string, { voiceId: string; label: string }> = {
  cinematic_male: { voiceId: 'nPczCjzI2devNBz1zQrb', label: 'Brian — Cinematic Male' },        // Brian - narration, deep
  professional_female: { voiceId: 'Xb7hH8MSUJpSbSDYk0k2', label: 'Alice — Professional Female' }, // Alice - professional
  deep_tech: { voiceId: 'bIHbv24MWmeRgasZH58o', label: 'Will — Deep Tech Narrator' },           // Will - deep voice
}

// Background music library (hosted on our S3 — guaranteed accessible by FFmpeg API)
const MUSIC_LIBRARY: Record<string, { url: string; label: string }> = {
  ambient_tech: {
    url: 'https://abacusai-apps-0dade2a1970d5eb7fa84968b-us-west-2.s3.us-west-2.amazonaws.com/30856/public/uploads/audio-factory-music-ambient-tech.mp3',
    label: 'Ambient Tech',
  },
  upbeat_marketing: {
    url: 'https://abacusai-apps-0dade2a1970d5eb7fa84968b-us-west-2.s3.us-west-2.amazonaws.com/30856/public/uploads/audio-factory-music-upbeat.mp3',
    label: 'Upbeat',
  },
  cinematic_tension: {
    url: 'https://abacusai-apps-0dade2a1970d5eb7fa84968b-us-west-2.s3.us-west-2.amazonaws.com/30856/public/uploads/audio-factory-music-cinematic.mp3',
    label: 'Cinematic',
  },
  none: { url: '', label: 'None' },
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      script,           // optional — user-provided or will be auto-generated
      voiceProfile,     // cinematic_male | professional_female | deep_tech
      musicStyle,       // ambient_tech | upbeat_marketing | cinematic_tension | none
      videoPrompt,      // the motion graphics prompt for context-aware script gen
      campaignHook,     // AIDA headline or curiosity hook from campaign
      generateScript,   // boolean — if true, generate script via LLM
    } = body

    // --- Step 1: Generate context-aware voiceover script if needed ---
    let finalScript = script || ''
    if (generateScript || !finalScript) {
      console.log('[AudioFactory] Generating context-aware voiceover script...')
      const llmResponse = await fetch('https://apps.abacus.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4.1',
          max_tokens: 200,
          temperature: 0.7,
          messages: [
            {
              role: 'system',
              content: `You are a world-class advertising voice-over scriptwriter. Write a short, punchy voice-over script (maximum 15 words, under 5 seconds when spoken) for a cinematic product showcase video. The script must be dramatic, memorable, and sound like an Apple keynote or Tesla reveal. Output ONLY the script text, nothing else. No quotes, no labels.`
            },
            {
              role: 'user',
              content: `Video concept: ${videoPrompt || 'Product showcase'}\n${campaignHook ? `Campaign hook: ${campaignHook}` : ''}\n\nWrite the voice-over script (max 15 words, 5 seconds):`
            }
          ]
        }),
      })

      if (llmResponse.ok) {
        const llmData = await llmResponse.json()
        finalScript = llmData.choices?.[0]?.message?.content?.trim() || ''
        // Clean up any quotes the LLM might add
        finalScript = finalScript.replace(/^["']+|["']+$/g, '')
        console.log('[AudioFactory] Generated script:', finalScript)
      }

      if (!finalScript) {
        finalScript = campaignHook || 'Innovation meets elegance. This is the future.'
      }
    }

    // --- Step 2: Generate voice-over via ElevenLabs ---
    // Check for ElevenLabs key in ApiKey table (UGC pattern) or User model
    let elevenLabsApiKey = ''
    
    const apiKeyRecord: any = await withDbRetry(
      () => prisma.apiKey.findFirst({
        where: { userId: session.user.id, serviceType: 'ugc_elevenlabs', status: 'active' },
      }),
      { label: 'Audio-ElevenLabsKey' }
    )
    if (apiKeyRecord) {
      elevenLabsApiKey = apiKeyRecord.apiKey
    } else {
      const user: any = await withDbRetry(
        () => prisma.user.findUnique({
          where: { id: session.user.id },
          select: { elevenLabsKey: true },
        }),
        { label: 'Audio-UserKey' }
      )
      if (user?.elevenLabsKey) {
        elevenLabsApiKey = user.elevenLabsKey
      }
    }

    if (!elevenLabsApiKey) {
      return NextResponse.json({
        error: 'ElevenLabs API key not configured. Go to Settings → Voice to add your key.',
        script: finalScript,
        musicStyle: musicStyle || 'none',
        musicUrl: MUSIC_LIBRARY[musicStyle || 'none']?.url || '',
      }, { status: 400 })
    }

    const profile = VOICE_PROFILES[voiceProfile || 'cinematic_male'] || VOICE_PROFILES.cinematic_male
    console.log(`[AudioFactory] Generating voice-over with ${profile.label}...`)

    const elevenResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${profile.voiceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': elevenLabsApiKey,
      },
      body: JSON.stringify({
        text: finalScript,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.6,
          similarity_boost: 0.8,
          style: 0.4,
          use_speaker_boost: true,
        },
      }),
    })

    if (!elevenResponse.ok) {
      const errBody = await elevenResponse.text().catch(() => 'unknown')
      console.error('[AudioFactory] ElevenLabs error:', elevenResponse.status, errBody)
      return NextResponse.json({
        error: `ElevenLabs error (${elevenResponse.status}): ${errBody}`,
        script: finalScript,
      }, { status: 500 })
    }

    // Upload voice audio to S3
    const audioBuffer = await elevenResponse.arrayBuffer()
    const nodeBuffer = Buffer.from(audioBuffer)
    const fileName = `audio-factory-voice-${Date.now()}.mp3`
    const { publicUrl: voiceUrl } = await uploadBufferToS3Public(nodeBuffer, fileName, 'audio/mpeg')
    console.log('[AudioFactory] Voice uploaded:', voiceUrl)

    // Get music URL
    const musicUrl = MUSIC_LIBRARY[musicStyle || 'none']?.url || ''

    return NextResponse.json({
      success: true,
      script: finalScript,
      voiceUrl,
      voiceProfile: profile.label,
      musicStyle: musicStyle || 'none',
      musicUrl,
    })
  } catch (error) {
    console.error('[AudioFactory] Error:', error)
    return NextResponse.json({ error: 'Audio generation failed' }, { status: 500 })
  }
}
