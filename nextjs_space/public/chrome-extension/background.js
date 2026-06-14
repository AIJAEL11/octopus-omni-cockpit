// ═══════════════════════════════════════════════════════════
// OCTOPUS Social Bridge — Background Service Worker (Phase 2: SSE)
// ═══════════════════════════════════════════════════════════

const OCTOPUS_API_BASE = 'https://octopus-omni-cockpit-n8hd61.abacusai.app';
const PING_INTERVAL = 60000; // Reduced from 20s to 60s — SSE handles real-time now
const SSE_RECONNECT_DELAY = 5000;
const SUPPORTED_PLATFORMS = [
  { domain: 'twitter.com', alt: 'x.com', name: 'twitter', label: 'Twitter/X' },
  { domain: 'www.instagram.com', name: 'instagram', label: 'Instagram' },
  { domain: 'www.facebook.com', name: 'facebook', label: 'Facebook' },
  { domain: 'www.linkedin.com', name: 'linkedin', label: 'LinkedIn' },
  { domain: 'www.tiktok.com', name: 'tiktok', label: 'TikTok' },
  { domain: 'www.pinterest.com', name: 'pinterest', label: 'Pinterest' },
  { domain: 'www.threads.net', name: 'threads', label: 'Threads' },
  { domain: 'www.youtube.com', name: 'youtube', label: 'YouTube' }
];

let state = {
  token: null,
  isConnected: false,
  sseConnected: false,
  platforms: {},
  sseController: null, // AbortController for SSE fetch
  sseReconnectTimer: null
};

// ─── Storage helpers ───────────────────────────────────────────
async function getStorage(key) {
  return new Promise(r => chrome.storage.local.get(key, d => r(d[key])));
}
async function setStorage(obj) {
  return new Promise(r => chrome.storage.local.set(obj, r));
}

// ─── Session Detection ─────────────────────────────────────────
async function detectPlatformSessions() {
  const results = {};
  for (const p of SUPPORTED_PLATFORMS) {
    try {
      const cookies = await chrome.cookies.getAll({ domain: p.domain });
      const altCookies = p.alt ? await chrome.cookies.getAll({ domain: p.alt }) : [];
      const allCookies = [...cookies, ...altCookies];
      const hasSession = allCookies.some(c =>
        c.name.includes('sess') || c.name.includes('token') ||
        c.name.includes('auth') || c.name.includes('login') ||
        c.name.includes('sid') || c.name.includes('ct0') ||
        c.name.includes('ds_user_id') || c.name.includes('c_user') ||
        c.name.includes('li_at') || c.name.includes('sessionid')
      );
      results[p.name] = {
        detected: hasSession,
        cookieCount: allCookies.length,
        label: p.label
      };
    } catch (e) {
      results[p.name] = { detected: false, cookieCount: 0, label: p.label };
    }
  }
  state.platforms = results;
  await setStorage({ platforms: results });
  return results;
}

// ─── SSE Real-Time Connection ───────────────────────────────
async function connectSSE() {
  if (!state.token) return;
  disconnectSSE();

  console.log('[OCTOPUS] Connecting SSE stream...');
  const controller = new AbortController();
  state.sseController = controller;

  try {
    const res = await fetch(
      `${OCTOPUS_API_BASE}/api/social-bridge/events?source=extension&token=${encodeURIComponent(state.token)}`,
      { signal: controller.signal }
    );

    if (!res.ok || !res.body) {
      console.error('[OCTOPUS] SSE connection failed:', res.status);
      scheduleSSEReconnect();
      return;
    }

    state.sseConnected = true;
    state.isConnected = true;
    await setStorage({ isConnected: true, sseConnected: true });
    console.log('[OCTOPUS] SSE connected ✓');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event = JSON.parse(line.slice(6));
            await handleSSEEvent(event);
          } catch (e) {
            // Not valid JSON, skip
          }
        }
      }
    }
  } catch (e) {
    if (e.name === 'AbortError') {
      console.log('[OCTOPUS] SSE disconnected (aborted)');
      return;
    }
    console.error('[OCTOPUS] SSE error:', e.message);
  }

  // If we get here, connection dropped — reconnect
  state.sseConnected = false;
  await setStorage({ sseConnected: false });
  scheduleSSEReconnect();
}

function disconnectSSE() {
  if (state.sseController) {
    try { state.sseController.abort(); } catch {}
    state.sseController = null;
  }
  if (state.sseReconnectTimer) {
    clearTimeout(state.sseReconnectTimer);
    state.sseReconnectTimer = null;
  }
  state.sseConnected = false;
}

function scheduleSSEReconnect() {
  if (state.sseReconnectTimer) clearTimeout(state.sseReconnectTimer);
  state.sseReconnectTimer = setTimeout(() => {
    if (state.token) connectSSE();
  }, SSE_RECONNECT_DELAY);
}

async function handleSSEEvent(event) {
  console.log('[OCTOPUS] SSE event:', event.type);

  switch (event.type) {
    case 'connected':
      state.sseConnected = true;
      break;

    case 'publish_command':
      // Dashboard queued a post — execute it immediately!
      if (event.data) {
        const cmd = {
          type: 'publish',
          postId: event.data.postId,
          platform: event.data.platform,
          content: event.data.content,
          mediaUrl: event.data.mediaUrl,
          mediaType: event.data.mediaType,
          contentType: event.data.contentType || null
        };
        await executeCommand(cmd);
      }
      break;

    case 'heartbeat':
      // Keep-alive, no action
      break;

    default:
      console.log('[OCTOPUS] Unhandled SSE event:', event.type);
  }
}

// ─── Lightweight Ping (replaces heavy polling) ──────────
async function pingServer() {
  if (!state.token) return;
  try {
    const platforms = await detectPlatformSessions();
    const connectedList = Object.entries(platforms)
      .filter(([, v]) => v.detected)
      .map(([k]) => k);

    const res = await fetch(`${OCTOPUS_API_BASE}/api/social-bridge/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({
        type: 'status',
        platforms: connectedList,
        extensionVersion: chrome.runtime.getManifest().version,
        userAgent: navigator.userAgent
      })
    });
    const data = await res.json();
    state.isConnected = true;
    await setStorage({ isConnected: true });

    // Execute any pending commands from the server (fallback for missed SSE)
    if (data.commands && data.commands.length > 0) {
      for (const cmd of data.commands) {
        await executeCommand(cmd);
      }
    }

    // Check for scheduled posts that are due
    try {
      await fetch(`${OCTOPUS_API_BASE}/api/social-bridge/scheduler`, {
        headers: { 'Authorization': `Bearer ${state.token}` }
      });
    } catch (e) { /* scheduler check is optional */ }
  } catch (e) {
    console.error('[OCTOPUS] Ping error:', e.message);
    state.isConnected = false;
    await setStorage({ isConnected: false });
  }
}

// ─── Command Execution ───────────────────────────────────────
async function executeCommand(cmd) {
  console.log('[OCTOPUS] Executing command:', cmd.type, cmd.platform);
  try {
    if (cmd.type === 'publish') {
      const result = await publishToplatform(cmd);
      // Report result back
      await fetch(`${OCTOPUS_API_BASE}/api/social-bridge/publish/result`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.token}`
        },
        body: JSON.stringify({
          postId: cmd.postId,
          success: result.success,
          platformPostId: result.platformPostId || null,
          platformUrl: result.platformUrl || null,
          error: result.error || null
        })
      });
    }
  } catch (e) {
    console.error('[OCTOPUS] Command execution error:', e);
    await fetch(`${OCTOPUS_API_BASE}/api/social-bridge/publish/result`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({
        postId: cmd.postId,
        success: false,
        error: e.message
      })
    });
  }
}

// ─── Chrome Debugger: type text via browser-level input (bypasses isTrusted checks) ─
async function typeViaDebugger(tabId, text, clickX, clickY) {
  console.log('[OCTOPUS] typeViaDebugger: tab', tabId, 'text:', text.length, 'click:', clickX, clickY);
  try {
    // Attach debugger to the tab
    await chrome.debugger.attach({ tabId }, '1.3');
    console.log('[OCTOPUS] Debugger attached');
    await new Promise(r => setTimeout(r, 400));

    // Step 1: Trusted mouse click on the editor to place focus & cursor
    if (clickX && clickY) {
      console.log('[OCTOPUS] Sending trusted click at', clickX, clickY);
      // mousePressed
      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
        type: 'mousePressed', x: clickX, y: clickY, button: 'left', clickCount: 1
      });
      await new Promise(r => setTimeout(r, 50));
      // mouseReleased
      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
        type: 'mouseReleased', x: clickX, y: clickY, button: 'left', clickCount: 1
      });
      console.log('[OCTOPUS] Trusted click sent');
      await new Promise(r => setTimeout(r, 500));
    }

    // Step 2: Select all existing content (Ctrl+A) then delete it
    await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', {
      type: 'keyDown', modifiers: 2, windowsVirtualKeyCode: 65, code: 'KeyA', key: 'a'
    });
    await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', {
      type: 'keyUp', modifiers: 2, windowsVirtualKeyCode: 65, code: 'KeyA', key: 'a'
    });
    await new Promise(r => setTimeout(r, 100));
    await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', {
      type: 'keyDown', windowsVirtualKeyCode: 8, code: 'Backspace', key: 'Backspace'
    });
    await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', {
      type: 'keyUp', windowsVirtualKeyCode: 8, code: 'Backspace', key: 'Backspace'
    });
    await new Promise(r => setTimeout(r, 200));

    // Step 3: Type text character by character using trusted keyDown/keyUp events
    // (Input.insertText sometimes doesn't trigger Lexical's input handling)
    console.log('[OCTOPUS] Typing', text.length, 'chars via dispatchKeyEvent...');
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '\n') {
        // Enter key for new line
        await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', {
          type: 'keyDown', windowsVirtualKeyCode: 13, code: 'Enter', key: 'Enter'
        });
        await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', {
          type: 'keyUp', windowsVirtualKeyCode: 13, code: 'Enter', key: 'Enter'
        });
      } else {
        // Regular character — use insertText for each char (fastest trusted method)
        await chrome.debugger.sendCommand({ tabId }, 'Input.insertText', { text: char });
      }
      // Micro-delay every 50 chars to let the editor process
      if (i > 0 && i % 50 === 0) {
        await new Promise(r => setTimeout(r, 30));
      }
    }
    console.log('[OCTOPUS] All chars sent');

    await new Promise(r => setTimeout(r, 500));

    // Detach debugger (removes the warning bar)
    await chrome.debugger.detach({ tabId });
    console.log('[OCTOPUS] Debugger detached');

    return { success: true };
  } catch (e) {
    console.error('[OCTOPUS] typeViaDebugger error:', e.message);
    try { await chrome.debugger.detach({ tabId }); } catch {}
    return { success: false, error: e.message };
  }
}

// ─── Service Worker Keep-Alive (prevents Chrome from killing us during publish) ─
let keepAliveInterval = null;
function startKeepAlive() {
  stopKeepAlive();
  keepAliveInterval = setInterval(() => {
    // Accessing chrome.runtime keeps the service worker alive
    chrome.runtime.getPlatformInfo(() => {});
  }, 20000);
}
function stopKeepAlive() {
  if (keepAliveInterval) { clearInterval(keepAliveInterval); keepAliveInterval = null; }
}

// ─── Wait for tab to finish loading (event-based, not polling) ─
function waitForTabComplete(tabId, timeout = 12000) {
  return new Promise(resolve => {
    let resolved = false;
    const done = (tab) => { if (!resolved) { resolved = true; chrome.tabs.onUpdated.removeListener(listener); clearTimeout(timer); resolve(tab); } };
    const listener = (id, info, tab) => {
      if (id === tabId && info.status === 'complete') done(tab);
    };
    chrome.tabs.onUpdated.addListener(listener);
    const timer = setTimeout(async () => {
      chrome.tabs.onUpdated.removeListener(listener);
      if (!resolved) { resolved = true; try { resolve(await chrome.tabs.get(tabId)); } catch { resolve(null); } }
    }, timeout);
    // Check if already complete
    chrome.tabs.get(tabId).then(t => { if (t.status === 'complete') done(t); }).catch(() => done(null));
  });
}

// ─── Platform Publishing ─────────────────────────────────────
async function publishToplatform(cmd) {
  const { platform, content, mediaUrl, mediaType } = cmd;
  
  const platformConfig = SUPPORTED_PLATFORMS.find(p => p.name === platform);
  if (!platformConfig) return { success: false, error: 'Platform not supported' };

  // Keep service worker alive during the entire publish operation
  startKeepAlive();
  try {
    return await doPublish(cmd, platformConfig);
  } finally {
    stopKeepAlive();
  }
}

async function doPublish(cmd, platformConfig) {
  const { platform, content, mediaUrl, mediaType } = cmd;

  let tabs = await chrome.tabs.query({ url: `https://${platformConfig.domain}/*` });
  if (platformConfig.alt) {
    const altTabs = await chrome.tabs.query({ url: `https://${platformConfig.alt}/*` });
    tabs = [...tabs, ...altTabs];
  }

  let targetTab;
  let navigated = false;

  if (tabs.length > 0) {
    targetTab = tabs[0];
    await chrome.tabs.update(targetTab.id, { active: true });

    // CRITICAL: For LinkedIn, ensure we're on /feed/ before injecting
    const needsFeedNav = platform === 'linkedin' &&
      !targetTab.url.includes('/feed') &&
      targetTab.url !== 'https://www.linkedin.com/' &&
      targetTab.url !== 'https://www.linkedin.com';
    if (needsFeedNav) {
      console.log('[OCTOPUS] Tab not on /feed/, navigating...', targetTab.url);
      await chrome.tabs.update(targetTab.id, { url: 'https://www.linkedin.com/feed/' });
      targetTab = await waitForTabComplete(targetTab.id, 15000);
      navigated = true;
    }
  } else {
    targetTab = await chrome.tabs.create({ url: `https://${platformConfig.domain}/feed/`, active: true });
    targetTab = await waitForTabComplete(targetTab.id, 15000);
    navigated = true;
  }

  if (!targetTab) return { success: false, error: 'No se pudo cargar la pestaña de ' + platformConfig.label };

  // After navigation, content scripts auto-inject from manifest — brief init time
  if (navigated) {
    await new Promise(r => setTimeout(r, 2000));
  } else {
    await new Promise(r => setTimeout(r, 300));
  }

  const publishMsg = {
    action: 'publish',
    content,
    mediaUrl,
    mediaType,
    contentType: cmd.contentType || null,
    // Pass server info so content script can report results directly
    serverUrl: OCTOPUS_API_BASE,
    postId: cmd.postId || null,
    token: state.token
  };

  // Attempt 1: Send message to auto-injected content script
  try {
    console.log('[OCTOPUS] Sending publish message to tab', targetTab.id);
    const response = await chrome.tabs.sendMessage(targetTab.id, publishMsg);
    return response || { success: false, error: 'No response from content script' };
  } catch (e) {
    console.log('[OCTOPUS] Content script not responding, injecting manually...', e.message);
  }

  // Attempt 2: Manual injection
  try {
    await chrome.scripting.executeScript({
      target: { tabId: targetTab.id },
      files: ['content-scripts/utils.js', `content-scripts/${platform}.js`]
    });
    await new Promise(r => setTimeout(r, 2000));
    console.log('[OCTOPUS] Retrying publish after manual injection...');
    const response = await chrome.tabs.sendMessage(targetTab.id, publishMsg);
    return response || { success: false, error: 'No response after injection' };
  } catch (e2) {
    return { success: false, error: `Injection failed: ${e2.message}` };
  }
}

// ─── Training Mode (Record & Learn) ─────────────────────────
let recordingState = { active: false, platform: null, actionType: null, steps: [] };

function startRecording(platform, actionType) {
  recordingState = { active: true, platform, actionType, steps: [] };
  const platformConfig = SUPPORTED_PLATFORMS.find(p => p.name === platform);
  if (platformConfig) {
    chrome.tabs.query({ url: `https://${platformConfig.domain}/*` }, tabs => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { action: 'startRecording', actionType });
      });
    });
  }
}

function stopRecording() {
  const result = { ...recordingState };
  recordingState = { active: false, platform: null, actionType: null, steps: [] };
  return result;
}

// ─── Message Handling ────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Handle typeText request from content script (uses debugger for trusted input)
  if (msg.action === 'typeText') {
    typeViaDebugger(sender.tab.id, msg.text, msg.clickX, msg.clickY).then(sendResponse);
    return true;
  }

  if (msg.action === 'getState') {
    sendResponse({
      isConnected: state.isConnected,
      sseConnected: state.sseConnected,
      platforms: state.platforms,
      token: !!state.token,
      recording: recordingState.active
    });
    return true;
  }

  if (msg.action === 'login') {
    state.token = msg.token;
    setStorage({ token: msg.token }).then(async () => {
      await pingServer(); // Initial ping to report status
      connectSSE();       // Then open SSE stream
      sendResponse({ success: true });
    });
    return true;
  }

  if (msg.action === 'logout') {
    state.token = null;
    state.isConnected = false;
    disconnectSSE();
    chrome.alarms.clear(ALARM_NAME);
    setStorage({ token: null, isConnected: false, sseConnected: false }).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (msg.action === 'detectPlatforms') {
    detectPlatformSessions().then(r => sendResponse(r));
    return true;
  }

  if (msg.action === 'recordStep') {
    if (recordingState.active) {
      recordingState.steps.push(msg.step);
      sendResponse({ recorded: true, totalSteps: recordingState.steps.length });
    }
    return true;
  }

  if (msg.action === 'startTraining') {
    startRecording(msg.platform, msg.actionType);
    sendResponse({ started: true });
    return true;
  }

  if (msg.action === 'stopTraining') {
    const result = stopRecording();
    if (state.token && result.steps.length > 0) {
      fetch(`${OCTOPUS_API_BASE}/api/social-bridge/training`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.token}`
        },
        body: JSON.stringify({
          platform: result.platform,
          actionType: result.actionType,
          steps: result.steps
        })
      }).then(() => sendResponse({ saved: true, steps: result.steps.length }));
    } else {
      sendResponse({ saved: false, steps: result.steps.length });
    }
    return true;
  }
});

// ─── chrome.alarms: survives service worker termination ──────
const ALARM_NAME = 'octopus-ping';

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  try {
    // Service worker just woke up — restore state from storage if needed
    if (!state.token) {
      const stored = await getStorage('token');
      if (stored) state.token = stored;
    }
    if (!state.token) return;

    await pingServer();

    // Reconnect SSE if it dropped (very common in MV3 — SW dies and SSE is lost)
    if (!state.sseConnected && !state.sseController) {
      console.log('[OCTOPUS] SSE not connected, reconnecting from alarm...');
      connectSSE();
    }
  } catch (e) {
    console.error('[OCTOPUS] Alarm handler error:', e);
  }
});

// ─── Keep-alive when popup or devtools is open ──────────────
// A long-lived port connection prevents Chrome from killing the SW
chrome.runtime.onConnect.addListener((port) => {
  console.log('[OCTOPUS] Port connected:', port.name);
  port.onDisconnect.addListener(() => {
    console.log('[OCTOPUS] Port disconnected:', port.name);
  });
});

// ─── Initialization ──────────────────────────────────────────
async function init() {
  try {
    const stored = await getStorage('token');
    if (stored) {
      state.token = stored;
      await pingServer();  // Initial status report
      connectSSE();        // Open SSE stream for real-time commands
    }

    // Use chrome.alarms instead of setInterval — survives SW termination
    await chrome.alarms.clear(ALARM_NAME);
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
  } catch (e) {
    console.error('[OCTOPUS] Init error:', e);
  }
}

// Re-init on install/update
chrome.runtime.onInstalled.addListener(() => init());
chrome.runtime.onStartup.addListener(() => init());

init();
