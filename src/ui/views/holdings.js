import { h } from '../dom.js';
import { formatNumber, formatPct, formatSek, formatSekExact, formatSignedSek, trend } from '../../core/format.js';
import { parseSwedishNumber } from '../../core/csv.js';

const COLUMNS = [
  { key: 'name', label: 'Innehav', get: (x) => x.name.toLowerCase() },
  { key: 'marketValue', label: 'Värde', get: (x) => x.marketValue },
  { key: 'unrealized', label: '+/- kr', get: (x) => x.unrealized },
  { key: 'unrealizedPct', label: '+/- %', get: (x) => x.unrealizedPct },
  { key: 'share', label: 'Andel', get: (x) => x.marketValue },
];

const PRICE_LABEL = { manual: 'Manuell kurs', provider: 'Hämtad kurs', 'last-trade': 'Senaste affärskurs' };

export function holdingsView({ holdings, store, refresh, ui }) {
  const open = holdings.filter((x) => x.quantity > 0);
  const total = open.reduce((s, x) => s + x.marketValue, 0);
  const sort = ui.holdingsSort ?? { key: 'marketValue', dir: -1 };
  const col = COLUMNS.find((c) => c.key === sort.key) ?? COLUMNS[1];
  const rows = [...open].sort((a, b) => {
    const va = col.get(a); const vb = col.get(b);
    return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
  });

  const setSort = (key) => {
    ui.holdingsSort = { key, dir: sort.key === key ? -sort.dir : -1 };
    refresh();
  };

  const editPrice = (x) => {
    const answer = prompt(`Ange aktuell kurs i SEK för ${x.name}\n(lämna tomt för att återgå till senaste affärskurs)`, formatNumber(x.price));
    if (answer === null) return;
    try {
      store.setPrice(x.key, answer.trim() === '' ? null : parseSwedishNumber(answer));
      refresh();
    } catch (e) {
      alert(e.message);
    }
  };

  const closed = holdings.filter((x) => x.quantity === 0);

  return h('section', {},
    h('h2', {}, 'Innehav'),
    h('div', { class: 'sortbar', role: 'group', 'aria-label': 'Sortera' },
      'Sortera: ',
      COLUMNS.map((c) => h('button', {
        class: `chip ${c.key === sort.key ? 'active' : ''}`, onclick: () => setSort(c.key),
      }, c.label + (c.key === sort.key ? (sort.dir < 0 ? ' ↓' : ' ↑') : '')))),
    h('div', { class: 'cards' }, rows.map((x) => h('article', { class: 'holding' },
      h('div', { class: 'holding-head' },
        h('div', {}, h('div', { class: 'holding-name' }, x.name),
          h('div', { class: 'muted small' }, [x.isin, x.accounts.join(', ')].filter(Boolean).join(' · '))),
        h('div', { class: 'right' },
          h('div', { class: 'holding-value' }, formatSek(x.marketValue)),
          h('div', { class: `small ${trend(x.unrealized)}` }, `${formatSignedSek(x.unrealized)} (${formatPct(x.unrealizedPct)})`))),
      h('dl', { class: 'facts' },
        fact('Antal', formatNumber(x.quantity)),
        fact('GAV', formatSekExact(x.avgCost)),
        fact('Kurs', formatSekExact(x.price)),
        fact('Andel', formatPct(total ? x.marketValue / total : 0).replace('+', '')),
        fact('Utdelning', formatSek(x.dividends)),
        fact('Realiserat', formatSignedSek(x.realized))),
      h('div', { class: 'holding-foot' },
        h('span', { class: `badge ${x.priceSource}` }, `${PRICE_LABEL[x.priceSource]} ${x.priceDate}`),
        h('button', { class: 'btn small', onclick: () => editPrice(x) }, 'Ändra kurs'))))),
    closed.length
      ? h('details', { class: 'card' },
        h('summary', {}, `Avslutade innehav (${closed.length})`),
        h('ul', { class: 'movers' }, closed.map((x) => h('li', {},
          h('span', {}, x.name),
          h('span', { class: trend(x.realized) }, `Realiserat ${formatSignedSek(x.realized)}`)))))
      : null);
}

function fact(label, value) {
  return h('div', {}, h('dt', {}, label), h('dd', {}, value));
}
