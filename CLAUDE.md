# Project: dpp-lint

Open-Source-CLI von Pangea Intelligence: Linter + Risiko-Screener für EU Digital Product Passports (v0.1: Batteriepass nach EU 2023/1542 / DIN DKE SPEC 99100).

## Owner
- Felix Kleiner (GitHub: felixbarwuah), contact@pangea-intelligence.eu
- Teil der Pangea-Welt, aber EIGENES Repo - nicht mit pangea-analytix mischen.

## Positionierung (entschieden 2026-07-02, nicht neu diskutieren)
- Klar Pangea-gebrandet, offen entwickelt: npm-Name `dpp-lint` (unscoped, defensiv gesichert), Pangea im CLI-Banner, README und Report-Footer.
- Geplante Heimat: GitHub-Org `pangea-intelligence` (war frei, legt Felix an). Bis dahin: lokal committen, NIE pushen ohne Felix' Ansage.
- Launch: ein Termin Ende Juli 2026, getimed auf die EU-Due-Diligence-Leitlinien (fällig 2026-07-26). Timeline: Passport-Pflicht 2027-02-18, Due-Diligence-Pflichten 2027-08-18.

## Stack & Konventionen
- TypeScript, ESM/NodeNext (relative Imports MIT .js-Endung), Node >= 20, strict.
- commander (CLI), ajv-draft-04 + ajv-formats (Schemas sind draft-04!), picocolors, vitest.
- Code/Docs/Kommentare: Englisch. NIE em dashes (nur normale Hyphens). Chat mit Felix: Deutsch.
- Kein ESM-JSON-Import: JSON zur Laufzeit via fs lesen, Pfade über den Package-Root-Resolver (src/core/paths.ts), nie über cwd.
- Exit-Codes: 0 = clean, 1 = Findings (bei risk nur high/medium), 2 = Usage-Fehler. commander braucht exitOverride AUCH auf Subcommands.
- Vor jedem Commit: `npm run build && npm test` (55+ Tests müssen grün sein).

## Architektur-Landkarte
- `src/cli.ts` Commander-Wiring; `src/commands/{lint,risk}.ts` Command-Logik
- `src/core/` read (encoding-tolerant: UTF-8/UTF-16 LE/BE +-BOM), schemas (Laden + Modul-Autodetection), validate (ajv), messages (Findings + DIN-Anreicherung), paths
- `src/risk/` origins (JSON/CSV-Parser), screen (Regeln R1-R5 entlang OECD-5-Schritte), data (Snapshot-Loader)
- `schemas/battery/1.2.0/` gevendorte Schemas + generiertes din-map.json; Abweichungen von Upstream IMMER in `schemas/PATCHES.md` dokumentieren
- `data/` Risiko-Snapshots (CAHRA, RMI, Materialien) + `data/SOURCES.md` (Provenienz-Pflicht: nie Daten erfinden, jeder Record aus echt gefetchter Quelle)
- `ttl/` SAMM-Quellen (nur Generator-Input für din-map, nicht im npm-Package)
- `scripts/` fetch-cahra/-rmi/-materials, extract-din-map

## Kritische Eigenheiten (nicht "wegfixen")
- **RMI-Snapshot ist ABSICHTLICH leer** (RBA-Click-Wrap verbietet Redistribution, inkompatibel mit Apache-2.0). Nutzer befüllen lokal via `node scripts/fetch-rmi.mjs --accept-rmi-terms`. R2 ist bei leerem Snapshot info, bei befülltem medium.
- **Upstream-TTLs enthalten veralteten CC-BY-NC-Text** in samm:description; autoritativ ist CC-BY-4.0 (SPDX-Header). Der din-map-Generator strippt den Text. Doku: NOTICE + PATCHES.md §5.
- **Kanonische Tippfehler bleiben**: warrentyPeriod, thirdPartyAussurances, supplyChainIndicies sind so im offiziellen Modell - nie umbenennen.
- **R4 ist modul-sensitiv**: auf Payloads fremder Module (die das Feld per Schema nicht enthalten können) info statt medium.
- Origins-Zusatz-Input nötig, weil das offizielle Datenmodell KEINE Herkunftsländer enthält (Format: fixtures/origins.sample.json/.csv).

## Aktueller Stand & nächste Schritte
→ `docs/STATUS.md` lesen (wird pro Session aktualisiert).
