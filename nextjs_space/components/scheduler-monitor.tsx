'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

/**
 * Global Scheduler Monitor - Polls /api/social-bridge/scheduler every 30s
 * to check for and dispatch due scheduled posts via LinkedIn API.
 * Runs silently in the background across all dashboard pages.
 */
export function SchedulerMonitor() {
  const { data: session } = useSession() || {};
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!session?.user?.id) return;

    const checkScheduler = async () => {
      try {
        const res = await fetch('/api/social-bridge/scheduler');
        if (res.ok) {
          const data = await res.json();
          if (data.dispatched > 0) {
            console.log(`[OCTOPUS Scheduler] ✅ ${data.dispatched} post(s) publicados automáticamente`);
          }
        }
      } catch {
        // Silent fail — scheduler polling should never break the app
      }
    };

    // Check immediately on mount
    checkScheduler();

    // Then poll every 30 seconds
    intervalRef.current = setInterval(checkScheduler, 30000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [session?.user?.id]);

  return null; // Invisible component
}
