import { readFileSync, writeFileSync } from 'node:fs';
import pc from 'picocolors';
import { fromRoot } from '../core/paths.js';
import { readPayload, ReadError } from '../core/read.js';
import { detectModule, isModuleName, MODULES, PROFILE, type ModuleName } from '../core/schemas.js';
import { validatePayload } from '../core/validate.js';
import { toFindings, type Finding } from '../core/messages.js';
import { renderLintReport } from '../core/report.js';

export interface LintOptions {
  module?: string;
  profile: string;
  json: boolean;
  quiet: boolean;
  report?: string;
}

export interface FileResult {
  file: string;
  module: ModuleName | null;
  valid: boolean;
  errors: Finding[];
}

function version(): string {
  try {
    const pkg = JSON.parse(readFileSync(fromRoot('package.json'), 'utf8')) as {
      version?: string;
    };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function printFinding(f: Finding): void {
  const pointer = f.pointer === '' ? '/' : f.pointer;
  console.log(`  ${pc.yellow(pointer)}  ${f.message}`);
  if (f.dinChapter || f.preferredName) {
    const parts: string[] = [];
    if (f.preferredName) parts.push(f.preferredName);
    if (f.dinChapter) parts.push(`DIN DKE SPEC 99100 ch. ${f.dinChapter}`);
    console.log(pc.dim(`      ${parts.join(' - ')}`));
  }
}

/**
 * Validates payload files against the vendored battery passport schemas.
 * Returns the process exit code: 0 = all valid, 1 = findings, 2 = usage error.
 */
export async function runLint(files: string[], opts: LintOptions): Promise<number> {
  // Usage validation first: bad flags are exit code 2.
  if (opts.profile !== PROFILE) {
    console.error(
      pc.red(`dpp-lint: unknown profile "${opts.profile}". Supported profiles: ${PROFILE}`)
    );
    return 2;
  }
  let forcedModule: ModuleName | undefined;
  if (opts.module !== undefined) {
    if (!isModuleName(opts.module)) {
      console.error(
        pc.red(
          `dpp-lint: unknown module "${opts.module}". Valid modules: ${MODULES.join(', ')}`
        )
      );
      return 2;
    }
    forcedModule = opts.module;
  }
  if (files.length === 0) {
    console.error(pc.red('dpp-lint: no input files given'));
    return 2;
  }

  const human = !opts.json;
  if (human && !opts.quiet) {
    console.log(pc.bold(`dpp-lint ${version()} - by Pangea Intelligence`));
    console.log('');
  }

  const results: FileResult[] = [];
  let usageError = false;

  for (const file of files) {
    let result: FileResult;
    try {
      const { data } = readPayload(file);

      let module: ModuleName | undefined = forcedModule;
      if (!module) {
        const detection = detectModule(data);
        if (detection.kind === 'detected') {
          module = detection.module;
        } else if (detection.kind === 'ambiguous') {
          usageError = true;
          result = {
            file,
            module: null,
            valid: false,
            errors: [
              {
                pointer: '',
                keyword: 'module-detection',
                message:
                  `module auto-detection is ambiguous (candidates: ${detection.candidates.join(
                    ', '
                  )}). Re-run with --module <name>.`,
              },
            ],
          };
          results.push(result);
          reportFile(result, human);
          continue;
        } else {
          result = {
            file,
            module: null,
            valid: false,
            errors: [
              {
                pointer: '',
                keyword: 'module-detection',
                message: `cannot detect module: ${detection.reason}. Valid modules: ${MODULES.join(
                  ', '
                )} (use --module <name>).`,
              },
            ],
          };
          results.push(result);
          reportFile(result, human);
          continue;
        }
      }

      const { valid, errors } = validatePayload(module, data);
      result = {
        file,
        module,
        valid,
        errors: valid ? [] : toFindings(module, errors, data),
      };
    } catch (err) {
      const message =
        err instanceof ReadError ? err.message : `${file}: ${(err as Error).message}`;
      result = {
        file,
        module: null,
        valid: false,
        errors: [{ pointer: '', keyword: 'read', message }],
      };
    }
    results.push(result);
    reportFile(result, human);
  }

  const failed = results.filter((r) => !r.valid).length;
  const passed = results.length - failed;

  if (opts.json) {
    console.log(JSON.stringify(results, null, 2));
  } else if (!opts.quiet) {
    console.log('');
    const summary = `${results.length} file${results.length === 1 ? '' : 's'} checked, ${passed} passed, ${failed} failed`;
    console.log(failed > 0 ? pc.red(summary) : pc.green(summary));
  }

  if (opts.report) {
    writeFileSync(
      opts.report,
      renderLintReport(results, { version: version(), generatedAt: new Date().toISOString() }),
      'utf8'
    );
    if (human && !opts.quiet) console.log(pc.dim(`report written: ${opts.report}`));
  }

  if (usageError) return 2;
  return failed > 0 ? 1 : 0;
}

function reportFile(result: FileResult, human: boolean): void {
  if (!human) return;
  const moduleLabel = result.module ? ` (${result.module})` : '';
  if (result.valid) {
    console.log(`${pc.green('OK')}  ${result.file}${moduleLabel}`);
  } else {
    console.log(
      `${pc.red('FAIL')}  ${result.file}${moduleLabel} - ${result.errors.length} finding${
        result.errors.length === 1 ? '' : 's'
      }`
    );
    for (const finding of result.errors) printFinding(finding);
  }
}
