// Synk av användardata mellan enheter via ett krypterat valv (tabellen ik_vaults).
// Servern lagrar bara chiffertext. Konflikter löses med versionsnummer: vid krock hämtas
// senaste versionen, slås ihop lokalt (src/core/snapshot.js) och skickas igen.
import { authedFetch, currentUser } from './auth.js';
import { decryptJson, deleteDeviceKey, deriveKey, encryptJson, KDF_ITERATIONS, loadDeviceKey, newSalt, saveDeviceKey } from './crypto.js';
import { validateSnapshot } from '../core/snapshot.js';

const REST = '/rest/v1/ik_vaults';

async function fetchVault() {
  const res = await authedFetch(`${REST}?select=*`);
  if (!res.ok) throw new Error(res.status === 401 ? 'Inloggningen har gått ut.' : `Kunde inte hämta synkdata (${res.status}).`);
  const rows = await res.json();
  return rows[0] ?? null;
}

export function createSync(store, { onStatus = () => {} } = {}) {
  let key = null; let kdf = null; let version = 0;
  let timer = null; let running = false; let pending = false;
  const state = { status: 'off', message: '', lastSync: null };
  const set = (status, message = '') => { Object.assign(state, { status, message }); onStatus({ ...state }); };

  const deviceKeyId = () => `vault:${currentUser()?.id}`;

  async function push() {
    const body = { kdf, ...(await encryptJson(key, store.exportSnapshot())) };
    if (!version) {
      const res = await authedFetch(REST, { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(body) });
      if (res.status === 409) return false; // någon annan enhet hann först
      if (!res.ok) throw new Error(res.status === 403 || res.status === 401 ? 'Ditt konto har inte behörighet till synk.' : `Kunde inte spara (${res.status}).`);
      version = (await res.json())[0].version;
      return true;
    }
    const res = await authedFetch(`${REST}?user_id=eq.${currentUser().id}&version=eq.${version}`, {
      method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ ...body, version: version + 1 }),
    });
    if (!res.ok) throw new Error(`Kunde inte spara (${res.status}).`);
    const rows = await res.json();
    if (!rows.length) return false; // versionskrock
    version = rows[0].version;
    return true;
  }

  async function pullAndMerge() {
    const row = await fetchVault();
    if (!row) { version = 0; return false; }
    if (row.kdf?.salt !== kdf?.salt) throw new Error('Synkdatan är krypterad med en annan lösenfras. Logga ut och lås upp igen.');
    const remote = validateSnapshot(await decryptJson(key, row));
    version = row.version;
    return store.mergeSnapshot(remote, { notify: false });
  }

  async function syncNow() {
    if (!key) return;
    if (running) { pending = true; return; }
    running = true; set('syncing', 'Synkar…');
    try {
      for (let attempt = 0; attempt < 5; attempt++) {
        const changedLocally = await pullAndMerge();
        if (changedLocally) onStatus({ ...state, dataChanged: true });
        if (await push()) break;
      }
      state.lastSync = new Date();
      set('ok', 'Synkad');
    } catch (e) {
      set('error', e.message);
    } finally {
      running = false;
      if (pending) { pending = false; schedule(); }
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(syncNow, 1500);
  }

  store.onChange(() => { if (key) schedule(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && key) syncNow(); });

  return {
    state: () => ({ ...state }),
    isUnlocked: () => Boolean(key),
    /** Finns ett valv på servern sedan tidigare? (avgör om användaren ska välja eller ange lösenfras) */
    async hasRemoteVault() { return Boolean(await fetchVault()); },

    /** Låser upp med lösenfras. Skapar valv om inget finns. */
    async unlock(passphrase, { remember = true } = {}) {
      if (!passphrase || passphrase.length < 10) throw new Error('Lösenfrasen måste vara minst 10 tecken.');
      set('syncing', 'Låser upp… (kan ta några sekunder)');
      const row = await fetchVault();
      kdf = row?.kdf ?? { alg: 'PBKDF2-SHA256', iterations: KDF_ITERATIONS, salt: newSalt() };
      const candidate = await deriveKey(passphrase, kdf.salt, kdf.iterations);
      if (row) await decryptJson(candidate, row); // kastar vid fel lösenfras
      key = candidate; version = 0;
      if (remember) await saveDeviceKey(deviceKeyId(), { key, kdf });
      await syncNow();
    },

    /** Försöker låsa upp med nyckel sparad på enheten. */
    async resume() {
      if (!currentUser()) return false;
      const saved = await loadDeviceKey(deviceKeyId());
      if (!saved) { set('locked', 'Ange lösenfras för att synka.'); return false; }
      key = saved.key; kdf = saved.kdf; version = 0;
      await syncNow();
      return true;
    },

    async lock() {
      await deleteDeviceKey(deviceKeyId());
      key = null; kdf = null; version = 0;
      set('off', '');
    },

    syncNow,
  };
}
