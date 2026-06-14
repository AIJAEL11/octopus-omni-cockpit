// ═══════════════════════════════════════════════════════════════════════════════
// MEGA SKILL: Lead-to-Asset — Event Bus (SSE Bridge)
// ═══════════════════════════════════════════════════════════════════════════════
// In-memory event bus para emitir progreso en tiempo real al frontend.
// Mismo patrón que social-bridge-events.ts — singleton per-process.

export type LeadAssetEventType =
  | 'lead_to_asset:start'
  | 'lead_to_asset:progress'
  | 'lead_to_asset:done'
  | 'lead_to_asset:error';

export interface LeadAssetEvent {
  type: LeadAssetEventType;
  userId: string;
  processId: string;
  data: {
    status: string;
    leadId?: string;
    leadName?: string;
    stage?: string;
    progress?: number;
    message?: string;
    assetId?: string;
    assetUrl?: string;
    assetType?: string;
    emailSent?: boolean;
    error?: string;
  };
  ts: number;
}

type EventCallback = (event: LeadAssetEvent) => void;

class LeadAssetEventBus {
  private subscribers: Map<string, Set<EventCallback>> = new Map();

  subscribe(userId: string, callback: EventCallback): () => void {
    if (!this.subscribers.has(userId)) {
      this.subscribers.set(userId, new Set());
    }
    this.subscribers.get(userId)!.add(callback);
    return () => {
      const subs = this.subscribers.get(userId);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) this.subscribers.delete(userId);
      }
    };
  }

  emit(event: LeadAssetEvent): void {
    const subs = this.subscribers.get(event.userId);
    if (subs) {
      subs.forEach(cb => {
        try { cb(event); } catch (e) { console.error('[LeadAsset Bus] Callback error:', e); }
      });
    }
    // Also log for debugging
    console.log(`[LeadAsset:${event.type}] process=${event.processId} status=${event.data.status} progress=${event.data.progress ?? '-'}`);
  }

  emitStart(userId: string, processId: string, leadId: string | undefined, leadName: string, assetType: string): void {
    this.emit({
      type: 'lead_to_asset:start',
      userId,
      processId,
      data: { status: 'pending', leadId, leadName, assetType },
      ts: Date.now(),
    });
  }

  emitProgress(userId: string, processId: string, stage: string, progress: number, message: string, leadId?: string): void {
    this.emit({
      type: 'lead_to_asset:progress',
      userId,
      processId,
      data: { status: 'processing', leadId, stage, progress, message },
      ts: Date.now(),
    });
  }

  emitDone(userId: string, processId: string, data: { leadId?: string; assetId?: string; assetUrl?: string; emailSent?: boolean }): void {
    this.emit({
      type: 'lead_to_asset:done',
      userId,
      processId,
      data: { status: 'completed', ...data },
      ts: Date.now(),
    });
  }

  emitError(userId: string, processId: string, error: string, leadId?: string): void {
    this.emit({
      type: 'lead_to_asset:error',
      userId,
      processId,
      data: { status: 'error', leadId, error },
      ts: Date.now(),
    });
  }

  getSubscriberCount(userId: string): number {
    return this.subscribers.get(userId)?.size || 0;
  }
}

// Singleton — shared across all API routes in the same process
const g = globalThis as typeof globalThis & { __leadAssetBus?: LeadAssetEventBus };
export const leadAssetBus = g.__leadAssetBus || new LeadAssetEventBus();
if (process.env.NODE_ENV !== 'production') g.__leadAssetBus = leadAssetBus;
