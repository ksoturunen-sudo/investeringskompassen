import { h } from '../dom.js';
import { formatNumber, formatSekExact, trend } from '../../core/format.js';

const TYPE_LABEL = {
  buy: 'Köp', sell: 'Sälj', dividend: 'Utdelning', interest: 'Ränta', fee: 'Avgift',
  tax: 'Skatt', deposit: 'Insättning', withdrawal: 'Uttag', other: 'Övrigt',
};

export function transactionsView({ transactions, ui, refresh }) {
  const filter = ui.txFilter ?? { text: '', type: '' };
  const text = filter.text.trim().toLowerCase();
  const list = transactions
    .filter((t) => (!filter.type || t.type === filter.type)
      && (!text || `${t.name} ${t.account} ${t.isin}`.toLowerCase().includes(text)))
    .sort((a, b) => b.date.localeCompare(a.date));
  const shown = list.slice(0, 300);

  const search = h('input', {
    type: 'search', placeholder: 'Sök värdepapper, konto eller ISIN', value: filter.text, 'aria-label': 'Sök',
    oninput: (e) => { ui.txFilter = { ...filter, text: e.target.value }; refresh({ keepFocus: 'tx-search' }); },
    id: 'tx-search',
  });
  const typeSelect = h('select', {
    'aria-label': 'Typ',
    onchange: (e) => { ui.txFilter = { ...filter, type: e.target.value }; refresh(); },
  }, h('option', { value: '' }, 'Alla typer'),
  Object.entries(TYPE_LABEL).map(([v, l]) => h('option', { value: v, selected: v === filter.type }, l)));

  return h('section', {},
    h('h2', {}, 'Transaktioner'),
    h('div', { class: 'toolbar' }, search, typeSelect),
    h('p', { class: 'muted small' }, `${list.length} transaktioner${list.length > shown.length ? ` (visar de ${shown.length} senaste)` : ''}`),
    h('div', { class: 'table-wrap' }, h('table', {},
      h('thead', {}, h('tr', {}, ['Datum', 'Typ', 'Värdepapper', 'Antal', 'Kurs', 'Belopp', 'Konto']
        .map((c) => h('th', {}, c)))),
      h('tbody', {}, shown.map((t) => h('tr', {},
        h('td', { class: 'nowrap' }, t.date),
        h('td', {}, h('span', { class: `tag ${t.type}` }, TYPE_LABEL[t.type])),
        h('td', {}, t.name),
        h('td', { class: 'num' }, t.quantity ? formatNumber(t.quantity) : ''),
        h('td', { class: 'num' }, t.price ? `${formatNumber(t.price)} ${t.currency}` : ''),
        h('td', { class: `num ${trend(t.amount)}` }, formatSekExact(t.amount)),
        h('td', { class: 'muted' }, t.account)))))));
}
