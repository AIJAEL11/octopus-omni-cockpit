export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET: Check LinkedIn API connection status (workspace-aware)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Get user's active workspace
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { activeWorkspaceId: true }
    });
    const activeWorkspaceId = user?.activeWorkspaceId || null;

    // 1. Check workspace-level LinkedIn credentials first
    if (activeWorkspaceId) {
      const workspace = await prisma.workspace.findUnique({
        where: { id: activeWorkspaceId },
        select: {
          id: true,
          name: true,
          linkedinAccessToken: true,
          linkedinUsername: true,
          linkedinProfileImage: true,
          linkedinProfileUrl: true,
          linkedinTokenExpiry: true,
          linkedinUserId: true,
        }
      });

      if (workspace?.linkedinAccessToken) {
        const isExpired = workspace.linkedinTokenExpiry ? workspace.linkedinTokenExpiry < new Date() : false;
        return NextResponse.json({
          connected: !isExpired,
          method: 'api',
          username: workspace.linkedinUsername,
          profileImage: workspace.linkedinProfileImage,
          profileUrl: workspace.linkedinProfileUrl,
          tokenExpiry: workspace.linkedinTokenExpiry,
          isExpired,
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          message: isExpired 
            ? `Token expirado para ${workspace.name} — reconecta tu cuenta` 
            : `Conectado vía LinkedIn API para ${workspace.name}`,
        });
      }

      // Workspace has no LinkedIn → show as not connected for this workspace
      return NextResponse.json({
        connected: false,
        method: null,
        workspaceId: workspace?.id,
        workspaceName: workspace?.name,
        message: `LinkedIn no conectado para ${workspace?.name || 'este workspace'}`,
      });
    }

    // 2. Fallback: check legacy SocialConnection (no workspace)
    const connection = await prisma.socialConnection.findUnique({
      where: { userId_platform: { userId: session.user.id, platform: 'linkedin' } },
    });

    if (!connection || !connection.accessToken) {
      return NextResponse.json({
        connected: false,
        method: null,
        message: 'LinkedIn no conectado',
      });
    }

    const isExpired = connection.tokenExpiry ? connection.tokenExpiry < new Date() : false;

    return NextResponse.json({
      connected: connection.isConnected && !isExpired,
      method: 'api',
      username: connection.username,
      profileImage: connection.profileImage,
      profileUrl: connection.profileUrl,
      tokenExpiry: connection.tokenExpiry,
      isExpired,
      workspaceId: connection.workspaceId,
      workspaceName: null,
      message: isExpired ? 'Token expirado — reconecta tu cuenta' : 'Conectado vía LinkedIn API',
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE: Disconnect LinkedIn
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    await prisma.socialConnection.updateMany({
      where: { userId: session.user.id, platform: 'linkedin' },
      data: {
        accessToken: null,
        refreshToken: null,
        tokenExpiry: null,
        platformUserId: null,
        isConnected: false,
      },
    });

    return NextResponse.json({ success: true, message: 'LinkedIn desconectado' });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
