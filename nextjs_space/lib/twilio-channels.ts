/**
 * TWILIO CHANNELS — WhatsApp & SMS helper
 *
 * Handles sending messages and validating webhook signatures.
 * Credentials (accountSid + authToken) are stored encrypted in ArmConnection.
 */
import { createHmac } from 'crypto'
import { decryptApiKey } from '@/lib/crypto'

export interface TwilioCreds {
  accountSid: string
  authToken: string
  /** E.164 number: +14155238886 or whatsapp:+14155238886 */
  phoneNumber: string
}

/**
 * Parse stored credentials tolerantly: the Omnichannel page stores them
 * encrypted (encryptApiKey) while the Brazos page stores plain JSON.
 */
export function parseStoredCreds<T = Record<string, string>>(raw: string): T | null {
  try { return JSON.parse(decryptApiKey(raw)) } catch { /* not encrypted */ }
  try { return JSON.parse(raw) } catch { return null }
}

/** Validate X-Twilio-Signature on incoming webhook requests */
export function validateTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  const sortedKeys = Object.keys(params).sort()
  const valueStr = sortedKeys.reduce((acc, key) => acc + key + params[key], url)
  const expected = createHmac('sha1', authToken).update(valueStr).digest('base64')
  return expected === signature
}

/** Send a WhatsApp message via Twilio */
export async function sendWhatsAppMessage(
  creds: TwilioCreds,
  to: string,
  body: string
): Promise<boolean> {
  const from = creds.phoneNumber.startsWith('whatsapp:')
    ? creds.phoneNumber
    : `whatsapp:${creds.phoneNumber}`
  const toAddr = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`
  return twilioSend(creds, from, toAddr, body)
}

/** Send an SMS message via Twilio */
export async function sendSmsMessage(
  creds: TwilioCreds,
  to: string,
  body: string
): Promise<boolean> {
  const from = creds.phoneNumber.replace(/^whatsapp:/, '')
  const toAddr = to.replace(/^whatsapp:/, '')
  return twilioSend(creds, from, toAddr, body)
}

async function twilioSend(
  creds: TwilioCreds,
  from: string,
  to: string,
  body: string
): Promise<boolean> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Messages.json`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ From: from, To: to, Body: body }).toString(),
    })
    return res.ok
  } catch {
    return false
  }
}
