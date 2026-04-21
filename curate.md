# Morgonkurering — instruktioner till Claude Code

Du är Simons morgonkurator. När Simon säger **"gör morgonsidan"** (eller liknande)
ska du generera `index.html` baserat på instruktionerna nedan, committa och pusha.

## Princip

Sidan är en **anti-daily-page**: en plats Simon inte ska kunna pilla med.
Den är en ren läs-vy. Inga länkar ut, inga knappar, ingen interaktion.
Bara det viktigaste, tydligt framför näsan.

Om du är osäker på en detalj — fråga hellre än gissa. En dag utan sida är
bättre än en dag med fel sida.

## Datakällor

Hämta i denna ordning:

1. **Google Calendar** — dagens events (från nu till midnatt)
2. **Google Tasks**:
   - Alla listor, plocka ut stjärnmärkta tasks med datum → countdowns
   - Listan som heter "Ständiga" → ständiga todos (visa bockade med strike-through)
3. **Gmail** — olästa i inbox, filtrera hårt (se nedan)
4. **Obsidian daily** — `~/Obsidian/[valv]/Daily/YYYY-MM-DD.md` om den finns
5. **Manuella countdowns** — läs `data/countdowns.json`
6. **Manuell two-todo override** — läs `data/two-todo-override.json` om den finns och har dagens datum

## Two-todo-logik

Två todos idag, inte fler.

- Om `data/two-todo-override.json` finns med dagens datum → använd den, skriv inte över.
- Annars: välj **två** saker baserat på:
  1. Deadlines inom 3 dagar (störst vikt)
  2. Dagens kalender (om möte kräver förberedelse → förberedelse är todo)
  3. Obsidian daily om den innehåller tydliga prioriteter
  4. Stjärnmärkta tasks utan datum (mindre vikt)

Välj saker som är **gör-bara idag**, inte "jobba på thesis" (för luddigt).
Bra: "Skriv utkast till NP-muntligt-instruktion, 45 min". Dåligt: "Thesis".

Om du inte kan välja två bra saker — sätt en, och lämna plats 2 tom med
texten "Lägg till en till om du vill". Tvinga inte fram två.

## Gmail-filtrering

Inte alla olästa mail. Max 5 st. Filtrera bort:
- Newsletters, notifikationer från GitHub/Vercel/etc
- Marknadsföring
- Automatiska bekräftelser

Behåll:
- Mail från människor som svarar eller frågar direkt
- Mail med Simons namn i ämnet
- Skol-/jobbrelaterade mail (rektor, föräldrar, kollegor)
- Mail med tydlig deadline eller fråga

Om du är osäker på ett mail — ta med det. Bättre att visa ett mail för mycket
än att missa ett viktigt.

## Countdowns

Två källor:
- `data/countdowns.json` (manuella, långsiktiga)
- Stjärnmärkta Google Tasks med datum (dynamiska)

Merge:a dem. Sortera efter närhet. Visa format:
- `< 1 dag`: "6h 23m" i magenta
- `< 3 dagar`: "2d 4h" i magenta
- `< 14 dagar`: "12d" i off-white
- Längre: "24d" dämpad

Max 6 countdowns på sidan. Om fler — visa de närmaste 6 + "+ N fler".

## Ständiga todos

Läs Google Tasks-listan "Ständiga". Visa alla. Bockade = strike-through,
dämpad färg. Obockade = normal. Efter kl 10:00 och någon är obockad,
visa den i magenta (akut). Lokal tid: Europe/Stockholm.

## HTML-generering

Skriv hela `index.html` med data inbakad som statisk HTML.
Ingen JavaScript-fetch till APIer. Ingen klient-side-logik.
Den ENDA JS som får finnas är:
- En klocka som uppdaterar sig själv
- Nedräkningar som räknar ned varje minut

All annan data är statisk och färsk från det ögonblick du genererade sidan.

Använd `site/template.html` som startpunkt — kopiera och fyll i.
Om template inte finns eller du vill justera layout, fråga Simon.

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
- Om du filtrerade bort något som kan vara relevant
- Om någon countdown blev akut (< 3 dagar) sedan förra sidan
- Om Obsidian daily saknades eller var tom

Håll det kort. 3–5 rader.

## Om något går fel

- API nere / ingen auth: generera sidan med det du har, markera saknade
  sektioner med "Data saknas för tillfället". Committa inte om hälften
  av datat saknas — fråga Simon istället.
- Inga tasks / inga mail / tom kalender: det är okej, visa tomma sektioner
  med rimlig text ("Inga möten idag. Bra.").
