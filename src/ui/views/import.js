import { h } from '../dom.js';
import { importAvanzaCsv } from '../../core/importers/avanza.js';

const MAX_BYTES = 10 * 1024 * 1024;

// Avanzas fil kan vara UTF-8 eller Windows-1252; prova UTF-8 strikt först.
function decode(buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

export function importView({ store, refresh, navigate, ui }) {
  const status = h('div', { class: 'status', role: 'status', 'aria-live': 'polite' });
  if (ui.importMessage) status.append(ui.importMessage);

  const handleText = (text, label) => {
    try {
      const { transactions, errors } = importAvanzaCsv(text);
      const { added, duplicates } = store.addTransactions(transactions);
      ui.importMessage = h('div', { class: errors.length ? 'notice' : 'success' },
        h('strong', {}, `${label}: ${added} nya transaktioner importerade.`),
        duplicates ? h('p', {}, `${duplicates} fanns redan och hoppades över.`) : null,
        errors.length ? h('details', {}, h('summary', {}, `${errors.length} rader kunde inte läsas`),
          h('ul', {}, errors.slice(0, 50).map((e) => h('li', {}, e)))) : null);
      refresh();
    } catch (e) {
      ui.importMessage = h('div', { class: 'error' }, e.message);
      refresh();
    }
  };

  const handleFile = async (file) => {
    if (!file) return;
    if (file.size > MAX_BYTES) { ui.importMessage = h('div', { class: 'error' }, 'Filen är för stor (max 10 MB).'); refresh(); return; }
    handleText(decode(await file.arrayBuffer()), file.name);
  };

  const input = h('input', { type: 'file', accept: '.csv,text/csv', class: 'visually-hidden', id: 'file', onchange: (e) => handleFile(e.target.files[0]) });
  const drop = h('label', {
    for: 'file', class: 'dropzone',
    ondragover: (e) => { e.preventDefault(); drop.classList.add('over'); },
    ondragleave: () => drop.classList.remove('over'),
    ondrop: (e) => { e.preventDefault(); drop.classList.remove('over'); handleFile(e.dataTransfer.files[0]); },
  }, h('strong', {}, 'Välj fil eller släpp den här'), h('span', { class: 'muted small' }, 'Transaktionsfil från Avanza (.csv)'));

  const loadSample = async () => {
    const res = await fetch('samples/exempel-avanza.csv');
    handleText(await res.text(), 'Exempeldata');
  };

  const clearAll = () => {
    if (confirm('Radera alla importerade transaktioner, kurser och bevakningar från den här enheten?')) {
      store.clearAll();
      ui.importMessage = null;
      refresh();
    }
  };

  return h('section', {},
    h('h2', {}, 'Importera från Avanza'),
    h('ol', { class: 'steps card' },
      h('li', {}, 'Logga in på avanza.se i en dator.'),
      h('li', {}, 'Klicka på ', h('strong', {}, 'Min ekonomi'), ' och välj fliken ', h('strong', {}, 'Transaktioner'), '.'),
      h('li', {}, 'Välj tidsperiod – första gången: så långt tillbaka som möjligt.'),
      h('li', {}, 'Klicka på ', h('strong', {}, 'Exportera transaktioner'), '. En fil sparas i Hämtade filer.'),
      h('li', {}, 'Välj filen nedan. Samma fil kan importeras flera gånger – dubbletter hoppas över.')),
    input, drop, status,
    h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: loadSample }, 'Testa med exempeldata'),
      h('button', { class: 'btn', onclick: () => navigate('overview') }, 'Till översikten'),
      h('button', { class: 'btn danger', onclick: clearAll }, 'Radera all data')),
    h('p', { class: 'muted small' }, 'Dina uppgifter sparas bara i den här webbläsaren och skickas aldrig någonstans.'));
}
