import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getValidAccessToken, googleApiFetch } from '@/lib/google-oauth'

export const dynamic = 'force-dynamic'

/** Helper: obtiene credenciales y token válido del usuario */
async function getUserGoogleCredentials(userId: string) {
  const connection = await prisma.armConnection.findFirst({
    where: { userId, armType: 'google_workspace', status: 'connected' },
  })
  if (!connection) return null

  const creds = JSON.parse(connection.credentials)
  if (!creds.accessToken || !creds.refreshToken) return null

  const { accessToken, refreshed, newExpiry } = await getValidAccessToken(creds)

  // Si se refrescó el token, actualizar en DB
  if (refreshed && newExpiry) {
    const updated = { ...creds, accessToken, tokenExpiry: newExpiry }
    await prisma.armConnection.update({
      where: { id: connection.id },
      data: { credentials: JSON.stringify(updated) },
    })
  }

  return { accessToken, connectionId: connection.id }
}

/**
 * POST /api/brazos/google/services
 * Body: { service: 'calendar'|'drive'|'docs'|'sheets', action: string, params: {} }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { service, action, params } = await request.json()
    if (!service || !action) {
      return NextResponse.json({ error: 'Servicio y acción requeridos' }, { status: 400 })
    }

    const google = await getUserGoogleCredentials(session.user.id)
    if (!google) {
      return NextResponse.json(
        { error: 'Google Workspace no conectado. Autoriza primero.' },
        { status: 403 }
      )
    }

    let result: unknown

    switch (service) {
      case 'calendar':
        result = await handleCalendar(action, params || {}, google.accessToken)
        break
      case 'drive':
        result = await handleDrive(action, params || {}, google.accessToken)
        break
      case 'docs':
        result = await handleDocs(action, params || {}, google.accessToken)
        break
      case 'sheets':
        result = await handleSheets(action, params || {}, google.accessToken)
        break
      case 'gmail':
        result = await handleGmail(action, params || {}, google.accessToken, session.user.id)
        break
      default:
        return NextResponse.json({ error: `Servicio '${service}' no soportado` }, { status: 400 })
    }

    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    console.error('Error en Google services:', error)
    return NextResponse.json(
      { error: error.message || 'Error al ejecutar acción' },
      { status: 500 }
    )
  }
}

// ═══════════════════════════════════════════
// CALENDAR
// ═══════════════════════════════════════════
async function handleCalendar(action: string, params: any, token: string) {
  const BASE = 'https://www.googleapis.com/calendar/v3'
  switch (action) {
    case 'list_events': {
      const calId = params.calendarId || 'primary'
      const timeMin = params.timeMin || new Date().toISOString()
      const timeMax = params.timeMax || ''
      const maxResults = params.maxResults || 10
      let url = `${BASE}/calendars/${encodeURIComponent(calId)}/events?timeMin=${encodeURIComponent(timeMin)}&maxResults=${maxResults}&singleEvents=true&orderBy=startTime`
      if (timeMax) url += `&timeMax=${encodeURIComponent(timeMax)}`
      const res = await googleApiFetch(url, token)
      return res.json()
    }
    case 'create_event': {
      const calId = params.calendarId || 'primary'
      const res = await googleApiFetch(
        `${BASE}/calendars/${encodeURIComponent(calId)}/events`,
        token,
        {
          method: 'POST',
          body: JSON.stringify({
            summary: params.summary,
            description: params.description || '',
            start: params.start, // { dateTime: '...', timeZone: '...' }
            end: params.end,
            attendees: params.attendees || [],
            location: params.location || '',
          }),
        }
      )
      return res.json()
    }
    case 'list_calendars': {
      const res = await googleApiFetch(`${BASE}/users/me/calendarList`, token)
      return res.json()
    }
    default:
      throw new Error(`Acción de Calendar no soportada: ${action}`)
  }
}

// ═══════════════════════════════════════════
// DRIVE
// ═══════════════════════════════════════════
async function handleDrive(action: string, params: any, token: string) {
  const BASE = 'https://www.googleapis.com/drive/v3'
  switch (action) {
    case 'list_files': {
      const q = params.query || ''
      const pageSize = params.pageSize || 20
      let url = `${BASE}/files?pageSize=${pageSize}&fields=files(id,name,mimeType,modifiedTime,size,webViewLink,iconLink,thumbnailLink)`
      if (q) url += `&q=${encodeURIComponent(q)}`
      if (params.folderId) url += `&q=${encodeURIComponent(`'${params.folderId}' in parents`)}`
      const res = await googleApiFetch(url, token)
      return res.json()
    }
    case 'search': {
      const q = params.query || ''
      const url = `${BASE}/files?q=${encodeURIComponent(`name contains '${q}'`)}&pageSize=20&fields=files(id,name,mimeType,modifiedTime,size,webViewLink)`
      const res = await googleApiFetch(url, token)
      return res.json()
    }
    case 'get_file': {
      const res = await googleApiFetch(
        `${BASE}/files/${params.fileId}?fields=id,name,mimeType,modifiedTime,size,webViewLink,description`,
        token
      )
      return res.json()
    }
    case 'create_folder': {
      const res = await googleApiFetch(`${BASE}/files`, token, {
        method: 'POST',
        body: JSON.stringify({
          name: params.name,
          mimeType: 'application/vnd.google-apps.folder',
          parents: params.parentId ? [params.parentId] : [],
        }),
      })
      return res.json()
    }
    default:
      throw new Error(`Acción de Drive no soportada: ${action}`)
  }
}

// ═══════════════════════════════════════════
// DOCS
// ═══════════════════════════════════════════
async function handleDocs(action: string, params: any, token: string) {
  const DOCS_BASE = 'https://docs.googleapis.com/v1'
  const DRIVE_BASE = 'https://www.googleapis.com/drive/v3'
  switch (action) {
    case 'list': {
      // Listar documentos de Google Docs via Drive API con filtro mimeType
      const pageSize = params.pageSize || 20
      const q = `mimeType='application/vnd.google-apps.document'`
      const url = `${DRIVE_BASE}/files?q=${encodeURIComponent(q)}&pageSize=${pageSize}&orderBy=modifiedTime desc&fields=files(id,name,mimeType,modifiedTime,webViewLink,owners,createdTime)`
      const res = await googleApiFetch(url, token)
      return res.json()
    }
    case 'create': {
      const res = await googleApiFetch(`${DOCS_BASE}/documents`, token, {
        method: 'POST',
        body: JSON.stringify({ title: params.title || 'Nuevo Documento' }),
      })
      return res.json()
    }
    case 'get': {
      const res = await googleApiFetch(`${DOCS_BASE}/documents/${params.documentId}`, token)
      return res.json()
    }
    case 'append_text': {
      // Primero obtener el documento para saber el último índice
      const docRes = await googleApiFetch(`${DOCS_BASE}/documents/${params.documentId}`, token)
      const doc = await docRes.json()
      const endIndex = doc.body?.content?.slice(-1)?.[0]?.endIndex || 1

      const res = await googleApiFetch(
        `${DOCS_BASE}/documents/${params.documentId}:batchUpdate`,
        token,
        {
          method: 'POST',
          body: JSON.stringify({
            requests: [
              {
                insertText: {
                  location: { index: Math.max(1, endIndex - 1) },
                  text: params.text,
                },
              },
            ],
          }),
        }
      )
      return res.json()
    }
    default:
      throw new Error(`Acción de Docs no soportada: ${action}`)
  }
}

// ═══════════════════════════════════════════
// SHEETS
// ═══════════════════════════════════════════
async function handleSheets(action: string, params: any, token: string) {
  const BASE = 'https://sheets.googleapis.com/v4'
  switch (action) {
    case 'create': {
      const res = await googleApiFetch(`${BASE}/spreadsheets`, token, {
        method: 'POST',
        body: JSON.stringify({
          properties: { title: params.title || 'Nueva Hoja de Cálculo' },
        }),
      })
      return res.json()
    }
    case 'get': {
      const res = await googleApiFetch(`${BASE}/spreadsheets/${params.spreadsheetId}`, token)
      return res.json()
    }
    case 'read_range': {
      const range = encodeURIComponent(params.range || 'Sheet1!A1:Z100')
      const res = await googleApiFetch(
        `${BASE}/spreadsheets/${params.spreadsheetId}/values/${range}`,
        token
      )
      return res.json()
    }
    case 'write_range': {
      const range = encodeURIComponent(params.range || 'Sheet1!A1')
      const res = await googleApiFetch(
        `${BASE}/spreadsheets/${params.spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
        token,
        {
          method: 'PUT',
          body: JSON.stringify({
            values: params.values, // [["col1","col2"],["val1","val2"]]
          }),
        }
      )
      return res.json()
    }
    case 'append_rows': {
      const range = encodeURIComponent(params.range || 'Sheet1!A1')
      const res = await googleApiFetch(
        `${BASE}/spreadsheets/${params.spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`,
        token,
        {
          method: 'POST',
          body: JSON.stringify({
            values: params.values,
          }),
        }
      )
      return res.json()
    }
    default:
      throw new Error(`Acción de Sheets no soportada: ${action}`)
  }
}

// ═══════════════════════════════════════════
// GMAIL
// ═══════════════════════════════════════════

/** Encode a header value with RFC 2047 if it contains non-ASCII chars */
function encodeRfc2047(value: string): string {
  // If all ASCII, no encoding needed
  if (/^[\x00-\x7F]*$/.test(value)) return value
  // Use UTF-8 Base64 encoding per RFC 2047
  const encoded = Buffer.from(value, 'utf-8').toString('base64')
  return `=?UTF-8?B?${encoded}?=`
}

/** Build RFC 2822 email message and encode as base64url for Gmail API */
function buildRawEmail(opts: {
  from: string
  to: string
  subject: string
  body: string
  htmlBody?: string
  cc?: string
  bcc?: string
  replyToMessageId?: string
}): string {
  const lines: string[] = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: ${encodeRfc2047(opts.subject)}`,
    'MIME-Version: 1.0',
  ]
  if (opts.cc) lines.push(`Cc: ${opts.cc}`)
  if (opts.bcc) lines.push(`Bcc: ${opts.bcc}`)
  if (opts.replyToMessageId) {
    lines.push(`In-Reply-To: ${opts.replyToMessageId}`)
    lines.push(`References: ${opts.replyToMessageId}`)
  }

  if (opts.htmlBody) {
    const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`
    lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`)
    lines.push('', `--${boundary}`)
    lines.push('Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', Buffer.from(opts.body, 'utf-8').toString('base64'))
    lines.push('', `--${boundary}`)
    lines.push('Content-Type: text/html; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', Buffer.from(opts.htmlBody, 'utf-8').toString('base64'))
    lines.push('', `--${boundary}--`)
  } else {
    lines.push('Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', Buffer.from(opts.body, 'utf-8').toString('base64'))
  }

  return Buffer.from(lines.join('\r\n')).toString('base64url')
}

/** Get the user's brand/display name for email From header */
async function getSenderDisplayName(userId: string): Promise<string | null> {
  // 1. Try active workspace name (brand name)
  const workspace = await prisma.workspace.findFirst({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    select: { name: true },
  })
  if (workspace?.name) return workspace.name

  // 2. Fallback to user's profile name
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  })
  return user?.name || null
}

async function handleGmail(action: string, params: any, token: string, userId?: string) {
  const BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'
  switch (action) {
    case 'list_messages':
    case 'list_emails': {
      const maxResults = params.maxResults || 5
      const q = params.query || ''
      let url = `${BASE}/messages?maxResults=${maxResults}`
      if (q) url += `&q=${encodeURIComponent(q)}`
      
      const listRes = await googleApiFetch(url, token)
      const listData = await listRes.json()
      const messages = listData.messages || []
      
      // Obtener detalles de cada mensaje
      const detailed: any[] = []
      for (const msg of messages.slice(0, maxResults)) {
        const msgRes = await googleApiFetch(
          `${BASE}/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          token
        )
        if (msgRes.ok) {
          const msgData = await msgRes.json()
          const headers = msgData.payload?.headers || []
          detailed.push({
            id: msg.id,
            subject: headers.find((h: Record<string, string>) => h.name === 'Subject')?.value || 'Sin asunto',
            from: headers.find((h: Record<string, string>) => h.name === 'From')?.value || '',
            date: headers.find((h: Record<string, string>) => h.name === 'Date')?.value || '',
            snippet: msgData.snippet || '',
          })
        }
      }
      return { messages: detailed, totalCount: listData.resultSizeEstimate || 0 }
    }
    case 'get_message': {
      const res = await googleApiFetch(
        `${BASE}/messages/${params.messageId}?format=full`,
        token
      )
      return res.json()
    }
    case 'list_labels': {
      const res = await googleApiFetch(`${BASE}/labels`, token)
      return res.json()
    }

    // ─── SEND EMAIL ─────────────────────────────────────────
    case 'send_email': {
      if (!params.to || !params.subject || !params.body) {
        throw new Error('Parámetros requeridos: to, subject, body')
      }
      // Get sender email from profile
      const profileRes = await googleApiFetch(`${BASE}/profile`, token)
      const profile = await profileRes.json()
      const senderEmail = profile.emailAddress
      // Get brand/display name for From header
      const displayName = userId ? await getSenderDisplayName(userId) : null
      const from = displayName
        ? `${encodeRfc2047(displayName.replace(/"/g, ''))} <${senderEmail}>`
        : senderEmail

      const raw = buildRawEmail({
        from,
        to: params.to,
        subject: params.subject,
        body: params.body,
        htmlBody: params.htmlBody,
        cc: params.cc,
        bcc: params.bcc,
      })

      const payload: Record<string, string> = { raw }
      if (params.threadId) payload.threadId = params.threadId

      const sendRes = await googleApiFetch(`${BASE}/messages/send`, token, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (!sendRes.ok) {
        const errText = await sendRes.text()
        throw new Error(`Gmail send failed: ${sendRes.status} — ${errText}`)
      }
      const result = await sendRes.json()
      return {
        sent: true,
        messageId: result.id,
        threadId: result.threadId,
        to: params.to,
        subject: params.subject,
      }
    }

    // ─── CREATE DRAFT ───────────────────────────────────────
    case 'create_draft': {
      if (!params.to || !params.subject || !params.body) {
        throw new Error('Parámetros requeridos: to, subject, body')
      }
      const draftProfileRes = await googleApiFetch(`${BASE}/profile`, token)
      const draftProfile = await draftProfileRes.json()
      const draftDisplayName = userId ? await getSenderDisplayName(userId) : null
      const draftFrom = draftDisplayName
        ? `${encodeRfc2047(draftDisplayName.replace(/"/g, ''))} <${draftProfile.emailAddress}>`
        : draftProfile.emailAddress

      const draftRaw = buildRawEmail({
        from: draftFrom,
        to: params.to,
        subject: params.subject,
        body: params.body,
        htmlBody: params.htmlBody,
        cc: params.cc,
        bcc: params.bcc,
      })

      const draftRes = await googleApiFetch(`${BASE}/drafts`, token, {
        method: 'POST',
        body: JSON.stringify({
          message: { raw: draftRaw, threadId: params.threadId || undefined },
        }),
      })
      if (!draftRes.ok) {
        const errText = await draftRes.text()
        throw new Error(`Gmail draft failed: ${draftRes.status} — ${errText}`)
      }
      const draft = await draftRes.json()
      return {
        drafted: true,
        draftId: draft.id,
        to: params.to,
        subject: params.subject,
        message: 'Borrador creado. Revísalo en Gmail antes de enviar.',
      }
    }

    // ─── REPLY TO MESSAGE ───────────────────────────────────
    case 'reply': {
      if (!params.messageId || !params.body) {
        throw new Error('Parámetros requeridos: messageId, body')
      }
      // Fetch original message to get threadId, subject, and sender
      const origRes = await googleApiFetch(
        `${BASE}/messages/${params.messageId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Message-ID`,
        token
      )
      if (!origRes.ok) throw new Error('No se pudo obtener el mensaje original')
      const origData = await origRes.json()
      const origHeaders = origData.payload?.headers || []
      const origFrom = origHeaders.find((h: any) => h.name === 'From')?.value || ''
      const origSubject = origHeaders.find((h: any) => h.name === 'Subject')?.value || ''
      const origMsgId = origHeaders.find((h: any) => h.name === 'Message-ID')?.value || ''

      const replyProfileRes = await googleApiFetch(`${BASE}/profile`, token)
      const replyProfile = await replyProfileRes.json()

      // Extract email from "Name <email>" format
      const replyTo = origFrom.match(/<(.+)>/)?.[1] || origFrom
      const replySubject = origSubject.startsWith('Re:') ? origSubject : `Re: ${origSubject}`

      const replyDisplayName = userId ? await getSenderDisplayName(userId) : null
      const replyFrom = replyDisplayName
        ? `${encodeRfc2047(replyDisplayName.replace(/"/g, ''))} <${replyProfile.emailAddress}>`
        : replyProfile.emailAddress

      const replyRaw = buildRawEmail({
        from: replyFrom,
        to: replyTo,
        subject: replySubject,
        body: params.body,
        htmlBody: params.htmlBody,
        replyToMessageId: origMsgId,
      })

      const replyPayload: Record<string, string> = {
        raw: replyRaw,
        threadId: origData.threadId,
      }

      const replySendRes = await googleApiFetch(`${BASE}/messages/send`, token, {
        method: 'POST',
        body: JSON.stringify(replyPayload),
      })
      if (!replySendRes.ok) {
        const errText = await replySendRes.text()
        throw new Error(`Gmail reply failed: ${replySendRes.status} — ${errText}`)
      }
      const replyResult = await replySendRes.json()
      return {
        sent: true,
        isReply: true,
        messageId: replyResult.id,
        threadId: replyResult.threadId,
        to: replyTo,
        subject: replySubject,
      }
    }

    // ─── SEARCH MESSAGES ────────────────────────────────────
    case 'search': {
      const maxResults = params.maxResults || 10
      const q = params.query || ''
      if (!q) throw new Error('Parámetro requerido: query')
      const searchUrl = `${BASE}/messages?maxResults=${maxResults}&q=${encodeURIComponent(q)}`
      const searchListRes = await googleApiFetch(searchUrl, token)
      const searchListData = await searchListRes.json()
      const searchMessages = searchListData.messages || []

      const searchDetailed: any[] = []
      for (const msg of searchMessages.slice(0, maxResults)) {
        const msgRes = await googleApiFetch(
          `${BASE}/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`,
          token
        )
        if (msgRes.ok) {
          const msgData = await msgRes.json()
          const headers = msgData.payload?.headers || []
          searchDetailed.push({
            id: msg.id,
            threadId: msgData.threadId,
            subject: headers.find((h: any) => h.name === 'Subject')?.value || 'Sin asunto',
            from: headers.find((h: any) => h.name === 'From')?.value || '',
            to: headers.find((h: any) => h.name === 'To')?.value || '',
            date: headers.find((h: any) => h.name === 'Date')?.value || '',
            snippet: msgData.snippet || '',
            labelIds: msgData.labelIds || [],
          })
        }
      }
      return { messages: searchDetailed, query: q, totalEstimate: searchListData.resultSizeEstimate || 0 }
    }

    default:
      throw new Error(`Acción de Gmail no soportada: ${action}`)
  }
}
