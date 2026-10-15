// Startpunkt: kopplar ihop lagring, beräkningar, moln och vyer. Enkel hash-baserad navigering.
import { h } from './ui/dom.js';
import { createLocalStore } from './storage/localStore.js';
import { computeHoldings, summarize } from './core/portfolio.js';
import { createCloud } from './cloud/cloud.js';
import { overviewView } from './ui/views/overview.js';
import { holdingsView } from './ui/views/holdings.js';
import { developmentView } from './ui/views/development.js';
import { analysisView } from './ui/views/analysis.js';
import { transactionsView } from './ui/views/transactions.js';
import { dividendsView } from './ui/views/dividends.js';
import { watchlistView } from './ui/views/watchlist.js';
import { importView } from './ui/views/import.js';
import { settingsView } from './ui/views/settings.js';
import { moreView } from './ui/views/more.js';

// primary = syns i mobilens bottenmeny; övriga nås via "Mer".
const ROUTES = {
  overview: { label: 'Översikt', icon: '◎', view: overviewView, primary: true },
  holdings: { label: 'Innehav', icon: '▤', view: holdingsView, primary: true },
  development: { label: 'Utveckling', icon: '↗', view: developmentView, primary: true },
  dividends: { label: 'Utdelningar', short: 'Utdelning', icon: '✦', view: dividendsView, primary: true },
  analysis: { label: 'Analys', icon: '◔', view: analysisView },
  transactions: { label: 'Transaktioner', icon: '⇄', view: transactionsView },
  watchlist: { label: 'Bevakning', icon: '☆', view: watchlistView },
  import: { label: 'Import', icon: '⤓', view: importView },
  settings: { label: 'Inställningar', icon: '⚙', view: settingsView },
  more: { label: 'Mer', icon: '☰', view: moreView, primary: true, mobileOnly: true },
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

let renderQueued = false;
const cloud = createCloud(store, { onChange: () => { if (!renderQueued) { renderQueued = true; queueMicrotask(() => { renderQueued = false; render(); }); } } });

function render({ keepFocus } = {}) {
  const route = currentRoute();
  const transactions = store.loadTransactions();
  const holdings = computeHoldings(transactions, store.loadPrices());
  const summary = summarize(holdings, transactions);
  const routeIsSecondary = !ROUTES[route].primary;

  nav.replaceChildren(...Object.entries(ROUTES).map(([key, r]) => {
    const active = key === route || (key === 'more' && routeIsSecondary);
    return h('a', {
      href: `#${key}`,
      class: [active ? 'active' : '', r.primary ? 'primary' : 'secondary', r.mobileOnly ? 'mobile-only' : ''].join(' '),
      'aria-current': key === route ? 'page' : null,
    }, h('span', { class: 'nav-icon', 'aria-hidden': 'true' }, r.icon), h('span', { class: 'nav-label' }, r.label),
    h('span', { class: 'nav-short', 'aria-hidden': 'true' }, r.short ?? r.label));
  }));

  const ctx = { store, transactions, holdings, summary, ui, navigate, refresh: render, cloud, routes: ROUTES };
  main.replaceChildren(ROUTES[route].view(ctx));

  if (keepFocus) {
    const el = document.getElementById(keepFocus);
    if (el) { el.focus(); el.setSelectionRange?.(el.value.length, el.value.length); }
  }
}

window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
render();
cloud.start().then((authError) => { if (authError) { ui.authError = authError; navigate('settings'); } render(); });

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline-stöd är valfritt */ });
}
