// Totalsträckskryptering av användardata innan den lämnar enheten.
// AES-GCM 256 bit; nyckel härleds ur lösenfrasen med PBKDF2-SHA256 (600 000 iterationer,
// enligt OWASP Password Storage Cheat Sheet). Nyckeln är icke-exporterbar.

export const KDF_ITERATIONS = 600_000;

const enc = new TextEncoder();
const dec = new TextDecoder();
export const toB64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
export const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export function newSalt() {
  return toB64(crypto.getRandomValues(new Uint8Array(16)));
}

export async function deriveKey(passphrase, saltB64, iterations = KDF_ITERATIONS) {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromB64(saltB64), iterations },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

/** Krypterar ett JSON-värde. Ny slumpad IV varje gång. */
export async function encryptJson(key, value) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(value)));
  // Chunkad base64 för stora data
  const bytes = new Uint8Array(data);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { iv: toB64(iv), ciphertext: btoa(bin) };
}

/** Dekrypterar. Fel lösenfras ger ett tydligt fel. */
export async function decryptJson(key, { iv, ciphertext }) {
  try {
    const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, key, fromB64(ciphertext));
    return JSON.parse(dec.decode(data));
  } catch {
    throw new Error('Fel lösenfras – eller så är datan skadad.');
  }
}

// Nyckeln kan sparas på enheten (IndexedDB) som icke-exporterbar CryptoKey,
// så att lösenfrasen bara behöver skrivas en gång per enhet.
const DB = 'ik-keys'; const STORE = 'keys';
function idb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function saveDeviceKey(id, value) {
  const db = await idb();
  await new Promise((res, rej) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(value, id); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
}
export async function loadDeviceKey(id) {
  try {
    const db = await idb();
    return await new Promise((res, rej) => { const r = db.transaction(STORE).objectStore(STORE).get(id); r.onsuccess = () => res(r.result ?? null); r.onerror = () => rej(r.error); });
  } catch { return null; }
}
export async function deleteDeviceKey(id) {
  try {
    const db = await idb();
    await new Promise((res) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(id); tx.oncomplete = res; tx.onerror = res; });
  } catch { /* ignoreras */ }
}
