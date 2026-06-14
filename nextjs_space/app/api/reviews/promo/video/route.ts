export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { uploadBufferToS3Public } from '@/lib/s3'

const ADMIN_EMAILS = ['1billontopview@gmail.com']

// Voice profiles for promo narration
const PROMO_VOICES: Record<string, { voiceId: string; label: string }> = {
  cinematic_male: { voiceId: 'nPczCjzI2devNBz1zQrb', label: 'Brian — Cinematic' },
  professional_female: { voiceId: 'Xb7hH8MSUJpSbSDYk0k2', label: 'Alice — Professional' },
}

// POST /api/reviews/promo/video — Generate promo video for a review
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Admin check
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { email: true } })
    if (!ADMIN_EMAILS.includes(user?.email || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { reviewId, voiceProfile } = body
    if (!reviewId) return NextResponse.json({ error: 'reviewId required' }, { status: 400 })

    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: { User: { select: { name: true, email: true } } },
    })
    if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    if (review.rating < 4) return NextResponse.json({ error: 'Only positive reviews' }, { status: 400 })

    // Mark generating
    await prisma.review.update({ where: { id: reviewId }, data: { promoStatus: 'generating' } })

    const userName = review.User?.name || review.User?.email?.split('@')[0] || 'User'
    const reviewText = review.comment || `${review.rating} out of 5 stars`

    // ══ STEP 1: Generate voiceover script via LLM ══
    let voScript = ''
    try {
      const scriptRes = await fetch('https://apps.abacus.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}` },
        body: JSON.stringify({
          model: 'gpt-4.1',
          max_tokens: 100,
          temperature: 0.7,
          messages: [
            { role: 'system', content: 'You are a cinematic voice-over scriptwriter. Write a short, dramatic narration (max 20 words, ~6 seconds) for a testimonial promo video. Sound like an Apple keynote reveal. Output ONLY the script text. No quotes, no labels.' },
            { role: 'user', content: `User: ${userName}. Review: "${reviewText.slice(0, 200)}". Write the narration script:` },
          ],
        }),
      })
      if (scriptRes.ok) {
        const d = await scriptRes.json()
        voScript = d.choices?.[0]?.message?.content?.trim()?.replace(/^["']+|["']+$/g, '') || ''
      }
    } catch (e) { console.error('[PromoVideo] Script gen error:', e) }

    if (!voScript) voScript = `${userName} says: ${reviewText.slice(0, 60)}. Powered by Octopus.`
    console.log('[PromoVideo] Script:', voScript)

    // ══ STEP 2: Generate TTS via ElevenLabs ══
    let voiceUrl = ''
    const elevenLabsKey = await getElevenLabsKey(session.user.id)
    if (elevenLabsKey) {
      const profile = PROMO_VOICES[voiceProfile || 'cinematic_male'] || PROMO_VOICES.cinematic_male
      try {
        const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${profile.voiceId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'xi-api-key': elevenLabsKey },
          body: JSON.stringify({
            text: voScript,
            model_id: 'eleven_multilingual_v2',
            voice_settings: { stability: 0.6, similarity_boost: 0.8, style: 0.5, use_speaker_boost: true },
          }),
        })
        if (ttsRes.ok) {
          const buf = Buffer.from(await ttsRes.arrayBuffer())
          const { publicUrl } = await uploadBufferToS3Public(buf, `promo-voice-${reviewId}-${Date.now()}.mp3`, 'audio/mpeg')
          voiceUrl = publicUrl
          console.log('[PromoVideo] Voice uploaded:', voiceUrl)
        } else {
          console.error('[PromoVideo] ElevenLabs error:', ttsRes.status)
        }
      } catch (e) { console.error('[PromoVideo] TTS error:', e) }
    }

    // ══ STEP 3: Generate promo image frame (if not already generated) ══
    let frameImageUrl = review.promoImageUrl || ''
    if (!frameImageUrl) {
      try {
        const imgRes = await fetch('https://apps.abacus.ai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}` },
          body: JSON.stringify({
            model: 'gpt-4.1',
            max_tokens: 300,
            modalities: ['image'],
            image_config: { size: '1024x1024' },
            messages: [{
              role: 'user',
              content: `Create a cinematic testimonial frame for a promo video. Dark navy background with:
- Gold octopus icon at top
- "${reviewText.slice(0, 60)}" in elegant white text centered
- "— ${userName}" in gold below
- Gold stars rating (${review.rating}/5)
- "OCTOPUS" logo at bottom
- Cinematic gold accents and subtle particle effects
Style: Premium dark luxury, like a Tesla ad.`
            }],
          }),
        })
        if (imgRes.ok) {
          const imgData = await imgRes.json()
          frameImageUrl = extractImageUrl(imgData) || ''
          if (frameImageUrl) {
            await prisma.review.update({ where: { id: reviewId }, data: { promoImageUrl: frameImageUrl } })
          }
        }
      } catch (e) { console.error('[PromoVideo] Frame gen error:', e) }
    }

    // ══ STEP 4: Generate motion video from frame ══
    let rawVideoUrl = ''
    if (frameImageUrl) {
      try {
        const motionPrompt = `Elegant cinematic reveal: golden particles swirl and converge. Text "${reviewText.slice(0, 40)}" fades in with a smooth scale-up. Gold stars animate one by one. Subtle camera push-in. Premium testimonial showcase. Dark luxury aesthetic.`
        
        // Use fal.ai via our existing pattern
        const falRes = await fetch('https://queue.fal.run/fal-ai/kling-video/v2.5-turbo/pro/image-to-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Key ${await getFalKey(session.user.id)}` },
          body: JSON.stringify({
            image_url: frameImageUrl,
            prompt: motionPrompt,
            duration: '5',
            aspect_ratio: '1:1',
          }),
        })
        
        if (falRes.ok) {
          const falData = await falRes.json()
          // Queue model returns request_id, we need to poll
          const requestId = falData.request_id
          if (requestId) {
            rawVideoUrl = await pollFalResult(requestId, session.user.id)
          }
        } else {
          console.error('[PromoVideo] Fal.ai error:', falRes.status, await falRes.text().catch(() => ''))
        }
      } catch (e) { console.error('[PromoVideo] Motion gen error:', e) }
    }

    // ══ STEP 5: Master video + audio via FFmpeg ══
    let masterVideoUrl = ''
    if (rawVideoUrl && voiceUrl) {
      try {
        // Use ambient tech as background music
        const musicUrl = 'https://abacusai-apps-0dade2a1970d5eb7fa84968b-us-west-2.s3.us-west-2.amazonaws.com/30856/public/uploads/audio-factory-music-ambient-tech.mp3'
        
        const ffmpegRes = await fetch(`${process.env.ABACUSAI_API_KEY ? 'https://apps.abacus.ai' : ''}/api/v0/execute_ffmpeg`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}` },
          body: JSON.stringify({
            input_files: { in_1: rawVideoUrl, in_2: voiceUrl, in_3: musicUrl },
            output_files: { out_1: 'master.mp4' },
            ffmpeg_command: '-i {{in_1}} -i {{in_2}} -i {{in_3}} -filter_complex [1:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,apad,asplit=2[voicemix][voicesc];[2:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,volume=0.15[musicvol];[musicvol][voicesc]sidechaincompress=threshold=0.02:ratio=6:attack=200:release=1000[musicduck];[voicemix][musicduck]amix=inputs=2:duration=shortest:dropout_transition=2[aout] -map 0:v -map [aout] -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart {{out_1}}',
          }),
        })
        
        if (ffmpegRes.ok) {
          const ffData = await ffmpegRes.json()
          masterVideoUrl = ffData.output_files?.out_1 || ffData.result?.out_1 || ''
          console.log('[PromoVideo] Master URL:', masterVideoUrl)
        } else {
          console.error('[PromoVideo] FFmpeg error:', ffmpegRes.status)
        }
      } catch (e) { console.error('[PromoVideo] Master error:', e) }
    } else if (rawVideoUrl) {
      // No voice available, use raw video
      masterVideoUrl = rawVideoUrl
    }

    // ══ Save results ══
    const updated = await prisma.review.update({
      where: { id: reviewId },
      data: {
        promoStatus: masterVideoUrl || rawVideoUrl ? 'ready' : (frameImageUrl ? 'ready' : 'error'),
        promoVideoUrl: masterVideoUrl || rawVideoUrl || null,
        promoVoiceUrl: voiceUrl || null,
        promoImageUrl: frameImageUrl || null,
      },
    })

    return NextResponse.json({
      success: true,
      promoVideoUrl: updated.promoVideoUrl,
      promoVoiceUrl: updated.promoVoiceUrl,
      promoImageUrl: updated.promoImageUrl,
      promoStatus: updated.promoStatus,
      voScript,
    })
  } catch (error) {
    console.error('[PromoVideo] Fatal error:', error)
    return NextResponse.json({ error: 'Video generation failed' }, { status: 500 })
  }
}

// ── Helpers ──

function extractImageUrl(data: Record<string, unknown>): string | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const choices = data.choices as any[] | undefined
  if (choices?.[0]?.message) {
    const msg = choices[0].message
    if (typeof msg.image_url === 'string') return msg.image_url
    if (msg.image_url?.url) return msg.image_url.url
    if (msg.images?.[0]) {
      const img = msg.images[0]
      if (typeof img === 'string') return img
      if (img.url) return img.url
      if (img.image_url) return typeof img.image_url === 'string' ? img.image_url : img.image_url.url || null
    }
    if (typeof msg.content === 'string') {
      const m = msg.content.match(/https?:\/\/[^\s)\]"'<>]+/i)
      if (m) return m[0]
    }
  }
  const full = JSON.stringify(data)
  const m = full.match(/https?:\/\/[^\s)\]"'\\<>]+/i)
  return m ? m[0] : null
}

async function getElevenLabsKey(userId: string): Promise<string> {
  const apiKeyRecord = await prisma.apiKey.findFirst({
    where: { userId, serviceType: 'ugc_elevenlabs', status: 'active' },
  })
  if (apiKeyRecord) return apiKeyRecord.apiKey
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { elevenLabsKey: true } })
  return u?.elevenLabsKey || ''
}

async function getFalKey(userId: string): Promise<string> {
  // Try user's API Hub key (serviceType: 'falai')
  const falaiKey = await prisma.apiKey.findFirst({
    where: { userId, serviceType: 'falai', status: 'active' },
  })
  if (falaiKey) {
    try {
      const { decryptApiKey } = await import('@/lib/crypto')
      return decryptApiKey(falaiKey.apiKey)
    } catch { return falaiKey.apiKey }
  }
  // Try UGC fal key
  const ugcKey = await prisma.apiKey.findFirst({
    where: { userId, serviceType: 'ugc_fal', status: 'active' },
  })
  if (ugcKey) return ugcKey.apiKey.trim()
  // Fallback to env
  return process.env.FAL_KEY || ''
}

async function pollFalResult(requestId: string, userId: string): Promise<string> {
  const falKey = await getFalKey(userId)
  const maxAttempts = 60 // 5 minutes max
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 5000)) // Wait 5s between polls
    try {
      const statusRes = await fetch(`https://queue.fal.run/fal-ai/kling-video/v2.5-turbo/pro/image-to-video/requests/${requestId}/status`, {
        headers: { 'Authorization': `Key ${falKey}` },
      })
      if (!statusRes.ok) continue
      const statusData = await statusRes.json()
      if (statusData.status === 'COMPLETED') {
        // Fetch result
        const resultRes = await fetch(`https://queue.fal.run/fal-ai/kling-video/v2.5-turbo/pro/image-to-video/requests/${requestId}`, {
          headers: { 'Authorization': `Key ${falKey}` },
        })
        if (resultRes.ok) {
          const resultData = await resultRes.json()
          return resultData.video?.url || resultData.output?.video?.url || ''
        }
      } else if (statusData.status === 'FAILED') {
        console.error('[PromoVideo] Fal.ai generation failed')
        return ''
      }
    } catch (e) { console.error('[PromoVideo] Poll error:', e) }
  }
  console.error('[PromoVideo] Fal.ai timeout after 5 minutes')
  return ''
}
