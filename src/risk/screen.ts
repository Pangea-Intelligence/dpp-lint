import {
  findCahraEntry,
  loadCahra,
  loadMaterials,
  loadRmi,
  matchMaterial,
  type MaterialEntry,
  type RmiFacility,
} from './data.js';
import { detectModule } from '../core/schemas.js';
import type { OriginEntry, ParsedOrigins } from './origins.js';

export type Severity = 'high' | 'medium' | 'info';
export type RuleId = 'R1' | 'R2' | 'R3' | 'R4' | 'R5';
export type OecdStep = 1 | 2 | 3 | 4 | 5;

/** Titles of the OECD Due Diligence Guidance five-step framework. */
export const OECD_STEPS: Record<OecdStep, string> = {
  1: 'Establish strong company management systems',
  2: 'Identify and assess risks in the supply chain',
  3: 'Design and implement a strategy to respond to identified risks',
  4: 'Carry out independent third-party audits of supply chain due diligence',
  5: 'Report annually on supply chain due diligence',
};

export interface Evidence {
  /** Source dataset the finding is based on. */
  dataset: string;
  /** Matched entry (or what was searched), kept compact for output. */
  entry?: Record<string, unknown>;
}

export interface RiskFinding {
  rule: RuleId;
  severity: Severity;
  oecdStep: OecdStep;
  message: string;
  evidence: Evidence;
  /** Regulation article this finding relates to. */
  reference: string;
}

export interface ScreenSummary {
  high: number;
  medium: number;
  info: number;
}

export interface ScreenResult {
  findings: RiskFinding[];
  summary: ScreenSummary;
}

function materialLabel(entry: OriginEntry): string {
  return entry.materialId ?? entry.material;
}

// ---- R1: origin country on the EU CAHRA list ----

function cahraDatasetLabel(): string {
  const meta = loadCahra().meta;
  const parts = ['data/cahra.json'];
  const detail: string[] = [];
  if (meta.version) detail.push(String(meta.version));
  if (meta.retrieved) detail.push(`retrieved ${meta.retrieved}`);
  if (detail.length > 0) parts.push(`(${detail.join(', ')})`);
  return parts.join(' ');
}

function screenR1(entries: OriginEntry[]): RiskFinding[] {
  const findings: RiskFinding[] = [];
  for (const entry of entries) {
    const hit = findCahraEntry(entry.originCountry);
    if (!hit) continue;
    const scope = hit.wholeCountry
      ? 'whole-country designation'
      : `region-scoped designation (${hit.regions?.length ?? 0} regions listed); ` +
        'verify whether the extraction site falls within a listed region, but treat the ' +
        'origin as flagged until shown otherwise';
    findings.push({
      rule: 'R1',
      severity: 'high',
      oecdStep: 2,
      message:
        `${materialLabel(entry)} origin ${entry.originCountry} (${hit.countryName}) is on the ` +
        `EU indicative list of conflict-affected and high-risk areas (CAHRA): ${scope}`,
      evidence: {
        dataset: cahraDatasetLabel(),
        entry: {
          countryName: hit.countryName,
          iso2: hit.iso2,
          wholeCountry: hit.wholeCountry,
          regionsListed: hit.regions?.length ?? 0,
        },
      },
      reference: 'EU 2023/1542 Art. 49; OECD Due Diligence Guidance Annex II',
    });
  }
  return findings;
}

// ---- R2: declared smelter not on the public RMI facility list ----

// Common corporate suffixes, removed before name comparison.
const LEGAL_SUFFIXES = new Set([
  'ltd', 'limited', 'llc', 'inc', 'incorporated', 'corp', 'corporation', 'co',
  'company', 'gmbh', 'ag', 'sa', 'sarl', 'plc', 'pte', 'pty', 'bv', 'nv', 'kk',
  'srl', 'sdn', 'bhd', 'spa', 'sas', 'oy', 'ab', 'as', 'kft', 'ooo', 'pjsc', 'jsc',
]);

/** Lowercase, strip diacritics and punctuation, drop legal suffixes. */
export function normalizeFacilityName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((word) => word !== '' && !LEGAL_SUFFIXES.has(word))
    .join(' ');
}

function facilityMatchesMetal(facility: RmiFacility, materialName: string | null): boolean {
  if (materialName === null) return true; // unknown material: search all metals
  const facilityMetal = (facility.metal ?? '').toLowerCase();
  if (facilityMetal === 'multiple') return true;
  const wanted = materialName.toLowerCase();
  return facilityMetal === wanted || (wanted === 'natural graphite' && facilityMetal === 'graphite');
}

function screenR2(entries: OriginEntry[]): RiskFinding[] {
  const rmi = loadRmi();
  // The repository ships the RMI snapshot empty for licensing reasons. With an
  // empty snapshot every declared smelter would be "unlisted", which as a
  // medium finding would force exit code 1 for every CI user out of the box.
  // Downgrade to info in that case; a genuine miss against a populated
  // snapshot stays medium.
  const snapshotEmpty = rmi.facilities.length === 0;
  const findings: RiskFinding[] = [];

  for (const entry of entries) {
    const smelter = entry.smelter;
    if (!smelter) continue;

    const materialName = entry.materialId
      ? loadMaterials().materials.find((m) => m.id === entry.materialId)?.name ?? null
      : null;
    const candidates = rmi.facilities.filter((f) => facilityMatchesMetal(f, materialName));

    let matched: RmiFacility | undefined;
    if (smelter.id) {
      const wantedId = smelter.id.trim().toUpperCase();
      matched = candidates.find(
        (f) => f.rmiId !== null && f.rmiId.trim().toUpperCase() === wantedId
      );
    } else if (smelter.name) {
      const wanted = normalizeFacilityName(smelter.name);
      matched = candidates.find(
        (f) => f.name !== null && wanted !== '' && normalizeFacilityName(f.name) === wanted
      );
    }
    if (matched) continue;

    const label = smelter.name ?? smelter.id ?? 'unnamed';
    const message = snapshotEmpty
      ? `declared ${materialLabel(entry)} smelter/refiner "${label}" could not be checked ` +
        `against the public RMI facility list: the bundled RMI snapshot is empty for licensing ` +
        `reasons. Populate it locally with "node scripts/fetch-rmi.mjs --accept-rmi-terms" for ` +
        `a meaningful check, or verify the facility's assessment status directly with RMI or ` +
        `the supplier.`
      : `declared ${materialLabel(entry)} smelter/refiner "${label}" is not on the public RMI ` +
        `facility list as of the snapshot date; verify its assessment status directly with RMI ` +
        `or the supplier.`;
    findings.push({
      rule: 'R2',
      severity: snapshotEmpty ? 'info' : 'medium',
      oecdStep: 2,
      message,
      evidence: {
        dataset: `data/rmi-facilities.json (${rmi.facilities.length} facilities in local snapshot)`,
        entry: {
          searchedName: smelter.name ?? null,
          searchedId: smelter.id ?? null,
          metal: materialName ?? 'any',
        },
      },
      reference: 'EU 2023/1542 Art. 49-50; OECD Due Diligence Guidance step 2',
    });
  }
  return findings;
}

// ---- R3 / R5: regulated materials declared in the payload ----

interface PayloadMaterial {
  name: string | null;
  cas: string | null;
  isCriticalRawMaterial: boolean;
  matched: MaterialEntry | undefined;
}

function payloadMaterials(payload: unknown): PayloadMaterial[] {
  if (typeof payload !== 'object' || payload === null) return [];
  const list = (payload as Record<string, unknown>).batteryMaterials;
  if (!Array.isArray(list)) return [];
  const out: PayloadMaterial[] = [];
  for (const item of list) {
    if (typeof item !== 'object' || item === null) continue;
    const record = item as Record<string, unknown>;
    const name = typeof record.batteryMaterialName === 'string' ? record.batteryMaterialName : null;
    const cas =
      typeof record.batteryMaterialIdentifier === 'string' ? record.batteryMaterialIdentifier : null;
    const matched =
      (name ? matchMaterial(name) : undefined) ?? (cas ? matchMaterial(cas) : undefined);
    out.push({
      name,
      cas,
      isCriticalRawMaterial: record.isCriticalRawMaterial === true,
      matched,
    });
  }
  return out;
}

function screenR3(payload: unknown, origins: ParsedOrigins | undefined): RiskFinding[] {
  const declared = new Map<string, PayloadMaterial>();
  for (const pm of payloadMaterials(payload)) {
    if (pm.matched && !declared.has(pm.matched.id)) declared.set(pm.matched.id, pm);
  }

  const covered = new Set(
    (origins?.entries ?? [])
      .map((entry) => entry.materialId)
      .filter((id): id is string => id !== null)
  );

  const findings: RiskFinding[] = [];
  for (const [id, pm] of declared) {
    const material = pm.matched as MaterialEntry;
    if (origins && covered.has(id)) continue;
    const evidence: Evidence = {
      dataset: 'data/materials.json (EU 2023/1542 Annex X point 1)',
      entry: {
        id: material.id,
        name: material.name,
        cas: material.cas,
        annexXPoint: material.annexXPoint,
        declaredAs: pm.name ?? pm.cas,
      },
    };
    if (origins) {
      findings.push({
        rule: 'R3',
        severity: 'high',
        oecdStep: 1,
        message:
          `payload declares regulated raw material "${material.name}" (Annex X ${material.annexXPoint}) ` +
          `but the origins file has no entry for it; its origin must be identified and screened`,
        evidence,
        reference: 'EU 2023/1542 Art. 48',
      });
    } else {
      findings.push({
        rule: 'R3',
        severity: 'info',
        oecdStep: 1,
        message:
          `payload declares regulated raw material "${material.name}" (Annex X ${material.annexXPoint}); ` +
          `no origins file was provided, so its origin could not be screened`,
        evidence,
        reference: 'EU 2023/1542 Art. 48',
      });
    }
  }
  return findings;
}

function screenR5(payload: unknown): RiskFinding[] {
  const findings: RiskFinding[] = [];
  for (const pm of payloadMaterials(payload)) {
    if (!pm.isCriticalRawMaterial || pm.matched) continue;
    const label = pm.name ?? pm.cas ?? 'unknown material';
    findings.push({
      rule: 'R5',
      severity: 'info',
      oecdStep: 1,
      message:
        `"${label}" is flagged isCriticalRawMaterial but is not one of the four regulated battery ` +
        `raw materials (cobalt, natural graphite, lithium, nickel); relevant under the EU Critical ` +
        `Raw Materials Act, but no due diligence duty under the battery regulation`,
      evidence: {
        dataset: 'data/materials.json (EU 2023/1542 Annex X point 1)',
        entry: { batteryMaterialName: pm.name, batteryMaterialIdentifier: pm.cas },
      },
      reference: 'EU 2024/1252 (CRM Act); outside EU 2023/1542 Art. 48-52 scope',
    });
  }
  return findings;
}

// ---- R4: public due diligence report link ----

function screenR4(payload: unknown): RiskFinding[] {
  const value =
    typeof payload === 'object' && payload !== null
      ? (payload as Record<string, unknown>).supplyChainDueDiligenceReport
      : undefined;

  let problem: string | null;
  if (value === undefined || value === null || value === '') {
    problem = 'is missing from the payload';
  } else if (typeof value !== 'string') {
    problem = `is not a string (got ${typeof value})`;
  } else {
    try {
      const url = new URL(value);
      problem =
        url.protocol === 'http:' || url.protocol === 'https:'
          ? null
          : `uses scheme "${url.protocol.replace(/:$/, '')}", expected http or https`;
    } catch {
      problem = `is not a valid URL ("${value}")`;
    }
  }
  if (problem === null) return [];

  // A module-scoped payload (e.g. MaterialComposition) can never contain the
  // report link by schema; flagging it medium would make `risk` unresolvable
  // for two of the three official module fixtures. Only the module that owns
  // the field keeps the medium severity; other detected modules get an info
  // reminder instead. Undetectable payloads (combined passports, unknown
  // shapes) keep medium to stay on the safe side.
  const detection = detectModule(payload);
  const foreignModule =
    detection.kind === 'detected' && detection.module !== 'SupplyChainDueDiligence';

  return [
    {
      rule: 'R4',
      severity: foreignModule ? 'info' : 'medium',
      oecdStep: 5,
      message: foreignModule
        ? `supplyChainDueDiligenceReport ${problem}, but this looks like a ` +
          `${detection.kind === 'detected' ? detection.module : ''} module payload which cannot ` +
          `contain it by schema; make sure the SupplyChainDueDiligence part of your passport ` +
          `links the publicly available due diligence report via a valid http(s) URL`
        : `supplyChainDueDiligenceReport ${problem}; the battery passport must link the publicly ` +
          `available supply chain due diligence report via a valid http(s) URL`,
      evidence: {
        dataset: 'payload',
        entry: { supplyChainDueDiligenceReport: value === undefined ? null : value },
      },
      reference: 'EU 2023/1542 Art. 52',
    },
  ];
}

/**
 * Runs the due-diligence screening rules. R3, R4 and R5 always run against
 * the payload; R1 and R2 run only when an origins file was provided.
 */
export function screen(payload: unknown, origins: ParsedOrigins | undefined): ScreenResult {
  const findings: RiskFinding[] = [];
  if (origins) {
    findings.push(...screenR1(origins.entries));
    findings.push(...screenR2(origins.entries));
  }
  findings.push(...screenR3(payload, origins));
  findings.push(...screenR4(payload));
  findings.push(...screenR5(payload));

  const summary: ScreenSummary = { high: 0, medium: 0, info: 0 };
  for (const finding of findings) summary[finding.severity]++;

  return { findings, summary };
}
