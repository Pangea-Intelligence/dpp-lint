#!/usr/bin/env node
import { createRequire } from 'node:module';
import { Command } from 'commander';
import pc from 'picocolors';
import { runLint } from './commands/lint.js';
import { runRisk } from './commands/risk.js';
import { runTemplate } from './commands/template.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };

const program = new Command();

program
  .name('dpp-lint')
  .description(
    'Linter and risk screener for EU Digital Product Passports.\n' +
      'Validates battery passport payloads against DIN DKE SPEC 99100 and\n' +
      'screens raw material origins against open due-diligence risk data.'
  )
  .version(pkg.version)
  .addHelpText('after', `\n${pc.dim('by Pangea Intelligence · https://pangea-intelligence.eu')}`);

program
  .command('lint')
  .description('Validate one or more battery passport payload files')
  .argument('<files...>', 'payload files (JSON, UTF-8 or UTF-16)')
  .option('-m, --module <name>', 'force a specific module instead of auto-detection')
  .option('-p, --profile <name>', 'passport profile', 'battery')
  .option('--json', 'machine-readable JSON output', false)
  .option('--report <file>', 'additionally write a self-contained HTML report')
  .option('-q, --quiet', 'only report errors, no banner or summary', false)
  .action(async (files: string[], opts) => {
    process.exitCode = await runLint(files, opts);
  });

program
  .command('risk')
  .description('Screen raw material origins for due-diligence risk (EU 2023/1542, Art. 48-52)')
  .argument('<file>', 'battery passport payload file (JSON)')
  .option('-o, --origins <file>', 'material origins file (JSON or CSV, see docs)')
  .option('--json', 'machine-readable JSON output', false)
  .option('--report <file>', 'additionally write a self-contained HTML report')
  .option('-q, --quiet', 'only report findings, no banner or summary', false)
  .action(async (file: string, opts) => {
    process.exitCode = await runRisk(file, opts);
  });

program
  .command('template')
  .description('Write a starter payload for a module and list its required fields')
  .argument('<module>', 'aspect name, e.g. GeneralProductInformation (invalid names list all)')
  .option('-o, --output <file>', 'output file (default: <Module>.json)')
  .option('-f, --force', 'overwrite an existing output file', false)
  .action((moduleName: string, opts) => {
    process.exitCode = runTemplate(moduleName, opts);
  });

// Commander's default exit code for usage errors is 1, which collides with
// "findings" in our contract (0 = clean, 1 = findings, 2 = usage error).
// exitOverride makes commander throw instead, so we can remap: help/version
// exit 0, every usage error exits 2. Commander has already printed its own
// message at that point. exitOverride does not inherit, so subcommands need
// it too.
program.exitOverride();
for (const sub of program.commands) sub.exitOverride();

program.parseAsync(process.argv).catch((err: unknown) => {
  const commanderErr = err as { code?: string; exitCode?: number };
  if (typeof commanderErr.code === 'string' && commanderErr.code.startsWith('commander.')) {
    process.exitCode = commanderErr.exitCode === 0 ? 0 : 2;
    return;
  }
  console.error(pc.red(`dpp-lint: ${err instanceof Error ? err.message : String(err)}`));
  process.exitCode = 2;
});
