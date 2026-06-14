// ═══════════════════════════════════════════════════════════
// Social Bridge — In-Memory Event Bus (SSE Bridge)
// ═══════════════════════════════════════════════════════════
// This module provides a singleton event emitter that connects
// API routes to SSE streams. When an API route modifies data
// (status change, publish result, etc.), it emits an event here.
// SSE connections subscribed to that userId receive it instantly.

type EventCallback = (event: SocialBridgeEvent) => void;

export interface SocialBridgeEvent {
  type: 'status_update' | 'publish_command' | 'publish_result' | 'connection_change' | 'training_update' | 'extension_ping' | 'heartbeat';
  userId: string;
  data: Record<string, unknown>;
  timestamp: number;
}

class SocialBridgeEventBus {
  private subscribers: Map<string, Set<EventCallback>> = new Map();

  subscribe(userId: string, callback: EventCallback): () => void {
    if (!this.subscribers.has(userId)) {
      this.subscribers.set(userId, new Set());
    }
    this.subscribers.get(userId)!.add(callback);

    // Return unsubscribe function
    return () => {
      const subs = this.subscribers.get(userId);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) this.subscribers.delete(userId);
      }
    };
  }

  emit(event: SocialBridgeEvent): void {
    const subs = this.subscribers.get(event.userId);
    if (subs) {
      subs.forEach(cb => {
        try { cb(event); } catch (e) { console.error('[SSE Bus] Callback error:', e); }
      });
    }
  }

  // Emit to a specific user
  emitToUser(userId: string, type: SocialBridgeEvent['type'], data: Record<string, unknown>): void {
    this.emit({ type, userId, data, timestamp: Date.now() });
  }

  getSubscriberCount(userId: string): number {
    return this.subscribers.get(userId)?.size || 0;
  }

  getTotalSubscribers(): number {
    let total = 0;
    this.subscribers.forEach(subs => { total += subs.size; });
    return total;
  }
}

// Singleton — shared across all API routes in the same process
const globalForBus = globalThis as typeof globalThis & { __socialBridgeBus?: SocialBridgeEventBus };
export const socialBridgeBus = globalForBus.__socialBridgeBus || new SocialBridgeEventBus();
if (process.env.NODE_ENV !== 'production') globalForBus.__socialBridgeBus = socialBridgeBus;
