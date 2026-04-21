# Startsida

En anti-daily-page. En plats som inte går att pilla med, där dagens viktigaste finns tydligt framför näsan.

## Så här funkar det

1. På morgonen: öppna Claude Code i denna mapp.
2. Säg: **"gör morgonsidan"**
3. Claude Code hämtar data från Google Tasks, Gmail, Google Calendar och Obsidian daily.
4. Genererar ny `index.html`, committar, pushar.
5. GitHub Actions deployar till Pages inom ~30 sekunder.

## Struktur

```
startsida/
├── curate.md                      Instruktioner till Claude Code
├── index.html                     Sidan (genereras av Claude Code)
├── data/
│   ├── countdowns.json            Manuella nedräkningar
│   └── two-todo-override.json     Om jag vill bestämma dagens two-todo själv
└── .github/workflows/deploy.yml   Auto-deploy till Pages
```

## Vad jag gör manuellt

- **`countdowns.json`** — lägg till långsiktiga deadlines som inte är i Google Tasks.
- **`two-todo-override.json`** — om jag vet vad dagens två saker är, skriv hit så inte Claude Code väljer åt mig.
- **Google Tasks-lista "Ständiga"** — där bor medicin, jobbmail, etc. Bockas i Tasks-appen.
- **Stjärnmärk Google Tasks med datum** — de blir automatiska countdowns på sidan.

## Vad jag INTE gör på sidan

Ingenting. Sidan är en läs-vy. Om jag behöver agera på något, går jag till rätt app.

## Om något inte funkar

Om sidan ser konstig ut efter kurering: säg till Claude Code att visa senaste commit och
förklara vad som blev fel. Gårdagens sida ligger kvar i git-historiken.
