import { copyFileSync, existsSync } from 'node:fs';
import pc from 'picocolors';
import { fromRoot } from '../core/paths.js';
import { isModuleName, loadSchema, MODULES, PROFILE } from '../core/schemas.js';
import { lookupDin } from '../core/messages.js';

export interface TemplateOptions {
  output?: string;
  force: boolean;
}

/**
 * Writes a starter payload for a module (the official upstream example,
 * curated to validate cleanly) and prints the required fields with their
 * DIN DKE SPEC 99100 chapter references as a fill-in guide.
 * Exit codes: 0 = written, 2 = usage error.
 */
export function runTemplate(moduleName: string, opts: TemplateOptions): number {
  if (!isModuleName(moduleName)) {
    console.error(
      pc.red(`dpp-lint: unknown module "${moduleName}". Valid modules: ${MODULES.join(', ')}`)
    );
    return 2;
  }

  const source = fromRoot('fixtures', 'battery', `${moduleName}.payload.json`);
  const target = opts.output ?? `${moduleName}.json`;
  if (existsSync(target) && !opts.force) {
    console.error(pc.red(`dpp-lint: ${target} already exists (use --force to overwrite)`));
    return 2;
  }
  copyFileSync(source, target);

  console.log(`${pc.green('written')}  ${target} (profile: ${PROFILE}, module: ${moduleName})`);
  console.log('');
  console.log('The file carries valid example values from the official data model.');
  console.log('Replace them with your data, then check with: dpp-lint lint ' + target);
  console.log('');
  console.log(pc.bold('Required fields:'));
  const required = loadSchema(moduleName).required ?? [];
  for (const field of required) {
    const din = lookupDin(moduleName, field);
    const parts: string[] = [];
    if (din?.preferredName) parts.push(din.preferredName);
    if (din?.dinChapter) parts.push(`DIN DKE SPEC 99100 ch. ${din.dinChapter}`);
    const suffix = parts.length > 0 ? pc.dim(`  ${parts.join(' - ')}`) : '';
    console.log(`  ${field}${suffix}`);
  }
  return 0;
}
