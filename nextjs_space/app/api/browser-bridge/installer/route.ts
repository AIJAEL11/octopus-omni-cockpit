import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// GET — Generate and download the browser bridge script
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const locale = req.nextUrl.searchParams.get('locale') || 'es'
    const serverUrl = process.env.NEXTAUTH_URL || 'https://octopuskills.com'

    // Get or create bridge token
    let apiKey = await prisma.apiKey.findUnique({
      where: { userId_serviceType: { userId: session.user.id, serviceType: 'browser_bridge' } },
    })

    if (!apiKey) {
      const token = `obr_${crypto.randomBytes(32).toString('hex')}`
      apiKey = await prisma.apiKey.create({
        data: {
          userId: session.user.id,
          serviceType: 'browser_bridge',
          name: 'Browser Bridge Token',
          apiKey: token,
          status: 'active',
        },
      })
    }

    const script = generateBridgeScript(apiKey.apiKey, serverUrl, locale === 'es')

    return new NextResponse(script, {
      headers: {
        'Content-Type': 'application/javascript',
        'Content-Disposition': 'attachment; filename="octopus-browser-bridge.js"',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error) {
    console.error('Browser bridge installer error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

function generateBridgeScript(token: string, serverUrl: string, isEs: boolean): string {
  return `#!/usr/bin/env node
/**
 * 🐙 OCTOPUS Browser Bridge v3.1 — Stealth Edition
 * ${isEs ? 'Controla un navegador real desde OCTOPUS Omni Cockpit' : 'Control a real browser from OCTOPUS Omni Cockpit'}
 * ${isEs ? 'Soporta: Multi-tab, Recorder, Sesión persistente, Anti-detección' : 'Supports: Multi-tab, Recorder, Persistent session, Anti-detection'}
 *
 * ${isEs ? 'REQUISITO' : 'REQUIREMENT'}: Node.js 18+
 * ${isEs ? 'Puppeteer + Stealth se instalan automáticamente' : 'Puppeteer + Stealth are installed automatically'}
 *
 * ${isEs ? 'USO' : 'USAGE'}: node octopus-browser-bridge.js
 */

const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const CONFIG = {
  OCTOPUS_URL: '${serverUrl}',
  BRIDGE_TOKEN: '${token}',
  POLL_INTERVAL: 2000,
  HEADLESS: false,
  VIEWPORT: { width: 1280, height: 800 },
  USER_DATA_DIR: path.join(os.homedir(), '.octopus-browser-data'),
};

let browser = null;
let tabs = {}; // tabId -> page
let activeTabId = 'main';
let running = true;
let recording = false;
let recordedSteps = [];
let recordSessionId = null;

function getPage(tabId) {
  return tabs[tabId || activeTabId] || tabs['main'];
}

function ensureDeps() {
  const deps = [
    ['puppeteer-extra', 'puppeteer-extra'],
    ['puppeteer-extra-plugin-stealth', 'puppeteer-extra-plugin-stealth'],
    ['puppeteer', 'puppeteer'],
  ];
  let needInstall = [];
  for (const [pkg] of deps) {
    try { require.resolve(pkg); } catch { needInstall.push(pkg); }
  }
  if (needInstall.length === 0) return;
  console.log('\n🐙 ${isEs ? 'Instalando dependencias automáticamente...' : 'Installing dependencies automatically...'}');
  console.log('   📦 ' + needInstall.join(', '));
  console.log('${isEs ? '   ⏳ Esto puede tardar 1-2 minutos (primera vez)' : '   ⏳ This may take 1-2 minutes (first time)'}\n');
  try {
    execSync('npm install ' + needInstall.join(' '), { stdio: 'inherit', cwd: __dirname });
    console.log('\n${isEs ? '   ✅ Dependencias instaladas!' : '   ✅ Dependencies installed!'}\n');
  } catch (installErr) {
    console.error('\n${isEs ? '❌ Error instalando dependencias.' : '❌ Error installing dependencies.'}');
    console.error('${isEs ? '   Intenta: npm install puppeteer puppeteer-extra puppeteer-extra-plugin-stealth' : '   Try: npm install puppeteer puppeteer-extra puppeteer-extra-plugin-stealth'}');
    process.exit(1);
  }
}

async function init() {
  ensureDeps();
  const puppeteer = require('puppeteer-extra');
  const StealthPlugin = require('puppeteer-extra-plugin-stealth');
  puppeteer.use(StealthPlugin());
  console.log('\\n🐙 OCTOPUS Browser Bridge v3.1 — Stealth Edition');
  console.log('${isEs ? '   🛡️ Anti-detección activada (evita CAPTCHAs de Google, etc.)' : '   🛡️ Anti-detection active (bypasses Google CAPTCHAs, etc.)'}');
  console.log('${isEs ? '   Iniciando navegador con sesión persistente...' : '   Starting browser with persistent session...'}');
  console.log('${isEs ? '   📁 Datos en:' : '   📁 Data at:'} ' + CONFIG.USER_DATA_DIR);

  browser = await puppeteer.launch({
    headless: CONFIG.HEADLESS,
    defaultViewport: CONFIG.VIEWPORT,
    userDataDir: CONFIG.USER_DATA_DIR,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--start-maximized',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  const mainPage = (await browser.pages())[0] || await browser.newPage();
  await mainPage.setViewport(CONFIG.VIEWPORT);
  // Extra stealth: override navigator.webdriver
  await mainPage.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });
  tabs['main'] = mainPage;

  console.log('${isEs ? '   ✅ Navegador listo (multi-tab + recorder + stealth)' : '   ✅ Browser ready (multi-tab + recorder + stealth)'}');
  console.log('${isEs ? '   🔗 Conectado a:' : '   🔗 Connected to:'} ' + CONFIG.OCTOPUS_URL);
  console.log('${isEs ? '   ⏳ Esperando comandos...' : '   ⏳ Waiting for commands...'}\\n');

  await sendHeartbeat();

  while (running) {
    try {
      await pollAndExecute();
    } catch (err) {
      console.error('${isEs ? 'Error en polling:' : 'Polling error:'}', err.message);
    }
    await sleep(CONFIG.POLL_INTERVAL);
  }
}

async function pollAndExecute() {
  const res = await fetch(CONFIG.OCTOPUS_URL + '/api/browser-bridge?token=' + CONFIG.BRIDGE_TOKEN);
  if (!res.ok) return;
  const data = await res.json();

  if (!data.commands || data.commands.length === 0) return;

  for (const cmd of data.commands) {
    console.log('🎯 ' + (cmd.tabId ? '[' + cmd.tabId + '] ' : '') + cmd.type + ': ' + JSON.stringify(cmd.params || {}));
    const startTime = Date.now();
    try {
      const result = await executeCommand(cmd);
      const duration = Date.now() - startTime;
      console.log('   ✅ ${isEs ? 'Completado' : 'Completed'} (' + duration + 'ms)');
      await reportResult(cmd.id, true, result, duration);
    } catch (err) {
      const duration = Date.now() - startTime;
      console.error('   ❌ ${isEs ? 'Error' : 'Error'}:', err.message);
      await reportResult(cmd.id, false, null, duration, err.message);
    }
  }
}

async function executeCommand(cmd) {
  const { type, params } = cmd;
  const tabId = cmd.tabId || activeTabId;
  let page = getPage(tabId);
  let result = {};

  switch (type) {
    // ── Multi-tab commands ──
    case 'new_tab': {
      const newId = params.tabId || ('tab_' + Date.now());
      const newPage = await browser.newPage();
      await newPage.setViewport(CONFIG.VIEWPORT);
      if (params.url) {
        await newPage.goto(params.url, { waitUntil: 'networkidle2', timeout: 30000 });
      }
      tabs[newId] = newPage;
      activeTabId = newId;
      if (recording) setupRecorderOnPage(newPage, newId);
      result = { tabId: newId, url: newPage.url(), title: await newPage.title(), tabCount: Object.keys(tabs).length };
      console.log('   📑 ${isEs ? 'Nueva pestaña:' : 'New tab:'} ' + newId);
      break;
    }

    case 'switch_tab': {
      const targetId = params.tabId;
      if (!tabs[targetId]) throw new Error('Tab not found: ' + targetId);
      activeTabId = targetId;
      page = tabs[targetId];
      await page.bringToFront();
      result = { tabId: targetId, url: page.url(), title: await page.title() };
      break;
    }

    case 'close_tab': {
      const closeId = params.tabId || tabId;
      if (closeId === 'main') throw new Error('Cannot close main tab');
      if (tabs[closeId]) {
        await tabs[closeId].close();
        delete tabs[closeId];
        if (activeTabId === closeId) activeTabId = 'main';
      }
      result = { closed: closeId, tabCount: Object.keys(tabs).length };
      break;
    }

    case 'list_tabs': {
      const tabList = [];
      for (const [id, p] of Object.entries(tabs)) {
        try {
          tabList.push({ id, url: p.url(), title: await p.title(), active: id === activeTabId });
        } catch (e) {
          tabList.push({ id, url: 'unknown', title: 'unknown', active: id === activeTabId });
        }
      }
      result = { tabs: tabList, activeTabId };
      break;
    }

    // ── Recorder commands ──
    case 'start_recording': {
      recording = true;
      recordedSteps = [];
      recordSessionId = params.sessionId || cmd.sessionId;
      // Inject recorder on all existing pages
      for (const [id, p] of Object.entries(tabs)) {
        await setupRecorderOnPage(p, id);
      }
      result = { recording: true };
      console.log('   🔴 ${isEs ? 'Grabación iniciada' : 'Recording started'}');
      break;
    }

    case 'stop_recording': {
      recording = false;
      const steps = [...recordedSteps];
      recordedSteps = [];
      // Send recorded steps to server
      await reportRecording(recordSessionId || cmd.sessionId, steps);
      result = { recording: false, steps: steps.length };
      console.log('   ⏹️ ${isEs ? 'Grabación detenida:' : 'Recording stopped:'} ' + steps.length + ' ${isEs ? 'pasos' : 'steps'}');
      break;
    }

    // ── Standard commands (now tab-aware) ──
    case 'goto': {
      await page.goto(params.url, { waitUntil: 'networkidle2', timeout: 30000 });
      result = { url: page.url(), title: await page.title() };
      const screenshot = await page.screenshot({ encoding: 'base64', type: 'jpeg', quality: 70 });
      await reportScreenshot(cmd.sessionId, 'data:image/jpeg;base64,' + screenshot, page.url());
      break;
    }

    case 'click': {
      // Detect :contains() pseudo-selector and convert to text search
      const containsMatch = params.selector?.match(/^(.*)\:contains\(['"]?(.+?)['"]?\)$/);
      if (containsMatch || params.method === 'text') {
        const searchText = containsMatch ? containsMatch[2] : params.selector;
        const tagFilter = containsMatch ? containsMatch[1] : null;
        console.log('[Browser] Click by text: "' + searchText + '"' + (tagFilter ? ' (tag: ' + tagFilter + ')' : ''));
        const allEls = await page.$$(tagFilter || 'a, button, [role="button"], input[type="submit"], [onclick], span, div, li, td, th, h1, h2, h3, h4, h5, h6, p, label');
        let clicked = false;
        for (const el of allEls) {
          const text = await el.evaluate(e => e.textContent?.trim() || e.getAttribute('aria-label') || '');
          if (text.toLowerCase().includes(searchText.toLowerCase())) {
            await el.click();
            clicked = true;
            break;
          }
        }
        if (!clicked) {
          // Try broader search with XPath
          const xpEls = await page.$x('//*[contains(translate(text(),"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"' + searchText.toLowerCase() + '")]');
          if (xpEls.length > 0) { await (xpEls[0] as any).click(); clicked = true; }
        }
        if (!clicked) console.warn('[Browser] Click by text failed: no element with text "' + searchText + '"');
      } else if (params.x !== undefined && params.y !== undefined) {
        await page.mouse.click(params.x, params.y);
      } else {
        // Safety: if CSS selector fails, try text fallback
        try {
          await page.click(params.selector);
        } catch (clickErr) {
          console.warn('[Browser] CSS click failed for "' + params.selector + '", trying text fallback: ' + clickErr.message);
          const fallbackEls = await page.$$('a, button, [role="button"], span, div, li, p, h1, h2, h3, h4, h5, h6, label');
          let fallbackClicked = false;
          for (const fbEl of fallbackEls) {
            const fbText = await fbEl.evaluate(e => (e.textContent || '').trim());
            if (fbText.toLowerCase().includes(params.selector.toLowerCase())) { await fbEl.click(); fallbackClicked = true; break; }
          }
          if (!fallbackClicked) throw clickErr;
        }
      }
      await page.waitForNetworkIdle({ timeout: 5000 }).catch(() => {});
      result = { url: page.url(), title: await page.title() };
      break;
    }

    case 'type': {
      if (params.selector) {
        await page.click(params.selector).catch(() => {});
      }
      await page.keyboard.type(params.text, { delay: 50 });
      result = { typed: params.text };
      break;
    }

    case 'screenshot': {
      const screenshot = await page.screenshot({ encoding: 'base64', type: 'jpeg', quality: 80, fullPage: !!params.fullPage });
      const screenshotUrl = 'data:image/jpeg;base64,' + screenshot;
      await reportScreenshot(cmd.sessionId, screenshotUrl, page.url());
      result = { url: page.url(), title: await page.title(), screenshotUrl };
      break;
    }

    case 'scroll': {
      const amount = params.amount || 500;
      const direction = params.direction === 'up' ? -amount : amount;
      await page.evaluate((d) => window.scrollBy(0, d), direction);
      result = { scrolled: direction };
      break;
    }

    case 'wait': {
      await sleep(params.ms || 1000);
      result = { waited: params.ms || 1000 };
      break;
    }

    case 'extract': {
      const data = await page.evaluate((sel) => {
        if (sel) {
          const el = document.querySelector(sel);
          return el ? el.textContent?.trim() : null;
        }
        return document.body.innerText.substring(0, 5000);
      }, params.selector || null);
      result = { extracted: data };
      break;
    }

    case 'evaluate': {
      const evalResult = await page.evaluate(params.script);
      result = { result: evalResult };
      break;
    }

    case 'keypress': {
      const key = params.key || 'Enter';
      await page.keyboard.press(key);
      result = { pressed: key };
      break;
    }

    default:
      throw new Error('Unknown command: ' + type);
  }

  return result;
}

// ── Recorder: inject event listeners into page ──
async function setupRecorderOnPage(page, tabId) {
  try {
    await page.evaluateOnNewDocument(function(tid) {
      if (window.__octopusRecorder) return;
      window.__octopusRecorder = true;

      function getSelector(el) {
        if (el.id) return '#' + el.id;
        if (el.name) return el.tagName.toLowerCase() + '[name="' + el.name + '"]';
        if (el.className && typeof el.className === 'string') {
          const cls = '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.');
          if (cls.length > 1) return el.tagName.toLowerCase() + cls;
        }
        return el.tagName.toLowerCase();
      }

      // Track clicks
      document.addEventListener('click', function(e) {
        const sel = getSelector(e.target);
        const text = (e.target.textContent || '').trim().substring(0, 50);
        window.__octopusRecordedEvent = {
          type: 'click',
          selector: sel,
          text: text,
          url: location.href,
          tabId: tid,
          ts: Date.now()
        };
      }, true);

      // Track typing (debounced)
      let typeBuffer = '';
      let typeTarget = null;
      let typeTimer = null;
      document.addEventListener('input', function(e) {
        if (!e.target || !e.target.value) return;
        typeBuffer = e.target.value;
        typeTarget = getSelector(e.target);
        clearTimeout(typeTimer);
        typeTimer = setTimeout(function() {
          if (typeBuffer) {
            window.__octopusRecordedEvent = {
              type: 'type',
              selector: typeTarget,
              text: typeBuffer,
              url: location.href,
              tabId: tid,
              ts: Date.now()
            };
            typeBuffer = '';
          }
        }, 800);
      }, true);

      // Track navigation
      let lastUrl = location.href;
      new MutationObserver(function() {
        if (location.href !== lastUrl) {
          window.__octopusRecordedEvent = {
            type: 'goto',
            url: location.href,
            tabId: tid,
            ts: Date.now()
          };
          lastUrl = location.href;
        }
      }).observe(document.body, { childList: true, subtree: true });
    }, tabId);

    // Also inject on current page context
    await page.evaluate(function(tid) {
      if (window.__octopusRecorder) return;
      window.__octopusRecorder = true;

      function getSelector(el) {
        if (el.id) return '#' + el.id;
        if (el.name) return el.tagName.toLowerCase() + '[name="' + el.name + '"]';
        if (el.className && typeof el.className === 'string') {
          const cls = '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.');
          if (cls.length > 1) return el.tagName.toLowerCase() + cls;
        }
        return el.tagName.toLowerCase();
      }

      document.addEventListener('click', function(e) {
        const sel = getSelector(e.target);
        const text = (e.target.textContent || '').trim().substring(0, 50);
        window.__octopusRecordedEvent = { type: 'click', selector: sel, text: text, url: location.href, tabId: tid, ts: Date.now() };
      }, true);

      let typeBuffer = '';
      let typeTarget = null;
      let typeTimer = null;
      document.addEventListener('input', function(e) {
        if (!e.target || !e.target.value) return;
        typeBuffer = e.target.value;
        typeTarget = getSelector(e.target);
        clearTimeout(typeTimer);
        typeTimer = setTimeout(function() {
          if (typeBuffer) {
            window.__octopusRecordedEvent = { type: 'type', selector: typeTarget, text: typeBuffer, url: location.href, tabId: tid, ts: Date.now() };
            typeBuffer = '';
          }
        }, 800);
      }, true);
    }, tabId);

    // Poll for recorded events
    if (!page.__recorderInterval) {
      page.__recorderInterval = setInterval(async () => {
        if (!recording) {
          clearInterval(page.__recorderInterval);
          page.__recorderInterval = null;
          return;
        }
        try {
          const evt = await page.evaluate(() => {
            const e = window.__octopusRecordedEvent;
            window.__octopusRecordedEvent = null;
            return e;
          });
          if (evt) {
            recordedSteps.push(evt);
            console.log('   🔴 ' + evt.type + ': ' + (evt.selector || evt.url || ''));
          }
        } catch (e) {}
      }, 500);
    }
  } catch (e) {
    console.error('Recorder setup error:', e.message);
  }
}

async function reportResult(commandId, success, result, duration, error) {
  try {
    await fetch(CONFIG.OCTOPUS_URL + '/api/browser-bridge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-bridge-token': CONFIG.BRIDGE_TOKEN },
      body: JSON.stringify({ type: 'command_result', commandId, success, result, duration, error: error || null }),
    });
  } catch (e) { console.error('Report error:', e.message); }
}

async function reportScreenshot(sessionId, screenshotUrl, currentUrl) {
  try {
    await fetch(CONFIG.OCTOPUS_URL + '/api/browser-bridge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-bridge-token': CONFIG.BRIDGE_TOKEN },
      body: JSON.stringify({ type: 'screenshot', sessionId, screenshotUrl, currentUrl }),
    });
  } catch (e) {}
}

async function reportRecording(sessionId, steps) {
  try {
    await fetch(CONFIG.OCTOPUS_URL + '/api/browser-bridge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-bridge-token': CONFIG.BRIDGE_TOKEN },
      body: JSON.stringify({ type: 'recording', sessionId, steps }),
    });
  } catch (e) { console.error('Recording report error:', e.message); }
}

async function sendHeartbeat() {
  try {
    const tabList = [];
    for (const [id, p] of Object.entries(tabs)) {
      try { tabList.push({ id, url: p.url() }); } catch(e) {}
    }
    await fetch(CONFIG.OCTOPUS_URL + '/api/browser-bridge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-bridge-token': CONFIG.BRIDGE_TOKEN },
      body: JSON.stringify({ type: 'heartbeat', tabs: tabList, recording, activeTabId }),
    });
  } catch (e) {}
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

process.on('SIGINT', async () => {
  console.log('\\n🐙 ${isEs ? 'Cerrando Bridge...' : 'Closing Bridge...'}');
  running = false;
  if (browser) await browser.close();
  process.exit(0);
});

init().catch(err => {
  console.error('${isEs ? 'Error fatal' : 'Fatal error'}:', err.message);
  process.exit(1);
});
`
}
