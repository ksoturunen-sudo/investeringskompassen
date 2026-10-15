# Kontrakt: Lagring (Repository)

Implementeras i `src/storage/localStore.js` (lokalt i webbläsaren). En framtida server- eller synkversion ska ha samma metoder.

| Metod | Beskrivning |
|---|---|
| `loadTransactions()` | Alla transaktioner (`Transaction[]`) |
| `addTransactions(list)` | Lägger till; kända `id` hoppas över. Returnerar `{ added, duplicates }` |
| `loadPrices()` / `setPrice(key, price \| null)` | Manuella kurser i SEK |
| `mergeProviderPrices(quotes)` | Kurser från kurskälla, skriver inte över manuella |
| `loadWatchlist()` / `saveWatchlist(items)` | Bevakningslista |
| `clearAll()` | Raderar allt lokalt |
