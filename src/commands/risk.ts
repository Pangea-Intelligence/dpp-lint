import { readFileSync } from 'node:fs';
import pc from 'picocolors';
import { fromRoot } from '../core/paths.js';
import { readPayload, ReadError } from '../core/read.js';
import { OriginsError, parseOriginsFile, type ParsedOrigins } from '../risk/origins.js';
import {
  OECD_STEPS,
  screen,
  type OecdStep,
  type RiskFinding,
  type ScreenResult,
  type Severity,
} from '../risk/screen.js';

export interface RiskOptions {
  origins?: string;
  json: boolean;
  quiet: boolean;
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

function severityTag(severity: Severity): string {
  switch (severity) {
    case 'high':
      return pc.red(pc.bold('[HIGH]  '));
    case 'medium':
      return pc.yellow('[MEDIUM]');
    case 'info':
      return pc.cyan('[INFO]  ');
  }
}

function printFinding(finding: RiskFinding): void {
  console.log(`  ${severityTag(finding.severity)} ${finding.rule}: ${finding.message}`);
  const entry = finding.evidence.entry ? ` ${JSON.stringify(finding.evidence.entry)}` : '';
  console.log(pc.dim(`           evidence: ${finding.evidence.dataset}${entry}`));
  console.log(pc.dim(`           ref: ${finding.reference}`));
}

function printHuman(
  file: string,
  opts: RiskOptions,
  origins: ParsedOrigins | undefined,
  result: ScreenResult
): void {
  if (!opts.quiet) {
    console.log(pc.bold(`dpp-lint ${version()} - by Pangea Intelligence`));
    console.log(`risk screening: ${file}`);
    console.log(
      origins
        ? `origins: ${origins.file} (${origins.entries.length} entr${
            origins.entries.length === 1 ? 'y' : 'ies'
          })`
        : pc.dim('origins: none provided')
    );
    console.log('');
  }

  for (const warning of origins?.warnings ?? []) {
    console.log(pc.yellow(`warning: ${warning}`));
  }
  if ((origins?.warnings.length ?? 0) > 0) console.log('');

  const steps: OecdStep[] = [1, 2, 3, 4, 5];
  for (const step of steps) {
    const stepFindings = result.findings.filter((finding) => finding.oecdStep === step);
    if (opts.quiet && stepFindings.length === 0) continue;
    console.log(pc.bold(`OECD step ${step} - ${OECD_STEPS[step]}`));
    if (stepFindings.length === 0) {
      console.log(pc.dim('  no findings'));
    } else {
      for (const finding of stepFindings) printFinding(finding);
    }
    console.log('');
  }

  if (!opts.quiet) {
    const { high, medium, info } = result.summary;
    const summary = `${high} high / ${medium} medium / ${info} info`;
    if (high > 0) console.log(pc.red(summary));
    else if (medium > 0) console.log(pc.yellow(summary));
    else console.log(pc.green(summary));

    if (!origins) {
      console.log('');
      console.log(
        pc.dim(
          'Origin screening (CAHRA countries, RMI smelter check) was skipped: no origins file ' +
            'given. Provide one with --origins <file> (JSON or CSV; see fixtures/origins.sample.json ' +
            'and fixtures/origins.sample.csv for the format).'
        )
      );
    }
  }
}

/**
 * Screens declared raw material origins against bundled open risk data
 * (EU CAHRA list, RMI public facility lists) and reports due-diligence gaps
 * along the OECD five-step framework.
 * Returns the process exit code: 0 = no findings, 1 = findings, 2 = usage error.
 */
export async function runRisk(file: string, opts: RiskOptions): Promise<number> {
  let payload: unknown;
  try {
    payload = readPayload(file).data;
  } catch (err) {
    const message = err instanceof ReadError ? err.message : `${file}: ${(err as Error).message}`;
    console.error(pc.red(`dpp-lint: ${message}`));
    return 2;
  }

  let origins: ParsedOrigins | undefined;
  if (opts.origins !== undefined) {
    try {
      origins = parseOriginsFile(opts.origins);
    } catch (err) {
      const message =
        err instanceof OriginsError || err instanceof ReadError
          ? err.message
          : `${opts.origins}: ${(err as Error).message}`;
      console.error(pc.red(`dpp-lint: ${message}`));
      return 2;
    }
  }

  const result = screen(payload, origins);

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          file,
          originsFile: opts.origins ?? null,
          originScreening: origins ? 'performed' : 'skipped',
          warnings: origins?.warnings ?? [],
          findings: result.findings,
          summary: result.summary,
        },
        null,
        2
      )
    );
  } else {
    printHuman(file, opts, origins, result);
  }

  return result.summary.high + result.summary.medium > 0 ? 1 : 0;
}
