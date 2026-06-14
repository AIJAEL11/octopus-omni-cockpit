// ═══════════════════════════════════════════════════
// OCTOPUS Social Bridge — TikTok Content Script v2
// ═══════════════════════════════════════════════════

(function() {
  'use strict';
  const U = window.__OCTOPUS_UTILS;
  const recorder = U.createRecorder();

  const HANDLERS = {
    video: publishVideo,
    image: publishSlideshow,
  };

  // ─── Video Post ───────────────────────────────────
  async function publishVideo(content, mediaUrl) {
    if (!mediaUrl) return { success: false, error: 'TikTok requiere un video para publicar' };

    // Navigate to upload page if not already there
    if (!location.pathname.includes('/upload') && !location.pathname.includes('/creator')) {
      window.location.href = 'https://www.tiktok.com/upload';
      await U.sleep(4000, 1000);
    }

    // Wait for file input
    const fileInput = await U.waitForElementByPredicate(() =>
      document.querySelector('input[type="file"][accept*="video"]') ||
      document.querySelector('input[type="file"]'), 10000);
    if (!fileInput) return { success: false, error: 'No se encontró el input de archivo de TikTok. Navega a tiktok.com/upload' };

    // Upload video
    const uploaded = await U.uploadMedia(mediaUrl, fileInput, {
      fileName: 'octopus-tiktok',
      defaultType: 'video/mp4',
      waitAfter: 8000 // TikTok processes video longer
    });
    if (!uploaded) return { success: false, error: 'Error al subir video a TikTok' };

    // Wait for video processing
    await U.sleep(3000, 1000);

    // Add caption
    const captionEditor = await U.waitForElementByPredicate(() => {
      return document.querySelector('[contenteditable="true"]') ||
             document.querySelector('.notranslate[contenteditable]') ||
             document.querySelector('[data-e2e="caption-editor"]') ||
             document.querySelector('.caption-editor [contenteditable]');
    }, 8000);
    if (captionEditor) {
      // TikTok often has pre-filled text, clear it first
      captionEditor.focus();
      await U.sleep(200, 100);
      document.execCommand('selectAll');
      await U.sleep(100);
      document.execCommand('insertText', false, content);
      await U.sleep(500, 200);
    }

    // Click Post
    await U.sleep(1000, 500);
    const postBtn = await U.waitForElementByPredicate(() =>
      U.findButtonByText(['Post', 'Publicar', 'Upload', 'Subir']) ||
      document.querySelector('[data-e2e="post-button"]') ||
      document.querySelector('button.btn-post'), 5000);
    if (!postBtn) return { success: false, error: 'Botón de publicar no encontrado' };
    await U.safeClick(postBtn, { waitAfter: 5000 });

    const verification = await U.verifyPostSuccess({ timeout: 10000 });
    return { success: true, platformUrl: 'https://www.tiktok.com', verified: verification.verified, contentType: 'video' };
  }

  // ─── Image Slideshow ──────────────────────────────
  async function publishSlideshow(content, mediaUrl) {
    if (!mediaUrl) return { success: false, error: 'Se requiere imagen para crear slideshow en TikTok' };

    if (!location.pathname.includes('/upload') && !location.pathname.includes('/creator')) {
      window.location.href = 'https://www.tiktok.com/upload';
      await U.sleep(4000, 1000);
    }

    // Look for photo/slideshow mode switch
    const photoMode = await U.waitForElementByPredicate(() =>
      U.findButtonByText(['Photo mode', 'Modo foto', 'Switch to photo', 'Photo']), 5000);
    if (photoMode) {
      await U.safeClick(photoMode, { waitAfter: 1500 });
    }

    const fileInput = await U.waitForElementByPredicate(() =>
      document.querySelector('input[type="file"][accept*="image"]') ||
      document.querySelector('input[type="file"]'), 5000);
    if (!fileInput) return { success: false, error: 'Input de archivo para foto no encontrado' };

    await U.uploadMedia(mediaUrl, fileInput, { fileName: 'octopus-tiktok-photo', defaultType: 'image/jpeg', waitAfter: 3000 });

    // Add caption
    const captionEditor = await U.waitForElementByPredicate(() =>
      document.querySelector('[contenteditable="true"]'), 5000);
    if (captionEditor) {
      captionEditor.focus();
      await U.sleep(200);
      document.execCommand('selectAll');
      document.execCommand('insertText', false, content);
    }

    await U.sleep(1000, 500);
    const postBtn = U.findButtonByText(['Post', 'Publicar', 'Upload']);
    if (postBtn) {
      await U.safeClick(postBtn, { waitAfter: 5000 });
      return { success: true, platformUrl: 'https://cdn-web.loomly.com/hubfs/44173479/Custom%20TikTok%20thumbnails%20example%20on%20a%20TikTok%20profile%20page%20.png', contentType: 'image' };
    }
    return { success: false, error: 'Botón de publicar no encontrado' };
  }

  // ─── Entry Point ──────────────────────────────────
  async function handlePublish(content, mediaUrl, contentType = 'video') {
    const handler = HANDLERS[contentType] || HANDLERS.video;
    return await U.withRetry(
      () => handler(content, mediaUrl),
      { maxRetries: 2, baseDelay: 3000, label: 'TikTok publish' }
    );
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'publish') {
      handlePublish(msg.content, msg.mediaUrl, msg.contentType || 'video').then(sendResponse);
      return true;
    }
    if (msg.action === 'startRecording') { recorder.start(); sendResponse({ ok: true }); }
    if (msg.action === 'stopRecording') { recorder.stop(); sendResponse({ ok: true }); }
  });

  console.log('[OCTOPUS] 🐙 TikTok v2 loaded');
})();
