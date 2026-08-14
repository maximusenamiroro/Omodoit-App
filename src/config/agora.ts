// Get your App ID from https://console.agora.io — create a free
// account, create a project, and copy the App ID here. Agora's free
// tier includes 10,000 minutes/month, which comfortably covers early
// usage at zero cost.
//
// SECURITY NOTE — read before going to production:
// This uses Agora's "App ID only" authentication, which works without
// a token server and is fine for development/testing. Agora strongly
// recommends switching to token-based authentication before a real
// public launch — otherwise anyone with your App ID could technically
// join any call channel. Token generation requires a small backend
// endpoint (e.g. a Supabase Edge Function) using your App Certificate,
// which must NEVER be embedded in the app itself. This is a deliberate
// scope boundary: wiring that up is a real backend task, not something
// to fake or skip past silently.
// Annotated as string rather than left to infer a literal type. Without
// this, TypeScript narrows it to its exact value and the "did you
// forget to configure Agora?" guard in calling.ts becomes a comparison
// between two non-overlapping literals — a compile error, even though
// the check is exactly what we want at runtime.
export const AGORA_APP_ID: string = '314b40cdcc994d7bb349b33e562b4bd0';
