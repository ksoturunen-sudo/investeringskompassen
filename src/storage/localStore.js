// Lagring lokalt i enheten (webbläsarens localStorage). Ingen data lämnar enheten.
// Kontrakt (Repository): loadTransactions, addTransactions, loadPrices, setPrice,
// loadWatchlist, saveWatchlist, clearAll. Kan bytas mot t.ex. en server-backend
// med samma metoder utan att resten av appen ändras.

const KEYS = {
  transactions: 'ik.v1.transactions',
  prices: 'ik.v1.prices',
  watchlist: 'ik.v1.watchlist',
};

function read(key, fallback) {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  globalThis.localStorage?.setItem(key, JSON.stringify(value));
}

export function createLocalStore() {
  return {
    loadTransactions: () => read(KEYS.transactions, []),

    /** Lägger till nya transaktioner; redan kända id hoppas över. Returnerar antal nya. */
    addTransactions(incoming) {
      const existing = read(KEYS.transactions, []);
      const ids = new Set(existing.map((t) => t.id));
      const fresh = incoming.filter((t) => !ids.has(t.id));
      write(KEYS.transactions, existing.concat(fresh));
      return { added: fresh.length, duplicates: incoming.length - fresh.length };
    },

    loadPrices: () => read(KEYS.prices, {}),
    setPrice(key, price) {
      const prices = read(KEYS.prices, {});
      if (price == null) delete prices[key];
      else prices[key] = { price, date: new Date().toISOString().slice(0, 10), source: 'manual' };
      write(KEYS.prices, prices);
    },
    mergeProviderPrices(quotes) {
      const prices = read(KEYS.prices, {});
      for (const [key, q] of Object.entries(quotes)) {
        if (prices[key]?.source !== 'manual') prices[key] = { ...q, source: 'provider' };
      }
      write(KEYS.prices, prices);
    },

    loadWatchlist: () => read(KEYS.watchlist, []),
    saveWatchlist: (items) => write(KEYS.watchlist, items),

    clearAll() {
      Object.values(KEYS).forEach((k) => globalThis.localStorage?.removeItem(k));
    },
  };
}
