import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let cachedRoot: string | undefined;

/**
 * Resolves the dpp-lint package root by walking up from this file's
 * directory to the nearest package.json. Works both when running from
 * src/ (via tsx) and from dist/ (compiled), and when the CLI is invoked
 * via npx from an arbitrary working directory.
 */
export function packageRoot(): string {
  if (cachedRoot) return cachedRoot;
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (;;) {
    if (existsSync(path.join(dir, 'package.json'))) {
      cachedRoot = dir;
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        `dpp-lint internal error: could not locate package root (no package.json above ${path.dirname(
          fileURLToPath(import.meta.url)
        )})`
      );
    }
    dir = parent;
  }
}

/** Joins path segments onto the package root. */
export function fromRoot(...segments: string[]): string {
  return path.join(packageRoot(), ...segments);
}
