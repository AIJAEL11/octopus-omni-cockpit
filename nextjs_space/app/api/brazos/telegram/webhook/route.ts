import { callLLM } from '@/lib/turbo-llm'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  sendTelegramMessage,
  formatOctopusNotification,
  getFileUrl,
  sendAudioMessage,
  type TelegramUpdate,
} from '@/lib/telegram'
import { transcribeAudioFromUrl } from '@/lib/speech'
import { generateTTSAudio } from '@/lib/tts-util'
import { detectIoTIntent, detectBrazosIntent } from '@/lib/jarvis-chat'

export const dynamic = 'force-dynamic'

// Handle IoT commands from Telegram messages
async function handleIoTCommand(text: string, userId: string): Promise<string | null> {
  const iotIntent = detectIoTIntent(text)
  if (!iotIntent.detected) return null

  try {
    // Setup guide — always handle, even without devices
    if (iotIntent.action === 'setup') {
      const appUrl = process.env.NEXTAUTH_URL || 'https://octopus-omni-cockpit-n8hd61.abacusai.app'
      return formatOctopusNotification('info', '🐙🏠 Guía — Hogar Inteligente',
        '<b>¡Vamos a conectar tu casa!</b> Sigue estos pasos:\n\n'
        + '<b>📋 Lo que necesitas:</b>\n'
        + '💡 Bombilla WiZ Connected (Philips) ~$10-15 USD\n'
        + '💻 PC con Node.js 18+ (Windows/Mac/Linux)\n'
        + '📶 Red WiFi (misma red que tus dispositivos)\n\n'
        + '<b>Paso 1: 📱 Configura tu bombilla WiZ</b>\n'
        + '1. Descarga la app WiZ:\n'
        + '   iOS: https://apps.apple.com/app/id1587655962\n'
        + '   Android: https://play.google.com/store/apps/details?id=com.wizconnected.wiz2\n'
        + '2. Crea una cuenta y agrega tu bombilla\n'
        + '3. Ponle nombre y asígnala a una habitación\n\n'
        + '<b>Paso 2: 🔑 Obtén tu Token</b>\n'
        + '1. Ve a Hogar Inteligente en OCTOPUS:\n'
        + `   ${appUrl}/dashboard/hogar\n`
        + '2. Clic en "Configuración / Bridge"\n'
        + '3. Genera tu Token de Bridge\n\n'
        + '<b>Paso 3: ⬇️ Descarga el Bridge</b>\n'
        + '1. En la misma sección, descarga octopus-bridge.js\n'
        + '2. Guárdalo en una carpeta de tu PC\n\n'
        + '<b>Paso 4: 🚀 Ejecuta el Bridge</b>\n'
        + 'Abre PowerShell (Win) o Terminal (Mac/Linux):\n\n'
        + '<code>cd "ruta/del/archivo"</code>\n\n'
        + '<b>Windows:</b>\n'
        + '<code>$env:BRIDGE_TOKEN="tu_token"</code>\n'
        + '<code>node octopus-bridge.js</code>\n\n'
        + '<b>Mac/Linux:</b>\n'
        + '<code>BRIDGE_TOKEN=tu_token node octopus-bridge.js</code>\n\n'
        + '<b>Paso 5: ✅ Verifica</b>\n'
        + 'Deberías ver:\n'
        + '🐙 Bridge conectado y escuchando comandos...\n'
        + '💡 Encontrado: TuBombilla @ 192.168.x.x\n\n'
        + '<b>Paso 6: 🎉 ¡Prueba!</b>\n'
        + 'Escríbeme aquí mismo:\n'
        + '• "enciende la luz del playroom"\n'
        + '• "apaga la bombilla"\n'
        + '• "brillo 50"\n'
        + '• "luz cálida"\n\n'
        + '💡 <b>Tip:</b> El bridge debe estar corriendo en tu PC. Si cierras la terminal, el control se detiene.'
      )
    }

    const devices = await prisma.smartDevice.findMany({ where: { userId } })
    if (devices.length === 0) {
      // No devices — suggest setup
      return formatOctopusNotification('info', '🏠 Sin dispositivos',
        'No tienes dispositivos configurados aún.\n\n'
        + '¿Quieres configurar tu hogar inteligente? Escríbeme:\n'
        + '<b>"cómo configuro mi hogar inteligente"</b>\n\n'
        + 'Te guío paso a paso. 🐙'
      )
    }

    if (iotIntent.action === 'status') {
      const onDevs = devices.filter(d => (d.lastState as Record<string, unknown>)?.on)
      if (onDevs.length === 0) {
        return formatOctopusNotification('info', '🏠 Hogar', 'Todo apagado. Tu hogar está en modo ahorro. 💤')
      }
      const list = devices.map(d => {
        const state = d.lastState as Record<string, unknown>
        const icon = state?.on ? '🟢' : '⚫'
        return `${icon} <b>${d.name}</b>${d.room ? ` (${d.room})` : ''}`
      }).join('\n')
      return formatOctopusNotification('info', '🏠 Estado del Hogar', list)
    }

    if (iotIntent.action === 'all_off') {
      const onDevs = devices.filter(d => (d.lastState as Record<string, unknown>)?.on)
      if (onDevs.length === 0) {
        return formatOctopusNotification('info', '🏠 Hogar', 'Todo ya está apagado. 💤')
      }
      for (const d of onDevs) {
        await prisma.smartCommand.create({
          data: { userId, deviceId: d.id, action: 'off', status: 'pending' },
        })
        await prisma.smartDevice.update({
          where: { id: d.id },
          data: { lastState: { ...(d.lastState as object || {}), on: false } },
        })
      }
      const list = onDevs.map(d => `✅ ${d.name}`).join('\n')
      return formatOctopusNotification('success', '🏠 Todo Apagado', `${onDevs.length} dispositivo(s) apagado(s):\n${list}`)
    }

    if (iotIntent.action === 'on' || iotIntent.action === 'off' || iotIntent.action === 'brightness' || iotIntent.action === 'colorTemp') {
      const target = (iotIntent.target || '').toLowerCase()
      const targetWords = target.split(/\s+/).filter(w => !['del', 'de', 'la', 'el', 'en', 'los', 'las', 'un', 'una'].includes(w))
      
      // Fuzzy device matching (same logic as Jarvis page)
      const match = devices.length === 1 && !target ? devices[0] : devices.find(d => {
        const nameWords = d.name.toLowerCase().split(/\s+/)
        const roomWords = (d.room || '').toLowerCase().split(/\s+/)
        const allDevWords = [...nameWords, ...roomWords]
        if (d.name.toLowerCase().includes(target)) return true
        if (d.room?.toLowerCase().includes(target)) return true
        const hasWordMatch = targetWords.some(tw => allDevWords.some(dw => dw.includes(tw) || tw.includes(dw)))
        if (hasWordMatch) return true
        const synonyms: Record<string, string[]> = {
          'luz': ['light', 'bombilla', 'bombillo', 'foco', 'led', 'bulb'],
          'bombilla': ['luz', 'light', 'bombillo', 'foco', 'led', 'bulb'],
          'bombillo': ['luz', 'light', 'bombilla', 'foco', 'led', 'bulb'],
          'light': ['luz', 'bombilla', 'bombillo', 'foco', 'led'],
          'enchufe': ['plug', 'outlet', 'tomacorriente', 'toma', 'contacto'],
          'plug': ['enchufe', 'outlet', 'tomacorriente', 'toma'],
          'outlet': ['enchufe', 'plug', 'tomacorriente'],
        }
        const expanded = targetWords.flatMap(tw => [tw, ...(synonyms[tw] || [])])
        return expanded.some(tw => allDevWords.some(dw => dw.includes(tw) || tw.includes(dw)))
          || (targetWords.some(tw => ['luz', 'bombilla', 'bombillo', 'foco', 'light', 'bulb'].includes(tw)) && (d.type === 'light' || d.type === 'relay'))
          || (targetWords.some(tw => ['enchufe', 'plug', 'outlet', 'tomacorriente', 'toma'].includes(tw)) && d.type === 'plug')
      })

      if (!match) {
        const devList = devices.map(d => `<b>${d.name}</b>${d.room ? ` (${d.room})` : ''}`).join(', ')
        return formatOctopusNotification('warning', '🤔 Dispositivo', `No encontré "${iotIntent.target}". Tus dispositivos: ${devList}`)
      }

      const controlAction = iotIntent.action
      const isHubSpaceDevice = match.platform === 'hubspace'

      if (isHubSpaceDevice && match.externalId && ['on', 'off'].includes(controlAction)) {
        // HubSpace: direct cloud control
        try {
          const { hubspaceControlDevice } = await import('@/lib/hubspace')
          const hsCreds = await prisma.apiKey.findFirst({ where: { userId, serviceType: 'hubspace' } })
          if (hsCreds) {
            const currentOn = !!((match.lastState as Record<string, unknown>)?.on)
            await hubspaceControlDevice(hsCreds.name, hsCreds.apiKey, match.externalId, controlAction as 'on' | 'off', currentOn)
          }
          await prisma.smartCommand.create({
            data: { userId, deviceId: match.id, action: controlAction, params: iotIntent.params ? JSON.parse(JSON.stringify(iotIntent.params)) : null, status: 'completed', result: { hubspace: true } },
          })
        } catch (hsErr) {
          console.error('[Telegram HubSpace] control error:', hsErr)
          await prisma.smartCommand.create({
            data: { userId, deviceId: match.id, action: controlAction, params: undefined, status: 'failed', result: { error: String(hsErr) } },
          })
        }
      } else {
        // WiZ: queue for bridge
        await prisma.smartCommand.create({
          data: { userId, deviceId: match.id, action: controlAction, params: iotIntent.params ? JSON.parse(JSON.stringify(iotIntent.params)) : null, status: 'pending' },
        })
      }

      // Optimistic state update
      const currentState = (match.lastState as Record<string, unknown>) || {}
      const newState = { ...currentState }
      if (controlAction === 'on') newState.on = true
      else if (controlAction === 'off') newState.on = false
      else if (controlAction === 'brightness' && iotIntent.params?.brightness) {
        newState.brightness = iotIntent.params.brightness
        newState.dimming = iotIntent.params.brightness
        newState.on = true
      } else if (controlAction === 'colorTemp' && iotIntent.params?.colorTemp) {
        newState.colorTemp = iotIntent.params.colorTemp
        newState.temp = iotIntent.params.colorTemp
        newState.on = true
      }
      await prisma.smartDevice.update({
        where: { id: match.id },
        data: {
          lastState: JSON.parse(JSON.stringify(newState)),
          ...(iotIntent.params?.brightness !== undefined && { brightness: Number(iotIntent.params.brightness) }),
          ...(iotIntent.params?.colorTemp !== undefined && { colorTemp: Number(iotIntent.params.colorTemp) }),
        },
      })

      if (controlAction === 'brightness') {
        return formatOctopusNotification('success', '🔆 Brillo', `<b>${match.name}</b> — brillo al ${iotIntent.params?.brightness}%`)
      } else if (controlAction === 'colorTemp') {
        const tv = iotIntent.params?.colorTemp as number
        const label = tv <= 3000 ? 'cálida ☀️' : tv >= 5000 ? 'fría ❄️' : 'neutra 🌤️'
        return formatOctopusNotification('success', '🌡️ Temperatura', `<b>${match.name}</b> — ${label} (${tv}K)`)
      } else {
        const emoji = controlAction === 'on' ? '💡' : '🔌'
        const past = controlAction === 'on' ? 'encendido' : 'apagado'
        return formatOctopusNotification('success', `${emoji} ${match.name}`, `${past} correctamente. 🐙🏠`)
      }
    }
  } catch (error) {
    console.error('[Telegram IoT] Error:', error)
    return formatOctopusNotification('error', '⚠️ Error', 'Hubo un problema al controlar el dispositivo.')
  }

  return null
}

// Obtener respuesta de IA via LLM (uses callLLM with null userId — webhook context)
async function getAIResponse(userText: string): Promise<string> {
  try {
    const data = await callLLM(null, [
      {
        role: 'system',
        content: 'Eres OCTOPUS, un asistente de IA creativo y amigable que responde por Telegram. '
          + 'Respondes en espanol, eres util, breve y con personalidad. Tu creador es Rafael. '
          + 'Usa emojis. Tus respuestas deben ser cortas (maximo 300 chars) porque es Telegram.',
      },
      { role: 'user', content: userText },
    ], { model: 'gpt-4.1-mini', temperature: 0.8, maxTokens: 200 })
    return data.choices?.[0]?.message?.content || 'Hmm, no pude procesar eso.'
  } catch {
    return 'Estoy aqui, pero tuve un pequeno error. Intentalo otra vez!'
  }
}

// POST - Recibir mensajes de Telegram (webhook)
export async function POST(request: NextRequest) {
  try {
    const update: TelegramUpdate = await request.json()
    const message = update.message

    if (!message?.chat?.id) {
      return NextResponse.json({ ok: true })
    }

    const chatId = String(message.chat.id)
    const username = message.from?.username || message.from?.first_name || 'Usuario'
    const hasText = !!message.text?.trim()
    const hasVoice = !!message.voice

    // Si no tiene texto ni voz, ignorar
    if (!hasText && !hasVoice) {
      return NextResponse.json({ ok: true })
    }

    // Buscar la conexion de Telegram por chatId
    const connections = await prisma.armConnection.findMany({
      where: { armType: 'telegram', status: 'connected' },
    })

    const connection = connections.find(c => {
      try {
        const creds = JSON.parse(c.credentials)
        return creds.chatId === chatId
      } catch { return false }
    })

    if (!connection) {
      return NextResponse.json({ ok: true })
    }

    const creds = JSON.parse(connection.credentials)
    const botToken = creds.botToken
    const userId = connection.userId

    // ============================================
    // MENSAJE DE VOZ
    // ============================================
    if (hasVoice && message.voice) {
      console.log('[Telegram Webhook] Voice message received, duration:', message.voice.duration, 's')

      // 1. Obtener URL del archivo de audio OGG
      const oggUrl = await getFileUrl(botToken, message.voice.file_id)
      if (!oggUrl) {
        await sendTelegramMessage(botToken, chatId, 'No pude descargar tu mensaje de voz. Intentalo de nuevo.')
        return NextResponse.json({ ok: true })
      }

      console.log('[Telegram Webhook] Audio URL obtained:', oggUrl.slice(0, 60) + '...')

      // 2. Convertir OGG a MP3 y transcribir con LLM
      const transcript = await transcribeAudioFromUrl(oggUrl)
      if (!transcript) {
        await sendTelegramMessage(botToken, chatId, 'No pude entender tu mensaje de voz. Intenta hablar mas claro o envia texto.')
        return NextResponse.json({ ok: true })
      }

      console.log('[Telegram Webhook] Transcribed:', transcript.slice(0, 80))

      // 3. Enviar confirmacion de lo que escucho
      await sendTelegramMessage(botToken, chatId, '\uD83C\uDFA4 <i>Escuche: "' + transcript.slice(0, 200) + '"</i>', { parse_mode: 'HTML' })

      // 4. Check for IoT / Brazos / special intents BEFORE falling back to generic AI
      let voiceReply = ''

      // 4a. Check Brazos health intent
      const voiceBrazosIntent = detectBrazosIntent(transcript)
      if (voiceBrazosIntent.detected) {
        try {
          const allConns = await prisma.armConnection.findMany({ where: { userId } })
          if (allConns.length === 0) {
            voiceReply = formatOctopusNotification('info', 'Diagnostico de Brazos', 'No tienes brazos conectados.')
          } else {
            let details = '<b>Estado de tus brazos:</b>\n\n'
            for (const conn of allConns) {
              const icon = conn.status === 'connected' ? '✅' : '❌'
              details += `${icon} <b>${conn.name}</b> — ${conn.status === 'connected' ? 'Conectado' : 'Desconectado'}\n`
            }
            voiceReply = formatOctopusNotification('info', 'Diagnostico de Brazos', details)
          }
        } catch {
          voiceReply = formatOctopusNotification('error', 'Error', 'No se pudo ejecutar el diagnostico.')
        }
      }

      // 4b. Check IoT / Hogar Inteligente intent
      if (!voiceReply) {
        const voiceIoTReply = await handleIoTCommand(transcript, userId)
        if (voiceIoTReply) {
          voiceReply = voiceIoTReply
        }
      }

      // 4c. Fallback to generic AI
      if (!voiceReply) {
        voiceReply = await getAIResponse(transcript)
      }

      // 5. Enviar respuesta como texto
      await sendTelegramMessage(botToken, chatId, voiceReply)

      // 6. Generar y enviar respuesta como audio
      try {
        const ttsBuffer = await generateTTSAudio(voiceReply)
        if (ttsBuffer && ttsBuffer.length > 0) {
          await sendAudioMessage(botToken, chatId, ttsBuffer, { title: 'OCTOPUS responde' })
          console.log('[Telegram Webhook] Voice response sent, size:', ttsBuffer.length)
        }
      } catch (ttsErr) {
        console.error('[Telegram Webhook] TTS error (non-critical):', ttsErr)
        // No falla - ya envio texto
      }

      return NextResponse.json({ ok: true })
    }

    // ============================================
    // MENSAJE DE TEXTO
    // ============================================
    const text = (message.text || '').trim()
    const command = text.split(' ')[0].toLowerCase()
    let response = ''

    switch (command) {
      case '/start':
        response = formatOctopusNotification(
          'success',
          'Hola ' + username + '!',
          'OCTOPUS Omni Cockpit conectado a Telegram.\n\n'
          + 'Ahora recibiras notificaciones y podras controlar tu cockpit desde aqui.\n\n'
          + 'Puedes enviarme mensajes de <b>texto</b> o <b>notas de voz</b> y te respondere.\n\n'
          + '<b>Comandos disponibles:</b>\n'
          + '/status - Estado del sistema\n'
          + '/proyectos - Tus proyectos\n'
          + '/brazos - Brazos conectados\n'
          + '/help - Ayuda'
        )
        break

      case '/status': {
        const user = await prisma.user.findUnique({ where: { id: userId } })
        const projectCount = await prisma.project.count({ where: { userId } })
        const armCount = await prisma.armConnection.count({ where: { userId, status: 'connected' } })

        response = formatOctopusNotification(
          'info',
          'Estado del Sistema',
          '<b>Usuario:</b> ' + (user?.name || user?.email || 'Desconocido') + '\n'
          + '<b>Proyectos:</b> ' + projectCount + '\n'
          + '<b>Brazos conectados:</b> ' + armCount + '\n'
          + '<b>Turbo:</b> ' + (user?.turboEnabled ? 'Activado' : 'Desactivado') + '\n'
          + '<b>Plataforma:</b> OCTOPUS Omni Cockpit\n'
          + '<b>Estado:</b> Operativo'
        )
        break
      }

      case '/proyectos': {
        const projects = await prisma.project.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 10,
        })

        if (projects.length === 0) {
          response = formatOctopusNotification('info', 'Proyectos', 'No tienes proyectos aun. Crea uno desde el Estudio Creativo!')
        } else {
          const list = projects.map((p, i) => {
            const statusIcon = p.status === 'completed' ? '[OK]' : p.status === 'building' ? '[...]' : '[||]'
            return (i + 1) + '. ' + statusIcon + ' <b>' + p.name + '</b> - ' + p.progress + '%'
          }).join('\n')
          response = formatOctopusNotification('info', 'Proyectos (' + projects.length + ')', list)
        }
        break
      }

      case '/brazos': {
        const arms = await prisma.armConnection.findMany({
          where: { userId, status: 'connected' },
        })

        if (arms.length === 0) {
          response = formatOctopusNotification('info', 'Brazos', 'No tienes brazos conectados.')
        } else {
          const list = arms.map(a => '<b>' + a.name + '</b> (' + a.armType + ')').join('\n')
          response = formatOctopusNotification('info', 'Brazos Conectados (' + arms.length + ')', list)
        }
        break
      }

      case '/salud': {
        // Health check de brazos
        try {
          // Direct DB check from webhook context (no session needed)
          const allConnections = await prisma.armConnection.findMany({
            where: { userId },
          })

          if (allConnections.length === 0) {
            response = formatOctopusNotification('info', 'Diagnostico de Brazos', 'No tienes brazos conectados.\n\nVe a <b>Brazos Activos</b> en el dashboard para conectar Telegram, Google, etc.')
          } else {
            let details = ''
            for (const conn of allConnections) {
              const icon = conn.status === 'connected' ? '✅' : '❌'
              details += `${icon} <b>${conn.name}</b> — ${conn.status === 'connected' ? 'Conectado' : 'Desconectado'}\n`
            }
            details += `\n<b>Total:</b> ${allConnections.length} brazos`
            details += '\n\nPara un diagnostico completo, escribe "diagnostico de brazos" o usa el chat de Jarvis.'
            response = formatOctopusNotification('info', 'Diagnostico de Brazos', details)
          }
        } catch {
          response = formatOctopusNotification('error', 'Error', 'No se pudo ejecutar el diagnostico.')
        }
        break
      }

      case '/help':
        response = formatOctopusNotification(
          'info',
          'Comandos OCTOPUS',
          '/start - Iniciar conexion\n'
          + '/status - Estado del sistema\n'
          + '/proyectos - Listar proyectos\n'
          + '/brazos - Ver brazos conectados\n'
          + '/salud - Diagnostico de brazos\n'
          + '/help - Esta ayuda\n\n'
          + 'Tambien puedes escribir mensajes normales o <b>enviar notas de voz</b> y OCTOPUS te respondera con IA.'
        )
        break

      default: {
        // Check for Brazos health/troubleshoot intent
        const brazosIntent = detectBrazosIntent(text)
        if (brazosIntent.detected) {
          try {
            const allConnections = await prisma.armConnection.findMany({
              where: { userId },
            })

            if (allConnections.length === 0) {
              response = formatOctopusNotification('info', 'Diagnostico de Brazos', 'No tienes brazos conectados.\n\nVe a <b>Brazos Activos</b> en el dashboard para conectar servicios.')
            } else {
              let details = '<b>Estado de tus brazos:</b>\n\n'
              for (const conn of allConnections) {
                const icon = conn.status === 'connected' ? '✅' : '❌'
                const statusText = conn.status === 'connected' ? 'Conectado' : 'Desconectado'
                details += `${icon} <b>${conn.name}</b> — ${statusText}\n`

                if (conn.status !== 'connected') {
                  details += `   💡 <i>Solucion: Ve a Brazos Activos y reconecta ${conn.name}</i>\n`
                }
              }

              const disconnected = allConnections.filter(c => c.status !== 'connected')
              if (disconnected.length > 0) {
                details += `\n⚠️ ${disconnected.length} brazo(s) necesitan atencion.`
              } else {
                details += '\n✅ Todos los brazos funcionan correctamente.'
              }

              response = formatOctopusNotification(
                disconnected.length > 0 ? 'warning' : 'success',
                'Diagnostico de Brazos',
                details
              )
            }
          } catch {
            response = formatOctopusNotification('error', 'Error', 'No se pudo ejecutar el diagnostico.')
          }
          break
        }

        // Check for IoT / Hogar Inteligente commands
        const iotResponse = await handleIoTCommand(text, userId)
        if (iotResponse) {
          response = iotResponse
        } else {
          // Mensaje libre - responder con IA
          response = await getAIResponse(text)
        }
        break
      }
    }

    // Enviar respuesta
    if (response) {
      await sendTelegramMessage(botToken, chatId, response)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Telegram Webhook] Error:', error)
    return NextResponse.json({ ok: true }) // Siempre retornar 200 a Telegram
  }
}
