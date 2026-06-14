// ═══════════════════════════════════════════════════
// OCTOPUS Social Bridge — LinkedIn Content Script v5 TURBO
// Ultra-fast, no retries, direct server reporting
// ═══════════════════════════════════════════════════

(function() {
  'use strict';
  const U = window.__OCTOPUS_UTILS;
  const recorder = U.createRecorder();

  // ─── Quick sleep (no jitter for speed) ────────────
  const qsleep = ms => new Promise(r => setTimeout(r, ms));

  // ─── Find the "Start a post" trigger ──────────────
  function findTrigger() {
    // 1. Classic LinkedIn share box
    const classic = document.querySelector('.share-box-feed-entry__trigger') ||
                    document.querySelector('.share-box-feed-entry__top-bar button') ||
                    document.querySelector('.share-box-feed-entry [role="button"]');
    if (classic) return { el: classic, method: 'classic' };

    // 2. Any element with share-box in class that's clickable
    const shareBoxes = document.querySelectorAll('[class*="share-box"], [class*="share-creation"]');
    for (const box of shareBoxes) {
      const btn = box.querySelector('button') || box.querySelector('[role="button"]') || box;
      const r = btn.getBoundingClientRect();
      if (r.width > 30 && r.height > 15) return { el: btn, method: 'share-box' };
    }

    // 3. Direct contenteditable with post-like placeholder (IS the editor already)
    const placeholders = document.querySelectorAll('[data-placeholder], [aria-placeholder]');
    for (const ph of placeholders) {
      const txt = ((ph.getAttribute('data-placeholder') || '') + (ph.getAttribute('aria-placeholder') || '')).toLowerCase();
      if (txt.includes('post') || txt.includes('publicación') || txt.includes('hablar') || txt.includes('talk') || txt.includes('share') || txt.includes('what')) {
        return { el: ph, method: 'placeholder-editor', isEditor: true };
      }
    }

    // 4. Button text search (multilingual)
    const keywords = [
      'start a post', 'iniciar una publicación', 'crear publicación',
      'empezar publicación', 'create a post', 'share something',
      'compartir algo', 'what\'s on your mind', 'qué piensas'
    ];
    const allBtns = document.querySelectorAll('button, [role="button"], [tabindex="0"]');
    for (const btn of allBtns) {
      const combined = ((btn.textContent || '') + ' ' + (btn.getAttribute('aria-label') || '')).toLowerCase();
      for (const kw of keywords) {
        if (combined.includes(kw)) {
          const r = btn.getBoundingClientRect();
          if (r.width > 20 && r.height > 10 && r.top < window.innerHeight && r.top > 0) {
            return { el: btn, method: 'text-' + kw.slice(0, 10) };
          }
        }
      }
    }

    // 5. Aggressive: any large clickable in top 400px that has post/share related content
    for (const btn of allBtns) {
      const r = btn.getBoundingClientRect();
      if (r.top > 0 && r.top < 400 && r.width > 100 && r.height > 30) {
        const text = (btn.textContent || '').toLowerCase();
        if (text.length < 100 && (text.includes('post') || text.includes('publica') || text.includes('share') || text.includes('compart') || text.includes('escrib') || text.includes('write'))) {
          return { el: btn, method: 'aggressive-top' };
        }
      }
    }

    return null;
  }

  // ─── Find ANY editor (contenteditable) ────────────
  function findEditor() {
    // 1. In dialog/modal (highest priority — post dialog)
    const modals = document.querySelectorAll('[role="dialog"], [role="document"], .artdeco-modal, [class*="modal"], [class*="share-box"]');
    for (const m of modals) {
      const ce = m.querySelector('[contenteditable="true"]');
      if (ce) {
        const r = ce.getBoundingClientRect();
        if (r.width > 30) return { el: ce, method: 'modal-ce' };
      }
    }

    // 2. Quill editor
    const ql = document.querySelector('.ql-editor[contenteditable="true"]');
    if (ql) return { el: ql, method: 'quill' };

    // 3. Role textbox
    const tb = document.querySelector('[role="textbox"][contenteditable="true"]');
    if (tb) {
      const r = tb.getBoundingClientRect();
      if (r.width > 50) return { el: tb, method: 'textbox' };
    }

    // 4. ANY visible contenteditable (very aggressive — lowered thresholds)
    const allCE = document.querySelectorAll('[contenteditable="true"]');
    for (const ce of allCE) {
      const r = ce.getBoundingClientRect();
      if (r.width > 50 && r.height > 20 && r.top > 0 && r.top < window.innerHeight) {
        return { el: ce, method: 'any-ce' };
      }
    }

    // 5. Placeholder elements
    const phSel = '[data-placeholder], [aria-placeholder]';
    const phs = document.querySelectorAll(phSel);
    for (const ph of phs) {
      if (ph.getAttribute('contenteditable') === 'true' || ph.isContentEditable) {
        return { el: ph, method: 'placeholder' };
      }
    }

    return null;
  }

  // ─── Find the Post/Submit button ──────────────────
  function findPostBtn() {
    // 1. Classic LinkedIn post button
    const primary = document.querySelector('.share-actions__primary-action');
    if (primary && !primary.disabled) return primary;

    // 2. In dialog: button with "Post"/"Publicar" text
    const modals = document.querySelectorAll('[role="dialog"], .artdeco-modal, [class*="share"]');
    for (const m of modals) {
      const btn = U.findButtonByText(['Post', 'Publicar', 'Publish', 'Share', 'Enviar', 'Compartir'], m);
      if (btn && !btn.disabled) return btn;
    }

    // 3. Primary artdeco button
    const artdeco = document.querySelector('button.artdeco-button--primary:not([disabled])');
    if (artdeco) {
      const text = (artdeco.textContent || '').toLowerCase();
      if (text.includes('post') || text.includes('public') || text.includes('share') || text.includes('enviar')) return artdeco;
    }

    // 4. Global search
    return U.findButtonByText(['Post', 'Publicar'], document);
  }

  // ─── Report result directly to server ─────────────
  async function reportToServer(serverUrl, postId, token, success, error) {
    if (!serverUrl || !postId) return;
    try {
      const body = { postId, success, error: error || null, platformUrl: success ? 'https://www.linkedin.com' : null };
      await fetch(serverUrl + '/api/social-bridge/publish/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify(body)
      });
      console.log('[OCTOPUS] ✓ Result reported directly to server');
    } catch (e) {
      console.warn('[OCTOPUS] Could not report to server:', e.message);
    }
  }

  // ─── MAIN PUBLISH FLOW (no retries, max speed) ───
  async function publishPost(content, mediaUrl, extra) {
    const { serverUrl, postId, token } = extra || {};
    console.log('[OCTOPUS] ══ LinkedIn v5 TURBO ══');
    console.log('[OCTOPUS] URL:', location.href);
    console.log('[OCTOPUS] Content length:', content?.length);

    // Wait for page to stabilize (just 1.5s)
    await qsleep(1500);

    // STEP 1: Find trigger
    console.log('[OCTOPUS] Step 1: Finding trigger...');
    let trigger = findTrigger();
    
    // If not found immediately, wait up to 6s with MutationObserver
    if (!trigger) {
      trigger = await new Promise(resolve => {
        const check = () => { const t = findTrigger(); if (t) return t; return null; };
        const observer = new MutationObserver(() => { const t = check(); if (t) { observer.disconnect(); resolve(t); } });
        observer.observe(document.body, { childList: true, subtree: true });
        // Also poll every 500ms as backup
        const interval = setInterval(() => { const t = check(); if (t) { clearInterval(interval); observer.disconnect(); resolve(t); } }, 500);
        setTimeout(() => { observer.disconnect(); clearInterval(interval); resolve(null); }, 6000);
      });
    }

    let editorResult = null;

    // ── Helper: robust click that simulates real mouse events ──
    async function realClick(el) {
      el.scrollIntoView({ block: 'center' });
      await qsleep(200);
      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const opts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: 0 };
      el.dispatchEvent(new PointerEvent('pointerdown', opts));
      el.dispatchEvent(new MouseEvent('mousedown', opts));
      await qsleep(80);
      el.dispatchEvent(new PointerEvent('pointerup', opts));
      el.dispatchEvent(new MouseEvent('mouseup', opts));
      el.dispatchEvent(new MouseEvent('click', opts));
      el.focus?.();
      console.log('[OCTOPUS] realClick dispatched on', el.tagName);
    }

    // ── Helper: wait for editor to appear ──
    async function waitEditor(timeout = 5000) {
      const immediate = findEditor();
      if (immediate) return immediate;
      return new Promise(resolve => {
        const observer = new MutationObserver(() => { const e = findEditor(); if (e) { observer.disconnect(); clearInterval(iv); resolve(e); } });
        observer.observe(document.body, { childList: true, subtree: true });
        const iv = setInterval(() => { const e = findEditor(); if (e) { clearInterval(iv); observer.disconnect(); resolve(e); } }, 250);
        setTimeout(() => { observer.disconnect(); clearInterval(iv); resolve(null); }, timeout);
      });
    }

    // ── ATTEMPT 1: Click trigger with real mouse events ──
    if (trigger) {
      console.log('[OCTOPUS] ✓ Trigger found:', trigger.method, trigger.el.tagName);
      
      if (trigger.isEditor) {
        console.log('[OCTOPUS] Trigger IS the editor, using directly');
        editorResult = { el: trigger.el, method: 'trigger-is-editor' };
      } else {
        await realClick(trigger.el);
        console.log('[OCTOPUS] Clicked trigger (real), waiting for dialog...');
        editorResult = await waitEditor(4000);
      }
    } else {
      console.warn('[OCTOPUS] ✗ No trigger found by selectors');
    }

    // ── ATTEMPT 2: Click any element with "Start a post" / "Empezar" text ──
    if (!editorResult) {
      console.log('[OCTOPUS] Attempt 2: Clicking any post-related text element...');
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        if (el.children.length > 3) continue; // Skip containers
        const text = (el.textContent || '').trim().toLowerCase();
        if (text.length > 3 && text.length < 60) {
          if (text.includes('start a post') || text.includes('empezar') || text.includes('iniciar') ||
              text.includes('crear publicación') || text.includes('create a post')) {
            const r = el.getBoundingClientRect();
            if (r.width > 30 && r.height > 10 && r.top > 0 && r.top < 500) {
              console.log('[OCTOPUS] Found text element:', text.slice(0, 30), el.tagName);
              await realClick(el);
              editorResult = await waitEditor(3000);
              if (editorResult) break;
            }
          }
        }
      }
    }

    // ── ATTEMPT 3: Click the share box area (top-of-feed input-like area) ──
    if (!editorResult) {
      console.log('[OCTOPUS] Attempt 3: Clicking share box area...');
      // The "Start a post" area is usually a large clickable div near the top
      const candidates = document.querySelectorAll('div[class*="share"], div[class*="update-components"], div[class*="feed-shared"]');
      for (const el of candidates) {
        const r = el.getBoundingClientRect();
        if (r.top > 50 && r.top < 300 && r.width > 200 && r.height > 30) {
          console.log('[OCTOPUS] Clicking share area:', (el.className || '').slice(0, 50));
          await realClick(el);
          editorResult = await waitEditor(3000);
          if (editorResult) break;
        }
      }
    }

    // ── ATTEMPT 4: Simulate click at the coordinate where "Start a post" typically is ──
    if (!editorResult) {
      console.log('[OCTOPUS] Attempt 4: Coordinate-based click on share area...');
      // "Start a post" is typically at ~400px from left, ~140px from top
      const shareArea = document.elementFromPoint(400, 140);
      if (shareArea) {
        console.log('[OCTOPUS] Element at (400,140):', shareArea.tagName, (shareArea.className || '').slice(0, 40));
        await realClick(shareArea);
        editorResult = await waitEditor(3000);
      }
    }

    // ── STEP 2: Final editor check ──
    if (!editorResult) {
      const ce = document.querySelectorAll('[contenteditable="true"]');
      const dlgs = document.querySelectorAll('[role="dialog"]');
      const diag = `URL:${location.href} CE:${ce.length} Dlgs:${dlgs.length} Title:${document.title.slice(0,30)}`;
      console.error('[OCTOPUS] ✗ NO EDITOR after all attempts. Diagnostics:', diag);
      
      ce.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        console.log(`[OCTOPUS] CE[${i}]:`, el.tagName, (el.className||'').slice(0,50), `${Math.round(r.width)}x${Math.round(r.height)} top=${Math.round(r.top)}`);
      });

      const errMsg = 'No se encontró el editor de LinkedIn. ' + diag;
      await reportToServer(serverUrl, postId, token, false, errMsg);
      return { success: false, error: errMsg };
    }

    console.log('[OCTOPUS] ✓ Editor found:', editorResult.method);
    const editor = editorResult.el;

    // STEP 3: Type content via Chrome Debugger (generates TRUSTED browser events)
    console.log('[OCTOPUS] Step 3: Typing content via debugger...');
    
    // Get editor's screen coordinates for trusted click via debugger
    const editorRect = editor.getBoundingClientRect();
    const clickX = Math.round(editorRect.left + editorRect.width / 2);
    const clickY = Math.round(editorRect.top + editorRect.height / 3); // upper third to avoid toolbar overlap
    console.log('[OCTOPUS] Editor rect:', editorRect.width, 'x', editorRect.height, 'click at:', clickX, clickY);

    let typed = '';

    // PRIMARY METHOD: Ask background.js to type via chrome.debugger
    // Background will: 1) attach debugger, 2) trusted click at editor coords, 3) type char by char, 4) detach
    try {
      console.log('[OCTOPUS] Requesting debugger typing from background...');
      const result = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ 
          action: 'typeText', 
          text: content, 
          clickX: clickX, 
          clickY: clickY 
        }, resolve);
      });
      console.log('[OCTOPUS] Debugger result:', JSON.stringify(result));
      await qsleep(800);
      typed = (editor.textContent || '').trim();
      if (typed.length > 2) {
        console.log('[OCTOPUS] ✓ Debugger typing worked!', typed.length, 'chars');
      } else {
        console.warn('[OCTOPUS] Debugger returned success but editor still empty, textContent:', editor.textContent);
      }
    } catch (e) {
      console.warn('[OCTOPUS] Debugger typing failed:', e.message);
    }

    // FALLBACK: execCommand (in case debugger permission not granted)
    if (typed.length < 2) {
      try {
        console.log('[OCTOPUS] Fallback: execCommand insertText...');
        editor.focus();
        await qsleep(100);
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, content);
        await qsleep(400);
        typed = (editor.textContent || '').trim();
      } catch (e) {
        console.warn('[OCTOPUS] execCommand failed:', e.message);
      }
    }

    // LAST RESORT: Direct innerHTML (text shows but Post btn may stay disabled)
    if (typed.length < 2) {
      try {
        console.log('[OCTOPUS] Last resort: innerHTML...');
        editor.focus();
        const html = content.split('\n').map(l => `<p>${l || '<br>'}</p>`).join('');
        editor.innerHTML = html;
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        await qsleep(400);
        typed = (editor.textContent || '').trim();
      } catch (e) {
        console.warn('[OCTOPUS] innerHTML failed:', e.message);
      }
    }

    console.log('[OCTOPUS] Final typed length:', typed.length, '/', content.length);

    // STEP 4: Handle media (if any, but don't waste time if no media)
    if (mediaUrl) {
      console.log('[OCTOPUS] Step 4: Uploading media...');
      const mediaBtn = document.querySelector('[aria-label*="photo"]') ||
                       document.querySelector('[aria-label*="foto"]') ||
                       document.querySelector('[aria-label*="image"]') ||
                       document.querySelector('[aria-label*="media"]') ||
                       document.querySelector('.image-sharing-detour-button');
      if (mediaBtn) {
        mediaBtn.click();
        await qsleep(1000);
        const fileInput = document.querySelector('input[type="file"]');
        if (fileInput) {
          await U.uploadMedia(mediaUrl, fileInput, { fileName: 'octopus', waitAfter: 2000 });
        }
      }
    }

    // STEP 5: Click Post button
    console.log('[OCTOPUS] Step 5: Finding Post button...');
    await qsleep(500);
    
    let postBtn = findPostBtn();
    if (!postBtn) {
      // Wait up to 3s for button to become enabled
      postBtn = await new Promise(resolve => {
        const interval = setInterval(() => { const b = findPostBtn(); if (b) { clearInterval(interval); resolve(b); } }, 300);
        setTimeout(() => { clearInterval(interval); resolve(null); }, 3000);
      });
    }

    if (!postBtn) {
      // If we typed content but can't find Post button, report what happened
      const errMsg = typed.length > 2
        ? 'Contenido escrito pero botón Publicar no encontrado. Verifica LinkedIn manualmente.'
        : 'No se pudo escribir el contenido ni encontrar botón Publicar.';
      console.error('[OCTOPUS] ✗', errMsg);
      await reportToServer(serverUrl, postId, token, false, errMsg);
      return { success: false, error: errMsg };
    }

    // Check if Post button is disabled (no content typed yet from LinkedIn's perspective)
    if (postBtn.disabled || postBtn.getAttribute('aria-disabled') === 'true') {
      console.warn('[OCTOPUS] Post button is disabled — content may not have registered with LinkedIn editor');
      // Try one more time: direct innerHTML + events
      editor.click();
      editor.focus();
      await qsleep(200);
      const paragraphs = content.split('\n').map(line => `<p>${line || '<br>'}</p>`).join('');
      editor.innerHTML = paragraphs;
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: content }));
      await qsleep(800);
      
      // Re-check button state
      const recheck = findPostBtn();
      if (recheck && !recheck.disabled && recheck.getAttribute('aria-disabled') !== 'true') {
        postBtn = recheck;
        console.log('[OCTOPUS] ✓ Post button now enabled after retry');
      }
    }

    console.log('[OCTOPUS] ✓ Post button found:', (postBtn.textContent || '').trim(), 'disabled:', postBtn.disabled);
    postBtn.scrollIntoView({ block: 'center' });
    await qsleep(150);
    postBtn.click();
    console.log('[OCTOPUS] ✓ Clicked Post!');
    await qsleep(2000);

    // STEP 6: Quick verification
    const toast = document.querySelector('[role="alert"]');
    const verified = toast ? (toast.textContent || '').toLowerCase().includes('post') ||
                             (toast.textContent || '').toLowerCase().includes('publicado') : false;
    
    console.log('[OCTOPUS] ══ PUBLISH COMPLETE ══ verified:', verified);
    await reportToServer(serverUrl, postId, token, true, null);
    return { success: true, platformUrl: 'https://www.linkedin.com', verified };
  }

  // ─── Article (simplified) ────────────────────────
  async function publishArticle(content, mediaUrl, extra) {
    return await publishPost(content, mediaUrl, extra);
  }

  // ─── Entry Point (NO retries — speed is king) ────
  async function handlePublish(content, mediaUrl, contentType, extra) {
    return await publishPost(content, mediaUrl, extra);
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'publish') {
      const extra = { serverUrl: msg.serverUrl, postId: msg.postId, token: msg.token };
      handlePublish(msg.content, msg.mediaUrl, msg.contentType || 'text', extra).then(sendResponse);
      return true; // async
    }
    if (msg.action === 'startRecording') { recorder.start(); sendResponse({ ok: true }); }
    if (msg.action === 'stopRecording') { sendResponse(recorder.stop()); }
    if (msg.action === 'ping') { sendResponse({ alive: true, platform: 'linkedin' }); }
  });

  console.log('[OCTOPUS] LinkedIn content script v6 DEBUGGER loaded ✓');
})();
