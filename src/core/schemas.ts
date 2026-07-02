import { readFileSync } from 'node:fs';
import { fromRoot } from './paths.js';
import { decodeJsonBuffer, parseJsonText } from './read.js';

/** Passport profile and data model version currently supported. */
export const PROFILE = 'battery';
export const SCHEMA_VERSION = '1.2.0';

/** The three DIN DKE SPEC 99100 / BatteryPassDataModel modules we vendor. */
export const MODULES = [
  'GeneralProductInformation',
  'MaterialComposition',
  'SupplyChainDueDiligence',
] as const;

export type ModuleName = (typeof MODULES)[number];

export function isModuleName(name: string): name is ModuleName {
  return (MODULES as readonly string[]).includes(name);
}

export interface JsonSchema {
  $schema?: string;
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
}

const schemaCache = new Map<ModuleName, JsonSchema>();

/**
 * Loads a vendored draft-04 schema. Uses the same encoding detection as
 * payload reading because two of the upstream schema files ship as UTF-16.
 */
export function loadSchema(module: ModuleName): JsonSchema {
  const cached = schemaCache.get(module);
  if (cached) return cached;
  const file = fromRoot('schemas', PROFILE, SCHEMA_VERSION, `${module}.schema.json`);
  const buf = readFileSync(file);
  const { text } = decodeJsonBuffer(buf, file);
  const schema = parseJsonText(text, file) as JsonSchema;
  schemaCache.set(module, schema);
  return schema;
}

export type DetectionResult =
  | { kind: 'detected'; module: ModuleName; score: number }
  | { kind: 'ambiguous'; candidates: ModuleName[] }
  | { kind: 'unknown'; reason: string };

/**
 * Auto-detects which module a payload belongs to. Each schema is scored by
 * the fraction of the payload's top-level keys that appear in the schema's
 * top-level "properties". The best score wins; a tie between the two best
 * scores is reported as ambiguous so the caller can ask for --module.
 */
export function detectModule(payload: unknown): DetectionResult {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return { kind: 'unknown', reason: 'payload is not a JSON object' };
  }
  const keys = Object.keys(payload as Record<string, unknown>);
  if (keys.length === 0) {
    return { kind: 'unknown', reason: 'payload has no top-level keys' };
  }

  const scored = MODULES.map((module) => {
    const props = loadSchema(module).properties ?? {};
    const hits = keys.filter((k) => Object.prototype.hasOwnProperty.call(props, k)).length;
    return { module, score: hits / keys.length };
  }).sort((a, b) => b.score - a.score);

  const [best, second] = scored;
  if (best.score === 0) {
    return {
      kind: 'unknown',
      reason: 'no top-level key matches any known module schema',
    };
  }
  if (second && second.score === best.score) {
    return {
      kind: 'ambiguous',
      candidates: scored.filter((s) => s.score === best.score).map((s) => s.module),
    };
  }
  return { kind: 'detected', module: best.module, score: best.score };
}
