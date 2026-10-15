import { h } from '../dom.js';
import { donut } from '../charts.js';
import { allocation } from '../../core/portfolio.js';
import { classify, compareToTargets, REGIONS, TYPES } from '../../core/analytics.js';
import { formatPct, formatSek } from '../../core/format.js';

const MODES = { type: 'Typ', region: 'Region', holding: 'Innehav' };

export function analysisView({ holdings, store, refresh, ui }) {
  const open = holdings.filter((x) => x.quantity > 0);
  if (!open.length) return h('section', {}, h('h2', {}, 'Analys'), h('p', { class: 'muted' }, 'Importera transaktioner först.'));

  const instruments = store.loadInstruments();
  const quotes = store.loadQuotes();
  const cls = new Map(open.map((x) => [x.key, classify(x, instruments, quotes)]));
  const byType = allocation(open, (x) => cls.get(x.key).type);
  const byRegion = allocation(open, (x) => cls.get(x.key).region);

  const targets = store.loadTargets();
  const mode = targets.mode in MODES ? targets.mode : 'type';
  const groupFn = { type: (x) => cls.get(x.key).type, region: (x) => cls.get(x.key).region, holding: (x) => x.name }[mode];
  const current = allocation(open, groupFn);
  const modeTargets = targets.byMode?.[mode] ?? {};
  const rows = compareToTargets(current, modeTargets);
  const sumTargets = Object.values(modeTargets).reduce((s, v) => s + v, 0);

  const setMode = (m) => { store.saveTargets({ ...targets, mode: m }); refresh(); };
  const setTarget = (label, value) => {
    const n = Number(String(value).replace(',', '.'));
    const next = { ...modeTargets };
    if (!value || !Number.isFinite(n) || n <= 0) delete next[label]; else next[label] = Math.min(n, 100);
    store.saveTargets({ ...targets, mode, byMode: { ...targets.byMode, [mode]: next } });
    refresh();
  };

  return h('section', {},
    h('h2', {}, 'Analys'),
    h('div', { class: 'grid2' },
      h('div', { class: 'card' }, h('h3', {}, 'Fördelning per typ'), donut(byType)),
      h('div', { class: 'card' }, h('h3', {}, 'Fördelning per region'), donut(byRegion))),

    h('div', { class: 'card' },
      h('h3', {}, 'Målfördelning'),
      h('p', { class: 'hint' }, 'Ange hur du vill att portföljen ska vara fördelad. Appen visar hur långt ifrån du är och hur många kronor som skiljer.'),
      h('div', { class: 'seg', role: 'group', 'aria-label': 'Fördela efter' }, Object.entries(MODES).map(([m, l]) => h('button', {
        class: m === mode ? 'active' : '', onclick: () => setMode(m), 'aria-pressed': m === mode ? 'true' : 'false',
      }, l))),
      h('div', { class: 'table-wrap' }, h('table', { class: 'compare' },
        h('thead', {}, h('tr', {}, ['Grupp', 'Nu', 'Mål %', 'Skillnad', 'Kronor till mål'].map((c) => h('th', {}, c)))),
        h('tbody', {}, rows.map((r) => h('tr', {},
          h('td', {}, r.label),
          h('td', { class: 'num' }, formatPct(r.share).replace('+', '')),
          h('td', { class: 'num' }, h('input', {
            class: 'target-input', inputmode: 'decimal', value: modeTargets[r.label] ?? '', 'aria-label': `Mål för ${r.label} i procent`,
            onchange: (e) => setTarget(r.label, e.target.value),
          })),
          h('td', { class: `num ${r.targetPct ? (Math.abs(r.diffPct) < 0.02 ? '' : r.diffPct > 0 ? 'up' : 'down') : 'muted'}` },
            r.targetPct ? formatPct(r.diffPct) : '–'),
          h('td', { class: 'num' }, r.targetPct ? `${r.diffValue > 0 ? '+' : ''}${formatSek(r.diffValue)}` : '–')))))),
      h('p', { class: `hint ${sumTargets && Math.abs(sumTargets - 100) > 0.01 ? 'down' : ''}` },
        sumTargets ? `Summa mål: ${sumTargets.toLocaleString('sv-SE')} %${Math.abs(sumTargets - 100) > 0.01 ? ' – bör vara 100 %' : ''}` : 'Inga mål angivna ännu.'),
      h('p', { class: 'hint' }, '+ betyder att gruppen ligger under målet, − att den ligger över. Detta är en uträkning, inte en rekommendation.')),

    h('div', { class: 'card' },
      h('h3', {}, 'Typ och region per innehav'),
      h('p', { class: 'hint' }, 'Grå text = förslag (från kurskällan eller värdepapprets landskod). För fonder anger landskoden var fonden är registrerad, inte var den investerar – ändra vid behov.'),
      h('div', { class: 'table-wrap' }, h('table', {},
        h('thead', {}, h('tr', {}, ['Innehav', 'Typ', 'Region'].map((c) => h('th', {}, c)))),
        h('tbody', {}, open.map((x) => {
          const c = cls.get(x.key);
          const select = (field, options, value, isSet) => h('select', {
            class: `select-sm ${isSet ? '' : 'muted'}`, 'aria-label': `${field === 'type' ? 'Typ' : 'Region'} för ${x.name}`,
            onchange: (e) => { store.setInstrument(x.key, { [field]: e.target.value || undefined }); refresh(); },
          }, h('option', { value: '' }, isSet ? '(återställ förslag)' : value),
          options.map((o) => h('option', { value: o, selected: isSet && o === value }, o)));
          return h('tr', {},
            h('td', {}, x.name),
            h('td', {}, select('type', TYPES, c.type, c.typeIsSet)),
            h('td', {}, select('region', REGIONS, c.region, c.regionIsSet)));
        }))))));
}
