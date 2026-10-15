import { test, assertEqual, assertThrows } from './harness.js';
import { importAvanzaCsv, mapType } from '../src/core/importers/avanza.js';
import { validateTransaction } from '../src/core/transaction.js';

const HEADER = 'Datum;Konto;Typ av transaktion;Värdepapper/beskrivning;Antal;Kurs;Belopp;Transaktionsvaluta;Courtage;Valutakurs;Instrumentvaluta;ISIN;Resultat';

test('Avanza: typer mappas rätt', () => {
  assertEqual(['Köp', 'Sälj', 'Utdelning', 'Insättning', 'Uttag', 'Utländsk källskatt', 'Räntor'].map(mapType),
    ['buy', 'sell', 'dividend', 'deposit', 'withdrawal', 'tax', 'interest']);
});

test('Avanza: rad tolkas och klarar kontraktet', () => {
  const { transactions, errors } = importAvanzaCsv(`${HEADER}\n2026-08-20;ISK;Sälj;Bolag A;-10;1 050,00;10450,00;SEK;50,00;;SEK;SE0000000002;3830,50`);
  assertEqual(errors, []);
  const t = transactions[0];
  assertEqual([t.type, t.quantity, t.price, t.amount, t.fee, t.fxRate, t.result], ['sell', 10, 1050, 10450, 50, 1, 3830.5]);
  assertEqual(validateTransaction(t), []);
});

test('Avanza: okända rubriker men rätt antal kolumner använder kontrollerad ordning', () => {
  const { transactions } = importAvanzaCsv('a;b;c;d;e;f;g;h;i;j;k;l;m\n2026-01-01;K;Köp;X;1;10;-10;SEK;0;;SEK;SE1;-');
  assertEqual(transactions[0].type, 'buy');
});

test('Avanza: fel filformat ger tydligt fel', () => {
  assertThrows(() => importAvanzaCsv('namn,pris\nx,1'));
});

test('Avanza: identiska rader får olika id, omimport ger samma id', () => {
  const csv = `${HEADER}\n2026-01-01;K;Köp;X;1;10;-10;SEK;0;;SEK;SE1;-\n2026-01-01;K;Köp;X;1;10;-10;SEK;0;;SEK;SE1;-`;
  const a = importAvanzaCsv(csv).transactions.map((t) => t.id);
  const b = importAvanzaCsv(csv).transactions.map((t) => t.id);
  assertEqual(a[0] !== a[1], true);
  assertEqual(a, b);
});

test('Avanza: trasig rad rapporteras utan att stoppa importen', () => {
  const { transactions, errors } = importAvanzaCsv(`${HEADER}\nfel-datum;K;Köp;X;1;10;-10;SEK;0;;SEK;SE1;-\n2026-01-01;K;Köp;X;1;10;-10;SEK;0;;SEK;SE1;-`);
  assertEqual(transactions.length, 1);
  assertEqual(errors.length, 1);
});
