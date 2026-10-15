// Lagring lokalt i enheten (webbläsarens localStorage). Kontrakt: contracts/storage.md.
// All användardata hålls som en ögonblicksbild (src/core/snapshot.js) så att den kan
// säkerhetskopieras och synkas. Kurser från kurskällan cachas separat och synkas inte.

import { emptySnapshot, mergeSnapshots } from '../core/snapshot.js';

const KEYS = {
  snapshot: 'ik.v2.snapshot',
  quotes: 'ik.v2.quotes',       // senaste kurser från kurskälla: key → { price, date, currency }
  history: 'ik.v2.history',     // kurshistorik: key → [[date, closeSEK], ...]
  settings: 'ik.v2.settings',   // enhetsspecifikt, synkas inte
  // äldre format (v1) – migreras automatiskt
  v1tx: 'ik.v1.transactions', v1prices: 'ik.v1.prices', v1watch: 'ik.v1.watchlist',
};

function helpers(storage) {
  return {
    read(key, fallback) {
      try {
        const raw = storage?.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch {
        return fallback;
      }
    },
    write: (key, value) => storage?.setItem(key, JSON.stringify(value)),
    remove: (key) => storage?.removeItem(key),
  };
}

function migrateV1({ read, write, remove }) {
  const tx = read(KEYS.v1tx, null);
  if (!tx) return null;
  const snap = emptySnapshot();
  snap.transactions = tx;
  for (const [k, p] of Object.entries(read(KEYS.v1prices, {}))) {
    if (p.source === 'manual') snap.prices[k] = { ...p, updatedAt: 1 };
  }
  snap.watchlist = read(KEYS.v1watch, []).map((w) => ({ ...w, updatedAt: 1 }));
  // Spara det nya formatet först; gamla nycklar tas bort först när skrivningen lyckats.
  write(KEYS.snapshot, snap);
  if (read(KEYS.snapshot, null)?.transactions?.length === tx.length) {
    [KEYS.v1tx, KEYS.v1prices, KEYS.v1watch].forEach(remove);
  }
  return snap;
}

export function createLocalStore({ now = () => Date.now(), storage = globalThis.localStorage } = {}) {
  const io = helpers(storage);
  const { read, write, remove } = io;
  const listeners = new Set();
  let snap = read(KEYS.snapshot, null) ?? migrateV1(io) ?? emptySnapshot();
  snap = { ...emptySnapshot(), ...snap };

  const save = (notify = true) => {
    write(KEYS.snapshot, snap);
    if (notify) listeners.forEach((fn) => fn());
  };

  return {
    /** Anropas när användardata ändrats (används av synken). */
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    // --- Transaktioner ---
    loadTransactions: () => snap.transactions,
    addTransactions(incoming) {
      const ids = new Set(snap.transactions.map((t) => t.id));
      const fresh = incoming.filter((t) => !ids.has(t.id));
      if (fresh.length) { snap.transactions = snap.transactions.concat(fresh); save(); }
      return { added: fresh.length, duplicates: incoming.length - fresh.length };
    },

    // --- Kurser: manuella (synkas) + från kurskälla (cache) ---
    /** Kurser i SEK per instrumentnyckel. Manuell kurs vinner om den är nyare än hämtad. */
    loadPrices() {
      const out = {};
      for (const [k, q] of Object.entries(read(KEYS.quotes, {}))) out[k] = { price: q.priceSek, date: q.date, source: 'provider' };
      for (const [k, p] of Object.entries(snap.prices)) {
        if (p.deleted) continue;
        if (!out[k] || p.date >= out[k].date) out[k] = { price: p.price, date: p.date, source: 'manual' };
      }
      return out;
    },
    setPrice(key, price) {
      const date = new Date(now()).toISOString().slice(0, 10);
      snap.prices[key] = price == null
        ? { price: 0, date, deleted: true, updatedAt: now() }
        : { price, date, source: 'manual', updatedAt: now() };
      save();
    },
    loadQuotes: () => read(KEYS.quotes, {}),
    saveQuotes(quotes) { write(KEYS.quotes, { ...read(KEYS.quotes, {}), ...quotes }); },
    loadHistory: () => read(KEYS.history, {}),
    saveHistory(history) { write(KEYS.history, { ...read(KEYS.history, {}), ...history }); },

    // --- Bevakning ---
    loadWatchlist: () => snap.watchlist.filter((w) => !w.deleted),
    addWatch(item) { snap.watchlist = snap.watchlist.concat({ ...item, updatedAt: now() }); save(); },
    removeWatch(id) {
      snap.watchlist = snap.watchlist.map((w) => (w.id === id ? { id, deleted: true, updatedAt: now() } : w));
      save();
    },

    // --- Egenskaper per innehav (typ, region) ---
    loadInstruments: () => snap.instruments,
    setInstrument(key, patch) {
      snap.instruments = { ...snap.instruments, [key]: { ...snap.instruments[key], ...patch, updatedAt: now() } };
      save();
    },

    // --- Målfördelning ---
    loadTargets: () => snap.targets,
    saveTargets(targets) { snap.targets = { ...targets, updatedAt: now() }; save(); },

    // --- Inställningar (per enhet) ---
    loadSettings: () => read(KEYS.settings, {}),
    saveSettings(patch) { write(KEYS.settings, { ...read(KEYS.settings, {}), ...patch }); },

    // --- Backup och synk ---
    exportSnapshot: () => structuredClone(snap),
    /** Slår ihop inkommande data med lokal. Returnerar true om något ändrades lokalt. */
    mergeSnapshot(incoming, { notify = true } = {}) {
      const merged = mergeSnapshots(snap, incoming);
      const changed = JSON.stringify(merged) !== JSON.stringify(mergeSnapshots(snap, {}));
      snap = merged;
      save(notify && changed);
      return changed;
    },

    clearAll() {
      snap = emptySnapshot();
      [KEYS.snapshot, KEYS.quotes, KEYS.history].forEach(remove);
      save(false);
    },
  };
}
