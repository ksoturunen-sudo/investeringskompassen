import { test, assertEqual, assertThrows } from './harness.js';
import { emptySnapshot, mergeSnapshots, validateSnapshot } from '../src/core/snapshot.js';

const t = (id) => ({ id, date: '2026-01-01', account: 'K', type: 'buy', rawType: 'Köp', name: 'X', isin: 'SE1', quantity: 1, price: 1, amount: -1, fee: 0, currency: 'SEK', fxRate: 1, result: null, source: 'test' });

test('Synk: sammanslagning är symmetrisk och senaste ändring vinner', () => {
  const a = { ...emptySnapshot(), transactions: [t('1'), t('2')], prices: { X: { price: 10, date: '2026-01-01', updatedAt: 1 } },
    watchlist: [{ id: 'w', name: 'Gammal', updatedAt: 1 }], targets: { mode: 'type', byMode: { type: { Aktie: 60 } }, updatedAt: 5 } };
  const b = { ...emptySnapshot(), transactions: [t('2'), t('3')], prices: { X: { price: 12, date: '2026-01-02', updatedAt: 2 } },
    watchlist: [{ id: 'w', deleted: true, updatedAt: 3 }], targets: { mode: 'region', byMode: {}, updatedAt: 4 } };
  const ab = mergeSnapshots(a, b); const ba = mergeSnapshots(b, a);
  assertEqual(ab, ba);
  assertEqual(ab.transactions.map((x) => x.id), ['1', '2', '3']);
  assertEqual(ab.prices.X.price, 12);
  assertEqual(ab.watchlist[0].deleted, true);
  assertEqual(ab.targets.mode, 'type');
});

test('Synk: backup-fil valideras', () => {
  assertEqual(validateSnapshot({ ...emptySnapshot(), transactions: [t('1')] }).transactions.length, 1);
  assertThrows(() => validateSnapshot({ schemaVersion: 99 }));
  assertThrows(() => validateSnapshot({ ...emptySnapshot(), transactions: [{ id: 'x' }] }));
});
