// Väljer vilken notering hos EODHD som ska användas för en ISIN-kod.
// Ren funktion utan nätverk, så att den kan testas i Node (tests/listing.test.js) och användas av kurstjänsten.

/** Hemmabörs (EODHD:s börskod) och valutor som räknas som hemmavaluta, per ISIN-landskod. */
export const HOME = {
  SE: { exchange: 'ST', currencies: ['SEK'] },
  FI: { exchange: 'HE', currencies: ['EUR'] },
  DK: { exchange: 'CO', currencies: ['DKK'] },
  NO: { exchange: 'OL', currencies: ['NOK'] },
  US: { exchange: 'US', currencies: ['USD'] },
  DE: { exchange: 'XETRA', currencies: ['EUR'] },
  GB: { exchange: 'LSE', currencies: ['GBP', 'GBX'] },
};

const FUND_EXCHANGE = 'EUFUND';

/**
 * Väljer notering bland sökträffar (EODHD /search/{isin}).
 * Ordning: hemmabörsen enligt ISIN-landskoden → EODHD:s fondlista → annan notering i hemmavalutan
 * (primärnotering först). Noteringar i främmande valuta (t.ex. Frankfurt i EUR eller amerikanska
 * depåbevis i USD för en svensk aktie) väljs aldrig när landet är känt: de kan ha annan enhet eller
 * sällan handlas. Okänt land: primärnotering, annars första träffen.
 * @returns {object|null} den valda träffen, eller null om ingen passar
 */
export function pickListing(isin, hits) {
  const list = (Array.isArray(hits) ? hits : []).filter((h) => h && h.Code && h.Exchange && (!h.ISIN || h.ISIN === isin));
  const home = HOME[isin.slice(0, 2)];
  if (!home) return list.find((h) => h.isPrimary) ?? list[0] ?? null;
  const inHomeCurrency = list.filter((h) => home.currencies.includes(String(h.Currency ?? '').toUpperCase()));
  return list.find((h) => h.Exchange === home.exchange)
    ?? list.find((h) => h.Exchange === FUND_EXCHANGE)
    ?? inHomeCurrency.find((h) => h.isPrimary)
    ?? inHomeCurrency[0]
    ?? null;
}
