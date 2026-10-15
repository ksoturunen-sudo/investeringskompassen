import { h } from '../dom.js';
import { validateSnapshot } from '../../core/snapshot.js';

const MAX_BACKUP = 20 * 1024 * 1024;

function section(title, ...children) {
  return h('div', { class: 'card' }, h('h3', {}, title), ...children);
}

export function settingsView(ctx) {
  const { store, cloud, refresh, ui } = ctx;
  const user = cloud.user();
  const sync = cloud.sync.state();
  const settings = store.loadSettings();

  // ---- Konto och synk ----
  let accountPart;
  if (!user) {
    accountPart = [
      h('p', {}, 'Logga in för att synka dina uppgifter mellan mobil och dator och för att få automatiska kurser.'),
      h('button', { class: 'btn primary', onclick: () => cloud.signIn() }, 'Logga in med Google'),
    ];
  } else if (!cloud.sync.isUnlocked()) {
    const isNew = ui.vaultIsNew;
    const form = h('form', { class: 'form-stack', onsubmit: async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const p1 = String(f.get('p1') ?? ''); const p2 = String(f.get('p2') ?? '');
      if (isNew && p1 !== p2) { ui.syncError = 'Lösenfraserna är inte lika.'; refresh(); return; }
      try {
        ui.syncError = null; ui.unlocking = true; refresh();
        await cloud.sync.unlock(p1, { remember: f.get('remember') === 'on' });
      } catch (err) {
        ui.syncError = err.message;
      } finally { ui.unlocking = false; refresh(); }
    } },
    h('p', {}, isNew
      ? 'Välj en lösenfras som krypterar dina uppgifter. Ingen – inte ens databasen – kan läsa dem utan frasen. Skriv upp den på ett säkert ställe; glömd fras kan inte återställas.'
      : 'Ange din lösenfras för att låsa upp synken på den här enheten.'),
    h('label', {}, 'Lösenfras (minst 10 tecken)', h('input', { name: 'p1', type: 'password', autocomplete: isNew ? 'new-password' : 'current-password', minlength: 10, required: true })),
    isNew ? h('label', {}, 'Upprepa lösenfras', h('input', { name: 'p2', type: 'password', autocomplete: 'new-password', minlength: 10, required: true })) : null,
    h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'remember', checked: true }), 'Kom ihåg på den här enheten'),
    h('button', { class: 'btn primary', type: 'submit', disabled: ui.unlocking }, ui.unlocking ? 'Låser upp…' : (isNew ? 'Skapa och synka' : 'Lås upp')));
    if (ui.vaultIsNew === undefined) {
      cloud.sync.hasRemoteVault().then((exists) => { ui.vaultIsNew = !exists; refresh(); }).catch((e) => { ui.syncError = e.message; ui.vaultIsNew = false; refresh(); });
    }
    accountPart = [h('p', { class: 'muted small' }, `Inloggad som ${user.email}`), ui.vaultIsNew === undefined ? h('p', {}, 'Kontrollerar…') : form];
  } else {
    accountPart = [
      h('dl', { class: 'kv' },
        h('dt', {}, 'Inloggad som'), h('dd', {}, user.email),
        h('dt', {}, 'Synk'), h('dd', { class: sync.status === 'error' ? 'down' : '' }, sync.message || '–'),
        h('dt', {}, 'Senast'), h('dd', {}, sync.lastSync ? sync.lastSync.toLocaleString('sv-SE') : '–')),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: () => cloud.sync.syncNow().then(refresh) }, 'Synka nu'),
        h('button', { class: 'btn', onclick: async () => { await cloud.sync.lock(); ui.vaultIsNew = undefined; refresh(); } }, 'Glöm lösenfras på enheten'),
        h('button', { class: 'btn', onclick: async () => { await cloud.signOut(); ui.vaultIsNew = undefined; refresh(); } }, 'Logga ut')),
    ];
  }

  // ---- Kurser ----
  const ps = ui.priceStatus ?? settings.priceStatus ?? null;
  const pricePart = user
    ? [
      h('dl', { class: 'kv' },
        h('dt', {}, 'Kurskälla'), h('dd', {}, 'EODHD (dagens stängningskurs)'),
        h('dt', {}, 'Senast uppdaterad'), h('dd', {}, settings.lastPriceUpdate ?? 'Aldrig'),
        ps?.usage ? [h('dt', {}, 'Anrop idag'), h('dd', {}, `${ps.usage.calls} av ${ps.usage.limit}`)] : null),
      ps?.errors?.length ? h('p', { class: 'notice' }, ps.errors.join(' ')) : null,
      ps?.unmatchedNames?.length ? h('details', {}, h('summary', {}, `${ps.unmatchedNames.length} innehav saknar kurs hos kurskällan`),
        h('ul', {}, ps.unmatchedNames.map((n) => h('li', {}, n))),
        h('p', { class: 'hint' }, 'För dessa används manuell kurs eller senaste affärskurs.')) : null,
      h('button', { class: 'btn primary', disabled: ui.priceBusy, onclick: async () => { ui.priceBusy = true; refresh(); await cloud.updatePrices({ force: true }); ui.priceBusy = false; refresh(); } },
        ui.priceBusy ? 'Hämtar kurser…' : 'Uppdatera kurser nu'),
      h('p', { class: 'hint' }, 'Kurserna uppdateras automatiskt en gång per dag när du öppnar appen. Gratisnivån ger 20 anrop per dag; första gången kan det därför ta ett par dagar innan alla innehav har kurs.'),
    ]
    : [h('p', { class: 'muted' }, 'Logga in ovan för automatiska kurser.')];

  // ---- Jämförelseindex ----
  const indexPart = user ? [
    settings.indexSymbol
      ? h('p', {}, 'Jämför med: ', h('strong', {}, settings.indexLabel), ` (${settings.indexSymbol}) `,
        h('button', { class: 'btn small', onclick: () => { store.saveSettings({ indexSymbol: null, indexLabel: null, indexCurrency: null }); refresh(); } }, 'Ta bort'))
      : h('p', { class: 'hint' }, 'Välj ett index eller en indexfond att jämföra din utveckling med, t.ex. OMX Stockholm 30 eller en global indexfond.'),
    h('form', { class: 'toolbar', onsubmit: async (e) => {
      e.preventDefault();
      const q = String(new FormData(e.target).get('q') ?? '').trim();
      if (q.length < 2) return;
      ui.indexResults = 'loading'; refresh();
      try { ui.indexResults = await cloud.searchInstruments(q); } catch (err) { ui.indexResults = err.message; }
      refresh();
    } }, h('input', { name: 'q', type: 'search', placeholder: 'Sök t.ex. OMXS30 eller indexfond', 'aria-label': 'Sök jämförelseindex' }),
    h('button', { class: 'btn', type: 'submit' }, 'Sök')),
    ui.indexResults === 'loading' ? h('p', {}, 'Söker…') : null,
    typeof ui.indexResults === 'string' && ui.indexResults !== 'loading' ? h('p', { class: 'error' }, ui.indexResults) : null,
    Array.isArray(ui.indexResults) ? h('ul', { class: 'movers' }, ui.indexResults.length ? ui.indexResults.map((r) => h('li', {},
      h('span', {}, `${r.name} `, h('span', { class: 'muted small' }, `${r.symbol} · ${r.type ?? ''} · ${r.currency ?? ''}`)),
      h('button', { class: 'btn small', onclick: async () => {
        store.saveSettings({ indexSymbol: r.symbol, indexLabel: r.name, indexCurrency: r.currency ?? 'SEK' });
        ui.indexResults = null; ui.priceBusy = true; refresh();
        await cloud.updatePrices({ force: true }); ui.priceBusy = false; refresh();
      } }, 'Välj'))) : [h('li', {}, 'Inga träffar.')]) : null,
  ] : [h('p', { class: 'muted' }, 'Logga in ovan för att välja jämförelseindex.')];

  // ---- Backup ----
  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(store.exportSnapshot(), null, 1)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `investeringskompassen-backup-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const importBackup = async (file) => {
    if (!file) return;
    try {
      if (file.size > MAX_BACKUP) throw new Error('Filen är för stor.');
      const snap = validateSnapshot(JSON.parse(await file.text()));
      store.mergeSnapshot(snap);
      ui.backupMsg = { ok: true, text: `Backup inläst: ${snap.transactions.length} transaktioner slogs ihop med befintliga.` };
    } catch (e) {
      ui.backupMsg = { ok: false, text: e instanceof SyntaxError ? 'Filen är inte en backup-fil från Investeringskompassen.' : e.message };
    }
    refresh();
  };

  return h('section', {},
    h('h2', {}, 'Inställningar'),
    ui.authError ? h('p', { class: 'error' }, `Inloggningen misslyckades: ${ui.authError}`) : null,
    ui.syncError ? h('p', { class: 'error' }, ui.syncError) : null,
    section('Konto och synk', ...accountPart),
    section('Automatiska kurser', ...pricePart),
    section('Jämförelseindex', ...indexPart),
    section('Säkerhetskopia',
      h('p', { class: 'hint' }, 'Spara alla dina uppgifter som en fil, eller läs in en tidigare sparad fil. Inläsning slår ihop med det du redan har.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: exportBackup }, 'Spara backup-fil'),
        h('label', { class: 'btn' }, 'Läs in backup-fil', h('input', { type: 'file', accept: '.json,application/json', class: 'visually-hidden', onchange: (e) => importBackup(e.target.files[0]) }))),
      ui.backupMsg ? h('p', { class: ui.backupMsg.ok ? 'success' : 'error' }, ui.backupMsg.text) : null));
}
