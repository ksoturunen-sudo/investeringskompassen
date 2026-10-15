import { h } from '../dom.js';
import { parseSwedishNumber } from '../../core/csv.js';
import { formatSekExact } from '../../core/format.js';

// Bevakningslista: värdepapper man följer men inte äger, med målkurs och anteckning.
export function watchlistView({ store, refresh }) {
  const items = store.loadWatchlist();

  const onSubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const name = String(f.get('name') ?? '').trim();
    if (!name) return;
    try {
      const target = String(f.get('target') ?? '').trim();
      const current = String(f.get('current') ?? '').trim();
      store.addWatch({
        id: crypto.randomUUID(),
        name: name.slice(0, 100),
        target: target ? parseSwedishNumber(target) : null,
        current: current ? parseSwedishNumber(current) : null,
        note: String(f.get('note') ?? '').trim().slice(0, 500),
        added: new Date().toISOString().slice(0, 10),
      });
      refresh();
    } catch (err) {
      alert(err.message);
    }
  };

  const remove = (id) => { store.removeWatch(id); refresh(); };

  return h('section', {},
    h('h2', {}, 'Bevakning'),
    h('form', { class: 'card form', onsubmit: onSubmit },
      h('label', {}, 'Värdepapper', h('input', { name: 'name', required: true, maxlength: 100, placeholder: 't.ex. Investor B' })),
      h('label', {}, 'Aktuell kurs (SEK)', h('input', { name: 'current', inputmode: 'decimal' })),
      h('label', {}, 'Målkurs (SEK)', h('input', { name: 'target', inputmode: 'decimal' })),
      h('label', { class: 'wide' }, 'Anteckning', h('input', { name: 'note', maxlength: 500 })),
      h('button', { class: 'btn primary', type: 'submit' }, 'Lägg till')),
    items.length === 0 ? h('p', { class: 'muted' }, 'Inget bevakat ännu.') : null,
    h('div', { class: 'cards' }, items.map((i) => {
      const reached = i.target != null && i.current != null && i.current <= i.target;
      return h('article', { class: `holding ${reached ? 'hit' : ''}` },
        h('div', { class: 'holding-head' },
          h('div', {}, h('div', { class: 'holding-name' }, i.name), h('div', { class: 'muted small' }, `Tillagd ${i.added}`)),
          h('button', { class: 'btn small', onclick: () => remove(i.id), 'aria-label': `Ta bort ${i.name}` }, 'Ta bort')),
        h('dl', { class: 'facts' },
          h('div', {}, h('dt', {}, 'Kurs'), h('dd', {}, i.current != null ? formatSekExact(i.current) : '–')),
          h('div', {}, h('dt', {}, 'Målkurs'), h('dd', {}, i.target != null ? formatSekExact(i.target) : '–')),
          h('div', {}, h('dt', {}, 'Status'), h('dd', {}, reached ? 'Under målkurs!' : '–'))),
        i.note ? h('p', { class: 'small' }, i.note) : null);
    })));
}
