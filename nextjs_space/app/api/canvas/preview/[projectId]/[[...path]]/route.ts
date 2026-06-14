import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, withDbRetry } from '@/lib/prisma'
import { contentTypeFor } from '@/lib/octopus-canvas'
import { verifyCanvasViewToken } from '@/lib/canvas-token'

export const dynamic = 'force-dynamic'

/**
 * Colector de errores inyectado en el HTML del preview.
 * Reporta al panel Canvas (postMessage) errores de JS, promesas rechazadas,
 * console.error y recursos que no cargan — base de la auto-verificación.
 * Solo actúa dentro de un iframe (window.parent !== window).
 */
const LOG_COLLECTOR = `<script>(function(){
if (window.parent === window) return;
function send(kind, message) {
  try { window.parent.postMessage({ type: 'octopus-canvas-log', kind: kind, message: String(message).slice(0, 500) }, '*'); } catch(e){}
}
window.addEventListener('error', function(e){
  if (e.target && (e.target.src || e.target.href)) {
    send('resource', 'No cargó: ' + (e.target.src || e.target.href));
  } else {
    send('js', (e.message || 'Error') + (e.filename ? ' @ ' + e.filename.split('/').pop() + ':' + e.lineno : ''));
  }
}, true);
window.addEventListener('unhandledrejection', function(e){ send('promise', e.reason && e.reason.message || e.reason || 'Promesa rechazada'); });
var ce = console.error; console.error = function(){ send('console', Array.prototype.slice.call(arguments).join(' ')); ce.apply(console, arguments); };
window.addEventListener('load', function(){ setTimeout(function(){ try { window.parent.postMessage({ type: 'octopus-canvas-ready' }, '*'); } catch(e){} }, 300); });
})();</script>`

function injectCollector(html: string): string {
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, m => m + LOG_COLLECTOR)
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, m => m + LOG_COLLECTOR)
  return LOG_COLLECTOR + html
}

/**
 * GET /api/canvas/preview/[projectId]/[...path]
 *
 * Sirve los archivos del proyecto Canvas como un sitio real:
 * /api/canvas/preview/abc123/            → index.html
 * /api/canvas/preview/abc123/styles.css  → styles.css
 * Las rutas relativas entre archivos funcionan de forma natural.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string; path?: string[] } }
) {
  try {
    const { projectId } = params

    // Acceso: sesión web O token de visión (?vt=) para el navegador del Bridge.
    // El token de query se fija como cookie scoped al proyecto para que los
    // assets relativos (styles.css, app.js) también pasen sin sesión.
    const vtQuery = new URL(request.url).searchParams.get('vt')
    const vtCookie = request.cookies.get(`cvt_${projectId}`)?.value || null
    const vtFromQuery = verifyCanvasViewToken(projectId, vtQuery)
    const hasViewToken = vtFromQuery || verifyCanvasViewToken(projectId, vtCookie)
    const tokenCookie = vtFromQuery
      ? `cvt_${projectId}=${vtQuery}; Path=/api/canvas/preview/${projectId}; Max-Age=600; SameSite=Lax; HttpOnly`
      : null

    const session = hasViewToken ? null : await getServerSession(authOptions)
    if (!hasViewToken && !session?.user?.id) {
      return new NextResponse('No autorizado', { status: 401 })
    }

    const filePath = (params.path && params.path.length > 0)
      ? params.path.join('/')
      : 'index.html'

    // Las plantillas (canvas_template) son públicas para cualquier usuario logueado
    // — alimentan las miniaturas de la galería del marketplace.
    const project = await withDbRetry(() => prisma.project.findFirst({
      where: hasViewToken
        ? { id: projectId, projectType: { in: ['canvas', 'canvas_template'] } }
        : {
            id: projectId,
            OR: [
              { userId: session!.user.id, projectType: 'canvas' },
              { projectType: 'canvas_template' },
            ],
          },
      select: { id: true },
    }))
    if (!project) return new NextResponse('Proyecto no encontrado', { status: 404 })

    const file = await withDbRetry(() => prisma.projectFile.findFirst({
      where: { projectId, path: filePath },
      select: { content: true },
    }))

    if (!file || file.content == null) {
      // SPA fallback: rutas desconocidas sin extensión → index.html (hash routing amigable)
      if (!filePath.includes('.')) {
        const index = await withDbRetry(() => prisma.projectFile.findFirst({
          where: { projectId, path: 'index.html' },
          select: { content: true },
        }))
        if (index?.content) {
          const h = new Headers({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
          if (tokenCookie) h.append('Set-Cookie', tokenCookie)
          return new NextResponse(injectCollector(index.content), { headers: h })
        }
      }
      return new NextResponse('Archivo no encontrado: ' + filePath, { status: 404 })
    }

    const isHtml = /\.html?$/i.test(filePath)
    const body = isHtml ? injectCollector(file.content) : file.content

    const headers = new Headers({
      'Content-Type': contentTypeFor(filePath),
      'Cache-Control': 'no-store',
      // El preview corre en iframe del mismo origen; bloquear framing externo
      'X-Frame-Options': 'SAMEORIGIN',
    })
    if (tokenCookie) headers.append('Set-Cookie', tokenCookie)

    return new NextResponse(body, { headers })
  } catch (error) {
    console.error('Canvas preview error:', error)
    return new NextResponse('Error sirviendo el archivo', { status: 500 })
  }
}
