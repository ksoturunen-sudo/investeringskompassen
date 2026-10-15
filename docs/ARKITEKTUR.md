# Arkitektur – Investeringskompassen

## Översikt

Installerbar webbapp (PWA) för mobil och dator, publicerad med GitHub Pages. Inga byggsteg och inga
tredjepartsbibliotek i appen. Ett valfritt moln (Supabase, region Stockholm) ger synk och automatiska kurser.

```
 Webbläsare (GitHub Pages)                               Supabase (eu-north-1)
 ┌──────────────────────────────────────────┐            ┌──────────────────────────────┐
 │ ui/views  ── core (beräkningar, import)   │            │ Auth (Google-inloggning)     │
 │    │                                      │  HTTPS     │ ik_vaults (endast chiffertext)│
 │ storage/localStore ── cloud/sync ─────────┼──────────► │ Edge Function "quotes" ──────┼──► EODHD
 │                       cloud/crypto (AES)  │            │ ik_prices (kurscache)        │
 │ prices/cloudProvider ─────────────────────┼──────────► │                              │
 └──────────────────────────────────────────┘            └──────────────────────────────┘
```

| Modul | Ansvar | Kontrakt |
|---|---|---|
| `src/core/csv.js`, `core/importers/avanza.js` | Avanza-fil → `Transaction[]` | `contracts/transaction.schema.json` |
| `src/core/portfolio.js` | Innehav, GAV, resultat, utdelning, fördelning | `contracts/holding.schema.json` |
| `src/core/analytics.js` | Typ/region, målfördelning, utdelningsprognos, utveckling över tid, indexjämförelse | – (rena funktioner, testade) |
| `src/core/snapshot.js` | All användardata som ett dokument; deterministisk sammanslagning | `contracts/snapshot.schema.json` |
| `src/storage/localStore.js` | Lokal lagring | `contracts/storage.md` |
| `src/cloud/auth.js` | Google-inloggning (OAuth 2.0 + PKCE) mot Supabase Auth | – |
| `src/cloud/crypto.js` | AES-GCM-256, nyckel via PBKDF2-SHA256 600 000 iterationer | – |
| `src/cloud/sync.js` | Krypterad synk med versionsnummer (optimistisk låsning) | `ik_vaults` |
| `src/prices/cloudProvider.js` + `supabase/functions/quotes` | Kurser och kurshistorik | `contracts/price-provider.md` |
| `supabase/migrations/` | Databasschema, behörigheter (RLS) | – |

## Säkerhet (OWASP ASVS / Top 10)

- **Totalsträckskryptering**: användardata krypteras i webbläsaren med en lösenfras innan den skickas.
  Servern lagrar bara chiffertext, salt och IV. Fel lösenfras upptäcks via AES-GCM:s autentisering.
  Nyckeln kan sparas på enheten som *icke-exporterbar* CryptoKey (IndexedDB).
- **Autentisering**: Google via Supabase Auth, authorization code-flöde med PKCE (S256). Inga lösenord i appen.
- **Behörighet**: radnivåsäkerhet (RLS) – en användare når bara sin egen rad, och bara om e-postadressen finns i
  `ik_allowed_users` (ägaren). Kurstabeller och API-räknare är bara åtkomliga för servern.
  Behörighetsfunktionen ligger i ett icke-exponerat schema (`ik_private`).
- **Hemligheter**: EODHD-nyckeln finns bara som hemlighet i Supabase. Den publika Supabase-nyckeln i appen är avsedd att vara publik.
- **Kostnads-/missbruksskydd**: max antal EODHD-anrop per dag räknas atomärt i databasen; svar cachas.
- **Webbsäkerhet**: Content Security Policy (endast egna skript, anslutning endast till egna Supabase-projektet),
  ingen `innerHTML`, validering av all indata (importfiler, backup-filer, serversvar), CORS begränsat till appens adress.
- **Leverantörskedja**: inga beroenden i appen; servern använder en låst version av `@supabase/supabase-js`.
  GitHub Actions låsta till commit-SHA, Dependabot, gitleaks, secret scanning och push protection.

## Kända begränsningar och risker

- Glömd lösenfras = synkad data går inte att läsa (lokal data och Avanza-filen finns kvar).
- localStorage på enheten är inte krypterat; den som har tillgång till upplåst enhet kan läsa datan.
- Åtkomsttoken sparas i localStorage (skyddas av strikt CSP mot XSS).
- EODHD:s gratisnivå: 20 anrop/dag och ett års historik. Täckning av svenska fonder är inte garanterad.
- Supabase-projektet innehåller även tabeller från ett tidigare, inaktivt quiz-projekt (rörs inte).
