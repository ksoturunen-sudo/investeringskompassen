import { test, assertEqual } from './harness.js';
import { pickListing } from '../supabase/functions/quotes/listing.js';

const hit = (Code, Exchange, Currency, extra = {}) => ({ Code, Exchange, Currency, ...extra });
const sym = (h) => (h ? `${h.Code}.${h.Exchange}` : null);

test('Börsval: hemmabörsen vinner över Frankfurt och depåbevis', () => {
  const isin = 'SE0000000001';
  const hits = [hit('7820', 'F', 'EUR', { ISIN: isin, isPrimary: true }), hit('XY', 'US', 'USD', { ISIN: isin }), hit('ABC', 'ST', 'SEK', { ISIN: isin })];
  assertEqual(sym(pickListing(isin, hits)), 'ABC.ST');
});

test('Börsval: hemmabörs per land (FI, DK, NO, US)', () => {
  const hits = (isin) => [hit('A', 'F', 'EUR', { ISIN: isin }), hit('B', 'HE', 'EUR', { ISIN: isin }), hit('C', 'CO', 'DKK', { ISIN: isin }),
    hit('D', 'OL', 'NOK', { ISIN: isin }), hit('E', 'US', 'USD', { ISIN: isin })];
  assertEqual(sym(pickListing('FI0000000001', hits('FI0000000001'))), 'B.HE');
  assertEqual(sym(pickListing('DK0000000001', hits('DK0000000001'))), 'C.CO');
  assertEqual(sym(pickListing('NO0000000001', hits('NO0000000001'))), 'D.OL');
  assertEqual(sym(pickListing('US0000000001', hits('US0000000001'))), 'E.US');
});

test('Börsval: svensk fond hittas i fondlistan', () => {
  const isin = 'SE0000000002';
  assertEqual(sym(pickListing(isin, [hit(isin, 'EUFUND', 'SEK', { ISIN: isin })])), `${isin}.EUFUND`);
});

test('Börsval: bara notering i främmande valuta → ingen träff', () => {
  const isin = 'SE0000000003';
  assertEqual(pickListing(isin, [hit('7820', 'F', 'EUR', { ISIN: isin, isPrimary: true })]), null);
  assertEqual(pickListing(isin, [hit('SAABY', 'US', 'USD', { ISIN: isin })]), null);
});

test('Börsval: träffar med annan ISIN ignoreras; okänt land tar primärnotering', () => {
  assertEqual(pickListing('SE0000000004', [hit('ABC', 'ST', 'SEK', { ISIN: 'SE0000000099' })]), null);
  const isin = 'XS0000000001';
  assertEqual(sym(pickListing(isin, [hit('A', 'F', 'EUR', { ISIN: isin }), hit('B', 'PA', 'EUR', { ISIN: isin, isPrimary: true })])), 'B.PA');
});
