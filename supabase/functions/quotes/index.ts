// Kurstjänst för Investeringskompassen (Supabase Edge Function).
// Kontrakt: contracts/price-provider.md. Hämtar dagskurser från EODHD, cachar dem i databasen
// och räknar om till SEK. API-nyckeln (EODHD_API_KEY) finns bara här, aldrig i appen.
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const ALLOWED_ORIGINS = ['https://ksoturunen-sudo.github.io', 'http://localhost:8080', 'http://127.0.0.1:8080'];
const EODHD = 'https://eodhd.com/api';
const DAILY_LIMIT = Number(Deno.env.get('EODHD_DAILY_LIMIT') ?? '20');
const HISTORY_DAYS = 400;
const NOT_FOUND_RETRY_DAYS = 7;
const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
const SYMBOL_RE = /^[A-Za-z0-9._-]{1,40}$/;

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

function cors(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

class QuotaError extends Error {}

async function eodhd(path: string, params: Record<string, string> = {}) {
  const { data: ok, error } = await admin.rpc('ik_take_api_call', { p_limit: DAILY_LIMIT });
  if (error) throw new Error(`Kunde inte räkna API-anrop: ${error.message}`);
  if (!ok) throw new QuotaError('Dagens kvot hos kurskällan är förbrukad. Fler kurser hämtas i morgon.');
  const key = Deno.env.get('EODHD_API_KEY');
  if (!key) throw new Error('EODHD_API_KEY saknas på servern.');
  const qs = new URLSearchParams({ ...params, api_token: key, fmt: 'json' });
  const res = await fetch(`${EODHD}/${path}?${qs}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Kurskällan svarade ${res.status} för ${path.split('/')[0]}`);
  return res.json();
}

type Inst = { isin: string; symbol: string | null; name: string | null; type: string | null; currency: string | null };

async function resolveIsin(isin: string): Promise<Inst> {
  const { data } = await admin.from('ik_instruments').select('*').eq('isin', isin).maybeSingle();
  const stale = data && !data.symbol && Date.parse(data.looked_up_at) < Date.now() - NOT_FOUND_RETRY_DAYS * 86400000;
  if (data && !stale) return data;
  const hits = (await eodhd(`search/${isin}`, { limit: '10' })) ?? [];
  const list = Array.isArray(hits) ? hits.filter((h) => !h.ISIN || h.ISIN === isin) : [];
  // Föredra svensk notering, sedan primärnotering, sedan första träffen.
  const pick = list.find((h) => h.Exchange === 'ST') ?? list.find((h) => h.isPrimary) ?? list[0];
  const row: Inst = pick
    ? { isin, symbol: `${pick.Code}.${pick.Exchange}`, name: pick.Name ?? null, type: pick.Type ?? null, currency: pick.Currency ?? null }
    : { isin, symbol: null, name: null, type: null, currency: null };
  await admin.from('ik_instruments').upsert({ ...row, looked_up_at: new Date().toISOString() });
  return row;
}

/** Ser till att kurshistoriken för en symbol är uppdaterad till idag (max ett API-anrop per dag). */
async function refreshSymbol(symbol: string) {
  const { data: status } = await admin.from('ik_price_status').select('fetched_on').eq('symbol', symbol).maybeSingle();
  if (status?.fetched_on === today()) return;
  const { data: last } = await admin.from('ik_prices').select('date').eq('symbol', symbol).order('date', { ascending: false }).limit(1).maybeSingle();
  const from = last ? last.date : daysAgo(HISTORY_DAYS);
  const rows = (await eodhd(`eod/${symbol}`, { from })) ?? [];
  if (Array.isArray(rows) && rows.length) {
    const clean = rows
      .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date) && Number.isFinite(Number(r.close)))
      .map((r) => ({ symbol, date: r.date, close: Number(r.close) }));
    for (let i = 0; i < clean.length; i += 500) await admin.from('ik_prices').upsert(clean.slice(i, i + 500));
  }
  await admin.from('ik_price_status').upsert({ symbol, fetched_on: today() });
}

async function series(symbol: string, from: string): Promise<[string, number][]> {
  const out: [string, number][] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.from('ik_prices').select('date, close').eq('symbol', symbol)
      .gte('date', from).order('date').range(offset, offset + 999);
    if (error) throw error;
    out.push(...(data ?? []).map((r) => [r.date, Number(r.close)] as [string, number]));
    if (!data || data.length < 1000) return out;
  }
}

function at(s: [string, number][], date: string): number | null {
  let v: number | null = null;
  for (const [d, c] of s) { if (d > date) break; v = c; }
  return v;
}

/** Valuta → SEK. GBX (pence) räknas om via GBP. */
async function fxSeries(currency: string, from: string, errors: string[]) {
  const cur = currency.toUpperCase();
  if (cur === 'SEK') return { factor: 1, s: null as [string, number][] | null };
  const base = cur === 'GBX' || cur === 'GBP' ? 'GBP' : cur;
  const factor = cur === 'GBX' ? 0.01 : 1;
  const sym = `${base}SEK.FOREX`;
  try { await refreshSymbol(sym); } catch (e) { if (e instanceof QuotaError) errors.push(e.message); else throw e; }
  return { factor, s: await series(sym, from) };
}

async function handle(body: any, user: { email?: string }) {
  const { data: allowed } = await admin.from('ik_allowed_users').select('email').eq('email', (user.email ?? '').toLowerCase()).maybeSingle();
  if (!allowed) return { status: 403, body: { error: 'Ditt konto har inte behörighet till kurstjänsten.' } };

  // Sök instrument (för val av jämförelseindex)
  if (body?.action === 'search') {
    const q = String(body.query ?? '').trim();
    if (q.length < 2 || q.length > 60) return { status: 400, body: { error: 'Ogiltig sökning.' } };
    const hits = (await eodhd(`search/${encodeURIComponent(q)}`, { limit: '10' })) ?? [];
    return { status: 200, body: { results: (hits as any[]).map((h) => ({ symbol: `${h.Code}.${h.Exchange}`, name: h.Name, type: h.Type, currency: h.Currency, isin: h.ISIN ?? null })) } };
  }

  const instruments = Array.isArray(body?.instruments) ? body.instruments.slice(0, 200) : [];
  const from = /^\d{4}-\d{2}-\d{2}$/.test(body?.from ?? '') ? body.from : daysAgo(HISTORY_DAYS);
  const extra: { key: string; symbol: string; currency: string }[] = Array.isArray(body?.symbols) ? body.symbols.slice(0, 5) : [];
  const errors: string[] = [];
  const quotes: Record<string, unknown> = {};
  const history: Record<string, [string, number][]> = {};
  const unmatched: string[] = [];
  const fxCache = new Map<string, { factor: number; s: [string, number][] | null }>();

  const toSek = async (s: [string, number][], currency: string) => {
    const cur = (currency || 'SEK').toUpperCase();
    if (!fxCache.has(cur)) fxCache.set(cur, await fxSeries(cur, daysAgo(HISTORY_DAYS + 10), errors));
    const fx = fxCache.get(cur)!;
    if (!fx.s) return s;
    return s.map(([d, c]) => { const r = at(fx.s!, d); return r == null ? null : [d, c * fx.factor * r] as [string, number]; })
      .filter(Boolean) as [string, number][];
  };

  const jobs: { key: string; symbol: string; currency: string; name?: string | null; type?: string | null; isin?: string }[] = [];
  for (const it of instruments) {
    const key = String(it?.key ?? ''); const isin = String(it?.isin ?? '').toUpperCase();
    if (!key || key.length > 100) continue;
    if (!ISIN_RE.test(isin)) { unmatched.push(key); continue; }
    try {
      const inst = await resolveIsin(isin);
      if (!inst.symbol) { unmatched.push(key); continue; }
      jobs.push({ key, symbol: inst.symbol, currency: inst.currency ?? it.currency ?? 'SEK', name: inst.name, type: inst.type, isin });
    } catch (e) {
      if (e instanceof QuotaError) { errors.push(e.message); break; }
      throw e;
    }
  }
  for (const x of extra) {
    if (typeof x?.key === 'string' && SYMBOL_RE.test(x?.symbol ?? '')) jobs.push({ key: x.key.slice(0, 100), symbol: x.symbol, currency: String(x.currency ?? 'SEK').slice(0, 5) });
  }

  for (const j of jobs) {
    try { await refreshSymbol(j.symbol); } catch (e) {
      if (e instanceof QuotaError) { errors.push(e.message); } else { errors.push(`${j.symbol}: ${(e as Error).message}`); continue; }
    }
    const raw = await series(j.symbol, from);
    if (!raw.length) { unmatched.push(j.key); continue; }
    const sek = await toSek(raw, j.currency);
    if (!sek.length) continue;
    history[j.key] = sek;
    const [date, priceSek] = sek[sek.length - 1];
    quotes[j.key] = { symbol: j.symbol, name: j.name, type: j.type, currency: j.currency, price: raw[raw.length - 1][1], priceSek, date };
  }

  const { data: usage } = await admin.from('ik_api_usage').select('calls').eq('day', today()).maybeSingle();
  return { status: 200, body: { quotes, history, unmatched, errors: [...new Set(errors)], usage: { calls: usage?.calls ?? 0, limit: DAILY_LIMIT } } };
}

Deno.serve(async (req) => {
  const headers = { ...cors(req.headers.get('Origin')), 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Metoden stöds inte.' }), { status: 405, headers });
  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: { user }, error } = await admin.auth.getUser(token);
    if (error || !user) return new Response(JSON.stringify({ error: 'Inte inloggad.' }), { status: 401, headers });
    const text = await req.text();
    if (text.length > 100_000) return new Response(JSON.stringify({ error: 'För stor förfrågan.' }), { status: 413, headers });
    const result = await handle(JSON.parse(text || '{}'), user);
    return new Response(JSON.stringify(result.body), { status: result.status, headers });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Kurstjänsten kunde inte svara just nu.' }), { status: 500, headers });
  }
});
