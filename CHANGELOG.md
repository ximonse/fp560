# Changelog

## 2026-04-27

### fp560 v2 — Fas 1 påbörjad

**Ny mapp `v2/` lever bredvid v1.** GitHub Pages serverar båda parallellt: `/fp560/` (v1, oförändrad) och `/fp560/v2/` (v2, ny). Rollback genom att radera `v2/`-mappen.

- `lib/daily-parser.js` — parser för Hermes Vault daily-note-sektioner. Items endast från `# Two-todo`, `# Todo`, `# Open loops`. Anteckningar, Signal, Logg, Claude och Veckans done är BARA kontext, aldrig items.
- `lib/v2-engine.js` — regelmotor. Bygger `v2/data.json` med strukturerad data. Hanterar sömn ("Sleep"-event < 15 min ignoreras), helgfönster (fre 16:00 → sön 18:00 filtrerar bort jobbgrejer), dedup mellan daily-note Todo och Google Tasks.
- `v2/index.html` — statisk sida som fetchar `data.json` och renderar i Fokus_panel-estetik (mobile-first, mörk bg, magenta-accent).
- `v2/data.json` — genererad, snapshot av nuvarande state. Regenereras varje `generate.js`-körning.
- `generate.js` — wire:at in v2-anrop efter v1-rendering. Try/catch isolerar v2 så att v1 alltid deployar även om v2-engine kraschar (disciplinregel: killswitch per feature).

**Vad v2 INTE har än:**
- "Det viktigaste nu"-prosa (Fas 2 — Claude fyller per dagdel)
- Påminnelse-prosa (Fas 2)
- Klient-side dagdelsväxling (Fas 3)

Disciplinregler för att undvika feature creep finns i `fokus_panel_proto/NOTES.md` (separat mapp utanför detta repo).

## 2026-04-25

### Designspec - personlig prioriteringsassistent

**Ny designspec** i `docs/2026-04-25-personlig-prioriteringsassistent-spec.md`:
- Produktvision for en Hermes-lik panel som svarar pa "Vad ar viktigast for mig just nu?"
- Textuell wireframe med sektionerna: narmaste timmen, idag, veckan framat, nasta vecka, viktiga mail och proaktiva paminnelser
- Konkret arkitektur for Calendar, Gmail, Tasks, Keep, vader, plats, Obsidian och eventuella halsosignaler
- Prioriteringsmotor beskriven som kombination av regelmotor + lokalt larande
- Tre kontextscenarier for olika tider pa dygnet
- Tydlig lista over vad som aktivt valts bort for att skydda minimalismen

Syftet med posten ar att bevara produktbeslutet som en faktisk artefakt i projektet, i samma anda som Hermes-floden har dokumenterats tidigare, utan att for den skull andra den genererade sidan eller datakopplingarna.

## 2026-04-24

### Redaktörsrollen — Claude som kurator, inte filter

**curate.md** omskriven från grunden:
- Claude definieras nu som *redaktör*, inte filter
- Explicit instruktion att skriva om task-titlar till konkreta, görliga uppgifter
- Ny sektion "Kalender-summering": vid 3+ events eller tydligt dagstema ska Claude skriva 1–2 meningar om vad dagen faktiskt handlar om, istället för att lista råa event
- Regel om odaterade tasks borttagen — Claude väljer **bara** tasks med `due`-datum (stänger hålet där Google Keep-noter utan datum plockades in)
- `curated.json`-formatet dokumenterat med nytt `calSummary`-fält

**AGENTS.md** synkad med curate.md:
- Samma editorial-roll, calSummary, datumkrav på tasks
- Obsidian-sökväg rättad: `C:\Users\ximon\Hermes Vault\YYYY-MM-DD.md` (ingen `\Daily\`-subfolder)

**generate.js** — calSummary-stöd:
- `buildHtml()` tar nu `calSummary` som parameter
- Om Claude skrivit en dagssummering visas den som ett stycke istället för evenementlistan
- `main()` läser `claudeCurated?.calSummary` och skickar vidare

### Städning

- `deploy.yml.txt` raderad (dublett av `.github/workflows/deploy.yml`, gjorde ingenting)
- `generate.js`: felaktig Obsidian-sökväg `Hermes Vault/Daily/` borttagen — daily notes ligger i valvets rot, inte i en subfolder

### Bakgrund: Keep-problemet

Google Keep-påminnelser med datum synkas automatiskt av Google till Google Tasks som riktiga tasks. `generate.js` hämtade alla task-listor utan källfiltrering, och `curate.md` instruerade Claude att använda odaterade tasks som fallback. Kombinationen gjorde att Keep-noter utan egentlig planering plockades in som two-todos. Lösningen var att kräva `due`-datum på alla tasks som väljs — inte att filtrera på källlista.
