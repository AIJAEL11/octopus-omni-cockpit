import { NextRequest, NextResponse } from 'next/server'
import { prisma, withDbRetry } from '@/lib/prisma'
import { verifyMcpServerToken } from '@/lib/mcp-server-token'
import { sanitizeCanvasPath, type CanvasFile } from '@/lib/octopus-canvas'
import { canvasViewToken } from '@/lib/canvas-token'
import { publishFilesToOctopus } from '@/lib/octopus-hosting'
import { buildSaasScaffoldFiles } from '@/lib/saas-scaffold'
import { buildTestScaffoldFiles, mergeTestDepsIntoPackageJson } from '@/lib/test-scaffold'
import { deploySessionToVps } from '@/lib/vps-deploy'
import { ensureTokenColumns } from '@/lib/ensure-schema'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * 🔌 OCTOPUS MCP SERVER — /api/mcp
 *
 * Model Context Protocol (transporte Streamable HTTP, sin estado) para que
 * clientes MCP externos — Claude Code CLI/IDE, Claude Desktop, etc. — usen
 * las herramientas de OCTOPUS: crear y desplegar proyectos Canvas, leer
 * analíticas de producción y explorar el marketplace de plantillas.
 *
 * Conexión desde Claude Code:
 *   claude mcp add --transport http octopus {origin}/api/mcp \
 *     --header "Authorization: Bearer octk_..."
 *
 * Auth: Bearer token HMAC por usuario (lib/mcp-server-token, cero migraciones).
 * Todas las operaciones quedan limitadas a la cuenta dueña del token.
 * Las credenciales de brazos NUNCA se exponen por aquí — solo proyectos,
 * sitios y plantillas del propio usuario.
 */

const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']
const MAX_FILES_PER_CALL = 60
const MAX_FILE_SIZE = 500_000

interface JsonRpcMsg {
  jsonrpc?: string
  id?: number | string | null
  method?: string
  params?: Record<string, unknown>
}

function rpcResult(id: number | string, result: unknown) {
  return { jsonrpc: '2.0' as const, id, result }
}

function rpcError(id: number | string | null, code: number, message: string) {
  return { jsonrpc: '2.0' as const, id, error: { code, message } }
}

/* ──────────────────────────────────────────────────────────────────────────
 * Catálogo de herramientas (tools/list)
 * ────────────────────────────────────────────────────────────────────────── */

const FILES_SCHEMA = {
  type: 'object',
  properties: {
    path: { type: 'string', description: 'Relative path, e.g. index.html, styles.css, js/app.js' },
    content: { type: 'string', description: 'Full file content (no truncation)' },
  },
  required: ['path', 'content'],
} as const

const TOOL_CATALOG = [
  {
    name: 'list_projects',
    description: 'List your OCTOPUS Canvas web projects (id, name, files, last update). | Lista tus proyectos web del Canvas de OCTOPUS.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_project',
    description: 'Read every file of a Canvas project with full content. | Lee todos los archivos de un proyecto Canvas con su contenido completo.',
    inputSchema: {
      type: 'object',
      properties: { projectId: { type: 'string', description: 'Canvas project id (from list_projects)' } },
      required: ['projectId'],
    },
  },
  {
    name: 'create_project',
    description: 'Create a new Canvas project from static web files (index.html is the entry point; relative links between files work). Returns projectId and a shareable live preview URL. | Crea un proyecto Canvas nuevo desde archivos web estáticos y devuelve la URL del preview en vivo.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short project title' },
        files: { type: 'array', items: FILES_SCHEMA, description: 'Project files. Include index.html.' },
      },
      required: ['title', 'files'],
    },
  },
  {
    name: 'update_files',
    description: 'Create or overwrite files in an existing Canvas project (upsert by path; untouched files are kept). | Crea o sobreescribe archivos de un proyecto Canvas existente (los demás se conservan).',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        files: { type: 'array', items: FILES_SCHEMA },
      },
      required: ['projectId', 'files'],
    },
  },
  {
    name: 'deploy_project',
    description: 'Publish a Canvas project to Octopus Hosting and get its public URL instantly (re-deploying updates the same site). | Publica un proyecto Canvas en Octopus Hosting y devuelve su URL pública al instante.',
    inputSchema: {
      type: 'object',
      properties: { projectId: { type: 'string' } },
      required: ['projectId'],
    },
  },
  {
    name: 'list_sites',
    description: 'List your live sites on Octopus Hosting (public URL, version, linked Canvas project). | Lista tus sitios publicados en Octopus Hosting.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'site_analytics',
    description: 'Last-7-days analytics of a deployed site: total views, top pages, top referrers and real JS errors captured in production by the Sitio Vivo collector. | Analíticas de 7 días de un sitio publicado: visitas, páginas top y errores JS reales de producción.',
    inputSchema: {
      type: 'object',
      properties: { siteId: { type: 'string', description: 'Site id (from list_sites or deploy_project)' } },
      required: ['siteId'],
    },
  },
  {
    name: 'search_templates',
    description: 'Browse the OCTOPUS community template marketplace (search + category filter). | Explora el marketplace de plantillas de la comunidad OCTOPUS.',
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Free-text search in name/description' },
        category: { type: 'string', description: 'landing | saas | portfolio | ecommerce | dashboard | general' },
      },
    },
  },
  {
    name: 'fork_template',
    description: 'Fork a community template into your own Canvas as a new editable project (the author earns credits). | Haz fork de una plantilla de la comunidad a tu Canvas como proyecto editable.',
    inputSchema: {
      type: 'object',
      properties: { templateId: { type: 'string', description: 'Template id (from search_templates)' } },
      required: ['templateId'],
    },
  },

  // ─── CODE ENGINE — full-stack IDE (you are the brain, OCTOPUS the hands) ───
  // Unlike the Canvas (static sites), Code Engine projects run a REAL backend in
  // the WebContainers runtime (Node.js in the browser): npm install, Next.js,
  // Vite, Express, Prisma — full SaaS. You write the code, OCTOPUS persists,
  // runs and deploys it.
  {
    name: 'ce_create_session',
    description: 'Create a new Code Engine session — a full-stack project workspace that can run a real Node.js backend (Next.js, Vite, Express, Prisma) in the WebContainers runtime. | Crea una sesión del Code Engine: workspace full-stack con backend real.',
    inputSchema: {
      type: 'object',
      properties: { title: { type: 'string', description: 'Short project title' } },
      required: ['title'],
    },
  },
  {
    name: 'ce_list_sessions',
    description: 'List your Code Engine sessions (id, title, file count, last update). | Lista tus sesiones del Code Engine.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'ce_get_files',
    description: 'Read all files of a Code Engine session with full content. | Lee todos los archivos de una sesión del Code Engine con su contenido completo.',
    inputSchema: {
      type: 'object',
      properties: { sessionId: { type: 'string', description: 'Code Engine session id' } },
      required: ['sessionId'],
    },
  },
  {
    name: 'ce_write_files',
    description: 'Write or overwrite files in a Code Engine session (upsert by path; untouched files kept). Include package.json for full-stack projects so the runtime runs npm install + dev server. Returns the live runtime URL. | Escribe archivos en una sesión del Code Engine y devuelve la URL del runtime en vivo.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' },
        files: { type: 'array', items: FILES_SCHEMA, description: 'Files to write. Include package.json for backends.' },
      },
      required: ['sessionId', 'files'],
    },
  },
  {
    name: 'ce_runtime_url',
    description: 'Get the live WebContainers runtime URL for a Code Engine session (runs the real backend in the browser). | Devuelve la URL del runtime en vivo de una sesión del Code Engine.',
    inputSchema: {
      type: 'object',
      properties: { sessionId: { type: 'string' } },
      required: ['sessionId'],
    },
  },
  {
    name: 'ce_deploy',
    description: 'Deploy a Code Engine session to Octopus Hosting and get its public URL instantly (re-deploying updates the same site). Best for static/SPA output; for server-rendered apps the runtime URL is the live preview. | Despliega una sesión del Code Engine en Octopus Hosting con URL pública.',
    inputSchema: {
      type: 'object',
      properties: { sessionId: { type: 'string' } },
      required: ['sessionId'],
    },
  },
  {
    name: 'ce_scaffold_saas',
    description: 'Inject a complete, WORKING full-stack SaaS skeleton (Next.js 14 + Prisma/SQLite + NextAuth + optional Stripe) into a Code Engine session — deterministic boilerplate that boots in the WebContainers runtime immediately. Use this FIRST when building a SaaS, then add only the business logic with ce_write_files. SQLite runs fully in-browser (no Postgres server needed). | Inyecta un esqueleto SaaS full-stack completo y FUNCIONAL en una sesión del Code Engine.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Target Code Engine session. If omitted, a new session is created.' },
        appName: { type: 'string', description: 'Human-readable app name (e.g. "Acme SaaS").' },
        accent: { type: 'string', description: 'Hex accent color, default #8B5CF6.' },
        auth: { type: 'boolean', description: 'NextAuth email+password auth (default true).' },
        database: { type: 'boolean', description: 'Prisma + SQLite (default true; forced on if auth/payments).' },
        payments: { type: 'boolean', description: 'Stripe checkout + webhook + pricing page (default false).' },
      },
    },
  },
  {
    name: 'ce_generate_tests',
    description: 'Inject a runnable test harness (Vitest + Testing Library + example tests, plus optional Playwright E2E) into a Code Engine session, and wire `npm test` scripts + devDeps into its package.json. Gives any generated SaaS instant baseline coverage to extend. | Inyecta un harness de tests ejecutable (Vitest + Testing Library + Playwright) y cablea npm test en el package.json de la sesión.',
    inputSchema: {
      type: 'object',
      properties: { sessionId: { type: 'string' } },
      required: ['sessionId'],
    },
  },
  {
    name: 'ce_deploy_vps',
    description: "Deploy a Code Engine session to the user's own connected VPS (Hostinger VPS or any SSH server) and keep it running with PM2 — npm install + build + process restart for a REAL full-stack backend (unlike static Octopus Hosting). The VPS must be connected first in the dashboard (Brazos → VPS). SSH credentials are resolved server-side and NEVER exposed here. | Despliega una sesión del Code Engine al VPS propio del usuario y la deja corriendo con PM2.",
    inputSchema: {
      type: 'object',
      properties: { sessionId: { type: 'string' } },
      required: ['sessionId'],
    },
  },
]

/* ──────────────────────────────────────────────────────────────────────────
 * Implementación de herramientas — todo limitado al userId del token
 * ────────────────────────────────────────────────────────────────────────── */

function previewUrl(origin: string, projectId: string): string {
  return `${origin}/api/canvas/preview/${projectId}/index.html?vt=${canvasViewToken(projectId)}`
}

function cleanFiles(raw: unknown): CanvasFile[] {
  if (!Array.isArray(raw)) return []
  const files: CanvasFile[] = []
  for (const f of raw.slice(0, MAX_FILES_PER_CALL)) {
    const path = sanitizeCanvasPath(String((f as CanvasFile)?.path || ''))
    const content = (f as CanvasFile)?.content
    if (path && typeof content === 'string' && content.length > 0 && content.length < MAX_FILE_SIZE) {
      files.push({ path, content })
    }
  }
  return files
}

async function upsertProjectFiles(projectId: string, files: CanvasFile[]) {
  const existing = await withDbRetry(() => prisma.projectFile.findMany({
    where: { projectId },
    select: { id: true, path: true },
  }))
  const byPath = new Map(existing.map(f => [f.path, f.id]))
  for (const f of files) {
    const fileType = f.path.split('.').pop() || 'txt'
    const existingId = byPath.get(f.path)
    if (existingId) {
      await withDbRetry(() => prisma.projectFile.update({
        where: { id: existingId },
        data: { content: f.content, fileType },
      }))
    } else {
      await withDbRetry(() => prisma.projectFile.create({
        data: {
          projectId,
          name: f.path.split('/').pop() || f.path,
          path: f.path,
          content: f.content,
          fileType,
        },
      }))
    }
  }
}

interface TemplateMeta { d?: string; a?: string; c?: string }
function parseMeta(description: string | null): TemplateMeta {
  if (!description) return {}
  try { return JSON.parse(description) } catch { return { d: description } }
}

/* ── Code Engine helpers — archivos como BridgeCommand write_file ───────────── */

function runtimeUrl(origin: string, sessionId: string): string {
  return `${origin}/dashboard/claude-code/runtime?sessionId=${sessionId}`
}

/** Lee el mapa de archivos actual de una sesión (último write por path gana). */
async function ceReadFiles(sessionId: string): Promise<Map<string, string>> {
  const commands = await withDbRetry(() => prisma.bridgeCommand.findMany({
    where: { sessionId, type: 'write_file', status: { in: ['completed', 'approved'] } },
    select: { payload: true },
    orderBy: { createdAt: 'asc' },
  }))
  const fileMap = new Map<string, string>()
  for (const cmd of commands) {
    try {
      const p = JSON.parse(cmd.payload)
      if (p.path && typeof p.content === 'string') fileMap.set(String(p.path).replace(/\\/g, '/'), p.content)
    } catch { /* malformed */ }
  }
  return fileMap
}

/**
 * Escribe archivos en una sesión. Como el runtime lee el ÚLTIMO write por path,
 * borramos los write_file previos del mismo path para no acumular filas muertas
 * y dejar el historial limpio (upsert real).
 */
async function ceWriteFiles(sessionId: string, files: CanvasFile[]): Promise<void> {
  const incoming = new Set(files.map(f => f.path))
  // Elimina escrituras previas de los paths entrantes en un solo barrido (upsert)
  const prev = await withDbRetry(() => prisma.bridgeCommand.findMany({
    where: { sessionId, type: 'write_file' },
    select: { id: true, payload: true },
  }))
  const stale = prev.filter(c => {
    try { return incoming.has(String(JSON.parse(c.payload).path).replace(/\\/g, '/')) } catch { return false }
  }).map(c => c.id)
  if (stale.length > 0) {
    await withDbRetry(() => prisma.bridgeCommand.deleteMany({ where: { id: { in: stale } } }))
  }
  for (const f of files) {
    await withDbRetry(() => prisma.bridgeCommand.create({
      data: {
        sessionId,
        type: 'write_file',
        payload: JSON.stringify({ action: 'write_file', path: f.path, content: f.content }),
        status: 'completed',
      },
    }))
  }
}

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  userId: string,
  origin: string,
): Promise<unknown> {
  // Auto-migración idempotente: garantiza columnas de token tracking (Fase 4)
  // antes de cualquier herramienta del Code Engine que toque CodeSession.
  if (name.startsWith('ce_')) await ensureTokenColumns()

  switch (name) {
    case 'list_projects': {
      const projects = await withDbRetry(() => prisma.project.findMany({
        where: { userId, projectType: 'canvas' },
        orderBy: { updatedAt: 'desc' },
        take: 30,
        select: { id: true, name: true, updatedAt: true, _count: { select: { files: true } } },
      }))
      return {
        projects: projects.map(p => ({
          projectId: p.id,
          name: p.name,
          files: p._count.files,
          updatedAt: p.updatedAt,
          previewUrl: previewUrl(origin, p.id),
        })),
      }
    }

    case 'get_project': {
      const project = await withDbRetry(() => prisma.project.findFirst({
        where: { id: String(args.projectId || ''), userId, projectType: 'canvas' },
        include: { files: { select: { path: true, content: true }, orderBy: { path: 'asc' } } },
      }))
      if (!project) throw new Error('Project not found (check projectId with list_projects)')
      return {
        projectId: project.id,
        title: project.name,
        previewUrl: previewUrl(origin, project.id),
        files: project.files,
      }
    }

    case 'create_project': {
      const files = cleanFiles(args.files)
      if (files.length === 0) throw new Error('No valid files (paths must be relative, content non-empty, < 500KB each)')
      const title = String(args.title || 'Proyecto Canvas').slice(0, 120)
      const project = await withDbRetry(() => prisma.project.create({
        data: {
          userId,
          name: title,
          description: 'Construido vía MCP (Claude Code / cliente externo)',
          projectType: 'canvas',
          status: 'completed',
          progress: 100,
        },
      }))
      await upsertProjectFiles(project.id, files)
      return {
        projectId: project.id,
        title,
        filesCreated: files.map(f => f.path),
        previewUrl: previewUrl(origin, project.id),
        next: 'Open it in the OCTOPUS Canvas (/dashboard/jarvis?canvas=' + project.id + ') or call deploy_project for a public URL.',
      }
    }

    case 'update_files': {
      const project = await withDbRetry(() => prisma.project.findFirst({
        where: { id: String(args.projectId || ''), userId, projectType: 'canvas' },
        select: { id: true, name: true },
      }))
      if (!project) throw new Error('Project not found (check projectId with list_projects)')
      const files = cleanFiles(args.files)
      if (files.length === 0) throw new Error('No valid files (paths must be relative, content non-empty, < 500KB each)')
      await upsertProjectFiles(project.id, files)
      await withDbRetry(() => prisma.project.update({
        where: { id: project.id },
        data: { updatedAt: new Date() },
      }))
      return {
        projectId: project.id,
        filesUpdated: files.map(f => f.path),
        previewUrl: previewUrl(origin, project.id),
      }
    }

    case 'deploy_project': {
      const project = await withDbRetry(() => prisma.project.findFirst({
        where: { id: String(args.projectId || ''), userId, projectType: 'canvas' },
        include: { files: { select: { path: true, content: true } } },
      }))
      if (!project) throw new Error('Project not found (check projectId with list_projects)')
      const files = project.files
        .filter(f => f.content != null)
        .map(f => ({ path: f.path, content: f.content as string }))
      if (files.length === 0) throw new Error('Project has no files to deploy')
      const { siteId, slug } = await publishFilesToOctopus(userId, { id: project.id, name: project.name }, files)
      return {
        success: true,
        siteId,
        url: `${origin}/sites/${slug}`,
        filesDeployed: files.length,
        note: 'Live now. The Sitio Vivo collector tracks views and JS errors — check them with site_analytics.',
      }
    }

    case 'list_sites': {
      const sites = await withDbRetry(() => prisma.hostedSite.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: 30,
        select: { id: true, name: true, slug: true, status: true, fileCount: true, version: true, sessionId: true, updatedAt: true },
      }))
      return {
        sites: sites.map(s => ({
          siteId: s.id,
          name: s.name,
          url: `${origin}/sites/${s.slug}`,
          status: s.status,
          files: s.fileCount,
          version: s.version,
          canvasProjectId: s.sessionId?.startsWith('canvas:') ? s.sessionId.slice(7) : null,
          updatedAt: s.updatedAt,
        })),
      }
    }

    case 'site_analytics': {
      const site = await withDbRetry(() => prisma.hostedSite.findFirst({
        where: { id: String(args.siteId || ''), userId },
        select: { id: true, name: true, slug: true },
      }))
      if (!site) throw new Error('Site not found (check siteId with list_sites)')

      const since = new Date()
      since.setDate(since.getDate() - 7)
      const [totalViews, views, errorViews] = await Promise.all([
        withDbRetry(() => prisma.hostedSiteView.count({
          where: { siteId: site.id, createdAt: { gte: since }, path: { not: { startsWith: '__error_' } } },
        })),
        withDbRetry(() => prisma.hostedSiteView.findMany({
          where: { siteId: site.id, createdAt: { gte: since }, path: { not: { startsWith: '__error_' } } },
          select: { path: true, referrer: true },
          take: 2000,
        })),
        withDbRetry(() => prisma.hostedSiteView.findMany({
          where: { siteId: site.id, createdAt: { gte: since }, path: { startsWith: '__error_' } },
          select: { referrer: true, country: true },
          take: 200,
        })),
      ])

      const count = (vals: (string | null)[]) => {
        const m = new Map<string, number>()
        for (const v of vals) { if (v) m.set(v, (m.get(v) || 0) + 1) }
        return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, n]) => ({ value: k, count: n }))
      }

      const uniqueErrors = [...new Set(errorViews.map(e => `[${e.country || 'js'}] ${e.referrer || ''}`.trim()))].slice(0, 5)

      return {
        site: site.name,
        url: `${origin}/sites/${site.slug}`,
        period: 'last 7 days',
        totalViews,
        topPages: count(views.map(v => v.path || '/')),
        topReferrers: count(views.map(v => v.referrer)),
        productionErrors: uniqueErrors,
        hint: uniqueErrors.length > 0
          ? 'Fix the errors with update_files on the linked Canvas project, then deploy_project again.'
          : 'No JS errors captured in production. ✅',
      }
    }

    case 'search_templates': {
      const search = String(args.search || '').toLowerCase()
      const category = String(args.category || '')
      const templates = await withDbRetry(() => prisma.project.findMany({
        where: { projectType: 'canvas_template' },
        orderBy: [{ progress: 'desc' }, { updatedAt: 'desc' }],
        take: 100,
        select: { id: true, name: true, description: true, progress: true, userId: true, _count: { select: { files: true } } },
      }))
      return {
        templates: templates
          .map(t => {
            const meta = parseMeta(t.description)
            return {
              templateId: t.id,
              name: t.name,
              description: meta.d || '',
              author: meta.a || 'Anónimo',
              category: meta.c || 'general',
              forks: t.progress,
              files: t._count.files,
              isMine: t.userId === userId,
            }
          })
          .filter(t =>
            (!search || t.name.toLowerCase().includes(search) || t.description.toLowerCase().includes(search)) &&
            (!category || category === 'all' || t.category === category)
          )
          .slice(0, 30),
      }
    }

    case 'fork_template': {
      const template = await withDbRetry(() => prisma.project.findFirst({
        where: { id: String(args.templateId || ''), projectType: 'canvas_template' },
        include: { files: { select: { name: true, path: true, content: true, fileType: true } } },
      }))
      if (!template) throw new Error('Template not found (check templateId with search_templates)')
      const fork = await withDbRetry(() => prisma.project.create({
        data: {
          userId,
          name: template.name,
          description: 'Plantilla de la comunidad — fork vía MCP',
          projectType: 'canvas',
          status: 'completed',
          progress: 100,
        },
      }))
      for (const f of template.files) {
        await withDbRetry(() => prisma.projectFile.create({
          data: { projectId: fork.id, name: f.name, path: f.path, content: f.content, fileType: f.fileType },
        }))
      }
      if (template.userId !== userId) {
        await withDbRetry(() => prisma.project.update({
          where: { id: template.id },
          data: { progress: { increment: 1 } },
        }))
      }
      return {
        projectId: fork.id,
        title: fork.name,
        previewUrl: previewUrl(origin, fork.id),
        next: 'Customize it with update_files or open it in the Canvas, then deploy_project.',
      }
    }

    // ─── CODE ENGINE ─────────────────────────────────────────────────────────
    case 'ce_create_session': {
      const cs = await withDbRetry(() => prisma.codeSession.create({
        data: {
          userId,
          model: 'mcp/external',  // el LLM es el cliente MCP (Claude Code), no uno interno
          title: String(args.title || 'Proyecto Code Engine').slice(0, 120),
        },
      }))
      return {
        sessionId: cs.id,
        title: cs.title,
        next: 'Write files with ce_write_files (include package.json for full-stack). Then open ce_runtime_url to run the real backend, or ce_deploy for a public URL.',
      }
    }

    case 'ce_list_sessions': {
      const sessions = await withDbRetry(() => prisma.codeSession.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: 30,
        select: { id: true, title: true, updatedAt: true, _count: { select: { commands: true } } },
      }))
      // Conteo de archivos = write_file distintos por sesión (aprox: usa commands count)
      return {
        sessions: sessions.map(s => ({
          sessionId: s.id,
          title: s.title,
          commands: s._count.commands,
          updatedAt: s.updatedAt,
          runtimeUrl: runtimeUrl(origin, s.id),
        })),
      }
    }

    case 'ce_get_files': {
      const sessionId = String(args.sessionId || '')
      const cs = await withDbRetry(() => prisma.codeSession.findFirst({
        where: { id: sessionId, userId }, select: { id: true, title: true },
      }))
      if (!cs) throw new Error('Code Engine session not found (check sessionId with ce_list_sessions)')
      const fileMap = await ceReadFiles(sessionId)
      return {
        sessionId: cs.id,
        title: cs.title,
        files: [...fileMap.entries()].map(([path, content]) => ({ path, content })),
      }
    }

    case 'ce_write_files': {
      const sessionId = String(args.sessionId || '')
      const cs = await withDbRetry(() => prisma.codeSession.findFirst({
        where: { id: sessionId, userId }, select: { id: true },
      }))
      if (!cs) throw new Error('Code Engine session not found (check sessionId with ce_list_sessions)')
      const files = cleanFiles(args.files)
      if (files.length === 0) throw new Error('No valid files (paths must be relative, content non-empty, < 500KB each)')
      await ceWriteFiles(sessionId, files)
      await withDbRetry(() => prisma.codeSession.update({
        where: { id: sessionId }, data: { updatedAt: new Date() },
      }))
      const hasPkg = files.some(f => f.path === 'package.json')
      return {
        sessionId,
        filesWritten: files.map(f => f.path),
        runtimeUrl: runtimeUrl(origin, sessionId),
        note: hasPkg
          ? 'package.json detected — the runtime will run npm install + dev server (Next.js/Vite/Express).'
          : 'Static project — the runtime will serve it. Add a package.json to run a real backend.',
      }
    }

    case 'ce_runtime_url': {
      const sessionId = String(args.sessionId || '')
      const cs = await withDbRetry(() => prisma.codeSession.findFirst({
        where: { id: sessionId, userId }, select: { id: true },
      }))
      if (!cs) throw new Error('Code Engine session not found (check sessionId with ce_list_sessions)')
      const fileMap = await ceReadFiles(sessionId)
      if (fileMap.size === 0) throw new Error('Session has no files yet — write some with ce_write_files first')
      return {
        runtimeUrl: runtimeUrl(origin, sessionId),
        note: 'Open this URL in a browser to run the project live (Node.js in the browser via WebContainers).',
      }
    }

    case 'ce_deploy': {
      const sessionId = String(args.sessionId || '')
      const cs = await withDbRetry(() => prisma.codeSession.findFirst({
        where: { id: sessionId, userId }, select: { id: true, title: true },
      }))
      if (!cs) throw new Error('Code Engine session not found (check sessionId with ce_list_sessions)')
      const fileMap = await ceReadFiles(sessionId)
      if (fileMap.size === 0) throw new Error('Session has no files to deploy')
      const files = [...fileMap.entries()].map(([path, content]) => ({ path, content }))
      const { siteId, slug } = await publishFilesToOctopus(
        userId, { id: cs.id, name: cs.title }, files, `code:${cs.id}`,
      )
      return {
        success: true,
        siteId,
        url: `${origin}/sites/${slug}`,
        filesDeployed: files.length,
        note: 'Static/SPA files are now live. For server-rendered apps, ce_runtime_url is the live full-stack preview.',
      }
    }

    case 'ce_scaffold_saas': {
      // Resuelve la sesión destino: usa la dada o crea una nueva.
      let sessionId = String(args.sessionId || '')
      let createdSession = false
      if (sessionId) {
        const cs = await withDbRetry(() => prisma.codeSession.findFirst({
          where: { id: sessionId, userId }, select: { id: true },
        }))
        if (!cs) throw new Error('Code Engine session not found (check sessionId with ce_list_sessions)')
      } else {
        const cs = await withDbRetry(() => prisma.codeSession.create({
          data: {
            userId,
            model: 'mcp/external',
            title: String(args.appName || 'SaaS Scaffold').slice(0, 120),
          },
        }))
        sessionId = cs.id
        createdSession = true
      }

      const files = buildSaasScaffoldFiles({
        appName: args.appName ? String(args.appName) : undefined,
        accent: args.accent ? String(args.accent) : undefined,
        auth: typeof args.auth === 'boolean' ? args.auth : undefined,
        database: typeof args.database === 'boolean' ? args.database : undefined,
        payments: typeof args.payments === 'boolean' ? args.payments : undefined,
      })
      await ceWriteFiles(sessionId, files)
      await withDbRetry(() => prisma.codeSession.update({
        where: { id: sessionId }, data: { updatedAt: new Date() },
      }))
      return {
        sessionId,
        createdSession,
        filesWritten: files.map(f => f.path),
        fileCount: files.length,
        runtimeUrl: runtimeUrl(origin, sessionId),
        next: 'Scaffold ready. Open runtimeUrl to boot the live full-stack app (npm install + prisma + next dev run automatically), or add business logic with ce_write_files. Replace .env placeholders before production.',
      }
    }

    case 'ce_generate_tests': {
      const sessionId = String(args.sessionId || '')
      const cs = await withDbRetry(() => prisma.codeSession.findFirst({
        where: { id: sessionId, userId }, select: { id: true },
      }))
      if (!cs) throw new Error('Code Engine session not found (check sessionId with ce_list_sessions)')

      const harness = buildTestScaffoldFiles()
      // Si hay package.json, cablea scripts + devDeps de test sin pisar lo existente.
      const fileMap = await ceReadFiles(sessionId)
      const pkg = fileMap.get('package.json')
      const toWrite: CanvasFile[] = [...harness]
      let packageJsonUpdated = false
      if (pkg) {
        const merged = mergeTestDepsIntoPackageJson(pkg)
        if (merged !== pkg) {
          toWrite.push({ path: 'package.json', content: merged })
          packageJsonUpdated = true
        }
      }
      await ceWriteFiles(sessionId, toWrite)
      await withDbRetry(() => prisma.codeSession.update({
        where: { id: sessionId }, data: { updatedAt: new Date() },
      }))
      return {
        sessionId,
        filesWritten: toWrite.map(f => f.path),
        packageJsonUpdated,
        runtimeUrl: runtimeUrl(origin, sessionId),
        next: packageJsonUpdated
          ? 'Tests wired. Run `npm test` (Vitest) in the runtime/terminal; Playwright E2E via `npm run test:e2e`. Add business-specific cases on top.'
          : 'Test files added. No package.json found — add one (or run ce_scaffold_saas first) so `npm test` works.',
      }
    }

    case 'ce_deploy_vps': {
      const sessionId = String(args.sessionId || '')
      const cs = await withDbRetry(() => prisma.codeSession.findFirst({
        where: { id: sessionId, userId }, select: { id: true },
      }))
      if (!cs) throw new Error('Code Engine session not found (check sessionId with ce_list_sessions)')
      // Credenciales SSH resueltas server-side; jamás se devuelven al cliente/LLM.
      const result = await deploySessionToVps(userId, sessionId)
      if (!result.success) {
        throw new Error(result.error || 'VPS deploy failed. Connect a VPS in the dashboard (Brazos → VPS) first.')
      }
      return {
        success: true,
        url: result.url,
        appName: result.appName,
        filesDeployed: result.filesCount,
        // Solo logs de proceso (sin credenciales).
        logTail: result.logs.slice(-12),
        note: 'Full-stack app is live on your VPS via PM2. Re-deploying reloads the same process.',
      }
    }

    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * JSON-RPC dispatcher
 * ────────────────────────────────────────────────────────────────────────── */

async function handleMessage(msg: JsonRpcMsg, userId: string, origin: string) {
  // Notificaciones (sin id) no llevan respuesta — notifications/initialized, etc.
  const hasId = msg.id !== undefined && msg.id !== null
  if (!hasId) return null
  const id = msg.id as number | string

  if (msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    return rpcError(id, -32600, 'Invalid Request')
  }

  switch (msg.method) {
    case 'initialize': {
      const requested = String(msg.params?.protocolVersion || '')
      return rpcResult(id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'octopus-omni-cockpit', title: 'OCTOPUS Omni Cockpit', version: '1.0.0' },
        instructions: 'OCTOPUS Omni Cockpit MCP server. Build static web projects in the user\'s Canvas (create_project → deploy_project returns an instant public URL on Octopus Hosting), read 7-day production analytics including real JS errors (site_analytics), and browse or fork community templates. Every operation is scoped to the token owner\'s OCTOPUS account.',
      })
    }
    case 'ping':
      return rpcResult(id, {})
    case 'tools/list':
      return rpcResult(id, { tools: TOOL_CATALOG })
    case 'tools/call': {
      const name = String(msg.params?.name || '')
      const args = (msg.params?.arguments || {}) as Record<string, unknown>
      if (!TOOL_CATALOG.some(t => t.name === name)) {
        return rpcError(id, -32602, `Unknown tool: ${name}`)
      }
      try {
        const result = await executeTool(name, args, userId, origin)
        return rpcResult(id, {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        })
      } catch (error) {
        // Errores de herramienta van DENTRO del result (spec MCP), no como error JSON-RPC
        return rpcResult(id, {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'tool execution failed'}` }],
          isError: true,
        })
      }
    }
    default:
      return rpcError(id, -32601, `Method not found: ${msg.method}`)
  }
}

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.replace(/^Bearer\s+/i, '').trim()
  const userId = verifyMcpServerToken(token)
  if (!userId) {
    return NextResponse.json(
      rpcError(null, -32001, 'Unauthorized. Pass "Authorization: Bearer <token>" — get your token at /dashboard/mcp-server'),
      { status: 401, headers: { 'WWW-Authenticate': 'Bearer realm="octopus-mcp"' } },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(rpcError(null, -32700, 'Parse error'), { status: 400 })
  }

  const origin = process.env.NEXTAUTH_URL || new URL(request.url).origin
  const messages = (Array.isArray(body) ? body : [body]) as JsonRpcMsg[]
  const responses: Awaited<ReturnType<typeof handleMessage>>[] = []
  for (const m of messages) {
    const r = await handleMessage(m, userId, origin)
    if (r) responses.push(r)
  }

  // Solo notificaciones → 202 Accepted sin cuerpo (spec Streamable HTTP)
  if (responses.length === 0) return new NextResponse(null, { status: 202 })
  return NextResponse.json(Array.isArray(body) ? responses : responses[0])
}

// Sin stream SSE servidor→cliente: servidor sin estado (la spec permite 405)
export async function GET() {
  return new NextResponse('Method Not Allowed — POST JSON-RPC to this endpoint', {
    status: 405,
    headers: { Allow: 'POST' },
  })
}

export async function DELETE() {
  return new NextResponse(null, { status: 405, headers: { Allow: 'POST' } })
}
