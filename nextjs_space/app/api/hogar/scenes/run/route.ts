import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hubspaceControlDevice } from '@/lib/hubspace'

export const dynamic = 'force-dynamic'

interface SceneCommand {
  deviceId: string
  action: string
  params?: { brightness?: number; colorTemp?: number }
}

/**
 * POST /api/hogar/scenes/run — Ejecuta una escena
 *
 * Body: { sceneId } o { commands: SceneCommand[] } (acciones rápidas como
 * "todo apagado" sin escena guardada). Cada comando se despacha igual que
 * /api/hogar/control: HubSpace directo a la nube, WiZ encolado al Bridge.
 * Anti-smoke: el resultado reporta cuántos se ejecutaron/encolaron de verdad.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const userId = session.user.id

    const body = await req.json()
    let commands: SceneCommand[] = []
    let sceneName = ''

    if (body.sceneId) {
      const scene = await prisma.smartScene.findFirst({
        where: { id: body.sceneId, userId },
      })
      if (!scene) return NextResponse.json({ error: 'Escena no encontrada' }, { status: 404 })
      commands = (scene.commands as unknown as SceneCommand[]) || []
      sceneName = scene.name
    } else if (Array.isArray(body.commands)) {
      commands = body.commands
      sceneName = body.name || 'Acción rápida'
    }

    if (commands.length === 0) {
      return NextResponse.json({ error: 'La escena no tiene comandos' }, { status: 400 })
    }

    const devices = await prisma.smartDevice.findMany({ where: { userId } })
    const deviceMap = new Map(devices.map(d => [d.id, d]))
    const hsCreds = await prisma.apiKey.findFirst({
      where: { userId, serviceType: 'hubspace' },
    })

    let executed = 0   // HubSpace: ejecutado directo en la nube
    let queued = 0     // WiZ: encolado al Bridge
    let failed = 0
    const details: { device: string; action: string; status: string }[] = []

    for (const cmd of commands) {
      const device = deviceMap.get(cmd.deviceId)
      if (!device) {
        failed++
        details.push({ device: cmd.deviceId, action: cmd.action, status: 'device_not_found' })
        continue
      }

      const currentState = (device.lastState as Record<string, unknown>) || {}
      const newState: Record<string, unknown> = { ...currentState }
      let newBrightness = device.brightness
      let newColorTemp = device.colorTemp

      switch (cmd.action) {
        case 'on': newState.on = true; break
        case 'off': newState.on = false; break
        case 'toggle': newState.on = !currentState.on; break
        case 'brightness':
          if (cmd.params?.brightness !== undefined) {
            newBrightness = Math.max(1, Math.min(100, Number(cmd.params.brightness)))
            newState.brightness = newBrightness
            newState.dimming = newBrightness
            newState.on = true
          }
          break
        case 'colorTemp':
          if (cmd.params?.colorTemp !== undefined) {
            newColorTemp = Math.max(2200, Math.min(6500, Number(cmd.params.colorTemp)))
            newState.colorTemp = newColorTemp
            newState.temp = newColorTemp
            newState.on = true
          }
          break
        default:
          failed++
          details.push({ device: device.name, action: cmd.action, status: 'unsupported_action' })
          continue
      }

      const isHubSpace = device.platform === 'hubspace' && !!device.externalId

      try {
        if (isHubSpace && hsCreds && ['on', 'off', 'toggle'].includes(cmd.action)) {
          const result = await hubspaceControlDevice(
            hsCreds.name, hsCreds.apiKey, device.externalId!,
            cmd.action as 'on' | 'off' | 'toggle', !!currentState.on
          )
          newState.on = result.newState
          await prisma.smartCommand.create({
            data: {
              userId, deviceId: device.id, action: cmd.action,
              params: cmd.params ? JSON.parse(JSON.stringify(cmd.params)) : null,
              status: 'completed',
              result: { hubspace: true, scene: sceneName, newState: result.newState },
            },
          })
          executed++
          details.push({ device: device.name, action: cmd.action, status: 'executed' })
        } else {
          await prisma.smartCommand.create({
            data: {
              userId, deviceId: device.id, action: cmd.action,
              params: cmd.params ? JSON.parse(JSON.stringify(cmd.params)) : null,
              status: 'pending',
              result: { scene: sceneName },
            },
          })
          queued++
          details.push({ device: device.name, action: cmd.action, status: 'queued' })
        }

        await prisma.smartDevice.update({
          where: { id: device.id },
          data: {
            lastState: JSON.parse(JSON.stringify(newState)),
            brightness: newBrightness,
            colorTemp: newColorTemp,
          },
        })
      } catch (err) {
        failed++
        details.push({ device: device.name, action: cmd.action, status: 'error' })
        console.error('[Scene Run] Command error:', err)
      }
    }

    return NextResponse.json({
      success: failed < commands.length,
      scene: sceneName,
      executed,
      queued,
      failed,
      total: commands.length,
      details,
    })
  } catch (error) {
    console.error('Error running scene:', error)
    return NextResponse.json({ error: 'Error ejecutando escena' }, { status: 500 })
  }
}
