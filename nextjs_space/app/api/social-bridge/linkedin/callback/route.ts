export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: LinkedIn OAuth callback — exchange code for token, save connection
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const errorDesc = url.searchParams.get('error_description');

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const dashboardUrl = `${baseUrl}/dashboard/social-bridge`;

    if (error) {
      console.error('[LinkedIn OAuth] Error:', error, errorDesc);
      return NextResponse.redirect(`${dashboardUrl}?linkedin_error=${encodeURIComponent(errorDesc || error)}`);
    }

    if (!code || !state) {
      return NextResponse.redirect(`${dashboardUrl}?linkedin_error=missing_code`);
    }

    // Decode state to get userId and workspaceId
    let userId: string;
    let workspaceId: string | null = null;
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
      userId = decoded.userId;
      workspaceId = decoded.workspaceId || null;
    } catch {
      return NextResponse.redirect(`${dashboardUrl}?linkedin_error=invalid_state`);
    }

    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return NextResponse.redirect(`${dashboardUrl}?linkedin_error=missing_credentials`);
    }

    const redirectUri = `${baseUrl}/api/social-bridge/linkedin/callback`;

    // Step 1: Exchange code for access token
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error('[LinkedIn OAuth] Token exchange failed:', errBody);
      return NextResponse.redirect(`${dashboardUrl}?linkedin_error=token_exchange_failed`);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const expiresIn = tokenData.expires_in; // seconds (usually 5184000 = 60 days)
    const refreshToken = tokenData.refresh_token || null;
    const tokenExpiry = new Date(Date.now() + expiresIn * 1000);

    // Step 2: Get user profile info (Person URN, name, picture)
    const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    let platformUserId = '';
    let username = '';
    let profileImage = '';
    let profileUrl = '';

    if (profileRes.ok) {
      const profile = await profileRes.json();
      platformUserId = profile.sub ? `urn:li:person:${profile.sub}` : '';
      username = profile.name || `${profile.given_name || ''} ${profile.family_name || ''}`.trim();
      profileImage = profile.picture || '';
      profileUrl = `https://www.linkedin.com/in/me`;
      console.log('[LinkedIn OAuth] Profile:', { sub: profile.sub, name: username });
    }

    // Step 3: Save LinkedIn credentials to Workspace (primary storage)
    if (workspaceId) {
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: {
          linkedinAccessToken: accessToken,
          linkedinRefreshToken: refreshToken,
          linkedinTokenExpiry: tokenExpiry,
          linkedinUserId: platformUserId,
          linkedinUsername: username,
          linkedinProfileUrl: profileUrl,
          linkedinProfileImage: profileImage,
        }
      });
      console.log('[LinkedIn OAuth] Credentials saved for workspace:', workspaceId);
    }

    // Step 4: Upsert SocialConnection — only if no workspace or if this connection belongs to the same workspace
    // This prevents overwriting another workspace's SocialConnection
    const existingConn = await prisma.socialConnection.findUnique({
      where: { userId_platform: { userId, platform: 'linkedin' } },
    });

    if (!existingConn) {
      // No existing connection — create new
      await prisma.socialConnection.create({
        data: {
          userId,
          platform: 'linkedin',
          accessToken,
          refreshToken,
          tokenExpiry,
          platformUserId,
          username,
          profileImage,
          profileUrl,
          isConnected: true,
          lastSeen: new Date(),
          capabilities: JSON.stringify(['post', 'text', 'article', 'image']),
          workspaceId: workspaceId,
        },
      });
    } else if (!existingConn.workspaceId || existingConn.workspaceId === workspaceId) {
      // Existing connection has no workspace or same workspace — safe to update
      await prisma.socialConnection.update({
        where: { id: existingConn.id },
        data: {
          accessToken,
          refreshToken,
          tokenExpiry,
          platformUserId,
          username,
          profileImage,
          profileUrl,
          isConnected: true,
          lastSeen: new Date(),
          capabilities: JSON.stringify(['post', 'text', 'article', 'image']),
          workspaceId: workspaceId,
        },
      });
    }
    // If existingConn belongs to a DIFFERENT workspace, we don't touch it
    // The workspace-level credentials are the primary source

    console.log('[LinkedIn OAuth] Connection saved for user:', userId, 'workspace:', workspaceId);
    return NextResponse.redirect(`${dashboardUrl}?linkedin_connected=true`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno';
    console.error('[LinkedIn OAuth] Callback error:', msg);
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    return NextResponse.redirect(`${baseUrl}/dashboard/social-bridge?linkedin_error=${encodeURIComponent(msg)}`);
  }
}
