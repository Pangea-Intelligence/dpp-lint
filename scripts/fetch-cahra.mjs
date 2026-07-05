#!/usr/bin/env node
// Fetches the EU indicative list of Conflict-Affected and High-Risk Areas (CAHRAs)
// from the public API behind https://www.cahraslist.net/ and writes data/cahra.json.
//
// The website (cahraslist.net) is a React SPA. Its data source is the JSON API at
// https://cahra-api.cahraslist.net/api/v1/cahras (endpoint extracted from the site's
// JS bundle). The API returns one object per country with per-report region entries.
// The API rejects requests without browser-like Origin/Referer headers (403),
// so we send the same headers the SPA itself sends.
//
// Re-runnable: node scripts/fetch-cahra.mjs

import { writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'https://cahra-api.cahraslist.net/api/v1/cahras';
const CHANGELOG = 'https://cahra-api.cahraslist.net/api/v1/changelog/latest';

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  Accept: 'application/json, text/plain, */*',
  Origin: 'https://www.cahraslist.net',
  Referer: 'https://www.cahraslist.net/',
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

async function getJson(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`);
  return res.json();
}

const raw = await getJson(API);
let changelog = null;
try {
  changelog = await getJson(CHANGELOG);
} catch (err) {
  console.error('warning: changelog fetch failed:', err.message);
}

// Shape of `raw`: [{ count, country_code (ISO3), country_name, reports: [{
//   title, created_at, updated_at, is_country_level,
//   included_regions: [{ auto_id, name, code (ISO 3166-2), conflict_affected, high_risk }] }] }]
// One report object per region for region-level countries; a single report with all
// regions enumerated for whole-country designations (is_country_level = true).

const versions = new Set();
const entries = raw
  .map((c) => {
    const reports = c.reports ?? [];
    for (const r of reports) versions.add(r.title);
    const wholeCountry = reports.some((r) => r.is_country_level === true);
    const regionMap = new Map();
    for (const r of reports) {
      for (const g of r.included_regions ?? []) {
        regionMap.set(g.code, {
          name: g.name,
          code: g.code, // ISO 3166-2 subdivision code
          conflictAffected: g.conflict_affected === true,
          highRisk: g.high_risk === true,
        });
      }
    }
    const regions = [...regionMap.values()].sort((a, b) => a.code.localeCompare(b.code));
    // ISO2 derived from the ISO 3166-2 subdivision code prefix (e.g. "AF-BDS" -> "AF").
    const iso2 = regions.length > 0 ? regions[0].code.split('-')[0] : null;
    return {
      countryName: c.country_name,
      iso2,
      iso3: c.country_code,
      // Per target schema: regions is null when the whole country is designated.
      regions: wholeCountry ? null : regions,
      wholeCountry,
    };
  })
  .sort((a, b) => a.countryName.localeCompare(b.countryName));

const out = {
  meta: {
    source: API,
    website: 'https://www.cahraslist.net/',
    retrieved: new Date().toISOString().slice(0, 10),
    version: [...versions].sort().join('; '),
    dataUpdated: changelog?.data_updated?.['$date'] ?? null,
    reportsUpdated: changelog?.reports_updated?.['$date'] ?? null,
    license:
      'Indicative, non-exhaustive list of CAHRAs under EU Regulation 2017/821, maintained by RAND Europe for the European Commission (DG TRADE). Public information; no explicit license published on cahraslist.net. Not an official or exhaustive EU designation.',
    transformation:
      'One entry per country. Region reports merged and deduplicated by ISO 3166-2 code. regions=null and wholeCountry=true when the source marks the designation as country-level. iso2 derived from ISO 3166-2 subdivision code prefix.',
  },
  entries,
};

const root = packageRoot(dirname(fileURLToPath(import.meta.url)));
const target = join(root, 'data', 'cahra.json');
writeFileSync(target, JSON.stringify(out, null, 2) + '\n');
const regionCount = entries.reduce((n, e) => n + (e.regions?.length ?? 0), 0);
console.log(
  `wrote ${target}: ${entries.length} countries, ${regionCount} listed regions, ` +
    `${entries.filter((e) => e.wholeCountry).length} whole-country designations`
);
