// The website that the app's email links land on.
//
// Some auth flows finish in a browser rather than in the app: a password
// reset link has to open a page that can collect the new password, and
// the app has no such screen. Supabase sends those links to the
// project's configured Site URL unless a redirect is passed explicitly,
// which would drop a user on the homepage with a recovery token and no
// way to use it.
//
// www is the canonical host — the bare domain 308-redirects to it.
export const SITE_URL = 'https://www.omodoit.com';

// Must also be listed in the project's redirect allow-list, or Supabase
// silently falls back to the Site URL and the flow breaks again.
export const PASSWORD_RESET_URL = `${SITE_URL}/reset-password`;
