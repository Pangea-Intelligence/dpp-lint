#!/usr/bin/env node
// Generates data/materials.json: the battery raw materials in scope of the
// supply chain due diligence obligations of Regulation (EU) 2023/1542
// (Annex X, point 1; duties per Art. 48-52 apply from 2027-08-18).
//
// The regulation text is fetched from the EU Publications Office Cellar
// (content negotiation, Accept: application/xhtml+xml). The canonical
// EUR-Lex HTML URL serves an AWS WAF JavaScript challenge to non-browser
// clients, so scripts must use the Cellar endpoint instead.
//
// The script VERIFIES that Annex X point 1 still contains the expected
// items verbatim before writing the file, and fails loudly otherwise.
// Everything else in the output (ids, symbols, CAS numbers, synonyms) is
// editorial and encoded as constants below.
//
// Re-runnable: node scripts/fetch-materials.mjs

import { writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CELLAR_URL = "http://publications.europa.eu/resource/celex/32023R1542";
const EURLEX_URL = "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32023R1542";

// Expected wording of Annex X point 1 (verified against the Cellar XHTML).
const EXPECTED_ITEMS = [
  "(a) cobalt;",
  "(b) natural graphite;",
  "(c) lithium;",
  "(d) nickel;",
  "(e) chemical compounds based on the raw materials listed in points (a) to (d), which are necessary for the manufacturing of the active materials of batteries.",
];

// Editorial reference data. CAS registry numbers refer to the elemental or
// mineral form, not to every in-scope compound (point (e) is open-ended).
const MATERIALS = [
  {
    id: "cobalt",
    name: "cobalt",
    annexXPoint: "1(a)",
    symbol: "Co",
    cas: "7440-48-4",
    synonyms: ["Co", "cobalt metal"],
    coversCompounds: true,
    regulationRef: "EU 2023/1542 Annex X(1)",
  },
  {
    id: "natural-graphite",
    name: "natural graphite",
    annexXPoint: "1(b)",
    symbol: "C",
    cas: "7782-42-5",
    synonyms: ["graphite", "graphite, natural", "flake graphite", "amorphous graphite", "vein graphite"],
    coversCompounds: true,
    regulationRef: "EU 2023/1542 Annex X(1)",
  },
  {
    id: "lithium",
    name: "lithium",
    annexXPoint: "1(c)",
    symbol: "Li",
    cas: "7439-93-2",
    synonyms: ["Li", "lithium metal"],
    coversCompounds: true,
    regulationRef: "EU 2023/1542 Annex X(1)",
  },
  {
    id: "nickel",
    name: "nickel",
    annexXPoint: "1(d)",
    symbol: "Ni",
    cas: "7440-02-0",
    synonyms: ["Ni", "nickel metal"],
    coversCompounds: true,
    regulationRef: "EU 2023/1542 Annex X(1)",
  },
];

function packageRoot(startDir) {
  let dir = startDir;
  for (;;) {
    if (existsSync(join(dir, "package.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) throw new Error("package.json not found above " + startDir);
    dir = parent;
  }
}

const res = await fetch(CELLAR_URL, {
  headers: {
    Accept: "application/xhtml+xml",
    "Accept-Language": "en",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  },
  redirect: "follow",
});
if (!res.ok) throw new Error(`GET ${CELLAR_URL} -> HTTP ${res.status}`);
const html = await res.text();

// Strip tags, collapse whitespace, then check Annex X point 1 verbatim.
const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const annexIdx = text.indexOf("ANNEX X");
if (annexIdx < 0) throw new Error("ANNEX X not found in fetched regulation text");
const annex = text.slice(annexIdx, annexIdx + 2000);
for (const item of EXPECTED_ITEMS) {
  if (!annex.includes(item)) {
    throw new Error(
      `Annex X point 1 verification failed. Expected item not found verbatim:\n  ${item}\n` +
        "The regulation text may have been amended. Review Annex X and update this script."
    );
  }
}
console.log("verified: Annex X point 1 items (a)-(e) found verbatim in fetched text");

const out = {
  meta: {
    source:
      "Regulation (EU) 2023/1542, Annex X, point 1 (list of raw materials in scope of the supply chain due diligence obligations, Art. 48-52)",
    sourceUrl: EURLEX_URL,
    machineSourceUrl: CELLAR_URL,
    retrieved: new Date().toISOString().slice(0, 10),
    license:
      "EUR-Lex / EU Publications Office: reuse of EU legal texts permitted (Commission Decision 2011/833/EU), attribution required",
    note:
      "Annex X point 1 lists: (a) cobalt; (b) natural graphite; (c) lithium; (d) nickel; and (e) chemical compounds based on the raw materials listed in points (a) to (d), which are necessary for the manufacturing of the active materials of batteries. Point (e) is a derived category, not a separate raw material, and is therefore represented by the coversCompounds flag on each entry. CAS registry numbers are well-established reference values for the elemental or mineral form, not for every compound in scope.",
    transformation:
      "Annex X point 1 items (a)-(d) transcribed verbatim from the regulation XHTML served by the EU Publications Office Cellar (the EUR-Lex HTML URL is behind an AWS WAF challenge for non-browser clients); wording verified programmatically by scripts/fetch-materials.mjs. ids, symbols, CAS numbers and synonyms added editorially.",
  },
  materials: MATERIALS,
};

const root = packageRoot(dirname(fileURLToPath(import.meta.url)));
const target = join(root, "data", "materials.json");
writeFileSync(target, JSON.stringify(out, null, 2) + "\n");
console.log(`wrote ${target}: ${MATERIALS.length} materials`);
