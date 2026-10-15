import { h } from '../dom.js';
import { bars } from '../charts.js';
import { dividendsByPeriod } from '../../core/portfolio.js';
import { formatSek } from '../../core/format.js';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

export function dividendsView({ transactions, holdings }) {
  const { byYear, byMonth } = dividendsByPeriod(transactions);
  const years = Object.keys(byYear).sort();
  if (!years.length) {
    return h('section', {}, h('h2', {}, 'Utdelningar'), h('p', { class: 'muted' }, 'Inga utdelningar importerade ännu.'));
  }
  const year = years[years.length - 1];
  const payers = holdings.filter((x) => x.dividends > 0).sort((a, b) => b.dividends - a.dividends).slice(0, 10);

  return h('section', {},
    h('h2', {}, 'Utdelningar'),
    h('div', { class: 'grid2' },
      h('div', { class: 'card' }, h('h3', {}, 'Per år'),
        bars(years.map((y) => ({ label: y, value: byYear[y] })))),
      h('div', { class: 'card' }, h('h3', {}, `Per månad ${year}`),
        bars(MONTHS.map((m, i) => ({ label: m, value: byMonth[`${year}-${String(i + 1).padStart(2, '0')}`] ?? 0 }))))),
    h('div', { class: 'card' }, h('h3', {}, 'Största utdelarna (totalt)'),
      h('ul', { class: 'movers' }, payers.map((x) => h('li', {}, h('span', {}, x.name), h('span', {}, formatSek(x.dividends)))))));
}
