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
