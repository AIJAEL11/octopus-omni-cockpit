// ═══════════════════════════════════════════════════
// OCTOPUS Social Bridge — Pinterest Content Script
// ═══════════════════════════════════════════════════

(function() {
  'use strict';
  const U = window.__OCTOPUS_UTILS;
  const recorder = U.createRecorder();

  const HANDLERS = {
    image: publishPin,
    pin: publishPin,
    idea: publishIdeaPin,
  };

  // ─── Standard Pin ─────────────────────────────────
  async function publishPin(content, mediaUrl) {
    if (!mediaUrl) return { success: false, error: 'Pinterest requiere una imagen para crear un pin' };

    // Navigate to pin creation
    if (!location.pathname.includes('/pin-creation-tool') && !location.pathname.includes('/pin-builder')) {
      window.location.href = 'https://www.pinterest.com/pin-creation-tool/';
      await U.sleep(3000, 1000);
    }

    // Upload image
    const fileInput = await U.waitForElementByPredicate(() =>
      document.querySelector('input[type="file"][accept*="image"]') ||
      document.querySelector('input[type="file"]'), 8000);
    if (!fileInput) return { success: false, error: 'Input de archivo no encontrado. Navega a pinterest.com/pin-creation-tool/' };

    const uploaded = await U.uploadMedia(mediaUrl, fileInput, {
      fileName: 'octopus-pin',
      defaultType: 'image/jpeg',
      waitAfter: 3000
    });
    if (!uploaded) return { success: false, error: 'Error al subir imagen a Pinterest' };

    await U.sleep(1500, 500);

    // Fill title
    const titleInput = await U.waitForElementByPredicate(() =>
      document.querySelector('[data-test-id="pin-draft-title"] textarea') ||
      document.querySelector('#pin-draft-title') ||
      document.querySelector('textarea[placeholder*="title"]') ||
      document.querySelector('textarea[placeholder*="título"]') ||
      document.querySelector('[id*="pin-draft-title"]'), 5000);
    if (titleInput) {
      const title = content.split('\n')[0]?.slice(0, 100) || 'OCTOPUS Pin';
      await U.typeText(titleInput, title);
    }

    // Fill description
    const descInput = await U.waitForElementByPredicate(() =>
      document.querySelector('[data-test-id="pin-draft-description"] textarea') ||
      document.querySelector('#pin-draft-description') ||
      document.querySelector('textarea[placeholder*="description"]') ||
      document.querySelector('textarea[placeholder*="descripción"]') ||
      document.querySelector('[id*="pin-draft-description"]'), 5000);
    if (descInput) {
      const desc = content.split('\n').slice(1).join('\n') || content;
      await U.typeText(descInput, desc.slice(0, 500));
    }

    // Select board (optional — Pinterest may auto-select or prompt)
    await U.sleep(500, 200);

    // Click Publish
    const publishBtn = await U.waitForElementByPredicate(() =>
      U.findButtonByText(['Publish', 'Publicar', 'Save', 'Guardar']), 5000);
    if (!publishBtn) return { success: false, error: 'Botón de publicar no encontrado' };
    await U.safeClick(publishBtn, { waitAfter: 3000 });

    const verification = await U.verifyPostSuccess({ timeout: 6000 });
    return { success: true, platformUrl: 'https://www.pinterest.com', verified: verification.verified, contentType: 'pin' };
  }

  // ─── Idea Pin (multi-page) ───────────────────────
  async function publishIdeaPin(content, mediaUrl) {
    // For now, idea pins use the same flow; Pinterest merged them
    return await publishPin(content, mediaUrl);
  }

  // ─── Entry Point ──────────────────────────────────
  async function handlePublish(content, mediaUrl, contentType = 'image') {
    const handler = HANDLERS[contentType] || HANDLERS.image;
    return await U.withRetry(
      () => handler(content, mediaUrl),
      { maxRetries: 2, baseDelay: 2000, label: 'Pinterest publish' }
    );
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'publish') {
      handlePublish(msg.content, msg.mediaUrl, msg.contentType || 'image').then(sendResponse);
      return true;
    }
    if (msg.action === 'startRecording') { recorder.start(); sendResponse({ ok: true }); }
    if (msg.action === 'stopRecording') { recorder.stop(); sendResponse({ ok: true }); }
  });

  console.log('[OCTOPUS] 🐙 Pinterest loaded');
})();
