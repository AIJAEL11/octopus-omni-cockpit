// ═══════════════════════════════════════════════════════════════════════════════
// PREVIEW RENDERER — Public endpoint that serves combined HTML from a session
// Used by Self-Review (Visual Reflexion) to screenshot the Code Engine's output
// GET /api/arms/claude-code/preview-render?sessionId=xxx&token=xxx
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generatePreviewToken } from '@/lib/preview-token'

export const dynamic = 'force-dynamic'

/**
 * Combine write_file commands from a session into a single HTML page.
 * Mirrors the frontend's buildProjectHtmlFromFiles logic but runs server-side.
 */
function buildCombinedHtml(commands: Array<{ type: string; payload: string; status: string }>): string | null {
  const writeFiles = commands.filter(c => c.type === 'write_file' && (c.status === 'completed' || c.status === 'approved'))
  if (writeFiles.length === 0) return null

  // Parse payloads
  const files: Array<{ path: string; content: string }> = []
  for (const cmd of writeFiles) {
    try {
      const payload = JSON.parse(cmd.payload)
      if (payload.filePath && payload.content) {
        files.push({ path: payload.filePath, content: payload.content })
      }
    } catch { /* skip malformed */ }
  }

  if (files.length === 0) return null

  // Find HTML entry (prefer last-written project)
  const reversed = [...files].reverse()
  const htmlFile =
    reversed.find(f => /index\.html?$/i.test(f.path)) ||
    reversed.find(f => /\.html?$/i.test(f.path))
  if (!htmlFile) return null

  const htmlDir = htmlFile.path.split('/').slice(0, -1).join('/')
  const cssFiles = files.filter(f => /\.css$/i.test(f.path) && (htmlDir === '' || f.path.startsWith(htmlDir + '/')))
  const jsFiles = files.filter(f => /\.(m?jsx?|tsx?)$/i.test(f.path) && (htmlDir === '' || f.path.startsWith(htmlDir + '/')))

  let html = htmlFile.content

  // Build set of local filenames to strip external refs
  const localFileNames = new Set<string>()
  for (const f of [...cssFiles, ...jsFiles]) {
    const name = f.path.split('/').pop() || ''
    if (name) localFileNames.add(name.toLowerCase())
  }

  // Strip local <link> stylesheet refs (will inline them)
  html = html.replace(
    /<link\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi,
    (match, href) => {
      const fileName = (href as string).split('/').pop()?.toLowerCase() || ''
      if (localFileNames.has(fileName) && /rel\s*=\s*["']stylesheet["']/i.test(match)) {
        return `<!-- inlined: ${href} -->`
      }
      return match
    },
  )

  // Strip local <script src> refs
  html = html.replace(
    /<script\s+[^>]*src\s*=\s*["']([^"']+)["'][^>]*>\s*<\/script>/gi,
    (match, src) => {
      const fileName = (src as string).split('/').pop()?.toLowerCase() || ''
      if (localFileNames.has(fileName)) return `<!-- inlined: ${src} -->`
      return match
    },
  )

  // Inject CSS
  if (cssFiles.length > 0) {
    const cssBlock = cssFiles.map(f => `<style>/* ${f.path} */\n${f.content}</style>`).join('\n')
    if (html.includes('</head>')) {
      html = html.replace('</head>', cssBlock + '\n</head>')
    } else {
      html = cssBlock + '\n' + html
    }
  }

  // Detect if Babel standalone is loaded (React UMD + JSX setup)
  const hasBabel = /babel(?:\.min)?\.js/i.test(html) || /unpkg\.com\/@babel\/standalone/i.test(html)

  // Inject JS
  if (jsFiles.length > 0) {
    const jsBlock = jsFiles.map(f => {
      const code = f.content
      const looksLikeJSX = /\.tsx?$/i.test(f.path) || /\.jsx$/i.test(f.path) ||
        (hasBabel && (/<[A-Z]/.test(code) || /React\.createElement/.test(code) || /className\s*=/.test(code)))
      const scriptType = (hasBabel && looksLikeJSX) ? ' type="text/babel"' : ''
      return `<script${scriptType}>/* ${f.path} */\n${code}</script>`
    }).join('\n')
    if (html.includes('</body>')) {
      html = html.replace('</body>', jsBlock + '\n</body>')
    } else {
      html = html + '\n' + jsBlock
    }
  }

  return html
}

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId')
  const token = req.nextUrl.searchParams.get('token')

  if (!sessionId) {
    return new NextResponse('Missing sessionId', { status: 400 })
  }

  // Validate preview token (simple hash-based token for security)
  const expectedToken = generatePreviewToken(sessionId)
  if (token !== expectedToken) {
    return new NextResponse('Invalid token', { status: 403 })
  }

  // Fetch all write_file commands for this session
  const commands = await prisma.bridgeCommand.findMany({
    where: { sessionId, type: 'write_file' },
    select: { type: true, payload: true, status: true },
    orderBy: { createdAt: 'asc' },
  })

  const html = buildCombinedHtml(commands)
  if (!html) {
    return new NextResponse(
      '<html><body style="background:#111;color:#fff;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh"><h1>No preview available</h1></body></html>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}


