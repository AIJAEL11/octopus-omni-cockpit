import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import jwt from 'jsonwebtoken';
import { socialBridgeBus, SocialBridgeEvent } from '@/lib/social-bridge-events';
import { optionsResponse, corsHeaders } from '@/lib/social-bridge-cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() { return optionsResponse(); }

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'octopus-social-bridge-secret';

// Resolve userId from either NextAuth session or extension JWT token
async function resolveUserId(req: NextRequest): Promise<string | null> {
  // Check extension JWT first (via query param or header)
  const tokenParam = req.nextUrl.searchParams.get('token');
  const authHeader = req.headers.get('authorization');
  const extToken = tokenParam || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);

  if (extToken) {
    try {
      const decoded = jwt.verify(extToken, JWT_SECRET) as { userId: string };
      return decoded.userId;
    } catch { /* fall through to session check */ }
  }

  // Check NextAuth session (dashboard)
  const session = await getServerSession(authOptions);
  return session?.user?.id || null;
}

// GET: SSE stream — both dashboard and extension can connect
export async function GET(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const source = req.nextUrl.searchParams.get('source') || 'dashboard';
  const encoder = new TextEncoder();
  let alive = true;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      const connectEvent = `data: ${JSON.stringify({
        type: 'connected',
        source,
        timestamp: Date.now(),
        subscriberCount: socialBridgeBus.getSubscriberCount(userId) + 1
      })}\n\n`;
      controller.enqueue(encoder.encode(connectEvent));

      // Subscribe to events for this user
      const unsubscribe = socialBridgeBus.subscribe(userId, (event: SocialBridgeEvent) => {
        if (!alive) return;
        try {
          const sseData = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(sseData));
        } catch {
          alive = false;
          unsubscribe();
        }
      });

      // Heartbeat every 15 seconds — keeps Chrome MV3 service worker alive
      // (SW dies after 30s inactivity; receiving data extends lifetime)
      const heartbeat = setInterval(() => {
        if (!alive) { clearInterval(heartbeat); return; }
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`));
        } catch {
          alive = false;
          clearInterval(heartbeat);
          unsubscribe();
        }
      }, 15000);

      // Cleanup when the client disconnects
      req.signal.addEventListener('abort', () => {
        alive = false;
        clearInterval(heartbeat);
        unsubscribe();
        try { controller.close(); } catch { /* already closed */ }
      });
    }
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  });
}
