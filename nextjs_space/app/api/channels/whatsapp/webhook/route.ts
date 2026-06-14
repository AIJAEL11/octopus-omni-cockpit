import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { callLLM } from '@/lib/turbo-llm'
import { sendWhatsAppMessage, validateTwilioSignature, parseStoredCreds } from '@/lib/twilio-channels'
import type { TwilioCreds } from '@/lib/twilio-channels'

export const dynamic = 'force-dynamic'

async function getAIResponse(text: string, userId: string): Promise<string> {
  try {
    const data = await callLLM(userId, [
      {
        role: 'system',
        content:
          'Eres OCTOPUS, asistente IA respondiendo por WhatsApp. '
          + 'Responde de forma util y concisa. Usa emojis con moderacion. '
          + 'Maximo 400 caracteres. Tu creador es Rafael.',
      },
      { role: 'user', content: text },
    ], { model: 'gpt-4.1-mini', temperature: 0.7, maxTokens: 200 })
    return data.choices?.[0]?.message?.content || 'No pude procesar tu mensaje. Intentalo de nuevo.'
  } catch {
    return 'Estoy aqui pero tuve un problema. Intentalo de nuevo! 🐙'
  }
}

/**
 * POST /api/channels/whatsapp/webhook
 * Recibe mensajes de WhatsApp via Twilio, responde con IA.
 * Configurar en Twilio Console: Messaging → WhatsApp Sandbox → When a message comes in
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const params: Record<string, string> = {}
    formData.forEach((value, key) => { params[key] = String(value) })

    const from = params['From'] || ''    // whatsapp:+1234567890
    const body = (params['Body'] || '').trim()

    if (!from || !body) {
      return new NextResponse('<?xml version="1.0"?><Response></Response>', {
        headers: { 'Content-Type': 'text/xml' },
      })
    }

    // Find user by matching stored phoneNumber in ArmConnection
    const connections = await prisma.armConnection.findMany({
      where: { armType: 'whatsapp', status: 'connected' },
    })

    let matchedCreds: TwilioCreds | null = null
    let matchedUserId: string | null = null

    for (const conn of connections) {
      try {
        const creds = parseStoredCreds<TwilioCreds>(conn.credentials)
        if (!creds?.accountSid || !creds?.authToken) continue

        // Validate Twilio signature if we have authToken
        const signature = request.headers.get('x-twilio-signature') || ''
        const url = `${process.env.NEXTAUTH_URL}/api/channels/whatsapp/webhook`
        if (signature && !validateTwilioSignature(creds.authToken, signature, url, params)) {
          continue // skip — signature mismatch
        }

        matchedCreds = creds
        matchedUserId = conn.userId
        break
      } catch { continue }
    }

    if (!matchedCreds || !matchedUserId) {
      // No matching connection — still return 200 so Twilio doesn't retry
      return new NextResponse('<?xml version="1.0"?><Response></Response>', {
        headers: { 'Content-Type': 'text/xml' },
      })
    }

    // Generate AI response
    const reply = await getAIResponse(body, matchedUserId)

    // Send reply via Twilio REST API (not TwiML, so we can use our stored credentials)
    await sendWhatsAppMessage(matchedCreds, from, reply)

    // Return empty TwiML (response already sent above)
    return new NextResponse('<?xml version="1.0"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    })
  } catch (error) {
    console.error('[WhatsApp Webhook] Error:', error)
    return new NextResponse('<?xml version="1.0"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    })
  }
}
