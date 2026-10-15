// Ögonblicksbild av all användardata – används för backup-fil och för synk mellan enheter.
// Kontrakt: contracts/snapshot.schema.json. Sammanslagning är deterministisk och kan köras
// åt båda håll: merge(a, b) och merge(b, a) ger samma innehåll.

import { validateTransaction } from './transaction.js';

export const SNAPSHOT_VERSION = 1;

export function emptySnapshot() {
  return {
    schemaVersion: SNAPSHOT_VERSION,
    transactions: [],
    prices: {},        // key → { price, date, source: 'manual', updatedAt }
    watchlist: [],     // { id, name, current, target, note, added, updatedAt, deleted? }
    instruments: {},   // key → { type, region, updatedAt }
    targets: { mode: 'type', byMode: {}, updatedAt: 0 }, // byMode: { type|region|holding: { grupp: procent } }
  };
}

const newer = (a, b) => ((b?.updatedAt ?? 0) > (a?.updatedAt ?? 0) ? b : a);

function mergeMaps(a = {}, b = {}) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = k in out ? newer(out[k], v) : v;
  return out;
}

/** Slår ihop två ögonblicksbilder. Senast ändrad vinner per post; transaktioner unioneras. */
export function mergeSnapshots(a, b) {
  const A = { ...emptySnapshot(), ...a };
  const B = { ...emptySnapshot(), ...b };
  const tx = new Map();
  for (const t of [...A.transactions, ...B.transactions]) if (!tx.has(t.id)) tx.set(t.id, t);
  const wl = new Map();
  for (const w of [...A.watchlist, ...B.watchlist]) wl.set(w.id, wl.has(w.id) ? newer(wl.get(w.id), w) : w);
  return {
    schemaVersion: SNAPSHOT_VERSION,
    transactions: [...tx.values()].sort((x, y) => x.id.localeCompare(y.id)),
    prices: mergeMaps(A.prices, B.prices),
    watchlist: [...wl.values()].sort((x, y) => x.id.localeCompare(y.id)),
    instruments: mergeMaps(A.instruments, B.instruments),
    targets: newer(A.targets, B.targets),
  };
}

/** Kontrollerar en inläst ögonblicksbild (t.ex. från backup-fil). Kastar fel med tydlig text. */
export function validateSnapshot(s) {
  if (!s || typeof s !== 'object') throw new Error('Filen innehåller ingen giltig data.');
  if (s.schemaVersion !== SNAPSHOT_VERSION) throw new Error(`Okänd version på backup-filen (${s.schemaVersion}).`);
  if (!Array.isArray(s.transactions) || !Array.isArray(s.watchlist)) throw new Error('Backup-filen saknar transaktioner eller bevakningar.');
  for (const k of ['prices', 'instruments']) {
    if (typeof s[k] !== 'object' || s[k] === null || Array.isArray(s[k])) throw new Error(`Backup-filen har fel format på ${k}.`);
  }
  s.transactions.forEach((t, i) => {
    const errors = validateTransaction(t);
    if (errors.length) throw new Error(`Transaktion ${i + 1} i backup-filen är felaktig: ${errors.join('; ')}`);
  });
  for (const [k, p] of Object.entries(s.prices)) {
    if (!Number.isFinite(p?.price)) throw new Error(`Felaktig kurs för ${k}.`);
  }
  return s;
}
