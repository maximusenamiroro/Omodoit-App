// Agora RTC token issuer.
//
// WHY THIS EXISTS
// The app currently joins channels with an empty token, which is
// Agora's "App ID only" mode. In that mode the App ID is the only
// thing standing between a stranger and your channels — and the App ID
// ships inside the app binary, so it is not a secret. Anyone who
// extracts it can join any call on your account and spend your minutes.
//
// Token mode fixes that: the App *Certificate* signs a short-lived
// token scoped to one channel and one user. The certificate must never
// leave the server, which is why this is an Edge Function and not a
// value in src/config/agora.ts.
//
// DEPLOY
//   supabase functions deploy agora-token
//   supabase secrets set AGORA_APP_ID=<your app id>
//   supabase secrets set AGORA_APP_CERTIFICATE=<your certificate>
//
// ORDER MATTERS: deploy this and ship the client change BEFORE
// enabling the App Certificate in the Agora console. Enabling it makes
// Agora reject empty tokens immediately, so doing it first breaks every
// call in the live app.

import { RtcTokenBuilder, RtcRole } from 'npm:agora-token@2.0.5';
import { createClient } from 'jsr:@supabase/supabase-js@2';

// These are the NAMES of environment variables, not their values.
// Deno.env.get('AGORA_APP_CERTIFICATE') asks the runtime for whatever
// was stored under that name by `supabase secrets set`.
//
// Never substitute a real credential here. Putting the certificate in
// this file would commit it to the repository and defeat the entire
// reason this function exists — the certificate is the one value that
// must never leave the server.
//
// SUPABASE_URL and SUPABASE_ANON_KEY are injected automatically by the
// Edge Functions runtime; they don't need to be set by hand.
const APP_ID = Deno.env.get('AGORA_APP_ID') ?? '';
const APP_CERTIFICATE = Deno.env.get('AGORA_APP_CERTIFICATE') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

// Long enough for a real conversation, short enough that a leaked
// token is worth little. Agora refreshes on the next call anyway.
const TOKEN_TTL_SECONDS = 60 * 60;

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

  if (!APP_ID || !APP_CERTIFICATE) {
    // Fail loudly rather than handing back an empty token, which would
    // silently put the app back into insecure App-ID-only mode.
    return json({ error: 'Agora credentials not configured on the server' }, 500);
  }

  try {
    // Only signed-in users get tokens. Without this the endpoint is
    // just a public token vending machine, which defeats the point of
    // moving off App-ID-only auth in the first place.
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return json({ error: 'Missing authorization header' }, 401);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: 'Not authenticated' }, 401);

    const { channelName } = await req.json();
    if (!channelName || typeof channelName !== 'string') {
      return json({ error: 'channelName is required' }, 400);
    }

    // uid 0 lets Agora assign one. The token is bound to the channel,
    // so a token for one call cannot be replayed into another.
    const uid = 0;
    const expireAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;

    const token = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,
      APP_CERTIFICATE,
      channelName,
      uid,
      RtcRole.PUBLISHER,
      expireAt,
      expireAt,
    );

    return json({ token, uid, expiresAt: expireAt });
  } catch (err) {
    console.error('agora-token error:', err);
    return json({ error: 'Could not issue token' }, 500);
  }
});
