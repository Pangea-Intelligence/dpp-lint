# Launch-Plan dpp-lint (Stand 2026-07-02)

Interner Plan, Zielgruppe Felix. Rechercheergebnisse vom 2026-07-02 (Quellen am Ende).

## Marktlage in einem Absatz

Die Nische "Open-Source-CLI, das Batteriepass-Payloads gegen das offizielle Datenmodell validiert UND Rohstoff-Herkünfte nach Art. 48-52 screent" ist unbesetzt. Das Feld drumherum füllt sich aber sichtbar: allein im letzten Monat erschienen drei bis vier adjazente npm-Pakete (open-dpp SDK 30.06., transpareo-time-machine taggleich am 02.07., dpp-schema 19.05.), und das offizielle Nachfolgeprojekt BatteryPass-Ready (Fraunhofer IPK, acatech) hat am 24.06.2026 seine web-basierte Testumgebung live geschaltet. Das Erstankömmling-Fenster ist eng. Positionierung deshalb komplementär, nicht konkurrierend: die Testumgebung ist das Prüfportal für Compliance-Teams, dpp-lint ist das Dev-Tool, das Entwickler in die eigene Pipeline hängen, bevor sie manuell prüfen.

## Wichtige Termin-Caveats

- Der Leitlinien-Termin **26.07.2026 ist "expected", nicht bestätigt** (nur Sekundärquellen: infodpp.eu, Kanzlei-Tracker; keine Kommissions-Primärquelle). Im Content immer "werden Ende Juli erwartet" formulieren, nie auf den Tag festnageln.
- Due-Diligence-Pflichten verbindlich ab **18.08.2027** (VO (EU) 2025/1561), Passport-Pflicht ab **18.02.2027** - beides belastbar.
- Omnibus-IV-Paket (COM(2025)501) ist seit 03/2026 im Trilog und könnte die Batterieverordnung nochmals anpassen. Im Blick behalten.
- **Kein Messe-Anker im Juli-September:** Battery Show Europe (09.-11.06.), ees Europe (22.-25.06.) und EU Battery Passport Conference (04.02.) lagen alle davor. Der Launch läuft redaktionell über Content + direkten Outreach.

## Launch-Sequenz (Empfehlung: Soft-Launch Mitte Juli + Leitlinien-Reaktion)

**Phase 1 - Reputationsaufbau upstream (jetzt bis ~10.07.):**
Kleine, saubere PRs/Issues an `batterypass/BatteryPassDataModel` (63 Stars, 55 offene Issues, Maintainer aus dem Fraunhofer/acatech-Umfeld - exakt die Leute hinter BatteryPass-Ready). Unser Material, alles aus echter Arbeit entstanden:
1. E-Mail-Regex-Fix (Issue #54, Patch liegt in `schemas/PATCHES.md` §1 fertig begründet)
2. CC-BY-NC-Boilerplate-Reste in `samm:description` - inkl. der zweiten Variante ohne "Copyright" (Circularity), die wir im Quality-Pass gefunden haben
3. Hinweis Circularity-Payload-Namensabweichung (`gen/Circularity.json` statt `-payload.json`)
4. Optional: Typo-Sammlung als Doku-Issue (batteryTechicalProperties etc.) - explizit als "documentation only", nicht als Rename-Vorschlag

**Phase 2 - Soft-Launch (~14.-18.07.):**
Blogpost auf pangea-intelligence.eu ("Der EU-Batteriepass als ausführbare Prüfung" - Story: Regulierung wird Code) + erster LinkedIn-Post (Tool-Vorstellung mit dem npx-Einzeiler). Nicht auf den 26.07. warten: der Termin ist weich, das Feld füllt sich, und ein zweistufiger Launch gibt zwei Anlässe statt einem.

**Phase 3 - Leitlinien-Reaktion (um den 26.07., flexibel):**
Wenn die Leitlinien erscheinen: Same-Week-Analyse als LinkedIn-Post/Lens ("Was die neuen Leitlinien konkret fordern - und was davon heute schon maschinell prüfbar ist"), dpp-lint als Beleg. Verschieben sie sich: Phase-2-Content trägt trotzdem, Reaktions-Content rückt nach hinten.

**Phase 4 - Direkter Outreach (August):**
10-15 gezielte Kontakte aus den Tiers unten, LinkedIn-DM oder E-Mail, mit konkretem Nutzwert (z. B. "euer Payload-Export validiert nicht gegen das offizielle Schema, wir haben das Tool dafür gebaut").

## Wer ernsthaft anfangen kann (priorisiert)

**Tier 1 - DPP-Software-Anbieter (höchste Passung, Entwickler erzeugen täglich Payloads gegen genau dieses Datenmodell):**
- **Minespider** und **Circulor** (beide Due-Diligence-nah, Circulor war Mitglied im ursprünglichen Battery-Pass-Konsortium und hat das Datenmodell mitgebaut)
- **Spherity** (JSON-Schema-nah, Vorreiter beim Batteriepass-JSON-LD)
- **Path.Era** und **DigiProd Pass** (Catena-X/Cofinity-X-zertifiziert, DACH-lastig)
- weitere: Circularise, Narravero, osapiens, Siemens (SiGREEN), T-Systems, Bosch, AVL

**Tier 1b - BatteryPass-Ready-Konsortium (institutionelle Schiene):**
Fraunhofer IPK (Lead), acatech, GEFEG, TU Berlin. Testumgebung live seit 24.06. - dpp-lint als komplementäres CLI anbieten. Genannter Kontakt: Dr. Johannes Simböck (simboeck@acatech.de). Multiplikatoren im Projekt: VDA, VDMA, ZIV, BITKOM.

**Tier 2 - Prüf-/Beratungsorganisationen:**
TÜV SÜD (bietet Batteriepass-Erstellungsservice), Fraunhofer IESE/IEG. VDE Renewables (Ex-Konsortium).

**Tier 3 - Zellhersteller direkt (regulierungspflichtig, aber Compliance kauft dort eher SaaS):**
PowerCo (Salzgitter/Valencia/St. Thomas), Lyten (Ex-Northvolt Skellefteå/Västerås + Heide), CustomCells, ACC, Verkor. Eher über Content erreichen als über Kalt-Outreach.

## Kanäle

- **LinkedIn** (Felix' Profil + ggf. Lens-Format): Haupt-Kanal, Phase 2 + 3
- **Blog pangea-intelligence.eu**: SEO-Anker, verlinkt von npm/GitHub-README
- **GitHub**: Topic `battery-passport` (nur 4 Repos - wir sind dort schon prominent), Upstream-PRs als Sichtbarkeit bei den Maintainern
- **battery-news.de / Podcast "Battery Matters"** (Volta Foundation): anpitchen, sobald der Blogpost steht
- Keine dedizierte Battery-Passport-Community (kein Slack/Discord/Forum gefunden) - das Upstream-Repo ist der einzige technische Treffpunkt

## Offene Punkte

- [ ] Upstream-PRs vorbereiten und stellen (Phase 1)
- [ ] Blogpost-Draft (Phase 2, Repo pangea-analytix, Launch-Content-Zone laut active_work)
- [ ] LinkedIn-Post-Serie (Phase 2/3)
- [ ] Outreach-Liste mit Ansprechpartnern konkretisieren (Phase 4)
- [ ] Leitlinien-Veröffentlichung beobachten (infodpp.eu, EU-Kommission)

## Quellen

Recherche 2026-07-02: Fraunhofer-IPK-Pressemitteilung BatteryPass-Ready (24.06.2026), Spherity "Top DPP Providers 2026", infodpp.eu (VO 2025/1561, Leitlinien-Erwartung 26.07.), GitHub-Topic battery-passport, npm-Registry (adjazente Pakete), TÜV-SÜD-Batteriepass-Service, Event-Websites (Battery Show Europe, ees Europe, EU Battery Passport Conference), heise (Lyten/Northvolt), Volkswagen Group (PowerCo).
