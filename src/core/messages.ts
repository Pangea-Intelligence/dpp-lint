import { readFileSync } from 'node:fs';
import type { ErrorObject } from 'ajv';
import { fromRoot } from './paths.js';
import { PROFILE, SCHEMA_VERSION, type ModuleName } from './schemas.js';

export interface Finding {
  /** JSON pointer to the offending location in the payload. */
  pointer: string;
  /** ajv keyword that failed (required, type, enum, pattern, ...). */
  keyword: string;
  /** Plain-English message. */
  message: string;
  /** Payload attribute the finding refers to, when derivable. */
  attribute?: string;
  /** DIN DKE SPEC 99100 enrichment from the SAMM model, when available. */
  preferredName?: string;
  description?: string;
  dinChapter?: string;
  see?: string[];
}

interface DinMapEntry {
  preferredName?: string;
  description?: string;
  dinChapter?: string;
  see?: string[];
  kind: 'property' | 'other';
}

interface DinMap {
  modules: Record<string, Record<string, DinMapEntry>>;
}

let dinMap: DinMap | undefined;

function loadDinMap(): DinMap {
  if (!dinMap) {
    try {
      const file = fromRoot('schemas', PROFILE, SCHEMA_VERSION, 'din-map.json');
      dinMap = JSON.parse(readFileSync(file, 'utf8')) as DinMap;
    } catch {
      // Enrichment is best-effort; findings still work without the map.
      dinMap = { modules: {} };
    }
  }
  return dinMap;
}

export function lookupDin(
  module: ModuleName,
  attribute: string | undefined
): DinMapEntry | undefined {
  if (!attribute) return undefined;
  const modules = loadDinMap().modules;
  // Prefer the entry from the module being validated, fall back to any
  // module (nested entity properties are shared across models).
  const own = modules[module]?.[attribute];
  if (own) return own;
  for (const entries of Object.values(modules)) {
    if (entries[attribute]) return entries[attribute];
  }
  return undefined;
}

function jsonTypeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/** Resolves a JSON pointer against a payload (best effort). */
function getByPointer(data: unknown, pointer: string): unknown {
  if (pointer === '') return data;
  let node: unknown = data;
  for (const raw of pointer.split('/').slice(1)) {
    const key = raw.replace(/~1/g, '/').replace(/~0/g, '~');
    if (node !== null && typeof node === 'object') {
      node = (node as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return node;
}

/** Last pointer segment that is not an array index, e.g. the attribute name. */
function attributeFromPointer(pointer: string): string | undefined {
  const segments = pointer.split('/').slice(1);
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const seg = segments[i].replace(/~1/g, '/').replace(/~0/g, '~');
    if (!/^\d+$/.test(seg)) return seg;
  }
  return undefined;
}

function describeError(
  err: ErrorObject,
  payload: unknown
): { pointer: string; message: string; attribute?: string } {
  const basePointer = err.instancePath ?? '';
  switch (err.keyword) {
    case 'required': {
      const missing = (err.params as { missingProperty: string }).missingProperty;
      return {
        pointer: `${basePointer}/${missing}`,
        message: `required attribute "${missing}" is missing`,
        attribute: missing,
      };
    }
    case 'type': {
      const expected = (err.params as { type: string | string[] }).type;
      const expectedText = Array.isArray(expected) ? expected.join(' or ') : expected;
      const actual = jsonTypeOf(getByPointer(payload, basePointer));
      return {
        pointer: basePointer,
        message: `expected type ${expectedText}, got ${actual}`,
        attribute: attributeFromPointer(basePointer),
      };
    }
    case 'enum': {
      const allowed = (err.params as { allowedValues?: unknown[] }).allowedValues ?? [];
      const actual = getByPointer(payload, basePointer);
      const actualText = typeof actual === 'string' ? `"${actual}"` : JSON.stringify(actual);
      return {
        pointer: basePointer,
        message: `value ${actualText} is not allowed, expected one of: ${allowed
          .map((v) => JSON.stringify(v))
          .join(', ')}`,
        attribute: attributeFromPointer(basePointer),
      };
    }
    case 'pattern': {
      const pattern = (err.params as { pattern?: string }).pattern;
      return {
        pointer: basePointer,
        message: `value does not match the required pattern ${pattern}`,
        attribute: attributeFromPointer(basePointer),
      };
    }
    case 'additionalProperties': {
      const extra = (err.params as { additionalProperty?: string }).additionalProperty;
      return {
        pointer: extra ? `${basePointer}/${extra}` : basePointer,
        message: `unexpected attribute "${extra}" is not defined in the schema`,
        attribute: extra,
      };
    }
    case 'format': {
      const format = (err.params as { format?: string }).format;
      return {
        pointer: basePointer,
        message: `value is not a valid ${format}`,
        attribute: attributeFromPointer(basePointer),
      };
    }
    default:
      return {
        pointer: basePointer,
        message: err.message ?? `failed constraint "${err.keyword}"`,
        attribute: attributeFromPointer(basePointer),
      };
  }
}

/**
 * Converts raw ajv errors into human-readable findings, enriched with
 * preferredName / description / DIN DKE SPEC 99100 chapter references
 * from the generated din-map.json where available.
 */
export function toFindings(module: ModuleName, errors: ErrorObject[], payload: unknown): Finding[] {
  const findings: Finding[] = [];
  const seen = new Set<string>();
  for (const err of errors) {
    const { pointer, message, attribute } = describeError(err, payload);
    const key = `${pointer}|${err.keyword}|${message}`;
    if (seen.has(key)) continue; // allErrors + $refs can duplicate findings
    seen.add(key);
    const finding: Finding = { pointer, keyword: err.keyword, message };
    if (attribute) finding.attribute = attribute;
    const din = lookupDin(module, attribute);
    if (din) {
      if (din.preferredName) finding.preferredName = din.preferredName;
      if (din.description) finding.description = din.description;
      if (din.dinChapter) finding.dinChapter = din.dinChapter;
      if (din.see) finding.see = din.see;
    }
    findings.push(finding);
  }
  return findings;
}
