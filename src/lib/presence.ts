import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../api/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Worker online status.
//
// This used to be a single Realtime channel, 'online-workers', that
// every worker joined and every client subscribed to. Presence sends
// each subscriber the FULL member list on every join and leave, so the
// payload grew with the number of online workers AND was re-sent to
// everyone watching each time anybody opened or closed the app. Fine
// for fifty workers; impossible at fifty thousand, and worst exactly
// when the platform is busiest.
//
// It is now split by the two questions the app actually asks:
//
//   "Which categories have someone online?" — the workspace grid. A
//   handful of numbers, read from a database aggregate (workers
//   heartbeat once a minute). No per-worker detail crosses the wire.
//
//   "Which workers in THIS trade are online?" — the worker list. Still
//   Realtime Presence, but on a per-category channel, so a client only
//   receives members of the one category it is looking at.

const CHANNEL_PREFIX = 'online-workers';

// One beat a minute against a two-minute staleness window on the server:
// a worker can miss a beat on a bad connection without blinking offline.
const HEARTBEAT_MS = 60_000;

// How often the workspace grid refreshes its counts. Presence is
// ambient information — nobody watches the grid waiting for a dot.
const COUNTS_REFRESH_MS = 30_000;

function channelFor(category: string | null | undefined): string {
  // Everything unlabelled shares one shard rather than falling back to
  // a single global channel, which is the thing being fixed here.
  return `${CHANNEL_PREFIX}:${(category || 'general').toLowerCase()}`;
}

interface PresencePayload {
  category: string | null;
  subcategory?: string | null;
  service?: string | null;
  name?: string | null;
  lat?: number | null;
  lng?: number | null;
  online_at: string;
}

interface PresenceExtra {
  subcategory?: string | null;
  service?: string | null;
  name?: string | null;
  lat?: number | null;
  lng?: number | null;
}

// ── Worker side: announce presence while mounted ──────────────────────
// Two channels of announcement, deliberately:
//
//   * the category's Realtime channel, so a client browsing that trade
//     sees the worker appear instantly;
//   * a heartbeat row, so the workspace grid can count online workers
//     per category without anyone subscribing to anything.
//
// The heartbeat is what makes this scale: one write per worker per
// minute costs the same whether one person or a million are watching.
export function useBroadcastPresence(
  userId: string | null | undefined,
  category: string | null,
  extra: PresenceExtra = {}
) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const extraRef = useRef(extra);
  extraRef.current = extra;

  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel(channelFor(category), {
      config: { presence: { key: userId } },
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        const payload: PresencePayload = {
          category, ...extraRef.current, online_at: new Date().toISOString(),
        };
        await channel.track(payload);
      }
    });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [userId, category]);

  useEffect(() => {
    if (!userId) return;

    const beat = () => {
      supabase.rpc('heartbeat_presence', {
        p_category: category,
        p_subcategory: extraRef.current.subcategory ?? null,
        p_lat: extraRef.current.lat ?? null,
        p_lng: extraRef.current.lng ?? null,
      }).then(({ error }) => {
        // Non-fatal: presence is ambient. A missed beat costs a dot on
        // someone's screen, not a booking.
        if (error) console.warn('Presence heartbeat failed:', error.message);
      });
    };

    beat();
    const timer = setInterval(beat, HEARTBEAT_MS);

    return () => {
      clearInterval(timer);
      // Mark offline on the way out so the grid updates immediately
      // rather than waiting for the row to age past the window.
      supabase.rpc('end_presence').then(({ error }) => {
        if (error) console.warn('Could not clear presence:', error.message);
      });
    };
  }, [userId, category]);

  // Re-broadcast when the extra fields change (a live position update,
  // say) without tearing the subscription down: track() on an already
  // subscribed channel just updates the existing entry.
  useEffect(() => {
    if (channelRef.current) {
      channelRef.current.track({ category, ...extraRef.current, online_at: new Date().toISOString() });
    }
  }, [category, extra.lat, extra.lng, extra.name, extra.subcategory, extra.service]);
}

// ── Observer side: which categories are live ──────────────────────────
// Counts, not members. Used by the workspace grid, which only ever needs
// to know whether a category has anybody in it.
export function useLiveCategories() {
  const [onlineCategories, setOnlineCategories] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState<Record<string, number>>({});

  const refresh = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('live_category_counts');
      if (error) throw error;

      const next: Record<string, number> = {};
      (data || []).forEach((row: any) => {
        if (row.category) next[row.category] = Number(row.worker_count) || 0;
      });
      setCounts(next);
      setOnlineCategories(new Set(Object.keys(next)));
    } catch (err) {
      console.warn('Could not load live categories:', err);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, COUNTS_REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return { onlineCategories, counts, refresh };
}

// ── Observer side: who is online in one category ──────────────────────
// Subscribes to a single category's shard, so the member list a client
// receives is bounded by that trade rather than by the whole platform.
// Pass null/undefined to subscribe to nothing.
export function useCategoryPresence(category: string | null | undefined) {
  const [onlineWorkerIds, setOnlineWorkerIds] = useState<Set<string>>(new Set());
  const [workers, setWorkers] = useState<Record<string, PresencePayload>>({});

  useEffect(() => {
    if (!category) {
      setOnlineWorkerIds(new Set());
      setWorkers({});
      return;
    }

    const channel = supabase.channel(channelFor(category), {
      config: { presence: { key: 'observer-' + Math.random().toString(36).slice(2) } },
    });

    const syncState = () => {
      const state = channel.presenceState<PresencePayload>();
      const ids = new Set<string>();
      const nextWorkers: Record<string, PresencePayload> = {};

      Object.entries(state).forEach(([key, presences]) => {
        // Observers join the same channel to listen; they are not workers
        // and must not be counted as online.
        if (key.startsWith('observer-')) return;
        ids.add(key);
        presences.forEach(p => { nextWorkers[key] = p; });
      });

      setOnlineWorkerIds(ids);
      setWorkers(nextWorkers);
    };

    channel.on('presence', { event: 'sync' }, syncState);
    channel.subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [category]);

  return { onlineWorkerIds, workers, count: onlineWorkerIds.size };
}
