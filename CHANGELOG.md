# Changelog

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
