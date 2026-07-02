import { describe, expect, it, vi, afterEach } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPayload, decodeJsonBuffer, ReadError } from '../src/core/read.js';
import { detectModule, MODULES, type ModuleName } from '../src/core/schemas.js';
import { validatePayload } from '../src/core/validate.js';
import { toFindings } from '../src/core/messages.js';
import { runLint } from '../src/commands/lint.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const fixture = (module: string) =>
  path.join(root, 'fixtures', 'battery', `${module}.payload.json`);

function clone<T>(value: T): T {
  return structuredClone(value);
}

function lintErrors(module: ModuleName, payload: unknown) {
  const { valid, errors } = validatePayload(module, payload);
  return { valid, findings: toFindings(module, errors, payload) };
}

describe('official fixtures', () => {
  for (const module of MODULES) {
    it(`${module} payload validates OK`, () => {
      const { data } = readPayload(fixture(module));
      const { valid, findings } = lintErrors(module, data);
      expect(findings).toEqual([]);
      expect(valid).toBe(true);
    });
  }
});

describe('module auto-detection', () => {
  for (const module of MODULES) {
    it(`detects ${module}`, () => {
      const { data } = readPayload(fixture(module));
      const detection = detectModule(data);
      expect(detection).toMatchObject({ kind: 'detected', module });
    });
  }

  it('reports unknown for unrelated payloads', () => {
    expect(detectModule({ foo: 1, bar: 2 }).kind).toBe('unknown');
    expect(detectModule([1, 2, 3]).kind).toBe('unknown');
    expect(detectModule({}).kind).toBe('unknown');
  });
});

describe('mutated payloads fail with the right pointers', () => {
  const base = readPayload(fixture('GeneralProductInformation')).data as Record<string, unknown>;

  it('missing required field', () => {
    const mutated = clone(base);
    delete mutated.warrentyPeriod;
    const { valid, findings } = lintErrors('GeneralProductInformation', mutated);
    expect(valid).toBe(false);
    const finding = findings.find((f) => f.pointer === '/warrentyPeriod');
    expect(finding).toBeDefined();
    expect(finding!.keyword).toBe('required');
    expect(finding!.message).toContain('required attribute "warrentyPeriod" is missing');
  });

  it('wrong type', () => {
    const mutated = clone(base);
    mutated.batteryMass = 'heavy';
    const { valid, findings } = lintErrors('GeneralProductInformation', mutated);
    expect(valid).toBe(false);
    const finding = findings.find((f) => f.pointer === '/batteryMass' && f.keyword === 'type');
    expect(finding).toBeDefined();
    expect(finding!.message).toContain('expected type number, got string');
  });

  it('invalid enum value', () => {
    const mutated = clone(base);
    mutated.batteryStatus = 'Broken';
    const { valid, findings } = lintErrors('GeneralProductInformation', mutated);
    expect(valid).toBe(false);
    const finding = findings.find((f) => f.pointer === '/batteryStatus' && f.keyword === 'enum');
    expect(finding).toBeDefined();
    expect(finding!.message).toContain('"Broken"');
    expect(finding!.message).toContain('"Original"');
  });

  it('enriches findings with DIN chapter references', () => {
    const mutated = clone(base);
    delete mutated.batteryCategory;
    const { findings } = lintErrors('GeneralProductInformation', mutated);
    const finding = findings.find((f) => f.pointer === '/batteryCategory');
    expect(finding).toBeDefined();
    expect(finding!.preferredName).toBe('BatteryCategory');
    expect(finding!.dinChapter).toBe('6.1.3.5');
  });
});

describe('encoding support', () => {
  it('parses a UTF-16LE file with BOM', () => {
    const utf16 = readPayload(
      path.join(here, 'fixtures', 'GeneralProductInformation.utf16le-bom.payload.json')
    );
    expect(utf16.encoding).toBe('utf-16le (BOM)');
    const utf8 = readPayload(fixture('GeneralProductInformation'));
    expect(utf16.data).toEqual(utf8.data);
    expect(validatePayload('GeneralProductInformation', utf16.data).valid).toBe(true);
  });

  it('decodes UTF-8 BOM, UTF-16BE BOM and BOM-less UTF-16', () => {
    const json = '{"a":1}';
    const utf8bom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(json, 'utf8')]);
    expect(decodeJsonBuffer(utf8bom, 't').encoding).toBe('utf-8 (BOM)');

    const le = Buffer.from(json, 'utf16le');
    expect(decodeJsonBuffer(le, 't')).toMatchObject({ text: json, encoding: 'utf-16le' });

    const be = Buffer.from(json, 'utf16le');
    be.swap16();
    expect(decodeJsonBuffer(be, 't')).toMatchObject({ text: json, encoding: 'utf-16be' });

    const beBom = Buffer.concat([Buffer.from([0xfe, 0xff]), be]);
    expect(decodeJsonBuffer(beBom, 't')).toMatchObject({ text: json, encoding: 'utf-16be (BOM)' });
  });

  it('rejects truncated (odd-length) UTF-16 input with BAD_ENCODING, not a raw RangeError', () => {
    // Regression: for UTF-16BE the byte swap used to run before the odd-length
    // check, so Buffer.swap16() threw a cryptic RangeError instead of ReadError.
    const oddBuffers = [
      Buffer.from([0xfe, 0xff, 0x00, 0x7b, 0x00]), // UTF-16BE with BOM, odd body
      Buffer.from([0x00, 0x7b, 0x00]), // BOM-less UTF-16BE, odd length
      Buffer.from([0x7b, 0x00, 0x22]), // BOM-less UTF-16LE, odd length
    ];
    for (const buf of oddBuffers) {
      try {
        decodeJsonBuffer(buf, 't');
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(ReadError);
        expect((err as ReadError).code).toBe('BAD_ENCODING');
        expect((err as ReadError).message).toContain('odd number of bytes');
      }
    }
  });

  it('reports missing files and invalid JSON with the file path', () => {
    expect(() => readPayload(path.join(here, 'nope.json'))).toThrowError(/nope\.json.*not found/);
    try {
      readPayload(path.join(here, 'lint.test.ts')); // valid UTF-8, not JSON
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ReadError);
      expect((err as ReadError).code).toBe('BAD_JSON');
      expect((err as ReadError).message).toContain('lint.test.ts');
    }
  });
});

describe('email regex fix (upstream issue #54)', () => {
  const base = readPayload(fixture('GeneralProductInformation')).data as {
    operatorInformation: { emailAddress: string };
  };

  it('accepts a normal address like user.name+tag@example.co.uk', () => {
    const mutated = clone(base);
    mutated.operatorInformation.emailAddress = 'user.name+tag@example.co.uk';
    expect(validatePayload('GeneralProductInformation', mutated).valid).toBe(true);
  });

  it('rejects a clearly invalid address', () => {
    const mutated = clone(base);
    mutated.operatorInformation.emailAddress = 'not-an-email';
    const { valid, findings } = lintErrors('GeneralProductInformation', mutated);
    expect(valid).toBe(false);
    expect(
      findings.some((f) => f.pointer === '/operatorInformation/emailAddress' && f.keyword === 'pattern')
    ).toBe(true);
  });
});

describe('runLint command', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function muted() {
    return {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  }

  it('returns 0 for the three official fixtures', async () => {
    muted();
    const code = await runLint(
      MODULES.map((m) => fixture(m)),
      { profile: 'battery', json: false, quiet: true }
    );
    expect(code).toBe(0);
  });

  it('returns 1 when a file has findings', async () => {
    muted();
    const code = await runLint([path.join(here, 'lint.test.ts')], {
      profile: 'battery',
      json: false,
      quiet: true,
    });
    expect(code).toBe(1);
  });

  it('returns 2 for an unknown module name and lists valid ones', async () => {
    const spies = muted();
    const code = await runLint([fixture('MaterialComposition')], {
      profile: 'battery',
      module: 'NotAModule',
      json: false,
      quiet: true,
    });
    expect(code).toBe(2);
    const stderrText = spies.error.mock.calls.map((c) => c.join(' ')).join('\n');
    for (const m of MODULES) expect(stderrText).toContain(m);
  });

  it('emits machine-readable JSON with --json', async () => {
    const spies = muted();
    const code = await runLint([fixture('SupplyChainDueDiligence')], {
      profile: 'battery',
      json: true,
      quiet: true,
    });
    expect(code).toBe(0);
    const out = spies.log.mock.calls.map((c) => c.join(' ')).join('\n');
    const parsed = JSON.parse(out) as Array<{ file: string; module: string; valid: boolean }>;
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ module: 'SupplyChainDueDiligence', valid: true, errors: [] });
  });
});
