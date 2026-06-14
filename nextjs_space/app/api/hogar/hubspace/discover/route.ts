import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hubspaceListDevices } from '@/lib/hubspace'
import { checkPlanGate } from '@/lib/plan-gate'

export const dynamic = 'force-dynamic'

/**
 * Sanitize data for PostgreSQL JSONB — remove \u0000 null bytes
 * and strip large hex binary attribute values that aren't useful for state
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeForDb(obj: Record<string, unknown>): any {
  const clean: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(obj)) {
    if (val === null || val === undefined) continue
    if (typeof val === 'string') {
      // Remove null bytes and skip large hex-only strings (binary data)
      const sanitized = val.replace(/\u0000/g, '')
      if (sanitized.length > 100 && /^[0-9A-Fa-f]+$/.test(sanitized)) continue
      clean[key] = sanitized
    } else if (typeof val === 'object' && !Array.isArray(val)) {
      clean[key] = sanitizeForDb(val as Record<string, unknown>)
    } else {
      clean[key] = val
    }
  }
  return clean
}

// POST — Discover HubSpace devices and sync to SmartDevice table
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // Get HubSpace credentials
    const creds = await prisma.apiKey.findFirst({
      where: { userId: session.user.id, serviceType: 'hubspace' },
    })
    if (!creds) {
      return NextResponse.json({ error: 'HubSpace no configurado. Primero guarda tus credenciales.' }, { status: 400 })
    }

    // Discover devices
    const hsDevices = await hubspaceListDevices(creds.name, creds.apiKey)
    console.log(`[HubSpace] Discovered ${hsDevices.length} devices`)

    const added: string[] = []
    const skipped: string[] = []

    for (const hsd of hsDevices) {
      // Sanitize state to remove \u0000 null bytes that PostgreSQL JSONB rejects
      const safeState = sanitizeForDb({ on: hsd.isOn, ...hsd.attributes })
      // Sanitize device name too (emojis are fine, but null bytes aren't)
      const safeName = hsd.name.replace(/\u0000/g, '')

      // Check if already exists (by externalId + platform)
      const existing = await prisma.smartDevice.findFirst({
        where: {
          userId: session.user.id,
          platform: 'hubspace',
          externalId: hsd.id,
        },
      })

      if (existing) {
        await prisma.smartDevice.update({
          where: { id: existing.id },
          data: {
            name: safeName,
            lastState: safeState,
            isOnline: hsd.online,
          },
        })
        skipped.push(safeName)
        continue
      }

      // Map HubSpace type to our device types
      let deviceType = 'relay'
      let icon = 'power'
      if (hsd.type === 'outlet') { deviceType = 'plug'; icon = 'plug' }
      else if (hsd.type === 'light') { deviceType = 'light'; icon = 'lightbulb' }
      else if (hsd.type === 'fan') { deviceType = 'fan'; icon = 'fan' }
      else if (hsd.type === 'switch') { deviceType = 'plug'; icon = 'zap' }

      // Plan gate check before creating new device
      const iotGate = await checkPlanGate(session.user.id, 'iot')
      if (!iotGate.allowed) {
        skipped.push(`${safeName} (plan limit)`)
        continue
      }

      await prisma.smartDevice.create({
        data: {
          userId: session.user.id,
          name: safeName,
          type: deviceType,
          platform: 'hubspace',
          externalId: hsd.id,
          icon,
          room: 'Sin asignar',
          mode: 'cloud',
          isOnline: hsd.online,
          lastState: safeState,
          brightness: 100,
          colorTemp: 4000,
        },
      })
      added.push(safeName)
    }

    return NextResponse.json({
      success: true,
      discovered: hsDevices.length,
      added: added.length,
      addedDevices: added,
      skipped: skipped.length,
      skippedDevices: skipped,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido'
    console.error('[HubSpace] Discovery error:', msg)
    return NextResponse.json({ error: `Error al descubrir dispositivos: ${msg}` }, { status: 500 })
  }
}
