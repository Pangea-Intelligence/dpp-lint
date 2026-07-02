# Status (Stand 2026-07-02, Session auf dem Mac Mini nach SSD-Wechsel)

## Erledigt
- **v0.2-Kern: alle 7 Module des Datenmodells** (neu: CarbonFootprintForBatteries, Circularity, PerformanceAndDurability, Labeling - offizielle 1.2.0-Aspect-Namen). Vendoring reproduzierbar via `scripts/vendor-schemas.mjs` (gepinnter Upstream-Commit `8722af2d`). 69/69 Tests.
- **Quality-Pass (8-Perspektiven-Review, alle Findings gefixt):** (1) R4-Severity-Regression bei kombinierten Payloads (Feld present+kaputt wurde durch Modul-Detection auf info runtergestuft - jetzt downgrade nur bei wirklich fehlendem Feld); (2) CC-BY-NC-Boilerplate-Variante ohne "Copyright" (Circularity) rutschte durch den Strip-Filter in din-map.json - Regex um 2 Anker erweitert; (3) NUL-Byte machte vendor-schemas.mjs für git binär; (4) DIN-Kapitel-Ranges ("6.7.7.5 - 8") wurden abgeschnitten; (5) Vendor-Script gehärtet (kein blanket-catch-Fallback, --ref-Validierung, strikter Decoder); (6) extract-din-map leitet Modul-Liste jetzt strukturell aus ttl/ ab, index.test prüft MODULES gegen Schema-Dateien (fängt beide Drift-Richtungen).
- **Verhaltensänderung für Release Notes 0.2.0:** Payloads, die Keys eines alten und eines neuen Moduls mischen, sind jetzt ambiguous (lint Exit 2, --module nötig) statt einseitig als altes Modul validiert. Gewollt, aber dokumentationspflichtig.
- **Neues Upstream-PR-Material entdeckt:** Circularity-Aspect-Beschreibung trägt CC-BY-NC-Text in zweiter Variante ohne "Copyright" (samm:description); neuer kanonischer Tippfehler batteryTechicalProperties (PerformanceAndDurability) in PATCHES.md dokumentiert.
- Auf dem Mac Mini verifiziert: frisches `npm install`, Build grün, 55/55 Tests, E2E-Smoke (lint 3/3 Fixtures Exit 0, risk findet Fixture-Findings Exit 1).
- **Public auf GitHub:** Org `Pangea-Intelligence` von Felix angelegt, Repo https://github.com/Pangea-Intelligence/dpp-lint erstellt, `main` gepusht, Topics gesetzt. Remote `origin` im lokalen Repo konfiguriert. Hinweis: git-Push braucht gh als Credential-Helper (`git -c credential.helper='!gh auth git-credential' push`), der Keychain-Token hat keinen workflow-Scope.
- v0.1 komplett gebaut und verifiziert: `lint` (3 Module: GeneralProductInformation, MaterialComposition, SupplyChainDueDiligence) + `risk` (R1-R5, OECD-5-Schritte). 55/55 Tests, Build grün, E2E manuell geprüft.
- Multi-Agent-Review durchlaufen: 4 Major-Findings gefunden und gefixt (Package-Entry-Point, R2-False-Positive bei leerem RMI-Snapshot, UTF-16BE-Crashpfad, README-Origins-Format). Danach: CC-BY-NC-Text aus din-map gestrippt, R4 modul-sensitiv gemacht, Exit-Code 2 für Usage-Fehler (commander exitOverride inkl. Subcommands), rmiId-Match case-insensitiv, Origins-Datei-Guards, PATCHES/NOTICE ergänzt.
- CAHRA-Snapshot: Juni-2026-Report via offizieller API (29 Länder, 234 Regionen, 5 Ganzland-Designationen).
- Initial-Commit `e973dd0` auf `main` (lokal). KEIN Remote, KEIN Push bisher.

## Nächste Schritte (Reihenfolge sinnvoll)
1. ~~GitHub-Org + Repo + Push~~ erledigt 2026-07-02 (siehe oben).
2. ~~npm publish~~ erledigt 2026-07-02: `dpp-lint@0.1.0` live (Account `felix_pangea`, 2FA aktiviert - Pflicht für Publish). Verifiziert via `npx dpp-lint@0.1.0`. Wichtig: npm 11 strippt bin-Einträge mit `./`-Präfix, gefixt in `45449a1`. Publish ohne TTY braucht `script -q /dev/null npm publish` (Browser-Auth-URL sonst maskiert).
3. **Upstream-PRs** an batterypass/BatteryPassDataModel: E-Mail-Regex-Fix (Issue #54) + Hinweis auf CC-BY-NC-Reste in samm:description. Gut für Sichtbarkeit.
4. **Launch-Content** (LinkedIn-Serie + evtl. Blogpost auf pangea-intelligence.eu), getimed auf die EU-Due-Diligence-Leitlinien (~2026-07-26). Story: "Die neuen Leitlinien als ausführbares Tool".
5. **v0.2:** restliche 4 Module (CarbonFootprint, Circularity, Performance, Labels), IPIS-Minendaten + USGS-Konzentration für risk, evtl. EMRT-Excel-Import für Origins.

## Kontext für neue Sessions
- Entscheidungshistorie und Regeln: CLAUDE.md in diesem Repo.
- Koordination mit anderen Chats: `memory/active_work.md` im pangea-analytix-Repo (Zeile "dpp-lint" existiert).
- Recherche-Basis (Wettbewerb, Lizenzlage, Datenquellen) steckt in CLAUDE.md-Eigenheiten + data/SOURCES.md + schemas/PATCHES.md - bei Zweifeln dort nachlesen statt neu recherchieren.
