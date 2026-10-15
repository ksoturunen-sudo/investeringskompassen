import { h } from '../dom.js';
import { donut } from '../charts.js';
import { allocation } from '../../core/portfolio.js';
import { formatPct, formatSek, formatSignedSek, trend } from '../../core/format.js';

function kpi(label, value, sub, dir) {
  return h('div', { class: 'kpi' },
    h('div', { class: 'kpi-label' }, label),
    h('div', { class: `kpi-value ${dir ?? ''}` }, value),
    sub ? h('div', { class: `kpi-sub ${dir ?? ''}` }, sub) : null);
}

export function overviewView({ holdings, summary, navigate }) {
  if (summary.holdingsCount === 0) {
    return h('section', { class: 'empty' },
      h('h2', {}, 'Välkommen till Investeringskompassen'),
      h('p', {}, 'Börja med att importera dina transaktioner från Avanza, eller testa med exempeldata.'),
      h('button', { class: 'btn primary', onclick: () => navigate('import') }, 'Importera från Avanza'));
  }
  const open = holdings.filter((h0) => h0.quantity > 0);
  const top = [...open].sort((a, b) => b.unrealizedPct - a.unrealizedPct);

  return h('section', {},
    h('h2', {}, 'Översikt'),
    summary.staleCount > 0
      ? h('p', { class: 'notice' },
        `${summary.staleCount} innehav visar senaste affärskurs, inte dagens kurs. `,
        h('a', { href: '#holdings' }, 'Uppdatera kurser under Innehav.'))
      : null,
    h('div', { class: 'kpis' },
      kpi('Marknadsvärde', formatSek(summary.marketValue)),
      kpi('Orealiserat', formatSignedSek(summary.unrealized), formatPct(summary.unrealizedPct), trend(summary.unrealized)),
      kpi('Realiserat', formatSignedSek(summary.realized), null, trend(summary.realized)),
      kpi('Utdelning i år', formatSek(summary.dividendsThisYear), `Totalt ${formatSek(summary.dividendsTotal)}`),
      kpi('Investerat', formatSek(summary.costBasis), `${summary.holdingsCount} innehav`),
      kpi('Avgifter totalt', formatSek(summary.fees))),
    h('div', { class: 'grid2' },
      h('div', { class: 'card' }, h('h3', {}, 'Fördelning per innehav'), donut(allocation(holdings))),
      h('div', { class: 'card' }, h('h3', {}, 'Fördelning per konto'),
        donut(allocation(holdings, (x) => x.accounts.join(', ') || 'Okänt konto')))),
    h('div', { class: 'grid2' },
      moverCard('Bäst utveckling', top.slice(0, 3)),
      moverCard('Sämst utveckling', top.slice(-3).reverse())));
}

function moverCard(title, list) {
  return h('div', { class: 'card' }, h('h3', {}, title),
    h('ul', { class: 'movers' }, list.map((x) => h('li', {},
      h('span', {}, x.name),
      h('span', { class: trend(x.unrealized) }, formatPct(x.unrealizedPct))))));
}
