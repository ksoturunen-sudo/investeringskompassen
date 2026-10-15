import { h } from '../dom.js';
import { lineChart } from '../charts.js';
import { indexComparison, timeline } from '../../core/analytics.js';
import { formatPct, formatSek, formatSignedSek, trend } from '../../core/format.js';

const RANGES = { '1y': ['1 år', 12], '3y': ['3 år', 36], all: ['Allt', Infinity] };

export function developmentView({ transactions, store, ui, refresh }) {
  if (!transactions.length) return h('section', {}, h('h2', {}, 'Utveckling'), h('p', { class: 'muted' }, 'Importera transaktioner först.'));

  const history = store.loadHistory();
  const settings = store.loadSettings();
  const indexKey = settings.indexSymbol ? `INDEX:${settings.indexSymbol}` : null;
  const all = timeline(transactions, history);
  const range = ui.devRange ?? 'all';
  const points = all.slice(-Math.min(all.length, RANGES[range][1]));
  const dates = points.map((p) => p.date);
  const hasValue = points.some((p) => p.value != null);
  const indexValues = indexKey && history[indexKey] ? indexComparison(points, transactions, history[indexKey]) : null;

  const series = [
    { label: 'Insatt kapital', values: points.map((p) => p.invested), color: 'var(--c7)', dashed: true },
    hasValue ? { label: 'Marknadsvärde', values: points.map((p) => p.value), color: 'var(--c1)' } : null,
    indexValues ? { label: `Samma pengar i ${settings.indexLabel ?? 'index'}`, values: indexValues, color: 'var(--c3)' } : null,
    { label: 'Utdelning (ackumulerad)', values: points.map((p) => p.dividends), color: 'var(--c2)' },
  ].filter(Boolean);

  const last = [...points].reverse().find((p) => p.value != null);
  const lastIdx = last ? points.lastIndexOf(last) : -1;
  const indexLast = indexValues && lastIdx >= 0 ? indexValues[lastIdx] : null;

  return h('section', {},
    h('h2', {}, 'Utveckling'),
    h('div', { class: 'seg', role: 'group', 'aria-label': 'Tidsperiod' }, Object.entries(RANGES).map(([k, [l]]) => h('button', {
      class: k === range ? 'active' : '', 'aria-pressed': k === range ? 'true' : 'false',
      onclick: () => { ui.devRange = k; refresh(); },
    }, l))),
    h('div', { class: 'card' }, lineChart(dates, series, { title: 'Portföljens utveckling' })),
    !hasValue ? h('p', { class: 'notice' }, 'Marknadsvärde över tid visas när automatiska kurser är påslagna (Inställningar). Nu visas insatt kapital och utdelningar.') : null,
    hasValue && points.some((p) => p.value == null)
      ? h('p', { class: 'hint' }, 'Marknadsvärdet visas bara för månader där kurshistorik finns för alla innehav (gratisnivån hos kurskällan ger ett år bakåt).') : null,
    last && indexLast != null ? h('div', { class: 'kpis' },
      h('div', { class: 'kpi' }, h('div', { class: 'kpi-label' }, 'Din portfölj'), h('div', { class: 'kpi-value' }, formatSek(last.value))),
      h('div', { class: 'kpi' }, h('div', { class: 'kpi-label' }, `Samma pengar i ${settings.indexLabel ?? 'index'}`), h('div', { class: 'kpi-value' }, formatSek(indexLast))),
      h('div', { class: 'kpi' }, h('div', { class: 'kpi-label' }, 'Skillnad'),
        h('div', { class: `kpi-value ${trend(last.value - indexLast)}` }, formatSignedSek(last.value - indexLast)),
        h('div', { class: `kpi-sub ${trend(last.value - indexLast)}` }, formatPct((last.value - indexLast) / indexLast)))) : null,
    !indexKey ? h('p', { class: 'hint' }, 'Tips: välj ett jämförelseindex under Inställningar.') : null);
}
