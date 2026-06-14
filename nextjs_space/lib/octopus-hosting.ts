/**
 * Publicación en Octopus Hosting — lógica compartida.
 *
 * Usada por /api/canvas/deploy (botón Deploy del Canvas) y por /api/mcp
 * (clientes MCP externos como Claude Code). Un proyecto Canvas se vincula a
 * su HostedSite vía sessionId = canvas:{projectId}; publicar reemplaza los
 * archivos con el estado exacto del Canvas e incrementa la versión.
 */
import { prisma, withDbRetry } from '@/lib/prisma'
import { contentTypeFor, type CanvasFile } from '@/lib/octopus-canvas'

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'sitio'
}

export async function publishFilesToOctopus(
  userId: string,
  project: { id: string; name: string },
  files: CanvasFile[],
  linkTagOverride?: string,
): Promise<{ siteId: string; slug: string }> {
  // linkTag vincula el HostedSite a su origen: 'canvas:{id}' (Canvas) o
  // 'code:{sessionId}' (Code Engine). Re-publicar usa el mismo sitio.
  const linkTag = linkTagOverride || `canvas:${project.id}`
  let site = await withDbRetry(() => prisma.hostedSite.findFirst({
    where: { userId, sessionId: linkTag },
  }))

  if (!site) {
    // Slug único: del título + sufijo si colisiona
    let slug = slugify(project.name)
    for (let i = 0; i < 5; i++) {
      const candidate = i === 0 ? slug : `${slug}-${Math.random().toString(36).slice(2, 6)}`
      const exists = await withDbRetry(() => prisma.hostedSite.findUnique({ where: { slug: candidate } }))
      if (!exists) { slug = candidate; break }
    }
    site = await withDbRetry(() => prisma.hostedSite.create({
      data: {
        userId,
        sessionId: linkTag,
        slug,
        name: project.name,
        status: 'active',
      },
    }))
  }

  // Reemplazar archivos (publicación = estado exacto del Canvas)
  await withDbRetry(() => prisma.hostedSiteFile.deleteMany({ where: { siteId: site!.id } }))
  let totalSize = 0
  for (const f of files) {
    totalSize += Buffer.byteLength(f.content)
    await withDbRetry(() => prisma.hostedSiteFile.create({
      data: {
        siteId: site!.id,
        filePath: f.path,
        content: f.content,
        mimeType: contentTypeFor(f.path).split(';')[0],
        size: Buffer.byteLength(f.content),
      },
    }))
  }
  await withDbRetry(() => prisma.hostedSite.update({
    where: { id: site!.id },
    data: { fileCount: files.length, totalSize, version: { increment: 1 }, status: 'active' },
  }))

  return { siteId: site.id, slug: site.slug }
}
