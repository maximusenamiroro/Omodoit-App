import { supabase } from '../api/supabase';

// Lightweight UUID v4 generator — not cryptographically secure (uses
// Math.random, not a CSPRNG), but doesn't need to be for this use case
// (grouping requests from one Flash Job submission as a uuid column).
// Avoids adding a uuid dependency for this one need.
export function generateBatchId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Retries an insert/upsert a few times with a short backoff. Used for
// steps that run AFTER some other record already exists (e.g. inserting
// a profile row right after creating the auth account) — a transient
// network blip at that point shouldn't be treated as a hard failure,
// since the alternative (silently giving up) can leave a real account
// with no matching profile and no way for the user to fix it themselves.
export async function upsertWithRetry(
  table: string,
  payload: Record<string, any>,
  attempts = 3,
): Promise<{ error: any }> {
  let lastError: any = null;
  for (let i = 0; i < attempts; i++) {
    const { error } = await supabase.from(table).upsert(payload);
    if (!error) return { error: null };
    lastError = error;
    if (i < attempts - 1) {
      await new Promise<void>(resolve => setTimeout(resolve, 600 * (i + 1)));
    }
  }
  return { error: lastError };
}

export type RespondResult =
  | { ok: true }
  | { ok: false; reason: 'taken' }
  | { ok: false; reason: 'error'; error: any };

// Shared by WorkstationScreen and FlashJobInboxScreen — a worker
// accepting/declining a booking request. Kept in one place so a fix
// here (e.g. to the race-condition handling) applies everywhere this
// is used, instead of two copies quietly drifting apart.
export async function respondToBookingRequest(
  bookingId: string,
  newStatus: 'accepted' | 'declined',
  clientId: string,
  workerName: string,
  workerId: string,
): Promise<RespondResult> {
  try {
    // WHERE status='pending' makes this atomic against two workers
    // both tapping Accept on the same Flash Job request at nearly the
    // same time — Postgres processes each row's UPDATE individually,
    // so whichever lands first flips the row away from 'pending'; the
    // second one then matches zero rows instead of succeeding twice.
    const { data: updateResult, error } = await supabase
      .from('hire_requests')
      .update({ status: newStatus })
      .eq('id', bookingId)
      .eq('status', 'pending')
      .select('id, flash_batch_id')
      .maybeSingle();

    if (error) throw error;
    if (!updateResult) return { ok: false, reason: 'taken' };

    // Part of a Flash Job broadcast — the other workers' pending
    // requests for the same job are no longer relevant now that
    // someone has accepted. Mark them expired instead of leaving them
    // sitting as actionable-looking pending requests forever.
    if (newStatus === 'accepted' && updateResult.flash_batch_id) {
      try {
        await supabase
          .from('hire_requests')
          .update({ status: 'expired' })
          .eq('flash_batch_id', updateResult.flash_batch_id)
          .eq('status', 'pending')
          .neq('id', bookingId);
      } catch (expireErr) {
        console.warn('Could not expire sibling flash job requests (non-fatal):', expireErr);
      }
    }

    // Best-effort notification — if the notifications table/columns
    // don't match, the status change itself already succeeded, so
    // this failing shouldn't surface as an error to the worker.
    try {
      await supabase.from('notifications').insert({
        user_id: clientId,
        type: 'booking',
        message: `${workerName || 'The worker'} ${newStatus === 'accepted' ? 'accepted' : 'declined'} your booking request`,
        from_user_id: workerId,
        booking_id: bookingId,
        is_read: false,
      });
    } catch (notifErr) {
      console.warn('Could not create notification (non-fatal):', notifErr);
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, reason: 'error', error };
  }
}
