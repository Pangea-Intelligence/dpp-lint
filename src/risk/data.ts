import { readFileSync } from 'node:fs';
import { fromRoot } from '../core/paths.js';

/** A subnational region entry on the CAHRA list (ISO 3166-2 scoped). */
export interface CahraRegion {
  name: string;
  code: string;
  conflictAffected: boolean;
  highRisk: boolean;
}

/** One country entry from data/cahra.json. */
export interface CahraEntry {
  countryName: string;
  iso2: string;
  iso3: string;
  /** null when the designation is country-level (wholeCountry === true). */
  regions: CahraRegion[] | null;
  wholeCountry: boolean;
}

export interface CahraData {
  meta: { version?: string; retrieved?: string; [key: string]: unknown };
  entries: CahraEntry[];
}

/** One facility record from data/rmi-facilities.json (shape produced by scripts/fetch-rmi.mjs). */
export interface RmiFacility {
  name: string | null;
  rmiId: string | null;
  metal: string;
  country: string | null;
  status: string | null;
  source: string;
}

export interface RmiData {
  meta: { retrieved?: string | null; termsNote?: string; [key: string]: unknown };
  facilities: RmiFacility[];
}

/** One regulated raw material from data/materials.json (EU 2023/1542 Annex X point 1). */
export interface MaterialEntry {
  id: string;
  name: string;
  annexXPoint: string;
  symbol: string;
  cas: string;
  synonyms: string[];
  coversCompounds: boolean;
  regulationRef: string;
}

export interface MaterialsData {
  meta: { [key: string]: unknown };
  materials: MaterialEntry[];
}

function loadJson<T>(relative: string): T {
  const filePath = fromRoot('data', relative);
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as T;
  } catch (err) {
    throw new Error(
      `dpp-lint internal error: cannot load bundled dataset ${filePath}: ${
        err instanceof Error ? err.message : String(err)
      }`,
      { cause: err }
    );
  }
}

let cahraCache: CahraData | undefined;
let rmiCache: RmiData | undefined;
let materialsCache: MaterialsData | undefined;

/** Loads and caches the EU CAHRA snapshot. */
export function loadCahra(): CahraData {
  return (cahraCache ??= loadJson<CahraData>('cahra.json'));
}

/** Loads and caches the RMI facility snapshot (ships empty for licensing reasons). */
export function loadRmi(): RmiData {
  return (rmiCache ??= loadJson<RmiData>('rmi-facilities.json'));
}

/** Loads and caches the regulated raw materials list (Annex X point 1). */
export function loadMaterials(): MaterialsData {
  return (materialsCache ??= loadJson<MaterialsData>('materials.json'));
}

/** Finds a CAHRA entry by ISO 3166-1 alpha-2 code (case-insensitive). */
export function findCahraEntry(iso2: string): CahraEntry | undefined {
  const code = iso2.trim().toUpperCase();
  return loadCahra().entries.find((entry) => entry.iso2 === code);
}

/** Lowercases and collapses separators so "Natural_Graphite" matches "natural graphite". */
function canonicalToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ');
}

/**
 * Matches a free-form material designation (name, id, symbol, synonym, or
 * CAS registry number) against the four regulated battery raw materials.
 * Returns undefined for anything outside Annex X point 1 (a)-(d).
 */
export function matchMaterial(input: string): MaterialEntry | undefined {
  const raw = input.trim();
  if (raw === '') return undefined;
  const token = canonicalToken(raw);
  for (const material of loadMaterials().materials) {
    if (material.cas === raw) return material;
    if (canonicalToken(material.id) === token) return material;
    if (canonicalToken(material.name) === token) return material;
    if (material.synonyms.some((synonym) => canonicalToken(synonym) === token)) return material;
  }
  return undefined;
}

/** Human-readable list of accepted material names, for error messages. */
export function regulatedMaterialNames(): string[] {
  return loadMaterials().materials.map((material) => material.name);
}
