// Kontrakt för en normaliserad transaktion. Speglar contracts/transaction.schema.json.
// Alla importörer (Avanza idag, andra banker senare) ska leverera objekt som klarar validateTransaction.

export const TRANSACTION_TYPES = Object.freeze([
  'buy', 'sell', 'dividend', 'interest', 'fee', 'tax', 'deposit', 'withdrawal', 'other',
]);

/**
 * @typedef {Object} Transaction
 * @property {string} id            Stabilt id (samma rad importerad två gånger ger samma id)
 * @property {string} date          ÅÅÅÅ-MM-DD
 * @property {string} account       Kontonamn/-nummer enligt banken
 * @property {string} type          En av TRANSACTION_TYPES
 * @property {string} rawType       Bankens egen benämning
 * @property {string} name          Värdepapper eller beskrivning
 * @property {string} isin          ISIN, tom sträng om saknas
 * @property {number} quantity      Antal (alltid positivt)
 * @property {number} price         Kurs i instrumentets valuta
 * @property {number} amount        Belopp i SEK (negativt = pengar ut från kontot)
 * @property {number} fee           Courtage i SEK
 * @property {string} currency      Instrumentets valuta
 * @property {number} fxRate        Växelkurs till SEK (1 för SEK)
 * @property {number|null} result   Bankens beräknade realiserade resultat vid sälj
 * @property {string} source        Vilken importör som skapade posten, t.ex. "avanza-csv"
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** @returns {string[]} lista med fel, tom om transaktionen är giltig */
export function validateTransaction(t) {
  const errors = [];
  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
  if (!t || typeof t !== 'object') return ['Transaktionen saknas'];
  if (typeof t.id !== 'string' || !t.id) errors.push('id saknas');
  if (typeof t.date !== 'string' || !DATE_RE.test(t.date)) errors.push(`ogiltigt datum: ${t.date}`);
  if (!TRANSACTION_TYPES.includes(t.type)) errors.push(`okänd typ: ${t.type}`);
  for (const k of ['account', 'rawType', 'name', 'isin', 'currency', 'source']) {
    if (typeof t[k] !== 'string') errors.push(`${k} måste vara text`);
  }
  for (const k of ['quantity', 'price', 'amount', 'fee', 'fxRate']) {
    if (!isNum(t[k])) errors.push(`${k} måste vara ett tal`);
  }
  if (isNum(t.quantity) && t.quantity < 0) errors.push('quantity får inte vara negativt');
  if (!(t.result === null || isNum(t.result))) errors.push('result måste vara tal eller null');
  return errors;
}

/** Nyckel som grupperar transaktioner till ett innehav. */
export function instrumentKey(t) {
  return t.isin ? t.isin : `NAMN:${t.name.trim().toLowerCase()}`;
}
