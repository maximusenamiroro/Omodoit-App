// Issues a short-lived presigned PUT URL for Cloudflare R2.
//
// WHY THIS EXISTS
// Reel video is the only part of Omodoit that will not fit on Supabase's
// free tier, and storage is not the reason — egress is. Measured on
// 2026-08-20 the database was using 16MB of its 500MB and storage 422MB
// of 1GB, both comfortable. But the free plan allows 5GB of egress a
// month, and at the average published reel size that worked out to a few
// hundred video views a month across the entire app. R2 charges nothing
// for egress, which is precisely the bill that was going to hurt.
//
// So: Postgres, auth, realtime and the small images stay on Supabase.
// Reel video moves here.
//
// WHY A FUNCTION AND NOT A DIRECT UPLOAD
// Uploading to R2 requires an access key pair that can write to the
// bucket. Anything shipped inside the app binary is readable by anyone
// who downloads the app, so putting those keys in the client would hand
// every user write access to the bucket. Instead the keys stay in
// `supabase secrets`, this function signs a URL that is good for one
// object for a few minutes, and the app uploads straight to R2 with it.
// The bytes never pass through this function, so a large video does not
// have to fit in an Edge Function's memory or time limit.
//
// DEPLOY
//   supabase functions deploy r2-upload-url
//   supabase secrets set R2_ACCOUNT_ID=<cloudflare account id>
//   supabase secrets set R2_ACCESS_KEY_ID=<r2 token access key id>
//   supabase secrets set R2_SECRET_ACCESS_KEY=<r2 token secret>
//   supabase secrets set R2_BUCKET=<bucket name>
//   supabase secrets set R2_PUBLIC_BASE_URL=https://media.yourdomain.com
//
// R2_PUBLIC_BASE_URL is where the world reads the file from — a custom
// domain on the bucket, or the bucket's r2.dev address. It must be the
// PUBLIC address, not the S3 API endpoint that gets signed below; those
// are two different hostnames and mixing them up produces URLs that sign
// correctly and 404 for users.

import { AwsClient } from 'npm:aws4fetch@1.0.20';
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Names of environment variables, not values. Never paste a real key
// into this file: it would be committed to the repository and undo the
// entire reason the upload is brokered here instead of done directly.
const ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID') ?? '';
const ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID') ?? '';
const SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY') ?? '';
const BUCKET = Deno.env.get('R2_BUCKET') ?? '';
const PUBLIC_BASE_URL = (Deno.env.get('R2_PUBLIC_BASE_URL') ?? '').replace(/\/+$/, '');
// Empty for a normal bucket, 'eu' for one created with the EU
// jurisdictional restriction.
const JURISDICTION = (Deno.env.get('R2_JURISDICTION') ?? '').trim().toLowerCase();

// A bucket with a jurisdictional restriction is NOT reachable on the
// default S3 endpoint. It answers 403 AccessDenied there, which is
// indistinguishable from a permissions problem and cost real time to
// diagnose: the same credentials that fail on the default host succeed
// on the jurisdiction host. omodoit-reels is an EU bucket.
//
// The signing region stays 'auto' either way — using 'eu' is rejected
// with InvalidRegionName.
//
// https://developers.cloudflare.com/r2/reference/data-location/
const S3_HOST = `${ACCOUNT_ID}.${JURISDICTION ? JURISDICTION + '.' : ''}r2.cloudflarestorage.com`;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

// Long enough to upload a few megabytes on a slow Nigerian mobile
// connection, short enough that a leaked URL is worth little. It grants
// write access to exactly one object key and nothing else.
const SIGNED_URL_TTL_SECONDS = 15 * 60;

// The app compresses to 720p30 before uploading, which lands a typical
// reel around 2-3MB. This is a backstop against a device where
// compression failed and the original went up instead: without it one
// user's 45MB clip is 45MB of storage and 45MB of egress on every view.
const MAX_UPLOAD_BYTES = 60 * 1024 * 1024;

const ALLOWED = new Map<string, string>([
  ['mp4', 'video/mp4'],
  ['mov', 'video/quicktime'],
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
]);

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  // Fail loudly rather than falling back to something insecure. The
  // client treats a non-200 here as "R2 not available" and uses Supabase
  // Storage instead, so a misconfigured deploy degrades to the old
  // behaviour rather than losing a user's upload.
  if (!ACCOUNT_ID || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY || !BUCKET || !PUBLIC_BASE_URL) {
    return json({ error: 'R2 is not configured on the server' }, 503);
  }

  try {
    // Only signed-in users get a signed URL. Without this the endpoint
    // is an open write handle to the bucket for anyone who finds it.
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return json({ error: 'Missing authorization header' }, 401);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: 'Not authenticated' }, 401);

    const body = await req.json().catch(() => ({}));
    const { ext, contentLength, operation, key: requestedKey } = body;

    const r2 = new AwsClient({
      accessKeyId: ACCESS_KEY_ID,
      secretAccessKey: SECRET_ACCESS_KEY,
      // R2 is S3-compatible but has no regions; 'auto' is what it
      // expects and any real region name makes the signature invalid.
      region: 'auto',
      service: 's3',
    });

    // Deleting a reel has to remove the video too. The app cannot hold
    // an R2 key, so it asks for a signed DELETE the same way it asks for
    // a signed PUT.
    //
    // Without this the object simply leaks: the row goes, the file
    // stays, and nothing ever points at it again. That already happened
    // on Supabase Storage — an audit on 2026-08-20 found 168MB of files
    // no column referenced — and on R2 those bytes are billed.
    if (operation === 'delete') {
      if (typeof requestedKey !== 'string' || !requestedKey) {
        return json({ error: 'key is required to delete' }, 400);
      }
      // Path traversal is refused for everyone, owner and admin alike.
      if (requestedKey.includes('..')) {
        return json({ error: 'Not permitted to delete that object' }, 403);
      }

      // Keys are written as `${user.id}/...` at upload time, so ordinary
      // callers may delete inside their own prefix and nowhere else.
      // Without that, any signed-in user could empty the bucket one
      // object at a time.
      //
      // Moderators are the deliberate exception. Apple's Guideline 1.2
      // asks not just for a report button but for reports to be acted
      // on, and "actioned" has to mean the video comes down — a queue
      // that only records opinions is not moderation. An admin has no
      // prefix of their own to delete from, so ownership alone cannot
      // express this.
      //
      // is_admin is read from the database on every call rather than
      // trusted from the token, and migration 019 makes that column
      // non-writable by the account itself, so this cannot be
      // self-granted.
      if (!requestedKey.startsWith(`${user.id}/`)) {
        const { data: me } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .maybeSingle();
        if (!me?.is_admin) {
          return json({ error: 'Not permitted to delete that object' }, 403);
        }
        console.log(`moderation delete by admin ${user.id}: ${requestedKey}`);
      }

      const delUrl = new URL(
        `https://${S3_HOST}/${BUCKET}/${requestedKey}`,
      );
      delUrl.searchParams.set('X-Amz-Expires', String(SIGNED_URL_TTL_SECONDS));
      const signedDelete = await r2.sign(delUrl, {
        method: 'DELETE',
        aws: { signQuery: true },
      });
      return json({ deleteUrl: signedDelete.url, key: requestedKey });
    }

    const cleanExt = String(ext ?? 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '');
    const contentType = ALLOWED.get(cleanExt);
    if (!contentType) {
      return json({ error: `Unsupported file type: ${cleanExt}` }, 400);
    }
    if (typeof contentLength === 'number' && contentLength > MAX_UPLOAD_BYTES) {
      return json({
        error: `File is too large (${Math.round(contentLength / 1024 / 1024)}MB). ` +
               `The limit is ${MAX_UPLOAD_BYTES / 1024 / 1024}MB.`,
      }, 413);
    }

    // The key is derived from the authenticated user id, never from
    // anything the caller sent. A caller-supplied path would let one
    // user write over another user's video by asking for their key.
    const key = `${user.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${cleanExt}`;

    const endpoint = new URL(
      `https://${S3_HOST}/${BUCKET}/${key}`,
    );
    endpoint.searchParams.set('X-Amz-Expires', String(SIGNED_URL_TTL_SECONDS));

    // signQuery puts the signature in the query string instead of an
    // Authorization header, which is what makes the URL usable by a
    // plain PUT from the app with no credentials of its own.
    const signed = await r2.sign(endpoint, {
      method: 'PUT',
      aws: { signQuery: true },
    });

    return json({
      uploadUrl: signed.url,
      // What goes in the database and what every viewer will fetch.
      publicUrl: `${PUBLIC_BASE_URL}/${key}`,
      key,
      contentType,
      expiresIn: SIGNED_URL_TTL_SECONDS,
    });
  } catch (err) {
    console.error('r2-upload-url failed:', err);
    return json({ error: 'Could not create upload URL' }, 500);
  }
});
