import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, withDbRetry } from '@/lib/prisma'
import { testVpsConnection, type VpsCredentials } from '@/lib/vps-deploy'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/arms/vps/connect — conecta (o actualiza) el brazo VPS.
 *
 * Prueba la conexión SSH y, si funciona, guarda las credenciales en
 * ArmConnection (armType:'vps'). Las credenciales NUNCA se devuelven al cliente
 * ni pasan por ningún LLM — solo se confirma ok + info del servidor remoto.
 *
 * Body: { host, port?, username, password?|privateKey?, passphrase?, deployPath?,
 *         appName?, appPort?, domain? }
 *
 * GET — estado del brazo (sin exponer credenciales).
 * DELETE — desconecta el brazo.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const userId = session.user.id
    const b = await req.json().catch(() => ({}))

    if (!b.host || !b.username || (!b.password && !b.privateKey)) {
      return NextResponse.json({ error: 'host, username y password o privateKey son requeridos' }, { status: 400 })
    }

    const creds: VpsCredentials = {
      host: String(b.host).trim(),
      port: Number(b.port) || 22,
      username: String(b.username).trim(),
      password: b.password ? String(b.password) : undefined,
      privateKey: b.privateKey ? String(b.privateKey) : undefined,
      passphrase: b.passphrase ? String(b.passphrase) : undefined,
      deployPath: String(b.deployPath || `/var/www/${b.appName || 'octopus-app'}`).trim(),
      appName: String(b.appName || 'octopus-app').replace(/[^a-zA-Z0-9_-]/g, '') || 'octopus-app',
      appPort: Number(b.appPort) || 3000,
      domain: b.domain ? String(b.domain).trim() : undefined,
    }

    // 1. Prueba la conexión SSH antes de guardar.
    const test = await testVpsConnection(creds)
    if (!test.ok) {
      return NextResponse.json({ error: `No se pudo conectar al VPS: ${test.error}` }, { status: 400 })
    }

    // 2. Guarda/actualiza la conexión (credenciales server-side).
    const existing = await withDbRetry(() => prisma.armConnection.findFirst({
      where: { userId, armType: 'vps' }, select: { id: true },
    }))
    if (existing) {
      await withDbRetry(() => prisma.armConnection.update({
        where: { id: existing.id },
        data: { credentials: JSON.stringify(creds), status: 'connected', connectedAt: new Date(), name: creds.appName },
      }))
    } else {
      await withDbRetry(() => prisma.armConnection.create({
        data: { userId, armType: 'vps', credentials: JSON.stringify(creds), status: 'connected', connectedAt: new Date(), name: creds.appName },
      }))
    }

    return NextResponse.json({ success: true, info: test.info, host: creds.host, appName: creds.appName })
  } catch (error) {
    console.error('VPS connect error:', error)
    return NextResponse.json({ error: 'Error conectando el VPS' }, { status: 500 })
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const conn = await withDbRetry(() => prisma.armConnection.findFirst({
    where: { userId: session.user.id, armType: 'vps' },
    select: { status: true, connectedAt: true, credentials: true },
  }))
  if (!conn) return NextResponse.json({ connected: false })
  // Devuelve solo metadatos NO sensibles (host/appName/domain), nunca password/key.
  let meta: Record<string, unknown> = {}
  try {
    const c = JSON.parse(conn.credentials)
    meta = { host: c.host, port: c.port, username: c.username, deployPath: c.deployPath, appName: c.appName, appPort: c.appPort, domain: c.domain }
  } catch {}
  return NextResponse.json({ connected: conn.status === 'connected', connectedAt: conn.connectedAt, ...meta })
}

export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  await withDbRetry(() => prisma.armConnection.deleteMany({ where: { userId: session.user.id, armType: 'vps' } }))
  return NextResponse.json({ success: true })
}
