// Samlar molnfunktionerna (inloggning, synk, kurser) bakom ett litet gränssnitt för vyerna.
import { currentUser, handleRedirect, signInWithGoogle, signOut } from './auth.js';
import { createSync } from './sync.js';
import { cloudProvider } from '../prices/cloudProvider.js';
import { computeHoldings } from '../core/portfolio.js';
import { instrumentKey } from '../core/transaction.js';

const RECENT_DAYS = 400;

/** Instrument som ägs nu eller har handlats det senaste året (behövs för utvecklingsgrafen). */
export function instrumentsToPrice(transactions) {
  const cutoff = new Date(Date.now() - RECENT_DAYS * 86400000).toISOString().slice(0, 10);
  const held = new Set(computeHoldings(transactions).filter((h) => h.quantity > 0).map((h) => h.key));
  const out = new Map();
  for (const t of transactions) {
    if (!t.isin || (t.type !== 'buy' && t.type !== 'sell')) continue;
    const key = instrumentKey(t);
    if (held.has(key) || t.date >= cutoff) out.set(key, { key, isin: t.isin, name: t.name, currency: t.currency });
  }
  return [...out.values()];
}

export function createCloud(store, { onChange }) {
  const sync = createSync(store, { onStatus: () => onChange() });
  const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });

  async function updatePrices({ force = false } = {}) {
    if (!currentUser()) return;
    const settings = store.loadSettings();
    if (!force && settings.lastPriceUpdate === today()) return;
    const transactions = store.loadTransactions();
    const instruments = instrumentsToPrice(transactions);
    const symbols = settings.indexSymbol ? [{ key: `INDEX:${settings.indexSymbol}`, symbol: settings.indexSymbol, currency: settings.indexCurrency ?? 'SEK' }] : [];
    if (!instruments.length && !symbols.length) return;
    try {
      const r = await cloudProvider.getQuotes(instruments, { symbols });
      store.saveQuotes(r.quotes ?? {});
      store.saveHistory(r.history ?? {});
      const names = new Map(instruments.map((i) => [i.key, i.name]));
      store.saveSettings({
        lastPriceUpdate: today(),
        priceStatus: { usage: r.usage, errors: r.errors ?? [], unmatchedNames: (r.unmatched ?? []).map((k) => names.get(k) ?? k) },
      });
    } catch (e) {
      store.saveSettings({ priceStatus: { errors: [e.message] } });
    }
    onChange();
  }

  return {
    user: currentUser,
    signIn: signInWithGoogle,
    async signOut() { await sync.lock(); await signOut(); onChange(); },
    sync,
    updatePrices,
    searchInstruments: (q) => cloudProvider.search(q),
    /** Körs vid start. Returnerar eventuellt inloggningsfel. */
    async start() {
      const authError = await handleRedirect();
      if (currentUser()) {
        await sync.resume().catch(() => {});
        updatePrices().catch(() => {});
      }
      return authError;
    },
  };
}
