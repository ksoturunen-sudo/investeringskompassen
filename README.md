# Investeringskompassen

Webbapp för att följa aktier och fonder, med import av transaktioner från Avanza.

**Funktioner:** översikt med nyckeltal och fördelning, innehav med GAV och avkastning, transaktionshistorik med sök, utdelningar per år/månad, bevakningslista med målkurs, import av Avanza-fil, fungerar i mobil och dator och kan installeras på hemskärmen.

## Starta lokalt

```bash
python3 -m http.server 8080 --bind 127.0.0.1
```

Öppna http://localhost:8080. Tester: http://localhost:8080/tests/run.html eller `npm test`.

Se [docs/ARKITEKTUR.md](docs/ARKITEKTUR.md) och [PROJEKTLOGG.md](PROJEKTLOGG.md).
