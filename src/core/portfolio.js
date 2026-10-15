// Portföljberäkningar. Rena funktioner: transaktioner + kurser in → innehav och nyckeltal ut.
// Anskaffningsvärde enligt genomsnittsmetoden (som Skatteverket använder för aktier och fonder).

import { instrumentKey } from './transaction.js';

const ORDER = { buy: 0, sell: 1 };

function sortChronologically(transactions) {
  return [...transactions].sort((a, b) => (
    a.date.localeCompare(b.date) || (ORDER[a.type] ?? 2) - (ORDER[b.type] ?? 2)
  ));
}

/**
 * @typedef {Object} Holding
 * @property {string} key
 * @property {string} name
 * @property {string} isin
 * @property {string} currency
 * @property {string[]} accounts
 * @property {number} quantity
 * @property {number} costBasis        Anskaffningsvärde i SEK för nuvarande antal
 * @property {number} avgCost          GAV i SEK per andel
 * @property {number} price            Aktuell kurs i SEK per andel
 * @property {'manual'|'provider'|'last-trade'} priceSource
 * @property {string} priceDate
 * @property {number} marketValue
 * @property {number} unrealized
 * @property {number} unrealizedPct
 * @property {number} realized
 * @property {number} dividends
 */

/**
 * @param {import('./transaction.js').Transaction[]} transactions
 * @param {Record<string, {price:number, date:string, source:'manual'|'provider'}>} prices  kurser i SEK per instrumentnyckel
 */
export function computeHoldings(transactions, prices = {}) {
  const map = new Map();
  const get = (t) => {
    const key = instrumentKey(t);
    if (!map.has(key)) {
      map.set(key, {
        key, name: t.name, isin: t.isin, currency: t.currency, accounts: new Set(),
        quantity: 0, costBasis: 0, realized: 0, dividends: 0, lastTradePrice: 0, lastTradeDate: '',
      });
    }
    return map.get(key);
  };

  for (const t of sortChronologically(transactions)) {
    if (t.type === 'buy') {
      const h = get(t);
      const cost = Math.abs(t.amount) || (t.quantity * t.price * t.fxRate + t.fee);
      h.quantity += t.quantity;
      h.costBasis += cost;
      h.accounts.add(t.account);
      h.lastTradePrice = t.price * t.fxRate;
      h.lastTradeDate = t.date;
      h.name = t.name;
    } else if (t.type === 'sell') {
      const h = get(t);
      const share = h.quantity > 0 ? Math.min(t.quantity / h.quantity, 1) : 0;
      const removedCost = h.costBasis * share;
      h.quantity = Math.max(h.quantity - t.quantity, 0);
      h.costBasis -= removedCost;
      h.realized += t.result ?? (Math.abs(t.amount) - removedCost);
      h.lastTradePrice = t.price * t.fxRate;
      h.lastTradeDate = t.date;
    } else if (t.type === 'dividend' && (t.isin || t.name)) {
      get(t).dividends += t.amount;
    }
  }

  const EPS = 1e-9;
  return [...map.values()].map((h) => {
    const p = prices[h.key];
    const price = p ? p.price : h.lastTradePrice;
    const quantity = h.quantity < EPS ? 0 : h.quantity;
    const marketValue = quantity * price;
    const costBasis = quantity === 0 ? 0 : h.costBasis;
    const unrealized = marketValue - costBasis;
    return {
      key: h.key, name: h.name, isin: h.isin, currency: h.currency, accounts: [...h.accounts],
      quantity, costBasis,
      avgCost: quantity ? costBasis / quantity : 0,
      price,
      priceSource: p ? p.source : 'last-trade',
      priceDate: p ? p.date : h.lastTradeDate,
      marketValue, unrealized,
      unrealizedPct: costBasis ? unrealized / costBasis : 0,
      realized: h.realized,
      dividends: h.dividends,
    };
  });
}

/** Sammanfattande nyckeltal för hela portföljen. */
export function summarize(holdings, transactions, today = new Date()) {
  const open = holdings.filter((h) => h.quantity > 0);
  const year = String(today.getFullYear());
  const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
  const dividends = transactions.filter((t) => t.type === 'dividend');
  const marketValue = sum(open, (h) => h.marketValue);
  const costBasis = sum(open, (h) => h.costBasis);
  return {
    marketValue,
    costBasis,
    unrealized: marketValue - costBasis,
    unrealizedPct: costBasis ? (marketValue - costBasis) / costBasis : 0,
    realized: sum(holdings, (h) => h.realized),
    dividendsTotal: sum(dividends, (t) => t.amount),
    dividendsThisYear: sum(dividends.filter((t) => t.date.startsWith(year)), (t) => t.amount),
    fees: sum(transactions, (t) => t.fee),
    holdingsCount: open.length,
    staleCount: open.filter((h) => h.priceSource === 'last-trade').length,
  };
}

/** Utdelningar grupperade per år och månad. */
export function dividendsByPeriod(transactions) {
  const byYear = {};
  const byMonth = {};
  for (const t of transactions) {
    if (t.type !== 'dividend') continue;
    const y = t.date.slice(0, 4);
    const m = t.date.slice(0, 7);
    byYear[y] = (byYear[y] ?? 0) + t.amount;
    byMonth[m] = (byMonth[m] ?? 0) + t.amount;
  }
  return { byYear, byMonth };
}

/** Fördelning av marknadsvärde, t.ex. per innehav eller per konto. */
export function allocation(holdings, groupBy = (h) => h.name) {
  const open = holdings.filter((h) => h.quantity > 0 && h.marketValue > 0);
  const total = open.reduce((s, h) => s + h.marketValue, 0);
  const groups = new Map();
  for (const h of open) {
    const k = groupBy(h);
    groups.set(k, (groups.get(k) ?? 0) + h.marketValue);
  }
  return [...groups.entries()]
    .map(([label, value]) => ({ label, value, share: total ? value / total : 0 }))
    .sort((a, b) => b.value - a.value);
}
