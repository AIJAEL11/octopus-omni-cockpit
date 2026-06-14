export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET: Redirect user to LinkedIn OAuth consent screen
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const clientId = process.env.LINKEDIN_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json({ error: 'LINKEDIN_CLIENT_ID no configurado' }, { status: 500 });
    }

    // Get workspaceId from query params (optional - for multi-workspace support)
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId');

    // Verify workspace belongs to user if provided
    if (workspaceId) {
      const workspace = await prisma.workspace.findFirst({
        where: { id: workspaceId, userId: session.user.id }
      });
      if (!workspace) {
        return NextResponse.json({ error: 'Workspace no válido' }, { status: 403 });
      }
    }

    // Build redirect URI — use NEXTAUTH_URL as base
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const redirectUri = `${baseUrl}/api/social-bridge/linkedin/callback`;

    // Build state param with userId and workspaceId to link back after OAuth
    const state = Buffer.from(JSON.stringify({ 
      userId: session.user.id, 
      workspaceId: workspaceId || null,
      ts: Date.now() 
    })).toString('base64url');

    const scopes = ['openid', 'profile', 'email', 'w_member_social'].join(' ');

    const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('scope', scopes);

    return NextResponse.redirect(authUrl.toString());
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
