/**
 * Sprint S3: Hostinger One-Click Deploy
 * Deploys static site files to Hostinger hosting.
 * 
 * Strategy:
 * 1. Collect all session files from DB
 * 2. Create ZIP archive in memory
 * 3. Upload via Hostinger API (hosting/deploy endpoint)
 * 4. If API unavailable, provide ZIP for manual upload
 *
 * Credentials come from ArmConnection (armType: 'hostinger').
 */

import { prisma } from '@/lib/prisma'
import archiver from 'archiver'
import { PassThrough } from 'stream'

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface HostingerCredentials {
  apiKey: string
  domain: string
}

export interface SessionFile {
  path: string
  content: string
}

export interface HostingerDeployResult {
  success: boolean
  domain?: string
  filesCount?: number
  method?: 'api' | 'zip_ready'
  zipBuffer?: Buffer
  error?: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET CREDENTIALS
// ═══════════════════════════════════════════════════════════════════════════════

export async function getHostingerCredentials(userId: string): Promise<HostingerCredentials | null> {
  const conn = await prisma.armConnection.findFirst({
    where: { userId, armType: 'hostinger', status: 'connected' },
    select: { credentials: true },
  })
  if (!conn) return null
  try {
    const creds = JSON.parse(conn.credentials)
    if (!creds.apiKey || !creds.domain) return null
    return { apiKey: creds.apiKey, domain: creds.domain }
  } catch {
    return null
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COLLECT SESSION FILES
// ═══════════════════════════════════════════════════════════════════════════════

export async function collectSessionFiles(sessionId: string): Promise<SessionFile[]> {
  const commands = await prisma.bridgeCommand.findMany({
    where: {
      sessionId,
      type: 'write_file',
      status: { in: ['completed', 'approved', 'executing'] },
    },
    orderBy: { createdAt: 'asc' },
  })

  // Deduplicate: last write wins per path
  const fileMap = new Map<string, string>()
  for (const cmd of commands) {
    try {
      const p = JSON.parse(cmd.payload as string)
      const path = (p.path || p.filePath || '').replace(/\\/g, '/').replace(/^\/+/, '')
      const content = p.content || ''
      if (path && content) fileMap.set(path, content)
    } catch { /* skip malformed */ }
  }

  return Array.from(fileMap.entries()).map(([path, content]) => ({ path, content }))
}

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE ZIP BUFFER
// ═══════════════════════════════════════════════════════════════════════════════

export async function createZipBuffer(files: SessionFile[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const passThrough = new PassThrough()
    const archive = archiver('zip', { zlib: { level: 9 } })

    passThrough.on('data', (chunk: Buffer) => chunks.push(chunk))
    passThrough.on('end', () => resolve(Buffer.concat(chunks)))
    passThrough.on('error', reject)
    archive.on('error', reject)

    archive.pipe(passThrough)

    for (const file of files) {
      archive.append(file.content, { name: file.path })
    }

    archive.finalize()
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOSTINGER API DEPLOY
// ═══════════════════════════════════════════════════════════════════════════════

const HOSTINGER_API = 'https://api.hostinger.com'

/**
 * Attempt to deploy via Hostinger's REST API.
 * Tries multiple known endpoint patterns.
 * Returns success if any pattern works.
 */
async function tryHostingerAPIDeploy(
  apiKey: string,
  domain: string,
  zipBuffer: Buffer
): Promise<{ success: boolean; error?: string }> {
  // Step 1: Find the hosting subscription for this domain
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/json',
  }

  // Try to list hosting subscriptions to find the right one
  let subscriptionId: string | null = null
  try {
    const listRes = await fetch(`${HOSTINGER_API}/api/hosting/v1/hosting`, {
      headers,
    })
    if (listRes.ok) {
      const hostings = await listRes.json()
      // Find hosting matching the domain
      if (Array.isArray(hostings)) {
        const match = hostings.find((h: Record<string, unknown>) => {
          const domains = (h.domains as string[]) || []
          const mainDomain = h.domain as string
          return mainDomain === domain || domains.includes(domain)
        })
        if (match) subscriptionId = String(match.id || match.subscription_id)
      }
    }
  } catch (e) {
    console.warn('[HostingerDeploy] Could not list hostings:', e)
  }

  if (!subscriptionId) {
    return { success: false, error: `No se encontró hosting para el dominio ${domain}. Verifica tu API Key y dominio.` }
  }

  // Step 2: Upload ZIP to the hosting
  // Try the deploy endpoint with multipart form data
  try {
    const formData = new FormData()
    const blob = new Blob([zipBuffer], { type: 'application/zip' })
    formData.append('archive', blob, `deploy_${Date.now()}.zip`)
    formData.append('domain', domain)

    // Try the most likely deploy endpoints
    const endpoints = [
      `/api/hosting/v1/hosting/${subscriptionId}/website/deploy`,
      `/api/hosting/v1/hosting/${subscriptionId}/deploys`,
      `/api/hosting/v1/hosting/${subscriptionId}/files/upload`,
    ]

    for (const endpoint of endpoints) {
      try {
        const deployRes = await fetch(`${HOSTINGER_API}${endpoint}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}` },
          body: formData,
        })
        if (deployRes.ok) {
          const data = await deployRes.json().catch(() => ({}))
          console.log(`[HostingerDeploy] ✓ Deployed via ${endpoint}:`, data)
          return { success: true }
        }
        // 404 = wrong endpoint, try next. Other errors = stop.
        if (deployRes.status !== 404) {
          const errData = await deployRes.json().catch(() => ({}))
          return { success: false, error: `Hostinger API (${deployRes.status}): ${errData.error || errData.message || 'Error desconocido'}` }
        }
      } catch { /* try next endpoint */ }
    }

    return { success: false, error: 'No se pudo encontrar el endpoint de deploy de Hostinger. Se generará un ZIP para subir manualmente.' }
  } catch (e) {
    return { success: false, error: `Error de conexión con Hostinger: ${e instanceof Error ? e.message : 'unknown'}` }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════════════════

export async function deployToHostinger(
  userId: string,
  sessionId: string
): Promise<HostingerDeployResult> {
  // 1. Get credentials
  const creds = await getHostingerCredentials(userId)
  if (!creds) {
    return { success: false, error: 'No hay credenciales de Hostinger configuradas. Conecta tu cuenta en Brazos Activos.' }
  }

  // 2. Collect files
  const files = await collectSessionFiles(sessionId)
  if (files.length === 0) {
    return { success: false, error: 'No hay archivos en esta sesión. Genera un proyecto primero.' }
  }

  // 3. Create ZIP
  const zipBuffer = await createZipBuffer(files)
  console.log(`[HostingerDeploy] Created ZIP: ${files.length} files, ${(zipBuffer.length / 1024).toFixed(1)}KB`)

  // 4. Try API deploy
  const apiResult = await tryHostingerAPIDeploy(creds.apiKey, creds.domain, zipBuffer)
  if (apiResult.success) {
    return {
      success: true,
      domain: creds.domain,
      filesCount: files.length,
      method: 'api',
    }
  }

  // 5. Fallback: return ZIP buffer for manual download
  console.log(`[HostingerDeploy] API deploy failed, falling back to ZIP download: ${apiResult.error}`)
  return {
    success: true,
    domain: creds.domain,
    filesCount: files.length,
    method: 'zip_ready',
    zipBuffer,
  }
}

/**
 * Variante para el Canvas: despliega una lista de archivos directa
 * (sin pasar por CodeSession/BridgeCommand).
 */
export async function deployFilesToHostinger(
  userId: string,
  files: SessionFile[]
): Promise<HostingerDeployResult> {
  const creds = await getHostingerCredentials(userId)
  if (!creds) {
    return { success: false, error: 'No hay credenciales de Hostinger configuradas. Conecta tu cuenta en Brazos Activos.' }
  }
  if (files.length === 0) {
    return { success: false, error: 'El proyecto no tiene archivos.' }
  }

  const zipBuffer = await createZipBuffer(files)
  console.log(`[HostingerDeploy/Canvas] ZIP: ${files.length} archivos, ${(zipBuffer.length / 1024).toFixed(1)}KB`)

  const apiResult = await tryHostingerAPIDeploy(creds.apiKey, creds.domain, zipBuffer)
  if (apiResult.success) {
    return { success: true, domain: creds.domain, filesCount: files.length, method: 'api' }
  }

  console.log(`[HostingerDeploy/Canvas] API falló, fallback ZIP: ${apiResult.error}`)
  return { success: true, domain: creds.domain, filesCount: files.length, method: 'zip_ready', zipBuffer }
}
