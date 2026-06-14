// Speech-to-Text para OCTOPUS
// Pipeline: OGG (Telegram) -> FFmpeg (MP3) -> fal.ai Whisper -> texto

// Convertir OGG a MP3 usando FFmpeg API de Abacus
async function convertOggToMp3(oggUrl: string): Promise<string | null> {
  const apiKey = process.env.ABACUSAI_API_KEY || ''
  if (!apiKey) return null

  try {
    const createRes = await fetch('https://apps.abacus.ai/api/createRunFfmpegCommandRequest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: apiKey,
        input_files: { in_1: oggUrl },
        output_files: { out_1: 'voice.mp3' },
        ffmpeg_command: '-i {{in_1}} -acodec libmp3lame -ar 16000 -ac 1 -b:a 64k {{out_1}}',
        max_command_run_seconds: 30,
      }),
    })

    if (!createRes.ok) {
      console.error('[Speech] FFmpeg create error:', createRes.status)
      return null
    }

    const { request_id } = await createRes.json()
    if (!request_id) {
      console.error('[Speech] No FFmpeg request_id')
      return null
    }

    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1000))

      const statusRes = await fetch('https://apps.abacus.ai/api/getRunFfmpegCommandStatus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id, deployment_token: apiKey }),
      })

      const statusData = await statusRes.json()
      const status = statusData?.status || 'FAILED'

      if (status === 'SUCCESS') {
        const mp3Url = statusData?.result?.result?.out_1
        if (mp3Url) {
          console.log('[Speech] OGG -> MP3 conversion done')
          return mp3Url
        }
        console.error('[Speech] FFmpeg success but no output URL')
        return null
      } else if (status === 'FAILED') {
        console.error('[Speech] FFmpeg failed:', statusData?.result?.error)
        return null
      }
    }

    console.error('[Speech] FFmpeg timeout')
    return null
  } catch (err) {
    console.error('[Speech] FFmpeg exception:', err)
    return null
  }
}

// Transcribir audio con fal.ai Whisper (acepta URL directa del MP3)
async function transcribeWithFalWhisper(mp3Url: string): Promise<string | null> {
  const falKey = process.env.FAL_KEY || ''
  if (!falKey) {
    console.error('[Speech] No FAL_KEY configured')
    return null
  }

  try {
    console.log('[Speech] Sending to fal.ai Whisper:', mp3Url.slice(0, 80) + '...')

    // Paso 1: Submit request a fal.ai Whisper
    const submitRes = await fetch('https://queue.fal.run/fal-ai/whisper', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${falKey}`,
      },
      body: JSON.stringify({
        audio_url: mp3Url,
        task: 'transcribe',
        language: 'es',
        chunk_level: 'segment',
      }),
    })

    if (!submitRes.ok) {
      const errText = await submitRes.text()
      console.error('[Speech] fal.ai submit error:', submitRes.status, errText.slice(0, 300))
      return null
    }

    const submitData = await submitRes.json()

    // Si la respuesta tiene 'text' directamente (sync response)
    if (submitData.text) {
      console.log('[Speech] Whisper transcribed (sync):', submitData.text.slice(0, 100))
      return submitData.text.trim() || null
    }

    // Si es async (tiene request_id), hacer polling
    const requestId = submitData.request_id
    if (!requestId) {
      console.error('[Speech] fal.ai: no request_id or text in response')
      return null
    }

    console.log('[Speech] fal.ai request queued:', requestId)

    // Paso 2: Polling status (max 60 segundos)
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 1000))

      const statusRes = await fetch(`https://queue.fal.run/fal-ai/whisper/requests/${requestId}/status`, {
        headers: { 'Authorization': `Key ${falKey}` },
      })

      if (!statusRes.ok) continue

      const statusData = await statusRes.json()

      if (statusData.status === 'COMPLETED') {
        // Fetch result
        const resultRes = await fetch(`https://queue.fal.run/fal-ai/whisper/requests/${requestId}`, {
          headers: { 'Authorization': `Key ${falKey}` },
        })

        if (!resultRes.ok) {
          console.error('[Speech] fal.ai result fetch error:', resultRes.status)
          return null
        }

        const resultData = await resultRes.json()
        const transcript = resultData.text?.trim() || ''

        if (transcript) {
          console.log('[Speech] Whisper transcribed:', transcript.slice(0, 100))
          return transcript
        }
        console.log('[Speech] Whisper: empty transcript')
        return null
      } else if (statusData.status === 'FAILED') {
        console.error('[Speech] fal.ai Whisper failed:', statusData.error)
        return null
      }
      // IN_QUEUE or IN_PROGRESS - keep waiting
    }

    console.error('[Speech] fal.ai Whisper timeout')
    return null
  } catch (err) {
    console.error('[Speech] fal.ai Whisper exception:', err)
    return null
  }
}

// Funcion principal: recibe URL del OGG de Telegram, devuelve texto
export async function transcribeAudioFromUrl(
  oggUrl: string
): Promise<string | null> {
  console.log('[Speech] Starting transcription: OGG -> MP3 -> fal.ai Whisper')

  // Paso 1: Convertir OGG a MP3
  const mp3Url = await convertOggToMp3(oggUrl)
  if (!mp3Url) {
    console.error('[Speech] Failed to convert OGG to MP3')
    return null
  }

  // Paso 2: Transcribir con fal.ai Whisper
  const transcript = await transcribeWithFalWhisper(mp3Url)
  return transcript
}

// Mantener compatibilidad
export async function transcribeAudio(
  audioBuffer: Buffer,
  languageHint: string = 'es'
): Promise<string | null> {
  console.warn('[Speech] transcribeAudio(buffer) is deprecated, use transcribeAudioFromUrl(url)')
  return null
}
