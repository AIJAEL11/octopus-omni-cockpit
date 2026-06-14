// ============================================
// Gmail Integration for Growth Engine — Phase 2
// Sends approved outreach emails via Google Workspace
// ============================================

import { prisma } from '@/lib/prisma'
import { getValidAccessToken, googleApiFetch } from '@/lib/google-oauth'

/** Get valid Google access token for a user — with intelligent retry & auto-reconnect */
export async function getUserGmailToken(userId: string): Promise<string | null> {
  // Find ALL google_workspace/gmail connections and pick the one that actually has tokens.
  const connections = await prisma.armConnection.findMany({
    where: { userId, armType: { in: ['google_workspace', 'gmail'] }, status: 'connected' },
  })
  if (connections.length === 0) {
    console.warn(`[Gmail Token] No google_workspace/gmail connection found for user ${userId}`)
    return null
  }

  let connection: typeof connections[number] | null = null
  let creds: any = null
  for (const c of connections) {
    try {
      const parsed = JSON.parse(c.credentials)
      if (parsed?.accessToken && parsed?.refreshToken) {
        connection = c
        creds = parsed
        break
      }
    } catch {}
  }

  if (!connection || !creds) {
    console.warn(`[Gmail Token] Found ${connections.length} connection(s) but none have valid tokens for user ${userId}`)
    return null
  }
  console.log(`[Gmail Token] Using connection: type=${connection.armType}, id=${connection.id}`)

  try {
    const { accessToken, refreshed, newExpiry } = await getValidAccessToken(creds)

    if (refreshed && newExpiry) {
      const updated = { ...creds, accessToken, tokenExpiry: newExpiry }
      await prisma.armConnection.update({
        where: { id: connection.id },
        data: { credentials: JSON.stringify(updated) },
      })
      console.log(`[Gmail Token] ✅ Token refreshed successfully, expires at ${new Date(newExpiry).toISOString()}`)
    }

    return accessToken
  } catch (err: any) {
    const errMsg = err?.message || String(err)
    console.error(`[Gmail Token] ❌ Token refresh failed:`, errMsg)

    // If refresh failed, mark the connection as degraded so the user gets notified
    if (errMsg.includes('400') || errMsg.includes('401') || errMsg.includes('invalid_grant')) {
      console.warn(`[Gmail Token] 🔴 Refresh token revoked or expired. Marking connection as degraded.`)
      await prisma.armConnection.update({
        where: { id: connection.id },
        data: { status: 'degraded' },
      }).catch(() => {})
    }

    return null
  }
}

/** Verify a Gmail access token works by making a lightweight API call */
export async function verifyGmailToken(accessToken: string): Promise<boolean> {
  try {
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    return res.ok
  } catch {
    return false
  }
}

/** Get token with verification — forces refresh if current token is dead */
export async function getUserGmailTokenVerified(userId: string): Promise<string | null> {
  const token = await getUserGmailToken(userId)
  if (!token) return null

  // Quick verify
  const isValid = await verifyGmailToken(token)
  if (isValid) return token

  // Token is dead — force a refresh by manipulating tokenExpiry
  console.warn(`[Gmail Token] Token failed verification, forcing refresh...`)
  const connections = await prisma.armConnection.findMany({
    where: { userId, armType: { in: ['google_workspace', 'gmail'] }, status: { in: ['connected', 'degraded'] } },
  })

  for (const c of connections) {
    try {
      const creds = JSON.parse(c.credentials)
      if (!creds?.refreshToken) continue

      // Force refresh by setting expiry to 0
      creds.tokenExpiry = 0
      const { accessToken, refreshed, newExpiry } = await getValidAccessToken(creds)
      
      if (refreshed && newExpiry) {
        await prisma.armConnection.update({
          where: { id: c.id },
          data: {
            credentials: JSON.stringify({ ...creds, accessToken, tokenExpiry: newExpiry }),
            status: 'connected',
          },
        })
        console.log(`[Gmail Token] ✅ Forced refresh successful`)
        return accessToken
      }
    } catch (err) {
      console.error(`[Gmail Token] ❌ Forced refresh also failed:`, err)
    }
  }

  return null
}

/** Build RFC 2822 email message and encode as base64url for Gmail API.
 *  Supports both plain text and HTML (multipart/alternative) when htmlBody is provided. */
function buildRawEmail(opts: {
  from: string
  fromName?: string
  to: string
  toName?: string
  subject: string
  body: string
  htmlBody?: string
  replyTo?: string
}): string {
  const fromHeader = opts.fromName
    ? `"${opts.fromName}" <${opts.from}>`
    : opts.from
  const toHeader = opts.toName
    ? `"${opts.toName}" <${opts.to}>`
    : opts.to

  if (opts.htmlBody) {
    // multipart/alternative: plain text + HTML
    const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const lines = [
      `From: ${fromHeader}`,
      `To: ${toHeader}`,
      `Subject: ${opts.subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ]
    if (opts.replyTo) lines.push(`Reply-To: ${opts.replyTo}`)
    lines.push(
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      opts.body,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      opts.htmlBody,
      '',
      `--${boundary}--`
    )
    return Buffer.from(lines.join('\r\n')).toString('base64url')
  }

  // Plain text only (legacy)
  const lines = [
    `From: ${fromHeader}`,
    `To: ${toHeader}`,
    `Subject: ${opts.subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
  ]
  if (opts.replyTo) {
    lines.push(`Reply-To: ${opts.replyTo}`)
  }
  lines.push('', opts.body)

  const raw = lines.join('\r\n')
  return Buffer.from(raw).toString('base64url')
}

/** Convert plain text email body to a clean HTML email with tracking pixel.
 *  Preserves paragraphs, wraps in a professional but minimal HTML template. */
export function buildTrackedHtmlEmail(plainBody: string, trackingPixelUrl: string): string {
  // Convert plain text to HTML paragraphs
  const htmlParagraphs = plainBody
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p style="margin:0 0 14px 0;line-height:1.6;">${p.replace(/\n/g, '<br>')}</p>`)
    .join('\n')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;color:#1a1a1a;padding:0;margin:0;">
<div style="max-width:600px;margin:0 auto;padding:20px;">
${htmlParagraphs}
</div>
<img src="${trackingPixelUrl}" width="1" height="1" style="display:none!important;width:1px!important;height:1px!important;border:0!important;margin:0!important;padding:0!important;" alt="" />
</body>
</html>`
}

/** Send an email via Gmail API */
export async function sendGmailEmail(opts: {
  accessToken: string
  from: string
  fromName?: string
  to: string
  toName?: string
  subject: string
  body: string
  htmlBody?: string
  threadId?: string
}): Promise<{ id: string; threadId: string; labelIds: string[] }> {
  const raw = buildRawEmail(opts)

  const payload: Record<string, string> = { raw }
  if (opts.threadId) payload.threadId = opts.threadId

  const res = await googleApiFetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    opts.accessToken,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  )

  if (!res.ok) {
    const errText = await res.text()
    console.error('[Gmail Send] Error:', res.status, errText)
    throw new Error(`Gmail send failed: ${res.status} — ${errText}`)
  }

  return res.json()
}

/** Get user's Gmail profile (email address) */
export async function getGmailProfile(accessToken: string): Promise<{ emailAddress: string }> {
  const res = await googleApiFetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/profile',
    accessToken
  )
  if (!res.ok) throw new Error('Failed to get Gmail profile')
  return res.json()
}

/** Search Gmail for messages related to a specific email (sent + received) */
export async function searchGmailThreads(opts: {
  accessToken: string
  query: string
  maxResults?: number
}): Promise<any[]> {
  const maxResults = opts.maxResults || 20
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=${encodeURIComponent(opts.query)}`

  const listRes = await googleApiFetch(url, opts.accessToken)
  if (!listRes.ok) return []
  const listData = await listRes.json()
  const messages = listData.messages || []

  const detailed: any[] = []
  for (const msg of messages.slice(0, maxResults)) {
    try {
      const msgRes = await googleApiFetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
        opts.accessToken
      )
      if (msgRes.ok) {
        const msgData = await msgRes.json()
        const headers = msgData.payload?.headers || []
        const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || ''

        // Extract body
        let body = ''
        if (msgData.payload?.body?.data) {
          body = Buffer.from(msgData.payload.body.data, 'base64url').toString('utf-8')
        } else if (msgData.payload?.parts) {
          const textPart = msgData.payload.parts.find((p: any) => p.mimeType === 'text/plain')
          if (textPart?.body?.data) {
            body = Buffer.from(textPart.body.data, 'base64url').toString('utf-8')
          }
        }

        detailed.push({
          id: msgData.id,
          threadId: msgData.threadId,
          labelIds: msgData.labelIds || [],
          snippet: msgData.snippet || '',
          subject: getHeader('Subject'),
          from: getHeader('From'),
          to: getHeader('To'),
          date: getHeader('Date'),
          body: body.substring(0, 2000),
          isSent: (msgData.labelIds || []).includes('SENT'),
        })
      }
    } catch (e) {
      console.error('[Gmail] Error fetching message:', e)
    }
  }

  return detailed
}
