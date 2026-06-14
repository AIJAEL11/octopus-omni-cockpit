export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// ────────────────────────────────────────────────────────────────────────────
// Octopus Hosting — serves user-published static sites
// URL format: /sites/{slug}              → index.html
//             /sites/{slug}/style.css    → style.css
//             /sites/{slug}/js/app.js    → js/app.js
// ────────────────────────────────────────────────────────────────────────────

function detectLang(req: NextRequest): 'es' | 'en' {
  const al = req.headers.get('accept-language') || ''
  return al.toLowerCase().startsWith('es') ? 'es' : 'en'
}

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const pathSegments = params.path
    if (!pathSegments || pathSegments.length === 0) {
      return new NextResponse('Not found', { status: 404 })
    }

    const slug = pathSegments[0]
    // Everything after slug is the file path
    const filePath = pathSegments.length > 1
      ? pathSegments.slice(1).join('/')
      : 'index.html'

    // Find the site
    const site = await prisma.hostedSite.findUnique({
      where: { slug },
      select: { id: true, status: true },
    })

    if (!site || site.status !== 'active') {
      return htmlResponse(notFoundPage(slug, detectLang(req)), 404)
    }

    // Load all file paths for this site (lightweight — just paths)
    const allFiles = await prisma.hostedSiteFile.findMany({
      where: { siteId: site.id },
      select: { filePath: true },
    })

    // Detect the common subdirectory prefix (e.g., "taskly-hero/" or "sentinel-ai-v2/")
    // Code Engine often stores files as "project-name/index.html" instead of "index.html"
    let subDir = ''
    const htmlFile = allFiles.find(f => /index\.html?$/i.test(f.filePath))
    if (htmlFile && htmlFile.filePath.includes('/')) {
      subDir = htmlFile.filePath.split('/').slice(0, -1).join('/') + '/'
    }

    // Resolve the actual file path — try multiple strategies
    let resolvedPath = filePath
    let file = await prisma.hostedSiteFile.findUnique({
      where: { siteId_filePath: { siteId: site.id, filePath: resolvedPath } },
      select: { content: true, mimeType: true },
    })

    // Strategy 1: Prepend detected subdirectory prefix
    if (!file && subDir && !filePath.startsWith(subDir)) {
      resolvedPath = subDir + filePath
      file = await prisma.hostedSiteFile.findUnique({
        where: { siteId_filePath: { siteId: site.id, filePath: resolvedPath } },
        select: { content: true, mimeType: true },
      })
    }

    // Strategy 2: If no extension, try with /index.html (and with subdir prefix)
    if (!file && !filePath.includes('.')) {
      for (const candidate of [
        `${filePath}/index.html`,
        `${subDir}${filePath}/index.html`,
        `${subDir}index.html`,
      ]) {
        file = await prisma.hostedSiteFile.findUnique({
          where: { siteId_filePath: { siteId: site.id, filePath: candidate } },
          select: { content: true, mimeType: true },
        })
        if (file) { resolvedPath = candidate; break }
      }
    }

    // Strategy 3: basename match — find any file whose filename matches
    if (!file) {
      const reqBase = filePath.split('/').pop()?.toLowerCase() || ''
      const match = allFiles.find(f => {
        const fBase = f.filePath.split('/').pop()?.toLowerCase() || ''
        return fBase === reqBase
      })
      if (match) {
        resolvedPath = match.filePath
        file = await prisma.hostedSiteFile.findUnique({
          where: { siteId_filePath: { siteId: site.id, filePath: resolvedPath } },
          select: { content: true, mimeType: true },
        })
      }
    }

    if (!file) {
      return htmlResponse(notFoundPage(slug, detectLang(req)), 404)
    }

    // Serve the file with correct headers
    const headers: Record<string, string> = {
      'Content-Type': `${file.mimeType}; charset=utf-8`,
      'Cache-Control': 'public, max-age=300, s-maxage=600',
      'X-Hosted-By': 'Octopus Skills',
    }

    let content = file.content

    // Allow iframe embedding for HTML + inject <base> for relative paths
    if (file.mimeType === 'text/html') {
      headers['Content-Security-Policy'] = "frame-ancestors 'self' https://octopuskills.com https://*.abacusai.app"

      // Inject <base href> so relative paths (style.css, script.js) resolve to /sites/{slug}/
      const baseTag = `<base href="/sites/${slug}/">`
      if (content.includes('<head>')) {
        content = content.replace('<head>', `<head>\n${baseTag}`)
      } else if (content.includes('<HEAD>')) {
        content = content.replace('<HEAD>', `<HEAD>\n${baseTag}`)
      } else if (content.includes('<html')) {
        // No <head> tag — inject one
        content = content.replace(/(<html[^>]*>)/i, `$1\n<head>${baseTag}</head>`)
      } else {
        // Bare HTML — prepend base tag
        content = `${baseTag}\n${content}`
      }

      // ── Error collector: captura JS errors / recursos rotos en producción ──
      const origin = process.env.NEXTAUTH_URL || req.nextUrl.origin
      const errorCollector = `<script>(function(){var S='${site.id}',A='${origin}/api/sites/analytics/errors',B=[];function F(){if(!B.length)return;try{navigator.sendBeacon(A,JSON.stringify({siteId:S,events:B.splice(0)}))}catch(e){}}window.addEventListener('error',function(e){if(e.target&&(e.target.src||e.target.href)){B.push({t:'res',m:String(e.target.src||e.target.href).slice(0,200)});}else{B.push({t:'js',m:(e.message||'err')+'@'+(e.filename||'').split('/').pop()+':'+(e.lineno||0)});}},true);window.addEventListener('unhandledrejection',function(e){B.push({t:'promise',m:String(e.reason&&e.reason.message||e.reason||'?').slice(0,200)});});window.addEventListener('pagehide',F);setTimeout(F,15000);})();</script>`
      if (content.includes('</head>')) {
        content = content.replace('</head>', errorCollector + '</head>')
      } else {
        content = errorCollector + content
      }

      // ── Analytics: track page view (fire-and-forget, only for HTML pages) ──
      const referrer = req.headers.get('referer') || null
      const userAgent = req.headers.get('user-agent') || null
      const country = req.headers.get('cf-ipcountry') || req.headers.get('x-vercel-ip-country') || null
      prisma.hostedSiteView.create({
        data: {
          siteId: site.id,
          path: `/${filePath === 'index.html' ? '' : filePath}`,
          referrer: referrer?.slice(0, 500) || null,
          userAgent: userAgent?.slice(0, 500) || null,
          country: country?.slice(0, 10) || null,
        },
      }).catch(() => { /* non-blocking */ })
    }

    return new NextResponse(content, { status: 200, headers })
  } catch (e: unknown) {
    console.error('[OctopusHosting] serve error:', e)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

function htmlResponse(html: string, status: number) {
  return new NextResponse(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Hosted-By': 'Octopus Skills',
    },
  })
}

function notFoundPage(slug: string, lang: 'es' | 'en' = 'en'): string {
  const i18n = {
    es: { title: 'Sitio no encontrado', body: 'El sitio', tail: 'no existe o fue pausado.', back: '← Volver a Octopus Skills' },
    en: { title: 'Site not found', body: 'The site', tail: "doesn't exist or has been paused.", back: '← Back to Octopus Skills' },
  }
  const s = i18n[lang]
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${s.title} — Octopus Hosting</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0F1419; color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .card { text-align: center; max-width: 420px; padding: 3rem 2rem; }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    h1 { font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem; }
    p { font-size: 0.875rem; color: #9CA3AF; margin-bottom: 1.5rem; line-height: 1.5; }
    a { color: #C4622D; text-decoration: none; font-weight: 600; font-size: 0.875rem; }
    a:hover { text-decoration: underline; }
    .slug { color: #C4622D; font-family: monospace; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🐙</div>
    <h1>${s.title}</h1>
    <p>${s.body} <span class="slug">${slug}</span> ${s.tail}</p>
    <a href="https://octopuskills.com">${s.back}</a>
  </div>
</body>
</html>`
}
