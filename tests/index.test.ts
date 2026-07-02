import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as api from '../src/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('public API entry point', () => {
  it('package.json main/exports point at a file the build actually emits', () => {
    // Regression: main/exports referenced dist/index.js while no src/index.ts
    // existed, so programmatic imports of the published package failed with
    // ERR_MODULE_NOT_FOUND.
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as {
      main?: string;
      exports?: Record<string, string> | string;
    };
    const targets = new Set<string>();
    if (pkg.main) targets.add(pkg.main);
    if (typeof pkg.exports === 'string') targets.add(pkg.exports);
    else if (pkg.exports) for (const value of Object.values(pkg.exports)) targets.add(value);

    for (const target of targets) {
      // dist/<name>.js is emitted by tsc from src/<name>.ts (rootDir src, outDir dist).
      const match = /^\.\/dist\/(.+)\.js$/.exec(target);
      expect(match, `unexpected entry point target: ${target}`).not.toBeNull();
      const source = path.join(root, 'src', `${match![1]}.ts`);
      expect(existsSync(source), `missing source for entry point ${target}: ${source}`).toBe(true);
    }
  });

  it('re-exports the documented public API', () => {
    expect(typeof api.runLint).toBe('function');
    expect(typeof api.runRisk).toBe('function');
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
});
