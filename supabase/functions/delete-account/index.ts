// Permanently deletes the signed-in user's account.
//
// WHY THIS EXISTS
// Apple's Guideline 5.1.1(v) requires that an app offering account
// creation also offers account deletion *inside the app*. Omodoit's
// Settings screen had a Delete Account button that opened an alert
// telling people to email support, which is the exact pattern Apple
// rejects — and deleting the test account is a standard step in their
// review, so it would have been found immediately.
//
// WHY A FUNCTION
// A client cannot delete its own auth user; that needs the service role
// key, which must never ship inside an app. So the app calls this, and
// this does the work with a key that stays on the server.
//
// WHAT THE SCHEMA DICTATED
// Mapping the foreign keys first changed the design three times:
//
//   * 28 tables cascade from profiles — reels, messages, comments,
//     reviews, follows, likes and the rest all disappear when the
//     profile row goes. Deleting them by hand would be 28 chances to
//     miss one as the schema grows.
//
//   * orders.user_id and hire_requests.client_id are ON DELETE NO
//     ACTION, so they *block* the profile delete outright. A user with
//     any transaction history simply could not be deleted. Both columns
//     are nullable, so they are detached instead of destroyed: the
//     worker on the other side keeps their record of a job that really
//     happened, while it no longer identifies the person who left.
//
//   * profiles does NOT cascade from auth.users. Removing the auth user
//     alone would leave the profile row behind, still visible to
//     everyone. Both have to be deleted, in that order.
//
//   * nothing cascades to storage. Cascades clear rows, not files, so
//     the media has to be collected BEFORE the rows are deleted or the
//     URLs are gone and the videos are orphaned forever — on R2 that is
//     a bill for content nobody can reach.
//
// DEPLOY
//   supabase functions deploy delete-account
// It reuses the R2 secrets already set for r2-upload-url.

import { AwsClient } from 'npm:aws4fetch@1.0.20';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID') ?? '';
const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID') ?? '';
const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY') ?? '';
const R2_BUCKET = Deno.env.get('R2_BUCKET') ?? '';
const R2_JURISDICTION = (Deno.env.get('R2_JURISDICTION') ?? '').trim().toLowerCase();
const R2_HOST = `${R2_ACCOUNT_ID}.${R2_JURISDICTION ? R2_JURISDICTION + '.' : ''}r2.cloudflarestorage.com`;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

/** Storage path inside a Supabase bucket, or null if not one of ours. */
function supabasePath(url: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return decodeURIComponent(url.slice(i + marker.length).split('?')[0]);
}

/** Object key inside R2, or null. Keys are `${userId}/${file}`. */
function r2Key(url: string): string | null {
  try {
    if (url.includes('supabase.co/storage')) return null;
    const parts = new URL(url).pathname.replace(/^\/+/, '').split('/').filter(Boolean);
    return parts.length >= 2 ? parts.slice(-2).join('/') : null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (!SERVICE_ROLE_KEY) return json({ error: 'Server is not configured for deletion' }, 503);

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Missing authorization header' }, 401);

    // Identify the caller from their own token. The id is never taken
    // from the request body — that would let anyone delete anyone.
    const asUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await asUser.auth.getUser();
    if (authError || !user) return json({ error: 'Not authenticated' }, 401);
    const uid = user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── 1. Collect media while the rows still exist ──────────
    const [reelsRes, productsRes, profileRes] = await Promise.all([
      admin.from('reels').select('video_url, thumbnail_url').eq('user_id', uid),
      admin.from('products').select('image_url, video_url').eq('worker_id', uid),
      admin.from('profiles').select('avatar_url').eq('id', uid).maybeSingle(),
    ]);

    const urls: string[] = [
      ...(reelsRes.data ?? []).flatMap((r: any) => [r.video_url, r.thumbnail_url]),
      ...(productsRes.data ?? []).flatMap((p: any) => [p.image_url, p.video_url]),
      profileRes.data?.avatar_url,
    ].filter(Boolean) as string[];

    // ── 2. Remove the files ─────────────────────────────────
    // Best-effort throughout. A storage hiccup must not stop the
    // deletion: the person asked to be gone, and leaving their account
    // intact because one thumbnail refused to delete is the wrong
    // trade. Anything stranded is reported back for cleanup.
    let filesDeleted = 0;
    const stranded: string[] = [];

    const byBucket: Record<string, string[]> = { reels: [], products: [], avatars: [], messages: [] };
    const r2Keys: string[] = [];
    for (const url of urls) {
      const key = r2Key(url);
      if (key) { r2Keys.push(key); continue; }
      for (const bucket of Object.keys(byBucket)) {
        const path = supabasePath(url, bucket);
        if (path) { byBucket[bucket].push(path); break; }
      }
    }

    for (const [bucket, paths] of Object.entries(byBucket)) {
      if (!paths.length) continue;
      const { error } = await admin.storage.from(bucket).remove(paths);
      if (error) { stranded.push(...paths.map(p => `${bucket}/${p}`)); }
      else filesDeleted += paths.length;
    }

    if (r2Keys.length && R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET) {
      const r2 = new AwsClient({
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
        region: 'auto',
        service: 's3',
      });
      for (const key of r2Keys) {
        // Belt and braces: these keys came from this user's own rows,
        // but a mangled URL must never let this delete outside their
        // prefix while holding credentials that could.
        if (!key.startsWith(`${uid}/`)) { stranded.push(`r2/${key}`); continue; }
        try {
          const res = await r2.fetch(`https://${R2_HOST}/${R2_BUCKET}/${key}`, { method: 'DELETE' });
          if (res.status === 204 || res.ok) filesDeleted++;
          else stranded.push(`r2/${key}`);
        } catch { stranded.push(`r2/${key}`); }
      }
    } else if (r2Keys.length) {
      stranded.push(...r2Keys.map(k => `r2/${k}`));
    }

    // ── 3. Detach transaction records ───────────────────────
    // These block the profile delete, and destroying them would erase
    // the counterparty's history of work they really did.
    await admin.from('orders').update({ user_id: null }).eq('user_id', uid);
    await admin.from('hire_requests').update({ client_id: null }).eq('client_id', uid);

    // ── 4. Delete the profile — 28 tables cascade from here ──
    const { error: profileErr } = await admin.from('profiles').delete().eq('id', uid);
    if (profileErr) {
      console.error('Profile delete failed:', profileErr);
      return json({ error: 'Could not delete your data. Please contact support.' }, 500);
    }

    // ── 5. Delete the auth user ─────────────────────────────
    // Last, because profiles does not cascade from auth.users: doing
    // this first would leave the profile row orphaned and still public.
    const { error: authErr } = await admin.auth.admin.deleteUser(uid);
    if (authErr) {
      // The data is already gone, so the account is unusable either way.
      // Reported rather than hidden so support can finish the job.
      console.error('Auth user delete failed after data removal:', authErr);
      return json({
        error: 'Your data was deleted but the sign-in could not be removed. Please contact support@omodoit.com.',
        partial: true,
      }, 500);
    }

    if (stranded.length) console.warn('Files left behind for user', uid, stranded);
    return json({ deleted: true, filesDeleted, stranded: stranded.length });
  } catch (err) {
    console.error('delete-account failed:', err);
    return json({ error: 'Could not delete your account. Please try again.' }, 500);
  }
});
