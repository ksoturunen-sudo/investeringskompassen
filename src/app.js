// Startpunkt: kopplar ihop lagring, beräkningar och vyer. Enkel hash-baserad navigering.
import { h } from './ui/dom.js';
import { createLocalStore } from './storage/localStore.js';
import { computeHoldings, summarize } from './core/portfolio.js';
import { overviewView } from './ui/views/overview.js';
import { holdingsView } from './ui/views/holdings.js';
import { transactionsView } from './ui/views/transactions.js';
import { dividendsView } from './ui/views/dividends.js';
import { watchlistView } from './ui/views/watchlist.js';
import { importView } from './ui/views/import.js';

const ROUTES = {
  overview: { label: 'Översikt', icon: '◎', view: overviewView },
  holdings: { label: 'Innehav', icon: '▤', view: holdingsView },
  transactions: { label: 'Transaktioner', short: 'Historik', icon: '⇄', view: transactionsView },
  dividends: { label: 'Utdelningar', short: 'Utdelning', icon: '✦', view: dividendsView },
  watchlist: { label: 'Bevakning', short: 'Bevaka', icon: '☆', view: watchlistView },
  import: { label: 'Import', icon: '⤓', view: importView },
};

const store = createLocalStore();
const ui = {}; // tillfälligt vy-tillstånd (sortering, filter) – sparas inte
const main = document.getElementById('main');
const nav = document.getElementById('nav');

const currentRoute = () => {
  const r = location.hash.replace('#', '');
  return r in ROUTES ? r : 'overview';
};
const navigate = (route) => { location.hash = route; };

function render({ keepFocus } = {}) {
  const route = currentRoute();
  const transactions = store.loadTransactions();
  const holdings = computeHoldings(transactions, store.loadPrices());
  const summary = summarize(holdings, transactions);

  nav.replaceChildren(...Object.entries(ROUTES).map(([key, r]) => h('a', {
    href: `#${key}`, class: key === route ? 'active' : '', 'aria-current': key === route ? 'page' : null,
  }, h('span', { class: 'nav-icon', 'aria-hidden': 'true' }, r.icon), h('span', { class: 'nav-label' }, r.label),
    h('span', { class: 'nav-short', 'aria-hidden': 'true' }, r.short ?? r.label))));

  const ctx = { store, transactions, holdings, summary, ui, navigate, refresh: render };
  main.replaceChildren(ROUTES[route].view(ctx));

  if (keepFocus) {
    const el = document.getElementById(keepFocus);
    if (el) { el.focus(); el.setSelectionRange?.(el.value.length, el.value.length); }
  }
}

window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
render();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline-stöd är valfritt */ });
}
