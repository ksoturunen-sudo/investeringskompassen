# Kontrakt: Lagring (Repository)

Implementeras i `src/storage/localStore.js` (lokalt i webbläsaren). All användardata hålls som en
ögonblicksbild enligt `contracts/snapshot.schema.json`.

| Metod | Beskrivning |
|---|---|
| `onChange(fn)` | Anropas när användardata ändrats (används av synken) |
| `loadTransactions()` / `addTransactions(list)` | Transaktioner; kända `id` hoppas över → `{ added, duplicates }` |
| `loadPrices()` | Kurser i SEK per instrument: manuella + hämtade, nyaste vinner |
| `setPrice(key, price \| null)` | Manuell kurs (null = ta bort) |
| `loadQuotes()` / `saveQuotes(q)` | Senaste kurser från kurskälla (cache, synkas inte) |
| `loadHistory()` / `saveHistory(h)` | Kurshistorik i SEK `[[datum, kurs], …]` (cache, synkas inte) |
| `loadWatchlist()` / `addWatch(item)` / `removeWatch(id)` | Bevakningslista |
| `loadInstruments()` / `setInstrument(key, patch)` | Typ och region per innehav |
| `loadTargets()` / `saveTargets(t)` | Målfördelning |
| `loadSettings()` / `saveSettings(patch)` | Inställningar per enhet (synkas inte) |
| `exportSnapshot()` / `mergeSnapshot(s)` | Backup och synk |
| `clearAll()` | Raderar all data på enheten (inte i molnet) |
