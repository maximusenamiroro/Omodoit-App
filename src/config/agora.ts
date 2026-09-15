// Get your App ID from https://console.agora.io — create a free
// account, create a project, and copy the App ID here. Agora's free
// tier includes 10,000 minutes/month, which comfortably covers early
// usage at zero cost.
//
// The App ID is not a secret — it ships inside the app binary and can
// be read out of it. What protects your channels is the App Certificate,
// which signs a short-lived token per channel and per user. That lives
// only in Supabase secrets and is used by the agora-token Edge Function;
// it must never appear in this file or anywhere else in the repo.
//
// calling.ts fetches a token from that function before every join, and
// falls back to an empty token if the fetch fails. That fallback dates
// from before the certificate existed, when an empty token was a valid
// join argument. It no longer is: with the certificate enabled, Agora
// rejects an empty token, so the fallback now produces a failed join
// rather than a degraded one. See the note above fetchAgoraToken.
// Annotated as string rather than left to infer a literal type. Without
// this, TypeScript narrows it to its exact value and the "did you
// forget to configure Agora?" guard in calling.ts becomes a comparison
// between two non-overlapping literals — a compile error, even though
// the check is exactly what we want at runtime.
export const AGORA_APP_ID: string = '314b40cdcc994d7bb349b33e562b4bd0';
