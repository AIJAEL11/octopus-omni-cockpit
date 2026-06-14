#!/usr/bin/env node
/**
 * 🐙 OCTOPUS Lights CLI — Control your smart home from the terminal
 * 
 * SETUP:
 *   1. Save this file anywhere on your computer
 *   2. Make sure Node.js is installed (v18+)
 *   3. Run: node octopus-lights.js setup
 *   4. Enter your HubSpace credentials when prompted
 * 
 * USAGE:
 *   node octopus-lights.js on          # Turn on all lights
 *   node octopus-lights.js off         # Turn off all lights  
 *   node octopus-lights.js status      # Check device status
 *   node octopus-lights.js on octopus  # Turn on specific device
 *   node octopus-lights.js toggle      # Toggle all devices
 *   node octopus-lights.js devices     # List all devices
 *   node octopus-lights.js setup       # Configure credentials
 * 
 * ALIASES (add to your shell profile):
 *   alias luzon="node /path/to/octopus-lights.js on"
 *   alias luzoff="node /path/to/octopus-lights.js off"
 *   alias luz="node /path/to/octopus-lights.js status"
 * 
 * Works with HubSpace (cloud) — no bridge or terminal window needed!
 * For WiZ lights, use the OCTOPUS Bridge (runs as background service).
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ─── Config ─────────────────────────────────────────────────────────
const CONFIG_PATH = path.join(require('os').homedir(), '.octopus-lights.json');
const AUTH_URL = 'https://accounts.hubspaceconnect.com/auth/realms/thd/protocol/openid-connect/token';
const API_BASE = 'https://api2.afero.net/v1';
const ATTR_POWER = 2;

// ─── Colors ─────────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m',
};

const OCTOPUS = `${c.magenta}🐙${c.reset}`;

// ─── Config Management ─────────────────────────────────────────────
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch (e) { /* ignore */ }
  return null;
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
}

async function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

async function setup() {
  console.log(`\n${OCTOPUS} ${c.bold}OCTOPUS Lights Setup${c.reset}\n`);
  console.log(`${c.dim}Enter your HubSpace (Home Depot) credentials.${c.reset}`);
  console.log(`${c.dim}These are stored locally at ${CONFIG_PATH}${c.reset}\n`);
  
  const email = await prompt(`${c.cyan}Email: ${c.reset}`);
  const password = await prompt(`${c.cyan}Password: ${c.reset}`);
  
  if (!email || !password) {
    console.log(`${c.red}✗ Email and password required${c.reset}`);
    process.exit(1);
  }
  
  process.stdout.write(`\n${c.dim}Testing connection...${c.reset}`);
  try {
    const token = await hubspaceLogin(email, password);
    const accountId = await getAccountId(token.access_token);
    const devices = await listDevices(token.access_token, accountId);
    
    saveConfig({ email, password, accountId });
    
    console.log(` ${c.green}✓ Connected!${c.reset}`);
    console.log(`${c.green}✓ Found ${devices.length} device(s)${c.reset}\n`);
    
    devices.forEach(d => {
      const status = d.isOn ? `${c.bgGreen}${c.white} ON ${c.reset}` : `${c.bgRed}${c.white} OFF ${c.reset}`;
      console.log(`  ${status} ${c.bold}${d.name}${c.reset} ${c.dim}(${d.id})${c.reset}`);
    });
    
    console.log(`\n${c.green}✓ Setup complete!${c.reset} Try: ${c.cyan}node octopus-lights.js status${c.reset}\n`);
  } catch (e) {
    console.log(` ${c.red}✗ Failed: ${e.message}${c.reset}`);
    process.exit(1);
  }
}

// ─── HubSpace API ──────────────────────────────────────────────────
let cachedToken = null;

async function hubspaceLogin(email, password) {
  if (cachedToken && (Date.now() - cachedToken.obtained_at) / 1000 < cachedToken.expires_in - 30) {
    return cachedToken;
  }
  
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: 'hubspace_android',
    username: email,
    password: password,
  });

  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Auth failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  cachedToken = {
    access_token: data.access_token,
    expires_in: data.expires_in || 120,
    obtained_at: Date.now(),
  };
  return cachedToken;
}

async function getAccountId(accessToken) {
  const res = await fetch(`${API_BASE}/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Failed to get user: ${res.status}`);
  const data = await res.json();
  const acc = data.accountAccess || [];
  if (acc.length > 0) return acc[0].account?.accountId || acc[0].accountId;
  throw new Error('No account found');
}

async function listDevices(accessToken, accountId) {
  const res = await fetch(`${API_BASE}/accounts/${accountId}/devices?expansions=state,attributes`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Failed to list devices: ${res.status}`);
  const devices = await res.json();
  
  return devices
    .filter(d => d.friendlyName && d.friendlyName.trim() !== '' && !d.virtual)
    .map(d => {
      const attrs = d.attributes || [];
      const powerAttr = attrs.find(a => a.id === ATTR_POWER);
      return {
        id: d.deviceId,
        name: d.friendlyName,
        isOn: powerAttr?.data === '01',
        online: d.deviceState?.available === true || d.deviceState?.direct === true,
      };
    });
}

async function controlDevice(accessToken, accountId, deviceId, turnOn) {
  const res = await fetch(`${API_BASE}/accounts/${accountId}/devices/${deviceId}/actions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'attribute_write',
      attrId: ATTR_POWER,
      data: turnOn ? '01' : '00',
    }),
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Control failed (${res.status}): ${text}`);
  }
  return res.json();
}

// ─── Commands ──────────────────────────────────────────────────────
async function getAuth() {
  const config = loadConfig();
  if (!config) {
    console.log(`${c.red}✗ Not configured. Run: node octopus-lights.js setup${c.reset}`);
    process.exit(1);
  }
  const token = await hubspaceLogin(config.email, config.password);
  const accountId = config.accountId || await getAccountId(token.access_token);
  return { token, accountId };
}

function matchDevice(devices, filter) {
  if (!filter) return devices;
  const lower = filter.toLowerCase();
  const matched = devices.filter(d => d.name.toLowerCase().includes(lower) || d.id.includes(lower));
  if (matched.length === 0) {
    console.log(`${c.red}✗ No device matching "${filter}"${c.reset}`);
    console.log(`${c.dim}Available: ${devices.map(d => d.name).join(', ')}${c.reset}`);
    process.exit(1);
  }
  return matched;
}

async function cmdStatus(filter) {
  const { token, accountId } = await getAuth();
  const devices = matchDevice(await listDevices(token.access_token, accountId), filter);
  
  console.log(`\n${OCTOPUS} ${c.bold}Device Status${c.reset}\n`);
  devices.forEach(d => {
    const power = d.isOn ? `${c.bgGreen}${c.white} ON  ${c.reset}` : `${c.bgRed}${c.white} OFF ${c.reset}`;
    const conn = d.online ? `${c.green}●${c.reset}` : `${c.red}○${c.reset}`;
    console.log(`  ${power} ${conn} ${c.bold}${d.name}${c.reset}`);
  });
  console.log();
}

async function cmdControl(action, filter) {
  const { token, accountId } = await getAuth();
  const devices = matchDevice(await listDevices(token.access_token, accountId), filter);
  const turnOn = action === 'on' ? true : action === 'off' ? false : null;
  
  console.log(`\n${OCTOPUS} ${c.bold}${action.toUpperCase()}${c.reset}\n`);
  
  for (const d of devices) {
    const targetOn = turnOn !== null ? turnOn : !d.isOn;
    const label = targetOn ? `${c.green}ON${c.reset}` : `${c.red}OFF${c.reset}`;
    
    try {
      await controlDevice(token.access_token, accountId, d.id, targetOn);
      console.log(`  ${c.green}✓${c.reset} ${c.bold}${d.name}${c.reset} → ${label}`);
    } catch (e) {
      console.log(`  ${c.red}✗${c.reset} ${c.bold}${d.name}${c.reset} — ${e.message}`);
    }
  }
  console.log();
}

async function cmdDevices() {
  const { token, accountId } = await getAuth();
  const devices = await listDevices(token.access_token, accountId);
  
  console.log(`\n${OCTOPUS} ${c.bold}All Devices (${devices.length})${c.reset}\n`);
  devices.forEach(d => {
    const power = d.isOn ? `${c.bgGreen}${c.white} ON  ${c.reset}` : `${c.bgRed}${c.white} OFF ${c.reset}`;
    const conn = d.online ? `${c.green}online${c.reset}` : `${c.red}offline${c.reset}`;
    console.log(`  ${power} ${c.bold}${d.name}${c.reset}`);
    console.log(`         ${c.dim}ID: ${d.id} | ${conn}${c.reset}`);
  });
  console.log();
}

// ─── Main ──────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const command = (args[0] || 'help').toLowerCase();
  const filter = args.slice(1).join(' ') || null;
  
  try {
    switch (command) {
      case 'on':
      case 'off':
      case 'toggle':
        await cmdControl(command, filter);
        break;
      case 'status':
      case 'estado':
        await cmdStatus(filter);
        break;
      case 'devices':
      case 'dispositivos':
        await cmdDevices();
        break;
      case 'setup':
      case 'config':
        await setup();
        break;
      default:
        console.log(`
${OCTOPUS} ${c.bold}OCTOPUS Lights CLI${c.reset}

  ${c.cyan}node octopus-lights.js${c.reset} ${c.bold}<command>${c.reset} ${c.dim}[device-name]${c.reset}

  ${c.bold}Commands:${c.reset}
    ${c.green}on${c.reset}        Turn on lights
    ${c.red}off${c.reset}       Turn off lights
    ${c.yellow}toggle${c.reset}    Toggle lights
    ${c.cyan}status${c.reset}    Check device status
    ${c.magenta}devices${c.reset}   List all devices
    ${c.white}setup${c.reset}     Configure credentials

  ${c.bold}Examples:${c.reset}
    ${c.dim}node octopus-lights.js on${c.reset}              # All devices
    ${c.dim}node octopus-lights.js off octopus${c.reset}     # Just "Octopus"
    ${c.dim}node octopus-lights.js status${c.reset}          # Check all

  ${c.bold}Shell aliases (add to your shell profile):${c.reset}
    ${c.dim}alias luzon="node ${process.argv[1]} on"${c.reset}
    ${c.dim}alias luzoff="node ${process.argv[1]} off"${c.reset}
    ${c.dim}alias luz="node ${process.argv[1]} status"${c.reset}
`);
    }
  } catch (e) {
    console.error(`\n${c.red}✗ Error: ${e.message}${c.reset}\n`);
    process.exit(1);
  }
}

main();
