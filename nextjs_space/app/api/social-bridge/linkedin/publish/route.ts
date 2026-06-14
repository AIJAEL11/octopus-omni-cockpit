export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST: Publish a post to LinkedIn via API
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { postId, content, mediaUrl, mediaType: requestedMediaType, workspaceId: requestedWorkspaceId } = body;
    if (!content) {
      return NextResponse.json({ error: 'content es requerido' }, { status: 400 });
    }

    // Get workspace if postId exists (check if post is associated with a workspace)
    let workspaceId: string | null = requestedWorkspaceId || null;
    if (postId && !workspaceId) {
      const post = await prisma.socialPost.findUnique({ 
        where: { id: postId },
        select: { workspaceId: true }
      });
      workspaceId = post?.workspaceId || null;
    }

    // Strategy: Try workspace credentials first, then fall back to user connection
    let token: string | null = null;
    let authorUrn: string | null = null;
    let connectionSource: string = 'user';

    // 1. Try Workspace credentials if workspaceId exists
    if (workspaceId) {
      const workspace = await prisma.workspace.findFirst({
        where: { id: workspaceId, userId: session.user.id }
      });
      
      if (workspace?.linkedinAccessToken && workspace?.linkedinUserId) {
        // Check workspace token expiry
        const isExpired = workspace.linkedinTokenExpiry && workspace.linkedinTokenExpiry < new Date();
        if (!isExpired) {
          token = workspace.linkedinAccessToken;
          authorUrn = workspace.linkedinUserId;
          connectionSource = `workspace:${workspace.name}`;
          console.log(`[LinkedIn API] Using workspace credentials: ${workspace.name}`);
        }
      }
    }

    // 2. Fall back to legacy SocialConnection if no workspace credentials
    if (!token || !authorUrn) {
      const connection = await prisma.socialConnection.findUnique({
        where: { userId_platform: { userId: session.user.id, platform: 'linkedin' } },
      });

      if (!connection?.accessToken || !connection.isConnected) {
        return NextResponse.json({ error: 'LinkedIn no conectado. Conecta tu cuenta primero.' }, { status: 400 });
      }

      // Check token expiry
      if (connection.tokenExpiry && connection.tokenExpiry < new Date()) {
        if (connection.refreshToken) {
          const refreshed = await refreshLinkedInToken(connection.refreshToken, session.user.id);
          if (!refreshed) {
            return NextResponse.json({ error: 'Token de LinkedIn expirado. Reconecta tu cuenta.' }, { status: 401 });
          }
        } else {
          return NextResponse.json({ error: 'Token de LinkedIn expirado. Reconecta tu cuenta.' }, { status: 401 });
        }
      }

      // Get fresh token (may have been refreshed)
      const freshConn = await prisma.socialConnection.findUnique({
        where: { userId_platform: { userId: session.user.id, platform: 'linkedin' } },
      });
      token = freshConn!.accessToken!;
      authorUrn = freshConn!.platformUserId!;
      connectionSource = 'user';
    }

    if (!authorUrn) {
      return NextResponse.json({ error: 'No se pudo obtener tu ID de LinkedIn. Reconecta tu cuenta.' }, { status: 400 });
    }

    // ─── Detect media type (image vs video) ───
    const isVideo = mediaUrl && (
      requestedMediaType === 'video' ||
      /\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(mediaUrl) ||
      /video/i.test(mediaUrl)
    );

    let mediaAssetUrn: string | null = null;
    let mediaCategory: 'IMAGE' | 'VIDEO' | 'NONE' = 'NONE';

    if (mediaUrl && isVideo) {
      console.log('[LinkedIn API] Uploading VIDEO to LinkedIn...');
      mediaAssetUrn = await uploadVideoToLinkedIn(mediaUrl, authorUrn, token!);
      if (mediaAssetUrn) {
        mediaCategory = 'VIDEO';
        console.log('[LinkedIn API] Video uploaded, asset:', mediaAssetUrn);
      } else {
        console.warn('[LinkedIn API] Video upload failed, posting text-only');
      }
    } else if (mediaUrl) {
      console.log('[LinkedIn API] Uploading IMAGE to LinkedIn...');
      mediaAssetUrn = await uploadImageToLinkedIn(mediaUrl, authorUrn, token!);
      if (mediaAssetUrn) {
        mediaCategory = 'IMAGE';
        console.log('[LinkedIn API] Image uploaded, asset:', mediaAssetUrn);
      } else {
        console.warn('[LinkedIn API] Image upload failed, posting text-only');
      }
    }

    // Build the post payload using UGC Posts API
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shareContent: any = {
      shareCommentary: { text: content },
      shareMediaCategory: mediaCategory,
    };

    if (mediaAssetUrn) {
      shareContent.media = [{
        status: 'READY',
        media: mediaAssetUrn,
      }];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const postPayload: any = {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': shareContent,
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    };

    console.log(`[LinkedIn API] Publishing post for ${authorUrn} via ${connectionSource}`);
    
    const publishRes = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(postPayload),
    });

    if (!publishRes.ok) {
      const errBody = await publishRes.text();
      console.error('[LinkedIn API] Publish failed:', publishRes.status, errBody);
      
      // Update post status if we have a postId
      if (postId) {
        await prisma.socialPost.update({
          where: { id: postId },
          data: { status: 'failed', errorMessage: `LinkedIn API: ${publishRes.status} - ${errBody}` },
        });
      }
      return NextResponse.json({ error: `LinkedIn API error: ${publishRes.status}`, details: errBody }, { status: 502 });
    }

    // Get the post ID from response header
    const linkedinPostId = publishRes.headers.get('x-restli-id') || '';
    const responseBody = await publishRes.json().catch(() => ({}));
    console.log('[LinkedIn API] Published! Post ID:', linkedinPostId);

    // Update SocialPost if we have one
    if (postId) {
      await prisma.socialPost.update({
        where: { id: postId },
        data: {
          status: 'published',
          publishedAt: new Date(),
          platformPostId: linkedinPostId || responseBody.id || null,
          platformUrl: linkedinPostId ? `https://www.linkedin.com/feed/update/${linkedinPostId}` : null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      platformPostId: linkedinPostId,
      platformUrl: linkedinPostId ? `https://www.linkedin.com/feed/update/${linkedinPostId}` : null,
      message: '¡Publicado en LinkedIn exitosamente!',
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno';
    console.error('[LinkedIn API] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Helper: Upload an image to LinkedIn and return the asset URN
async function uploadImageToLinkedIn(imageUrl: string, ownerUrn: string, accessToken: string): Promise<string | null> {
  try {
    let imageBuffer: Buffer;
    let contentType: string;

    // Handle base64 data URLs (user-uploaded images)
    if (imageUrl.startsWith('data:')) {
      console.log('[LinkedIn Image] Processing base64 image...');
      const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        console.error('[LinkedIn Image] Invalid base64 data URL');
        return null;
      }
      contentType = matches[1];
      imageBuffer = Buffer.from(matches[2], 'base64');
      console.log('[LinkedIn Image] Base64 decoded:', imageBuffer.length, 'bytes, type:', contentType);
    } else {
      // Download from URL (AI-generated images)
      console.log('[LinkedIn Image] Downloading image from:', imageUrl.substring(0, 100));
      const imageRes = await fetch(imageUrl);
      if (!imageRes.ok) {
        console.error('[LinkedIn Image] Failed to download image:', imageRes.status);
        return null;
      }
      imageBuffer = Buffer.from(await imageRes.arrayBuffer());
      contentType = imageRes.headers.get('content-type') || 'image/png';
      console.log('[LinkedIn Image] Downloaded:', imageBuffer.length, 'bytes, type:', contentType);
    }

    // Step 2: Register upload with LinkedIn
    const registerPayload = {
      registerUploadRequest: {
        owner: ownerUrn,
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        serviceRelationships: [{
          identifier: 'urn:li:userGeneratedContent',
          relationshipType: 'OWNER',
        }],
        supportedUploadMechanism: ['SYNCHRONOUS_UPLOAD'],
      },
    };

    const registerRes = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(registerPayload),
    });

    if (!registerRes.ok) {
      const errText = await registerRes.text();
      console.error('[LinkedIn Image] Register upload failed:', registerRes.status, errText);
      return null;
    }

    const registerData = await registerRes.json();
    const uploadUrl = registerData.value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.uploadUrl;
    const assetUrn = registerData.value?.asset;

    if (!uploadUrl || !assetUrn) {
      console.error('[LinkedIn Image] Missing uploadUrl or asset from register response');
      return null;
    }
    console.log('[LinkedIn Image] Got upload URL and asset:', assetUrn);

    // Step 3: Upload the binary image
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': contentType,
      },
      body: imageBuffer,
    });

    if (!uploadRes.ok && uploadRes.status !== 201) {
      const errText = await uploadRes.text();
      console.error('[LinkedIn Image] Upload binary failed:', uploadRes.status, errText);
      return null;
    }

    console.log('[LinkedIn Image] Binary uploaded successfully');
    return assetUrn;
  } catch (err) {
    console.error('[LinkedIn Image] Error:', err);
    return null;
  }
}

// Helper: Upload a video to LinkedIn and return the asset URN
async function uploadVideoToLinkedIn(videoUrl: string, ownerUrn: string, accessToken: string): Promise<string | null> {
  try {
    // Step 1: Download video from URL
    console.log('[LinkedIn Video] Downloading video from:', videoUrl.substring(0, 120));
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) {
      console.error('[LinkedIn Video] Failed to download video:', videoRes.status);
      return null;
    }
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
    const contentType = videoRes.headers.get('content-type') || 'video/mp4';
    console.log('[LinkedIn Video] Downloaded:', videoBuffer.length, 'bytes, type:', contentType);

    // Step 2: Register upload with LinkedIn (video recipe)
    const registerPayload = {
      registerUploadRequest: {
        owner: ownerUrn,
        recipes: ['urn:li:digitalmediaRecipe:feedshare-video'],
        serviceRelationships: [{
          identifier: 'urn:li:userGeneratedContent',
          relationshipType: 'OWNER',
        }],
        supportedUploadMechanism: ['SYNCHRONOUS_UPLOAD'],
      },
    };

    const registerRes = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(registerPayload),
    });

    if (!registerRes.ok) {
      const errText = await registerRes.text();
      console.error('[LinkedIn Video] Register upload failed:', registerRes.status, errText);
      return null;
    }

    const registerData = await registerRes.json();
    const uploadUrl = registerData.value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.uploadUrl;
    const assetUrn = registerData.value?.asset;

    if (!uploadUrl || !assetUrn) {
      console.error('[LinkedIn Video] Missing uploadUrl or asset from register response');
      return null;
    }
    console.log('[LinkedIn Video] Got upload URL and asset:', assetUrn);

    // Step 3: Upload the binary video
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': contentType,
      },
      body: videoBuffer,
    });

    if (!uploadRes.ok && uploadRes.status !== 201) {
      const errText = await uploadRes.text();
      console.error('[LinkedIn Video] Upload binary failed:', uploadRes.status, errText);
      return null;
    }
    console.log('[LinkedIn Video] Binary uploaded successfully');

    // Step 4: Wait for video processing (poll status)
    const assetId = assetUrn.replace('urn:li:digitalmediaAsset:', '');
    let attempts = 0;
    const maxAttempts = 30; // 30 * 2s = 60s max wait
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;

      const statusRes = await fetch(`https://api.linkedin.com/v2/assets/${assetId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      });

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        const recipes = statusData.recipes || [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const feedshare = recipes.find((r: any) => r.recipe === 'urn:li:digitalmediaRecipe:feedshare-video');
        const status = feedshare?.status || statusData.status;
        console.log(`[LinkedIn Video] Poll ${attempts}: status=${status}`);

        if (status === 'AVAILABLE' || status === 'READY') {
          console.log('[LinkedIn Video] Video processing complete!');
          return assetUrn;
        } else if (status === 'PROCESSING' || status === 'WAITING_UPLOAD') {
          continue;
        } else {
          console.error('[LinkedIn Video] Unexpected status:', status);
          // Still try to use it
          if (attempts > 5) return assetUrn;
        }
      }
    }

    // After max attempts, try to use the asset anyway
    console.warn('[LinkedIn Video] Max poll attempts reached, using asset as-is');
    return assetUrn;
  } catch (err) {
    console.error('[LinkedIn Video] Error:', err);
    return null;
  }
}

// Helper: Refresh LinkedIn access token
async function refreshLinkedInToken(refreshToken: string, userId: string): Promise<boolean> {
  try {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    if (!clientId || !clientSecret) return false;

    const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!res.ok) {
      console.error('[LinkedIn] Token refresh failed:', await res.text());
      return false;
    }

    const data = await res.json();
    await prisma.socialConnection.update({
      where: { userId_platform: { userId, platform: 'linkedin' } },
      data: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
        tokenExpiry: new Date(Date.now() + data.expires_in * 1000),
      },
    });
    return true;
  } catch (e) {
    console.error('[LinkedIn] Token refresh error:', e);
    return false;
  }
}
