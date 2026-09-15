// "You have a new message" email, sent through Resend.
//
// WHY THIS EXISTS
// In-app notifications only reach someone who has the app open. A
// worker who misses a message because they were not looking at their
// phone loses the job to whoever answered first, so the one thing worth
// interrupting someone's day for is a message from a real person.
//
// WHY IT THROTTLES
// A conversation is not one message, it is ten. Emailing on every insert
// would send ten emails for one exchange — the fastest way to get a
// sending domain marked as spam, and the fastest way to get users to
// mute the emails entirely. One email per sender per THROTTLE_MINUTES;
// the rest of the conversation is silent, and the email says "open the
// app" rather than trying to be the conversation.
//
// WIRING
//   supabase functions deploy message-email --no-verify-jwt
//   supabase secrets set RESEND_API_KEY=<your resend key>
//   supabase secrets set MAIL_FROM="Omodoit <notifications@yourdomain.com>"
//
// Then in the Supabase dashboard: Database -> Webhooks -> Create,
// table `messages`, event INSERT, type "Supabase Edge Functions",
// pick this function. That template sends the service role key as the
// Authorization header, which is what the check below expects.
//
// --no-verify-jwt is required and is NOT the same as unauthenticated:
// the caller is Postgres, which has no user JWT to present, so the
// gateway check is replaced by the shared-secret check below.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const MAIL_FROM = Deno.env.get('MAIL_FROM') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// Where the "open the app" link points. Falls back to the site root.
const APP_URL = Deno.env.get('APP_URL') ?? 'https://omodoit.com';

// One email per sender, per recipient, per this many minutes.
const THROTTLE_MINUTES = 30;

// Message previews are deliberately short. The email is a nudge to open
// the app, not a copy of the conversation — full text in an inbox means
// a private conversation sitting in a third party's mail logs.
const PREVIEW_MAX = 80;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

// Compares in constant time. A plain === leaks how much of the secret
// matched through how long the comparison took.
function secretsMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function previewFor(record: Record<string, unknown>): string {
  const type = String(record.message_type ?? 'text');
  if (type === 'image') return 'Sent you a photo';
  if (type === 'video') return 'Sent you a video';
  if (type === 'audio') return 'Sent you a voice message';
  if (type === 'file') return 'Sent you a file';

  const text = String(record.text ?? '').trim();
  if (!text) return 'Sent you a message';
  return text.length > PREVIEW_MAX ? text.slice(0, PREVIEW_MAX) + '…' : text;
}

// Anything interpolated into the HTML below is user-controlled — a
// display name or something they typed. Escaped so a message body
// cannot inject markup into an email.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  // Credentials first, so a misconfigured deploy fails loudly here
  // rather than silently never sending anything.
  if (!RESEND_API_KEY || !MAIL_FROM || !SERVICE_ROLE_KEY) {
    console.error('message-email is missing RESEND_API_KEY, MAIL_FROM or the service role key');
    return json({ error: 'not configured' }, 500);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!secretsMatch(authHeader, `Bearer ${SERVICE_ROLE_KEY}`)) {
    return json({ error: 'unauthorized' }, 401);
  }

  let payload: { type?: string; record?: Record<string, unknown> };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'invalid body' }, 400);
  }

  const record = payload.record;
  if (payload.type !== 'INSERT' || !record) return json({ skipped: 'not an insert' });

  const senderId = String(record.sender_id ?? '');
  const recipientId = String(record.receiver_id ?? '');
  if (!senderId || !recipientId || senderId === recipientId) {
    return json({ skipped: 'nothing to notify' });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Throttle before doing any other work: the common case for a busy
  // conversation is that we send nothing, and that path should be cheap.
  const cutoff = new Date(Date.now() - THROTTLE_MINUTES * 60 * 1000).toISOString();
  const { data: existing, error: throttleErr } = await supabase
    .from('email_throttle')
    .select('last_sent_at')
    .eq('user_id', recipientId)
    .eq('kind', 'message')
    .eq('subject_key', senderId)
    .maybeSingle();

  if (throttleErr) {
    console.error('Throttle lookup failed:', throttleErr.message);
    return json({ error: 'throttle lookup failed' }, 500);
  }
  if (existing && existing.last_sent_at > cutoff) {
    return json({ skipped: 'throttled' });
  }

  // Recipient's address lives in auth.users, which only the service role
  // can read. getUserById also tells us whether they ever confirmed it —
  // sending to an unconfirmed address is how a sending reputation dies.
  const { data: recipient, error: recipientErr } =
    await supabase.auth.admin.getUserById(recipientId);
  if (recipientErr || !recipient?.user?.email) {
    console.error('Could not resolve recipient:', recipientErr?.message);
    return json({ skipped: 'no recipient address' });
  }
  if (!recipient.user.email_confirmed_at) {
    return json({ skipped: 'address not confirmed' });
  }

  const { data: senderProfile } = await supabase
    .from('profiles')
    .select('full_name, business_name')
    .eq('id', senderId)
    .maybeSingle();

  const senderName = escapeHtml(
    senderProfile?.business_name || senderProfile?.full_name || 'Someone',
  );
  const preview = escapeHtml(previewFor(record));

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="margin:0 0 4px;font-size:18px;color:#111">New message from ${senderName}</h2>
      <p style="margin:0 0 20px;color:#666;font-size:14px">on Omodoit</p>
      <div style="background:#f5f5f5;border-radius:12px;padding:16px;margin-bottom:24px">
        <p style="margin:0;color:#333;font-size:15px;line-height:1.5">${preview}</p>
      </div>
      <a href="${APP_URL}/inbox"
         style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;font-size:15px">
        Open Omodoit
      </a>
      <p style="margin:28px 0 0;color:#999;font-size:12px;line-height:1.5">
        You get at most one of these every ${THROTTLE_MINUTES} minutes per person,
        however many messages they send.
      </p>
    </div>`;

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: MAIL_FROM,
      to: recipient.user.email,
      subject: `New message from ${senderProfile?.business_name || senderProfile?.full_name || 'someone'} on Omodoit`,
      html,
    }),
  });

  if (!resendResponse.ok) {
    const detail = await resendResponse.text();
    console.error('Resend rejected the send:', resendResponse.status, detail);
    // Deliberately not recording a send here: a failed attempt should
    // not silence the next message for half an hour.
    return json({ error: 'send failed' }, 502);
  }

  const { error: recordErr } = await supabase
    .from('email_throttle')
    .upsert({
      user_id: recipientId,
      kind: 'message',
      subject_key: senderId,
      last_sent_at: new Date().toISOString(),
      send_count: (existing ? 1 : 0) + 1,
    }, { onConflict: 'user_id,kind,subject_key' });

  if (recordErr) {
    // The email is already gone. Log loudly — an un-recorded send means
    // the next message will email them again inside the window.
    console.error('Sent but failed to record throttle:', recordErr.message);
  }

  return json({ sent: true });
});
