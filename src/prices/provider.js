// Kontrakt för kurskällor (se contracts/price-provider.md).
//
// En PriceProvider är ett objekt med:
//   id: string
//   label: string
//   getQuotes(instruments: {key, isin, name, currency}[]) → Promise<Record<key, {price:number, date:string}>>
//   (price i SEK per andel, date ÅÅÅÅ-MM-DD)
//
// Grundversionen har ingen automatisk kurskälla: Avanza erbjuder inget öppet API och
// gratis kurstjänster kan inte anropas direkt från webbläsaren. En kurskälla kräver en
// liten server-del (se PROJEKTLOGG.md, "Nästa steg"). Till dess används manuella kurser
// eller senaste affärskurs från importerade transaktioner.

/** Kurskälla som inte hämtar något – platshållare tills en riktig källa kopplas in. */
export const noProvider = {
  id: 'none',
  label: 'Ingen automatisk kurskälla',
  async getQuotes() { return {}; },
};

/** Exempel på hur en riktig kurskälla kopplas in via en egen server-del. */
export function createHttpProvider(baseUrl) {
  return {
    id: 'http',
    label: `Kurser från ${baseUrl}`,
    async getQuotes(instruments) {
      const res = await fetch(`${baseUrl}/quotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruments: instruments.map(({ key, isin, name, currency }) => ({ key, isin, name, currency })) }),
      });
      if (!res.ok) throw new Error(`Kurskällan svarade ${res.status}`);
      const data = await res.json();
      const out = {};
      for (const [key, q] of Object.entries(data.quotes ?? {})) {
        if (Number.isFinite(q?.price) && /^\d{4}-\d{2}-\d{2}$/.test(q?.date)) out[key] = { price: q.price, date: q.date };
      }
      return out;
    },
  };
}
