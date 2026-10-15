# Kontrakt: Kurskälla

Appen anropar en egen server-del (Supabase Edge Function `quotes`, källkod i `supabase/functions/quotes/`).
Server-delen hämtar från EODHD, cachar i databasen (max ett anrop per värdepapper och dag) och räknar om
till SEK. EODHD-nyckeln finns bara på servern.

`POST {SUPABASE_URL}/functions/v1/quotes` – kräver inloggad användare som finns i `ik_allowed_users`.

## Hämta kurser

Begäran:
```json
{ "instruments": [{ "key": "SE0000000001", "isin": "SE0000000001", "currency": "SEK" }],
  "symbols": [{ "key": "INDEX:OMXS30.INDX", "symbol": "OMXS30.INDX", "currency": "SEK" }] }
```

Svar:
```json
{ "quotes": { "SE0000000001": { "symbol": "XXX.ST", "name": "…", "type": "Common Stock", "currency": "SEK", "price": 123.4, "priceSek": 123.4, "date": "2026-10-15" } },
  "history": { "SE0000000001": [["2025-09-10", 100.1], ["…", 0]] },
  "unmatched": ["NAMN:okänt"],
  "errors": ["Dagens kvot hos kurskällan är förbrukad. …"],
  "usage": { "calls": 12, "limit": 20 } }
```

- `history` och `priceSek` är i **SEK per andel** (omräknat med dagskurs för valutan).
- Instrument som inte hittas listas i `unmatched` – inget fel.
- Manuellt satta kurser i appen vinner om de är nyare.

## Sök (val av jämförelseindex)

Begäran: `{ "action": "search", "query": "OMXS30" }` → `{ "results": [{ "symbol", "name", "type", "currency", "isin" }] }`
