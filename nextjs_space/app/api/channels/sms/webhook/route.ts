import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { callLLM } from '@/lib/turbo-llm'
import { sendSmsMessage, validateTwilioSignature, parseStoredCreds } from '@/lib/twilio-channels'
import type { TwilioCreds } from '@/lib/twilio-channels'

export const dynamic = 'force-dynamic'

async function getAIResponse(text: string, userId: string): Promise<string> {
  try {
    const data = await callLLM(userId, [
      {
        role: 'system',
        content:
          'Eres OCTOPUS, asistente IA respondiendo por SMS. '
          + 'Responde de forma concisa. Sin emojis (SMS). '
          + 'Maximo 160 caracteres. Tu creador es Rafael.',
      },
      { role: 'user', content: text },
    ], { model: 'gpt-4.1-mini', temperature: 0.7, maxTokens: 100 })
    return data.choices?.[0]?.message?.content || 'No pude procesar tu mensaje.'
  } catch {
    return 'OCTOPUS aqui. Tuve un problema, intentalo de nuevo.'
  }
}

/**
 * POST /api/channels/sms/webhook
 * Recibe SMS via Twilio, responde con IA.
 * Configurar en Twilio Console: Phone Numbers → Active Numbers → Messaging
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const params: Record<string, string> = {}
    formData.forEach((value, key) => { params[key] = String(value) })

    const from = params['From'] || ''    // +1234567890
    const body = (params['Body'] || '').trim()

    if (!from || !body) {
      return new NextResponse('<?xml version="1.0"?><Response></Response>', {
        headers: { 'Content-Type': 'text/xml' },
      })
    }

    const connections = await prisma.armConnection.findMany({
      where: { armType: 'sms', status: 'connected' },
    })

    let matchedCreds: TwilioCreds | null = null
    let matchedUserId: string | null = null

    for (const conn of connections) {
      try {
        const creds = parseStoredCreds<TwilioCreds>(conn.credentials)
        if (!creds?.accountSid || !creds?.authToken) continue

        const signature = request.headers.get('x-twilio-signature') || ''
        const url = `${process.env.NEXTAUTH_URL}/api/channels/sms/webhook`
        if (signature && !validateTwilioSignature(creds.authToken, signature, url, params)) {
          continue
        }

        matchedCreds = creds
        matchedUserId = conn.userId
        break
      } catch { continue }
    }

    if (!matchedCreds || !matchedUserId) {
      return new NextResponse('<?xml version="1.0"?><Response></Response>', {
        headers: { 'Content-Type': 'text/xml' },
      })
    }

    const reply = await getAIResponse(body, matchedUserId)
    await sendSmsMessage(matchedCreds, from, reply)

    return new NextResponse('<?xml version="1.0"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    })
  } catch (error) {
    console.error('[SMS Webhook] Error:', error)
    return new NextResponse('<?xml version="1.0"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    })
  }
}
