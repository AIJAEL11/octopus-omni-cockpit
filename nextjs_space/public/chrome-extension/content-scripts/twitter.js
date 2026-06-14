// ═══════════════════════════════════════════════════
// OCTOPUS Social Bridge — Twitter/X Content Script v2
// ═══════════════════════════════════════════════════

(function() {
  'use strict';
  const U = window.__OCTOPUS_UTILS;
  const recorder = U.createRecorder();

  // ─── Content Type Handlers ────────────────────────
  const HANDLERS = {
    text: publishText,
    image: publishWithMedia,
    thread: publishThread,
  };

  async function publishText(content) {
    return await composeTweet(content, null);
  }

  async function publishWithMedia(content, mediaUrl) {
    if (!mediaUrl) return { success: false, error: 'Se requiere URL de media para publicar imagen/video' };
    return await composeTweet(content, mediaUrl);
  }

  async function publishThread(content) {
    // Split by double newline or ---|--- delimiter into thread parts
    const parts = content.split(/\n---\n|\n\n\n/).filter(p => p.trim());
    if (parts.length < 2) return await composeTweet(content, null);

    // First tweet
    let result = await composeTweet(parts[0].trim(), null);
    if (!result.success) return result;

    // Replies (click on tweet, then reply)
    for (let i = 1; i < parts.length; i++) {
      await U.sleep(2000, 500);
      // Find reply button on latest tweet
      const replyBtn = document.querySelector('[data-testid="reply"]');
      if (replyBtn) {
        await U.safeClick(replyBtn, { waitAfter: 1500 });
        const replyBox = await U.waitForElement('[data-testid="tweetTextarea_0"]', 5000);
        if (replyBox) {
          await U.typeText(replyBox, parts[i].trim());
          await U.sleep(500, 200);
          const replyPostBtn = document.querySelector('[data-testid="tweetButtonInline"]') ||
                               document.querySelector('[data-testid="tweetButton"]');
          if (replyPostBtn && !replyPostBtn.disabled) {
            await U.safeClick(replyPostBtn, { waitAfter: 2000 });
          }
        }
      }
    }
    return { success: true, platformUrl: 'https://x.com', contentType: 'thread', parts: parts.length };
  }

  // ─── Core Compose ─────────────────────────────────
  async function composeTweet(content, mediaUrl) {
    // Open compose dialog
    const composeBtn = document.querySelector('[data-testid="SideNav_NewTweet_Button"]') ||
                       document.querySelector('a[href="/compose/tweet"]') ||
                       document.querySelector('[data-testid="SideNav_NewTweet_Button"] a');
    if (composeBtn) {
      await U.safeClick(composeBtn, { waitAfter: 1500 });
    }

    // Wait for tweet box
    const tweetBox = await U.waitForElement('[data-testid="tweetTextarea_0"]', 8000);
    if (!tweetBox) return { success: false, error: 'No se encontró el editor de tweets. Asegúrate de estar en twitter.com/x.com' };

    // Type content
    await U.typeText(tweetBox, content);

    // Handle media upload
    if (mediaUrl) {
      const fileInput = document.querySelector('input[data-testid="fileInput"]') ||
                        document.querySelector('input[type="file"][accept*="image"]');
      if (fileInput) {
        const isVideo = mediaUrl.includes('.mp4') || mediaUrl.includes('.mov') || mediaUrl.includes('video');
        await U.uploadMedia(mediaUrl, fileInput, {
          fileName: 'octopus-media',
          defaultType: isVideo ? 'video/mp4' : 'image/jpeg',
          waitAfter: isVideo ? 4000 : 2500
        });
      }
    }

    // Click publish
    await U.sleep(500, 200);
    const postBtn = document.querySelector('[data-testid="tweetButtonInline"]') ||
                    document.querySelector('[data-testid="tweetButton"]');
    if (!postBtn || postBtn.disabled) {
      return { success: false, error: 'Botón de publicar no encontrado o deshabilitado' };
    }
    await U.safeClick(postBtn, { waitAfter: 2000 });

    // Verify
    const verification = await U.verifyPostSuccess({ timeout: 5000 });
    return {
      success: true,
      platformUrl: 'https://x.com',
      verified: verification.verified,
      verificationMethod: verification.method
    };
  }

  // ─── Entry Point with Retry ───────────────────────
  async function handlePublish(content, mediaUrl, contentType = 'text') {
    const handler = HANDLERS[contentType] || HANDLERS.text;
    return await U.withRetry(
      () => handler(content, mediaUrl),
      { maxRetries: 2, baseDelay: 2000, label: 'Twitter publish' }
    );
  }

  // ─── Message Listener ─────────────────────────────
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'publish') {
      handlePublish(msg.content, msg.mediaUrl, msg.contentType || 'text').then(sendResponse);
      return true;
    }
    if (msg.action === 'startRecording') { recorder.start(); sendResponse({ ok: true }); }
    if (msg.action === 'stopRecording') { recorder.stop(); sendResponse({ ok: true }); }
  });

  console.log('[OCTOPUS] 🐙 Twitter/X v2 loaded');
})();
