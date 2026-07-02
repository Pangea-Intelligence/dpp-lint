# Data provenance

Every record in `data/` comes from a document that was actually fetched from the
named source on the stated retrieval date. Nothing is invented, remembered or
copied from secondary sources. Each dataset has a re-runnable fetch script in
`scripts/`. If a source could not be shipped (see RMI below), the file ships
empty and the reason is documented here.

All datasets in this directory were last fetched and verified on **2026-07-02**.

---

## data/cahra.json

EU indicative list of Conflict-Affected and High-Risk Areas (CAHRAs) under
Regulation (EU) 2017/821, maintained by RAND Europe for the European Commission
(DG TRADE). Used by dpp-lint to screen raw material origins for the due
diligence obligations of Regulation (EU) 2023/1542 Art. 48-52.

- **Source:** `https://cahra-api.cahraslist.net/api/v1/cahras` (the JSON API
  behind https://www.cahraslist.net/; the website is a React SPA, the API
  endpoint was taken from its JS bundle). Version metadata from
  `https://cahra-api.cahraslist.net/api/v1/changelog/latest`.
- **Retrieved:** 2026-07-02
- **Version:** "Report: June 2026 - For publication" (source `data_updated`
  2026-03-28, `reports_updated` 2026-06-27)
- **Script:** `node scripts/fetch-cahra.mjs` (re-runnable; the API rejects
  requests without browser-like Origin/Referer headers, the script sends the
  same headers the SPA sends)
- **Record counts:** 29 countries, 234 listed regions, 5 whole-country
  designations (Burundi, Eritrea, Libya, Venezuela, Zimbabwe)
- **Transformation:** one entry per country; per-report region lists merged and
  deduplicated by ISO 3166-2 subdivision code; `regions: null` plus
  `wholeCountry: true` when the source marks the designation as country-level;
  `iso2` derived from the ISO 3166-2 subdivision code prefix (e.g. "AF-BDS"
  gives "AF"); per-region `conflictAffected` / `highRisk` flags preserved as
  published.
- **License / terms:** public information published for the purposes of
  Regulation (EU) 2017/821; cahraslist.net publishes no explicit reuse license.
  The list is explicitly indicative and non-exhaustive and is not an official
  or exhaustive EU designation. dpp-lint findings based on it must be treated
  as screening signals, not legal determinations.
- **Limitations:** the API is undocumented and could change without notice;
  region-level granularity is preserved exactly as published, no additional
  areas were added or removed; the list is updated quarterly by RAND Europe, so
  re-run the fetch script to pick up newer quarters.

---

## data/rmi-facilities.json

Responsible Minerals Initiative (RMI) facility lists (battery scope: cobalt,
lithium, nickel, natural graphite).

**This file intentionally ships with an empty `facilities` array.**

The lists are technically fetchable (verified working on 2026-07-02, see
below), but they sit behind a click-wrap license on
responsiblemineralsinitiative.org. The gate text, retrieved verbatim from the
live page on 2026-07-02, states:

> "You are granted a personal, revocable, non-exclusive, nontransferable
> license to use the Information conditioned on your continued compliance with
> these Terms and Conditions. [...] The Information cannot be re-distributed,
> manipulated, revised, copied or made into a derivative work without the
> express prior written consent of RBA."

Redistributing the facility records inside this Apache-2.0 repository would
violate those terms, so the data is not shipped. This is a licensing
restriction, not a fetch failure, and nothing was fabricated to fill the gap.

- **Populate locally:** `node scripts/fetch-rmi.mjs --accept-rmi-terms`
  (add `--all-metals` for the full list). By passing the flag you accept RMI's
  Terms and Conditions yourself for your own personal use. Do not commit the
  result.
- **Regenerate the shipped placeholder:** `node scripts/fetch-rmi.mjs --empty`
- **Sources used by the script (verified working 2026-07-02):**
  - RMI Public List (all assessed facilities):
    https://www.responsiblemineralsinitiative.org/facilities-lists/public-list/
    which embeds the server-rendered viewer at
    https://www.sbsolutionsllc.net/eicc/smelter-conformant-active/
  - Cobalt Refiners lists (conformant and active):
    https://www.responsiblemineralsinitiative.org/cobalt-refiners-list/...
    which embed Caspio datapages (b5.caspio.com); AppKeys are discovered from
    the pages at runtime.
- **What a local run returned on 2026-07-02** (for orientation only, these
  records are not shipped): 129 battery-metal facilities after deduplication
  (Cobalt 70, Lithium 16, Nickel 43); statuses: 110 conformant, 15 active,
  4 "Facility Standard Assessed". Full list across all metals: 449 facilities.
- **Limitations:**
  - The RMI Public List contained **no natural graphite facilities** on
    2026-07-02; the published metal categories were Cobalt, Copper, Feldspar,
    Gold, Iridium, Lead, Lithium, Manganese, Mica, Multiple, Nickel, Palladium,
    Platinum, Rhodium, Ruthenium, Silver, Tantalum, Tin, Tungsten and Zinc.
    Graphite is in EMRT scope but has no public facility list.
  - 17 facilities are categorized as metal "Multiple" in the source; the
    battery filter does not match them because their individual metals are not
    broken out. Use `--all-metals` and filter yourself if you need them.
  - The HTML table layouts (viewer and Caspio) are scraped; layout changes will
    break the script, which then fails loudly rather than writing bad data.

---

## data/materials.json

The battery raw materials in scope of the supply chain due diligence
obligations (Art. 48-52, duties apply from 2027-08-18) of Regulation (EU)
2023/1542, as listed in Annex X, point 1.

- **Source:** Regulation (EU) 2023/1542, Annex X, point 1. Canonical URL:
  https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32023R1542
- **Machine source:** `http://publications.europa.eu/resource/celex/32023R1542`
  (EU Publications Office Cellar, content negotiation with
  `Accept: application/xhtml+xml`). The EUR-Lex HTML URL serves an AWS WAF
  JavaScript challenge to non-browser clients and cannot be fetched by
  scripts.
- **Retrieved:** 2026-07-02
- **Script:** `node scripts/fetch-materials.mjs` (re-runnable; it verifies that
  Annex X point 1 items (a) to (e) are still present verbatim in the fetched
  regulation text and fails loudly if the wording changed)
- **Record counts:** 4 materials (cobalt, natural graphite, lithium, nickel)
- **Transformation:** items (a)-(d) transcribed verbatim; point (e) ("chemical
  compounds based on the raw materials listed in points (a) to (d), which are
  necessary for the manufacturing of the active materials of batteries") is a
  derived category, represented by the `coversCompounds` flag on each entry
  rather than as a fifth record. `id`, `symbol`, CAS registry numbers and
  synonyms were added editorially; the CAS numbers (cobalt 7440-48-4, natural
  graphite 7782-42-5, lithium 7439-93-2, nickel 7440-02-0) are
  well-established reference values for the elemental or mineral form, not for
  every compound in scope.
- **License / terms:** reuse of EU legal texts is permitted under Commission
  Decision 2011/833/EU, attribution required. Only the Official Journal is
  authentic.
- **Limitations:** the compound category (point (e)) is open-ended by design;
  dpp-lint should treat any compound of the four base materials as in scope
  rather than relying on a closed CAS list.
