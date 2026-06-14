import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { socialBridgeBus } from '@/lib/social-bridge-events';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;


// POST: Queue a new publication (uses LinkedIn API when available, falls back to extension)
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { platform, content, mediaUrl, mediaType, contentType, source, sourceId, scheduledFor, workspaceId } = await req.json();
    if (!platform || !content) {
      return NextResponse.json({ error: 'platform y content son requeridos' }, { status: 400 });
    }

    // Validate workspaceId if provided
    let validWorkspaceId: string | null = null;
    if (workspaceId) {
      const workspace = await prisma.workspace.findFirst({
        where: { id: workspaceId, userId: session.user.id }
      });
      if (workspace) {
        validWorkspaceId = workspace.id;
      }
    } else {
      // If no workspaceId provided, use user's active workspace
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { activeWorkspaceId: true }
      });
      validWorkspaceId = user?.activeWorkspaceId || null;
    }

    // ─── Check if platform has API OAuth connection ───
    if (platform === 'linkedin') {
      const apiConn = await prisma.socialConnection.findUnique({
        where: { userId_platform: { userId: session.user.id, platform: 'linkedin' } },
      });
      const hasApiToken = apiConn?.accessToken && apiConn.isConnected &&
        (!apiConn.tokenExpiry || apiConn.tokenExpiry > new Date());

      if (hasApiToken) {
        // Direct API publish — no extension needed!
        const post = await prisma.socialPost.create({
          data: {
            userId: session.user.id,
            workspaceId: validWorkspaceId, // Associate with active workspace
            platform,
            content,
            mediaUrl: mediaUrl || null,
            mediaType: mediaType || null,
            source: source || 'manual',
            sourceId: sourceId || null,
            scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
            status: scheduledFor ? 'queued' : 'publishing'
          }
        });

        if (!scheduledFor) {
          // Publish immediately via LinkedIn API
          try {
            const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
            const publishRes = await fetch(`${baseUrl}/api/social-bridge/linkedin/publish`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Cookie': req.headers.get('cookie') || '',
              },
              body: JSON.stringify({ postId: post.id, content, mediaUrl, mediaType }),
            });
            const publishData = await publishRes.json();

            if (publishRes.ok && publishData.success) {
              return NextResponse.json({
                post: { ...post, status: 'published' },
                method: 'api',
                extensionOnline: false,
                message: '¡Publicado en LinkedIn vía API! 🚀',
                platformUrl: publishData.platformUrl,
              });
            } else {
              return NextResponse.json({
                post: { ...post, status: 'failed' },
                method: 'api',
                extensionOnline: false,
                message: `Error API: ${publishData.error || 'desconocido'}`,
              }, { status: 502 });
            }
          } catch (apiErr) {
            const errMsg = apiErr instanceof Error ? apiErr.message : 'Error API';
            await prisma.socialPost.update({
              where: { id: post.id },
              data: { status: 'failed', errorMessage: errMsg },
            });
            return NextResponse.json({
              post: { ...post, status: 'failed' },
              method: 'api',
              message: `Error API LinkedIn: ${errMsg}`,
            }, { status: 502 });
          }
        }

        return NextResponse.json({
          post,
          method: 'api',
          extensionOnline: false,
          message: 'Publicación programada vía API',
        });
      }
    }

    // ─── Fallback: Extension-based publish ───
    const extSession = await prisma.extensionSession.findUnique({
      where: { userId: session.user.id }
    });
    const isOnline = extSession?.isOnline &&
      extSession.lastPing &&
      (Date.now() - extSession.lastPing.getTime()) < 60000;

    const post = await prisma.socialPost.create({
      data: {
        userId: session.user.id,
        platform,
        content,
        mediaUrl: mediaUrl || null,
        mediaType: mediaType || null,
        source: source || 'manual',
        sourceId: sourceId || null,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        status: scheduledFor ? 'queued' : (isOnline ? 'pending' : 'queued')
      }
    });

    // Emit SSE event → extension picks up command instantly, dashboard updates
    socialBridgeBus.emitToUser(session.user.id, 'publish_command', {
      postId: post.id,
      platform,
      content,
      mediaUrl: mediaUrl || null,
      mediaType: mediaType || null,
      contentType: contentType || null,
      status: post.status
    });

    return NextResponse.json({
      post,
      method: 'extension',
      extensionOnline: !!isOnline,
      message: isOnline
        ? 'Publicación enviada a tu extensión'
        : 'Publicación en cola. Se enviará cuando la extensión esté activa.'
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
