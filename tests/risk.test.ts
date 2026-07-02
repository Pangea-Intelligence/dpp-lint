import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPayload } from '../src/core/read.js';
import { loadCahra, loadMaterials, matchMaterial } from '../src/risk/data.js';
import { parseOriginsFile, type ParsedOrigins } from '../src/risk/origins.js';
import { screen, type RiskFinding } from '../src/risk/screen.js';
import { runRisk } from '../src/commands/risk.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const materialFixture = path.join(root, 'fixtures', 'battery', 'MaterialComposition.payload.json');
const dueDiligenceFixture = path.join(
  root,
  'fixtures',
  'battery',
  'SupplyChainDueDiligence.payload.json'
);
const sampleJson = path.join(root, 'fixtures', 'origins.sample.json');
const sampleCsv = path.join(root, 'fixtures', 'origins.sample.csv');

const tmp = mkdtempSync(path.join(os.tmpdir(), 'dpp-lint-risk-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

let fileCounter = 0;
function tempFile(name: string, content: string): string {
  const filePath = path.join(tmp, `${fileCounter++}-${name}`);
  writeFileSync(filePath, content, 'utf8');
  return filePath;
}

/** Writes an origins JSON file with the given materials array and parses it. */
function originsOf(materials: unknown[]): ParsedOrigins {
  return parseOriginsFile(tempFile('origins.json', JSON.stringify({ materials })));
}

function byRule(findings: RiskFinding[], rule: RiskFinding['rule']): RiskFinding[] {
  return findings.filter((finding) => finding.rule === rule);
}

const materialPayload = readPayload(materialFixture).data as Record<string, unknown>;

describe('bundled datasets', () => {
  it('loads the CAHRA, RMI and materials snapshots', () => {
    expect(loadCahra().entries.length).toBeGreaterThan(0);
    expect(loadMaterials().materials.map((material) => material.id).sort()).toEqual([
      'cobalt',
      'lithium',
      'natural-graphite',
      'nickel',
    ]);
  });

  it('matches materials by name, synonym and CAS', () => {
    expect(matchMaterial('Lithium')?.id).toBe('lithium');
    expect(matchMaterial('7439-93-2')?.id).toBe('lithium');
    expect(matchMaterial('flake graphite')?.id).toBe('natural-graphite');
    expect(matchMaterial('Natural Graphite')?.id).toBe('natural-graphite');
    expect(matchMaterial('manganese')).toBeUndefined();
  });
});

describe('R1: CAHRA origin country', () => {
  it('flags an origin country taken from the shipped CAHRA snapshot', () => {
    const cahraEntry = loadCahra().entries[0];
    const origins = originsOf([{ material: 'cobalt', originCountry: cahraEntry.iso2 }]);
    const r1 = byRule(screen(materialPayload, origins).findings, 'R1');
    expect(r1).toHaveLength(1);
    expect(r1[0].severity).toBe('high');
    expect(r1[0].oecdStep).toBe(2);
    expect(r1[0].message).toContain(cahraEntry.countryName);
    expect(r1[0].reference).toContain('Art. 49');
    expect(r1[0].evidence.dataset).toContain('cahra');
  });

  it('says region-scoped for region-scoped designations', () => {
    const regionScoped = loadCahra().entries.find((entry) => !entry.wholeCountry);
    expect(regionScoped).toBeDefined();
    const origins = originsOf([{ material: 'cobalt', originCountry: regionScoped!.iso2 }]);
    const r1 = byRule(screen(materialPayload, origins).findings, 'R1');
    expect(r1[0].message).toContain('region-scoped');
  });

  it('does not say region-scoped for whole-country designations', () => {
    const wholeCountry = loadCahra().entries.find((entry) => entry.wholeCountry);
    expect(wholeCountry).toBeDefined();
    const origins = originsOf([{ material: 'nickel', originCountry: wholeCountry!.iso2 }]);
    const r1 = byRule(screen(materialPayload, origins).findings, 'R1');
    expect(r1[0].message).toContain('whole-country');
    expect(r1[0].message).not.toContain('region-scoped');
  });

  it('does not flag a country absent from the snapshot', () => {
    expect(loadCahra().entries.find((entry) => entry.iso2 === 'AU')).toBeUndefined();
    const origins = originsOf([{ material: 'lithium', originCountry: 'AU' }]);
    expect(byRule(screen(materialPayload, origins).findings, 'R1')).toHaveLength(0);
  });
});

describe('R2: smelter not on the public RMI list', () => {
  // The repository ships data/rmi-facilities.json empty for licensing reasons.
  // With the empty snapshot, R2 must be info (not medium) so a smelter that is
  // actually RMI-listed does not force exit code 1 out of the box.
  it('reports info with a populate-locally note while the bundled snapshot is empty', () => {
    const origins = originsOf([
      {
        material: 'cobalt',
        originCountry: 'AU',
        smelter: { name: 'Totally Unlisted Refining Co. Ltd.' },
      },
    ]);
    const r2 = byRule(screen(materialPayload, origins).findings, 'R2');
    expect(r2).toHaveLength(1);
    expect(r2[0].severity).toBe('info');
    expect(r2[0].oecdStep).toBe(2);
    expect(r2[0].message).toContain('RMI');
    expect(r2[0].message).toContain('verify');
    expect(r2[0].message).toContain('fetch-rmi.mjs');
  });

  it('reports a declared smelter id the same way', () => {
    const origins = originsOf([
      { material: 'nickel', originCountry: 'AU', smelter: { id: 'CID999999', name: 'X' } },
    ]);
    const r2 = byRule(screen(materialPayload, origins).findings, 'R2');
    expect(r2).toHaveLength(1);
    expect(r2[0].severity).toBe('info');
  });

  it('does not fire when no smelter is declared', () => {
    const origins = originsOf([{ material: 'lithium', originCountry: 'AU' }]);
    expect(byRule(screen(materialPayload, origins).findings, 'R2')).toHaveLength(0);
  });
});

describe('R2 with a populated RMI snapshot', () => {
  const facility = {
    name: 'Listed Example Refining Co. Ltd.',
    rmiId: 'CID000123',
    metal: 'cobalt',
    country: 'FI',
    status: 'Conformant',
    source: 'test',
  };

  async function screenWithSnapshot(origins: ParsedOrigins) {
    vi.resetModules();
    vi.doMock('../src/risk/data.js', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../src/risk/data.js')>();
      return {
        ...actual,
        loadRmi: () => ({ meta: { retrieved: '2026-07-01' }, facilities: [facility] }),
      };
    });
    try {
      const { screen: screenWithMockedData } = await import('../src/risk/screen.js');
      return screenWithMockedData(materialPayload, origins);
    } finally {
      vi.doUnmock('../src/risk/data.js');
      vi.resetModules();
    }
  }

  it('keeps medium severity when a non-empty snapshot lacks the smelter', async () => {
    const origins = originsOf([
      {
        material: 'cobalt',
        originCountry: 'AU',
        smelter: { name: 'Totally Unlisted Refining Co. Ltd.' },
      },
    ]);
    const r2 = byRule((await screenWithSnapshot(origins)).findings, 'R2');
    expect(r2).toHaveLength(1);
    expect(r2[0].severity).toBe('medium');
    expect(r2[0].message).not.toContain('fetch-rmi.mjs');
  });

  it('does not fire when the smelter matches a snapshot facility', async () => {
    const origins = originsOf([
      {
        material: 'cobalt',
        originCountry: 'AU',
        // Different legal suffixes on purpose: name matching normalizes them away.
        smelter: { name: 'Listed Example Refining Co.' },
      },
    ]);
    expect(byRule((await screenWithSnapshot(origins)).findings, 'R2')).toHaveLength(0);
  });

  it('matches by RMI facility id as well', async () => {
    const origins = originsOf([
      { material: 'cobalt', originCountry: 'AU', smelter: { id: 'CID000123' } },
    ]);
    expect(byRule((await screenWithSnapshot(origins)).findings, 'R2')).toHaveLength(0);
  });
});

describe('R3: regulated material without origins entry', () => {
  // The MaterialComposition fixture declares Lithium (CAS 7439-93-2).
  it('is high when an origins file is provided but lacks the material', () => {
    const origins = originsOf([{ material: 'cobalt', originCountry: 'AU' }]);
    const r3 = byRule(screen(materialPayload, origins).findings, 'R3');
    expect(r3).toHaveLength(1);
    expect(r3[0].severity).toBe('high');
    expect(r3[0].oecdStep).toBe(1);
    expect(r3[0].message).toContain('lithium');
    expect(r3[0].reference).toContain('Art. 48');
  });

  it('is info when no origins file is given at all', () => {
    const r3 = byRule(screen(materialPayload, undefined).findings, 'R3');
    expect(r3).toHaveLength(1);
    expect(r3[0].severity).toBe('info');
  });

  it('does not fire when the origins file covers the material', () => {
    const origins = originsOf([{ material: 'lithium', originCountry: 'AU' }]);
    expect(byRule(screen(materialPayload, origins).findings, 'R3')).toHaveLength(0);
  });
});

describe('R4: due diligence report link', () => {
  it('fires as info when the field is missing on a foreign module payload (MaterialComposition fixture)', () => {
    // MaterialComposition payloads cannot contain the report link by schema,
    // so R4 reminds instead of blocking: severity info, message points to the
    // SupplyChainDueDiligence part of the passport.
    const r4 = byRule(screen(materialPayload, undefined).findings, 'R4');
    expect(r4).toHaveLength(1);
    expect(r4[0].severity).toBe('info');
    expect(r4[0].oecdStep).toBe(5);
    expect(r4[0].reference).toContain('Art. 52');
    expect(r4[0].message).toContain('MaterialComposition');
  });

  it('fires as medium when the field is missing on an undetectable payload', () => {
    const r4 = byRule(screen({ someUnknownField: 1 }, undefined).findings, 'R4');
    expect(r4).toHaveLength(1);
    expect(r4[0].severity).toBe('medium');
  });

  it('keeps medium when the field is present but broken, even if detection picks another module', () => {
    // Regression (7-module expansion): a combined export whose majority of
    // keys belongs to another module must not downgrade a genuinely broken
    // report link to info just because detectModule picks that module.
    const circularity = readPayload(
      path.join(root, 'fixtures', 'battery', 'Circularity.payload.json')
    ).data as Record<string, unknown>;
    const combined = { ...circularity, supplyChainDueDiligenceReport: 'not a url' };
    const r4 = byRule(screen(combined, undefined).findings, 'R4');
    expect(r4).toHaveLength(1);
    expect(r4[0].severity).toBe('medium');
    expect(r4[0].message).not.toContain('cannot contain');
  });

  it('still downgrades to info when the field is absent on a v0.2 module payload', () => {
    const labeling = readPayload(
      path.join(root, 'fixtures', 'battery', 'Labeling.payload.json')
    ).data;
    const r4 = byRule(screen(labeling, undefined).findings, 'R4');
    expect(r4).toHaveLength(1);
    expect(r4[0].severity).toBe('info');
    expect(r4[0].message).toContain('Labeling');
  });

  it('fires for a non-http(s) scheme (official fixture uses telnet://)', () => {
    const payload = readPayload(dueDiligenceFixture).data;
    const r4 = byRule(screen(payload, undefined).findings, 'R4');
    expect(r4).toHaveLength(1);
    expect(r4[0].message).toContain('telnet');
  });

  it('fires for a plain non-URL string', () => {
    const r4 = byRule(
      screen({ supplyChainDueDiligenceReport: 'not a url' }, undefined).findings,
      'R4'
    );
    expect(r4).toHaveLength(1);
  });

  it('passes with a valid https URL', () => {
    const payload = { supplyChainDueDiligenceReport: 'https://example.com/dd-report.pdf' };
    expect(byRule(screen(payload, undefined).findings, 'R4')).toHaveLength(0);
  });
});

describe('R5: isCriticalRawMaterial outside the regulated four', () => {
  it('notes CRM-flagged materials outside Annex X as info', () => {
    const payload = {
      batteryMaterials: [
        { batteryMaterialName: 'Manganese', isCriticalRawMaterial: true },
        { batteryMaterialName: 'Lithium', isCriticalRawMaterial: true },
      ],
    };
    const r5 = byRule(screen(payload, undefined).findings, 'R5');
    expect(r5).toHaveLength(1);
    expect(r5[0].severity).toBe('info');
    expect(r5[0].message).toContain('Manganese');
    expect(r5[0].reference).toContain('2024/1252');
  });
});

describe('origins parsing', () => {
  it('parses the CSV and JSON sample fixtures to the same entries', () => {
    const fromJson = parseOriginsFile(sampleJson);
    const fromCsv = parseOriginsFile(sampleCsv);
    expect(fromCsv.entries).toEqual(fromJson.entries);
    expect(fromJson.warnings).toEqual([]);
    expect(fromCsv.warnings).toEqual([]);
    expect(fromJson.entries).toHaveLength(3);
    expect(fromJson.entries[0].materialId).toBe('cobalt');
    expect(fromJson.entries[0].smelter?.name).toBe('Kolwezi Example Refining Co. Ltd.');
  });

  it('handles quoted CSV fields containing commas', () => {
    const csv = tempFile(
      'commas.csv',
      'material,origin_country,share,smelter_name,smelter_id,smelter_country\n' +
        'cobalt,AU,,"Refinery, with comma Ltd.",,\n'
    );
    const parsed = parseOriginsFile(csv);
    expect(parsed.entries[0].smelter?.name).toBe('Refinery, with comma Ltd.');
  });

  it('warns (does not crash) on unknown materials and country codes', () => {
    const origins = originsOf([{ material: 'unobtainium', originCountry: 'XX' }]);
    expect(origins.entries).toHaveLength(1);
    expect(origins.entries[0].materialId).toBeNull();
    expect(origins.warnings.some((w) => w.includes('unobtainium'))).toBe(true);
    expect(origins.warnings.some((w) => w.includes('XX'))).toBe(true);
  });

  it('rejects structural problems as errors', () => {
    expect(() => parseOriginsFile(tempFile('bad.json', '{"nope": true}'))).toThrow(/materials/);
    expect(() =>
      parseOriginsFile(tempFile('bad2.json', '{"materials": [{"originCountry": "AU"}]}'))
    ).toThrow(/material/);
    expect(() => parseOriginsFile(tempFile('bad.txt', 'material,origin_country\n'))).toThrow(
      /extension/
    );
  });
});

describe('runRisk exit codes and output', () => {
  let logs: string[];
  let errors: string[];

  beforeEach(() => {
    logs = [];
    errors = [];
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logs.push(args.join(' '));
    });
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      errors.push(args.join(' '));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 1 when high or medium findings exist', async () => {
    const code = await runRisk(materialFixture, {
      origins: sampleJson,
      json: false,
      quiet: false,
    });
    expect(code).toBe(1);
    const output = logs.join('\n');
    expect(output).toContain('OECD step 2');
    expect(output).toContain('CAHRA');
  });

  it('returns 0 for a clean payload with covered origins', async () => {
    const payload = tempFile(
      'clean.payload.json',
      JSON.stringify({
        batteryMaterials: [
          {
            batteryMaterialName: 'Lithium',
            batteryMaterialIdentifier: '7439-93-2',
            isCriticalRawMaterial: true,
          },
        ],
        supplyChainDueDiligenceReport: 'https://example.com/dd-report.pdf',
      })
    );
    const origins = tempFile(
      'clean.origins.json',
      JSON.stringify({ materials: [{ material: 'lithium', originCountry: 'AU' }] })
    );
    const code = await runRisk(payload, { origins, json: false, quiet: false });
    expect(code).toBe(0);
  });

  it('returns 0 when a smelter is declared but the bundled RMI snapshot is empty', async () => {
    // CI regression guard: with the empty default snapshot, R2 must not flip
    // the exit code to 1 for origins files that declare a smelter.
    const payload = tempFile(
      'smelter.payload.json',
      JSON.stringify({
        batteryMaterials: [{ batteryMaterialName: 'Cobalt', isCriticalRawMaterial: true }],
        supplyChainDueDiligenceReport: 'https://example.com/dd-report.pdf',
      })
    );
    const origins = tempFile(
      'smelter.origins.json',
      JSON.stringify({
        materials: [
          {
            material: 'cobalt',
            originCountry: 'AU',
            smelter: { name: 'Possibly RMI Conformant Refining Co.' },
          },
        ],
      })
    );
    const code = await runRisk(payload, { origins, json: false, quiet: false });
    expect(code).toBe(0);
  });

  it('returns 0 with only info findings when no origins file is given but the payload is fine', async () => {
    const payload = tempFile(
      'info.payload.json',
      JSON.stringify({
        batteryMaterials: [{ batteryMaterialName: 'Lithium' }],
        supplyChainDueDiligenceReport: 'https://example.com/dd-report.pdf',
      })
    );
    const code = await runRisk(payload, { json: true, quiet: false });
    expect(code).toBe(0);
    const parsed = JSON.parse(logs.join('\n')) as {
      originScreening: string;
      summary: { high: number; medium: number; info: number };
      findings: RiskFinding[];
    };
    expect(parsed.originScreening).toBe('skipped');
    expect(parsed.summary).toEqual({ high: 0, medium: 0, info: 1 });
    expect(parsed.findings[0].rule).toBe('R3');
  });

  it('returns 2 for a missing payload file', async () => {
    const code = await runRisk(path.join(tmp, 'does-not-exist.json'), {
      json: false,
      quiet: false,
    });
    expect(code).toBe(2);
    expect(errors.join('\n')).toContain('not found');
  });

  it('returns 2 for a broken origins file', async () => {
    const origins = tempFile('broken.origins.json', '{"materials": "nope"}');
    const code = await runRisk(materialFixture, { origins, json: false, quiet: false });
    expect(code).toBe(2);
    expect(errors.join('\n')).toContain('materials');
  });

  it('emits machine-readable JSON with --json', async () => {
    const code = await runRisk(materialFixture, {
      origins: sampleCsv,
      json: true,
      quiet: false,
    });
    expect(code).toBe(1);
    const parsed = JSON.parse(logs.join('\n')) as {
      originScreening: string;
      summary: { high: number; medium: number; info: number };
      findings: RiskFinding[];
    };
    expect(parsed.originScreening).toBe('performed');
    // Sample origins vs MaterialComposition fixture:
    // R1 cobalt/CD (high), R2 info for both declared smelters (bundled RMI snapshot
    // is empty), R4 missing report (medium).
    // R4 is info here: the MaterialComposition fixture cannot contain the
    // report link by schema (see the R4 foreign-module rule).
    expect(parsed.summary).toEqual({ high: 1, medium: 0, info: 3 });
    for (const finding of parsed.findings) {
      expect(finding.oecdStep).toBeGreaterThanOrEqual(1);
      expect(finding.oecdStep).toBeLessThanOrEqual(5);
      expect(finding.evidence.dataset).toBeTruthy();
      expect(finding.reference).toBeTruthy();
    }
  });
});
