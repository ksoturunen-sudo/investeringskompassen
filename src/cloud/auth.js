// Inloggning med Google via Supabase Auth (OAuth 2.0 authorization code + PKCE).
// Flödet följer Supabase egen klient (auth-js): /authorize → ?code= → /token?grant_type=pkce.
import { SUPABASE_KEY, SUPABASE_URL } from './config.js';

const SESSION_KEY = 'ik.v2.session';
const VERIFIER_KEY = 'ik.v2.pkce';
const AUTH = `${SUPABASE_URL}/auth/v1`;

const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function readSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
}
function writeSession(s) {
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s)); else localStorage.removeItem(SESSION_KEY);
}

async function tokenRequest(grant, body) {
  const res = await fetch(`${AUTH}/token?grant_type=${grant}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error_description || data.msg || 'Inloggningen misslyckades.');
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    user: { id: data.user?.id, email: data.user?.email },
  };
}

/** Skickar användaren till Googles inloggning. */
export async function signInWithGoogle() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  const redirectTo = `${location.origin}${location.pathname}`;
  const params = new URLSearchParams({
    provider: 'google', redirect_to: redirectTo, code_challenge: challenge, code_challenge_method: 's256',
  });
  location.assign(`${AUTH}/authorize?${params}`);
}

/** Körs vid start: tar emot ?code= efter inloggning. Returnerar felmeddelande eller null. */
export async function handleRedirect() {
  const url = new URL(location.href);
  const code = url.searchParams.get('code');
  const err = url.searchParams.get('error_description');
  if (!code && !err) return null;
  url.searchParams.delete('code'); url.searchParams.delete('error'); url.searchParams.delete('error_description'); url.searchParams.delete('error_code');
  history.replaceState(null, '', url.pathname + (url.search ? url.search : '') + (url.hash || '#settings'));
  if (err) return err;
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
  if (!verifier) return 'Inloggningen kunde inte slutföras (saknar kontrollkod). Försök igen.';
  try {
    writeSession(await tokenRequest('pkce', { auth_code: code, code_verifier: verifier }));
    return null;
  } catch (e) {
    return e.message;
  }
}

export function currentUser() {
  return readSession()?.user ?? null;
}

/** Giltig åtkomsttoken, förnyas automatiskt. Null om utloggad. */
export async function getAccessToken() {
  const s = readSession();
  if (!s) return null;
  if (s.expiresAt - Date.now() > 60_000) return s.accessToken;
  try {
    const fresh = await tokenRequest('refresh_token', { refresh_token: s.refreshToken });
    writeSession(fresh);
    return fresh.accessToken;
  } catch {
    writeSession(null);
    return null;
  }
}

export async function signOut() {
  const token = readSession()?.accessToken;
  writeSession(null);
  if (token) {
    await fetch(`${AUTH}/logout`, { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` } }).catch(() => {});
  }
}

/** Anrop mot Supabase med inloggad användare. */
export async function authedFetch(path, init = {}) {
  const token = await getAccessToken();
  if (!token) throw new Error('Du är inte inloggad.');
  return fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
  });
}
