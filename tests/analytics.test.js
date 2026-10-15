import { test, assertEqual, assertClose } from './harness.js';
import { classify, compareToTargets, dividendForecast, indexComparison, monthEnds, priceOn, suggestRegion, timeline, typeFromProvider } from '../src/core/analytics.js';
import { computeHoldings } from '../src/core/portfolio.js';

const tx = (o) => ({
  id: Math.random().toString(36), account: 'ISK', rawType: '', isin: 'SE1', name: 'A', quantity: 0, price: 0,
  amount: 0, fee: 0, currency: 'SEK', fxRate: 1, result: null, source: 'test', ...o,
});

test('Analys: region från ISIN och typ från kurskälla', () => {
  assertEqual([suggestRegion('SE0000000001'), suggestRegion('US0000000001'), suggestRegion('FI0000000001'), suggestRegion('LU0000000001'), suggestRegion('KY0000000001')],
    ['Sverige', 'USA', 'Norden', 'Europa', null]);
  assertEqual([typeFromProvider('Common Stock'), typeFromProvider('FUND'), typeFromProvider('ETF'), typeFromProvider('')], ['Aktie', 'Fond', 'ETF', null]);
  const c = classify({ key: 'SE1', isin: 'SE0000000001' }, { SE1: { type: 'Fond' } }, {});
  assertEqual([c.type, c.typeIsSet, c.region, c.regionIsSet], ['Fond', true, 'Sverige', false]);
});

test('Analys: jämförelse mot målfördelning', () => {
  const rows = compareToTargets([{ label: 'Aktie', value: 600 }, { label: 'Fond', value: 400 }], { Aktie: 50, Fond: 50 });
  const aktie = rows.find((r) => r.label === 'Aktie');
  assertClose(aktie.diffValue, -100);
  assertClose(rows.find((r) => r.label === 'Fond').diffValue, 100);
});

test('Analys: utdelningsprognos använder utdelning per andel × nuvarande antal', () => {
  const list = [
    tx({ date: '2025-01-10', type: 'buy', quantity: 10, price: 100, amount: -1000 }),
    tx({ date: '2026-04-20', type: 'dividend', quantity: 10, price: 5, amount: 50 }),
    tx({ date: '2026-06-01', type: 'buy', quantity: 10, price: 100, amount: -1000 }),
    tx({ date: '2024-04-20', type: 'dividend', quantity: 10, amount: 40 }), // äldre än 12 mån – räknas inte
  ];
  const f = dividendForecast(list, computeHoldings(list), new Date('2026-10-15'));
  assertClose(f.total, 100);
  assertEqual(Object.keys(f.byMonth), ['2027-04']);
});

test('Analys: månadsslut och kurs på datum', () => {
  assertEqual(monthEnds('2026-08-15', new Date('2026-10-15')), ['2026-08-31', '2026-09-30', '2026-10-15']);
  const s = [['2026-01-02', 10], ['2026-01-05', 11], ['2026-02-01', 12]];
  assertEqual([priceOn(s, '2026-01-01'), priceOn(s, '2026-01-04'), priceOn(s, '2026-03-01')], [null, 10, 12]);
});

test('Analys: utveckling över tid med och utan kurshistorik', () => {
  const list = [
    tx({ date: '2026-08-10', type: 'buy', quantity: 10, price: 100, amount: -1000 }),
    tx({ date: '2026-09-10', type: 'dividend', amount: 30 }),
  ];
  const noHist = timeline(list, {}, new Date('2026-10-15'));
  assertEqual(noHist.map((p) => [p.invested, p.dividends, p.value]), [[1000, 0, null], [1000, 30, null], [1000, 30, null]]);
  const hist = { SE1: [['2026-08-10', 100], ['2026-09-30', 120], ['2026-10-15', 130]] };
  assertEqual(timeline(list, hist, new Date('2026-10-15')).map((p) => p.value), [1000, 1200, 1300]);
});

test('Analys: indexjämförelse med samma kassaflöden', () => {
  const list = [
    tx({ date: '2026-08-10', type: 'buy', quantity: 10, price: 100, amount: -1000 }),
    tx({ date: '2026-09-15', type: 'buy', quantity: 10, price: 100, amount: -1000 }),
  ];
  const hist = { SE1: [['2026-08-10', 100], ['2026-09-15', 100], ['2026-10-15', 100]] };
  const points = timeline(list, hist, new Date('2026-10-15'));
  const index = [['2026-08-01', 50], ['2026-09-15', 100], ['2026-10-15', 100]];
  // Start 2026-08-31: värde 1000 vid index 50 → 20 andelar. 15/9 köp 1000 vid 100 → +10 → 30 × 100.
  assertEqual(indexComparison(points, list, index), [1000, 3000, 3000]);
});
