# Projektlogg – Investeringskompassen

## 2026-10-15 – GitHub och publicering

**Gjort**
- Offentligt repo: https://github.com/ksoturunen-sudo/investeringskompassen (användarens val – gratis GitHub Pages kräver offentligt repo; ingen personlig data finns i koden, egna .csv-filer stoppas av .gitignore).
- Appen publicerad med GitHub Pages: https://ksoturunen-sudo.github.io/investeringskompassen/ – testad i mobilstorlek och installerad på hemskärmen i användarens mobil (bekräftat av användaren).
- GitHub CLI 2.102.0 installerad i ~/.local/bin (kontrollsumma verifierad), inloggning via engångskod.
- CI: tester + hemlighetsskanning (gitleaks), actions låsta till exakta commit-SHA, Dependabot för uppdateringar. Secret scanning och push protection påslaget i repot.
- Första CI-körningen: testerna godkända; hemlighetsskanningen fallerade enbart för att första pushen innehöll rot-commit (känd begränsning i gitleaks-action). Löst från och med nästa push.

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
1. Automatiska kurser: liten server-del enligt `contracts/price-provider.md` – kräver val av kursleverantör.
2. Synk mellan mobil och dator (kräver inloggning och lagring i molnet).
3. Fler funktioner: utveckling över tid (graf), jämförelse mot index, skatteunderlag, larm vid målkurs.
