#!/usr/bin/env node
/**
 * 🐙 OCTOPUS Bridge — WiZ Local Controller
 * 
 * Este script corre en tu PC y actúa como puente entre
 * OCTOPUS Cloud y tus dispositivos WiZ en tu red WiFi local.
 * 
 * Requisitos: Node.js 18+ (para fetch nativo)
 * Uso: node octopus-bridge.js
 * 
 * Configuración: edita las variables abajo o usa variables de entorno:
 *   OCTOPUS_URL  — URL de tu OCTOPUS (ej: https://octopus-omni-cockpit-n8hd61.abacusai.app)
 *   BRIDGE_TOKEN — Token del bridge (obténlo desde Hogar Inteligente en OCTOPUS)
 */

const dgram = require('dgram');
const { Buffer } = require('buffer');

// ==================== CONFIGURACIÓN ====================
const CONFIG = {
  OCTOPUS_URL: process.env.OCTOPUS_URL || 'https://octopus-omni-cockpit-n8hd61.abacusai.app',
  BRIDGE_TOKEN: process.env.BRIDGE_TOKEN || '',
  POLL_INTERVAL: 3000,       // Poll cada 3 segundos
  HEARTBEAT_INTERVAL: 30000, // Heartbeat cada 30s
  WIZ_PORT: 38899,           // Puerto UDP de WiZ
  UDP_TIMEOUT: 3000,         // Timeout para respuestas UDP
  DISCOVERY_INTERVAL: 60000, // Descubrir dispositivos cada 60s
};

// ==================== ESTADO ====================
const knownDevices = new Map(); // mac -> { ip, lastSeen, state }
let isRunning = true;
let commandsProcessed = 0;
let lastHeartbeat = null;

// ==================== UDP HELPERS ====================

function sendUDP(ip, message) {
  return new Promise((resolve, reject) => {
    const client = dgram.createSocket('udp4');
    const msg = Buffer.from(JSON.stringify(message));
    let responded = false;

    const timeout = setTimeout(() => {
      if (!responded) {
        responded = true;
        client.close();
        reject(new Error(`UDP timeout para ${ip}`));
      }
    }, CONFIG.UDP_TIMEOUT);

    client.on('message', (data) => {
      if (!responded) {
        responded = true;
        clearTimeout(timeout);
        try {
          const parsed = JSON.parse(data.toString());
          client.close();
          resolve(parsed);
        } catch (e) {
          client.close();
          reject(new Error('Respuesta UDP inválida'));
        }
      }
    });

    client.on('error', (err) => {
      if (!responded) {
        responded = true;
        clearTimeout(timeout);
        client.close();
        reject(err);
      }
    });

    client.send(msg, CONFIG.WIZ_PORT, ip, (err) => {
      if (err && !responded) {
        responded = true;
        clearTimeout(timeout);
        client.close();
        reject(err);
      }
    });
  });
}

// Discover WiZ devices on local network via broadcast
async function discoverDevices() {
  return new Promise((resolve) => {
    const client = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    const discovered = [];
    const message = JSON.stringify({
      method: 'registration',
      params: {
        phoneMac: 'AABBCCDDEEFF',
        register: false,
        phoneIp: '1.2.3.4',
        id: '1',
      },
    });

    client.on('message', (data, rinfo) => {
      try {
        const parsed = JSON.parse(data.toString());
        if (parsed.result && parsed.result.mac) {
          const device = {
            ip: rinfo.address,
            mac: parsed.result.mac,
            moduleName: parsed.result.moduleName || '',
            fwVersion: parsed.result.fwVersion || '',
            type: (parsed.result.moduleName || '').toLowerCase().includes('plug') ? 'plug' : 'light',
          };
          discovered.push(device);
          knownDevices.set(device.mac, { ...device, lastSeen: Date.now() });
          log(`  💡 Encontrado: ${device.moduleName || device.mac} @ ${device.ip}`);
        }
      } catch (e) { /* ignore */ }
    });

    client.bind(() => {
      client.setBroadcast(true);
      const buf = Buffer.from(message);
      // Send to common broadcast addresses
      const broadcasts = ['255.255.255.255', '192.168.1.255', '192.168.0.255', '192.168.4.255', '10.0.0.255', '172.16.0.255'];
      for (const addr of broadcasts) {
        client.send(buf, CONFIG.WIZ_PORT, addr, () => {});
      }
    });

    // Wait 3 seconds for responses
    setTimeout(() => {
      client.close();
      resolve(discovered);
    }, 3000);
  });
}

// Get device state
async function getDeviceState(ip) {
  try {
    const result = await sendUDP(ip, { method: 'getPilot' });
    return result.result || null;
  } catch (e) {
    return null;
  }
}

// ==================== COMMAND EXECUTION ====================

async function executeCommand(cmd) {
  const { action, params, device } = cmd;
  const ip = device?.ipAddress;

  if (!ip) {
    // Try to find IP by MAC in known devices
    const mac = device?.macAddress;
    if (mac && knownDevices.has(mac)) {
      const known = knownDevices.get(mac);
      return executeWithIP(known.ip, action, params);
    }
    return { success: false, error: 'No IP address for device' };
  }

  return executeWithIP(ip, action, params);
}

async function executeWithIP(ip, action, params) {
  try {
    let wizParams = {};

    switch (action) {
      case 'on':
        wizParams = { state: true };
        break;
      case 'off':
        wizParams = { state: false };
        break;
      case 'toggle': {
        // Get current state first
        const current = await getDeviceState(ip);
        wizParams = { state: !(current?.state) };
        break;
      }
      case 'brightness':
        wizParams = { state: true, dimming: Math.max(10, Math.min(100, params?.brightness || 100)) };
        break;
      case 'colorTemp':
        wizParams = { state: true, temp: Math.max(2200, Math.min(6500, params?.colorTemp || 4000)) };
        break;
      default:
        return { success: false, error: `Acción desconocida: ${action}` };
    }

    const result = await sendUDP(ip, { method: 'setPilot', params: wizParams });
    
    // Get updated state
    const newState = await getDeviceState(ip);
    
    return {
      success: result.result?.success !== false,
      result,
      deviceState: newState ? {
        on: newState.state,
        brightness: newState.dimming || 100,
        dimming: newState.dimming || 100,
        colorTemp: newState.temp || 4000,
        temp: newState.temp || 4000,
        sceneId: newState.sceneId,
        r: newState.r,
        g: newState.g,
        b: newState.b,
      } : null,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ==================== CLOUD COMMUNICATION ====================

async function pollCommands() {
  try {
    const res = await fetch(`${CONFIG.OCTOPUS_URL}/api/hogar/bridge?token=${CONFIG.BRIDGE_TOKEN}`);
    if (!res.ok) {
      if (res.status === 401) {
        log('❌ Token inválido. Genera uno nuevo desde OCTOPUS.', 'error');
        return;
      }
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    const { commands } = data;

    if (commands && commands.length > 0) {
      log(`📨 ${commands.length} comando(s) recibido(s)`);
      for (const cmd of commands) {
        log(`  ➡️ ${cmd.action} → ${cmd.device?.name || cmd.deviceId}`);
        const result = await executeCommand(cmd);
        commandsProcessed++;

        // Report result back to cloud
        await reportResult(cmd.id, result);

        if (result.success) {
          log(`  ✅ ${cmd.action} exitoso`, 'success');
        } else {
          log(`  ❌ ${cmd.action} fallido: ${result.error}`, 'error');
        }
      }
    }
  } catch (error) {
    log(`⚠️ Error polling: ${error.message}`, 'warn');
  }
}

async function reportResult(commandId, result) {
  try {
    await fetch(`${CONFIG.OCTOPUS_URL}/api/hogar/bridge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bridge-token': CONFIG.BRIDGE_TOKEN,
      },
      body: JSON.stringify({
        type: 'command_result',
        commandId,
        success: result.success,
        result: result.result || null,
        deviceState: result.deviceState || null,
      }),
    });
  } catch (e) {
    log(`⚠️ Error reportando resultado: ${e.message}`, 'warn');
  }
}

async function reportDiscovery(devices) {
  try {
    const discoveredDevices = [];
    for (const d of devices) {
      const state = await getDeviceState(d.ip);
      discoveredDevices.push({
        ip: d.ip,
        mac: d.mac,
        moduleName: d.moduleName,
        type: d.type,
        state: state ? {
          on: state.state,
          dimming: state.dimming || 100,
          temp: state.temp || 4000,
          sceneId: state.sceneId,
          r: state.r, g: state.g, b: state.b,
        } : null,
      });
    }

    await fetch(`${CONFIG.OCTOPUS_URL}/api/hogar/bridge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bridge-token': CONFIG.BRIDGE_TOKEN,
      },
      body: JSON.stringify({ type: 'discovery', discoveredDevices }),
    });
  } catch (e) {
    log(`⚠️ Error reportando discovery: ${e.message}`, 'warn');
  }
}

async function sendHeartbeat() {
  try {
    const res = await fetch(`${CONFIG.OCTOPUS_URL}/api/hogar/bridge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bridge-token': CONFIG.BRIDGE_TOKEN,
      },
      body: JSON.stringify({ type: 'heartbeat' }),
    });
    if (res.ok) {
      lastHeartbeat = new Date();
    }
  } catch (e) { /* silent */ }
}

// ==================== LOGGING ====================

function log(msg, level = 'info') {
  const time = new Date().toLocaleTimeString();
  const prefix = {
    info: '🐙',
    success: '✅',
    warn: '⚠️',
    error: '❌',
  }[level] || '🐙';
  console.log(`[${time}] ${prefix} ${msg}`);
}

function showBanner() {
  console.log('');
  console.log('  ╔═══════════════════════════════════════════╗');
  console.log('  ║   🐙 OCTOPUS Bridge — WiZ Controller   ║');
  console.log('  ╚═══════════════════════════════════════════╝');
  console.log(`  Server: ${CONFIG.OCTOPUS_URL}`);
  console.log(`  Token:  ${CONFIG.BRIDGE_TOKEN ? CONFIG.BRIDGE_TOKEN.slice(0, 15) + '...' : '❌ NO CONFIGURADO'}`);
  console.log(`  Poll:   cada ${CONFIG.POLL_INTERVAL / 1000}s`);
  console.log('');
}

// ==================== MAIN LOOP ====================

async function main() {
  showBanner();

  if (!CONFIG.BRIDGE_TOKEN) {
    console.log('  ❌ ERROR: Necesitas configurar BRIDGE_TOKEN');
    console.log('  ');
    console.log('  Opciones:');
    console.log('  1. Establece la variable de entorno:');
    console.log('     BRIDGE_TOKEN=oct_bridge_xxx node octopus-bridge.js');
    console.log('  ');
    console.log('  2. Edita este archivo y pon tu token en CONFIG.BRIDGE_TOKEN');
    console.log('  ');
    console.log('  Obtén tu token desde OCTOPUS → Hogar Inteligente → Configuración → Bridge');
    process.exit(1);
  }

  // Initial discovery
  log('Buscando dispositivos WiZ en tu red local...');
  const devices = await discoverDevices();
  log(`Encontrados ${devices.length} dispositivo(s) WiZ`);

  if (devices.length > 0) {
    log('Reportando dispositivos a OCTOPUS...');
    await reportDiscovery(devices);
  }

  // Send initial heartbeat
  await sendHeartbeat();
  log('✅ Bridge conectado y escuchando comandos...');
  log('   Presiona Ctrl+C para detener\n');

  // Main polling loop
  const pollTimer = setInterval(pollCommands, CONFIG.POLL_INTERVAL);
  const heartbeatTimer = setInterval(sendHeartbeat, CONFIG.HEARTBEAT_INTERVAL);
  const discoveryTimer = setInterval(async () => {
    log('Re-escaneando dispositivos...');
    const newDevices = await discoverDevices();
    if (newDevices.length > 0) {
      await reportDiscovery(newDevices);
    }
  }, CONFIG.DISCOVERY_INTERVAL);

  // Graceful shutdown
  process.on('SIGINT', () => {
    log('\nDeteniendo bridge...');
    isRunning = false;
    clearInterval(pollTimer);
    clearInterval(heartbeatTimer);
    clearInterval(discoveryTimer);
    log(`Comandos procesados: ${commandsProcessed}`);
    log('¡Hasta luego! 🐙');
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Error fatal:', err);
  process.exit(1);
});
