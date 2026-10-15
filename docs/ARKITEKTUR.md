# Arkitektur – Investeringskompassen

## Översikt

Installerbar webbapp (PWA) som fungerar i mobil och dator. Ingen server, inga externa beroenden, ingen byggprocess. All data stannar i användarens webbläsare.

```
index.html ─ src/app.js (navigering, sätter ihop delarna)
               │
   ┌───────────┼──────────────┬───────────────┐
   ▼           ▼              ▼               ▼
 ui/views   core/          storage/        prices/
 (skärmar)  (beräkningar,  (Repository-    (PriceProvider-
            importörer)     kontrakt)       kontrakt)
```

| Modul | Ansvar | Kontrakt |
|---|---|---|
| `src/core/csv.js` | Generell CSV-tolkning, svenska tal | – |
| `src/core/importers/avanza.js` | Avanza-fil → `Transaction[]` | `contracts/transaction.schema.json` |
| `src/core/transaction.js` | Datamodell och validering | `contracts/transaction.schema.json` |
| `src/core/portfolio.js` | Innehav, GAV, resultat, utdelning, fördelning | `contracts/holding.schema.json` |
| `src/storage/` | Lagring | `contracts/storage.md` |
| `src/prices/` | Kurskällor | `contracts/price-provider.md` |
| `src/ui/` | Skärmar och diagram (SVG) | – |

`core` har inga beroenden till webbläsaren och testas fristående (`tests/`). Nya banker läggs till som nya importörer som levererar samma `Transaction`-format.

## Säkerhet (OWASP)

- **Content Security Policy** i `index.html`: endast egna skript och stilar, inga externa anrop, ingen inline-kod.
- **Ingen `innerHTML`**: all text sätts via `textContent` (`src/ui/dom.js`) eftersom importerade filer är opålitlig indata (skydd mot XSS).
- **Indatavalidering**: varje importerad rad valideras mot kontraktet; felaktiga rader rapporteras och hoppas över. Max filstorlek 10 MB.
- **Inga inloggningsuppgifter**: appen kopplar inte upp sig mot Avanza och hanterar aldrig lösenord eller nycklar.
- **Integritet**: data lagras endast lokalt (localStorage). `no-referrer`.
- **Inga tredjepartsberoenden** → ingen leverantörskedjerisk i nuläget.

## Kända begränsningar

- Ingen automatisk kurskälla ännu (se PROJEKTLOGG.md).
- Data finns bara i den webbläsare där den importerats; ingen synk mellan mobil och dator.
- localStorage är inte krypterat; den som har tillgång till enheten och webbläsaren kan läsa datan.
