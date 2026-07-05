import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { decodeJsonBuffer, MAX_FILE_SIZE, parseJsonText } from '../core/read.js';
import { matchMaterial, regulatedMaterialNames } from './data.js';

/** Declared smelter or refiner for one origin entry. */
export interface OriginSmelter {
  name?: string;
  id?: string;
  country?: string;
}

/** One declared material origin, normalized from JSON or CSV input. */
export interface OriginEntry {
  /** Material designation exactly as given in the input file. */
  material: string;
  /** Canonical id from data/materials.json, or null when not a regulated material. */
  materialId: string | null;
  /** ISO 3166-1 alpha-2 code, uppercased (may be unknown, see warnings). */
  originCountry: string;
  /** Mass share of this origin, 0..1. */
  share?: number;
  smelter?: OriginSmelter;
}

export interface ParsedOrigins {
  file: string;
  entries: OriginEntry[];
  /** Non-fatal input problems (unknown materials, unknown country codes, odd shares). */
  warnings: string[];
}

/** Structural problem in an origins file. Treated as a usage error (exit code 2). */
export class OriginsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OriginsError';
  }
}

// Private-use ISO 3166-1 alpha-2 ranges (AA, QM-QZ, XA-XZ, ZZ) are never real countries.
const PRIVATE_USE_ISO2 = /^(AA|Q[M-Z]|X[A-Z]|ZZ)$/;

let regionNames: Intl.DisplayNames | undefined;

function isKnownCountryCode(code: string): boolean {
  if (PRIVATE_USE_ISO2.test(code)) return false;
  try {
    regionNames ??= new Intl.DisplayNames(['en'], { type: 'region' });
    const label = regionNames.of(code);
    // Unknown but well-formed codes fall back to the code itself.
    return label !== undefined && label !== code;
  } catch {
    // Small-ICU Node builds: skip the lookup rather than reporting false positives.
    return true;
  }
}

interface RawEntry {
  material: string;
  originCountry: string;
  share?: number;
  smelterName?: string;
  smelterId?: string;
  smelterCountry?: string;
}

function validateCountry(code: string, field: string, context: string, warnings: string[]): string {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) {
    warnings.push(`${context}: ${field} "${code}" is not a two-letter ISO 3166-1 alpha-2 code`);
    return normalized;
  }
  if (!isKnownCountryCode(normalized)) {
    warnings.push(`${context}: unknown country code "${normalized}" in ${field}`);
  }
  return normalized;
}

function buildEntry(raw: RawEntry, context: string, warnings: string[]): OriginEntry {
  const material = raw.material.trim();
  if (material === '') {
    throw new OriginsError(`${context}: "material" must be a non-empty string`);
  }
  const matched = matchMaterial(material);
  if (!matched) {
    warnings.push(
      `${context}: unknown material "${material}" (expected one of: ${regulatedMaterialNames().join(
        ', '
      )}, a synonym, or a CAS number); entry kept for country screening only`
    );
  }

  if (raw.originCountry.trim() === '') {
    throw new OriginsError(`${context}: "originCountry" must be a non-empty string`);
  }
  const originCountry = validateCountry(raw.originCountry, 'originCountry', context, warnings);

  const entry: OriginEntry = {
    material,
    materialId: matched ? matched.id : null,
    originCountry,
  };

  if (raw.share !== undefined) {
    if (!Number.isFinite(raw.share)) {
      throw new OriginsError(`${context}: "share" must be a number between 0 and 1`);
    }
    if (raw.share < 0 || raw.share > 1) {
      warnings.push(
        `${context}: share ${raw.share} is outside 0..1 (shares are fractions, not percentages)`
      );
    }
    entry.share = raw.share;
  }

  const smelterName = raw.smelterName?.trim() ?? '';
  const smelterId = raw.smelterId?.trim() ?? '';
  const smelterCountry = raw.smelterCountry?.trim() ?? '';
  if (smelterName !== '' || smelterId !== '') {
    const smelter: OriginSmelter = {};
    if (smelterName !== '') smelter.name = smelterName;
    if (smelterId !== '') smelter.id = smelterId;
    if (smelterCountry !== '') {
      smelter.country = validateCountry(smelterCountry, 'smelter.country', context, warnings);
    }
    entry.smelter = smelter;
  } else if (smelterCountry !== '') {
    warnings.push(`${context}: smelter country given without a smelter name or id, ignored`);
  }

  return entry;
}

// ---- JSON input ----

function parseOriginsJson(value: unknown, file: string): ParsedOrigins {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new OriginsError(`${file}: expected a JSON object with a "materials" array`);
  }
  const materials = (value as Record<string, unknown>).materials;
  if (!Array.isArray(materials)) {
    throw new OriginsError(`${file}: missing "materials" array`);
  }

  const warnings: string[] = [];
  const entries: OriginEntry[] = [];

  materials.forEach((item, index) => {
    const context = `${file}: materials[${index}]`;
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new OriginsError(`${context}: expected an object`);
    }
    const record = item as Record<string, unknown>;

    if (typeof record.material !== 'string') {
      throw new OriginsError(`${context}: "material" must be a string`);
    }
    if (typeof record.originCountry !== 'string') {
      throw new OriginsError(`${context}: "originCountry" must be a string`);
    }
    if (record.share !== undefined && typeof record.share !== 'number') {
      throw new OriginsError(`${context}: "share" must be a number between 0 and 1`);
    }

    let smelterName: string | undefined;
    let smelterId: string | undefined;
    let smelterCountry: string | undefined;
    if (record.smelter !== undefined) {
      if (
        typeof record.smelter !== 'object' ||
        record.smelter === null ||
        Array.isArray(record.smelter)
      ) {
        throw new OriginsError(`${context}: "smelter" must be an object with a "name"`);
      }
      const smelter = record.smelter as Record<string, unknown>;
      for (const key of ['name', 'id', 'country'] as const) {
        if (smelter[key] !== undefined && typeof smelter[key] !== 'string') {
          throw new OriginsError(`${context}: "smelter.${key}" must be a string`);
        }
      }
      smelterName = smelter.name as string | undefined;
      smelterId = smelter.id as string | undefined;
      smelterCountry = smelter.country as string | undefined;
      if ((smelterName?.trim() ?? '') === '' && (smelterId?.trim() ?? '') === '') {
        throw new OriginsError(`${context}: "smelter" needs at least a "name" or an "id"`);
      }
    }

    entries.push(
      buildEntry(
        {
          material: record.material,
          originCountry: record.originCountry,
          share: record.share as number | undefined,
          smelterName,
          smelterId,
          smelterCountry,
        },
        context,
        warnings
      )
    );
  });

  return { file, entries, warnings };
}

// ---- CSV input ----

/** Splits one CSV line, honoring double-quoted fields with embedded commas and "" escapes. */
function splitCsvLine(line: string, context: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"' && current.trim() === '') {
      inQuotes = true;
      current = '';
    } else if (ch === ',') {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (inQuotes) {
    throw new OriginsError(`${context}: unterminated quoted field`);
  }
  fields.push(current.trim());
  return fields;
}

const CSV_COLUMNS = [
  'material',
  'origin_country',
  'share',
  'smelter_name',
  'smelter_id',
  'smelter_country',
] as const;

function parseOriginsCsv(text: string, file: string): ParsedOrigins {
  const lines = text.split(/\r?\n/);
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() !== '') {
      headerIndex = i;
      break;
    }
  }
  if (headerIndex === -1) {
    throw new OriginsError(`${file}: file is empty`);
  }

  const header = splitCsvLine(lines[headerIndex], `${file}: line ${headerIndex + 1}`).map((h) =>
    h.toLowerCase()
  );
  const column: Partial<Record<(typeof CSV_COLUMNS)[number], number>> = {};
  for (const name of CSV_COLUMNS) {
    const idx = header.indexOf(name);
    if (idx !== -1) column[name] = idx;
  }
  if (column.material === undefined || column.origin_country === undefined) {
    throw new OriginsError(
      `${file}: CSV header must contain "material" and "origin_country" columns ` +
        `(expected header: ${CSV_COLUMNS.join(',')}; got: ${header.join(',')})`
    );
  }

  const warnings: string[] = [];
  const entries: OriginEntry[] = [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue;
    const context = `${file}: line ${i + 1}`;
    const fields = splitCsvLine(lines[i], context);
    const get = (name: (typeof CSV_COLUMNS)[number]): string => {
      const idx = column[name];
      return idx === undefined || idx >= fields.length ? '' : fields[idx];
    };

    const shareText = get('share');
    let share: number | undefined;
    if (shareText !== '') {
      share = Number(shareText);
      if (!Number.isFinite(share)) {
        throw new OriginsError(
          `${context}: "share" must be a number between 0 and 1, got "${shareText}"`
        );
      }
    }

    entries.push(
      buildEntry(
        {
          material: get('material'),
          originCountry: get('origin_country'),
          share,
          smelterName: get('smelter_name'),
          smelterId: get('smelter_id'),
          smelterCountry: get('smelter_country'),
        },
        context,
        warnings
      )
    );
  }

  return { file, entries, warnings };
}

/**
 * Parses a material origins file. The format is detected by extension:
 * .json or .csv. Throws OriginsError on structural problems; value-level
 * oddities (unknown materials, unknown country codes) become warnings.
 */
export function parseOriginsFile(filePath: string): ParsedOrigins {
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.json' && ext !== '.csv') {
    throw new OriginsError(
      `${filePath}: unsupported origins file extension "${ext || '(none)'}", expected .json or .csv`
    );
  }

  let buf: Buffer;
  try {
    const stat = statSync(filePath);
    if (!stat.isFile()) {
      throw new OriginsError(`${filePath}: not a regular file`);
    }
    if (stat.size > MAX_FILE_SIZE) {
      throw new OriginsError(
        `${filePath}: file is ${stat.size} bytes, larger than the ${MAX_FILE_SIZE} byte limit`
      );
    }
    buf = readFileSync(filePath);
  } catch (err) {
    if (err instanceof OriginsError) throw err;
    const e = err as NodeJS.ErrnoException;
    throw new OriginsError(
      e.code === 'ENOENT'
        ? `${filePath}: file not found`
        : `${filePath}: cannot read file (${e.message})`
    );
  }

  // decodeJsonBuffer's BOM / zero-byte detection works for CSV too, because a
  // CSV origins file also starts with an ASCII character ("material,...").
  const { text } = decodeJsonBuffer(buf, filePath);

  if (ext === '.csv') {
    return parseOriginsCsv(text, filePath);
  }
  let value: unknown;
  try {
    value = parseJsonText(text, filePath);
  } catch (err) {
    throw new OriginsError(err instanceof Error ? err.message : String(err));
  }
  return parseOriginsJson(value, filePath);
}
