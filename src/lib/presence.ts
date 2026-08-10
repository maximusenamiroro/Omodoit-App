import { useEffect, useRef, useState } from 'react';
import { supabase } from '../api/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Worker online status via Supabase Realtime Presence — NOT the
// database. This is the cost-conscious pattern from the infrastructure
// plan: presence is pushed over the existing websocket connection and
// costs nothing per update, no matter how often a worker's status
// changes. The old approach (write an is_online/last_seen column to
// the database, or poll it on an interval) scales linearly with every
// worker and every client watching them — at even a few hundred
// concurrent workers this adds up to millions of avoidable writes/reads
// a month. Presence adds zero.
//
// One shared channel ('online-workers') is used for the whole app.
// Workers call useBroadcastPresence() to announce themselves while
// their app is open. Anyone (clients browsing, or any other screen)
// calls useOnlinePresence() to read live state — which categories have
// someone online, and which specific worker IDs are online.

const CHANNEL_NAME = 'online-workers';

interface PresencePayload {
  category: string | null;
  online_at: string;
}

// ── Worker side: announce presence while mounted ──────────────────────
// Call this once, near the root of the worker's app (WorkerNavigator),
// so "online" naturally means "has the app open" — no manual toggle
// needed, and it can't drift out of sync with reality the way a
// database flag can (e.g. an app that crashes without ever flipping
// is_online back to false).
export function useBroadcastPresence(userId: string | null | undefined, category: string | null) {
  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel(CHANNEL_NAME, {
      config: { presence: { key: userId } },
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        const payload: PresencePayload = { category, online_at: new Date().toISOString() };
        await channel.track(payload);
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, category]);
}

// ── Observer side: read live presence state ────────────────────────────
// Returns the set of category names with at least one online worker,
// and the set of specific worker user IDs currently online. Updates
// live as workers open/close their app — no polling.
export function useOnlinePresence() {
  const [onlineCategories, setOnlineCategories] = useState<Set<string>>(new Set());
  const [onlineWorkerIds, setOnlineWorkerIds] = useState<Set<string>>(new Set());
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const channel = supabase.channel(CHANNEL_NAME, {
      config: { presence: { key: 'observer-' + Math.random().toString(36).slice(2) } },
    });

    const syncState = () => {
      const state = channel.presenceState<PresencePayload>();
      const categories = new Set<string>();
      const ids = new Set<string>();

      Object.entries(state).forEach(([key, presences]) => {
        ids.add(key);
        presences.forEach(p => {
          if (p.category) categories.add(p.category);
        });
      });

      setOnlineCategories(categories);
      setOnlineWorkerIds(ids);
    };

    channel.on('presence', { event: 'sync' }, syncState);
    channel.subscribe();
    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, []);

  return { onlineCategories, onlineWorkerIds };
}
