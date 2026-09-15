import { supabase } from '../api/supabase';

// Reporting and blocking.
//
// WHY THIS EXISTS
// Apple's Guideline 1.2 and Google Play's UGC policy both require that
// an app carrying user-posted content lets people report that content,
// lets them block whoever posted it, and shows a way to reach a human.
// Omodoit is a feed of user video, so this is not optional: a reviewer
// opens the reels tab, looks for a report control, and rejects the
// build if there isn't one.
//
// Beyond passing review, the blocking half has to actually work — a
// block that leaves the person's reels in your feed is worse than no
// block at all, because it tells the user they are safe when they are
// not. So blockedUserIds is applied at the query, not in the UI.

export type ReportTargetType = 'reel' | 'profile' | 'comment' | 'product' | 'message';

export type ReportReason =
  | 'spam' | 'nudity' | 'violence' | 'hate'
  | 'harassment' | 'scam' | 'illegal' | 'impersonation' | 'other';

/** Shown in the report sheet, in this order. */
export const REPORT_REASONS: { value: ReportReason; label: string; hint: string }[] = [
  { value: 'nudity',        label: 'Nudity or sexual content', hint: 'Explicit or suggestive material' },
  { value: 'violence',      label: 'Violence or dangerous acts', hint: 'Threats, gore, or harm' },
  { value: 'harassment',    label: 'Harassment or bullying',   hint: 'Targeting or abusing someone' },
  { value: 'hate',          label: 'Hate speech',              hint: 'Attacks based on identity' },
  { value: 'scam',          label: 'Scam or fraud',            hint: 'Fake offers, advance-fee, deception' },
  { value: 'spam',          label: 'Spam or misleading',       hint: 'Repetitive or off-topic posting' },
  { value: 'impersonation', label: 'Impersonation',            hint: 'Pretending to be someone else' },
  { value: 'illegal',       label: 'Illegal goods or services', hint: 'Anything against the law' },
  { value: 'other',         label: 'Something else',           hint: 'Tell us what is wrong' },
];

export interface ReportInput {
  targetType: ReportTargetType;
  targetId: string;
  /** Who posted the thing. Kept so a report survives the content being deleted. */
  targetOwnerId?: string | null;
  reason: ReportReason;
  details?: string;
}

export type ReportOutcome = 'submitted' | 'already-reported' | 'failed';

/**
 * Files a report. Never throws — the caller is a UI action and a failure
 * here should tell the user plainly rather than crash a screen.
 *
 * A second report of the same thing by the same person returns
 * 'already-reported' rather than an error: the unique index is doing its
 * job, and from the user's side nothing is wrong.
 */
export async function reportContent(input: ReportInput): Promise<ReportOutcome> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 'failed';

    const { error } = await supabase.from('reports').insert({
      reporter_id: user.id,
      target_type: input.targetType,
      target_id: input.targetId,
      target_owner: input.targetOwnerId ?? null,
      reason: input.reason,
      details: input.details?.trim() ? input.details.trim().slice(0, 1000) : null,
    });

    // 23505 is unique_violation: they have reported this before.
    if (error) {
      if ((error as any).code === '23505') return 'already-reported';
      console.error('Report failed:', error);
      return 'failed';
    }
    return 'submitted';
  } catch (err) {
    console.error('Report failed:', err);
    return 'failed';
  }
}

/** Blocks a user. Idempotent: blocking twice is a success, not an error. */
export async function blockUser(blockedId: string): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.id === blockedId) return false;

    const { error } = await supabase
      .from('blocked_users')
      .insert({ blocker_id: user.id, blocked_id: blockedId });

    if (error && (error as any).code !== '23505') {
      console.error('Block failed:', error);
      return false;
    }
    clearBlockCache();
    return true;
  } catch (err) {
    console.error('Block failed:', err);
    return false;
  }
}

export async function unblockUser(blockedId: string): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { error } = await supabase
      .from('blocked_users')
      .delete()
      .eq('blocker_id', user.id)
      .eq('blocked_id', blockedId);
    if (error) { console.error('Unblock failed:', error); return false; }
    clearBlockCache();
    return true;
  } catch (err) {
    console.error('Unblock failed:', err);
    return false;
  }
}

// The block list, cached for the session.
//
// The reels feed applies this filter on every load and every pull to
// refresh. Fetching it each time would put an extra round trip in front
// of the most-used screen in the app, on connections where a round trip
// is the expensive part — which is a real cost paid by every user, for a
// list that almost never changes and that only this device can change.
//
// So it is read once and kept, and invalidated at the two moments it can
// actually go stale: this user blocks or unblocks someone, or a
// different user signs in.
let blockCache: { userId: string; ids: string[] } | null = null;

/** Called on sign-out and after any change to the list. */
export function clearBlockCache() {
  blockCache = null;
}

/**
 * Everyone the signed-in user has blocked.
 *
 * Returns [] rather than throwing when it cannot be fetched. That is a
 * deliberate trade: a feed that loads unfiltered is bad, but a feed that
 * refuses to load at all because the block list timed out is worse, and
 * the failure is visible either way.
 */
export async function blockedUserIds(): Promise<string[]> {
  try {
    // getSession reads the stored session rather than validating the
    // token against the server, so the cache-hit path costs nothing.
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) { blockCache = null; return []; }

    if (blockCache && blockCache.userId === userId) return blockCache.ids;

    const { data, error } = await supabase
      .from('blocked_users')
      .select('blocked_id')
      .eq('blocker_id', userId);
    if (error) { console.error('Could not load block list:', error); return []; }

    const ids = (data || []).map((r: any) => r.blocked_id);
    blockCache = { userId, ids };
    return ids;
  } catch {
    return [];
  }
}

export interface BlockedUser {
  id: string;
  name: string;
  avatarUrl: string | null;
  category: string | null;
  blockedAt: string;
}

/**
 * The block list with enough profile detail to be recognisable.
 *
 * Two queries rather than a join: blocked_users has RLS scoped to the
 * blocker, while profiles is readable more broadly, and PostgREST cannot
 * embed across that boundary without a foreign key it does not have.
 */
export async function blockedUsersWithProfiles(): Promise<BlockedUser[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: rows, error } = await supabase
      .from('blocked_users')
      .select('blocked_id, created_at')
      .eq('blocker_id', user.id)
      .order('created_at', { ascending: false });
    if (error || !rows?.length) return [];

    const ids = rows.map((r: any) => r.blocked_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, business_name, avatar_url, category')
      .in('id', ids);

    const byId: Record<string, any> = {};
    (profiles || []).forEach((p: any) => { byId[p.id] = p; });

    return rows.map((r: any) => {
      const p = byId[r.blocked_id];
      return {
        id: r.blocked_id,
        // Falls back rather than showing a blank row: a person who
        // deleted their account is still someone you chose to block, and
        // an empty name looks like the screen is broken.
        name: p?.business_name || p?.full_name || 'Former user',
        avatarUrl: p?.avatar_url || null,
        category: p?.category || null,
        blockedAt: r.created_at,
      };
    });
  } catch (err) {
    console.error('Could not load blocked users:', err);
    return [];
  }
}

/**
 * Formats a list of ids for PostgREST's `in` filter.
 *
 * Returns null for an empty list, which the caller must treat as "apply
 * no filter". Passing `()` to PostgREST is a syntax error, and passing
 * a filter built from an empty array is the classic way to accidentally
 * exclude everything.
 */
export function notInFilter(ids: string[]): string | null {
  if (!ids.length) return null;
  return `(${ids.join(',')})`;
}
