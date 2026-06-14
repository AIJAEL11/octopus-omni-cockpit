export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST — test real connection to an MCP endpoint and persist the result
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    const mcp = await prisma.customMcp.findFirst({
      where: { id, userId: session.user.id },
    })
    if (!mcp) return NextResponse.json({ error: 'MCP no encontrado' }, { status: 404 })

    const endpoint = (mcp.endpoint || '').trim()
    if (!endpoint || !/^https?:\/\//i.test(endpoint)) {
      await prisma.customMcp.update({ where: { id: mcp.id }, data: { isConnected: false } })
      return NextResponse.json({
        connected: false,
        error: 'Este MCP no tiene un endpoint válido (debe empezar con http:// o https://). Configúralo primero.',
      })
    }

    const headers: Record<string, string> = { Accept: 'application/json, text/html, */*' }
    if (mcp.apiKey) headers['Authorization'] = `Bearer ${mcp.apiKey}`

    const start = Date.now()
    let connected = false
    let status: number | null = null
    let errorMsg: string | null = null

    try {
      const res = await fetch(endpoint, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(8000),
        redirect: 'follow',
      })
      status = res.status
      // Any HTTP response means the endpoint is reachable; 5xx counts as down
      connected = res.status < 500
      if (!connected) errorMsg = `El servidor respondió con error ${res.status}`
    } catch (e) {
      connected = false
      const msg = e instanceof Error ? e.message : 'unknown'
      errorMsg = msg.includes('timeout') || msg.includes('abort')
        ? 'El endpoint no respondió en 8 segundos (timeout)'
        : `No se pudo conectar al endpoint: ${msg}`
    }
    const latency = Date.now() - start

    await prisma.customMcp.update({
      where: { id: mcp.id },
      data: { isConnected: connected, lastSync: connected ? new Date() : mcp.lastSync },
    })

    return NextResponse.json({ connected, status, latency, error: errorMsg })
  } catch (error) {
    console.error('[MCP Test] error:', error)
    return NextResponse.json({ error: 'Error probando la conexión' }, { status: 500 })
  }
}
