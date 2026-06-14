// ═══════════════════════════════════════════════════
// OCTOPUS Social Bridge — Facebook Content Script v2
// ═══════════════════════════════════════════════════

(function() {
  'use strict';
  const U = window.__OCTOPUS_UTILS;
  const recorder = U.createRecorder();

  const HANDLERS = {
    text: publishPost,
    image: publishPost,
    video: publishPost,
    story: publishStory,
    reel: publishReel,
  };

  // ─── Feed Post (text / image / video) ─────────────
  async function publishPost(content, mediaUrl) {
    // Open composer by clicking "What's on your mind?"
    const composerTrigger = await U.waitForElementByPredicate(() => {
      const textMatches = ["what's on your mind", "qué estás pensando", "que estás pensando", "¿qué estás pensando"];
      const allSpans = document.querySelectorAll('span, div[role="button"]');
      for (const el of allSpans) {
        const t = el.textContent?.toLowerCase() || '';
        if (textMatches.some(m => t.includes(m))) return el;
      }
      return null;
    }, 8000);
    if (composerTrigger) {
      await U.safeClick(composerTrigger, { waitAfter: 2000 });
    }

    // Find the contenteditable editor
    const editor = await U.waitForElementByPredicate(() => {
      const editors = document.querySelectorAll('[contenteditable="true"][role="textbox"]');
      for (const ed of editors) {
        if (ed.offsetParent !== null) return ed; // visible editor
      }
      return null;
    }, 8000);
    if (!editor) return { success: false, error: 'No se encontró el editor de Facebook. Asegúrate de estar en facebook.com' };

    await U.typeText(editor, content);

    // Handle media upload
    if (mediaUrl) {
      // Try to open photo/video upload
      const mediaBtn = U.findButtonByText(['Photo/video', 'Foto/video', 'Photo', 'Foto', 'Video']);
      if (mediaBtn) await U.safeClick(mediaBtn, { waitAfter: 1500 });

      const fileInput = await U.waitForElementByPredicate(() =>
        document.querySelector('input[type="file"][accept*="image"]') ||
        document.querySelector('input[type="file"][accept*="video"]') ||
        document.querySelector('input[type="file"][multiple]'), 5000);
      if (fileInput) {
        const isVideo = mediaUrl.includes('.mp4') || mediaUrl.includes('.mov') || mediaUrl.includes('video');
        await U.uploadMedia(mediaUrl, fileInput, {
          fileName: 'octopus-facebook',
          defaultType: isVideo ? 'video/mp4' : 'image/jpeg',
          waitAfter: isVideo ? 5000 : 2500
        });
      }
    }

    // Click Post
    await U.sleep(800, 300);
    const postBtn = U.findButtonByText(['Post', 'Publicar', 'Publish']);
    if (!postBtn) return { success: false, error: 'Botón de publicar no encontrado' };
    await U.safeClick(postBtn, { waitAfter: 3000 });

    const verification = await U.verifyPostSuccess({ timeout: 6000 });
    return { success: true, platformUrl: 'https://www.facebook.com', verified: verification.verified, contentType: mediaUrl ? 'image' : 'text' };
  }

  // ─── Story ────────────────────────────────────────
  async function publishStory(content, mediaUrl) {
    if (!mediaUrl) return { success: false, error: 'Se requiere media para publicar una historia en Facebook' };

    // Click create story
    const storyBtn = await U.waitForElementByPredicate(() => {
      return U.findButtonByText(['Create story', 'Crear historia', 'Create Story']) ||
             document.querySelector('[aria-label*="story"]') ||
             document.querySelector('[aria-label*="historia"]');
    }, 5000);
    if (storyBtn) await U.safeClick(storyBtn, { waitAfter: 2000 });

    // Look for photo story option
    const photoOption = U.findButtonByText(['Create a photo story', 'Crear historia con foto', 'Photo', 'Foto']);
    if (photoOption) await U.safeClick(photoOption, { waitAfter: 1500 });

    const fileInput = await U.waitForElementByPredicate(() =>
      document.querySelector('input[type="file"]'), 5000);
    if (!fileInput) return { success: false, error: 'Input de archivo para story no encontrado' };

    await U.uploadMedia(mediaUrl, fileInput, { fileName: 'octopus-fb-story', waitAfter: 3000 });

    await U.sleep(2000, 500);
    const shareBtn = U.findButtonByText(['Share to story', 'Compartir en historia', 'Share', 'Compartir', 'Post', 'Publicar']);
    if (shareBtn) {
      await U.safeClick(shareBtn, { waitAfter: 3000 });
      return { success: true, platformUrl: 'https://www.facebook.com', contentType: 'story' };
    }
    return { success: false, error: 'Botón de compartir historia no encontrado' };
  }

  // ─── Reel ─────────────────────────────────────────
  async function publishReel(content, mediaUrl) {
    if (!mediaUrl) return { success: false, error: 'Se requiere video para publicar un reel en Facebook' };

    // Try to navigate to reel creation
    const reelBtn = await U.waitForElementByPredicate(() =>
      U.findButtonByText(['Reel', 'Create reel', 'Crear reel']), 3000);
    if (reelBtn) {
      await U.safeClick(reelBtn, { waitAfter: 2000 });
    } else {
      window.location.href = 'https://www.facebook.com/reel/create';
      await U.sleep(3000, 500);
    }

    const fileInput = await U.waitForElementByPredicate(() =>
      document.querySelector('input[type="file"][accept*="video"]') ||
      document.querySelector('input[type="file"]'), 5000);
    if (!fileInput) return { success: false, error: 'Input de archivo para reel no encontrado' };

    await U.uploadMedia(mediaUrl, fileInput, { fileName: 'octopus-fb-reel', defaultType: 'video/mp4', waitAfter: 5000 });

    // Add description
    await U.sleep(2000, 500);
    const descInput = await U.waitForElementByPredicate(() =>
      document.querySelector('[contenteditable="true"]') ||
      document.querySelector('textarea'), 3000);
    if (descInput) await U.typeText(descInput, content);

    const publishBtn = U.findButtonByText(['Publish', 'Publicar', 'Post', 'Share']);
    if (publishBtn) {
      await U.safeClick(publishBtn, { waitAfter: 5000 });
      return { success: true, platformUrl: 'https://www.facebook.com', contentType: 'reel' };
    }
    return { success: false, error: 'Botón de publicar reel no encontrado' };
  }

  // ─── Entry Point ──────────────────────────────────
  async function handlePublish(content, mediaUrl, contentType = 'text') {
    const handler = HANDLERS[contentType] || HANDLERS.text;
    return await U.withRetry(
      () => handler(content, mediaUrl),
      { maxRetries: 2, baseDelay: 2000, label: 'Facebook publish' }
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

  console.log('[OCTOPUS] 🐙 Facebook v2 loaded');
})();
