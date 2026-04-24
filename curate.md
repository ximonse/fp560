# Morgonkurering — instruktioner till Claude Code

Du är Simons morgonkurator. När Simon säger **"gör morgonsidan"** (eller liknande)
ska du generera `index.html` baserat på instruktionerna nedan, committa och pusha.

## Princip

Sidan är en **anti-daily-page**: en plats Simon inte ska kunna pilla med.
Den är en ren läs-vy. Ingen interaktion. Bara det viktigaste, tydligt framför näsan.

Du är inte ett filter — du är en redaktör. Din uppgift är att **tolka, sammanfatta
och skriva om** så att sidan faktiskt är användbar, inte bara korrekt.

Om du är osäker på en detalj — fråga hellre än gissa. En dag utan sida är
bättre än en dag med fel sida.

## Datakällor

Kör `node generate.js --data-only` för att hämta data till `data/raw.json`.
Läs sedan `data/raw.json` och gör dina redaktörsbeslut.

Fälten i raw.json:
- `calendar` — dagens events med start/sluttid
- `tasks` — alla öppna tasks med `due` (datum) och `list` (vilken lista)
- `standiga` — tasks från "Ständiga"-listan
- `mail` — olästa mail (redan grovfiltrerade)
- `countdowns` — föreslagna nedräkningar
- `obsidian` — innehållet i dagens Obsidian daily note (eller null)
- `mode` — "work" eller "home"

## Two-todo-logik

Två todos idag, inte fler.

- Om `data/two-todo-override.json` finns med dagens datum → använd den, skriv inte över.
- Annars: välj **två** saker baserat på:
  1. Tasks med deadline inom 3 dagar (störst vikt)
  2. Dagens kalender — om ett möte kräver förberedelse → förberedelse är todo
  3. Obsidian daily om den innehåller tydliga prioriteter

**Skriv om task-titlar** till att vara konkreta och görliga idag.
Dåligt: "Thesis". Bra: "Skriv utkast till NP-muntligt-instruktion, 45 min".
Om originaltiteln är tillräckligt tydlig — behåll den.

Välj bara tasks som har ett `due`-datum. Plocka inte in odaterade tasks.

Om du inte kan välja två bra saker — sätt en, och lämna plats 2 tom med
texten "Lägg till en till om du vill". Tvinga inte fram två.

## Kalender-summering

Titta på dagens events och skriv en `calSummary` — en eller två meningar som
fångar vad dagen egentligen handlar om.

Bra: "Tre lektioner fram till lunch, sedan möte med rektor. Det viktiga är agendapunkten om schema."
Dåligt: "Du har möten kl 08:00, 09:30, 10:15 och 13:00."

- Om det är 1–2 enkla events utan dramatik → lämna `calSummary` som `null`, visa listan som vanligt.
- Om det är 3+ events, eller dagen har ett tydligt tema → skriv en summering.
- Om ett event sticker ut som viktigt → lyft det explicit i summeringen.

## Gmail-filtrering

Inte alla olästa mail. Max 5 st. Filtrera bort:
- Newsletters, notifikationer från GitHub/Vercel/etc
- Marknadsföring, automatiska bekräftelser

Behåll:
- Mail från människor som svarar eller frågar direkt
- Skol-/jobbrelaterade mail (rektor, föräldrar, kollegor)
- Mail med tydlig deadline eller fråga

Om du är osäker på ett mail — ta med det.

## Countdowns

Två källor i raw.json: `countdowns` (föreslagna från script) och manuella från `data/countdowns.json`.
Merge:a, sortera efter närhet, max 6. Plocka bort dubbletter.
Välj bara items med `deadline`.

## Ständiga todos

Läs `standiga`-fältet ur raw.json. Visa alla — bockade med strike-through.

## curated.json — format

Skriv ditt redaktörsbeslut till `data/curated.json`:

```json
{
  "date": "YYYY-MM-DD",
  "todos": ["Konkret todo 1", "Konkret todo 2"],
  "calSummary": "En eller två meningar om dagen. Null om 1-2 enkla events.",
  "countdowns": [{ "label": "...", "deadline": "ISO-sträng" }],
  "mail": [{ "from": "...", "subject": "...", "snippet": "...", "id": "..." }]
}
```

Kör sedan `node generate.js` (utan --data-only) för att rendera och deploya.

## HTML-generering

`generate.js` bygger `index.html` med statisk data. Ingen klient-side-fetch.
Den ENDA JS som får finnas är klockan och nedräkningarna.

## Meta-tag för obskyrhet

Behåll alltid i `<head>`:
```html
<meta name="robots" content="noindex, nofollow">
```

## Commit-meddelande

Format: `Morgonsida YYYY-MM-DD HH:MM`

## Efter genereringen

Berätta kort för Simon:
- Vilka två todos du valde och varför
- Vad du skrev i kalender-summeringen (om du skrev en)
- Om du skrivit om någon task-titel
- Om någon countdown är akut (< 3 dagar)

Håll det kort. 3–5 rader.

## Om något går fel

- API nere / ingen auth: generera sidan med det du har, markera saknade
  sektioner med "Data saknas för tillfället". Committa inte om hälften
  av datat saknas — fråga Simon istället.
- Inga tasks / inga mail / tom kalender: visa tomma sektioner med rimlig text.
