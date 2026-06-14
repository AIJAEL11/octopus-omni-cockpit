/**
 * VPS Deploy (Fase 4) — despliega un proyecto del Code Engine a un VPS propio
 * (Hostinger VPS o cualquier servidor SSH) y lo deja corriendo con PM2.
 *
 * A diferencia del runtime WebContainers (preview en el navegador) y de Octopus
 * Hosting (estático), esto corre el backend full-stack REAL en un servidor del
 * usuario: npm install + build + PM2 startOrReload tras un proxy.
 *
 * SEGURIDAD (regla inviolable de OCTOPUS): las credenciales SSH (password o
 * llave privada) NUNCA pasan por ningún LLM. Viven en ArmConnection
 * (armType:'vps'), se leen SOLO server-side aquí, y jamás se devuelven al
 * cliente ni se incluyen en respuestas de herramientas MCP. El LLM solo conoce
 * el sessionId; este módulo resuelve las credenciales del lado del servidor.
 */

import { prisma } from '@/lib/prisma'
import { NodeSSH } from 'node-ssh'
import { collectSessionFiles, type SessionFile } from '@/lib/hostinger-deploy'

export interface VpsCredentials {
  host: string
  port: number
  username: string
  /** Autenticación: contraseña o llave privada (una de las dos). */
  password?: string
  privateKey?: string
  passphrase?: string
  /** Ruta de despliegue en el servidor, ej. /var/www/miapp. */
  deployPath: string
  /** Nombre del proceso PM2. */
  appName: string
  /** Puerto en el que la app escucha en el servidor (default 3000). */
  appPort: number
  /** Dominio/URL pública para devolver tras el deploy (opcional). */
  domain?: string
}

export interface VpsDeployResult {
  success: boolean
  url?: string
  appName?: string
  filesCount?: number
  error?: string
  logs: string[]
}

type LogFn = (line: string) => void

/** Lee y valida las credenciales VPS del usuario (server-side, nunca al LLM). */
export async function getVpsCredentials(userId: string): Promise<VpsCredentials | null> {
  const conn = await prisma.armConnection.findFirst({
    where: { userId, armType: 'vps', status: 'connected' },
    select: { credentials: true },
  })
  if (!conn) return null
  try {
    const c = JSON.parse(conn.credentials)
    if (!c.host || !c.username || (!c.password && !c.privateKey)) return null
    return {
      host: String(c.host),
      port: Number(c.port) || 22,
      username: String(c.username),
      password: c.password ? String(c.password) : undefined,
      privateKey: c.privateKey ? String(c.privateKey) : undefined,
      passphrase: c.passphrase ? String(c.passphrase) : undefined,
      deployPath: String(c.deployPath || `/var/www/${c.appName || 'octopus-app'}`),
      appName: String(c.appName || 'octopus-app').replace(/[^a-zA-Z0-9_-]/g, '') || 'octopus-app',
      appPort: Number(c.appPort) || 3000,
      domain: c.domain ? String(c.domain) : undefined,
    }
  } catch {
    return null
  }
}

/** Construye la config de conexión de node-ssh desde las credenciales. */
function connectionConfig(c: VpsCredentials) {
  return {
    host: c.host,
    port: c.port,
    username: c.username,
    ...(c.privateKey ? { privateKey: c.privateKey, passphrase: c.passphrase } : { password: c.password }),
    readyTimeout: 20_000,
    keepaliveInterval: 10_000,
  }
}

/**
 * Prueba la conexión SSH (usado por el endpoint de conectar el brazo).
 * No despliega nada — solo verifica acceso y devuelve el hostname remoto.
 */
export async function testVpsConnection(c: VpsCredentials): Promise<{ ok: boolean; info?: string; error?: string }> {
  const ssh = new NodeSSH()
  try {
    await ssh.connect(connectionConfig(c))
    const res = await ssh.execCommand('uname -a && node -v 2>/dev/null || true')
    return { ok: true, info: res.stdout.trim().slice(0, 300) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error de conexión SSH' }
  } finally {
    ssh.dispose()
  }
}

/** Escapa una cadena para usarla entre comillas simples en shell. */
function shq(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`
}

/**
 * Despliega una sesión del Code Engine al VPS:
 *  1. Conecta por SSH.
 *  2. Crea deployPath y sube todos los archivos del proyecto (sftp).
 *  3. npm install (prod) + npm run build (si hay script build).
 *  4. Escribe un ecosystem PM2 y hace pm2 startOrReload (instala PM2 si falta).
 */
export async function deploySessionToVps(
  userId: string,
  sessionId: string,
  onLog?: LogFn,
): Promise<VpsDeployResult> {
  const logs: string[] = []
  const log = (line: string) => { logs.push(line); onLog?.(line) }

  const creds = await getVpsCredentials(userId)
  if (!creds) {
    return { success: false, error: 'No hay un VPS conectado. Conéctalo en Brazos Activos (brazo VPS).', logs }
  }

  // Verifica propiedad de la sesión.
  const cs = await prisma.codeSession.findFirst({ where: { id: sessionId, userId }, select: { id: true } })
  if (!cs) return { success: false, error: 'Sesión no encontrada.', logs }

  const files = await collectSessionFiles(sessionId)
  if (files.length === 0) {
    return { success: false, error: 'La sesión no tiene archivos. Genera un proyecto primero.', logs }
  }

  const ssh = new NodeSSH()
  try {
    log(`→ Conectando a ${creds.username}@${creds.host}:${creds.port}…`)
    await ssh.connect(connectionConfig(creds))
    log('✓ Conexión SSH establecida')

    const path = creds.deployPath
    await ssh.execCommand(`mkdir -p ${shq(path)}`)
    log(`→ Subiendo ${files.length} archivos a ${path}…`)

    // Sube cada archivo por sftp (putFiles requiere archivos locales; usamos
    // putFile con buffers vía contenido escrito en streams no está disponible,
    // así que escribimos con sftp directamente).
    const sftp = await ssh.requestSFTP()
    await uploadFilesViaSftp(sftp, path, files, log)
    log('✓ Archivos subidos')

    const hasPkg = files.some(f => f.path === 'package.json')
    if (hasPkg) {
      log('→ npm install (producción)…')
      const install = await ssh.execCommand('npm install --no-audit --no-fund', { cwd: path })
      if (install.code !== 0) {
        log(install.stderr.slice(-1500))
        return { success: false, error: 'Falló npm install en el VPS.', logs }
      }
      log('✓ Dependencias instaladas')

      const pkg = files.find(f => f.path === 'package.json')!.content
      const hasBuild = /"build"\s*:/.test(pkg)
      if (hasBuild) {
        log('→ npm run build…')
        const build = await ssh.execCommand('npm run build', { cwd: path })
        if (build.code !== 0) {
          log(build.stderr.slice(-1500))
          return { success: false, error: 'Falló npm run build en el VPS.', logs }
        }
        log('✓ Build completado')
      }

      // PM2: instala si falta, escribe ecosystem y recarga.
      log('→ Configurando PM2…')
      await ssh.execCommand('command -v pm2 >/dev/null 2>&1 || npm install -g pm2')
      const ecosystem = buildPm2Ecosystem(creds)
      const sftp2 = await ssh.requestSFTP()
      await writeRemoteFile(sftp2, `${path}/ecosystem.config.js`, ecosystem)
      const startCmd = `pm2 startOrReload ecosystem.config.js && pm2 save`
      const start = await ssh.execCommand(startCmd, { cwd: path })
      log(start.stdout.slice(-800) || start.stderr.slice(-800))
      if (start.code !== 0) {
        return { success: false, error: 'PM2 no pudo arrancar la app. Revisa los logs.', logs }
      }
      log(`✓ App "${creds.appName}" corriendo en el puerto ${creds.appPort} (PM2)`)
    } else {
      log('• Proyecto estático (sin package.json): archivos servidos desde el deployPath.')
    }

    const url = creds.domain
      ? (creds.domain.startsWith('http') ? creds.domain : `https://${creds.domain}`)
      : `http://${creds.host}:${creds.appPort}`
    log(`✓ Deploy completo → ${url}`)
    return { success: true, url, appName: creds.appName, filesCount: files.length, logs }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error desconocido en el deploy'
    log(`✗ ${msg}`)
    return { success: false, error: msg, logs }
  } finally {
    ssh.dispose()
  }
}

/** Genera el ecosystem.config.js de PM2 para la app. */
function buildPm2Ecosystem(c: VpsCredentials): string {
  return `module.exports = {
  apps: [{
    name: ${JSON.stringify(c.appName)},
    script: 'npm',
    args: 'start',
    cwd: ${JSON.stringify(c.deployPath)},
    env: { NODE_ENV: 'production', PORT: ${JSON.stringify(String(c.appPort))} },
    autorestart: true,
    max_memory_restart: '512M',
  }],
}
`
}

/* ── SFTP helpers ─────────────────────────────────────────────────────────── */

// El tipo de sftp viene de ssh2; lo tratamos laxo para no acoplar al typing.
type Sftp = {
  mkdir: (p: string, cb: (err: unknown) => void) => void
  writeFile: (p: string, data: string, cb: (err: unknown) => void) => void
}

/** Crea directorios remotos recursivamente (ignora "ya existe"). */
function mkdirp(sftp: Sftp, dir: string): Promise<void> {
  return new Promise((resolve) => {
    const parts = dir.split('/').filter(Boolean)
    let cur = dir.startsWith('/') ? '' : '.'
    let i = 0
    const next = () => {
      if (i >= parts.length) return resolve()
      cur += '/' + parts[i++]
      sftp.mkdir(cur, () => next()) // ignora error (probablemente ya existe)
    }
    next()
  })
}

function writeRemoteFile(sftp: Sftp, fullPath: string, content: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.writeFile(fullPath, content, (err) => (err ? reject(err) : resolve()))
  })
}

async function uploadFilesViaSftp(sftp: Sftp, base: string, files: SessionFile[], log: LogFn): Promise<void> {
  const madeDirs = new Set<string>()
  let count = 0
  for (const f of files) {
    const rel = f.path.replace(/^\/+/, '')
    const full = `${base}/${rel}`
    const dir = full.slice(0, full.lastIndexOf('/'))
    if (dir && !madeDirs.has(dir)) {
      await mkdirp(sftp, dir)
      madeDirs.add(dir)
    }
    await writeRemoteFile(sftp, full, f.content)
    count++
    if (count % 25 === 0) log(`  … ${count}/${files.length} archivos`)
  }
}
