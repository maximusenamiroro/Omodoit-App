import { supabase } from '../api/supabase';

// Cloudflare R2 upload path for reel video.
//
// WHY VIDEO AND NOTHING ELSE
// The constraint that pushed video off Supabase is egress, not storage.
// Supabase's free plan allows 5GB of egress a month; a reel is by far
// the largest thing a user ever downloads, and every view pays for it
// again. Avatars and product images are small, cached by the client for
// a year, and account for very little of that bill, so moving them would
// add a second storage system for no real saving. R2's draw is that
// egress is free.
//
// HOW THE CREDENTIALS STAY SAFE
// The app never holds an R2 key. It asks the r2-upload-url Edge
// Function for a URL that is signed for one object and expires in
// minutes, then PUTs the bytes straight to R2. See that function for the
// full reasoning.
//
// FALLBACK IS DELIBERATE
// If the function is not deployed, or its secrets are not set, it
// answers 503 and every helper here reports "not available" so the
// caller can use Supabase Storage instead. That means this code can ship
// before the Cloudflare account exists, and the switch happens by
// setting secrets rather than by releasing a new build.

export interface R2Target {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  contentType: string;
}

// Cached for the life of the session. A user who cannot reach R2 on
// their first upload almost certainly cannot on their second, and
// re-asking costs a round trip on a connection we already know is slow.
// Reset on app restart, which is the right granularity for a
// configuration change on the server.
let r2Available: boolean | null = null;

export function resetR2Availability() {
  r2Available = null;
}

/**
 * Asks the server to sign an upload. Returns null when R2 is not
 * configured or unreachable, which the caller should treat as "use
 * Supabase Storage" rather than as an error.
 */
export async function getR2UploadTarget(
  ext: string,
  contentLength: number,
): Promise<R2Target | null> {
  if (r2Available === false) return null;

  try {
    const { data, error } = await supabase.functions.invoke('r2-upload-url', {
      body: { ext, contentLength },
    });

    if (error || !data?.uploadUrl || !data?.publicUrl) {
      // A 503 means "not configured", which is expected before the
      // Cloudflare side exists and is not worth a noisy log every time.
      r2Available = false;
      return null;
    }

    r2Available = true;
    return data as R2Target;
  } catch {
    r2Available = false;
    return null;
  }
}

/**
 * PUTs already-read bytes to R2 and returns the public URL to store in
 * the database.
 *
 * Takes an ArrayBuffer rather than a local path on purpose. The caller
 * has to read the file anyway to know its size (the signing request
 * sends contentLength), and re-reading a multi-megabyte video off disk a
 * second time is wasted work on the devices this app targets. It also
 * keeps this module free of any dependency on uploadImage.ts, which
 * imports from here — the two would otherwise form an import cycle.
 *
 * Returns null on a failed PUT rather than throwing, so the caller can
 * fall back to Supabase Storage for that upload instead of losing the
 * user's reel.
 */
export async function putToR2(
  arrayBuffer: ArrayBuffer,
  target: R2Target,
): Promise<string | null> {
  const put = await fetch(target.uploadUrl, {
    method: 'PUT',
    // Must match what was signed. R2 verifies the content type against
    // the signature, so changing it here produces a 403 that reads like
    // a credentials problem when it is really a mismatch.
    headers: { 'Content-Type': target.contentType },
    body: arrayBuffer,
  });

  if (!put.ok) {
    console.warn(`R2 upload failed (${put.status})`);
    return null;
  }

  return target.publicUrl;
}

/** True when this URL points at R2 rather than Supabase Storage. */
export function isR2Url(url?: string | null): boolean {
  if (!url) return false;
  return !url.includes('supabase.co/storage');
}

/**
 * Recovers the object key from a public R2 URL.
 *
 * Keys are `${userId}/${file}`, and the public base may be a custom
 * domain or an r2.dev address, so the last two path segments are the
 * key regardless of what precedes them.
 */
export function r2KeyFromUrl(url: string): string | null {
  try {
    const path = new URL(url).pathname.replace(/^\/+/, '');
    const parts = path.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    return parts.slice(-2).join('/');
  } catch {
    return null;
  }
}

/**
 * Deletes a reel's file from R2. Best-effort by design: the database row
 * is already gone by the time this runs, so a failure here must not look
 * to the user like the delete failed.
 *
 * It is still worth doing properly. A file that nothing references is
 * invisible and billed forever, which is how 168MB accumulated on
 * Supabase Storage before anyone noticed.
 */
export async function deleteFromR2(publicUrl: string): Promise<boolean> {
  const key = r2KeyFromUrl(publicUrl);
  if (!key) return false;

  try {
    const { data, error } = await supabase.functions.invoke('r2-upload-url', {
      body: { operation: 'delete', key },
    });
    if (error || !data?.deleteUrl) return false;

    const res = await fetch(data.deleteUrl, { method: 'DELETE' });
    // R2 answers 204 for a successful delete and for an object that was
    // already gone, which is the outcome we want either way.
    return res.status === 204 || res.ok;
  } catch (err) {
    console.warn('R2 delete failed, file may be orphaned:', err);
    return false;
  }
}
