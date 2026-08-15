import { supabase } from '../api/supabase';

// Data loading for the worker's Workstation and its two "see all"
// pages. It lives here rather than in the screens because the dashboard
// shows the first two rows and the full-list screens show the rest —
// two places reading the same tables, which is exactly how the two
// drifted apart before.

export interface BookingRow {
  id: string;
  clientId: string;
  clientName: string;
  job: string;
  status: string;
  createdAt: string;
  time: string;
  location: string;
}

export interface ProductOrderRow {
  id: string;
  buyerId: string;
  buyerName: string;
  productName: string;
  productImageUrl: string | null;
  quantity: number;
  total: number | null;
  status: string;
  createdAt: string;
  time: string;
}

// Statuses the dashboard cares about: anything still in flight.
export const OPEN_BOOKING_STATUSES = ['pending', 'accepted', 'in_progress'];

export function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
  return Math.floor(seconds / 86400) + 'd ago';
}

async function namesFor(ids: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return {};
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, business_name')
    .in('id', unique);
  const map: Record<string, string> = {};
  (data || []).forEach((p: any) => {
    map[p.id] = p.full_name || p.business_name || 'User';
  });
  return map;
}

/**
 * Direct "Book Now" requests for this worker. Flash Jobs are excluded —
 * they are a separate, urgent flow with their own inbox screen, and
 * mixing them in buried the normal bookings.
 *
 * `statuses` defaults to the open ones; pass null for every status,
 * which is what the full-list screen does so completed work is visible.
 */
export async function fetchWorkerBookings(
  workerId: string,
  opts: { statuses?: readonly string[] | null; limit?: number; offset?: number } = {}
): Promise<BookingRow[]> {
  const { statuses = OPEN_BOOKING_STATUSES, limit = 50, offset = 0 } = opts;

  let query = supabase
    .from('hire_requests')
    .select('id, client_id, job_description, location, status, created_at')
    .eq('worker_id', workerId)
    .is('flash_batch_id', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (statuses) query = query.in('status', statuses);

  const { data: rows, error } = await query;
  if (error) throw error;

  const nameMap = await namesFor((rows || []).map((r: any) => r.client_id));

  return (rows || []).map((r: any) => ({
    id: r.id,
    clientId: r.client_id,
    clientName: nameMap[r.client_id] || 'Client',
    job: (r.job_description || '').split('\n')[0].slice(0, 60),
    status: r.status,
    createdAt: r.created_at,
    time: timeAgo(r.created_at),
    location: r.location || '',
  }));
}

/**
 * Product orders placed against anything this worker posted.
 *
 * `orders` has no worker_id column — it points at a product — so this
 * is two queries: the worker's product ids, then the orders for them.
 * Returns [] rather than every order in the table when the worker has
 * posted nothing, because `.in('product_id', [])` would match nothing
 * but an unguarded query would not.
 */
export async function fetchWorkerOrders(
  workerId: string,
  opts: { limit?: number; offset?: number } = {}
): Promise<ProductOrderRow[]> {
  const { limit = 50, offset = 0 } = opts;

  const { data: products, error: pErr } = await supabase
    .from('products')
    .select('id')
    .eq('worker_id', workerId);
  if (pErr) throw pErr;
  if (!products || products.length === 0) return [];

  const { data: rows, error } = await supabase
    .from('orders')
    .select('id, user_id, product_name, product_image_url, quantity, total_amount, status, created_at')
    .in('product_id', products.map((p: any) => p.id))
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;

  const nameMap = await namesFor((rows || []).map((r: any) => r.user_id));

  return (rows || []).map((r: any) => ({
    id: r.id,
    buyerId: r.user_id,
    buyerName: nameMap[r.user_id] || 'Customer',
    productName: r.product_name || 'Product',
    productImageUrl: r.product_image_url || null,
    quantity: r.quantity ?? 1,
    total: r.total_amount != null ? Number(r.total_amount) : null,
    status: r.status || 'pending',
    createdAt: r.created_at,
    time: timeAgo(r.created_at),
  }));
}

/**
 * Moves an order along. Scoped by the current status so two taps (or
 * two devices) can't walk an order backwards; returns false when the
 * row had already moved on, which the caller surfaces rather than
 * pretending the change stuck.
 */
export async function setOrderStatus(
  orderId: string,
  next: 'accepted' | 'completed' | 'cancelled',
  allowedFrom: string[]
): Promise<boolean> {
  const { data, error } = await supabase
    .from('orders')
    .update({ status: next })
    .eq('id', orderId)
    .in('status', allowedFrom)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  return !!data;
}
