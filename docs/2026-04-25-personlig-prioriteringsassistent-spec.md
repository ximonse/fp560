# Personlig prioriteringsassistent

Datum: 2026-04-25
Kontext: design-spec för en Hermes-lik fokuspanel som svarar på en enda fråga: "Vad är viktigast för mig just nu?"

## Produktvision

En personlig prioriteringsassistent som reducerar dagens brus till en enda lugn panel: det viktigaste nu, det viktiga senare idag, och det som kräver forberedelse innan det blir akut. Den ska kannas mindre som en app och mer som en palitlig kollega som redan har gjort sorteringen at dig.

## Huvudvy

En enda skarm, mobil forst, utan flikar i standardlaget. Max 5-8 synliga rader innan "mer" behovs.

```text
[ 08:12 · Hemma · Regn om 35 min ]

Det viktigaste nu
Lamna hemmet 08:25 for att hinna till tandlakaren 09:00
Ta med: remiss, horlurar, paraply

Narmaste timmen
08:25 Ga nu om 13 min
09:00 Tandlakare
09:50 Buffert for apoteket bredvid kliniken

Idag
Skicka utkast till Anna fore 14:00
Betala faktura som forfaller idag
20 min promenad skulle sannolikt hjalpa energin

Veckan framat
Ons: Workshop du leder, slides ej klara
Fre: Present till mammas middag saknas
Son: Dackbyte kan behovas, 2° pa morgonen

Nasta vecka, forbered nu
Man: Tagresa 06:10, boka biljett senast idag

Viktiga mail idag
Anna: "Kan du godkanna innan lunch?"
Vardcentralen: provsvar upplagda
Forsakring: sista dag att svara idag

Paminnelse
Du ar nara apoteket efter tandlakaren
```

## Designprinciper

- En primar rad hogst upp: svaret pa "vad ar viktigast just nu?"
- Varje rad ar antingen information eller handling, aldrig bada samtidigt blandat.
- Ingen kategori-fargning kravs for att forsta prioritet; hierarkin bars av storlek, spacing och ordval.
- "Mer" oppnar detaljer, men standardlaget visar bara det som ar beslutsrelevant nu.

## Arkitektur

### Datakallor

- Google Calendar: moten, resor, plats, deadlines, svarstatus
- Gmail: endast tradar som kan paverka dagen
- Google Tasks och Keep: explicita uppgifter, inkopslistor, losa paminnelser
- Weather API: nulage, nederbord kommande timmar, varningar, temperaturfall
- GPS/plats: nuvarande platskategori, vanor, rorelsemonsster, narhet till relevanta arenden
- Markdown/Obsidian: projekt, personliga mal, vantande ataganden, kommande milstolpar
- Halsodata: steg, somn, inaktivitet, egenrapporterad energi om anvandaren vill

### Normalisering

Allt mappas till ett gemensamt objektformat:

- `item_type`
- `time_window`
- `location_relevance`
- `effort`
- `reversibility`
- `consequence_of_delay`
- `confidence`
- `suggested_action`

Exempel: ett mail representeras inte som "mail", utan som "beslut kravs fore lunch".

### Prioriteringsmotor

Ett regelbaserat lager kommer forst:

- harda deadlines
- resa- och transitfonster
- platsberoende arenden
- vadervarningar
- halsosignaler med lag intrusivitet

Ovanpa det ligger ett larande lager:

- vad anvandaren oppnar direkt
- vad som skjuts upp flera ganger
- vilka typer av paminnelser som leder till handling
- vilken tonalitet som fungerar

Resultatet ar inte en lang lista, utan ett litet urval per sektion med strikt tak.

### Inlarning

Manuell signalering:

- "Mer sant har"
- "Inte relevant"
- "Viktigare an du tror"
- "Paminn mig senare, men bara om det fortfarande spelar roll"

Automatisk anpassning:

- klick, dismiss, snooze, ignore, completion
- tid till respons
- om anvandaren faktiskt utfor foreslagen handling efter att ha sett den

Helst sker rangordning och profilering pa enheten eller i ett privat anvandarkonto, inte i en delad molnprofil.

### Integritet

- Standard: lokal bearbetning och lokal rankning
- Radata fran mail, plats och halsa sparas minimalt
- Kansliga kategorier som halsa och plats ska kunna stangas av separat
- Anvandaren ska kunna se "Varfor visas detta?" med en kort forklaring
- Ingen dold social scoring; anvandaren styr vad som raknas som avvikelse

## Kontextscenarier

### 1. Mandag morgon hemma

Situation: 07:40, hemma, forsta mote 08:30, regn borjar snart, dalig somn.

```text
07:40 · Hemma · Regn 08:10

Det viktigaste nu
Borja gora dig klar for att ga 08:00 om du vill hinna lugnt till motet 08:30

Narmaste timmen
08:00 Lamna hemmet
08:30 Mote med produktteamet
Ta med: laddare, paraply

Idag
Skicka statusuppdatering fore 11:00
Hamta paket efter jobbet, sista utlamningsdag idag
Lagg inte tungt fokusblock 15-16, du sov 5h 20m

Veckan framat
Ons: Lakarbesok, fyll i formularet innan tis kvall
Tor: Demo for kund, saknar sista skarmbilderna

Viktiga mail idag
Chef: vill ha besked fore lunch
Skola: andrad tid for hamtning pa torsdag
```

### 2. Fredag kvall pa vag ut

Situation: 18:10, pa vag fran jobbet, middag 19:00, nara butik och apotek, regn senare.

```text
18:10 · Pa vag · 12 min till middagen

Det viktigaste nu
Kop med present pa vagen om du fortfarande tankt gora det idag

Narmaste timmen
18:22 Du passerar butiken vid Odenplan
19:00 Middag hos Erik
22:00 Regn och 6°, jacka hem behovs

Idag
Svara bara pa ett mail: hyresvarden vantar pa besked idag
Ignorera resten till imorgon

Veckan framat
Man: Tidigt tag 06:10, packning inte paborjad
Tis: Forskoleutflykt, klader for regn behovs

Viktiga mail idag
Hyresvarden: behover ditt svar ikvall
```

### 3. Sondag formiddag i sangen

Situation: 10:45, hemma, stilla lange, inga akuta moten, nasta vecka ar tung.

```text
10:45 · Hemma · Lugn sondag

Det viktigaste nu
Du behover inte agera direkt. 15 lugna minuter med veckostart racker langt.

Idag
Valj 1 sak som avlastar mandagen:
Boka tagbiljett
Lagg fram traningsklader
Svara Anna om tisdag

Veckan framat
Man 08:00 Kundmote, underlag ej oppnat
Ons 17:30 Tandlakare
Fre 07:00 Flyg till Goteborg

Nasta vecka, forbered nu
Passet ligger inte i packlistan infor fredagens resa

Viktiga mail idag
Inga mail kraver uppmarksamhet nu

Paminnelse
Du har varit hemma och stilla lange. En kort promenad kan vara ett mjukt satt att komma igang.
```

## Aktivt bortvalt

- Ingen traditionell inkorg i panelen. Mail visas bara nar de paverkar dagens beslut.
- Ingen komplett att-gora-lista. Bara sadant som ar tidskritiskt, konsekvent eller kontextuellt relevant nu.
- Inga fargkoder som anvandaren maste lara sig.
- Ingen dashboard med widgets, grafer eller KPI:er.
- Inga peppiga eller normerande nudges.
- Ingen aggressiv AI-autonomi som ombokar, svarar eller prioriterar om utan tydlig kontroll.
- Ingen tung personalisering fran start. Baslogiken ska vara stark nog att vara nyttig direkt.

## Slutsats

Assistenten ska inte vara ett battre kalenderprogram, en battre mailklient eller en battre anteckningsapp. Den ska vara ett battre beslutsfilter. Om den lyckas oppnar anvandaren den for riktning, inte for informationsinsamling.
