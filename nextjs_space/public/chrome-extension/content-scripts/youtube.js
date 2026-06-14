// ═══════════════════════════════════════════════════
// OCTOPUS Social Bridge — YouTube Content Script
// ═══════════════════════════════════════════════════

(function() {
  'use strict';
  const U = window.__OCTOPUS_UTILS;
  const recorder = U.createRecorder();

  const HANDLERS = {
    text: publishCommunityPost,
    community: publishCommunityPost,
    video: publishVideoUpload,
    short: publishShort,
  };

  // ─── Community Post (text + optional image) ──────
  async function publishCommunityPost(content, mediaUrl) {
    // Navigate to community tab
    if (!location.pathname.includes('/community') && !location.pathname.includes('/channel')) {
      // Try navigating to the user's channel community tab
      const channelLink = document.querySelector('a[href*="/channel/"], a[href*="/@"]');
      if (channelLink) {
        const href = channelLink.getAttribute('href');
        window.location.href = `https://www.youtube.com${href}/community`;
        await U.sleep(3000, 1000);
      }
    }

    // Click "Create post" or find the composer
    const createBtn = await U.waitForElementByPredicate(() => {
      return document.querySelector('#creation-box') ||
             document.querySelector('[aria-label*="Create a post"]') ||
             document.querySelector('[aria-label*="Crear publicación"]') ||
             U.findButtonByText(['Create a post', 'Crear una publicación', 'Create post']);
    }, 8000);
    if (createBtn) {
      await U.safeClick(createBtn, { waitAfter: 1500 });
    }

    // Find the text editor
    const editor = await U.waitForElementByPredicate(() => {
      return document.querySelector('#contenteditable-root[contenteditable="true"]') ||
             document.querySelector('[contenteditable="true"][role="textbox"]') ||
             document.querySelector('[contenteditable="true"]') ||
             document.querySelector('textarea[placeholder]');
    }, 8000);
    if (!editor) return { success: false, error: 'No se encontró el editor de comunidad. Necesitas estar en youtube.com/channel/TU_CANAL/community' };

    await U.typeText(editor, content);

    // Handle image upload
    if (mediaUrl) {
      const imageBtn = await U.waitForElementByPredicate(() =>
        document.querySelector('[aria-label*="image"]') ||
        document.querySelector('[aria-label*="imagen"]') ||
        document.querySelector('#image-upload-button'), 3000);
      if (imageBtn) await U.safeClick(imageBtn, { waitAfter: 1000 });

      const fileInput = await U.waitForElementByPredicate(() =>
        document.querySelector('input[type="file"][accept*="image"]') ||
        document.querySelector('input[type="file"]'), 5000);
      if (fileInput) {
        await U.uploadMedia(mediaUrl, fileInput, { fileName: 'octopus-youtube', waitAfter: 2500 });
      }
    }

    // Click Post
    await U.sleep(800, 300);
    const postBtn = U.findButtonByText(['Post', 'Publicar', 'Submit', 'Enviar']);
    if (!postBtn) return { success: false, error: 'Botón de publicar no encontrado' };
    await U.safeClick(postBtn, { waitAfter: 3000 });

    const verification = await U.verifyPostSuccess({ timeout: 6000 });
    return { success: true, platformUrl: 'https://www.youtube.com', verified: verification.verified, contentType: 'community' };
  }

  // ─── Video Upload ────────────────────────────────
  async function publishVideoUpload(content, mediaUrl) {
    if (!mediaUrl) return { success: false, error: 'Se requiere un video para subir a YouTube' };

    // Navigate to upload page
    if (!location.pathname.includes('/upload')) {
      window.location.href = 'https://studio.youtube.com/channel/upload';
      await U.sleep(4000, 1000);
    }

    const fileInput = await U.waitForElementByPredicate(() =>
      document.querySelector('input[type="file"][accept*="video"]') ||
      document.querySelector('input[type="file"]'), 10000);
    if (!fileInput) return { success: false, error: 'Input de archivo no encontrado. Navega a studio.youtube.com' };

    const uploaded = await U.uploadMedia(mediaUrl, fileInput, {
      fileName: 'octopus-youtube-video',
      defaultType: 'video/mp4',
      waitAfter: 8000
    });
    if (!uploaded) return { success: false, error: 'Error al subir video a YouTube' };

    // Fill title
    await U.sleep(3000, 1000);
    const titleInput = await U.waitForElementByPredicate(() =>
      document.querySelector('#textbox[aria-label="Add a title"]') ||
      document.querySelector('#textbox[aria-label*="título"]') ||
      document.querySelector('[id="title-textarea"] [contenteditable]') ||
      document.querySelector('#textbox'), 8000);
    if (titleInput) {
      titleInput.focus();
      await U.sleep(200);
      document.execCommand('selectAll');
      document.execCommand('insertText', false, content.split('\n')[0]?.slice(0, 100) || 'OCTOPUS Video');
    }

    // Fill description
    const descInput = await U.waitForElementByPredicate(() => {
      const boxes = document.querySelectorAll('#textbox[contenteditable]');
      return boxes.length > 1 ? boxes[1] : null;
    }, 5000);
    if (descInput) {
      const desc = content.split('\n').slice(1).join('\n') || content;
      await U.typeText(descInput, desc);
    }

    // Click through Next steps (Details → Monetization → Checks → Visibility)
    for (let step = 0; step < 3; step++) {
      await U.sleep(1000, 500);
      const nextBtn = U.findButtonByText(['Next', 'Siguiente']);
      if (nextBtn) await U.safeClick(nextBtn, { waitAfter: 1500 });
    }

    // Select Public
    await U.sleep(500, 200);
    const publicRadio = await U.waitForElementByPredicate(() =>
      document.querySelector('[name="PUBLIC"]') ||
      document.querySelector('#radioLabel-public') ||
      U.findButtonByText(['Public', 'Público']), 3000);
    if (publicRadio) await U.safeClick(publicRadio, { waitAfter: 500 });

    // Click Publish
    const publishBtn = U.findButtonByText(['Publish', 'Publicar', 'Done', 'Listo']);
    if (publishBtn) {
      await U.safeClick(publishBtn, { waitAfter: 5000 });
      return { success: true, platformUrl: 'https://www.youtube.com', contentType: 'video' };
    }
    return { success: false, error: 'Botón de publicar video no encontrado' };
  }

  // ─── YouTube Short ───────────────────────────────
  async function publishShort(content, mediaUrl) {
    // Shorts use the same upload flow as video but with vertical video
    return await publishVideoUpload(content, mediaUrl);
  }

  // ─── Entry Point ──────────────────────────────────
  async function handlePublish(content, mediaUrl, contentType = 'community') {
    const handler = HANDLERS[contentType] || HANDLERS.community;
    return await U.withRetry(
      () => handler(content, mediaUrl),
      { maxRetries: 2, baseDelay: 2000, label: 'YouTube publish' }
    );
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'publish') {
      handlePublish(msg.content, msg.mediaUrl, msg.contentType || 'community').then(sendResponse);
      return true;
    }
    if (msg.action === 'startRecording') { recorder.start(); sendResponse({ ok: true }); }
    if (msg.action === 'stopRecording') { recorder.stop(); sendResponse({ ok: true }); }
  });

  console.log('[OCTOPUS] 🐙 YouTube loaded');
})();
