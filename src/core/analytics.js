// Analyser ovanpå innehav och transaktioner: kategorier, målfördelning,
// utdelningsprognos och portföljens utveckling över tid. Rena funktioner.

import { instrumentKey } from './transaction.js';

export const TYPES = ['Aktie', 'Fond', 'ETF', 'Räntefond', 'Övrigt'];
export const REGIONS = ['Sverige', 'Norden', 'Europa', 'USA', 'Global', 'Tillväxtmarknader', 'Övrigt'];
const UNSET = 'Ej angivet';

const NORDIC = ['DK', 'FI', 'NO', 'IS'];
const EUROPE = ['DE', 'FR', 'NL', 'BE', 'CH', 'GB', 'IE', 'LU', 'ES', 'IT', 'AT', 'PT'];

/**
 * Förslag på region utifrån ISIN-landskod. Observera: för fonder anger ISIN var fonden
 * är registrerad, inte var den investerar – därför bara ett förslag som användaren kan ändra.
 */
export function suggestRegion(isin) {
  const cc = (isin ?? '').slice(0, 2).toUpperCase();
  if (cc === 'SE') return 'Sverige';
  if (NORDIC.includes(cc)) return 'Norden';
  if (cc === 'US') return 'USA';
  if (EUROPE.includes(cc)) return 'Europa';
  return null;
}

/** Typ från kurskällans klassning (EODHD "Type"), annars null. */
export function typeFromProvider(providerType) {
  const t = (providerType ?? '').toLowerCase();
  if (t.includes('etf')) return 'ETF';
  if (t.includes('fund')) return 'Fond';
  if (t.includes('stock') || t.includes('share') || t.includes('preferred')) return 'Aktie';
  return null;
}

/** Typ och region för ett innehav: användarens val > kurskällans uppgift > förslag. */
export function classify(holding, instruments = {}, quotes = {}) {
  const meta = instruments[holding.key] ?? {};
  const q = quotes[holding.key] ?? {};
  const type = meta.type ?? typeFromProvider(q.type) ?? UNSET;
  const regionSuggested = suggestRegion(holding.isin);
  const region = meta.region ?? regionSuggested ?? UNSET;
  return { type, region, typeIsSet: Boolean(meta.type), regionIsSet: Boolean(meta.region) };
}

/**
 * Målfördelning: jämför nuvarande andelar med mål (procent) och räknar ut hur många
 * kronor som skiljer per grupp. Positivt belopp = under målet.
 * @param {{label:string, value:number}[]} current
 * @param {Record<string, number>} targets  procent per grupp
 */
export function compareToTargets(current, targets) {
  const total = current.reduce((s, c) => s + c.value, 0);
  const labels = new Set([...current.map((c) => c.label), ...Object.keys(targets)]);
  return [...labels].map((label) => {
    const value = current.find((c) => c.label === label)?.value ?? 0;
    const targetPct = targets[label] ?? 0;
    const share = total ? value / total : 0;
    const targetValue = (targetPct / 100) * total;
    return { label, value, share, targetPct, diffPct: targetPct / 100 - share, diffValue: targetValue - value };
  }).sort((a, b) => b.targetPct - a.targetPct || b.value - a.value);
}

/** Antal andelar per instrument vid ett visst datum (inklusive). */
function quantityAt(transactions, key, date) {
  let q = 0;
  for (const t of transactions) {
    if (instrumentKey(t) !== key || t.date > date) continue;
    if (t.type === 'buy') q += t.quantity;
    else if (t.type === 'sell') q = Math.max(q - t.quantity, 0);
  }
  return q;
}

const addYears = (date, n) => `${Number(date.slice(0, 4)) + n}${date.slice(4)}`;

/**
 * Utdelningsprognos kommande 12 månader: utdelning per andel under de senaste
 * 12 månaderna × nuvarande antal. Antar samma utdelning och samma månad som förra året.
 */
export function dividendForecast(transactions, holdings, today = new Date()) {
  const todayStr = today.toISOString().slice(0, 10);
  const from = addYears(todayStr, -1);
  const held = new Map(holdings.filter((h) => h.quantity > 0).map((h) => [h.key, h]));
  const items = [];
  for (const t of transactions) {
    if (t.type !== 'dividend' || t.date <= from || t.date > todayStr) continue;
    const key = instrumentKey(t);
    const h = held.get(key);
    if (!h) continue;
    const qtyThen = t.quantity || quantityAt(transactions, key, t.date);
    if (!qtyThen) continue;
    const perShare = t.amount / qtyThen;
    items.push({ key, name: h.name, date: addYears(t.date, 1), perShare, amount: perShare * h.quantity });
  }
  items.sort((a, b) => a.date.localeCompare(b.date));
  const byMonth = {};
  for (const i of items) byMonth[i.date.slice(0, 7)] = (byMonth[i.date.slice(0, 7)] ?? 0) + i.amount;
  return { items, byMonth, total: items.reduce((s, i) => s + i.amount, 0) };
}

/** Månadsslut från första transaktionen till idag, som ÅÅÅÅ-MM-DD. */
export function monthEnds(firstDate, today = new Date()) {
  const out = [];
  let y = Number(firstDate.slice(0, 4)); let m = Number(firstDate.slice(5, 7));
  const todayStr = today.toISOString().slice(0, 10);
  for (;;) {
    const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    if (end >= todayStr) { out.push(todayStr); break; }
    out.push(end);
    m += 1; if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

/** Senaste kända kurs på eller före datum i en sorterad historik [[date, close], ...]. */
export function priceOn(series, date) {
  if (!series?.length || series[0][0] > date) return null;
  let lo = 0; let hi = series.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (series[mid][0] <= date) lo = mid; else hi = mid - 1;
  }
  return series[lo][1];
}

/**
 * Portföljens utveckling per månad.
 * - invested: insatt kapital i innehav (anskaffningsvärde, genomsnittsmetoden)
 * - dividends: ackumulerad utdelning
 * - value: marknadsvärde om kurshistorik finns för alla innehav den månaden, annars null
 * @param {Record<string, [string, number][]>} history  kurshistorik i SEK per instrument
 */
export function timeline(transactions, history = {}, today = new Date()) {
  if (!transactions.length) return [];
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date) || (a.type === 'buy' ? -1 : 1));
  const points = monthEnds(sorted[0].date, today);
  const state = new Map(); // key → { qty, cost }
  let dividends = 0; let i = 0;
  return points.map((date) => {
    for (; i < sorted.length && sorted[i].date <= date; i++) {
      const t = sorted[i];
      const key = instrumentKey(t);
      const s = state.get(key) ?? { qty: 0, cost: 0 };
      if (t.type === 'buy') { s.qty += t.quantity; s.cost += Math.abs(t.amount) || t.quantity * t.price * t.fxRate; }
      else if (t.type === 'sell' && s.qty > 0) {
        const share = Math.min(t.quantity / s.qty, 1);
        s.cost -= s.cost * share; s.qty = Math.max(s.qty - t.quantity, 0);
      } else if (t.type === 'dividend') dividends += t.amount;
      state.set(key, s);
    }
    let invested = 0; let value = 0; let complete = true;
    for (const [key, s] of state) {
      if (s.qty <= 1e-9) continue;
      invested += s.cost;
      const p = priceOn(history[key], date);
      if (p == null) complete = false; else value += s.qty * p;
    }
    return { date, invested, dividends, value: complete ? value : null };
  });
}

/**
 * Jämförelse mot index: "om samma pengar i stället hade placerats i indexet".
 * Startar vid första månaden där både portföljvärde och indexkurs finns, med samma värde
 * som portföljen. Därefter köps/säljs indexandelar för samma belopp som portföljens köp/sälj.
 * @returns {(number|null)[]} indexportföljens värde per punkt
 */
export function indexComparison(points, transactions, series) {
  const startIdx = points.findIndex((p) => p.value != null && priceOn(series, p.date) != null);
  if (startIdx < 0) return points.map(() => null);
  const startDate = points[startIdx].date;
  let units = points[startIdx].value / priceOn(series, startDate);
  const flows = transactions
    .filter((t) => (t.type === 'buy' || t.type === 'sell') && t.date > startDate)
    .sort((a, b) => a.date.localeCompare(b.date));
  let f = 0;
  return points.map((p, i) => {
    if (i < startIdx) return null;
    for (; f < flows.length && flows[f].date <= p.date; f++) {
      const t = flows[f];
      const px = priceOn(series, t.date);
      if (!px) continue;
      units += (t.type === 'buy' ? Math.abs(t.amount) : -Math.abs(t.amount)) / px;
    }
    const v = priceOn(series, p.date);
    return v == null ? null : Math.max(units, 0) * v;
  });
}
