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

const compactSek = new Intl.NumberFormat('sv-SE', { notation: 'compact', maximumFractionDigits: 1 });

/**
 * Linjediagram med flera serier.
 * @param {string[]} dates
 * @param {{label:string, values:(number|null)[], color:string, dashed?:boolean}[]} series
 */
export function lineChart(dates, series, { title = 'Utveckling' } = {}) {
  const W = 640; const H = 280; const L = 72; const R = 12; const T = 12; const B = 34;
  const all = series.flatMap((s) => s.values).filter((v) => v != null);
  if (!all.length || dates.length < 2) return h('p', { class: 'muted' }, 'För lite data för ett diagram ännu.');
  const max = Math.max(...all) * 1.05; const min = Math.min(0, ...all);
  const x = (i) => L + (i / (dates.length - 1)) * (W - L - R);
  const y = (v) => T + (1 - (v - min) / (max - min || 1)) * (H - T - B);

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => min + f * (max - min));
  const grid = ticks.map((v) => [
    s('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'grid-line' }),
    s('text', { x: L - 6, y: y(v) + 4, 'text-anchor': 'end', class: 'axis-label' }, compactSek.format(v)),
  ]);
  const years = [];
  dates.forEach((d, i) => { if (i === 0 || d.slice(0, 4) !== dates[i - 1].slice(0, 4)) years.push([i, d.slice(0, 4)]); });
  const step = Math.ceil(years.length / 6);
  const xLabels = years.filter((_, i) => i % step === 0).map(([i, yr]) => s('text', { x: x(i), y: H - 8, 'text-anchor': 'middle', class: 'axis-label' }, yr));

  const paths = series.map((ser) => {
    let d = ''; let pen = false;
    ser.values.forEach((v, i) => {
      if (v == null) { pen = false; return; }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`; pen = true;
    });
    return s('path', { d, fill: 'none', 'stroke-width': 2.2, 'stroke-dasharray': ser.dashed ? '5 4' : null, style: { stroke: ser.color } });
  });

  // Hovring/tryck: visa värden för närmaste månad
  const marker = s('line', { y1: T, y2: H - B, class: 'hover-line', visibility: 'hidden' });
  const readout = h('div', { class: 'chart-readout', 'aria-live': 'polite' }, 'Peka i diagrammet för att se värden.');
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'line-chart', role: 'img', 'aria-label': title }, grid, xLabels, paths, marker);
  const show = (evt) => {
    const rect = svg.getBoundingClientRect();
    const px = ((evt.clientX - rect.left) / rect.width) * W;
    const i = Math.max(0, Math.min(dates.length - 1, Math.round(((px - L) / (W - L - R)) * (dates.length - 1))));
    marker.setAttribute('x1', x(i)); marker.setAttribute('x2', x(i)); marker.setAttribute('visibility', 'visible');
    readout.replaceChildren(h('strong', {}, dates[i]), ...series.map((ser) => h('span', {},
      h('span', { class: 'swatch', style: { background: ser.color } }), ` ${ser.label}: `,
      ser.values[i] == null ? '–' : formatSek(ser.values[i]))));
  };
  svg.addEventListener('pointermove', show);
  svg.addEventListener('pointerdown', show);

  return h('div', { class: 'line-wrap' }, svg,
    h('ul', { class: 'legend inline' }, series.map((ser) => h('li', {},
      h('span', { class: `swatch ${ser.dashed ? 'dashed' : ''}`, style: { background: ser.color } }), h('span', {}, ser.label)))),
    readout);
}
