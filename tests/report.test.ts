import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runLint } from '../src/commands/lint.js';
import { runRisk } from '../src/commands/risk.js';
import { runTemplate } from '../src/commands/template.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const fixture = (module: string) =>
  path.join(root, 'fixtures', 'battery', `${module}.payload.json`);

const tmp = mkdtempSync(path.join(os.tmpdir(), 'dpp-lint-report-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

afterEach(() => {
  vi.restoreAllMocks();
});

function muted() {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
}

describe('--report (lint)', () => {
  it('writes a self-contained HTML report with findings and escaping', async () => {
    muted();
    const broken = JSON.parse(readFileSync(fixture('GeneralProductInformation'), 'utf8')) as {
      batteryMass: unknown;
      productIdentifier: unknown;
    };
    broken.batteryMass = 'heavy';
    broken.productIdentifier = '<script>alert(1)</script>';
    const payloadFile = path.join(tmp, 'broken.json');
    writeFileSync(payloadFile, JSON.stringify(broken), 'utf8');

    const reportFile = path.join(tmp, 'lint-report.html');
    const code = await runLint([payloadFile, fixture('MaterialComposition')], {
      profile: 'battery',
      json: false,
      quiet: true,
      report: reportFile,
    });
    expect(code).toBe(1);
    const html = readFileSync(reportFile, 'utf8');
    expect(html).toContain('Battery passport schema check');
    expect(html).toContain('1 of 2 file(s) with findings');
    expect(html).toContain('expected type number, got string');
    expect(html).toContain('DIN DKE SPEC 99100 ch. 6.1.3.6');
    // payload values must never reach the report unescaped
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});

describe('--report (risk)', () => {
  it('writes the OECD-step report with severities and data provenance', async () => {
    muted();
    const originsFile = path.join(tmp, 'origins.json');
    writeFileSync(
      originsFile,
      JSON.stringify({ materials: [{ material: 'cobalt', originCountry: 'CD' }] }),
      'utf8'
    );
    const reportFile = path.join(tmp, 'risk-report.html');
    const code = await runRisk(fixture('MaterialComposition'), {
      origins: originsFile,
      json: false,
      quiet: true,
      report: reportFile,
    });
    expect(code).toBe(1);
    const html = readFileSync(reportFile, 'utf8');
    expect(html).toContain('Raw material due-diligence screening');
    expect(html).toContain('OECD step 2');
    expect(html).toContain('badge high');
    expect(html).toContain('data/cahra.json');
  });
});

describe('template command', () => {
  it('writes a starter payload that validates cleanly (roundtrip)', async () => {
    muted();
    const out = path.join(tmp, 'Labeling.json');
    expect(runTemplate('Labeling', { output: out, force: false })).toBe(0);
    expect(existsSync(out)).toBe(true);
    const code = await runLint([out], { profile: 'battery', json: false, quiet: true });
    expect(code).toBe(0);
  });

  it('refuses to overwrite without --force and accepts it with --force', () => {
    muted();
    const out = path.join(tmp, 'Circularity.json');
    expect(runTemplate('Circularity', { output: out, force: false })).toBe(0);
    expect(runTemplate('Circularity', { output: out, force: false })).toBe(2);
    expect(runTemplate('Circularity', { output: out, force: true })).toBe(0);
  });

  it('rejects unknown modules with exit 2 and lists valid ones', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(runTemplate('NotAModule', { force: false })).toBe(2);
    const text = spy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(text).toContain('GeneralProductInformation');
  });
});
