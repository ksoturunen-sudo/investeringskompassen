// Importör för Avanzas transaktionsexport (Min ekonomi → Transaktioner → Exportera transaktioner).
//
// Kolumnordningen är kontrollerad mot det öppna projektet Export-To-Ghostfolio
// (src/converters/avanzaConverter.ts): datum, konto, typ, beskrivning, antal, kurs, belopp,
// valuta, courtage, valutakurs, instrumentvaluta, isin, resultat. Semikolon som avgränsare.
// Rubrikerna matchas i första hand på namn; känns de inte igen används den kontrollerade ordningen.

import { parseCsv, parseSwedishNumber } from '../csv.js';
import { validateTransaction } from '../transaction.js';

export const SOURCE = 'avanza-csv';

const FIELDS = [
  'date', 'account', 'rawType', 'name', 'quantity', 'price', 'amount',
  'currency', 'fee', 'fxRate', 'instrumentCurrency', 'isin', 'result',
];

// Möjliga rubriknamn (gemener) per fält.
const HEADER_ALIASES = {
  date: ['datum'],
  account: ['konto'],
  rawType: ['typ av transaktion', 'typ'],
  name: ['värdepapper/beskrivning', 'värdepapper', 'beskrivning'],
  quantity: ['antal'],
  price: ['kurs'],
  amount: ['belopp'],
  currency: ['transaktionsvaluta', 'valuta'],
  fee: ['courtage', 'courtage (sek)'],
  fxRate: ['valutakurs'],
  instrumentCurrency: ['instrumentvaluta'],
  isin: ['isin'],
  result: ['resultat'],
};

/** Avanzas typtext → normaliserad typ. */
export function mapType(rawType) {
  const t = rawType.toLowerCase();
  if (t.includes('köp')) return 'buy';
  if (t.includes('sälj')) return 'sell';
  if (t.includes('utdelning')) return 'dividend';
  if (t.includes('ränt')) return 'interest'; // ränta, räntor
  if (t.includes('källskatt') || t.includes('skatt')) return 'tax';
  if (t.includes('insättning')) return 'deposit';
  if (t.includes('uttag')) return 'withdrawal';
  if (t.includes('avgift') || t.includes('övrigt')) return 'fee';
  return 'other';
}

function resolveColumns(header) {
  const normalized = header.map((h) => h.trim().toLowerCase());
  const map = {};
  for (const field of FIELDS) {
    const idx = normalized.findIndex((h) => HEADER_ALIASES[field].includes(h));
    if (idx >= 0) map[field] = idx;
  }
  const required = ['date', 'rawType', 'name', 'quantity', 'amount'];
  if (required.every((f) => f in map)) return map;
  if (header.length === FIELDS.length) {
    return Object.fromEntries(FIELDS.map((f, i) => [f, i]));
  }
  throw new Error(
    'Filen känns inte igen som en transaktionsexport från Avanza. '
    + `Hittade kolumnerna: ${header.join(', ')}`,
  );
}

// FNV-1a, 2 × 32 bitar → kort stabilt id. Inte kryptografiskt; används bara för dubblettkontroll.
function hashId(text) {
  let h1 = 0x811c9dc5; let h2 = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x811c9dc5);
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

/**
 * @param {string} text  Filens innehåll
 * @returns {{ transactions: import('../transaction.js').Transaction[], errors: string[] }}
 */
export function importAvanzaCsv(text) {
  const rows = parseCsv(text, ';');
  if (rows.length < 2) throw new Error('Filen innehåller inga transaktioner.');
  const cols = resolveColumns(rows[0]);
  const get = (row, f) => (f in cols ? (row[cols[f]] ?? '').trim() : '');

  const seen = new Map();
  const transactions = [];
  const errors = [];

  rows.slice(1).forEach((row, i) => {
    const line = i + 2;
    try {
      const rawKey = row.map((c) => c.trim()).join('|');
      const occurrence = (seen.get(rawKey) ?? 0) + 1;
      seen.set(rawKey, occurrence);

      const rawType = get(row, 'rawType');
      const fxRate = parseSwedishNumber(get(row, 'fxRate')) || 1;
      const resultText = get(row, 'result');
      const t = {
        id: `${SOURCE}:${hashId(`${rawKey}#${occurrence}`)}`,
        date: get(row, 'date').slice(0, 10),
        account: get(row, 'account'),
        type: mapType(rawType),
        rawType,
        name: get(row, 'name'),
        isin: get(row, 'isin'),
        quantity: Math.abs(parseSwedishNumber(get(row, 'quantity'))),
        price: Math.abs(parseSwedishNumber(get(row, 'price'))),
        amount: parseSwedishNumber(get(row, 'amount')),
        fee: Math.abs(parseSwedishNumber(get(row, 'fee'))),
        currency: get(row, 'instrumentCurrency') || get(row, 'currency') || 'SEK',
        fxRate,
        result: resultText === '' || resultText === '-' ? null : parseSwedishNumber(resultText),
        source: SOURCE,
      };
      const problems = validateTransaction(t);
      if (problems.length) throw new Error(problems.join('; '));
      transactions.push(t);
    } catch (e) {
      errors.push(`Rad ${line}: ${e.message}`);
    }
  });

  return { transactions, errors };
}
