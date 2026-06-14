import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * POST /api/sites/analytics/errors
 * Recibe errores JS del script colector inyectado en los sitios publicados.
 * Enviado por navigator.sendBeacon — no necesita autenticación (el siteId es público).
 * Almacena en HostedSiteView reutilizando los campos path/referrer/country:
 *   path    = __error_{type}__
 *   referrer = mensaje de error (≤500 chars)
 *   country  = tipo ('js' | 'res' | 'promise')
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    if (!body) return new NextResponse(null, { status: 204 })

    const { siteId, events } = body as {
      siteId: string
      events: Array<{ t: string; m: string; ts?: number }>
    }
    if (!siteId || !Array.isArray(events) || events.length === 0) {
      return new NextResponse(null, { status: 204 })
    }

    const site = await prisma.hostedSite.findUnique({
      where: { id: siteId },
      select: { id: true },
    })
    if (!site) return new NextResponse(null, { status: 204 })

    for (const ev of events.slice(0, 30)) {
      const type = String(ev.t || 'js').slice(0, 20)
      const msg = String(ev.m || '').slice(0, 500)
      await prisma.hostedSiteView.create({
        data: { siteId, path: `__error_${type}__`, referrer: msg, country: type },
      }).catch(() => {})
    }

    return new NextResponse(null, { status: 204 })
  } catch {
    return new NextResponse(null, { status: 204 })
  }
}
