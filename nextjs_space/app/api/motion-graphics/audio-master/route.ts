export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Merge video + voiceover + background music using FFmpeg API
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { videoUrl, voiceUrl, musicUrl } = body

    if (!videoUrl || !voiceUrl) {
      return NextResponse.json({ error: 'videoUrl and voiceUrl are required' }, { status: 400 })
    }

    console.log('[AudioFactory-Master] Starting AV merge...')
    console.log('[AudioFactory-Master] Video:', videoUrl.substring(0, 80))
    console.log('[AudioFactory-Master] Voice:', voiceUrl.substring(0, 80))
    console.log('[AudioFactory-Master] Music:', musicUrl ? musicUrl.substring(0, 80) : 'none')

    // Build FFmpeg command based on whether we have music or not
    let inputFiles: Record<string, string>
    let ffmpegCommand: string

    if (musicUrl) {
      // 3-way merge: video + voice + music (music at 20% volume with ducking)
      inputFiles = {
        in_1: videoUrl,
        in_2: voiceUrl,
        in_3: musicUrl,
      }
      // Complex filter:
      // 1. Voice audio stays at 100%
      // 2. Music reduced to 20% volume
      // 3. Apply sidechaincompress for ducking (music ducks when voice is present)
      // 4. Mix voice + ducked music together
      // 5. Map video + mixed audio to output
      // NOTE: No shell quotes around filter_complex — API handles it
      // IMPORTANT: asplit duplicates [voice] because FFmpeg consumes labels once.
      // [voicesc] goes to sidechaincompress as reference, [voicemix] goes to amix.
      ffmpegCommand = [
        '-i {{in_1}}',
        '-i {{in_2}}',
        '-i {{in_3}}',
        '-filter_complex',
        '[1:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,apad,asplit=2[voicemix][voicesc];[2:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,volume=0.20[musicvol];[musicvol][voicesc]sidechaincompress=threshold=0.02:ratio=6:attack=200:release=1000[musicduck];[voicemix][musicduck]amix=inputs=2:duration=shortest:dropout_transition=2[aout]',
        '-map 0:v',
        '-map [aout]',
        '-c:v copy',
        '-c:a aac',
        '-b:a 192k',
        '-shortest',
        '-movflags +faststart',
        '{{out_1}}',
      ].join(' ')
    } else {
      // 2-way merge: video + voice only
      inputFiles = {
        in_1: videoUrl,
        in_2: voiceUrl,
      }
      ffmpegCommand = [
        '-i {{in_1}}',
        '-i {{in_2}}',
        '-filter_complex',
        '[1:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,apad[voice]',
        '-map 0:v',
        '-map [voice]',
        '-c:v copy',
        '-c:a aac',
        '-b:a 192k',
        '-shortest',
        '-movflags +faststart',
        '{{out_1}}',
      ].join(' ')
    }

    const outputFiles = { out_1: 'master_final.mp4' }

    // Step 1: Create FFmpeg request
    console.log('[AudioFactory-Master] FFmpeg command:', ffmpegCommand)
    console.log('[AudioFactory-Master] Submitting FFmpeg command...')
    const createResponse = await fetch('https://apps.abacus.ai/api/createRunFfmpegCommandRequest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        input_files: inputFiles,
        output_files: outputFiles,
        ffmpeg_command: ffmpegCommand,
      }),
    })

    if (!createResponse.ok) {
      const error = await createResponse.json().catch(() => ({ error: 'FFmpeg request failed' }))
      console.error('[AudioFactory-Master] Create error:', error)
      return NextResponse.json({ error: error.error || 'FFmpeg request failed' }, { status: 500 })
    }

    const { request_id } = await createResponse.json()
    if (!request_id) {
      return NextResponse.json({ error: 'No request ID returned from FFmpeg API' }, { status: 500 })
    }

    console.log('[AudioFactory-Master] FFmpeg request_id:', request_id)

    // Step 2: Poll for completion — up to 5 minutes
    const maxAttempts = 150 // 150 * 2s = 5 minutes
    let attempts = 0

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000))

      const statusResponse = await fetch('https://apps.abacus.ai/api/getRunFfmpegCommandStatus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id,
          deployment_token: process.env.ABACUSAI_API_KEY,
        }),
      })

      const statusResult = await statusResponse.json()
      const status = statusResult?.status || 'FAILED'
      const result = statusResult?.result || null

      if (attempts % 15 === 0) {
        console.log(`[AudioFactory-Master] Poll #${attempts} — status: ${status}`)
      }

      if (status === 'SUCCESS') {
        // result.result contains the output files dict
        const outputUrl = result?.result?.out_1
        if (outputUrl) {
          console.log('[AudioFactory-Master] ✅ Master video ready:', outputUrl)
          return NextResponse.json({ success: true, masterUrl: outputUrl })
        } else {
          console.error('[AudioFactory-Master] Success but no output:', JSON.stringify(result))
          return NextResponse.json({ error: 'FFmpeg completed but no output file' }, { status: 500 })
        }
      } else if (status === 'FAILED') {
        const errorMsg = result?.error || 'FFmpeg processing failed'
        console.error('[AudioFactory-Master] FAILED:', errorMsg, JSON.stringify(result))
        return NextResponse.json({ error: errorMsg }, { status: 500 })
      }

      attempts++
    }

    return NextResponse.json({ error: 'FFmpeg processing timed out (5 min)' }, { status: 500 })
  } catch (error) {
    console.error('[AudioFactory-Master] Error:', error)
    return NextResponse.json({ error: 'Master generation failed' }, { status: 500 })
  }
}
