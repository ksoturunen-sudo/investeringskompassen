// Kurskälla via egen server-del (Supabase Edge Function "quotes" → EODHD).
// Kontrakt: contracts/price-provider.md.
import { authedFetch } from '../cloud/auth.js';

async function call(body) {
  const res = await authedFetch('/functions/v1/quotes', { method: 'POST', body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Kurstjänsten svarade ${res.status}.`);
  return data;
}

export const cloudProvider = {
  id: 'eodhd',
  label: 'EODHD via egen server',
  /** @returns {Promise<{quotes, history, unmatched, errors, usage}>} */
  getQuotes(instruments, { symbols = [] } = {}) {
    return call({ instruments: instruments.map(({ key, isin, currency }) => ({ key, isin, currency })), symbols });
  },
  search(query) {
    return call({ action: 'search', query }).then((d) => d.results ?? []);
  },
};
