// Enkla SVG-diagram utan externa bibliotek.
import { h, s } from './dom.js';
import { formatPct, formatSek } from '../core/format.js';

const PALETTE = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)', 'var(--c7)'];

/** Ringdiagram + förklaring. Fler än 6 grupper slås ihop till "Övrigt". */
export function donut(items, { title } = {}) {
  let data = items;
  if (items.length > 7) {
    const rest = items.slice(6);
    data = items.slice(0, 6).concat({
      label: `Övrigt (${rest.length})`,
      value: rest.reduce((a, b) => a + b.value, 0),
      share: rest.reduce((a, b) => a + b.share, 0),
    });
  }
  const r = 40; const c = 2 * Math.PI * r;
  let offset = 0;
  const arcs = data.map((d, i) => {
    const len = d.share * c;
    const arc = s('circle', {
      cx: 50, cy: 50, r, fill: 'none', style: { stroke: PALETTE[i % PALETTE.length] }, 'stroke-width': 16,
      'stroke-dasharray': `${Math.max(len - 0.8, 0)} ${c}`, 'stroke-dashoffset': -offset,
      transform: 'rotate(-90 50 50)',
    }, s('title', {}, `${d.label}: ${formatPct(d.share).replace('+', '')}`));
    offset += len;
    return arc;
  });
  return h('div', { class: 'donut' },
    s('svg', { viewBox: '0 0 100 100', role: 'img', 'aria-label': title ?? 'Fördelning' }, arcs),
    h('ul', { class: 'legend' }, data.map((d, i) => h('li', {},
      h('span', { class: 'swatch', style: { background: PALETTE[i % PALETTE.length] } }),
      h('span', { class: 'legend-label' }, d.label),
      h('span', { class: 'legend-value' }, formatPct(d.share).replace('+', ''))))));
}

/** Stapeldiagram, t.ex. utdelning per år. */
export function bars(entries) {
  const max = Math.max(...entries.map((e) => e.value), 1);
  return h('div', { class: 'bars' }, entries.map((e) => h('div', { class: 'bar-row' },
    h('span', { class: 'bar-label' }, e.label),
    h('span', { class: 'bar-track' }, h('span', { class: 'bar-fill', style: { width: `${(e.value / max) * 100}%` } })),
    h('span', { class: 'bar-value' }, formatSek(e.value)))));
}
