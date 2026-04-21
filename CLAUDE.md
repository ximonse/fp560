# Fokus_panel

En anti-daily-page. Statisk morgonsida som genereras av Claude Code varje morgon.
Deploy: https://ximonse.github.io/fp560/

## Säg "gör morgonsidan"

Claude Code hämtar data, genererar `index.html`, committar och pushar.
GitHub Actions deployar till Pages inom ~30 sekunder.

## Struktur

```
Fokus_panel/
├── index.html                  ← genereras varje morgon
├── curate.md                   ← fullständiga instruktioner till Claude Code
├── countdowns.json             ← manuella nedräkningar (redigera fritt)
├── two-todo-override.json      ← sätt dagens datum + todos för att ta över
└── .github/workflows/deploy.yml
```

## Manuellt underhåll

- **countdowns.json** — lägg till långsiktiga deadlines som inte är Google Tasks
- **two-todo-override.json** — sätt `date` till dagens datum och fyll i `todos` för att styra two-todo manuellt
- **Google Tasks "Ständiga"** — håll listan uppdaterad, bockas i Tasks-appen
- **Stjärnmärk tasks med datum** — de blir automatiska countdowns

## Sidan är en läs-vy

Ingen interaktion. Ingen länkning ut. Bara det viktigaste tydligt framför näsan.
