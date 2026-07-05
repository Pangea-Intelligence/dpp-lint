import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as api from '../src/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const tmp = mkdtempSync(path.join(os.tmpdir(), 'dpp-lint-index-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
afterEach(() => vi.restoreAllMocks());

describe('public API entry point', () => {
  it('package.json main/exports point at a file the build actually emits', () => {
    // Regression: main/exports referenced dist/index.js while no src/index.ts
    // existed, so programmatic imports of the published package failed with
    // ERR_MODULE_NOT_FOUND.
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as {
      main?: string;
      exports?: string | Record<string, string | Record<string, string>>;
    };
    const targets = new Set<string>();
    if (pkg.main) targets.add(pkg.main);
    if (typeof pkg.exports === 'string') targets.add(pkg.exports);
    else if (pkg.exports) {
      for (const value of Object.values(pkg.exports)) {
        if (typeof value === 'string') {
          targets.add(value);
          continue;
        }
        // Conditional exports: Node picks the first matching condition, so
        // "types" is only effective when it comes before "default" etc.
        const conditions = Object.keys(value);
        if (conditions.includes('types')) expect(conditions[0]).toBe('types');
        for (const target of Object.values(value)) targets.add(target);
      }
    }

    for (const target of targets) {
      // dist/<name>.js and dist/<name>.d.ts are emitted by tsc from
      // src/<name>.ts (rootDir src, outDir dist, declaration true).
      const match = /^\.\/dist\/(.+?)(?:\.js|\.d\.ts)$/.exec(target);
      expect(match, `unexpected entry point target: ${target}`).not.toBeNull();
      const source = path.join(root, 'src', `${match![1]}.ts`);
      expect(existsSync(source), `missing source for entry point ${target}: ${source}`).toBe(true);
    }
  });

  it('re-exports the documented public API', () => {
    expect(typeof api.runLint).toBe('function');
    expect(typeof api.runRisk).toBe('function');
    expect(typeof api.runTemplate).toBe('function');
    expect(typeof api.readPayload).toBe('function');
    expect(typeof api.validatePayload).toBe('function');
    expect(typeof api.detectModule).toBe('function');
    expect(typeof api.screen).toBe('function');
    expect(typeof api.parseOriginsFile).toBe('function');
    expect(typeof api.loadCahra).toBe('function');
    expect(typeof api.matchMaterial).toBe('function');
    // Structural invariant instead of a magic count: MODULES must exactly
    // match the vendored schema files. Catches both drift directions (module
    // listed without schema, schema vendored without being listed).
    const vendored = readdirSync(path.join(root, 'schemas', 'battery', '1.2.0'))
      .filter((f) => f.endsWith('.schema.json'))
      .map((f) => f.replace(/\.schema\.json$/, ''))
      .sort();
    expect([...api.MODULES].sort()).toEqual(vendored);
    expect(api.PROFILE).toBe('battery');
  });

  it('runTemplate writes the curated starter payload for a module', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const output = path.join(tmp, 'MaterialComposition.json');
    const code = api.runTemplate('MaterialComposition', { output, force: false });

    expect(code).toBe(0);
    expect(existsSync(output)).toBe(true);
    // The template is the vendored fixture payload, copied verbatim.
    const fixture = path.join(root, 'fixtures', 'battery', 'MaterialComposition.payload.json');
    expect(readFileSync(output, 'utf8')).toBe(readFileSync(fixture, 'utf8'));

    // Existing file without --force is a usage error (exit code 2).
    expect(api.runTemplate('MaterialComposition', { output, force: false })).toBe(2);
    // Unknown module is a usage error too.
    expect(api.runTemplate('NotAModule', { output: path.join(tmp, 'x.json'), force: false })).toBe(
      2
    );
  });
});
