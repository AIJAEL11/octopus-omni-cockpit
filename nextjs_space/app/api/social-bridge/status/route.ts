import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { socialBridgeBus } from '@/lib/social-bridge-events';
import { optionsResponse, jsonWithCors, corsHeaders } from '@/lib/social-bridge-cors';

export async function OPTIONS() { return optionsResponse(); }

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'octopus-social-bridge-secret';

function verifyExtToken(req: Request): string | null {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET) as { userId: string };
    return decoded.userId;
  } catch { return null; }
}

// POST: Extension reports its status + gets pending commands
export async function POST(req: Request) {
  try {
    const userId = verifyExtToken(req);
    if (!userId) return jsonWithCors({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json();
    const { platforms, extensionVersion, userAgent } = body;

    // Update extension session
    await prisma.extensionSession.upsert({
      where: { userId },
      create: {
        userId,
        isOnline: true,
        lastPing: new Date(),
        extensionVersion,
        userAgent,
        connectedPlatforms: JSON.stringify(platforms || [])
      },
      update: {
        isOnline: true,
        lastPing: new Date(),
        extensionVersion,
        userAgent,
        connectedPlatforms: JSON.stringify(platforms || [])
      }
    });

    // Update social connections
    if (platforms && Array.isArray(platforms)) {
      for (const platform of platforms) {
        await prisma.socialConnection.upsert({
          where: { userId_platform: { userId, platform } },
          create: { userId, platform, isConnected: true, lastSeen: new Date() },
          update: { isConnected: true, lastSeen: new Date() }
        });
      }
      // Mark disconnected platforms
      await prisma.socialConnection.updateMany({
        where: { userId, platform: { notIn: platforms }, isConnected: true },
        data: { isConnected: false }
      });
    }

    // Get pending publish commands
    const pendingPosts = await prisma.socialPost.findMany({
      where: { userId, status: { in: ['pending', 'queued'] } },
      orderBy: { createdAt: 'asc' },
      take: 5
    });

    const commands = pendingPosts.map(p => ({
      type: 'publish',
      postId: p.id,
      platform: p.platform,
      content: p.content,
      mediaUrl: p.mediaUrl,
      mediaType: p.mediaType
    }));

    // Mark them as publishing
    if (commands.length > 0) {
      await prisma.socialPost.updateMany({
        where: { id: { in: pendingPosts.map(p => p.id) } },
        data: { status: 'publishing' }
      });
    }

    // Emit SSE event → dashboard gets real-time update
    socialBridgeBus.emitToUser(userId, 'extension_ping', {
      isOnline: true,
      connectedPlatforms: platforms || [],
      extensionVersion,
      commandsSent: commands.length
    });

    // If connections changed, also emit connection_change
    if (platforms && Array.isArray(platforms)) {
      socialBridgeBus.emitToUser(userId, 'connection_change', {
        platforms: platforms
      });
    }

    return jsonWithCors({ ok: true, commands });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno';
    console.error('[SocialBridge Status]', msg);
    return jsonWithCors({ error: msg }, { status: 500 });
  }
}

// GET: Dashboard checks extension status (workspace-aware)
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const extSession = await prisma.extensionSession.findUnique({
      where: { userId: session.user.id }
    });

    // Get user's active workspace
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { activeWorkspaceId: true }
    });
    const activeWorkspaceId = user?.activeWorkspaceId || null;

    // Get active workspace details (including its own LinkedIn credentials)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let activeWorkspace: any = null;
    if (activeWorkspaceId) {
      activeWorkspace = await prisma.workspace.findUnique({
        where: { id: activeWorkspaceId },
        select: {
          id: true,
          name: true,
          linkedinUsername: true,
          linkedinUserId: true,
          linkedinProfileImage: true,
          linkedinTokenExpiry: true,
          linkedinAccessToken: true,
          twitterUsername: true,
          instagramUsername: true,
        }
      });
    }

    // Get all connections for user
    const connections = await prisma.socialConnection.findMany({
      where: { userId: session.user.id },
      orderBy: { platform: 'asc' }
    });

    // Check if extension is stale (no ping in 3 minutes)
    const isOnline = extSession?.isOnline &&
      extSession.lastPing &&
      (Date.now() - extSession.lastPing.getTime()) < 180000;

    // Build workspace-aware connection info
    const workspaceConnections = connections.map(c => {
      // If LinkedIn and workspace has its own credentials, show workspace info
      if (c.platform === 'linkedin' && activeWorkspace?.linkedinAccessToken) {
        const wsTokenValid = !activeWorkspace.linkedinTokenExpiry || 
          activeWorkspace.linkedinTokenExpiry > new Date();
        return {
          platform: c.platform,
          isConnected: wsTokenValid,
          username: activeWorkspace.linkedinUsername || c.username,
          lastSeen: c.lastSeen,
          workspaceId: activeWorkspaceId,
          workspaceName: activeWorkspace.name,
          belongsToWorkspace: c.workspaceId === activeWorkspaceId,
        };
      }
      return {
        platform: c.platform,
        isConnected: c.isConnected,
        username: c.username,
        lastSeen: c.lastSeen,
        workspaceId: c.workspaceId,
        workspaceName: null,
        belongsToWorkspace: !activeWorkspaceId || c.workspaceId === activeWorkspaceId,
      };
    });

    // If workspace has LinkedIn but no SocialConnection record for it, add it
    if (activeWorkspace?.linkedinAccessToken && activeWorkspace?.linkedinUserId) {
      const hasLinkedIn = workspaceConnections.some(c => c.platform === 'linkedin');
      if (!hasLinkedIn) {
        const wsTokenValid = !activeWorkspace.linkedinTokenExpiry || 
          activeWorkspace.linkedinTokenExpiry > new Date();
        workspaceConnections.push({
          platform: 'linkedin',
          isConnected: wsTokenValid,
          username: activeWorkspace.linkedinUsername,
          lastSeen: null,
          workspaceId: activeWorkspaceId,
          workspaceName: activeWorkspace.name,
          belongsToWorkspace: true,
        });
      }
    }

    return NextResponse.json({
      extension: {
        isOnline: !!isOnline,
        version: extSession?.extensionVersion || null,
        lastPing: extSession?.lastPing || null,
        connectedPlatforms: extSession?.connectedPlatforms
          ? JSON.parse(extSession.connectedPlatforms)
          : []
      },
      connections: workspaceConnections,
      activeWorkspace: activeWorkspace ? {
        id: activeWorkspace.id,
        name: activeWorkspace.name,
        hasLinkedin: !!activeWorkspace.linkedinAccessToken,
        linkedinUsername: activeWorkspace.linkedinUsername,
      } : null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
