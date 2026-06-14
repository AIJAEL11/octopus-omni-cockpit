// Telegram Bot API - Utilidades para OCTOPUS

const TELEGRAM_API = 'https://api.telegram.org/bot'
const TELEGRAM_FILE_API = 'https://api.telegram.org/file/bot'

export interface TelegramVoice {
  file_id: string
  file_unique_id: string
  duration: number
  mime_type?: string
  file_size?: number
}

export interface TelegramMessage {
  message_id: number
  from?: {
    id: number
    first_name: string
    username?: string
  }
  chat: {
    id: number
    type: string
  }
  date: number
  text?: string
  voice?: TelegramVoice
}

export interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
}

// Enviar mensaje de texto
export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
  options?: { parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2'; disable_notification?: boolean }
): Promise<{ ok: boolean; description?: string }> {
  const res = await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: options?.parse_mode || 'HTML',
      disable_notification: options?.disable_notification || false,
    }),
  })
  return res.json()
}

// Obtener info del bot
export async function getBotInfo(botToken: string): Promise<{ ok: boolean; result?: { id: number; first_name: string; username: string } }> {
  const res = await fetch(`${TELEGRAM_API}${botToken}/getMe`)
  return res.json()
}

// Configurar webhook
export async function setWebhook(
  botToken: string,
  webhookUrl: string
): Promise<{ ok: boolean; description?: string }> {
  const res = await fetch(`${TELEGRAM_API}${botToken}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl }),
  })
  return res.json()
}

// Eliminar webhook
export async function deleteWebhook(botToken: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${TELEGRAM_API}${botToken}/deleteWebhook`)
  return res.json()
}

// Obtener info del webhook
export async function getWebhookInfo(botToken: string): Promise<{ ok: boolean; result?: { url: string; pending_update_count: number } }> {
  const res = await fetch(`${TELEGRAM_API}${botToken}/getWebhookInfo`)
  return res.json()
}

// Formatear mensaje de notificación OCTOPUS
export function formatOctopusNotification(
  type: 'info' | 'success' | 'warning' | 'error' | 'activity',
  title: string,
  details?: string
): string {
  const icons = {
    info: '\u2139\ufe0f',
    success: '\u2705',
    warning: '\u26a0\ufe0f',
    error: '\u274c',
    activity: '\ud83d\udc19',
  }
  const icon = icons[type] || '\ud83d\udc19'
  let msg = `${icon} <b>${title}</b>`
  if (details) msg += `\n\n${details}`
  msg += `\n\n<i>— OCTOPUS Omni Cockpit</i>`
  return msg
}

// Comandos disponibles del bot
export const BOT_COMMANDS = [
  { command: '/start', description: 'Iniciar conexi\u00f3n con OCTOPUS' },
  { command: '/status', description: 'Ver estado del sistema' },
  { command: '/proyectos', description: 'Listar mis proyectos' },
  { command: '/brazos', description: 'Ver brazos conectados' },
  { command: '/salud', description: 'Diagnóstico de brazos y conexiones' },
  { command: '/help', description: 'Ver comandos disponibles' },
  { command: '/notify', description: 'Activar/desactivar notificaciones' },
] as const

// Registrar comandos en Telegram
export async function registerBotCommands(botToken: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${TELEGRAM_API}${botToken}/setMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commands: BOT_COMMANDS }),
  })
  return res.json()
}

// ============================================
// FUNCIONES DE VOZ
// ============================================

// Obtener URL de descarga de un archivo de Telegram
export async function getFileUrl(
  botToken: string,
  fileId: string
): Promise<string | null> {
  try {
    const res = await fetch(`${TELEGRAM_API}${botToken}/getFile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: fileId }),
    })
    const data = await res.json()
    if (data.ok && data.result?.file_path) {
      return `${TELEGRAM_FILE_API}${botToken}/${data.result.file_path}`
    }
    console.error('[Telegram] getFile error:', data)
    return null
  } catch (err) {
    console.error('[Telegram] getFile exception:', err)
    return null
  }
}

// Descargar archivo como Buffer
export async function downloadTelegramFile(
  botToken: string,
  fileId: string
): Promise<Buffer | null> {
  const url = await getFileUrl(botToken, fileId)
  if (!url) return null

  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.error('[Telegram] Download error:', res.status)
      return null
    }
    const arrayBuffer = await res.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (err) {
    console.error('[Telegram] Download exception:', err)
    return null
  }
}

// Enviar audio como nota de voz (sendVoice espera OGG, usamos sendAudio para MP3)
export async function sendAudioMessage(
  botToken: string,
  chatId: string,
  audioBuffer: Buffer,
  options?: { title?: string; filename?: string }
): Promise<{ ok: boolean; description?: string }> {
  const boundary = '----OctopusBoundary' + Date.now()
  const filename = options?.filename || 'voice.mp3'
  const title = options?.title || 'OCTOPUS'

  // Construir multipart/form-data manualmente
  const parts: Buffer[] = []

  // chat_id
  parts.push(Buffer.from(
    '--' + boundary + '\r\n'
    + 'Content-Disposition: form-data; name="chat_id"\r\n\r\n'
    + chatId + '\r\n'
  ))

  // title
  parts.push(Buffer.from(
    '--' + boundary + '\r\n'
    + 'Content-Disposition: form-data; name="title"\r\n\r\n'
    + title + '\r\n'
  ))

  // audio file
  parts.push(Buffer.from(
    '--' + boundary + '\r\n'
    + 'Content-Disposition: form-data; name="audio"; filename="' + filename + '"\r\n'
    + 'Content-Type: audio/mpeg\r\n\r\n'
  ))
  parts.push(audioBuffer)
  parts.push(Buffer.from('\r\n'))

  // cierre
  parts.push(Buffer.from('--' + boundary + '--\r\n'))

  const body = Buffer.concat(parts)

  try {
    const res = await fetch(`${TELEGRAM_API}${botToken}/sendAudio`, {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': String(body.length),
      },
      body: body,
    })
    const data = await res.json()
    if (!data.ok) {
      console.error('[Telegram] sendAudio error:', data)
    }
    return data
  } catch (err) {
    console.error('[Telegram] sendAudio exception:', err)
    return { ok: false, description: 'Exception sending audio' }
  }
}

// Enviar nota de voz OGG (sendVoice)
export async function sendVoiceMessage(
  botToken: string,
  chatId: string,
  oggBuffer: Buffer
): Promise<{ ok: boolean; description?: string }> {
  const boundary = '----OctopusBoundary' + Date.now()

  const parts: Buffer[] = []

  parts.push(Buffer.from(
    '--' + boundary + '\r\n'
    + 'Content-Disposition: form-data; name="chat_id"\r\n\r\n'
    + chatId + '\r\n'
  ))

  parts.push(Buffer.from(
    '--' + boundary + '\r\n'
    + 'Content-Disposition: form-data; name="voice"; filename="voice.ogg"\r\n'
    + 'Content-Type: audio/ogg\r\n\r\n'
  ))
  parts.push(oggBuffer)
  parts.push(Buffer.from('\r\n'))

  parts.push(Buffer.from('--' + boundary + '--\r\n'))

  const body = Buffer.concat(parts)

  try {
    const res = await fetch(`${TELEGRAM_API}${botToken}/sendVoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': String(body.length),
      },
      body: body,
    })
    const data = await res.json()
    if (!data.ok) {
      console.error('[Telegram] sendVoice error:', data)
    }
    return data
  } catch (err) {
    console.error('[Telegram] sendVoice exception:', err)
    return { ok: false, description: 'Exception sending voice' }
  }
}
