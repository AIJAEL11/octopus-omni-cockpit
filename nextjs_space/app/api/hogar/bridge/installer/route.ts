import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET — Generate platform-specific installer script with embedded token
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Verify user actually exists in DB (prevent FK errors if session is stale after DB reset)
    const userExists = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true },
    })
    if (!userExists) {
      return NextResponse.json(
        {
          error: 'sessionInvalid',
          message: 'Tu sesión ha expirado. Por favor cierra sesión y vuelve a iniciar.',
        },
        { status: 401 }
      )
    }

    const platform = req.nextUrl.searchParams.get('platform') || 'windows'
    const lang = req.nextUrl.searchParams.get('lang') || 'es'

    // Get or create bridge token for this user
    let apiKey = await prisma.apiKey.findFirst({
      where: { userId: session.user.id, serviceType: 'hogar_bridge' },
    })

    if (!apiKey) {
      const token = `oct_bridge_${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`
      apiKey = await prisma.apiKey.create({
        data: {
          userId: session.user.id,
          name: 'OCTOPUS Bridge',
          apiKey: token,
          serviceType: 'hogar_bridge',
        },
      })
    }

    const token = apiKey.apiKey
    const serverUrl = process.env.NEXTAUTH_URL || 'https://octopus-omni-cockpit-n8hd61.abacusai.app'

    const isEs = lang === 'es'

    // The bridge JS content
    const bridgeJS = generateBridgeScript(token, serverUrl, isEs)
    const b64 = Buffer.from(bridgeJS).toString('base64')

    let script = ''
    let filename = ''
    const contentType = 'application/octet-stream'

    switch (platform) {
      case 'windows':
        script = generateWindowsBat(token, serverUrl, isEs, b64)
        filename = 'OCTOPUS-Bridge.bat'
        break
      case 'mac':
        script = generateMacCommand(token, serverUrl, isEs, b64)
        filename = 'OCTOPUS-Bridge.command'
        break
      case 'linux':
        script = generateLinuxSh(token, serverUrl, isEs, b64)
        filename = 'OCTOPUS-Bridge.sh'
        break
      case 'mac_service':
        script = generateMacServiceInstaller(token, serverUrl, isEs, b64)
        filename = 'OCTOPUS-Bridge-Service-Install.command'
        break
      case 'linux_service':
        script = generateLinuxServiceInstaller(token, serverUrl, isEs, b64)
        filename = 'OCTOPUS-Bridge-Service-Install.sh'
        break
      case 'windows_service':
        script = generateWindowsServiceInstaller(token, serverUrl, isEs, b64)
        filename = 'OCTOPUS-Bridge-Service-Install.bat'
        break
      default:
        return NextResponse.json({ error: 'Plataforma no soportada' }, { status: 400 })
    }

    // Windows BAT/CMD files MUST use CRLF line endings or CMD garbles commands
    const isWindows = platform === 'windows' || platform === 'windows_service'
    const finalScript = isWindows
      ? script.replace(/\r?\n/g, '\r\n')
      : script

    return new NextResponse(finalScript, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Installer generation error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

function generateBridgeScript(token: string, serverUrl: string, isEs: boolean): string {
  return `const dgram = require('dgram');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { Buffer } = require('buffer');
const { execSync, exec, spawn } = require('child_process');
const CONFIG = {
  OCTOPUS_URL: '${serverUrl}',
  BRIDGE_TOKEN: '${token}',
  POLL_INTERVAL: 3000,
  HEARTBEAT_INTERVAL: 30000,
  WIZ_PORT: 38899,
  UDP_TIMEOUT: 3000,
  DISCOVERY_INTERVAL: 60000,
  OLLAMA_CHECK_INTERVAL: 60000,
  OLLAMA_PORT: 11434,
};
const knownDevices = new Map();
let commandsProcessed = 0;
let lastHeartbeat = null;
const L = ${isEs};
function sendUDP(ip, message) {
  return new Promise((resolve, reject) => {
    const client = dgram.createSocket('udp4');
    const msg = Buffer.from(JSON.stringify(message));
    let responded = false;
    const timeout = setTimeout(() => { if (!responded) { responded = true; client.close(); reject(new Error('UDP timeout ' + ip)); } }, CONFIG.UDP_TIMEOUT);
    client.on('message', (data) => { if (!responded) { responded = true; clearTimeout(timeout); try { client.close(); resolve(JSON.parse(data.toString())); } catch (e) { client.close(); reject(new Error('Bad UDP')); } } });
    client.on('error', (err) => { if (!responded) { responded = true; clearTimeout(timeout); client.close(); reject(err); } });
    client.send(msg, CONFIG.WIZ_PORT, ip, (err) => { if (err && !responded) { responded = true; clearTimeout(timeout); client.close(); reject(err); } });
  });
}
async function discoverDevices() {
  return new Promise((resolve) => {
    const client = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    const discovered = [];
    const message = JSON.stringify({ method: 'registration', params: { phoneMac: 'AABBCCDDEEFF', register: false, phoneIp: '1.2.3.4', id: '1' } });
    client.on('message', (data, rinfo) => {
      try {
        const p = JSON.parse(data.toString());
        if (p.result && p.result.mac) {
          const d = { ip: rinfo.address, mac: p.result.mac, moduleName: p.result.moduleName || '', type: (p.result.moduleName || '').toLowerCase().includes('plug') ? 'plug' : 'light' };
          discovered.push(d); knownDevices.set(d.mac, { ...d, lastSeen: Date.now() });
          log('  ' + String.fromCodePoint(0x1F4A1) + (L ? ' Encontrado: ' : ' Found: ') + (d.moduleName || d.mac) + ' @ ' + d.ip);
        }
      } catch (e) {}
    });
    client.bind(() => { client.setBroadcast(true); const buf = Buffer.from(message); ['255.255.255.255','192.168.1.255','192.168.0.255','192.168.4.255','10.0.0.255','172.16.0.255'].forEach(a => client.send(buf, CONFIG.WIZ_PORT, a, () => {})); });
    setTimeout(() => { client.close(); resolve(discovered); }, 3000);
  });
}
async function getDeviceState(ip) { try { const r = await sendUDP(ip, { method: 'getPilot' }); return r.result || null; } catch (e) { return null; } }
async function executeCommand(cmd) {
  const { action, params, device } = cmd;
  let ip = device?.ipAddress;
  if (!ip) { const mac = device?.macAddress; if (mac && knownDevices.has(mac)) ip = knownDevices.get(mac).ip; else return { success: false, error: 'No IP' }; }
  try {
    let wp = {};
    switch (action) {
      case 'on': wp = { state: true }; break;
      case 'off': wp = { state: false }; break;
      case 'toggle': { const c = await getDeviceState(ip); wp = { state: !(c?.state) }; break; }
      case 'brightness': wp = { state: true, dimming: Math.max(10, Math.min(100, params?.brightness || 100)) }; break;
      case 'colorTemp': wp = { state: true, temp: Math.max(2200, Math.min(6500, params?.colorTemp || 4000)) }; break;
      default: return { success: false, error: 'Unknown: ' + action };
    }
    const result = await sendUDP(ip, { method: 'setPilot', params: wp });
    const ns = await getDeviceState(ip);
    return { success: result.result?.success !== false, result, deviceState: ns ? { on: ns.state, brightness: ns.dimming || 100, dimming: ns.dimming || 100, colorTemp: ns.temp || 4000, temp: ns.temp || 4000, sceneId: ns.sceneId, r: ns.r, g: ns.g, b: ns.b } : null };
  } catch (error) { return { success: false, error: error.message }; }
}
async function pollCommands() {
  try {
    const res = await fetch(CONFIG.OCTOPUS_URL + '/api/hogar/bridge?token=' + CONFIG.BRIDGE_TOKEN);
    if (!res.ok) { if (res.status === 401) { log(L ? 'Token invalido. Genera uno nuevo.' : 'Invalid token.', 'error'); return; } throw new Error('HTTP ' + res.status); }
    const data = await res.json();
    if (data.commands && data.commands.length > 0) {
      log((L ? 'Comandos recibidos: ' : 'Commands received: ') + data.commands.length);
      for (const cmd of data.commands) {
        log('  > ' + cmd.action + ' -> ' + (cmd.device?.name || cmd.deviceId));
        const result = await executeCommand(cmd); commandsProcessed++;
        await reportResult(cmd.id, result);
        log(result.success ? ('  OK ' + cmd.action) : ('  FAIL ' + cmd.action + ': ' + result.error));
      }
    }
  } catch (error) { log((L ? 'Error polling: ' : 'Polling error: ') + error.message, 'warn'); }
}
async function reportResult(cid, result) {
  try { await fetch(CONFIG.OCTOPUS_URL + '/api/hogar/bridge', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-bridge-token': CONFIG.BRIDGE_TOKEN }, body: JSON.stringify({ type: 'command_result', commandId: cid, success: result.success, result: result.result || null, deviceState: result.deviceState || null }) }); } catch (e) {}
}
async function reportDiscovery(devices) {
  try {
    const dd = [];
    for (const d of devices) { const s = await getDeviceState(d.ip); dd.push({ ip: d.ip, mac: d.mac, moduleName: d.moduleName, type: d.type, state: s ? { on: s.state, dimming: s.dimming || 100, temp: s.temp || 4000, sceneId: s.sceneId, r: s.r, g: s.g, b: s.b } : null }); }
    await fetch(CONFIG.OCTOPUS_URL + '/api/hogar/bridge', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-bridge-token': CONFIG.BRIDGE_TOKEN }, body: JSON.stringify({ type: 'discovery', discoveredDevices: dd }) });
  } catch (e) {}
}
async function sendHeartbeat() {
  try {
    var r = await fetch(CONFIG.OCTOPUS_URL + '/api/hogar/bridge', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-bridge-token': CONFIG.BRIDGE_TOKEN }, body: JSON.stringify({ type: 'heartbeat' }) });
    if (r.ok) {
      lastHeartbeat = new Date();
      // Reconnected after being offline — flush buffered results
      if (isOffline) {
        isOffline = false;
        log(L ? 'Heartbeat OK — reconectado' : 'Heartbeat OK — reconnected', 'success');
        await flushOfflineResults();
      }
    }
  } catch (e) {
    if (!isOffline) {
      isOffline = true;
      log(L ? 'Heartbeat fallido — modo offline' : 'Heartbeat failed — offline mode', 'warn');
    }
  }
}
// ========== OLLAMA DETECTION (multi-strategy) ==========
function detectOS() {
  const p = process.platform;
  if (p === 'darwin') return 'mac';
  if (p === 'win32') return 'windows';
  return 'linux';
}
function ollamaHomeDir() {
  // Resolves to the user's Ollama config directory on all platforms
  return path.join(os.homedir(), '.' + 'ollama');
}
function ollamaInstallPaths() {
  const platform = detectOS();
  const paths = [];
  paths.push(ollamaHomeDir());
  if (platform === 'mac') {
    paths.push('/Applications/Ollama.app');
    paths.push('/usr/local/bin/ollama');
    paths.push('/opt/homebrew/bin/ollama');
  } else if (platform === 'windows') {
    if (process.env.LOCALAPPDATA) paths.push(path.join(process.env.LOCALAPPDATA, 'Programs', 'Ollama'));
    if (process.env.PROGRAMFILES) paths.push(path.join(process.env.PROGRAMFILES, 'Ollama'));
    paths.push(path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Ollama'));
  } else {
    paths.push('/usr/local/bin/ollama');
    paths.push('/usr/bin/ollama');
    paths.push(path.join(os.homedir(), '.local', 'bin', 'ollama'));
  }
  return paths;
}
function isOllamaInstalled() {
  // Check known install paths
  for (const p of ollamaInstallPaths()) {
    try { if (fs.existsSync(p)) return { installed: true, foundAt: p }; } catch (e) {}
  }
  return { installed: false };
}
function isOllamaProcessRunning() {
  try {
    const platform = detectOS();
    if (platform === 'windows') {
      const out = execSync('tasklist /FI "IMAGENAME eq ollama.exe" /NH', { encoding: 'utf8', timeout: 3000 }).toLowerCase();
      return out.includes('ollama.exe');
    } else {
      // mac/linux
      const out = execSync('ps -A -o comm 2>/dev/null | grep -i ollama || true', { encoding: 'utf8', timeout: 3000 }).toLowerCase();
      return /ollama/.test(out);
    }
  } catch (e) { return false; }
}
function probeOllamaHTTP() {
  // GET http://localhost:11434/api/tags with 2s timeout
  return new Promise((resolve) => {
    const req = http.request({
      host: '127.0.0.1',
      port: CONFIG.OLLAMA_PORT,
      path: '/api/tags',
      method: 'GET',
      timeout: 2000,
    }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return resolve({ ok: false, statusCode: res.statusCode });
      }
      let body = '';
      res.on('data', (chunk) => { body += chunk.toString(); });
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          const models = Array.isArray(json.models) ? json.models : [];
          // Each model: { name, modified_at, size, digest, details: { family, parameter_size, quantization_level } }
          const formatted = models.map((m) => ({
            name: m.name || m.model,
            size: typeof m.size === 'number' ? m.size : undefined,
            modifiedAt: m.modified_at || undefined,
            family: m.details?.family || undefined,
            parameterSize: m.details?.parameter_size || undefined,
            quantization: m.details?.quantization_level || undefined,
          })).filter((m) => m.name);
          resolve({ ok: true, models: formatted });
        } catch (e) { resolve({ ok: false, error: 'parse_error' }); }
      });
    });
    req.on('error', () => resolve({ ok: false, error: 'connection_refused' }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'timeout' }); });
    req.end();
  });
}
function listModelsFromFilesystem() {
  // Read manifest tree at: <ollamaHomeDir>/models/manifests/<registry>/<namespace>/<model>/<tag>
  // Each tag file is the manifest of a downloaded model.
  const manifestRoot = path.join(ollamaHomeDir(), 'models', 'manifests');
  if (!fs.existsSync(manifestRoot)) return [];
  const found = [];
  try {
    // Walk: manifests/<registry>/<namespace>/<model>/<tag>
    const registries = fs.readdirSync(manifestRoot, { withFileTypes: true }).filter((d) => d.isDirectory());
    for (const reg of registries) {
      const regPath = path.join(manifestRoot, reg.name);
      const namespaces = fs.readdirSync(regPath, { withFileTypes: true }).filter((d) => d.isDirectory());
      for (const ns of namespaces) {
        const nsPath = path.join(regPath, ns.name);
        const models = fs.readdirSync(nsPath, { withFileTypes: true }).filter((d) => d.isDirectory());
        for (const model of models) {
          const modelPath = path.join(nsPath, model.name);
          const tags = fs.readdirSync(modelPath, { withFileTypes: true }).filter((d) => d.isFile());
          for (const tag of tags) {
            const tagPath = path.join(modelPath, tag.name);
            let stat;
            try { stat = fs.statSync(tagPath); } catch (e) { continue; }
            // For models in default 'library' namespace, name is just "model:tag"; otherwise "namespace/model:tag"
            const fullName = ns.name === 'library' ? (model.name + ':' + tag.name) : (ns.name + '/' + model.name + ':' + tag.name);
            found.push({
              name: fullName,
              size: stat.size,
              modifiedAt: stat.mtime.toISOString(),
            });
          }
        }
      }
    }
  } catch (e) { /* ignore — return whatever we got */ }
  return found;
}
async function detectOllama() {
  const platformOS = detectOS();
  // Layer 1: HTTP probe (most reliable when Ollama is running)
  const httpResult = await probeOllamaHTTP();
  if (httpResult.ok) {
    return {
      installed: true,
      running: true,
      models: httpResult.models || [],
      detectionMethod: 'http',
      os: platformOS,
    };
  }
  // Layer 2: Filesystem-only detection (works when Ollama is CLOSED)
  const installCheck = isOllamaInstalled();
  const fsModels = listModelsFromFilesystem();
  const processActive = isOllamaProcessRunning();
  if (installCheck.installed || fsModels.length > 0) {
    return {
      installed: true,
      running: processActive,
      models: fsModels,
      detectionMethod: fsModels.length > 0 ? 'filesystem' : (processActive ? 'process' : 'filesystem'),
      os: platformOS,
    };
  }
  return {
    installed: false,
    running: false,
    models: [],
    detectionMethod: 'none',
    os: platformOS,
  };
}
async function reportOllamaStatus() {
  try {
    const status = await detectOllama();
    const r = await fetch(CONFIG.OCTOPUS_URL + '/api/arms/ollama/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-bridge-token': CONFIG.BRIDGE_TOKEN },
      body: JSON.stringify(status),
    });
    if (r.ok) {
      const icon = status.running ? String.fromCodePoint(0x1F7E2) : (status.installed ? String.fromCodePoint(0x1F7E1) : String.fromCodePoint(0x26AA));
      log(icon + ' Ollama: ' + (status.running ? 'corriendo' : (status.installed ? 'instalado pero cerrado' : 'no detectado')) + ' (' + status.models.length + ' modelos, via ' + status.detectionMethod + ')');
    } else {
      log('Ollama report failed: ' + r.status, 'warn');
    }
  } catch (e) {
    log('Ollama detection error: ' + e.message, 'warn');
  }
}
// ========== OLLAMA CHAT RELAY ==========
let chatPollActive = false;
const CHAT_POLL_INTERVAL = 1000; // 1 second when active (was 2s)
const CHAT_IDLE_INTERVAL = 3000; // 3 seconds when idle (was 10s — much faster pickup)
const STREAM_FLUSH_INTERVAL = 800; // Send partial content every 800ms

async function pollOllamaChat() {
  try {
    const r = await fetch(CONFIG.OCTOPUS_URL + '/api/arms/ollama/chat', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-bridge-token': CONFIG.BRIDGE_TOKEN },
      body: JSON.stringify({ action: 'poll' }),
    });
    if (!r.ok) return false;
    const data = await r.json();
    if (!data.pending) return false;

    chatPollActive = true;
    log('Chat request: model=' + data.model + ' msgs=' + data.messages.length, 'info');

    // Call local Ollama API with STREAMING enabled
    try {
      const content = await new Promise((resolve, reject) => {
        let fullContent = '';
        let lastFlush = Date.now();
        let flushTimer = null;

        const postData = JSON.stringify({
          model: data.model,
          messages: data.messages,
          stream: true,
        });

        // Flush partial content to server periodically
        function flushPartial() {
          if (fullContent.length > 0) {
            fetch(CONFIG.OCTOPUS_URL + '/api/arms/ollama/chat', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', 'x-bridge-token': CONFIG.BRIDGE_TOKEN },
              body: JSON.stringify({ action: 'stream', messageId: data.messageId, content: fullContent }),
            }).catch(() => {});
          }
        }

        const req = http.request({
          host: '127.0.0.1',
          port: CONFIG.OLLAMA_PORT,
          path: '/api/chat',
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
          timeout: 300000,
        }, (res) => {
          let buffer = '';
          res.on('data', (chunk) => {
            buffer += chunk.toString();
            // Ollama streams NDJSON — one JSON object per line
            const lines = buffer.split('\\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const obj = JSON.parse(line);
                if (obj.message && obj.message.content) {
                  fullContent += obj.message.content;
                }
                // Flush to server periodically for live updates
                const now = Date.now();
                if (now - lastFlush >= STREAM_FLUSH_INTERVAL) {
                  lastFlush = now;
                  flushPartial();
                }
              } catch (e) {}
            }
          });
          res.on('end', () => {
            // Parse any remaining buffer
            if (buffer.trim()) {
              try {
                const obj = JSON.parse(buffer);
                if (obj.message && obj.message.content) {
                  fullContent += obj.message.content;
                }
              } catch (e) {}
            }
            if (flushTimer) clearInterval(flushTimer);
            resolve(fullContent);
          });
        });

        req.on('error', (e) => { if (flushTimer) clearInterval(flushTimer); reject(e); });
        req.on('timeout', () => { if (flushTimer) clearInterval(flushTimer); req.destroy(); reject(new Error('Ollama request timed out (5min)')); });
        req.write(postData);
        req.end();
      });

      log('Chat response: ' + content.length + ' chars (streamed)', 'success');

      // Send final complete response
      await fetch(CONFIG.OCTOPUS_URL + '/api/arms/ollama/chat', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-bridge-token': CONFIG.BRIDGE_TOKEN },
        body: JSON.stringify({
          action: 'respond',
          messageId: data.messageId,
          content: content,
          status: 'completed',
        }),
      });
    } catch (ollamaErr) {
      log('Ollama chat error: ' + ollamaErr.message, 'error');
      await fetch(CONFIG.OCTOPUS_URL + '/api/arms/ollama/chat', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-bridge-token': CONFIG.BRIDGE_TOKEN },
        body: JSON.stringify({
          action: 'respond',
          messageId: data.messageId,
          content: '',
          status: 'failed',
          error: ollamaErr.message || 'Ollama not responding',
        }),
      });
    }
    return true;
  } catch (e) {
    return false;
  }
}

let chatTimer = null;
function startChatPoll() {
  async function tick() {
    const hadWork = await pollOllamaChat();
    // If we just processed something, poll faster next time
    const nextInterval = hadWork ? CHAT_POLL_INTERVAL : CHAT_IDLE_INTERVAL;
    chatTimer = setTimeout(tick, nextInterval);
  }
  tick();
}

// ========== CODE ENGINE (ALFA) RELAY ==========
const WORKSPACE_DIR = path.join(os.homedir(), 'octopus-workspace');
const STATE_FILE = path.join(os.homedir(), 'octopus-workspace', '.octopus-state');

function ensureWorkspace() {
  try { fs.mkdirSync(WORKSPACE_DIR, { recursive: true }); } catch (e) {}
}

// ========== PHOENIX PROTOCOL — Snapshot Engine (Sprint 11) ==========
const SNAPSHOTS_DIR = path.join(os.homedir(), 'octopus-workspace', '.octopus-snapshots');
const MAX_SNAPSHOTS = 10;
const MAX_FILE_SIZE_FOR_SNAPSHOT = 2 * 1024 * 1024; // 2MB max per file

function ensureSnapshotsDir() {
  try { fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true }); } catch (e) {}
}

function sha256(content) {
  return crypto.createHash('sha256').update(content || '').digest('hex');
}

// Create a differential snapshot of files that will be modified
function createSnapshot(batch, txId) {
  var start = Date.now();
  ensureSnapshotsDir();
  var snapId = Date.now() + '-' + (txId || 'single').slice(0, 12);
  var snapDir = path.join(SNAPSHOTS_DIR, snapId);
  try { fs.mkdirSync(snapDir, { recursive: true }); } catch (e) {}

  var manifest = {
    id: snapId,
    txId: txId || null,
    createdAt: new Date().toISOString(),
    isCheckpoint: false,
    checkpointName: null,
    files: [],
    durationMs: 0,
  };

  // Collect paths that will be touched
  var pathsToSnapshot = [];
  for (var i = 0; i < batch.length; i++) {
    var cmd = batch[i];
    var p = cmd.payload && cmd.payload.path;
    if (!p) continue;
    if (cmd.type === 'write_file' || cmd.type === 'delete_file') {
      pathsToSnapshot.push(p);
    }
  }

  // Snapshot each existing file
  for (var j = 0; j < pathsToSnapshot.length; j++) {
    var relPath = pathsToSnapshot[j];
    try {
      var absPath = safePath(relPath);
      var exists = false;
      var stat = null;
      try { stat = fs.statSync(absPath); exists = true; } catch (e) { exists = false; }

      if (exists && stat && !stat.isDirectory() && stat.size <= MAX_FILE_SIZE_FOR_SNAPSHOT) {
        var content = fs.readFileSync(absPath);
        var hash = sha256(content);
        // Save file content to snapshot dir
        var safeName = relPath.replace(/[\\\\/]/g, '__').replace(/[^a-zA-Z0-9._\\-]/g, '_');
        fs.writeFileSync(path.join(snapDir, safeName), content);
        manifest.files.push({
          path: relPath,
          existed: true,
          hash: hash,
          size: stat.size,
          savedAs: safeName,
        });
      } else if (!exists) {
        // File doesn't exist yet — record so rollback can delete it
        manifest.files.push({ path: relPath, existed: false, hash: null, size: 0, savedAs: null });
      }
    } catch (e) { /* skip files we can't read */ }
  }

  manifest.durationMs = Date.now() - start;
  fs.writeFileSync(path.join(snapDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  // Purge old snapshots (keep MAX_SNAPSHOTS, never purge checkpoints)
  purgeOldSnapshots();

  log((L ? 'Phoenix: Snapshot creado ' : 'Phoenix: Snapshot created ') + snapId + ' (' + manifest.files.length + (L ? ' archivos, ' : ' files, ') + manifest.durationMs + 'ms)', 'info');
  return manifest;
}

// Rollback from a snapshot
function rollbackFromSnapshot(snapId) {
  var snapDir = path.join(SNAPSHOTS_DIR, snapId);
  if (!fs.existsSync(path.join(snapDir, 'manifest.json'))) {
    throw new Error('Snapshot not found: ' + snapId);
  }
  var manifest = JSON.parse(fs.readFileSync(path.join(snapDir, 'manifest.json'), 'utf8'));
  var restored = [];
  var deleted = [];
  var errors = [];

  for (var i = 0; i < manifest.files.length; i++) {
    var f = manifest.files[i];
    try {
      var absPath = safePath(f.path);
      if (f.existed && f.savedAs) {
        // Restore original content
        var content = fs.readFileSync(path.join(snapDir, f.savedAs));
        fs.mkdirSync(path.dirname(absPath), { recursive: true });
        fs.writeFileSync(absPath, content);
        restored.push(f.path);
      } else if (!f.existed) {
        // File was new — delete it
        try { fs.unlinkSync(absPath); deleted.push(f.path); } catch (e) { /* already gone */ }
      }
    } catch (e) {
      errors.push({ path: f.path, error: e.message });
    }
  }

  log((L ? 'Phoenix: Rollback completado — ' : 'Phoenix: Rollback completed — ') + restored.length + (L ? ' restaurados, ' : ' restored, ') + deleted.length + (L ? ' eliminados' : ' deleted'), restored.length > 0 ? 'success' : 'warn');
  return { snapId: snapId, restored: restored, deleted: deleted, errors: errors, timestamp: new Date().toISOString() };
}

// Verify integrity of written files after execution
function verifyIntegrity(batch) {
  var results = [];
  var allOk = true;
  for (var i = 0; i < batch.length; i++) {
    var cmd = batch[i];
    if (cmd.type !== 'write_file') continue;
    var p = cmd.payload && cmd.payload.path;
    if (!p) continue;
    try {
      var absPath = safePath(p);
      var actual = fs.readFileSync(absPath, 'utf8');
      var expectedHash = sha256(cmd.payload.content || '');
      var actualHash = sha256(actual);
      var ok = expectedHash === actualHash;
      if (!ok) allOk = false;
      results.push({ path: p, expected: expectedHash.slice(0, 12), actual: actualHash.slice(0, 12), ok: ok });
    } catch (e) {
      allOk = false;
      results.push({ path: p, expected: 'n/a', actual: 'error', ok: false, error: e.message });
    }
  }
  return { ok: allOk, files: results };
}

// Purge oldest non-checkpoint snapshots beyond MAX_SNAPSHOTS
function purgeOldSnapshots() {
  try {
    var dirs = fs.readdirSync(SNAPSHOTS_DIR).filter(function(d) {
      return fs.statSync(path.join(SNAPSHOTS_DIR, d)).isDirectory();
    }).sort(); // Sorted by timestamp (oldest first)

    // Load manifests and separate checkpoints
    var regular = [];
    for (var i = 0; i < dirs.length; i++) {
      try {
        var mPath = path.join(SNAPSHOTS_DIR, dirs[i], 'manifest.json');
        if (!fs.existsSync(mPath)) { regular.push(dirs[i]); continue; }
        var m = JSON.parse(fs.readFileSync(mPath, 'utf8'));
        if (!m.isCheckpoint) regular.push(dirs[i]);
      } catch (e) { regular.push(dirs[i]); }
    }

    // Remove oldest regular snapshots
    while (regular.length > MAX_SNAPSHOTS) {
      var oldest = regular.shift();
      try { fs.rmSync(path.join(SNAPSHOTS_DIR, oldest), { recursive: true, force: true }); } catch (e) {}
    }
  } catch (e) { /* silent */ }
}

// List all snapshots
function listSnapshots() {
  ensureSnapshotsDir();
  try {
    var dirs = fs.readdirSync(SNAPSHOTS_DIR).filter(function(d) {
      return fs.statSync(path.join(SNAPSHOTS_DIR, d)).isDirectory();
    }).sort().reverse(); // Newest first
    var snaps = [];
    for (var i = 0; i < dirs.length; i++) {
      try {
        var mPath = path.join(SNAPSHOTS_DIR, dirs[i], 'manifest.json');
        if (!fs.existsSync(mPath)) continue;
        var m = JSON.parse(fs.readFileSync(mPath, 'utf8'));
        snaps.push({ id: m.id, createdAt: m.createdAt, fileCount: m.files.length, isCheckpoint: m.isCheckpoint, checkpointName: m.checkpointName, durationMs: m.durationMs });
      } catch (e) {}
    }
    return snaps;
  } catch (e) { return []; }
}

// Mark a snapshot as immortal checkpoint
function markCheckpoint(snapId, name) {
  var snapDir = path.join(SNAPSHOTS_DIR, snapId);
  var mPath = path.join(snapDir, 'manifest.json');
  if (!fs.existsSync(mPath)) throw new Error('Snapshot not found');
  var m = JSON.parse(fs.readFileSync(mPath, 'utf8'));
  m.isCheckpoint = true;
  m.checkpointName = name || ('checkpoint-' + Date.now());
  fs.writeFileSync(mPath, JSON.stringify(m, null, 2), 'utf8');
  return m;
}

// Get the latest snapshot for context injection
function getLatestSnapshot() {
  var snaps = listSnapshots();
  return snaps.length > 0 ? snaps[0] : null;
}

// Report snapshot events to server
async function reportSnapshotEvent(eventType, data) {
  try {
    await fetch(CONFIG.OCTOPUS_URL + '/api/arms/claude-code/snapshots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-bridge-token': CONFIG.BRIDGE_TOKEN },
      body: JSON.stringify({ eventType: eventType, data: data || {} }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (e) { /* non-critical */ }
}
// ========== END PHOENIX PROTOCOL ==========

function safePath(rel) {
  const r = String(rel || '').replace(/^[\\\\/]+/, '');
  if (r.includes('..')) throw new Error('Path traversal blocked');
  if (/^[a-zA-Z]:/.test(r)) throw new Error('Absolute paths blocked');
  if (r.startsWith('~')) throw new Error('Home expansion blocked');
  const resolved = path.resolve(WORKSPACE_DIR, r);
  if (!resolved.startsWith(WORKSPACE_DIR)) throw new Error('Path escapes workspace');
  return resolved;
}

// ========== OFFLINE RESILIENCE — Local Queue + State Checkpoints ==========
var offlineResultsBuffer = []; // Results completed while offline
var isOffline = false;
var lastOnlineAt = Date.now();

function saveState(data) {
  try {
    ensureWorkspace();
    fs.writeFileSync(STATE_FILE, JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2), 'utf8');
  } catch (e) { /* silent */ }
}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (e) { /* corrupt file */ }
  return null;
}

function clearState() {
  try { if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE); } catch (e) {}
}

// Try to report a result to server; if offline, buffer it
async function reportResult(commandId, status, resultOrError) {
  var payload = { commandId: commandId, status: status };
  if (status === 'completed') payload.result = resultOrError;
  else payload.error = resultOrError;

  try {
    var r = await fetch(CONFIG.OCTOPUS_URL + '/api/arms/claude-code/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-bridge-token': CONFIG.BRIDGE_TOKEN },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    if (r.ok) return true;
  } catch (e) { /* network error */ }

  // Failed to report — buffer locally
  offlineResultsBuffer.push(payload);
  saveState({
    phase: 'offline_buffer',
    bufferedResults: offlineResultsBuffer.length,
    lastCommandId: commandId,
  });
  log((L ? 'Offline: resultado guardado localmente (' : 'Offline: result saved locally (') + commandId.slice(0, 8) + ')', 'warn');
  return false;
}

// Flush all buffered offline results when back online
async function flushOfflineResults() {
  if (offlineResultsBuffer.length === 0) return;
  log((L ? 'Re-sync: enviando ' : 'Re-sync: sending ') + offlineResultsBuffer.length + (L ? ' resultados offline...' : ' offline results...'), 'info');

  var remaining = [];
  for (var i = 0; i < offlineResultsBuffer.length; i++) {
    try {
      var r = await fetch(CONFIG.OCTOPUS_URL + '/api/arms/claude-code/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-bridge-token': CONFIG.BRIDGE_TOKEN },
        body: JSON.stringify(offlineResultsBuffer[i]),
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) remaining.push(offlineResultsBuffer[i]);
    } catch (e) {
      remaining.push(offlineResultsBuffer[i]);
    }
  }
  offlineResultsBuffer = remaining;
  if (remaining.length === 0) {
    log(L ? 'Re-sync completo: todos los resultados sincronizados' : 'Re-sync complete: all results synced', 'success');
    clearState();
  } else {
    log((L ? 'Re-sync parcial: ' : 'Partial re-sync: ') + remaining.length + (L ? ' pendientes' : ' remaining'), 'warn');
  }
}

async function executeBridgeCommand(cmd) {
  ensureWorkspace();
  const type = cmd.type;
  const payload = cmd.payload || {};
  const commandId = cmd.commandId;
  try {
    let result;
    switch (type) {
      case 'write_file': {
        const wPath = safePath(payload.path);
        fs.mkdirSync(path.dirname(wPath), { recursive: true });
        fs.writeFileSync(wPath, payload.content || '', 'utf8');
        result = { written: payload.path, bytes: Buffer.byteLength(payload.content || '') };
        break;
      }
      case 'read_file': {
        const rPath = safePath(payload.path);
        const content = fs.readFileSync(rPath, 'utf8');
        result = { path: payload.path, content: content.length > 50000 ? content.slice(0, 50000) + '\\n[...truncated]' : content };
        break;
      }
      case 'create_dir': {
        const dPath = safePath(payload.path);
        fs.mkdirSync(dPath, { recursive: true });
        result = { created: payload.path };
        break;
      }
      case 'read_dir': {
        const lPath = safePath(payload.path || '');
        const entries = fs.readdirSync(lPath).map((name) => {
          try {
            const full = path.join(lPath, name);
            const stat = fs.statSync(full);
            return { name: name, isDir: stat.isDirectory(), size: stat.size };
          } catch (e) { return { name: name, isDir: false, size: 0 }; }
        });
        result = { path: payload.path || '', entries: entries };
        break;
      }
      case 'delete_file': {
        const xPath = safePath(payload.path);
        const stat = fs.statSync(xPath);
        if (stat.isDirectory()) fs.rmSync(xPath, { recursive: true, force: true });
        else fs.unlinkSync(xPath);
        result = { deleted: payload.path };
        break;
      }
      case 'execute_cmd': {
        result = await new Promise((resolve, reject) => {
          const isWin = process.platform === 'win32';
          const shell = isWin ? 'cmd.exe' : '/bin/bash';
          const shellArgs = isWin ? ['/c', payload.command] : ['-c', payload.command];
          const child = spawn(shell, shellArgs, { cwd: WORKSPACE_DIR, timeout: 60000, env: { ...process.env } });
          let stdoutBuf = '';
          let stderrBuf = '';
          let streamBuf = '';
          let lastFlush = Date.now();
          const FLUSH_MS = 600;
          function flushStream() {
            if (!streamBuf) return;
            const chunk = streamBuf;
            streamBuf = '';
            fetch(CONFIG.OCTOPUS_URL + '/api/arms/claude-code/respond', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-bridge-token': CONFIG.BRIDGE_TOKEN },
              body: JSON.stringify({ commandId: commandId, action: 'stream', chunk: chunk }),
            }).catch(() => {});
          }
          child.stdout.on('data', (d) => {
            const s = d.toString();
            stdoutBuf += s;
            streamBuf += s;
            if (Date.now() - lastFlush >= FLUSH_MS) { lastFlush = Date.now(); flushStream(); }
          });
          child.stderr.on('data', (d) => {
            const s = d.toString();
            stderrBuf += s;
            streamBuf += '\\x1b[31m' + s + '\\x1b[0m';
            if (Date.now() - lastFlush >= FLUSH_MS) { lastFlush = Date.now(); flushStream(); }
          });
          child.on('close', (code) => {
            flushStream();
            if (code !== 0 && code !== null) {
              reject(new Error('Exit code ' + code + (stderrBuf ? '\\n' + stderrBuf.slice(0, 5000) : '')));
            } else {
              resolve({ stdout: stdoutBuf.slice(0, 50000), stderr: stderrBuf.slice(0, 10000), exitCode: code || 0 });
            }
          });
          child.on('error', (e) => { flushStream(); reject(e); });
        });
        break;
      }
      case 'open_path': {
        // Open a file or folder in the host's native file explorer
        const oPath = safePath(payload.path || '');
        console.log('[OPEN_PATH] Resolved: ' + oPath);
        // Verify the target exists
        try { fs.statSync(oPath); } catch (e) { console.error('[OPEN_PATH_ERROR] Path not found: ' + oPath); throw new Error('Path not found: ' + payload.path); }
        const platform = process.platform;
        let openCmd;
        if (platform === 'win32') {
          // Use start "" to detach; explorer alone returns exit 1 on success
          openCmd = 'start "" "' + oPath.replace(/\\\\/g, '\\\\\\\\').replace(/"/g, '') + '"';
        } else if (platform === 'darwin') {
          openCmd = 'open "' + oPath.replace(/"/g, '\\\\"') + '"';
        } else {
          openCmd = 'xdg-open "' + oPath.replace(/"/g, '\\\\"') + '"';
        }
        console.log('[OPEN_PATH] Exec: ' + openCmd);
        await new Promise((resolve) => {
          exec(openCmd, { timeout: 10000 }, (err) => {
            if (err) console.error('[OPEN_PATH_ERROR]', err.message);
            resolve(null);
          });
        });
        result = { opened: payload.path || '.', platform: platform };
        break;
      }
      case 'rollback': {
        // Phoenix Protocol: Manual rollback triggered by server
        var snapId = payload.snapshotId || null;
        var snapList = listSnapshots();
        var target = null;
        if (snapId) {
          target = snapList.find(function(s) { return s.id === snapId; });
        } else {
          // Default: rollback to latest snapshot
          target = getLatestSnapshot();
        }
        if (!target) throw new Error('No snapshot found for rollback');
        var rbResult = rollbackFromSnapshot(target.id);
        if (!rbResult.success) throw new Error('Rollback failed: ' + (rbResult.error || 'unknown'));
        await reportSnapshotEvent('rollback_executed', { snapshotId: target.id, filesRestored: rbResult.filesRestored, trigger: 'manual' });
        result = { rolledBack: true, snapshotId: target.id, filesRestored: rbResult.filesRestored, timestamp: target.timestamp };
        break;
      }
      case 'list_snapshots': {
        result = { snapshots: listSnapshots() };
        break;
      }
      case 'save_checkpoint': {
        var cpName = payload.name || ('checkpoint-' + Date.now());
        var latest = getLatestSnapshot();
        if (latest) {
          markCheckpoint(latest.id, cpName);
          result = { checkpointed: true, snapshotId: latest.id, name: cpName };
        } else {
          result = { checkpointed: false, reason: 'No snapshots available' };
        }
        break;
      }
      case 'save_image': {
        // Sprint 12 v3: Robust image download using native https/http module (NOT fetch)
        // Fixes: (1) Use https.get for reliable binary streaming on Windows
        //        (2) Report FAILED when save fails — never lie with 'completed'
        //        (3) Ensure directory writable before writing
        //        (4) Post-write verification: size + magic bytes
        var imgPath = safePath(payload.path || 'assets/images/generated.png');
        var imgDir = path.dirname(imgPath);
        fs.mkdirSync(imgDir, { recursive: true });

        // On Windows, ensure directory is writable
        if (process.platform === 'win32') {
          try { fs.accessSync(imgDir, fs.constants.W_OK); }
          catch (permErr) {
            try { execSync('icacls "' + imgDir.replace(/"/g, '') + '" /grant Everyone:F /T /Q', { timeout: 5000, stdio: 'ignore' }); }
            catch (e) { console.warn('[SAVE_IMAGE] icacls warning:', e.message); }
          }
        }

        var imgUrl = payload.url || payload.content || '';
        console.log('[SAVE_IMAGE] Target: ' + imgPath);
        console.log('[SAVE_IMAGE] Source: ' + (imgUrl.startsWith('data:') ? 'base64(' + imgUrl.length + ' chars)' : imgUrl));

        if (!imgUrl) {
          log('Code FAIL: save_image — no URL provided', 'error');
          await reportResult(commandId, 'failed', 'save_image: No URL or content provided');
          saveState({ phase: 'idle', lastCompleted: commandId, lastType: type });
          return false; // exit executeBridgeCommand entirely
        }

        var imgSaved = false;
        var imgAttempts = 0;
        var maxImgAttempts = 3;
        var imgLastError = '';

        // Helper: download URL using native https/http module — waits for pipe to fully finish
        function downloadImageNative(url, destPath) {
          return new Promise(function(resolve, reject) {
            var mod = url.startsWith('https') ? https : http;
            var redirectsLeft = 5;
            var timedOut = false;
            var timer = setTimeout(function() { timedOut = true; reject(new Error('Download timeout 30s')); }, 30000);

            function doReq(reqUrl) {
              var reqMod = reqUrl.startsWith('https') ? https : http;
              reqMod.get(reqUrl, function(response) {
                if (timedOut) return;
                // Follow redirects
                if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                  redirectsLeft--;
                  if (redirectsLeft <= 0) { clearTimeout(timer); reject(new Error('Too many redirects')); return; }
                  doReq(response.headers.location);
                  return;
                }
                if (response.statusCode !== 200) {
                  clearTimeout(timer);
                  reject(new Error('HTTP ' + response.statusCode + ' ' + (response.statusMessage || '')));
                  return;
                }
                // Collect ALL chunks into memory first, THEN write synchronously
                var chunks = [];
                var totalLen = 0;
                response.on('data', function(chunk) { chunks.push(chunk); totalLen += chunk.length; });
                response.on('end', function() {
                  clearTimeout(timer);
                  if (timedOut) return;
                  var fullBuf = Buffer.concat(chunks, totalLen);
                  console.log('[SAVE_IMAGE] Downloaded ' + fullBuf.length + ' bytes into memory');
                  // Write synchronously — guaranteed complete before resolve
                  fs.writeFileSync(destPath, fullBuf);
                  resolve(fullBuf.length);
                });
                response.on('error', function(e) { clearTimeout(timer); reject(e); });
              }).on('error', function(e) { clearTimeout(timer); reject(e); });
            }
            doReq(url);
          });
        }

        while (!imgSaved && imgAttempts < maxImgAttempts) {
          imgAttempts++;
          try {
            if (imgUrl.startsWith('data:image/')) {
              var b64Match = imgUrl.match(/^data:image\\/\\w+;base64,(.+)$/);
              if (!b64Match) throw new Error('Invalid base64 format');
              var b64Buf = Buffer.from(b64Match[1], 'base64');
              if (b64Buf.length < 100) throw new Error('Base64 only ' + b64Buf.length + ' bytes');
              fs.writeFileSync(imgPath, b64Buf);
            } else if (imgUrl.startsWith('http')) {
              var dlBytes = await downloadImageNative(imgUrl, imgPath);
              if (dlBytes < 100) throw new Error('Downloaded only ' + dlBytes + ' bytes');
            } else {
              throw new Error('Invalid URL scheme: ' + imgUrl.slice(0, 30));
            }

            // === POST-WRITE VERIFICATION ===
            if (!fs.existsSync(imgPath)) throw new Error('File missing after write!');
            var imgStat = fs.statSync(imgPath);
            if (imgStat.size < 100) {
              try { fs.unlinkSync(imgPath); } catch (e) {}
              throw new Error('File only ' + imgStat.size + ' bytes — corrupt');
            }
            // Verify magic bytes (PNG/JPEG/GIF/WebP)
            var headBuf = Buffer.alloc(4);
            var fd = fs.openSync(imgPath, 'r');
            fs.readSync(fd, headBuf, 0, 4, 0);
            fs.closeSync(fd);
            var h0 = headBuf[0], h1 = headBuf[1];
            var isValidImg = (h0===0x89 && h1===0x50) || (h0===0xFF && h1===0xD8) || (h0===0x47 && h1===0x49) || (h0===0x52 && h1===0x49);
            if (!isValidImg) {
              console.warn('[SAVE_IMAGE] Warning: header ' + h0.toString(16) + ' ' + h1.toString(16) + ' — might not be valid image');
            }

            imgSaved = true;
            console.log('[SAVE_IMAGE] ✅ Attempt ' + imgAttempts + ': ' + imgStat.size + ' bytes → ' + imgPath);
          } catch (imgErr) {
            imgLastError = imgErr instanceof Error ? imgErr.message : String(imgErr);
            console.error('[SAVE_IMAGE] ❌ Attempt ' + imgAttempts + '/' + maxImgAttempts + ': ' + imgLastError);
            try { if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath); } catch (e) {}
            if (imgAttempts < maxImgAttempts) {
              await new Promise(function(r) { setTimeout(r, 1500); });
            }
          }
        }

        if (imgSaved) {
          var finalSize = fs.statSync(imgPath).size;
          result = { saved: true, path: payload.path, size: finalSize, attempts: imgAttempts };
        } else {
          // CRITICAL: Report FAILED — never report 'completed' when nothing was saved
          log('Code FAIL: save_image — ' + imgLastError, 'error');
          await reportResult(commandId, 'failed', 'save_image failed after ' + maxImgAttempts + ' attempts: ' + imgLastError);
          saveState({ phase: 'idle', lastCompleted: commandId, lastType: type });
          return false; // Exit executeBridgeCommand — skip the generic 'completed' below
        }
        break;
      }
      default:
        throw new Error('Unknown action: ' + type);
    }
    log('Code OK: ' + type + ' ' + (payload.path || payload.command || ''), 'success');
    await reportResult(commandId, 'completed', result);
    // Update checkpoint
    saveState({ phase: 'idle', lastCompleted: commandId, lastType: type, lastPath: payload.path || '' });
    return true;
  } catch (e) {
    log('Code FAIL: ' + type + ' - ' + e.message, 'error');
    await reportResult(commandId, 'failed', e.message || 'execution failed');
    return false;
  }
}

async function executeBatch(batch) {
  log('Batch of ' + batch.length + (L ? ' comandos — ejecución atómica' : ' commands — atomic execution'), 'info');
  saveState({ phase: 'batch', total: batch.length, completed: 0, commands: batch.map(function(c) { return { id: c.commandId, type: c.type }; }) });

  // Phoenix Protocol: Create pre-execution snapshot
  var txId = 'tx-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
  var snapshot = null;
  try {
    snapshot = createSnapshot(batch, txId);
    if (snapshot) {
      log('🔥 Phoenix snapshot: ' + snapshot.id + ' (' + snapshot.filesBackedUp + ' files)', 'info');
      await reportSnapshotEvent('snapshot_created', { snapshotId: snapshot.id, txId: txId, filesBackedUp: snapshot.filesBackedUp, batchSize: batch.length });
    }
  } catch (snapErr) {
    log('Phoenix snapshot warning: ' + snapErr.message, 'warn');
  }

  var failed = false;
  var failedAtIndex = -1;
  for (var i = 0; i < batch.length; i++) {
    var cmd = batch[i];
    if (failed) {
      log((L ? 'Omitido: ' : 'Skipped: ') + cmd.type + ' (' + (cmd.commandId || '').slice(0, 8) + ')', 'warn');
      await reportResult(cmd.commandId, 'failed', 'Skipped: previous action in batch failed');
      continue;
    }
    log('Batch [' + (i + 1) + '/' + batch.length + '] ' + cmd.type + ' (' + (cmd.commandId || '').slice(0, 8) + ')', 'info');
    saveState({ phase: 'batch', total: batch.length, completed: i, current: cmd.commandId });
    var ok = await executeBridgeCommand(cmd);
    if (!ok) { failed = true; failedAtIndex = i; }
  }

  // Phoenix Protocol: Auto-rollback if batch failed mid-execution
  if (failed && snapshot && failedAtIndex > 0) {
    log('🔥 Phoenix auto-rollback: batch failed at index ' + failedAtIndex + ', restoring snapshot ' + snapshot.id, 'warn');
    var autoRb = rollbackFromSnapshot(snapshot.id);
    if (autoRb.success) {
      log('🔥 Phoenix: auto-rollback OK — ' + autoRb.filesRestored + ' files restored', 'success');
      await reportSnapshotEvent('rollback_executed', { snapshotId: snapshot.id, filesRestored: autoRb.filesRestored, trigger: 'auto', failedAtIndex: failedAtIndex });
    } else {
      log('🔥 Phoenix: auto-rollback FAILED — ' + (autoRb.error || ''), 'error');
    }
  }

  // Phoenix Protocol: Verify integrity post-execution if batch succeeded
  if (!failed) {
    try {
      var integrity = verifyIntegrity(batch);
      if (integrity.allValid) {
        log('🔥 Phoenix integrity OK: ' + integrity.verified + '/' + integrity.total + ' files verified', 'success');
        await reportSnapshotEvent('integrity_verified', { txId: txId, verified: integrity.verified, total: integrity.total, allValid: true });
      } else {
        log('🔥 Phoenix integrity MISMATCH: ' + integrity.mismatches.length + ' files', 'warn');
        await reportSnapshotEvent('integrity_mismatch', { txId: txId, verified: integrity.verified, total: integrity.total, mismatches: integrity.mismatches });
      }
    } catch (vErr) {
      log('Phoenix verify warning: ' + vErr.message, 'warn');
    }
    purgeOldSnapshots();
  }

  saveState({ phase: 'idle', lastBatchSize: batch.length, lastBatchFailed: failed });
}

async function pollClaudeCodeCommands() {
  // If we have buffered offline results, try to flush them first
  if (offlineResultsBuffer.length > 0) {
    await flushOfflineResults();
  }

  try {
    // Long-poll: server holds connection up to 25s until command is available
    var r = await fetch(CONFIG.OCTOPUS_URL + '/api/arms/claude-code/poll', {
      method: 'GET',
      headers: { 'x-bridge-token': CONFIG.BRIDGE_TOKEN },
      signal: AbortSignal.timeout(35000),
    });
    if (!r.ok) return false;
    var data = await r.json();
    if (!data.pending) return false;

    // Mark as online
    if (isOffline) {
      isOffline = false;
      log(L ? 'Conexión restaurada — Bridge online' : 'Connection restored — Bridge online', 'success');
      lastOnlineAt = Date.now();
    }

    // ---- Atomic Batch Execution ----
    var batch = data.batch && data.batch.length > 1 ? data.batch : null;
    if (batch) {
      await executeBatch(batch);
      return true;
    }

    // Single command (backward compatible) — with Phoenix snapshot for write/delete
    log('Code cmd: ' + data.type + ' (' + (data.commandId || '').slice(0, 8) + ')', 'info');
    saveState({ phase: 'executing', commandId: data.commandId, type: data.type });
    if (data.type === 'write_file' || data.type === 'delete_file') {
      try {
        var singleSnap = createSnapshot([data], 'single-' + (data.commandId || '').slice(0, 8));
        if (singleSnap) {
          await reportSnapshotEvent('snapshot_created', { snapshotId: singleSnap.id, filesBackedUp: singleSnap.filesBackedUp, batchSize: 1 });
        }
      } catch (se) { /* non-critical */ }
    }
    await executeBridgeCommand(data);
    return true;
  } catch (e) {
    // Network failure — mark as offline
    if (!isOffline) {
      isOffline = true;
      log(L ? 'Sin conexión — modo offline activado' : 'No connection — offline mode activated', 'warn');
      saveState({ phase: 'offline', since: new Date().toISOString(), buffered: offlineResultsBuffer.length });
    }
    return false;
  }
}

let codeTimer = null;
function startCodePoll() {
  async function tick() {
    const hadWork = await pollClaudeCodeCommands();
    const nextInterval = hadWork ? 50 : 500;
    codeTimer = setTimeout(tick, nextInterval);
  }
  tick();
}

// ========== WORKSPACE INTELLIGENCE — File Watcher + Index ==========
const SCAN_INTERVAL = 120000; // Full rescan every 2 min
const WATCH_DEBOUNCE_MS = 1500; // Debounce file change events
const IGNORE_PATTERNS = [
  'node_modules', '.git', '.DS_Store', '__pycache__', '.next',
  '.cache', 'dist', '.build', '.env', 'thumbs.db', '.swp', '.swo',
];

function shouldIgnore(name) {
  const lower = name.toLowerCase();
  return IGNORE_PATTERNS.some(p => lower === p || lower.startsWith(p + '/') || lower.startsWith(p + path.sep));
}

function scanWorkspace(dir, basePath) {
  const results = [];
  try {
    const entries = fs.readdirSync(dir);
    for (const name of entries) {
      if (shouldIgnore(name)) continue;
      try {
        const fullPath = path.join(dir, name);
        const stat = fs.statSync(fullPath);
        const relPath = basePath ? basePath + '/' + name : name;
        if (stat.isDirectory()) {
          results.push({ path: relPath, isDir: true, size: 0 });
          // Recurse (max depth 6)
          if (relPath.split('/').length < 7) {
            results.push(...scanWorkspace(fullPath, relPath));
          }
        } else {
          results.push({ path: relPath, isDir: false, size: stat.size });
        }
      } catch (e) { /* permission denied, symlink loop, etc */ }
    }
  } catch (e) { /* dir not readable */ }
  return results;
}

async function reportFullScan() {
  try {
    ensureWorkspace();
    const tree = scanWorkspace(WORKSPACE_DIR, '');
    const totalSize = tree.reduce((sum, f) => sum + (f.size || 0), 0);
    await fetch(CONFIG.OCTOPUS_URL + '/api/arms/claude-code/workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-bridge-token': CONFIG.BRIDGE_TOKEN },
      body: JSON.stringify({
        action: 'full_scan',
        fileTree: tree.slice(0, 2000),
        fileCount: tree.length,
        totalSize: totalSize,
        rootPath: WORKSPACE_DIR,
      }),
    });
    log((L ? 'Workspace indexado: ' : 'Workspace indexed: ') + tree.length + (L ? ' archivos' : ' files'), 'success');
  } catch (e) {
    log((L ? 'Error indexando workspace: ' : 'Error indexing workspace: ') + e.message, 'warn');
  }
}

let pendingChanges = [];
let changeFlushTimer = null;

async function flushFileChanges() {
  if (pendingChanges.length === 0) return;
  const batch = pendingChanges.splice(0, 50);
  try {
    await fetch(CONFIG.OCTOPUS_URL + '/api/arms/claude-code/workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-bridge-token': CONFIG.BRIDGE_TOKEN },
      body: JSON.stringify({ action: 'file_changes', changes: batch }),
    });
    log((L ? 'Cambios detectados: ' : 'Changes detected: ') + batch.length, 'info');
  } catch (e) {
    log((L ? 'Error reportando cambios: ' : 'Error reporting changes: ') + e.message, 'warn');
  }
}

function queueFileChange(eventType, filePath, isDir) {
  pendingChanges.push({ eventType, filePath, isDir: isDir || false, fileSize: 0 });
  // Try to get size for non-delete events
  if (eventType !== 'delete') {
    try {
      const full = path.resolve(WORKSPACE_DIR, filePath);
      const st = fs.statSync(full);
      pendingChanges[pendingChanges.length - 1].fileSize = st.size;
      pendingChanges[pendingChanges.length - 1].isDir = st.isDirectory();
    } catch (e) { /* file might already be gone */ }
  }
  if (changeFlushTimer) clearTimeout(changeFlushTimer);
  changeFlushTimer = setTimeout(flushFileChanges, WATCH_DEBOUNCE_MS);
}

const watchedDirs = new Set();
let fileWatcherActive = false;

function startFileWatcher() {
  ensureWorkspace();
  fileWatcherActive = true;
  // Watch workspace root recursively (Node 19+ supports { recursive: true })
  // Fallback: watch top-level dirs manually for older Node
  try {
    const watcher = fs.watch(WORKSPACE_DIR, { recursive: true }, (eventType, filename) => {
      if (!filename || shouldIgnore(filename.split(path.sep)[0] || '')) return;
      const relPath = filename.replace(/\\\\/g, '/');
      // Determine if it's a create/modify/delete
      const fullPath = path.resolve(WORKSPACE_DIR, relPath);
      let changeType = 'modify';
      try {
        fs.statSync(fullPath);
        // File exists — could be create or modify
        changeType = 'modify';
      } catch (e) {
        changeType = 'delete';
      }
      queueFileChange(changeType, relPath, false);
    });
    watcher.on('error', (err) => {
      log((L ? 'Watcher error: ' : 'Watcher error: ') + err.message, 'warn');
    });
    log(L ? 'File Watcher activo en workspace' : 'File Watcher active on workspace', 'success');
  } catch (e) {
    // Recursive watch not supported (older Node) — fallback to polling-based rescan
    log(L ? 'Watcher recursivo no soportado, usando rescan' : 'Recursive watcher not supported, using rescan', 'warn');
    fileWatcherActive = false;
  }
}

function startWorkspaceIntelligence() {
  // Initial full scan
  reportFullScan();
  // Start native file watcher
  startFileWatcher();
  // Periodic full rescan as safety net (every 2 min)
  setInterval(reportFullScan, SCAN_INTERVAL);
}

// ========== LOCAL FILE SERVER (Live Preview) ==========
var PREVIEW_PORT = 9753;
var MIME_TYPES = {
  '.html': 'text/html', '.htm': 'text/html',
  '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg',
  '.txt': 'text/plain', '.xml': 'application/xml',
  '.wasm': 'application/wasm', '.mjs': 'application/javascript',
};
function startPreviewServer() {
  var previewServer = http.createServer(function(req, res) {
    // CORS headers for cross-origin access
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    var urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

    // Resolve within workspace safely
    var filePath;
    try {
      filePath = safePath(urlPath.replace(/^\\//, ''));
    } catch (e) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

    // Check if it's a directory → try index.html inside
    try {
      var stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }
    } catch (e) {
      // File doesn't exist
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    // Read and serve the file
    try {
      var content = fs.readFileSync(filePath);
      var ext = path.extname(filePath).toLowerCase();
      var mime = MIME_TYPES[ext] || 'application/octet-stream';
      // Inject auto-reload script into HTML files
      if (ext === '.html' || ext === '.htm') {
        var htmlStr = content.toString('utf8');
        var reloadScript = '<script>(function(){var ws;function c(){ws=new WebSocket("ws://localhost:' + (PREVIEW_PORT + 1) + '");ws.onmessage=function(e){if(e.data==="reload")location.reload()};ws.onclose=function(){setTimeout(c,1500)}}c()})()<\\/script>';
        if (htmlStr.includes('</body>')) {
          htmlStr = htmlStr.replace('</body>', reloadScript + '</body>');
        } else {
          htmlStr += reloadScript;
        }
        res.writeHead(200, { 'Content-Type': mime + '; charset=utf-8', 'Cache-Control': 'no-cache, no-store' });
        res.end(htmlStr, 'utf8');
      } else {
        res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache, no-store' });
        res.end(content);
      }
    } catch (e) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  });

  previewServer.listen(PREVIEW_PORT, function() {
    log((L ? 'Servidor de preview local en ' : 'Local preview server at ') + 'http://localhost:' + PREVIEW_PORT, 'success');
  });
  previewServer.on('error', function(err) {
    if (err.code === 'EADDRINUSE') {
      log((L ? 'Puerto ' : 'Port ') + PREVIEW_PORT + (L ? ' en uso, intentando ' : ' in use, trying ') + (PREVIEW_PORT + 2), 'warn');
      PREVIEW_PORT += 2;
      previewServer.listen(PREVIEW_PORT);
    }
  });

  // WebSocket server for auto-reload notifications
  var wsClients = [];
  var wsServer = http.createServer();
  wsServer.listen(PREVIEW_PORT + 1, function() {
    log((L ? 'WebSocket HMR en puerto ' : 'WebSocket HMR on port ') + (PREVIEW_PORT + 1), 'info');
  });
  wsServer.on('error', function() {}); // silent if port taken

  // Minimal WebSocket upgrade handler (no external deps needed)
  wsServer.on('upgrade', function(req, socket) {
    var key = req.headers['sec-websocket-key'];
    if (!key) { socket.destroy(); return; }
    var accept = require('crypto').createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-5AB5DC11E65B').digest('base64');
    socket.write('HTTP/1.1 101 Switching Protocols\\r\\nUpgrade: websocket\\r\\nConnection: Upgrade\\r\\nSec-WebSocket-Accept: ' + accept + '\\r\\n\\r\\n');
    wsClients.push(socket);
    socket.on('close', function() { wsClients = wsClients.filter(function(c) { return c !== socket; }); });
    socket.on('error', function() { wsClients = wsClients.filter(function(c) { return c !== socket; }); });
  });

  // Watch workspace for changes and notify connected browsers
  var reloadDebounce = null;
  try {
    fs.watch(WORKSPACE_DIR, { recursive: true }, function(eventType, filename) {
      if (!filename) return;
      var ext = path.extname(filename).toLowerCase();
      if (['.html', '.htm', '.css', '.js', '.json', '.svg'].includes(ext)) {
        clearTimeout(reloadDebounce);
        reloadDebounce = setTimeout(function() {
          log((L ? 'Cambio detectado: ' : 'Change detected: ') + filename + (L ? ' → recargando preview' : ' → reloading preview'), 'info');
          var frame = Buffer.alloc(2 + 6);
          frame[0] = 0x81; // text frame
          frame[1] = 6; // length of "reload"
          frame.write('reload', 2);
          wsClients.forEach(function(s) { try { s.write(frame); } catch(e) {} });
        }, 400);
      }
    });
  } catch (e) {
    log((L ? 'File watcher para preview no disponible' : 'Preview file watcher not available'), 'warn');
  }
}

function log(msg, level) {
  const time = new Date().toLocaleTimeString();
  const p = { info: '[OCTOPUS]', success: '[OK]', warn: '[WARN]', error: '[ERROR]' }[level || 'info'] || '[OCTOPUS]';
  console.log('[' + time + '] ' + p + ' ' + msg);
}

// ========== BROWSER AUTOMATION MODULE ==========
var browserModule = { available: false, browser: null, page: null, polling: false };
var BROWSER_POLL_INTERVAL = 2000;

function checkPuppeteer() {
  try { require.resolve('puppeteer'); return true; } catch (e) { return false; }
}

function ensureStealthDeps() {
  var deps = ['puppeteer-extra', 'puppeteer-extra-plugin-stealth'];
  var need = [];
  for (var d of deps) { try { require.resolve(d); } catch(e) { need.push(d); } }
  if (need.length === 0) return true;
  log(L ? 'Instalando stealth anti-detecci\u00f3n...' : 'Installing stealth anti-detection...');
  try {
    var { execSync } = require('child_process');
    execSync('npm install ' + need.join(' '), { stdio: 'inherit', cwd: __dirname });
    log(L ? 'Stealth instalado ' + String.fromCodePoint(0x2705) : 'Stealth installed ' + String.fromCodePoint(0x2705));
    return true;
  } catch(e) { log('Stealth install failed: ' + e.message, 'warn'); return false; }
}

async function initBrowserModule() {
  if (!checkPuppeteer()) {
    log(L ? 'Browser Automation: puppeteer no instalado — ejecuta "npm install puppeteer" para activar' : 'Browser Automation: puppeteer not installed — run "npm install puppeteer" to enable', 'warn');
    browserModule.available = false;
  } else {
    browserModule.available = true;
    log(L ? 'Browser Automation: puppeteer detectado ' + String.fromCodePoint(0x2705) : 'Browser Automation: puppeteer detected ' + String.fromCodePoint(0x2705));
  }
  // Always report heartbeat and start polling — even without puppeteer
  // so the dashboard knows the bridge is running
  await reportBrowserHeartbeat(browserModule.available);
  startBrowserPoll();
}

async function reportBrowserHeartbeat(ready) {
  try {
    await fetch(CONFIG.OCTOPUS_URL + '/api/browser-bridge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-bridge-token': CONFIG.BRIDGE_TOKEN },
      body: JSON.stringify({ type: 'heartbeat', ready: !!ready }),
    });
  } catch (e) {}
}

var browserHeartbeatLast = 0;
async function startBrowserPoll() {
  if (browserModule.polling) return;
  browserModule.polling = true;
  async function tick() {
    if (!browserModule.polling) return;
    try {
      // Send heartbeat every 15 seconds to keep bridge status alive
      var now = Date.now();
      if (now - browserHeartbeatLast > 15000) {
        await reportBrowserHeartbeat(browserModule.available);
        browserHeartbeatLast = now;
      }
      // Poll for pending commands
      var res = await fetch(CONFIG.OCTOPUS_URL + '/api/browser-bridge', {
        headers: { 'x-bridge-token': CONFIG.BRIDGE_TOKEN },
      });
      if (res.ok) {
        var data = await res.json();
        if (data.commands && data.commands.length > 0) {
          for (var cmd of data.commands) {
            if (!browserModule.available) {
              // Puppeteer not installed — report error for each command
              log(String.fromCodePoint(0x26A0) + ' Browser command received but puppeteer not installed: ' + cmd.type, 'warn');
              await reportBrowserResult(cmd.id, false, null, 0, L ? 'Puppeteer no est\u00e1 instalado. Ejecuta: npm install puppeteer' : 'Puppeteer is not installed. Run: npm install puppeteer');
              continue;
            }
            log(String.fromCodePoint(0x1F3AF) + ' Browser: ' + cmd.type + ' ' + JSON.stringify(cmd.params || {}));
            var startTime = Date.now();
            try {
              var result = await executeBrowserCommand(cmd);
              var duration = Date.now() - startTime;
              log('   ' + String.fromCodePoint(0x2705) + (L ? ' Completado' : ' Completed') + ' (' + duration + 'ms)');
              await reportBrowserResult(cmd.id, true, result, duration);
            } catch (err) {
              var dur = Date.now() - startTime;
              log('   ' + String.fromCodePoint(0x274C) + ' Error: ' + err.message, 'error');
              await reportBrowserResult(cmd.id, false, null, dur, err.message);
            }
          }
        }
      }
    } catch (e) {
      // Silently retry on network errors
    }
    setTimeout(tick, BROWSER_POLL_INTERVAL);
  }
  tick();
}

async function ensureBrowser() {
  if (browserModule.browser && browserModule.page) {
    try { await browserModule.page.title(); return; } catch (e) { /* page closed, re-launch */ }
  }
  var puppeteer;
  var hasStealth = ensureStealthDeps();
  if (hasStealth) {
    puppeteer = require('puppeteer-extra');
    var StealthPlugin = require('puppeteer-extra-plugin-stealth');
    puppeteer.use(StealthPlugin());
    log(L ? String.fromCodePoint(0x1F6E1) + ' Anti-detecci\u00f3n stealth activada' : String.fromCodePoint(0x1F6E1) + ' Stealth anti-detection active');
  } else {
    puppeteer = require('puppeteer');
  }
  log(L ? 'Abriendo navegador...' : 'Opening browser...');
  browserModule.browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 800 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized', '--disable-blink-features=AutomationControlled'],
    ignoreDefaultArgs: ['--enable-automation'],
  });
  var pages = await browserModule.browser.pages();
  browserModule.page = pages[0] || await browserModule.browser.newPage();
  await browserModule.page.setViewport({ width: 1280, height: 800 });
  await browserModule.page.evaluateOnNewDocument(function() { Object.defineProperty(navigator, 'webdriver', { get: function() { return false; } }); });
  log(L ? 'Navegador listo (stealth) ' + String.fromCodePoint(0x2705) : 'Browser ready (stealth) ' + String.fromCodePoint(0x2705));
}

async function executeBrowserCommand(cmd) {
  await ensureBrowser();
  var page = browserModule.page;
  var params = cmd.params || {};
  var result = {};
  switch (cmd.type) {
    case 'goto': {
      await page.goto(params.url, { waitUntil: 'networkidle2', timeout: 30000 });
      result = { url: page.url(), title: await page.title() };
      var ss = await page.screenshot({ encoding: 'base64', type: 'jpeg', quality: 70 });
      await reportBrowserScreenshot(cmd.sessionId, 'data:image/jpeg;base64,' + ss, page.url());
      break;
    }
    case 'click': {
      // Detect :contains() pseudo-selector and convert to text search
      var containsMatch = params.selector && params.selector.match(/^(.*)\:contains\(['"]?(.+?)['"]?\)$/);
      if (containsMatch || params.method === 'text') {
        var searchText = containsMatch ? containsMatch[2] : params.selector;
        var tagFilter = containsMatch ? containsMatch[1] : null;
        log('Click by text: "' + searchText + '"' + (tagFilter ? ' (tag: ' + tagFilter + ')' : ''));
        var allEls = await page.$$( tagFilter || 'a, button, [role="button"], input[type="submit"], [onclick], span, div, li, td, th, h1, h2, h3, h4, h5, h6, p, label');
        var clicked = false;
        for (var el of allEls) {
          var text = await el.evaluate(function(e) { return (e.textContent || '').trim() || e.getAttribute('aria-label') || ''; });
          if (text.toLowerCase().includes(searchText.toLowerCase())) { await el.click(); clicked = true; break; }
        }
        if (!clicked) {
          // Try broader search with XPath
          var xpEls = await page.$x('//*[contains(translate(text(),"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"' + searchText.toLowerCase() + '")]');
          if (xpEls.length > 0) { await xpEls[0].click(); clicked = true; }
        }
        if (!clicked) log('Click by text failed: no element with text "' + searchText + '"', 'warn');
      } else if (params.x !== undefined && params.y !== undefined) {
        await page.mouse.click(params.x, params.y);
      } else {
        // Safety: if selector looks like :contains(), convert to text search
        try {
          await page.click(params.selector);
        } catch (clickErr) {
          log('CSS click failed for "' + params.selector + '", trying text fallback: ' + clickErr.message, 'warn');
          var fallbackEls = await page.$$('a, button, [role="button"], span, div, li, p, h1, h2, h3, h4, h5, h6, label');
          var fallbackClicked = false;
          for (var fbEl of fallbackEls) {
            var fbText = await fbEl.evaluate(function(e) { return (e.textContent || '').trim(); });
            if (fbText.toLowerCase().includes(params.selector.toLowerCase())) { await fbEl.click(); fallbackClicked = true; break; }
          }
          if (!fallbackClicked) throw clickErr;
        }
      }
      await page.waitForNetworkIdle({ timeout: 5000 }).catch(function() {});
      result = { url: page.url(), title: await page.title() };
      break;
    }
    case 'type': {
      if (params.selector) await page.click(params.selector).catch(function() {});
      await page.keyboard.type(params.text, { delay: 50 });
      result = { typed: params.text };
      break;
    }
    case 'screenshot': {
      var scr = await page.screenshot({ encoding: 'base64', type: 'jpeg', quality: 80, fullPage: !!params.fullPage });
      var scrUrl = 'data:image/jpeg;base64,' + scr;
      await reportBrowserScreenshot(cmd.sessionId, scrUrl, page.url());
      result = { url: page.url(), title: await page.title(), screenshotUrl: scrUrl };
      break;
    }
    case 'scroll': {
      var amount = params.amount || 500;
      var direction = params.direction === 'up' ? -amount : amount;
      await page.evaluate(function(d) { window.scrollBy(0, d); }, direction);
      result = { scrolled: direction };
      break;
    }
    case 'wait': {
      await new Promise(function(r) { setTimeout(r, params.ms || 1000); });
      result = { waited: params.ms || 1000 };
      break;
    }
    case 'extract': {
      var extracted = await page.evaluate(function(sel) {
        if (sel) { var el = document.querySelector(sel); return el ? (el.textContent || '').trim() : null; }
        return document.body.innerText.substring(0, 5000);
      }, params.selector || null);
      result = { extracted: extracted };
      break;
    }
    case 'evaluate': {
      var evalR = await page.evaluate(params.script);
      result = { result: evalR };
      break;
    }
    case 'keypress': {
      var key = params.key || 'Enter';
      await page.keyboard.press(key);
      result = { pressed: key };
      break;
    }
    case 'new_tab': {
      var newTabPage = await browserModule.browser.newPage();
      await newTabPage.setViewport({ width: 1280, height: 800 });
      if (params.url) await newTabPage.goto(params.url, { waitUntil: 'networkidle2', timeout: 30000 });
      browserModule.page = newTabPage;
      result = { tabId: params.tabId || 'new', url: newTabPage.url(), title: await newTabPage.title() };
      break;
    }
    case 'switch_tab': {
      var pages = await browserModule.browser.pages();
      var idx = parseInt(params.tabId) || 0;
      if (pages[idx]) { browserModule.page = pages[idx]; await pages[idx].bringToFront(); }
      result = { tabId: params.tabId, url: browserModule.page.url() };
      break;
    }
    case 'close_tab': {
      var allPages = await browserModule.browser.pages();
      if (allPages.length > 1) { await browserModule.page.close(); browserModule.page = allPages[0]; }
      result = { closed: true };
      break;
    }
    case 'list_tabs': {
      var tabPages = await browserModule.browser.pages();
      var tabList = [];
      for (var ti = 0; ti < tabPages.length; ti++) {
        try { tabList.push({ id: String(ti), url: tabPages[ti].url(), title: await tabPages[ti].title() }); } catch(e) { tabList.push({ id: String(ti), url: 'unknown', title: 'unknown' }); }
      }
      result = { tabs: tabList };
      break;
    }
    default: throw new Error('Unknown browser command: ' + cmd.type);
  }
  return result;
}

async function reportBrowserResult(commandId, success, result, duration, error) {
  try {
    await fetch(CONFIG.OCTOPUS_URL + '/api/browser-bridge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-bridge-token': CONFIG.BRIDGE_TOKEN },
      body: JSON.stringify({ type: 'command_result', commandId: commandId, success: success, result: result, duration: duration, error: error || null }),
    });
  } catch (e) { log('Browser report error: ' + e.message, 'warn'); }
}

async function reportBrowserScreenshot(sessionId, screenshotUrl, currentUrl) {
  try {
    await fetch(CONFIG.OCTOPUS_URL + '/api/browser-bridge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-bridge-token': CONFIG.BRIDGE_TOKEN },
      body: JSON.stringify({ type: 'screenshot', sessionId: sessionId, screenshotUrl: screenshotUrl, currentUrl: currentUrl }),
    });
  } catch (e) {}
}
// ========== END BROWSER AUTOMATION MODULE ==========

async function main() {
  console.log('');
  console.log('  ========================================');
  console.log('  |  OCTOPUS Bridge - WiZ Controller     |');
  console.log('  ========================================');
  console.log('  Server: ' + CONFIG.OCTOPUS_URL);
  console.log('  Token:  ' + CONFIG.BRIDGE_TOKEN.slice(0, 15) + '...');
  console.log('  Poll:   ' + (L ? 'cada ' : 'every ') + (CONFIG.POLL_INTERVAL / 1000) + 's');
  console.log('');
  log(L ? 'Buscando dispositivos WiZ en tu red local...' : 'Searching for WiZ devices on your local network...');
  const devices = await discoverDevices();
  log((L ? 'Encontrados ' : 'Found ') + devices.length + (L ? ' dispositivo(s) WiZ' : ' WiZ device(s)'));
  if (devices.length > 0) { log(L ? 'Reportando dispositivos a OCTOPUS...' : 'Reporting devices to OCTOPUS...'); await reportDiscovery(devices); }
  await sendHeartbeat();
  log(L ? 'Detectando Ollama...' : 'Detecting Ollama...');
  await reportOllamaStatus();
  log(L ? 'Bridge conectado y escuchando comandos...' : 'Bridge connected and listening for commands...');
  log(L ? 'Presiona Ctrl+C para detener' : 'Press Ctrl+C to stop');
  console.log('');
  const pt = setInterval(pollCommands, CONFIG.POLL_INTERVAL);
  const ht = setInterval(sendHeartbeat, CONFIG.HEARTBEAT_INTERVAL);
  const dt = setInterval(async () => { log(L ? 'Re-escaneando...' : 'Re-scanning...'); const nd = await discoverDevices(); if (nd.length > 0) await reportDiscovery(nd); }, CONFIG.DISCOVERY_INTERVAL);
  const ot = setInterval(reportOllamaStatus, CONFIG.OLLAMA_CHECK_INTERVAL);
  log(L ? 'Iniciando relay de chat Ollama...' : 'Starting Ollama chat relay...');
  startChatPoll();
  log(L ? 'Iniciando Code Engine (ALFA)...' : 'Starting Code Engine (ALFA)...');
  ensureWorkspace();
  log('Workspace: ' + WORKSPACE_DIR, 'info');
  // Recovery: check for offline state from previous session
  var savedState = loadState();
  if (savedState && savedState.phase === 'offline_buffer' && savedState.bufferedResults > 0) {
    log(L ? 'Estado previo detectado — intentando re-sync...' : 'Previous state detected — attempting re-sync...', 'info');
  }
  startCodePoll();
  log(L ? 'Iniciando Workspace Intelligence...' : 'Starting Workspace Intelligence...');
  startWorkspaceIntelligence();
  log(L ? 'Iniciando servidor de preview local...' : 'Starting local preview server...');
  startPreviewServer();
  log(L ? 'Iniciando Browser Automation...' : 'Starting Browser Automation...');
  initBrowserModule().catch(function(e) { log('Browser module error: ' + e.message, 'warn'); });
  process.on('SIGINT', async () => { log(L ? 'Deteniendo bridge...' : 'Stopping bridge...'); clearInterval(pt); clearInterval(ht); clearInterval(dt); clearInterval(ot); if (chatTimer) clearTimeout(chatTimer); if (codeTimer) clearTimeout(codeTimer); browserModule.polling = false; if (browserModule.browser) { try { await browserModule.browser.close(); } catch(e) {} } log((L ? 'Comandos procesados: ' : 'Commands processed: ') + commandsProcessed); process.exit(0); });
}
main().catch((err) => { console.error('Fatal:', err); process.exit(1); });`
}

// Split base64 into chunks for safe embedding
function splitB64(b64: string, chunkSize: number): string[] {
  const chunks: string[] = []
  for (let i = 0; i < b64.length; i += chunkSize) {
    chunks.push(b64.slice(i, i + chunkSize))
  }
  return chunks
}

function generateWindowsBat(token: string, serverUrl: string, isEs: boolean, b64: string): string {
  // Ultra-minimal BAT: no chcp, no special chars — just echo b64 chunks + call node
  const chunks = splitB64(b64, 8000)

  const batLines: string[] = []
  batLines.push('@echo off')
  batLines.push('title OCTOPUS Bridge')
  batLines.push('where node >nul 2>nul')
  batLines.push('if %errorlevel% neq 0 (')
  batLines.push('  echo [ERROR] Node.js not found. Install from https://nodejs.org')
  batLines.push('  pause')
  batLines.push('  exit /b 1')
  batLines.push(')')
  // Write b64 chunks to temp file (base64 chars are CMD-safe)
  chunks.forEach((chunk, i) => {
    const redir = i === 0 ? '>' : '>>'
    batLines.push(`echo ${chunk}${redir}"%TEMP%\\oct_b64.txt"`)
  })
  // Node decodes and runs the bridge (terminal stays open)
  batLines.push(`node -e "var f=require('fs'),p=require('path'),o=require('os');var t=o.tmpdir();var b=f.readFileSync(p.join(t,'oct_b64.txt'),'utf8').replace(/\\s/g,'');var js=p.join(t,'octopus_bridge_run.js');f.writeFileSync(js,Buffer.from(b,'base64'));try{f.unlinkSync(p.join(t,'oct_b64.txt'))}catch(e){};console.log('  OCTOPUS Bridge - Starting...');console.log('  Server: ${serverUrl}');console.log('');require(js);"`)
  batLines.push('echo.')
  batLines.push(`echo ${isEs ? 'Bridge detenido.' : 'Bridge stopped.'}`)
  batLines.push('pause')

  return batLines.join('\r\n') + '\r\n'
}

function generateMacCommand(token: string, serverUrl: string, isEs: boolean, b64: string): string {
  // For Mac/Linux, node -e can handle long strings (ARG_MAX is ~260KB)
  // Use node to decode base64 since macOS base64 flags differ from Linux
  return `#!/bin/bash
# OCTOPUS Bridge - ${isEs ? 'Instalador para macOS' : 'macOS Installer'}

clear
echo ""
echo "  ========================================"
echo "  OCTOPUS Bridge - ${isEs ? 'Instalador WiZ' : 'WiZ Installer'}"
echo "  ========================================"
echo ""

if ! command -v node &> /dev/null; then
  echo "  [ERROR] ${isEs ? 'Node.js no encontrado!' : 'Node.js not found!'}"
  echo ""
  echo "  ${isEs ? 'Necesitas instalar Node.js 18 o superior.' : 'You need to install Node.js 18 or higher.'}"
  echo ""
  echo "  ${isEs ? 'Opciones:' : 'Options:'}"
  echo "    1. ${isEs ? 'Descarga desde' : 'Download from'}: https://nodejs.org"
  echo "    2. ${isEs ? 'Con Homebrew' : 'With Homebrew'}: brew install node"
  echo ""
  read -p "  ${isEs ? 'Presiona Enter para salir...' : 'Press Enter to exit...'}"
  exit 1
fi

NODE_VER=$(node -v | cut -d'.' -f1 | tr -d 'v')
if [ "$NODE_VER" -lt 18 ]; then
  echo "  [WARN] ${isEs ? 'Tu Node.js es version' : 'Your Node.js is version'} $(node -v)"
  echo "  ${isEs ? 'Se requiere Node.js 18+.' : 'Node.js 18+ required.'}"
  read -p "  ${isEs ? 'Presiona Enter para salir...' : 'Press Enter to exit...'}"
  exit 1
fi

echo "  [OK] Node.js ${isEs ? 'detectado' : 'detected'}: $(node -v)"
echo ""
echo "  Server: ${serverUrl}"
echo "  Token:  ${token.slice(0, 15)}..."
echo ""
echo "  ${isEs ? 'Iniciando OCTOPUS Bridge...' : 'Starting OCTOPUS Bridge...'}"
echo "  ${isEs ? 'Presiona Ctrl+C para detener' : 'Press Ctrl+C to stop'}"
echo ""

# Create temp JS file using node to decode base64 and run
TMPJS=$(mktemp /tmp/octopus-bridge-XXXXXX.js)
node -e "require('fs').writeFileSync('$TMPJS', Buffer.from('${b64}', 'base64'))"

# Run bridge
node "$TMPJS"

# Cleanup
rm -f "$TMPJS"
echo ""
echo "  ${isEs ? 'Bridge detenido.' : 'Bridge stopped.'}"
read -p "  ${isEs ? 'Presiona Enter para salir...' : 'Press Enter to exit...'}"
`
}

function generateLinuxSh(token: string, serverUrl: string, isEs: boolean, b64: string): string {
  return `#!/bin/bash
# OCTOPUS Bridge - ${isEs ? 'Instalador para Linux' : 'Linux Installer'}

clear
echo ""
echo "  ========================================"
echo "  OCTOPUS Bridge - ${isEs ? 'Instalador WiZ' : 'WiZ Installer'}"
echo "  ========================================"
echo ""

if ! command -v node &> /dev/null; then
  echo "  [ERROR] ${isEs ? 'Node.js no encontrado!' : 'Node.js not found!'}"
  echo ""
  echo "  ${isEs ? 'Necesitas instalar Node.js 18 o superior.' : 'You need to install Node.js 18 or higher.'}"
  echo ""
  echo "  ${isEs ? 'Opciones:' : 'Options:'}"
  echo "    Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs"
  echo "    Fedora: sudo dnf install nodejs"
  echo "    ${isEs ? 'O descarga desde' : 'Or download from'}: https://nodejs.org"
  echo ""
  read -p "  ${isEs ? 'Presiona Enter para salir...' : 'Press Enter to exit...'}"
  exit 1
fi

NODE_VER=$(node -v | cut -d'.' -f1 | tr -d 'v')
if [ "$NODE_VER" -lt 18 ]; then
  echo "  [WARN] ${isEs ? 'Tu Node.js es version' : 'Your Node.js is version'} $(node -v)"
  echo "  ${isEs ? 'Se requiere Node.js 18+.' : 'Node.js 18+ required.'}"
  read -p "  ${isEs ? 'Presiona Enter para salir...' : 'Press Enter to exit...'}"
  exit 1
fi

echo "  [OK] Node.js ${isEs ? 'detectado' : 'detected'}: $(node -v)"
echo ""
echo "  Server: ${serverUrl}"
echo "  Token:  ${token.slice(0, 15)}..."
echo ""
echo "  ${isEs ? 'Iniciando OCTOPUS Bridge...' : 'Starting OCTOPUS Bridge...'}"
echo "  ${isEs ? 'Presiona Ctrl+C para detener' : 'Press Ctrl+C to stop'}"
echo ""

# Create temp JS file using node to decode base64 and run
TMPJS=$(mktemp /tmp/octopus-bridge-XXXXXX.js)
node -e "require('fs').writeFileSync('$TMPJS', Buffer.from('${b64}', 'base64'))"

# Run bridge
node "$TMPJS"

# Cleanup
rm -f "$TMPJS"
echo ""
echo "  ${isEs ? 'Bridge detenido.' : 'Bridge stopped.'}"
read -p "  ${isEs ? 'Presiona Enter para salir...' : 'Press Enter to exit...'}"
`
}

// ==================== SERVICE INSTALLERS ====================
// These set up the bridge as a background daemon that auto-starts

function generateMacServiceInstaller(token: string, serverUrl: string, isEs: boolean, b64: string): string {
  const label = 'com.octopus.bridge'
  return `#!/bin/bash
# OCTOPUS Bridge - ${isEs ? 'Instalador de Servicio macOS' : 'macOS Service Installer'}
# ${isEs ? 'Instala el bridge como servicio que arranca automaticamente' : 'Installs the bridge as an auto-starting background service'}

set -e
clear
echo ""
echo "  ========================================"
echo "  ${isEs ? '🐙 OCTOPUS Bridge — Servicio macOS' : '🐙 OCTOPUS Bridge — macOS Service'}"
echo "  ========================================"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "  ❌ ${isEs ? 'Node.js no encontrado! Instala desde https://nodejs.org' : 'Node.js not found! Install from https://nodejs.org'}"
  exit 1
fi
NODE_PATH=$(which node)
NODE_VER=$(node -v | cut -d'.' -f1 | tr -d 'v')
if [ "$NODE_VER" -lt 18 ]; then
  echo "  ❌ ${isEs ? 'Se requiere Node.js 18+. Tienes' : 'Node.js 18+ required. You have'} $(node -v)"
  exit 1
fi
echo "  ✅ Node.js $(node -v) @ $NODE_PATH"

# Create bridge directory
BRIDGE_DIR="$HOME/.octopus-bridge"
mkdir -p "$BRIDGE_DIR"
echo "  📁 ${isEs ? 'Directorio' : 'Directory'}: $BRIDGE_DIR"

# Write bridge script
node -e "require('fs').writeFileSync('$BRIDGE_DIR/bridge.js', Buffer.from('${b64}', 'base64'))"
echo "  📝 ${isEs ? 'Script del bridge instalado' : 'Bridge script installed'}"

# Create LaunchAgent plist
PLIST_PATH="$HOME/Library/LaunchAgents/${label}.plist"
mkdir -p "$HOME/Library/LaunchAgents"

cat > "$PLIST_PATH" << PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${label}</string>
    <key>ProgramArguments</key>
    <array>
        <string>$NODE_PATH</string>
        <string>$BRIDGE_DIR/bridge.js</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
    </dict>
    <key>StandardOutPath</key>
    <string>$BRIDGE_DIR/bridge.log</string>
    <key>StandardErrorPath</key>
    <string>$BRIDGE_DIR/bridge-error.log</string>
    <key>ThrottleInterval</key>
    <integer>10</integer>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
    </dict>
</dict>
</plist>
PLIST_EOF

echo "  📋 ${isEs ? 'LaunchAgent creado' : 'LaunchAgent created'}: $PLIST_PATH"

# Unload if already running, then load
launchctl bootout gui/$(id -u) "$PLIST_PATH" 2>/dev/null || true
sleep 1
launchctl bootstrap gui/$(id -u) "$PLIST_PATH"

echo ""
echo "  ✅ ${isEs ? '¡OCTOPUS Bridge instalado como servicio!' : 'OCTOPUS Bridge installed as service!'}"
echo ""
echo "  ${isEs ? 'El bridge ahora:' : 'The bridge now:'}"
echo "    ✓ ${isEs ? 'Corre en segundo plano (sin terminal)' : 'Runs in the background (no terminal needed)'}"
echo "    ✓ ${isEs ? 'Arranca automaticamente al iniciar sesion' : 'Auto-starts when you log in'}"
echo "    ✓ ${isEs ? 'Se reinicia si se cae' : 'Restarts if it crashes'}"
echo ""
echo "  ${isEs ? 'Comandos utiles:' : 'Useful commands:'}"
echo "    ${isEs ? 'Ver logs' : 'View logs'}:     tail -f $BRIDGE_DIR/bridge.log"
echo "    ${isEs ? 'Detener' : 'Stop'}:       launchctl bootout gui/$(id -u) $PLIST_PATH"
echo "    ${isEs ? 'Iniciar' : 'Start'}:      launchctl bootstrap gui/$(id -u) $PLIST_PATH"
echo "    ${isEs ? 'Desinstalar' : 'Uninstall'}:  launchctl bootout gui/$(id -u) $PLIST_PATH && rm $PLIST_PATH && rm -rf $BRIDGE_DIR"
echo ""
echo "  Server: ${serverUrl}"
echo "  Token:  ${token.slice(0, 15)}..."
echo "  Logs:   $BRIDGE_DIR/bridge.log"
echo ""
read -p "  ${isEs ? 'Presiona Enter para cerrar...' : 'Press Enter to close...'}"
`
}

function generateLinuxServiceInstaller(token: string, serverUrl: string, isEs: boolean, b64: string): string {
  return `#!/bin/bash
# OCTOPUS Bridge - ${isEs ? 'Instalador de Servicio Linux (systemd)' : 'Linux Service Installer (systemd)'}

set -e
clear
echo ""
echo "  ========================================"
echo "  ${isEs ? '🐙 OCTOPUS Bridge — Servicio Linux' : '🐙 OCTOPUS Bridge — Linux Service'}"
echo "  ========================================"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "  ❌ ${isEs ? 'Node.js no encontrado!' : 'Node.js not found!'}"
  echo "  ${isEs ? 'Instala con' : 'Install with'}: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs"
  exit 1
fi
NODE_PATH=$(which node)
NODE_VER=$(node -v | cut -d'.' -f1 | tr -d 'v')
if [ "$NODE_VER" -lt 18 ]; then
  echo "  ❌ ${isEs ? 'Se requiere Node.js 18+' : 'Node.js 18+ required'}"
  exit 1
fi
echo "  ✅ Node.js $(node -v)"

# Create bridge directory
BRIDGE_DIR="$HOME/.octopus-bridge"
mkdir -p "$BRIDGE_DIR"

# Write bridge script
node -e "require('fs').writeFileSync('$BRIDGE_DIR/bridge.js', Buffer.from('${b64}', 'base64'))"
echo "  📝 ${isEs ? 'Script instalado en' : 'Script installed at'} $BRIDGE_DIR/bridge.js"

# Create systemd user service
SERVICE_DIR="$HOME/.config/systemd/user"
mkdir -p "$SERVICE_DIR"

cat > "$SERVICE_DIR/octopus-bridge.service" << SERVICE_EOF
[Unit]
Description=OCTOPUS Bridge - WiZ Smart Home Controller
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=$NODE_PATH $BRIDGE_DIR/bridge.js
Restart=always
RestartSec=10
StandardOutput=append:$BRIDGE_DIR/bridge.log
StandardError=append:$BRIDGE_DIR/bridge-error.log
Environment=PATH=/usr/local/bin:/usr/bin:/bin

[Install]
WantedBy=default.target
SERVICE_EOF

echo "  📋 ${isEs ? 'Servicio systemd creado' : 'Systemd service created'}"

# Enable and start
systemctl --user daemon-reload
systemctl --user enable octopus-bridge.service
systemctl --user restart octopus-bridge.service

# Enable lingering so service runs even when not logged in
loginctl enable-linger "$USER" 2>/dev/null || true

echo ""
echo "  ✅ ${isEs ? '¡OCTOPUS Bridge instalado como servicio!' : 'OCTOPUS Bridge installed as service!'}"
echo ""
echo "  ${isEs ? 'El bridge ahora:' : 'The bridge now:'}"
echo "    ✓ ${isEs ? 'Corre en segundo plano' : 'Runs in the background'}"
echo "    ✓ ${isEs ? 'Arranca con el sistema' : 'Auto-starts with the system'}"
echo "    ✓ ${isEs ? 'Se reinicia si se cae' : 'Restarts if it crashes'}"
echo ""
echo "  ${isEs ? 'Comandos utiles' : 'Useful commands'}:"
echo "    ${isEs ? 'Estado' : 'Status'}:      systemctl --user status octopus-bridge"
echo "    ${isEs ? 'Logs' : 'Logs'}:        journalctl --user -u octopus-bridge -f"
echo "    ${isEs ? 'Detener' : 'Stop'}:       systemctl --user stop octopus-bridge"
echo "    ${isEs ? 'Iniciar' : 'Start'}:      systemctl --user start octopus-bridge"
echo "    ${isEs ? 'Desinstalar' : 'Uninstall'}:  systemctl --user disable --now octopus-bridge && rm $SERVICE_DIR/octopus-bridge.service && rm -rf $BRIDGE_DIR"
echo ""
read -p "  ${isEs ? 'Presiona Enter para cerrar...' : 'Press Enter to close...'}"
`
}

function generateWindowsServiceInstaller(token: string, serverUrl: string, isEs: boolean, b64: string): string {
  // STRATEGY: Ultra-minimal BAT — ONLY calls node. Node handles EVERYTHING.
  // This avoids ALL CMD parsing issues (chcp, echo, special chars, CRLF).
  // The entire setup+UI is in a single Node.js -e command.
  const setupJS = generateWindowsSetupJS(b64, isEs)
  const setupB64 = Buffer.from(setupJS).toString('base64')

  // We write the base64 payload as a separate .txt file using certutil (built into Windows)
  // Then Node reads it. This avoids CMD line-length limits entirely.
  // BUT certutil decodes to binary — so we use node to write the b64 file and decode it.

  // Split base64 into safe CMD-echo chunks (max 8000 chars, base64 is CMD-safe charset)
  const CHUNK = 8000
  const chunks: string[] = []
  for (let i = 0; i < setupB64.length; i += CHUNK) {
    chunks.push(setupB64.slice(i, i + CHUNK))
  }

  // BAT: pure ASCII, no chcp, no fancy echo — just write b64 file + call node
  const batLines: string[] = []
  batLines.push('@echo off')
  batLines.push('title OCTOPUS Bridge Installer')
  batLines.push('where node >nul 2>nul')
  batLines.push('if %errorlevel% neq 0 (')
  batLines.push('  echo [ERROR] Node.js not found. Install from https://nodejs.org')
  batLines.push('  pause')
  batLines.push('  exit /b 1')
  batLines.push(')')
  // Write b64 chunks to temp file
  chunks.forEach((chunk, i) => {
    const redir = i === 0 ? '>' : '>>'
    batLines.push(`echo ${chunk}${redir}"%TEMP%\\oct_b64.txt"`)
  })
  // Node: read b64 file, decode, write setup.js, run it, show all messages
  batLines.push(`node -e "var f=require('fs'),p=require('path'),o=require('os');var t=o.tmpdir();var b=f.readFileSync(p.join(t,'oct_b64.txt'),'utf8').replace(/\\s/g,'');f.writeFileSync(p.join(t,'oct_setup.js'),Buffer.from(b,'base64'));try{f.unlinkSync(p.join(t,'oct_b64.txt'))}catch(e){};require(p.join(t,'oct_setup.js'))"`)
  batLines.push('pause')

  return batLines.join('\r\n') + '\r\n'
}

/** Generate a clean Node.js setup script for Windows service install */
function generateWindowsSetupJS(bridgeB64: string, isEs: boolean): string {
  return `// OCTOPUS Bridge - Windows Service Setup (runs via Node.js)
var fs = require('fs');
var os = require('os');
var path = require('path');
var exec = require('child_process').execSync;

var DIR = path.join(os.homedir(), '.octopus-bridge');
var B64 = '${bridgeB64}';

function log(m) { console.log('  ' + m); }

console.log('');
console.log('  ========================================');
console.log('  OCTOPUS Bridge - ${isEs ? 'Servicio Windows' : 'Windows Service'}');
console.log('  ========================================');
console.log('');

// 1. Create directory
try { fs.mkdirSync(DIR, { recursive: true }); } catch(e) {}
log('[OK] ${isEs ? 'Directorio' : 'Directory'}: ' + DIR);

// 2. Write bridge.js
fs.writeFileSync(path.join(DIR, 'bridge.js'), Buffer.from(B64, 'base64'));
log('[OK] bridge.js ${isEs ? 'instalado' : 'installed'}');

// 3. Write launcher.vbs (launches node INVISIBLE and DETACHED)
var np = process.execPath.replace(/\\\\/g, '\\\\\\\\');
var vbs = 'Set WshShell = CreateObject("WScript.Shell")\\r\\n'
  + 'Set fso = CreateObject("Scripting.FileSystemObject")\\r\\n'
  + 'bridgeDir = fso.GetParentFolderName(WScript.ScriptFullName)\\r\\n'
  + 'bridgeJS = bridgeDir & "\\\\\\\\bridge.js"\\r\\n'
  + 'logFile = bridgeDir & "\\\\\\\\bridge.log"\\r\\n'
  + 'nodePath = "' + np + '"\\r\\n'
  + 'cmd = """" & nodePath & """ """ & bridgeJS & """ >> """ & logFile & """ 2>&1"\\r\\n'
  + 'WshShell.Run cmd, 0, False\\r\\n';
fs.writeFileSync(path.join(DIR, 'launcher.vbs'), vbs);
log('[OK] launcher.vbs ${isEs ? 'creado' : 'created'}');

// 4. Create startup shortcut (no admin needed)
var lp = path.join(DIR, 'launcher.vbs').replace(/\\\\/g, '\\\\\\\\');
var sv = 'Set s = CreateObject("WScript.Shell")\\r\\n'
  + 'Set l = s.CreateShortcut(s.SpecialFolders("Startup") & "\\\\\\\\OCTOPUS-Bridge.lnk")\\r\\n'
  + 'l.TargetPath = "' + lp + '"\\r\\n'
  + 'l.WindowStyle = 7\\r\\n'
  + 'l.Description = "OCTOPUS Bridge"\\r\\n'
  + 'l.Save\\r\\n';
var mkLnk = path.join(DIR, '_mksc.vbs');
fs.writeFileSync(mkLnk, sv);
try {
  exec('cscript //nologo "' + mkLnk + '"', { stdio: 'ignore' });
  log('[OK] ${isEs ? 'Acceso directo en Inicio creado' : 'Startup shortcut created'}');
} catch(e) {
  log('[WARN] ${isEs ? 'No se pudo crear acceso directo' : 'Could not create shortcut'}');
}
try { fs.unlinkSync(mkLnk); } catch(e) {}

// 5. Try Task Scheduler as backup
try { exec('schtasks /delete /tn "OCTOPUS-Bridge" /f', { stdio: 'ignore' }); } catch(e) {}
try {
  var lpath = path.join(DIR, 'launcher.vbs');
  exec('schtasks /create /tn "OCTOPUS-Bridge" /tr "wscript.exe \\\\"' + lpath + '\\\\""  /sc onlogon /rl highest /f', { stdio: 'ignore' });
  log('[OK] ${isEs ? 'Tarea programada creada' : 'Scheduled task created'}');
} catch(e) {
  log('[INFO] ${isEs ? 'Task Scheduler requiere admin (acceso directo funciona sin admin)' : 'Task Scheduler needs admin (shortcut works without admin)'}');
}

// 6. LAUNCH NOW
try {
  exec('wscript.exe "' + path.join(DIR, 'launcher.vbs') + '"', { stdio: 'ignore' });
  log('[OK] ${isEs ? 'Bridge INICIADO (proceso invisible)' : 'Bridge STARTED (invisible process)'}');
} catch(e) {
  log('[ERR] ${isEs ? 'Error lanzando bridge' : 'Error launching bridge'}: ' + e.message);
}

console.log('');
console.log('  ========================================');
console.log('  ${isEs ? 'OCTOPUS Bridge instalado!' : 'OCTOPUS Bridge installed!'}');
console.log('  ========================================');
console.log('');
log('${isEs ? 'El bridge corre INVISIBLE en segundo plano' : 'The bridge runs INVISIBLE in the background'}');
log('${isEs ? 'Sobrevive aunque cierres esta ventana' : 'Survives even if you close this window'}');
log('${isEs ? 'Arranca automaticamente al encender tu PC' : 'Auto-starts when you turn on your PC'}');
console.log('');
log('Logs:  ' + path.join(DIR, 'bridge.log'));
console.log('');
log('${isEs ? 'YA PUEDES CERRAR ESTA VENTANA.' : 'YOU CAN CLOSE THIS WINDOW NOW.'}');
console.log('');
`
}