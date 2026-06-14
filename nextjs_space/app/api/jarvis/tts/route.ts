import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPlanGate } from '@/lib/plan-gate'

export const dynamic = 'force-dynamic'

// Limpiar texto de markdown/emojis para pronunciación limpia
function cleanForSpeech(text: string): string {
  let clean = text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/#{1,6}\s/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`[^`]+`/g, '')
    .replace(/---/g, '')
    .replace(/\|[^|]+\|/g, '')
    .replace(/\n+/g, '. ')
    .replace(/\s+/g, ' ')
    .trim()
  // Remove ALL non-ASCII characters (emojis, special unicode, etc) to avoid URI encoding errors
  // Keep only basic Latin, accented chars (Spanish), and common punctuation
  clean = clean.replace(/[^\x20-\x7E\u00A0-\u00FF\u0100-\u024F]/g, '')
  // Clean up leftover whitespace
  clean = clean.replace(/\s+/g, ' ').trim()
  return clean
}

// ============================================
// ELEVENLABS TTS (premium, voz ultra-realista)
// ============================================
async function synthesizeWithElevenLabs(
  text: string,
  apiKey: string,
  voiceId: string
): Promise<Buffer | null> {
  try {
    const response = await fetch(
      'https://api.elevenlabs.io/v1/text-to-speech/' + voiceId,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text: text.slice(0, 2500), // ElevenLabs soporta más texto
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.4,
            use_speaker_boost: true,
          },
        }),
      }
    )

    if (!response.ok) {
      console.error('[TTS] ElevenLabs error:', response.status)
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (err) {
    console.error('[TTS] ElevenLabs exception:', err)
    return null
  }
}

// ============================================
// GOOGLE TRANSLATE TTS (gratuita, por defecto)
// ============================================
function splitIntoChunks(text: string, maxLen: number = 190): string[] {
  const chunks: string[] = []
  const sentences = text.split(/(?<=[.!?])\s+/)
  let current = ''

  for (const sentence of sentences) {
    if (current.length + sentence.length + 1 <= maxLen) {
      current += (current ? ' ' : '') + sentence
    } else {
      if (current) chunks.push(current)
      if (sentence.length > maxLen) {
        const words = sentence.split(' ')
        let wordChunk = ''
        for (const word of words) {
          if (wordChunk.length + word.length + 1 <= maxLen) {
            wordChunk += (wordChunk ? ' ' : '') + word
          } else {
            if (wordChunk) chunks.push(wordChunk)
            wordChunk = word
          }
        }
        if (wordChunk) current = wordChunk
      } else {
        current = sentence
      }
    }
  }
  if (current) chunks.push(current)
  return chunks
}

async function synthesizeWithGoogleTranslate(text: string): Promise<Buffer | null> {
  const cleanText = text.slice(0, 800)
  const chunks = splitIntoChunks(cleanText)
  const audioBuffers: Buffer[] = []

  for (const chunk of chunks) {
    let encodedText: string
    try {
      encodedText = encodeURIComponent(chunk)
    } catch {
      console.warn('[TTS] encodeURIComponent failed for chunk, skipping:', chunk.substring(0, 50))
      continue
    }
    const url = 'https://translate.google.com/translate_tts?ie=UTF-8&q=' + encodedText + '&tl=es&client=tw-ob&ttsspeed=1'

    try {
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://translate.google.com/',
        },
      })

      if (resp.ok) {
        const arrayBuffer = await resp.arrayBuffer()
        if (arrayBuffer.byteLength > 0) {
          audioBuffers.push(Buffer.from(arrayBuffer))
        }
      } else {
        console.warn('[TTS] Google Translate returned', resp.status, 'for chunk')
      }
    } catch (err) {
      console.warn('[TTS] Google Translate fetch error:', err)
    }
  }

  if (audioBuffers.length === 0) return null
  return Buffer.concat(audioBuffers)
}

// ============================================
// ENDPOINT PRINCIPAL (híbrido)
// ============================================
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Plan gate: Jarvis Premium feature (TTS / voice)
    const gate = await checkPlanGate(session.user.id, 'jarvis_premium')
    if (!gate.allowed) {
      return NextResponse.json({ error: 'plan_limit', gate }, { status: 403 })
    }

    const { text } = await request.json()
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Texto requerido' }, { status: 400 })
    }

    const cleanText = cleanForSpeech(text)
    if (!cleanText) {
      return NextResponse.json({ error: 'Texto vacío' }, { status: 400 })
    }

    // Verificar si el usuario tiene ElevenLabs configurado
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { elevenLabsKey: true, elevenLabsVoiceId: true, elevenLabsEnabled: true },
    })

    let audioBuffer: Buffer | null = null
    let engine = 'google'
    let elevenLabsError: string | null = null

    // RUTA 1: ElevenLabs (premium) si el usuario tiene API key Y está habilitado
    if (user?.elevenLabsKey && user?.elevenLabsVoiceId && user?.elevenLabsEnabled !== false) {
      console.log('[TTS] Using ElevenLabs (premium voice)')
      audioBuffer = await synthesizeWithElevenLabs(
        cleanText,
        user.elevenLabsKey,
        user.elevenLabsVoiceId
      )
      if (audioBuffer) {
        engine = 'elevenlabs'
      } else {
        elevenLabsError = 'API key inválida o expirada (401). Ve a Settings → Voz para actualizarla.'
        console.warn('[TTS] ElevenLabs failed, falling back to Google Translate')
      }
    }

    // RUTA 2: Google Translate (gratuita) como default/fallback
    if (!audioBuffer) {
      console.log('[TTS] Using Google Translate (free voice)')
      audioBuffer = await synthesizeWithGoogleTranslate(cleanText)
    }

    if (!audioBuffer) {
      return NextResponse.json({ error: 'No se pudo generar audio' }, { status: 500 })
    }

    const audioBase64 = audioBuffer.toString('base64')
    return NextResponse.json({
      audioBase64,
      engine,
      ...(elevenLabsError ? { warning: elevenLabsError } : {}),
    })

  } catch (error) {
    console.error('[TTS] Error:', error)
    return NextResponse.json({ error: 'Error procesando TTS' }, { status: 500 })
  }
}
