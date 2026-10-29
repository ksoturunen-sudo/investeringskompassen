# Projektlogg – Investeringskompassen

## 2026-10-29 – Inloggning, synk och kurser i drift

**Gjort**
- Användaren har kopplat in Google-inloggning och EODHD-nyckel. `kso.turunen@gmail.com` tillagd i `ik_allowed_users`.
- Bekräftat av användaren: inloggning och synk fungerar. Kontrollerat i databasen: ett krypterat valv finns (version 3).
- Kurskällan hittade alla 20 värdepapper som slagits upp (7 svenska aktier, 6 fonder via EODHD:s fondlista, 5 amerikanska, 1 dansk, 1 notering i Frankfurt). **Svenska fonder finns alltså hos EODHD.**
- Första dagen gick hela kvoten (20 anrop) åt till att slå upp värdepappren; kurser hämtas från och med nästa dag (minst 23 anrop behövs → två dagar).
- Supabase-databasen svarade långsamt efter två veckors vila (tillfälligt).
- Användaren lät Chrome föreslå lösenfrasen; den ligger i Googles lösenordshanterare.

**Att följa upp**
- Kontrollera i morgon att kurser och kurshistorik kommit in (`ik_prices`) och att fonder ger kurser på gratisnivån.
- En aktie matchades mot Frankfurt (EUR) i stället för hemmabörsen – kontrollera om kursen stämmer.
- Överväg att stänga av nya registreringar i Supabase Auth (behörighetslistan skyddar redan, men det minskar ytan ytterligare).

## 2026-10-15 – Kurser, synk, analys och utveckling

**Användarens beslut**
- Kurskälla: **EODHD** (officiell; gratisnivå 20 anrop/dag, 1 års historik; annars ca 20 USD/mån). Källa: eodhd.com/pricing, okt 2026. Täckning av svenska fonder ej verifierad – testas med användarens innehav.
- Databas: befintligt Supabase-projekt (Stockholm) – användaren bekräftade att det inte används. Det innehåller gamla quiz-tabeller som lämnas orörda; våra tabeller prefixas `ik_`.
- Inloggning: **Google** + **egen lösenfras** (totalsträckskryptering).

**Gjort**
- Nya sidor: Utveckling (graf över tid + jämförelse mot valfritt index), Analys (fördelning per typ/region, målfördelning), Inställningar (konto, synk, kurser, index, backup), Mer-meny på mobil.
- Utdelningsprognos 12 månader. Backup till/från fil.
- Lagringen omgjord till en ögonblicksbild (snapshot) med automatisk flytt från gamla formatet. **Ett fel hittades och rättades före publicering**: flytten sparade inte nya formatet direkt, så data kunde försvinna vid andra start. Täcks nu av test.
- Supabase: tabeller med RLS, kurstjänst (Edge Function `quotes`) driftsatt. Säkerhetsgranskning (Supabase advisors) utan anmärkningar för våra tabeller.
- 21 automatiska tester, alla godkända.

**Väntar på användaren**
- Skapa Google-inloggning (Google Cloud) och koppla in i Supabase.
- Ange adresser för inloggning i Supabase.
- Skapa EODHD-konto och lägga in nyckeln i Supabase.
- Meddela sin Google-adress så att den läggs in i `ik_allowed_users`.

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
1. Fler funktioner: skatteunderlag (K4 för depå), larm vid målkurs (push-notiser).
