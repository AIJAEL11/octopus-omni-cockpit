import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hubspaceControlDevice } from '@/lib/hubspace'

export const dynamic = 'force-dynamic'

// POST — Send command to a device (queues for bridge if WiZ, direct cloud if HubSpace)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json()
    const { deviceId, action, params } = body

    if (!deviceId || !action) {
      return NextResponse.json({ error: 'deviceId y action requeridos' }, { status: 400 })
    }

    // Get device
    const device = await prisma.smartDevice.findFirst({
      where: { id: deviceId, userId: session.user.id },
    })
    if (!device) return NextResponse.json({ error: 'Dispositivo no encontrado' }, { status: 404 })

    const currentState = (device.lastState as Record<string, unknown>) || {}
    let newState: Record<string, unknown> = { ...currentState }
    let newBrightness = device.brightness
    let newColorTemp = device.colorTemp

    // Calculate expected new state
    switch (action) {
      case 'toggle':
        newState.on = !currentState.on
        break
      case 'on':
        newState.on = true
        break
      case 'off':
        newState.on = false
        break
      case 'brightness':
        if (params?.brightness !== undefined) {
          newBrightness = Math.max(1, Math.min(100, Number(params.brightness)))
          newState.brightness = newBrightness
          newState.dimming = newBrightness
        }
        break
      case 'colorTemp':
        if (params?.colorTemp !== undefined) {
          newColorTemp = Math.max(2200, Math.min(6500, Number(params.colorTemp)))
          newState.colorTemp = newColorTemp
          newState.temp = newColorTemp
        }
        break
      case 'status':
        return NextResponse.json({ success: true, result: currentState, newState: currentState })
      default:
        return NextResponse.json({ error: 'Accion no soportada: ' + action }, { status: 400 })
    }

    // ========== PLATFORM-SPECIFIC CONTROL ==========
    const isHubSpace = device.platform === 'hubspace'

    if (isHubSpace && device.externalId) {
      // HubSpace: Direct cloud control via Afero API (no bridge needed)
      try {
        const creds = await prisma.apiKey.findFirst({
          where: { userId: session.user.id, serviceType: 'hubspace' },
        })
        if (!creds) {
          return NextResponse.json({ error: 'HubSpace no configurado' }, { status: 400 })
        }

        // For HubSpace plugs, only on/off/toggle are supported
        if (['on', 'off', 'toggle'].includes(action)) {
          const hsAction = action as 'on' | 'off' | 'toggle'
          const result = await hubspaceControlDevice(
            creds.name, creds.apiKey, device.externalId, hsAction, !!currentState.on
          )
          newState.on = result.newState

          // Mark command as completed immediately (no bridge needed)
          await prisma.smartCommand.create({
            data: {
              userId: session.user.id,
              deviceId: device.id,
              action,
              params: params ? JSON.parse(JSON.stringify(params)) : null,
              status: 'completed',
              result: { hubspace: true, newState: result.newState },
            },
          })
        }
        // brightness/colorTemp not supported for basic HubSpace plugs
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'HubSpace error'
        console.error('[HubSpace] Control error:', errMsg)
        await prisma.smartCommand.create({
          data: {
            userId: session.user.id,
            deviceId: device.id,
            action,
            params: params ? JSON.parse(JSON.stringify(params)) : null,
            status: 'failed',
            result: { error: errMsg },
          },
        })
      }
    } else {
      // WiZ: Queue command for bridge to pick up
      await prisma.smartCommand.create({
        data: {
          userId: session.user.id,
          deviceId: device.id,
          action,
          params: params ? JSON.parse(JSON.stringify(params)) : null,
          status: 'pending',
        },
      })
    }

    // Update the optimistic state in DB
    await prisma.smartDevice.update({
      where: { id: deviceId },
      data: {
        lastState: JSON.parse(JSON.stringify(newState)),
        brightness: newBrightness,
        colorTemp: newColorTemp,
      },
    })

    // Clean up old completed/failed commands (keep last 50)
    const oldCommands = await prisma.smartCommand.findMany({
      where: {
        userId: session.user.id,
        status: { in: ['completed', 'failed'] },
      },
      orderBy: { createdAt: 'desc' },
      skip: 50,
      select: { id: true },
    })
    if (oldCommands.length > 0) {
      await prisma.smartCommand.deleteMany({
        where: { id: { in: oldCommands.map(c => c.id) } },
      })
    }

    return NextResponse.json({
      success: true,
      result: { action, params, queued: !isHubSpace, direct: isHubSpace },
      newState,
    })
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Error desconocido'
    console.error('Error controlling device:', errMsg)
    return NextResponse.json({
      error: 'Error al controlar dispositivo',
      detail: errMsg,
    }, { status: 500 })
  }
}
