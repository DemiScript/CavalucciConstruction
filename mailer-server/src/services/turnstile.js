// Server-side check of a Cloudflare Turnstile token. The browser widget only
// produces a token; it is worthless until Cloudflare confirms it here.
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const REQUEST_TIMEOUT_MS = 5000;

// Returns true when the visitor may proceed.
//  - No secret configured: skipped (logged), so a missing env var can't take the
//    form down. Set TURNSTILE_SECRET_KEY in production to enforce it.
//  - Cloudflare unreachable: allowed through (logged) — an outage on their side
//    shouldn't cost us leads, and a bot can't cause one.
//  - Cloudflare says the token is bad or missing: rejected.
export async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.warn('TURNSTILE_SECRET_KEY is not set — skipping bot verification.');
    return true;
  }
  if (!token) return false;

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set('remoteip', ip);

    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const data = await res.json();
    if (!data.success) {
      console.warn(
        JSON.stringify({ event: 'turnstile_failed', codes: data['error-codes'] || [] })
      );
    }
    return data.success === true;
  } catch (err) {
    console.warn(JSON.stringify({ event: 'turnstile_unreachable', error: err.message }));
    return true;
  }
}
