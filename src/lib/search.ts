import { supabase } from '../api/supabase';

// Workspace search.
//
// A client typing "shoe" wants three different things at once: recent
// posts about shoes, reels about shoes, and shoe workers who are online
// right now. So one query string fans out to those three sources rather
// than only filtering the category grid, which is all the search box
// used to do — typing "shoe" against a fixed list of category names
// matched nothing and looked broken.
//
// Recency window matches the New Arrivals badge: 48 hours.
const CUTOFF_HOURS = 48;

export interface ProductHit {
  id: string;
  workerId: string;
  type: 'service' | 'product';
  title: string;
  description: string | null;
  price: number | null;
  imageUrl: string | null;
  videoUrl: string | null;
  category: string | null;
  createdAt: string;
  posterName: string;
}

export interface ReelHit {
  id: string;
  workerId: string;
  description: string | null;
  thumbnailUrl: string | null;
  posterName: string;
  category: string | null;
}

export interface SearchResults {
  products: ProductHit[];
  reels: ReelHit[];
}

// PostgREST's `or` filter is a comma-separated list, and it splits on
// commas *inside* values too — so a query containing a comma would be
// read as extra filter terms. Percent and underscore are LIKE wildcards
// and would otherwise let a query like "%" match everything.
function escapeForFilter(query: string): string {
  return query.replace(/[,()%_\\]/g, ' ').trim();
}

async function namesAndCategories(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return {};
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, business_name, category')
    .in('id', unique);
  const map: Record<string, { name: string; category: string | null }> = {};
  (data || []).forEach((p: any) => {
    map[p.id] = {
      name: p.business_name || p.full_name || 'A worker',
      category: p.category || null,
    };
  });
  return map;
}

/**
 * Searches products and reels posted in the last 48 hours.
 *
 * Online workers are a separate call — see searchLiveWorkers below —
 * because they come from the presence heartbeat table rather than from
 * posted content, and the two run in parallel.
 */
export async function searchWorkspace(rawQuery: string): Promise<SearchResults> {
  const query = escapeForFilter(rawQuery);
  if (query.length < 2) return { products: [], reels: [] };

  const cutoff = new Date(Date.now() - CUTOFF_HOURS * 60 * 60 * 1000).toISOString();
  const like = `%${query}%`;

  const [productRes, reelRes] = await Promise.all([
    supabase
      .from('products')
      .select('id, worker_id, type, title, description, price, image_url, video_url, category, created_at')
      .gte('created_at', cutoff)
      .or(`title.ilike.${like},description.ilike.${like},category.ilike.${like}`)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('reels')
      .select('id, user_id, description, thumbnail_url, created_at')
      .gte('created_at', cutoff)
      .ilike('description', like)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  if (productRes.error) throw productRes.error;
  if (reelRes.error) throw reelRes.error;

  const profileMap = await namesAndCategories([
    ...(productRes.data || []).map((p: any) => p.worker_id),
    ...(reelRes.data || []).map((r: any) => r.user_id),
  ]);

  return {
    products: (productRes.data || []).map((p: any) => ({
      id: p.id,
      workerId: p.worker_id,
      type: p.type === 'service' ? 'service' : 'product',
      title: p.title || 'Untitled',
      description: p.description || null,
      price: p.price != null ? Number(p.price) : null,
      imageUrl: p.image_url || null,
      videoUrl: p.video_url || null,
      category: p.category || null,
      createdAt: p.created_at,
      posterName: profileMap[p.worker_id]?.name || 'A worker',
    })),
    reels: (reelRes.data || []).map((r: any) => ({
      id: r.id,
      workerId: r.user_id,
      description: r.description || null,
      thumbnailUrl: r.thumbnail_url || null,
      posterName: profileMap[r.user_id]?.name || 'A worker',
      category: profileMap[r.user_id]?.category || null,
    })),
  };
}

export interface LiveWorkerHit {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
}

/**
 * Online workers whose trade or name matches the query.
 *
 * This used to filter the Realtime Presence member list on the phone,
 * which only worked because every online worker on the platform was in
 * that list — the thing that stops being true at scale. Presence is now
 * sharded per category, so the search asks the database instead, which
 * matches against the heartbeat table and returns a bounded page.
 */
export async function searchLiveWorkers(rawQuery: string): Promise<LiveWorkerHit[]> {
  const query = rawQuery.trim();
  if (query.length < 2) return [];

  const { data, error } = await supabase.rpc('search_live_workers', {
    p_query: query,
    p_limit: 20,
  });
  if (error) throw error;

  return (data || []).map((w: any) => ({
    id: w.id,
    name: w.full_name || 'Worker',
    category: w.category || 'General',
    subcategory: w.subcategory || null,
  }));
}
