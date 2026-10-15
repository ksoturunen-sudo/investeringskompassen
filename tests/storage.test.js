import { test, assertEqual } from './harness.js';
import { createLocalStore } from '../src/storage/localStore.js';

// Enkel ersättning för webbläsarens localStorage i tester.
function fakeStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m };
}

test('Lagring: gammalt format flyttas och finns kvar efter omstart', () => {
  const tx = { id: 'a', date: '2026-01-01', account: 'K', type: 'buy', rawType: 'Köp', name: 'X', isin: 'SE1', quantity: 1, price: 1, amount: -1, fee: 0, currency: 'SEK', fxRate: 1, result: null, source: 't' };
  const fake = fakeStorage({ 'ik.v1.transactions': JSON.stringify([tx]), 'ik.v1.watchlist': JSON.stringify([{ id: 'w', name: 'B' }]) });
  assertEqual(createLocalStore({ storage: fake }).loadTransactions().length, 1);
  // "Omstart": ny instans ska läsa det migrerade formatet
  const again = createLocalStore({ storage: fake });
  assertEqual(again.loadTransactions().length, 1);
  assertEqual(again.loadWatchlist().length, 1);
  assertEqual(fake._m.has('ik.v1.transactions'), false);
});
