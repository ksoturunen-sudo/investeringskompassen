import { test, assertEqual, assertClose } from './harness.js';
import { computeHoldings, summarize, dividendsByPeriod, allocation } from '../src/core/portfolio.js';

const tx = (o) => ({
  id: Math.random().toString(36), account: 'ISK', rawType: '', isin: 'SE1', name: 'A', quantity: 0, price: 0,
  amount: 0, fee: 0, currency: 'SEK', fxRate: 1, result: null, source: 'test', ...o,
});

test('Portfölj: GAV enligt genomsnittsmetoden', () => {
  const [h] = computeHoldings([
    tx({ date: '2026-01-01', type: 'buy', quantity: 10, price: 100, amount: -1000 }),
    tx({ date: '2026-02-01', type: 'buy', quantity: 10, price: 200, amount: -2000 }),
    tx({ date: '2026-03-01', type: 'sell', quantity: 5, price: 250, amount: 1250 }),
  ]);
  assertEqual(h.quantity, 15);
  assertClose(h.avgCost, 150);
  assertClose(h.costBasis, 2250);
  assertClose(h.realized, 1250 - 750);
  assertClose(h.price, 250); // senaste affärskurs
  assertEqual(h.priceSource, 'last-trade');
});

test('Portfölj: bankens resultat används vid sälj om det finns', () => {
  const [h] = computeHoldings([
    tx({ date: '2026-01-01', type: 'buy', quantity: 10, price: 100, amount: -1000 }),
    tx({ date: '2026-03-01', type: 'sell', quantity: 10, price: 120, amount: 1190, result: 190 }),
  ]);
  assertEqual(h.quantity, 0);
  assertClose(h.realized, 190);
  assertEqual(h.marketValue, 0);
});

test('Portfölj: manuell kurs och utländsk valuta', () => {
  const [h] = computeHoldings(
    [tx({ date: '2026-01-01', type: 'buy', quantity: 2, price: 100, fxRate: 10, amount: -2010, currency: 'USD' })],
    { SE1: { price: 1200, date: '2026-10-01', source: 'manual' } },
  );
  assertClose(h.marketValue, 2400);
  assertClose(h.unrealized, 390);
  assertEqual(h.priceSource, 'manual');
});

test('Portfölj: sammanfattning, utdelning och fördelning', () => {
  const list = [
    tx({ date: '2026-01-01', type: 'buy', quantity: 10, price: 100, amount: -1000 }),
    tx({ date: '2026-01-01', type: 'buy', isin: 'SE2', name: 'B', quantity: 30, price: 100, amount: -3000 }),
    tx({ date: '2025-05-01', type: 'dividend', amount: 50 }),
    tx({ date: '2026-05-01', type: 'dividend', amount: 70 }),
  ];
  const holdings = computeHoldings(list);
  const s = summarize(holdings, list, new Date('2026-10-15'));
  assertClose(s.marketValue, 4000);
  assertClose(s.dividendsThisYear, 70);
  assertClose(s.dividendsTotal, 120);
  assertEqual(dividendsByPeriod(list).byYear, { 2025: 50, 2026: 70 });
  assertEqual(allocation(holdings).map((a) => [a.label, a.share]), [['B', 0.75], ['A', 0.25]]);
});
