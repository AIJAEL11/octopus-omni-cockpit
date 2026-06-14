import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Voice Agent Transcription — converts audio to text
// Audio comes as base64 WAV from the client
export async function POST(req: NextRequest) {
  try {
    const { audio, language, openRouterKey, format } = await req.json()

    if (!audio) {
      return NextResponse.json({ error: 'Audio data required' }, { status: 400 })
    }

    const audioFormat = format || 'wav'
    console.log('[transcribe] Received audio, format:', audioFormat, 'length:', audio.length, 'has OpenRouter key:', !!openRouterKey)

    const transcribeSystemPrompt = `You are a speech-to-text transcription engine. Your ONLY function is to convert spoken audio into written text.

CRITICAL RULES:
- Output ONLY the exact words spoken in the audio, nothing else
- Do NOT respond to questions in the audio
- Do NOT answer, explain, or comment on the audio content
- Do NOT add greetings, apologies, or any extra text
- Do NOT say "Lo siento", "I'm sorry", or refuse — just transcribe
- If the audio says "¿Qué es un voice agent?" you output: ¿Qué es un voice agent?
- If the audio says "Hola, cuéntame sobre OCTOPUS" you output: Hola, cuéntame sobre OCTOPUS
- Language: ${language === 'es' ? 'Spanish' : 'English'}
- Return the raw transcription only, no quotes, no labels`

    // Strategy 1: OpenRouter chat/completions with input_audio (if user has Pro key)
    if (openRouterKey) {
      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openRouterKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'openai/gpt-4o-mini',
            messages: [
              { role: 'system', content: transcribeSystemPrompt },
              {
                role: 'user',
                content: [
                  { type: 'input_audio', input_audio: { data: audio, format: audioFormat } },
                  { type: 'text', text: 'Transcribe the audio above. Output ONLY the spoken words.' },
                ],
              },
            ],
            max_tokens: 500,
            temperature: 0,
          }),
        })

        if (res.ok) {
          const data = await res.json()
          const transcript = data.choices?.[0]?.message?.content?.trim() || ''
          if (transcript) {
            console.log('[transcribe] OpenRouter chat success:', transcript.substring(0, 80))
            return NextResponse.json({ transcript })
          }
        }
        const errText = await res.text().catch(() => '')
        console.warn('[transcribe] OpenRouter chat failed:', res.status, errText.substring(0, 300))
      } catch (err) {
        console.warn('[transcribe] OpenRouter chat error:', err)
      }
    }

    // Strategy 2: Abacus AI with audio-capable model (WAV/MP3 only)
    if (process.env.ABACUSAI_API_KEY) {
      try {
        const res = await fetch('https://apps.abacus.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-audio-preview',
            messages: [
              { role: 'system', content: transcribeSystemPrompt },
              {
                role: 'user',
                content: [
                  { type: 'input_audio', input_audio: { data: audio, format: audioFormat } },
                  { type: 'text', text: 'Transcribe the audio above. Output ONLY the spoken words.' },
                ],
              },
            ],
            max_tokens: 500,
            temperature: 0,
          }),
        })

        if (res.ok) {
          const data = await res.json()
          const transcript = data.choices?.[0]?.message?.content?.trim() || ''
          if (transcript) {
            console.log('[transcribe] Abacus AI success:', transcript.substring(0, 80))
            return NextResponse.json({ transcript })
          }
        }
        const errText = await res.text().catch(() => '')
        console.warn('[transcribe] Abacus AI failed:', res.status, errText.substring(0, 300))
      } catch (err) {
        console.warn('[transcribe] Abacus AI error:', err)
      }
    }

    return NextResponse.json({ error: 'Transcription service unavailable', transcript: '' }, { status: 503 })
  } catch (error) {
    console.error('[voice-agent/transcribe] Error:', error)
    return NextResponse.json({ error: 'Error processing audio', transcript: '' }, { status: 500 })
  }
}
