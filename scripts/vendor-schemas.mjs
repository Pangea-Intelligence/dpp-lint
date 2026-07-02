#!/usr/bin/env node
// Vendors BatteryPassDataModel 1.2.0 artifacts from the upstream GitHub repo:
// - schemas/battery/1.2.0/<Module>.schema.json  (byte-for-byte, may be UTF-16)
// - ttl/<Module>.ttl                            (byte-for-byte, generator input)
// - fixtures/battery/<Module>.payload.json      (re-encoded to UTF-8, pretty-printed;
//                                                see schemas/PATCHES.md section 4)
//
// Existing files are never overwritten unless --force is given, because the
// vendored fixtures carry curated fixes documented in schemas/PATCHES.md.
//
// Usage: node scripts/vendor-schemas.mjs [--ref <sha>] [--force] [Module ...]
//        (no module args = all known modules)
// Plain Node >= 20, no dependencies.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Upstream commit the vendored artifacts were taken from (repo has no release
// tags). Bump deliberately and re-run; document schema diffs in PATCHES.md.
const DEFAULT_REF = '8722af2d15c981c63552e50b9cd71a39b213b9fc';

const VERSION = '1.2.0';
const RAW = 'https://raw.githubusercontent.com/batterypass/BatteryPassDataModel';

// Module name (= official 1.2.0 aspect name = our schema/fixture filename)
// -> upstream location under BatteryPass/. payloadFile overrides the default
// gen/<Aspect>-payload.json for the one module whose example is named
// differently upstream (a static fact, not probed at runtime).
const UPSTREAM = {
  GeneralProductInformation: { dir: 'io.BatteryPass.GeneralProductInformation' },
  MaterialComposition: { dir: 'io.BatteryPass.MaterialComposition' },
  SupplyChainDueDiligence: { dir: 'io.BatteryPass.SupplyChainDueDiligence' },
  CarbonFootprintForBatteries: { dir: 'io.BatteryPass.CarbonFootprint' },
  Circularity: { dir: 'io.BatteryPass.Circularity', payloadFile: 'Circularity.json' },
  PerformanceAndDurability: { dir: 'io.BatteryPass.Performance' },
  Labeling: { dir: 'io.BatteryPass.Labels' },
};

function parseArgs(argv) {
  const args = { ref: DEFAULT_REF, force: false, modules: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--ref') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) {
        console.error('--ref requires a commit sha or branch name');
        process.exit(2);
      }
      args.ref = value;
    } else if (argv[i] === '--force') args.force = true;
    else args.modules.push(argv[i]);
  }
  if (args.modules.length === 0) args.modules = Object.keys(UPSTREAM);
  for (const m of args.modules) {
    if (!UPSTREAM[m]) {
      console.error(`unknown module "${m}". Known: ${Object.keys(UPSTREAM).join(', ')}`);
      process.exit(2);
    }
  }
  return args;
}

async function fetchBytes(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * BOM-based decode; upstream emits UTF-8 and UTF-16 LE/BE, always with BOM
 * for non-UTF-8. Decoding is strict: truncated UTF-16 (odd byte count) and
 * invalid UTF-8 raise instead of silently committing mangled fixtures.
 * (A deliberately dependency-free sibling of src/core/read.ts decodeJsonBuffer,
 * so the vendor script runs without a prior build.)
 */
function decodeUpstreamJson(buf, label) {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return decodeUtf16(buf.subarray(2), false, label);
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    return decodeUtf16(buf.subarray(2), true, label);
  }
  const bomless =
    buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf
      ? buf.subarray(3)
      : buf;
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bomless);
  } catch {
    throw new Error(`${label}: content is not valid UTF-8`);
  }
  if (text.includes('\u0000')) {
    throw new Error(`cannot detect encoding of ${label} (looks like BOM-less UTF-16)`);
  }
  return text;
}

function decodeUtf16(body, bigEndian, label) {
  if (body.length % 2 !== 0) {
    throw new Error(`${label}: truncated UTF-16 content (odd number of bytes)`);
  }
  const buf = bigEndian ? Buffer.from(body).swap16() : body;
  return buf.toString('utf16le');
}

function writeIfAllowed(file, content, force, written, skipped) {
  if (existsSync(file) && !force) {
    skipped.push(path.relative(root, file));
    return;
  }
  writeFileSync(file, content);
  written.push(path.relative(root, file));
}

const { ref, force, modules } = parseArgs(process.argv.slice(2));
const written = [];
const skipped = [];

for (const module of modules) {
  const { dir, payloadFile } = UPSTREAM[module];
  const base = `${RAW}/${ref}/BatteryPass/${dir}/${VERSION}`;

  const schemaBuf = await fetchBytes(`${base}/gen/${module}-schema.json`);
  writeIfAllowed(
    path.join(root, 'schemas', 'battery', VERSION, `${module}.schema.json`),
    schemaBuf, force, written, skipped
  );

  const ttlBuf = await fetchBytes(`${base}/${module}.ttl`);
  writeIfAllowed(path.join(root, 'ttl', `${module}.ttl`), ttlBuf, force, written, skipped);

  const payloadName = payloadFile ?? `${module}-payload.json`;
  const payloadBuf = await fetchBytes(`${base}/gen/${payloadName}`);
  const payload = JSON.parse(decodeUpstreamJson(payloadBuf, payloadName));
  writeIfAllowed(
    path.join(root, 'fixtures', 'battery', `${module}.payload.json`),
    JSON.stringify(payload, null, 2) + '\n', force, written, skipped
  );
}

console.log(`vendored from ${ref}`);
for (const f of written) console.log(`  written: ${f}`);
for (const f of skipped) console.log(`  skipped (exists, use --force): ${f}`);
