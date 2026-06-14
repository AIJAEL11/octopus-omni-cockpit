import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPlanGate } from '@/lib/plan-gate'

export const dynamic = 'force-dynamic'

// Helper: validate bridge token from ApiKey table
async function validateBridgeToken(token: string) {
  if (!token) return null
  const apiKey = await prisma.apiKey.findFirst({
    where: { apiKey: token, serviceType: 'hogar_bridge' },
  })
  return apiKey?.userId || null
}

// GET — Bridge polls for pending commands + registers heartbeat
export async function GET(req: NextRequest) {
  try {
    // Auth: either session or bridge token
    let userId: string | null = null
    const token = req.headers.get('x-bridge-token') || req.nextUrl.searchParams.get('token')
    
    if (token) {
      userId = await validateBridgeToken(token)
    } else {
      const session = await getServerSession(authOptions)
      userId = session?.user?.id || null
    }
    
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // Get pending commands
    const commands = await prisma.smartCommand.findMany({
      where: { userId, status: 'pending' },
      include: {
        device: {
          select: { id: true, name: true, type: true, ipAddress: true, macAddress: true, externalId: true, platform: true }
        }
      },
      orderBy: { createdAt: 'asc' },
      take: 20,
    })

    // Mark commands as 'sent'
    if (commands.length > 0) {
      await prisma.smartCommand.updateMany({
        where: { id: { in: commands.map(c => c.id) } },
        data: { status: 'sent' },
      })
    }

    // Also get all user devices for discovery purposes
    const devices = await prisma.smartDevice.findMany({
      where: { userId },
      select: { id: true, name: true, type: true, ipAddress: true, macAddress: true, room: true, platform: true },
    })

    return NextResponse.json({
      commands: commands.map(c => ({
        id: c.id,
        deviceId: c.deviceId,
        action: c.action,
        params: c.params,
        device: c.device,
      })),
      devices,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Bridge GET error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST — Bridge reports command results + device status updates
export async function POST(req: NextRequest) {
  try {
    let userId: string | null = null
    const token = req.headers.get('x-bridge-token') || ''
    
    if (token) {
      userId = await validateBridgeToken(token)
    } else {
      const session = await getServerSession(authOptions)
      userId = session?.user?.id || null
    }
    
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json()
    const { type } = body

    // Type 1: Command result
    if (type === 'command_result') {
      const { commandId, success, result, deviceState } = body
      if (!commandId) return NextResponse.json({ error: 'commandId requerido' }, { status: 400 })

      // Update command status
      const cmd = await prisma.smartCommand.findFirst({
        where: { id: commandId, userId },
      })
      if (cmd) {
        await prisma.smartCommand.update({
          where: { id: commandId },
          data: {
            status: success ? 'completed' : 'failed',
            result: result ? JSON.parse(JSON.stringify(result)) : null,
          },
        })

        // Update device state if provided
        if (deviceState && cmd.deviceId) {
          const updateData: Record<string, unknown> = {
            isOnline: true,
            lastState: JSON.parse(JSON.stringify(deviceState)),
          }
          if (deviceState.brightness !== undefined) updateData.brightness = deviceState.brightness
          if (deviceState.colorTemp !== undefined) updateData.colorTemp = deviceState.colorTemp
          
          await prisma.smartDevice.update({
            where: { id: cmd.deviceId },
            data: updateData as { isOnline: boolean; lastState: object; brightness?: number; colorTemp?: number },
          })
        }
      }

      return NextResponse.json({ success: true })
    }

    // Type 2: Device discovery (bridge found devices on local network)
    if (type === 'discovery') {
      const { discoveredDevices } = body
      if (!Array.isArray(discoveredDevices)) {
        return NextResponse.json({ error: 'discoveredDevices requerido' }, { status: 400 })
      }

      const results: any[] = []
      for (const dd of discoveredDevices) {
        // Try to match by MAC or IP, or create new
        let device: any = null
        if (dd.mac) {
          device = await prisma.smartDevice.findFirst({
            where: { userId, macAddress: dd.mac },
          })
        }
        if (!device && dd.ip) {
          device = await prisma.smartDevice.findFirst({
            where: { userId, ipAddress: dd.ip },
          })
        }

        if (device) {
          // Update existing
          await prisma.smartDevice.update({
            where: { id: device.id },
            data: {
              ipAddress: dd.ip || device.ipAddress,
              macAddress: dd.mac || device.macAddress,
              isOnline: true,
              lastState: dd.state ? JSON.parse(JSON.stringify(dd.state)) : device.lastState,
              ...(dd.state?.dimming !== undefined && { brightness: dd.state.dimming }),
              ...(dd.state?.temp !== undefined && { colorTemp: dd.state.temp }),
            },
          })
          results.push({ action: 'updated', id: device.id, name: device.name })
        } else {
          // Plan gate check before creating new device
          const iotGate = await checkPlanGate(userId, 'iot')
          if (!iotGate.allowed) {
            results.push({ action: 'skipped', name: dd.moduleName || 'Device', reason: 'plan_limit' })
            continue
          }
          // Create new device
          const newDevice = await prisma.smartDevice.create({
            data: {
              userId,
              name: dd.moduleName || `WiZ ${dd.mac?.slice(-6) || 'Device'}`,
              type: dd.type || 'light',
              platform: 'wiz',
              ipAddress: dd.ip,
              macAddress: dd.mac,
              room: dd.roomName || null,
              icon: dd.type === 'plug' ? 'plug' : 'lightbulb',
              isOnline: true,
              mode: 'bridge',
              brightness: dd.state?.dimming || 100,
              colorTemp: dd.state?.temp || 4000,
              lastState: dd.state ? JSON.parse(JSON.stringify(dd.state)) : { on: false },
            },
          })
          results.push({ action: 'created', id: newDevice.id, name: newDevice.name })
        }
      }

      return NextResponse.json({ success: true, results })
    }

    // Type 3: Heartbeat
    if (type === 'heartbeat') {
      return NextResponse.json({ success: true, serverTime: new Date().toISOString() })
    }

    return NextResponse.json({ error: 'Tipo no soportado' }, { status: 400 })
  } catch (error) {
    console.error('Bridge POST error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
