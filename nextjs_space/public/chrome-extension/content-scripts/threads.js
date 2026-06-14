// ═══════════════════════════════════════════════════
// OCTOPUS Social Bridge — Threads Content Script
// ═══════════════════════════════════════════════════

(function() {
  'use strict';
  const U = window.__OCTOPUS_UTILS;
  const recorder = U.createRecorder();

  const HANDLERS = {
    text: publishThread,
    image: publishThread,
  };

  // ─── Thread Post ──────────────────────────────────
  async function publishThread(content, mediaUrl) {
    // Click new post / compose button
    const composeBtn = await U.waitForElementByPredicate(() => {
      return document.querySelector('[aria-label*="New thread"]') ||
             document.querySelector('[aria-label*="Nuevo hilo"]') ||
             document.querySelector('[aria-label*="Create"]') ||
             document.querySelector('[aria-label*="Crear"]') ||
             document.querySelector('[data-testid="new-post-button"]') ||
             // Threads often uses a pencil / compose icon
             U.findButtonByText(['New thread', 'Nuevo hilo']);
    }, 8000);
    if (composeBtn) {
      await U.safeClick(composeBtn, { waitAfter: 2000 });
    }

    // Find the text editor
    const editor = await U.waitForElementByPredicate(() => {
      return document.querySelector('[contenteditable="true"][role="textbox"]') ||
             document.querySelector('[contenteditable="true"]') ||
             document.querySelector('textarea[placeholder]');
    }, 8000);
    if (!editor) return { success: false, error: 'No se encontró el editor de Threads. Asegúrate de estar en threads.net' };

    await U.typeText(editor, content);

    // Handle media upload
    if (mediaUrl) {
      // Click attach / media button
      const attachBtn = await U.waitForElementByPredicate(() => {
        return document.querySelector('[aria-label*="Attach"]') ||
               document.querySelector('[aria-label*="Adjuntar"]') ||
               document.querySelector('[aria-label*="media"]') ||
               document.querySelector('[aria-label*="photo"]') ||
               document.querySelector('[aria-label*="foto"]');
      }, 3000);
      if (attachBtn) await U.safeClick(attachBtn, { waitAfter: 1000 });

      const fileInput = await U.waitForElementByPredicate(() =>
        document.querySelector('input[type="file"][accept*="image"]') ||
        document.querySelector('input[type="file"]'), 5000);
      if (fileInput) {
        await U.uploadMedia(mediaUrl, fileInput, {
          fileName: 'octopus-threads',
          defaultType: 'image/jpeg',
          waitAfter: 2500
        });
      }
    }

    // Click Post
    await U.sleep(800, 300);
    const postBtn = await U.waitForElementByPredicate(() =>
      U.findButtonByText(['Post', 'Publicar', 'Share', 'Compartir']), 5000);
    if (!postBtn) return { success: false, error: 'Botón de publicar no encontrado' };
    await U.safeClick(postBtn, { waitAfter: 3000 });

    const verification = await U.verifyPostSuccess({ timeout: 6000 });
    return { success: true, platformUrl: 'https://www.threads.net', verified: verification.verified };
  }

  // ─── Entry Point ──────────────────────────────────
  async function handlePublish(content, mediaUrl, contentType = 'text') {
    const handler = HANDLERS[contentType] || HANDLERS.text;
    return await U.withRetry(
      () => handler(content, mediaUrl),
      { maxRetries: 2, baseDelay: 2000, label: 'Threads publish' }
    );
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'publish') {
      handlePublish(msg.content, msg.mediaUrl, msg.contentType || 'text').then(sendResponse);
      return true;
    }
    if (msg.action === 'startRecording') { recorder.start(); sendResponse({ ok: true }); }
    if (msg.action === 'stopRecording') { recorder.stop(); sendResponse({ ok: true }); }
  });

  console.log('[OCTOPUS] 🐙 Threads loaded');
})();
