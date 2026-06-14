// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/skills/lead-to-asset/events — SSE stream for Lead-to-Asset progress
// ═══════════════════════════════════════════════════════════════════════════════
// The client connects and receives real-time events for all their L2A processes.
// Optionally filter by processId query param.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { leadAssetBus, type LeadAssetEvent } from '@/lib/skills/lead-to-asset-events';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userId = session.user.id;
  const { searchParams } = new URL(req.url);
  const filterProcessId = searchParams.get('processId');

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const send = (data: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          // Stream closed
        }
      };

      // Send initial connection event
      send(JSON.stringify({
        type: 'connected',
        userId,
        filterProcessId: filterProcessId || null,
        ts: Date.now(),
      }));

      // Subscribe to events
      const unsubscribe = leadAssetBus.subscribe(userId, (event: LeadAssetEvent) => {
        // Filter by processId if specified
        if (filterProcessId && event.processId !== filterProcessId) return;
        send(JSON.stringify(event));
      });

      // Heartbeat every 25s to keep connection alive
      const heartbeat = setInterval(() => {
        send(JSON.stringify({ type: 'heartbeat', ts: Date.now() }));
      }, 25000);

      // Cleanup on abort
      req.signal.addEventListener('abort', () => {
        unsubscribe();
        clearInterval(heartbeat);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
