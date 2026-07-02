import AjvDraft04Module from 'ajv-draft-04';
import addFormatsModule from 'ajv-formats';
import type { ErrorObject, Options, ValidateFunction } from 'ajv';
import { loadSchema, type ModuleName } from './schemas.js';

// ajv-draft-04 and ajv-formats ship as CommonJS with an __esModule marker.
// Depending on Node version and loader (node ESM vs tsx vs vitest), the
// callable may arrive either directly or under .default, so unwrap
// defensively and type the result structurally.
interface AjvLike {
  compile(schema: object): ValidateFunction;
}
type AjvConstructor = new (opts?: Options) => AjvLike;
type AddFormatsFn = (ajv: AjvLike) => unknown;

function unwrapDefault<T>(mod: unknown): T {
  const maybe = mod as { default?: T };
  return maybe.default ?? (mod as T);
}

const Ajv = unwrapDefault<AjvConstructor>(AjvDraft04Module);
const addFormats = unwrapDefault<AddFormatsFn>(addFormatsModule);

let ajv: AjvLike | undefined;

function getAjv(): AjvLike {
  if (!ajv) {
    ajv = new Ajv({
      allErrors: true,
      // The upstream BatteryPassDataModel schemas are not strict-clean
      // (unknown keywords like x-samm-aspect-model-urn, draft-04 idioms).
      strict: false,
    });
    addFormats(ajv);
  }
  return ajv;
}

const validatorCache = new Map<ModuleName, ValidateFunction>();

/** Compiles (and caches) the validator for a module schema. */
export function getValidator(module: ModuleName): ValidateFunction {
  const cached = validatorCache.get(module);
  if (cached) return cached;
  const validator = getAjv().compile(loadSchema(module));
  validatorCache.set(module, validator);
  return validator;
}

export interface ValidationResult {
  valid: boolean;
  /** Raw ajv errors (structured); empty when valid. */
  errors: ErrorObject[];
}

/** Validates a payload against a module schema, returning structured errors. */
export function validatePayload(module: ModuleName, payload: unknown): ValidationResult {
  const validator = getValidator(module);
  const valid = validator(payload) as boolean;
  return { valid, errors: valid ? [] : (validator.errors ?? []) };
}

export type { ErrorObject };
