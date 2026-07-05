#!/usr/bin/env node
// Fetches the public facility lists of the Responsible Minerals Initiative (RMI)
// and writes data/rmi-facilities.json.
//
// IMPORTANT - RMI Terms and Conditions:
// The RMI facility lists are published behind a click-wrap license (cookie
// "rmiViewAgree"). Its terms state that the information is licensed for
// personal use and "cannot be re-distributed, manipulated, revised, copied or
// made into a derivative work without the express prior written consent" of
// the Responsible Business Alliance (RBA). For that reason this repository
// ships data/rmi-facilities.json with an EMPTY facilities array. Run this
// script yourself with --accept-rmi-terms to populate the file locally for
// your own use. By passing the flag you accept RMI's Terms and Conditions
// (shown on https://www.responsiblemineralsinitiative.org/ before any list).
//
// Usage:
//   node scripts/fetch-rmi.mjs --accept-rmi-terms [--all-metals] [--out <path>]
//   node scripts/fetch-rmi.mjs --empty            # regenerate the shipped placeholder
//
// Data paths used (verified 2026-07-02):
// 1. RMI Public List (all metals, incl. cobalt, lithium, nickel):
//    https://www.responsiblemineralsinitiative.org/facilities-lists/public-list/
//    embeds an iframe viewer at https://www.sbsolutionsllc.net/eicc/smelter-conformant-active/
//    which server-renders the full table.
// 2. Cobalt Refiners lists (active + conformant):
//    https://www.responsiblemineralsinitiative.org/cobalt-refiners-list/...
//    embed Caspio datapages (b5.caspio.com/dp.asp?AppKey=...) that server-render
//    the table rows. AppKeys are discovered from the pages at runtime.

import { writeFileSync, existsSync } from 'node:fs';
import { dirname, join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const RMI_BASE = 'https://www.responsiblemineralsinitiative.org';
const PUBLIC_LIST_PAGE = `${RMI_BASE}/facilities-lists/public-list/`;
const COBALT_PAGES = [
  { url: `${RMI_BASE}/cobalt-refiners-list/conformant-cobalt-refiners/`, status: 'conformant' },
  { url: `${RMI_BASE}/cobalt-refiners-list/active-cobalt-refiners/`, status: 'active' },
];
const FALLBACK_VIEWER = 'https://www.sbsolutionsllc.net/eicc/smelter-conformant-active/';
const BATTERY_METALS = /^(cobalt|lithium|nickel)$|graphite/i;

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const argValue = (f) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : null;
};

function packageRoot(startDir) {
  let dir = startDir;
  for (;;) {
    if (existsSync(join(dir, 'package.json'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) throw new Error('package.json not found above ' + startDir);
    dir = parent;
  }
}

const root = packageRoot(dirname(fileURLToPath(import.meta.url)));
const outArg = argValue('--out');
const target = outArg
  ? isAbsolute(outArg)
    ? outArg
    : join(process.cwd(), outArg)
  : join(root, 'data', 'rmi-facilities.json');

const TERMS_NOTE =
  'RMI facility lists are published behind a click-wrap license (RBA Terms and Conditions) that ' +
  'prohibits redistribution without prior written consent. This file therefore ships empty in the ' +
  'dpp-lint repository. Populate it locally with: node scripts/fetch-rmi.mjs --accept-rmi-terms ' +
  "(by doing so you accept RMI's Terms and Conditions for your own personal use of the data).";

function emptyDataset() {
  return {
    meta: {
      generator: 'scripts/fetch-rmi.mjs --empty',
      retrieved: null,
      termsNote: TERMS_NOTE,
      sources: [
        {
          name: 'RMI Public List (all assessed facilities, incl. cobalt/lithium/nickel)',
          url: PUBLIC_LIST_PAGE,
        },
        { name: 'RMI Cobalt Refiners list (conformant)', url: COBALT_PAGES[0].url },
        { name: 'RMI Cobalt Refiners list (active)', url: COBALT_PAGES[1].url },
      ],
      counts: { total: 0 },
    },
    facilities: [],
  };
}

if (has('--empty')) {
  writeFileSync(target, JSON.stringify(emptyDataset(), null, 2) + '\n');
  console.log(`wrote ${target}: empty placeholder (see meta.termsNote)`);
  process.exit(0);
}

if (!has('--accept-rmi-terms')) {
  console.error(
    [
      'fetch-rmi.mjs: refusing to fetch without --accept-rmi-terms.',
      '',
      'The RMI facility lists are gated behind RBA Terms and Conditions (click-wrap on',
      'responsiblemineralsinitiative.org) which restrict the data to personal use and',
      'prohibit redistribution. Re-run with --accept-rmi-terms to accept those terms',
      'yourself and populate data/rmi-facilities.json locally. Do not commit the result.',
    ].join('\n')
  );
  process.exit(2);
}

async function fetchText(url, extraHeaders = {}) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', ...extraHeaders },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`);
  return res.text();
}

// The rmiViewAgree cookie is what the site's own "I Accept" button sets.
const agreedHeaders = { Cookie: 'rmiViewAgree=true', Referer: RMI_BASE + '/' };

const decodeMap = {
  '&amp;': '&',
  '&nbsp;': ' ',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&lt;': '<',
  '&gt;': '>',
  '&ndash;': '-',
  '&mdash;': '-',
  '&rsquo;': "'",
  '&lsquo;': "'",
};
function clean(htmlFragment) {
  let s = htmlFragment.replace(/<[^>]+>/g, ' ');
  s = s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
  s = s.replace(/&[a-zA-Z]+;|&#\d+;/g, (m) => decodeMap[m] ?? ' ');
  return s.replace(/\s+/g, ' ').trim();
}

function tableCells(rowHtml) {
  return [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((m) => clean(m[1]));
}

// ---- Source 1: RMI Public List viewer (sbsolutionsllc.net, DataTables, server-rendered) ----
async function fetchPublicList(allMetals) {
  let viewerUrl = FALLBACK_VIEWER;
  try {
    const page = await fetchText(PUBLIC_LIST_PAGE, agreedHeaders);
    const m = page.match(/<iframe[^>]*src="(https:\/\/www\.sbsolutionsllc\.net[^"]+)"/);
    if (m) viewerUrl = m[1];
  } catch (err) {
    console.error(
      `warning: could not read ${PUBLIC_LIST_PAGE} (${err.message}), using fallback viewer URL`
    );
  }
  const html = await fetchText(viewerUrl, { Referer: RMI_BASE + '/' });
  const theadMatch = html.match(/<thead[^>]*>([\s\S]*?)<\/thead>/);
  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/);
  if (!theadMatch || !tbodyMatch)
    throw new Error('public list viewer: table not found (layout changed?)');
  const header = tableCells(theadMatch[1]);
  const col = (label) => {
    const i = header.indexOf(label);
    if (i < 0) throw new Error(`public list viewer: column "${label}" not found`);
    return i;
  };
  const iMetal = col('Metal');
  const iId = col('Facility ID');
  const iName = col('Standard Facility Name');
  const iCountry = col('Country Location');
  const iStatus = col('Due Diligence Assessment Program Status');
  const facilities = [];
  for (const [, rowHtml] of tbodyMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const c = tableCells(rowHtml);
    if (c.length <= iStatus) continue;
    const metal = c[iMetal];
    if (!allMetals && !BATTERY_METALS.test(metal)) continue;
    facilities.push({
      name: c[iName] || null,
      rmiId: c[iId] || null,
      metal,
      country: c[iCountry] || null,
      status: normalizeStatus(c[iStatus]),
      source: 'rmi-public-list',
    });
  }
  return { viewerUrl, facilities };
}

// ---- Source 2: Cobalt Refiners lists (Caspio datapages) ----
async function fetchCobaltList({ url, status }) {
  const page = await fetchText(url, agreedHeaders);
  const m = page.match(/https:\/\/b5\.caspio\.com\/dp\.asp\?AppKey=[a-z0-9]+/);
  if (!m) throw new Error(`${url}: Caspio iframe not found (terms gate or layout changed?)`);
  const caspioBase = m[0];
  const facilities = [];
  const seenFirstCell = new Set();
  for (let pageNo = 1; pageNo <= 20; pageNo++) {
    const pageUrl = pageNo === 1 ? caspioBase : `${caspioBase}&cpipage=${pageNo}`;
    const html = await fetchText(pageUrl, { Referer: url });
    const rows = [
      ...html.matchAll(/<tr[^>]*class="cbResultSetDataRow[^"]*"[^>]*>([\s\S]*?)<\/tr>/g),
    ];
    if (rows.length === 0) break;
    const firstCells = tableCells(rows[0][1]).join('|');
    if (seenFirstCell.has(firstCells)) break; // Caspio served the same page again
    seenFirstCell.add(firstCells);
    for (const [, rowHtml] of rows) {
      // Caspio responsive cells repeat the label, e.g. "Smelter ID: CID003209".
      const cells = tableCells(rowHtml).map((c) => c.replace(/^[A-Za-z/ ]+:\s*/, ''));
      const rec = {};
      for (const c of tableCells(rowHtml)) {
        const mm = c.match(/^([A-Za-z/ ]+):\s*(.*)$/);
        if (mm) rec[mm[1].trim()] = mm[2].trim();
      }
      const rmiId = rec['Smelter ID'] ?? cells.find((c) => /^CID\d+$/.test(c)) ?? null;
      const name = rec['Standard Smelter Name'] ?? null;
      const country = rec['Country Location'] ?? null;
      if (!name && !rmiId) continue;
      facilities.push({
        name,
        rmiId,
        metal: 'Cobalt',
        country,
        status,
        source: 'rmi-cobalt-refiners-list',
      });
    }
    if (rows.length < 100) break; // default Caspio page size is 100
  }
  return { caspioBase, facilities };
}

function normalizeStatus(s) {
  if (/^conformant$/i.test(s)) return 'conformant';
  if (/^active$/i.test(s)) return 'active';
  return s || null; // keep as published, e.g. "Facility Standard Assessed"
}

const allMetals = has('--all-metals');
const retrieved = new Date().toISOString().slice(0, 10);
const sources = [];
let facilities = [];

const pub = await fetchPublicList(allMetals);
sources.push({
  name: 'RMI Public List',
  page: PUBLIC_LIST_PAGE,
  dataUrl: pub.viewerUrl,
  records: pub.facilities.length,
  note: allMetals
    ? 'all metals'
    : 'filtered to battery raw materials (cobalt, lithium, nickel, natural graphite)',
});
facilities.push(...pub.facilities);

for (const cfg of COBALT_PAGES) {
  try {
    const res = await fetchCobaltList(cfg);
    sources.push({
      name: `RMI Cobalt Refiners (${cfg.status})`,
      page: cfg.url,
      dataUrl: res.caspioBase,
      records: res.facilities.length,
    });
    facilities.push(...res.facilities);
  } catch (err) {
    console.error(`warning: ${cfg.url} failed: ${err.message}`);
    sources.push({
      name: `RMI Cobalt Refiners (${cfg.status})`,
      page: cfg.url,
      error: err.message,
    });
  }
}

// Dedupe: the public list already contains most cobalt refiners. Prefer the
// public-list record (richer status vocabulary), keep list-only records.
const seen = new Map();
for (const f of facilities) {
  const key = `${f.metal}|${f.rmiId ?? f.name}`.toLowerCase();
  if (!seen.has(key)) seen.set(key, f);
}
facilities = [...seen.values()].sort(
  (a, b) => a.metal.localeCompare(b.metal) || (a.name ?? '').localeCompare(b.name ?? '')
);

const byMetal = {};
for (const f of facilities) byMetal[f.metal] = (byMetal[f.metal] ?? 0) + 1;

const out = {
  meta: {
    generator: 'scripts/fetch-rmi.mjs --accept-rmi-terms',
    retrieved,
    termsNote: TERMS_NOTE,
    termsAcceptedByUser: true,
    sources,
    counts: { total: facilities.length, byMetal },
    transformation:
      'HTML tables parsed from the server-rendered RMI Public List viewer and the Caspio datapages ' +
      'behind the cobalt refiner lists. Deduplicated by (metal, rmiId). Status values Conformant/Active ' +
      'normalized to lowercase; other statuses kept as published.',
  },
  facilities,
};

writeFileSync(target, JSON.stringify(out, null, 2) + '\n');
console.log(`wrote ${target}: ${facilities.length} facilities`, byMetal);
