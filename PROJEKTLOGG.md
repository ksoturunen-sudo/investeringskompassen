# Projektlogg – Investeringskompassen

## 2026-10-15 – Grundversion

**Gjort**
- Byggt en installerbar webbapp (PWA) som fungerar i mobil och dator.
- Skärmar: Översikt, Innehav, Transaktioner, Utdelningar, Bevakning, Import.
- Import av Avanzas transaktionsfil, med dubblettskydd vid omimport.
- Automatiska tester (12 st, alla godkända) och kontrakt för datamodell, lagring och kurskälla.
- Testat i webbläsare i dator- och mobilstorlek med exempeldata.

**Beslut och varför**
- *Koppling till Avanza via filimport* (användarens val). Avanza har inget öppet API för privatpersoner; inofficiell inloggning skulle kräva att appen hanterar inloggningsuppgifter och bryter troligen mot villkoren. Källa: sökning okt 2026, bl.a. openbankingtracker.com/provider/avanza och github.com/Qluxzz/avanza (inofficiellt).
- *Avanzas filformat* kontrollerat mot github.com/dickwolff/Export-To-Ghostfolio (avanzaConverter.ts): semikolon, 13 kolumner. **Ej verifierat mot en riktig fil från användaren ännu.**
- *Ingen server, inga beroenden*: minsta möjliga attackyta och inget att underhålla. Data stannar på enheten.
- *GAV enligt genomsnittsmetoden*; vid sälj används Avanzas egen kolumn "Resultat" om den finns.

**Öppna frågor / att verifiera**
- Prova importen med användarens riktiga Avanza-fil (kolumnrubriker, teckenkodning, om "Belopp" inkluderar courtage).
- Enligt forumet Rika tillsammans har Avanza tagit bort kontonummer ur exporten – kontrollera vad "Konto"-kolumnen innehåller.

**Nästa steg (förslag)**
1. GitHub: skapa privat repo `investeringskompassen` på kontot ksoturunen-sudo och skicka upp koden (kräver inloggning av användaren).
2. Publicering så att appen kan öppnas i mobilen (t.ex. GitHub Pages eller Cloudflare Pages).
3. Automatiska kurser: liten server-del enligt `contracts/price-provider.md` – kräver val av kursleverantör.
4. Synk mellan mobil och dator (kräver inloggning och lagring i molnet).
5. Fler funktioner: utveckling över tid (graf), jämförelse mot index, skatteunderlag, larm vid målkurs.
