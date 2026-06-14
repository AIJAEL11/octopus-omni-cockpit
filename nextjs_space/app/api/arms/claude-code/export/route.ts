import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import archiver from 'archiver'
import { PassThrough } from 'stream'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/arms/claude-code/export?sessionId=xxx
 * Returns a ZIP file containing all write_file commands from the session.
 * Only includes the latest version of each file (deduped by path).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessionId = request.nextUrl.searchParams.get('sessionId')
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId parameter' }, { status: 400 })
    }

    // Verify session belongs to user
    const codeSession = await prisma.codeSession.findFirst({
      where: { id: sessionId, userId: session.user.id },
      select: { id: true, title: true },
    })
    if (!codeSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Get all write_file commands (completed/approved), ordered by creation time
    const commands = await prisma.bridgeCommand.findMany({
      where: {
        sessionId,
        type: 'write_file',
        status: { in: ['completed', 'approved', 'executing'] },
      },
      select: { payload: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })

    if (commands.length === 0) {
      return NextResponse.json({ error: 'No files found in this session' }, { status: 404 })
    }

    // Deduplicate: keep the LAST version of each file path
    const fileMap = new Map<string, string>() // path → content
    for (const cmd of commands) {
      try {
        const p = JSON.parse(cmd.payload)
        if (p.path && p.content) {
          const path = p.path.replace(/\\/g, '/')
          fileMap.set(path, p.content)
        } else if (p.filePath && p.content) {
          const path = p.filePath.replace(/\\/g, '/')
          fileMap.set(path, p.content)
        }
      } catch { /* skip malformed */ }
    }

    if (fileMap.size === 0) {
      return NextResponse.json({ error: 'No valid files found' }, { status: 404 })
    }

    // Generate filename from session title or ID
    const safeName = (codeSession.title || 'project')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 50)

    // ── Detect project metadata for deployment scaffolding ──
    const hasHtml = [...fileMap.keys()].some(f => /\.html?$/i.test(f))
    const hasReact = [...fileMap.keys()].some(f => /\.(jsx|tsx)$/i.test(f))
    const hasVue = [...fileMap.keys()].some(f => /\.vue$/i.test(f))
    const hasSvelte = [...fileMap.keys()].some(f => /\.svelte$/i.test(f))
    const hasPackageJson = fileMap.has('package.json')

    // Detect npm dependencies from import statements
    const npmDeps = new Set<string>()
    for (const content of fileMap.values()) {
      const importMatches = content.matchAll(/(?:import\s+.*?\s+from\s+|require\s*\(\s*)['"]([^./'"@][^'"]*|@[^/'"]+\/[^'"]+)['"]/g)
      for (const m of importMatches) {
        const pkg = m[1].split('/').slice(0, m[1].startsWith('@') ? 2 : 1).join('/')
        if (!['react', 'react-dom', 'vue', 'svelte'].includes(pkg)) npmDeps.add(pkg)
      }
    }

    // Generate package.json if not present
    if (!hasPackageJson && (hasReact || hasVue || hasSvelte)) {
      const framework = hasReact ? 'react' : hasVue ? 'vue' : 'svelte'
      const deps: Record<string, string> = {}
      if (hasReact) { deps['react'] = '^18.3.1'; deps['react-dom'] = '^18.3.1' }
      if (hasVue) { deps['vue'] = '^3.4.0' }
      if (hasSvelte) { deps['svelte'] = '^4.0.0' }
      for (const d of npmDeps) deps[d] = 'latest'
      const pkg = {
        name: safeName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        version: '1.0.0',
        private: true,
        type: 'module',
        scripts: {
          dev: framework === 'react' ? 'vite' : framework === 'vue' ? 'vite' : 'vite dev',
          build: 'vite build',
          preview: 'vite preview',
        },
        dependencies: deps,
        devDependencies: {
          'vite': '^5.4.0',
          ...(hasReact ? { '@vitejs/plugin-react': '^4.3.0' } : {}),
          ...(hasVue ? { '@vitejs/plugin-vue': '^5.0.0' } : {}),
          ...(hasSvelte ? { '@sveltejs/vite-plugin-svelte': '^3.0.0' } : {}),
        },
      }
      fileMap.set('package.json', JSON.stringify(pkg, null, 2))
    }

    // Generate .gitignore if not present
    if (!fileMap.has('.gitignore')) {
      fileMap.set('.gitignore', 'node_modules/\ndist/\n.env\n.DS_Store\n*.log\n')
    }

    // Generate README.md
    if (!fileMap.has('README.md')) {
      const projectTitle = codeSession.title || 'Project'
      const fileList = [...fileMap.keys()].filter(f => f !== 'README.md' && f !== '.gitignore').map(f => `- \`${f}\``).join('\n')
      const installCmd = hasPackageJson || hasReact || hasVue || hasSvelte
        ? '```bash\nnpm install\nnpm run dev\n```'
        : hasHtml
          ? 'Open `index.html` in your browser, or use a local server:\n```bash\nnpx serve .\n```'
          : '```bash\n# Open the project files directly\n```'
      fileMap.set('README.md', `# ${projectTitle}\n\nGenerated with [Octopus Skills Code Engine](https://octopuskills.com)\n\n## Getting Started\n\n${installCmd}\n\n## Files\n\n${fileList}\n`)
    }

    // Build ZIP using archiver
    const passThrough = new PassThrough()
    const archive = archiver('zip', { zlib: { level: 9 } })

    // Pipe archive to passthrough stream
    archive.pipe(passThrough)

    // Add all files
    for (const [filePath, content] of fileMap) {
      archive.append(content, { name: filePath })
    }

    // Finalize archive (this triggers the actual compression)
    archive.finalize()

    // Collect all chunks into a buffer
    const chunks: Buffer[] = []
    await new Promise<void>((resolve, reject) => {
      passThrough.on('data', (chunk: Buffer) => chunks.push(chunk))
      passThrough.on('end', resolve)
      passThrough.on('error', reject)
      archive.on('error', reject)
    })

    const zipBuffer = Buffer.concat(chunks)

    const filename = `${safeName}.zip`

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(zipBuffer.length),
      },
    })
  } catch (err) {
    console.error('[Export] Error:', err)
    return NextResponse.json(
      { error: 'Failed to export project' },
      { status: 500 }
    )
  }
}
