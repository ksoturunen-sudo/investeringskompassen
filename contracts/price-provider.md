# Kontrakt: Kurskälla (PriceProvider)

Implementeras i `src/prices/`. Appen känner bara till detta gränssnitt, så kurskällan kan bytas utan att resten ändras.

```
getQuotes(instruments: { key, isin, name, currency }[])
  → Promise<Record<key, { price: number, date: "ÅÅÅÅ-MM-DD" }>>
```

- `price` är i **SEK per andel**.
- Okända instrument utelämnas (inget fel).
- Manuellt satta kurser skrivs aldrig över av en kurskälla (`mergeProviderPrices`).

## HTTP-variant (för framtida server-del)

`POST {baseUrl}/quotes`

Begäran: `{ "instruments": [{ "key": "SE0000000001", "isin": "SE0000000001", "name": "…", "currency": "SEK" }] }`

Svar: `{ "quotes": { "SE0000000001": { "price": 123.45, "date": "2026-10-15" } } }`
