import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hubspaceControlDevice } from '@/lib/hubspace'

export const dynamic = 'force-dynamic'

/**
 * Natural-language wrapper over /api/hogar/control.
 *
 * OCTOPUS (Jarvis) emits IoT actions like:
 *   { action: 'on', deviceName: 'luz del play room', roomName: 'Playroom' }
 *
 * This endpoint:
 *   1. Fuzzy-matches SmartDevice(s) by deviceName and/or roomName for the authenticated user.
 *   2. Calculates the new expected state based on the action.
 *   3. For HubSpace devices, calls the cloud API directly.
 *   4. For WiZ/other devices, queues a SmartCommand for the bridge to pick up.
 *   5. Responds with a friendly Spanish summary of how many devices were affected.
 */

function norm(s?: string | null): string {
  if (!s) return ''
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/\s+/g, ' ')
    .trim()
}

// Returns true if needle is a substring of haystack OR haystack contains all words of needle.
// Also handles space-variant matches like "play room" vs "playroom".
function fuzzyContains(haystack: string, needle: string): boolean {
  if (!needle) return true
  if (!haystack) return false
  const h = norm(haystack)
  const n = norm(needle)
  if (!h || !n) return false
  // Standard substring check
  if (h.includes(n) || n.includes(h)) return true
  // Collapsed-spaces check: "play room" vs "playroom"
  const hCollapsed = h.replace(/\s+/g, '')
  const nCollapsed = n.replace(/\s+/g, '')
  if (hCollapsed && nCollapsed && (hCollapsed.includes(nCollapsed) || nCollapsed.includes(hCollapsed))) {
    return true
  }
  // Word-set check: all non-trivial words of needle appear in haystack
  const hWords = new Set(h.split(' '))
  const nWords = n.split(' ').filter(w => w.length >= 2) // ignore stopword-length tokens
  if (nWords.length === 0) return false
  if (nWords.every(w => hWords.has(w))) return true
  // Pairwise word-collapse fallback (e.g. ["play","room"] vs ["playroom"])
  const hJoined = [...hWords].join('')
  if (nCollapsed && hJoined.includes(nCollapsed)) return true
  return false
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const userId = session.user.id

    const body = await req.json()
    const rawAction: string = (body?.action || 'status').toString().toLowerCase()
    const deviceName: string = (body?.deviceName || body?.target || '').toString()
    const roomName: string = (body?.roomName || '').toString()
    const brightness: number | undefined = body?.brightness !== undefined ? Number(body.brightness) : undefined
    const colorTemp: number | undefined = body?.colorTemp !== undefined ? Number(body.colorTemp) : undefined

    // Normalize action aliases to canonical verbs
    const action = ((): string => {
      const a = rawAction
      if (['on', 'encender', 'enciende', 'prender', 'prende', 'turn_on', 'encendido'].includes(a)) return 'on'
      if (['off', 'apagar', 'apaga', 'turn_off', 'apagado'].includes(a)) return 'off'
      if (['toggle', 'alternar', 'cambiar'].includes(a)) return 'toggle'
      if (['brightness', 'brillo', 'atenuar', 'dim', 'dimmer'].includes(a)) return 'brightness'
      if (['colortemp', 'colortemperatura', 'temperatura', 'color_temp', 'temp'].includes(a)) return 'colorTemp'
      if (['status', 'estado', 'state'].includes(a)) return 'status'
      return a
    })()

    // Load all user devices
    const allDevices = await prisma.smartDevice.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    })

    if (allDevices.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No tienes dispositivos IoT registrados. Agrega uno en /dashboard/hogar.',
      }, { status: 404 })
    }

    // STATUS query — no device lookup needed
    if (action === 'status') {
      const list = allDevices.map(d => `• ${d.name}${d.room ? ` (${d.room})` : ''}: ${(d.lastState as any)?.on ? 'encendido' : 'apagado'}`).join('\n')
      return NextResponse.json({
        success: true,
        message: `📊 Estado de tus dispositivos:\n${list}`,
        devices: allDevices,
      })
    }

    // ======== DEVICE MATCHING ========
    // Try matching by (deviceName + roomName) first, then relax.
    let matches = allDevices.filter(d => {
      const nameMatch = deviceName ? fuzzyContains(d.name, deviceName) : true
      const roomMatch = roomName ? fuzzyContains(d.room || '', roomName) : true
      return nameMatch && roomMatch
    })

    // If no exact match and user gave both name+room, try each independently
    if (matches.length === 0 && (deviceName || roomName)) {
      matches = allDevices.filter(d => {
        if (deviceName && fuzzyContains(d.name, deviceName)) return true
        if (roomName && fuzzyContains(d.room || '', roomName)) return true
        if (deviceName && fuzzyContains(d.room || '', deviceName)) return true
        if (roomName && fuzzyContains(d.name, roomName)) return true
        return false
      })
    }

    // If still no match and no filters provided → apply to ALL devices of type 'light'
    if (matches.length === 0 && !deviceName && !roomName) {
      matches = allDevices.filter(d => d.type === 'light' || d.type === 'plug')
    }

    if (matches.length === 0) {
      const available = allDevices.map(d => `${d.name}${d.room ? ` (${d.room})` : ''}`).join(', ')
      return NextResponse.json({
        success: false,
        error: `No encontré dispositivos que coincidan con "${deviceName || roomName}". Disponibles: ${available}`,
      }, { status: 404 })
    }

    // ======== EXECUTE ACTION ON EACH MATCHING DEVICE ========
    const results: Array<{ device: string; success: boolean; queued?: boolean; error?: string }> = []

    for (const device of matches) {
      try {
        const currentState = (device.lastState as Record<string, unknown>) || {}
        const newState: Record<string, unknown> = { ...currentState }
        let newBrightness = device.brightness
        let newColorTemp = device.colorTemp

        switch (action) {
          case 'on':
            newState.on = true
            break
          case 'off':
            newState.on = false
            break
          case 'toggle':
            newState.on = !currentState.on
            break
          case 'brightness':
            if (brightness !== undefined && !Number.isNaN(brightness)) {
              newBrightness = Math.max(1, Math.min(100, brightness))
              newState.brightness = newBrightness
              newState.dimming = newBrightness
              newState.on = true
            }
            break
          case 'colorTemp':
            if (colorTemp !== undefined && !Number.isNaN(colorTemp)) {
              newColorTemp = Math.max(2200, Math.min(6500, colorTemp))
              newState.colorTemp = newColorTemp
              newState.temp = newColorTemp
            }
            break
          default:
            results.push({ device: device.name, success: false, error: `Acción no soportada: ${action}` })
            continue
        }

        const params: Record<string, unknown> = {}
        if (action === 'brightness' && newBrightness !== null) params.brightness = newBrightness
        if (action === 'colorTemp' && newColorTemp !== null) params.colorTemp = newColorTemp

        if (device.platform === 'hubspace' && device.externalId) {
          // HubSpace direct cloud control
          if (['on', 'off', 'toggle'].includes(action)) {
            try {
              const creds = await prisma.apiKey.findFirst({
                where: { userId, serviceType: 'hubspace' },
              })
              if (!creds) {
                results.push({ device: device.name, success: false, error: 'HubSpace no configurado' })
                continue
              }
              const result = await hubspaceControlDevice(
                creds.name, creds.apiKey, device.externalId,
                action as 'on' | 'off' | 'toggle',
                !!currentState.on
              )
              newState.on = result.newState
              await prisma.smartCommand.create({
                data: {
                  userId,
                  deviceId: device.id,
                  action,
                  params: Object.keys(params).length > 0 ? JSON.parse(JSON.stringify(params)) : null,
                  status: 'completed',
                  result: { hubspace: true, newState: result.newState },
                },
              })
              results.push({ device: device.name, success: true, queued: false })
            } catch (err) {
              const errMsg = err instanceof Error ? err.message : 'HubSpace error'
              results.push({ device: device.name, success: false, error: errMsg })
              continue
            }
          } else {
            results.push({ device: device.name, success: false, error: 'HubSpace solo soporta on/off' })
            continue
          }
        } else {
          // WiZ / other — queue for bridge
          await prisma.smartCommand.create({
            data: {
              userId,
              deviceId: device.id,
              action,
              params: Object.keys(params).length > 0 ? JSON.parse(JSON.stringify(params)) : null,
              status: 'pending',
            },
          })
          results.push({ device: device.name, success: true, queued: true })
        }

        // Optimistic state update
        await prisma.smartDevice.update({
          where: { id: device.id },
          data: {
            lastState: JSON.parse(JSON.stringify(newState)),
            brightness: newBrightness,
            colorTemp: newColorTemp,
          },
        })
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Error desconocido'
        console.error(`[IoT Control] Error on ${device.name}:`, errMsg)
        results.push({ device: device.name, success: false, error: errMsg })
      }
    }

    // Clean up old commands (keep last 50)
    try {
      const oldCommands = await prisma.smartCommand.findMany({
        where: { userId, status: { in: ['completed', 'failed'] } },
        orderBy: { createdAt: 'desc' },
        skip: 50,
        select: { id: true },
      })
      if (oldCommands.length > 0) {
        await prisma.smartCommand.deleteMany({
          where: { id: { in: oldCommands.map(c => c.id) } },
        })
      }
    } catch (_e) {
      // non-critical
    }

    // ======== BUILD USER-FRIENDLY RESPONSE ========
    const successCount = results.filter(r => r.success).length
    const failedCount = results.length - successCount
    const queuedCount = results.filter(r => r.queued).length

    const verb = ({
      on: 'Encendiendo',
      off: 'Apagando',
      toggle: 'Alternando',
      brightness: 'Ajustando brillo de',
      colorTemp: 'Ajustando color de',
    } as Record<string, string>)[action] || 'Ejecutando en'

    let message: string
    if (successCount === 0) {
      message = `⚠️ No pude controlar ningún dispositivo:\n${results.map(r => `• ${r.device}: ${r.error || 'error'}`).join('\n')}`
    } else if (successCount === 1) {
      const r = results.find(x => x.success)!
      message = `✅ ${verb} ${r.device}${r.queued ? ' (el bridge lo procesará en segundos)' : ''}`
    } else {
      const names = results.filter(r => r.success).map(r => r.device).join(', ')
      message = `✅ ${verb} ${successCount} dispositivos: ${names}${queuedCount > 0 ? ` (${queuedCount} en cola para el bridge)` : ''}`
    }
    if (failedCount > 0 && successCount > 0) {
      message += `\n⚠️ ${failedCount} fallaron`
    }

    return NextResponse.json({
      success: successCount > 0,
      message,
      results,
      matched: matches.length,
    })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Error desconocido'
    console.error('[IoT Control] Fatal:', errMsg)
    return NextResponse.json({
      error: 'Error al controlar dispositivo IoT',
      detail: errMsg,
    }, { status: 500 })
  }
}
