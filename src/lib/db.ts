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
// Takes only what it needs. clientId/workerName/workerId used to be
// passed in solely to compose a notification here — that now comes
// from the on_booking_update database trigger, so requiring callers to
// thread three extra values through is just noise they can get wrong.
export async function respondToBookingRequest(
  bookingId: string,
  newStatus: 'accepted' | 'declined',
): Promise<RespondResult> {
  try {
    if (newStatus === 'accepted') {
      // Accepting goes through the database function, which decides the
      // winner of a Flash Job in ONE transaction and expires the losers.
      //
      // The previous approach here was `.eq('status','pending')` on the
      // update, with a comment claiming that made it atomic against two
      // workers accepting the same flash job. It doesn't: a Flash Job
      // creates a SEPARATE row per worker, so each worker's own row is
      // independently 'pending' and every one of those updates
      // succeeds. Every worker won, and the client got the whole batch
      // arriving at one address. The guard only ever protected against
      // the same worker double-tapping one request.
      const { data: result, error } = await supabase.rpc('accept_hire_request', {
        request_id: bookingId,
      });

      if (error) throw error;
      if (result === 'taken') return { ok: false, reason: 'taken' };
      if (result !== 'accepted') {
        // 'forbidden', 'not_found', or an already-decided status.
        return { ok: false, reason: 'error', error: new Error(String(result)) };
      }
    } else {
      // Declining needs no coordination — it just frees the job for
      // whoever else still holds a pending row in the same batch.
      // Writes 'rejected', matching what the rest of the platform
      // stores; this used to write 'declined', a value no status
      // filter or colour map anywhere recognises.
      const { data: updateResult, error } = await supabase
        .from('hire_requests')
        .update({ status: 'rejected' })
        .eq('id', bookingId)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!updateResult) return { ok: false, reason: 'taken' };
    }

    // No notification is created here on purpose. The database has an
    // on_booking_update trigger that already notifies the client on
    // every status change — inserting one here too meant the client
    // got the same message twice for every accept and decline. The
    // trigger is the better place for it: it also covers status
    // changes made from the website, which this code path never sees.
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: 'error', error };
  }
}
