// ═══════════════════════════════════════════════════
// OCTOPUS Social Bridge — Shared Utilities
// ═══════════════════════════════════════════════════

window.__OCTOPUS_UTILS = (function() {
  'use strict';

  // ─── Sleep with human-like jitter ─────────────────
  function sleep(ms, jitter = 300) {
    const actual = ms + Math.random() * jitter;
    return new Promise(r => setTimeout(r, actual));
  }

  // ─── Wait for element with MutationObserver ───────
  function waitForElement(selector, timeout = 8000) {
    return new Promise((resolve) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      const observer = new MutationObserver(() => {
        const found = document.querySelector(selector);
        if (found) { observer.disconnect(); resolve(found); }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); resolve(null); }, timeout);
    });
  }

  // ─── Wait for element matching a predicate ────────
  function waitForElementByPredicate(predicate, timeout = 8000) {
    return new Promise((resolve) => {
      const el = predicate();
      if (el) return resolve(el);
      const observer = new MutationObserver(() => {
        const found = predicate();
        if (found) { observer.disconnect(); resolve(found); }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); resolve(null); }, timeout);
    });
  }

  // ─── Smart selector builder ───────────────────────
  function getSelector(el) {
    if (!el || !el.tagName) return 'unknown';
    if (el.id) return `#${el.id}`;
    if (el.getAttribute('data-testid')) return `[data-testid="${el.getAttribute('data-testid')}"]`;
    if (el.getAttribute('data-e2e')) return `[data-e2e="${el.getAttribute('data-e2e')}"]`;
    if (el.getAttribute('aria-label')) return `[aria-label="${el.getAttribute('aria-label')}"]`;
    if (el.className && typeof el.className === 'string') {
      const cls = el.className.split(' ').filter(c => c && !c.startsWith('css-') && !c.startsWith('_'))[0];
      if (cls) return `${el.tagName.toLowerCase()}.${cls}`;
    }
    return el.tagName.toLowerCase();
  }

  // ─── Record a step to background ──────────────────
  function recordStep(step) {
    try {
      chrome.runtime.sendMessage({ action: 'recordStep', step });
    } catch (e) { /* extension context invalidated */ }
  }

  // ─── Retry wrapper with exponential backoff ───────
  async function withRetry(fn, { maxRetries = 2, baseDelay = 1500, label = 'action' } = {}) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await fn(attempt);
        if (result && result.success === false && attempt < maxRetries) {
          console.warn(`[OCTOPUS] ${label} attempt ${attempt + 1} failed: ${result.error}`);
          lastError = result;
          await sleep(baseDelay * Math.pow(2, attempt), 500);
          continue;
        }
        return result;
      } catch (e) {
        console.warn(`[OCTOPUS] ${label} attempt ${attempt + 1} threw:`, e.message);
        lastError = { success: false, error: e.message };
        if (attempt < maxRetries) await sleep(baseDelay * Math.pow(2, attempt), 500);
      }
    }
    return lastError || { success: false, error: `${label} falló tras ${maxRetries + 1} intentos` };
  }

  // ─── Type text into contenteditable / input ───────
  async function typeText(element, text, { humanLike = true } = {}) {
    element.focus();
    await sleep(200, 100);
    if (element.getAttribute('contenteditable') !== null) {
      document.execCommand('insertText', false, text);
    } else {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set ||
                                     Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(element, text);
        element.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        element.value = text;
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    await sleep(300, 200);
  }

  // ─── Upload media file from URL ───────────────────
  async function uploadMedia(mediaUrl, fileInput, { fileName = 'octopus-media', defaultType = 'image/jpeg', waitAfter = 2500 } = {}) {
    if (!mediaUrl || !fileInput) return false;
    try {
      const blob = await fetch(mediaUrl).then(r => r.blob());
      const ext = defaultType.includes('video') ? '.mp4' : defaultType.includes('png') ? '.png' : '.jpg';
      const file = new File([blob], fileName + ext, { type: blob.type || defaultType });
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(waitAfter, 500);
      return true;
    } catch (e) {
      console.warn('[OCTOPUS] Media upload failed:', e.message);
      return false;
    }
  }

  // ─── Click a button safely ────────────────────────
  async function safeClick(element, { waitAfter = 800 } = {}) {
    if (!element) return false;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(200, 100);
    element.click();
    await sleep(waitAfter, 200);
    return true;
  }

  // ─── Find button by text content (multilingual) ──
  function findButtonByText(texts, scope = document) {
    const buttons = scope.querySelectorAll('button, [role="button"], a[role="button"]');
    for (const btn of buttons) {
      const btnText = btn.textContent?.trim().toLowerCase() || '';
      for (const t of texts) {
        if (btnText === t.toLowerCase() || btnText.includes(t.toLowerCase())) return btn;
      }
    }
    return null;
  }

  // ─── Verify post appeared (generic) ───────────────
  async function verifyPostSuccess({ checkUrl = true, checkToast = true, timeout = 5000 } = {}) {
    const startUrl = location.href;
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      // Check for success toast / snackbar
      if (checkToast) {
        const toast = document.querySelector('[role="alert"], [data-testid="toast"], .notification, .snackbar, .toast');
        if (toast) {
          const text = toast.textContent?.toLowerCase() || '';
          if (text.includes('publicado') || text.includes('posted') || text.includes('shared') ||
              text.includes('enviado') || text.includes('sent') || text.includes('success') ||
              text.includes('created') || text.includes('creado')) {
            return { verified: true, method: 'toast' };
          }
        }
      }
      // Check for URL change (often means modal closed / redirected)
      if (checkUrl && location.href !== startUrl) {
        return { verified: true, method: 'url_change' };
      }
      await sleep(500, 100);
    }
    return { verified: false, method: 'timeout' };
  }

  // ─── Standard recorder setup ──────────────────────
  function createRecorder() {
    let isRecording = false;
    function onClick(e) {
      if (!isRecording) return;
      recordStep({
        type: 'click', selector: getSelector(e.target),
        tagName: e.target.tagName, text: e.target.textContent?.slice(0, 50),
        timestamp: Date.now(), url: location.href
      });
    }
    function onInput(e) {
      if (!isRecording) return;
      recordStep({
        type: 'input', selector: getSelector(e.target),
        value: e.target.value?.slice(0, 200),
        timestamp: Date.now(), url: location.href
      });
    }
    return {
      start() { isRecording = true; document.addEventListener('click', onClick, true); document.addEventListener('input', onInput, true); },
      stop() { isRecording = false; document.removeEventListener('click', onClick, true); document.removeEventListener('input', onInput, true); },
    };
  }

  // ══════════════════════════════════════════════════
  // Phase 6: Anti-Detection & Human Simulation
  // ══════════════════════════════════════════════════

  // ─── Fingerprint Randomization ────────────────────
  const HUMAN_PROFILES = [
    { typingSpeed: [30, 80], scrollSpeed: [200, 500], pauseRange: [800, 2500], name: 'casual' },
    { typingSpeed: [50, 120], scrollSpeed: [150, 400], pauseRange: [500, 1800], name: 'fast' },
    { typingSpeed: [20, 60], scrollSpeed: [300, 700], pauseRange: [1200, 3500], name: 'careful' },
  ];
  let _activeProfile = HUMAN_PROFILES[Math.floor(Math.random() * HUMAN_PROFILES.length)];

  function getProfile() { return _activeProfile; }
  function randomizeProfile() {
    _activeProfile = HUMAN_PROFILES[Math.floor(Math.random() * HUMAN_PROFILES.length)];
    return _activeProfile;
  }

  // ─── Human-like mouse movement simulation ─────────
  async function humanScroll(target) {
    if (!target) return;
    const p = getProfile();
    const scrollDelay = p.scrollSpeed[0] + Math.random() * (p.scrollSpeed[1] - p.scrollSpeed[0]);
    // Scroll in steps to appear natural
    const rect = target.getBoundingClientRect();
    const targetY = window.scrollY + rect.top - window.innerHeight / 3;
    const steps = 3 + Math.floor(Math.random() * 4);
    const startY = window.scrollY;
    for (let i = 1; i <= steps; i++) {
      const y = startY + (targetY - startY) * (i / steps);
      window.scrollTo({ top: y, behavior: 'auto' });
      await sleep(scrollDelay / steps, 50);
    }
  }

  // ─── Rate limiter (per-platform) ──────────────────
  const _lastAction = {};
  async function rateLimitWait(platform, minGapMs = 15000) {
    const now = Date.now();
    const last = _lastAction[platform] || 0;
    const diff = now - last;
    if (diff < minGapMs) {
      const waitMs = minGapMs - diff + Math.random() * 3000;
      console.log(`[OCTOPUS] Rate limit: waiting ${Math.round(waitMs / 1000)}s for ${platform}`);
      await sleep(waitMs, 1000);
    }
    _lastAction[platform] = Date.now();
  }

  // ─── Enhanced typeText with human-like character delays ─
  async function typeTextHuman(element, text) {
    element.focus();
    await sleep(300, 150);
    const p = getProfile();
    if (element.getAttribute('contenteditable') !== null) {
      // Type character by character for contenteditable
      for (let i = 0; i < text.length; i++) {
        document.execCommand('insertText', false, text[i]);
        // Variable delay per character, faster for spaces
        const charDelay = text[i] === ' '
          ? p.typingSpeed[0] * 0.5
          : p.typingSpeed[0] + Math.random() * (p.typingSpeed[1] - p.typingSpeed[0]);
        // Occasional longer pause (simulates thinking)
        if (Math.random() < 0.05 && i > 0) {
          await sleep(p.pauseRange[0], p.pauseRange[1] - p.pauseRange[0]);
        } else {
          await sleep(charDelay, 10);
        }
      }
    } else {
      // For regular inputs, use batch insert (character-by-character is too slow)
      const nativeSet = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set ||
                        Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      if (nativeSet) { nativeSet.call(element, text); element.dispatchEvent(new Event('input', { bubbles: true })); }
      else { element.value = text; element.dispatchEvent(new Event('input', { bubbles: true })); }
    }
    await sleep(200, 100);
  }

  // ─── Pre-action random page interaction ───────────
  async function humanWarmup() {
    const p = getProfile();
    // Random scroll
    if (Math.random() > 0.4) {
      const scrollY = 100 + Math.random() * 300;
      window.scrollBy({ top: scrollY, behavior: 'smooth' });
      await sleep(p.pauseRange[0], 500);
      window.scrollBy({ top: -scrollY * 0.7, behavior: 'smooth' });
      await sleep(p.pauseRange[0] * 0.5, 300);
    }
    // Random brief pause
    await sleep(p.pauseRange[0] * 0.3, 200);
  }

  console.log('[OCTOPUS] 🛠 Utils v2 loaded (profile:', _activeProfile.name, ')');

  return {
    sleep, waitForElement, waitForElementByPredicate, getSelector,
    recordStep, withRetry, typeText, uploadMedia, safeClick,
    findButtonByText, verifyPostSuccess, createRecorder,
    // Phase 6 exports
    getProfile, randomizeProfile, humanScroll, rateLimitWait,
    typeTextHuman, humanWarmup
  };
})();
