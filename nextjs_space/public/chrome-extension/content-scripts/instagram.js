// ═══════════════════════════════════════════════════
// OCTOPUS Social Bridge — Instagram Content Script v2
// ═══════════════════════════════════════════════════

(function() {
  'use strict';
  const U = window.__OCTOPUS_UTILS;
  const recorder = U.createRecorder();

  const HANDLERS = {
    image: publishFeedPost,
    carousel: publishFeedPost,
    story: publishStory,
    reel: publishReel,
  };

  // ─── Feed Post (image / carousel) ─────────────────
  async function publishFeedPost(content, mediaUrl) {
    if (!mediaUrl) return { success: false, error: 'Instagram requiere al menos una imagen para publicar' };

    // Click "New post" button
    const newPostBtn = await U.waitForElementByPredicate(() => {
      return document.querySelector('[aria-label="New post"]') ||
             document.querySelector('[aria-label="Nueva publicación"]') ||
             document.querySelector('[aria-label="Nuevo post"]') ||
             document.querySelector('svg[aria-label="New post"]')?.closest('div[role="button"], a, button') ||
             document.querySelector('svg[aria-label="Nueva publicación"]')?.closest('div[role="button"], a, button');
    }, 8000);
    if (!newPostBtn) return { success: false, error: 'Botón de nueva publicación no encontrado. Asegúrate de estar en instagram.com' };
    await U.safeClick(newPostBtn, { waitAfter: 2000 });

    // Upload media
    const fileInput = await U.waitForElementByPredicate(() => {
      return document.querySelector('input[type="file"][accept*="image"]') ||
             document.querySelector('input[type="file"][accept*="video"]');
    }, 5000);
    if (!fileInput) return { success: false, error: 'No se encontró input de archivo' };

    const uploaded = await U.uploadMedia(mediaUrl, fileInput, {
      fileName: 'octopus-instagram',
      defaultType: 'image/jpeg',
      waitAfter: 3000
    });
    if (!uploaded) return { success: false, error: 'Error al subir media a Instagram' };

    // Click Next (crop step)
    await U.sleep(1000, 300);
    let nextBtn = U.findButtonByText(['Next', 'Siguiente']);
    if (nextBtn) {
      await U.safeClick(nextBtn, { waitAfter: 1500 });
    }

    // Click Next (filter step)
    await U.sleep(500, 200);
    nextBtn = U.findButtonByText(['Next', 'Siguiente']);
    if (nextBtn) {
      await U.safeClick(nextBtn, { waitAfter: 1500 });
    }

    // Add caption
    const captionArea = await U.waitForElementByPredicate(() => {
      return document.querySelector('textarea[aria-label*="caption"]') ||
             document.querySelector('textarea[aria-label*="pie de foto"]') ||
             document.querySelector('[contenteditable="true"][role="textbox"]') ||
             document.querySelector('textarea[placeholder]');
    }, 5000);
    if (captionArea) {
      await U.typeText(captionArea, content);
    }

    // Click Share
    await U.sleep(500, 200);
    const shareBtn = U.findButtonByText(['Share', 'Compartir', 'Publicar']);
    if (!shareBtn) return { success: false, error: 'Botón de compartir no encontrado' };
    await U.safeClick(shareBtn, { waitAfter: 4000 });

    const verification = await U.verifyPostSuccess({ timeout: 8000 });
    return { success: true, platformUrl: 'https://www.instagram.com', verified: verification.verified, contentType: 'image' };
  }

  // ─── Story ────────────────────────────────────────
  async function publishStory(content, mediaUrl) {
    if (!mediaUrl) return { success: false, error: 'Se requiere media para publicar una historia' };

    // Click on "Your story" or the + button
    const storyBtn = await U.waitForElementByPredicate(() => {
      return document.querySelector('[aria-label*="story"]') ||
             document.querySelector('[aria-label*="historia"]') ||
             document.querySelector('[data-testid="new-story-button"]');
    }, 5000);
    if (storyBtn) await U.safeClick(storyBtn, { waitAfter: 2000 });

    const fileInput = await U.waitForElementByPredicate(() =>
      document.querySelector('input[type="file"]'), 5000);
    if (!fileInput) return { success: false, error: 'Input de archivo para story no encontrado' };

    const uploaded = await U.uploadMedia(mediaUrl, fileInput, { fileName: 'octopus-story', waitAfter: 3000 });
    if (!uploaded) return { success: false, error: 'Error al subir media para historia' };

    await U.sleep(2000, 500);
    const shareBtn = U.findButtonByText(['Share to story', 'Compartir en historia', 'Share', 'Compartir', 'Tu historia', 'Your story']);
    if (shareBtn) {
      await U.safeClick(shareBtn, { waitAfter: 3000 });
      return { success: true, platformUrl: 'https://www.instagram.com', contentType: 'story' };
    }
    return { success: false, error: 'Botón de compartir historia no encontrado' };
  }

  // ─── Reel ─────────────────────────────────────────
  async function publishReel(content, mediaUrl) {
    if (!mediaUrl) return { success: false, error: 'Se requiere video para publicar un reel' };

    // Navigate to reels creation if possible
    const reelBtn = await U.waitForElementByPredicate(() => {
      return document.querySelector('[aria-label*="Reel"]') ||
             document.querySelector('[aria-label*="reel"]');
    }, 3000);
    if (reelBtn) {
      await U.safeClick(reelBtn, { waitAfter: 2000 });
    } else {
      // Fallback: use new post flow (will detect video)
      return await publishFeedPost(content, mediaUrl);
    }

    const fileInput = await U.waitForElementByPredicate(() =>
      document.querySelector('input[type="file"][accept*="video"]') ||
      document.querySelector('input[type="file"]'), 5000);
    if (!fileInput) return { success: false, error: 'Input de archivo para reel no encontrado' };

    await U.uploadMedia(mediaUrl, fileInput, { fileName: 'octopus-reel', defaultType: 'video/mp4', waitAfter: 5000 });

    // Next steps and caption
    await U.sleep(2000, 500);
    let nextBtn = U.findButtonByText(['Next', 'Siguiente']);
    if (nextBtn) await U.safeClick(nextBtn, { waitAfter: 1500 });
    nextBtn = U.findButtonByText(['Next', 'Siguiente']);
    if (nextBtn) await U.safeClick(nextBtn, { waitAfter: 1500 });

    const captionArea = await U.waitForElementByPredicate(() =>
      document.querySelector('textarea[aria-label*="caption"]') ||
      document.querySelector('[contenteditable="true"][role="textbox"]'), 5000);
    if (captionArea) await U.typeText(captionArea, content);

    const shareBtn = U.findButtonByText(['Share', 'Compartir', 'Publicar']);
    if (shareBtn) {
      await U.safeClick(shareBtn, { waitAfter: 5000 });
      return { success: true, platformUrl: 'https://www.instagram.com', contentType: 'reel' };
    }
    return { success: false, error: 'Botón de compartir reel no encontrado' };
  }

  // ─── Entry Point ──────────────────────────────────
  async function handlePublish(content, mediaUrl, contentType = 'image') {
    const handler = HANDLERS[contentType] || HANDLERS.image;
    return await U.withRetry(
      () => handler(content, mediaUrl),
      { maxRetries: 2, baseDelay: 2000, label: 'Instagram publish' }
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

  console.log('[OCTOPUS] 🐙 Instagram v2 loaded');
})();
