/**
 * Public programmatic API of dpp-lint.
 *
 * package.json "main" and "exports" point at the compiled dist/index.js of
 * this file, so `import { ... } from 'dpp-lint'` works for library consumers
 * in addition to the CLI bin (dist/cli.js).
 */

// Commands (same entry points the CLI uses; they return the process exit code).
export { runLint, type LintOptions, type FileResult } from './commands/lint.js';
export { runRisk, type RiskOptions } from './commands/risk.js';
export { runTemplate, type TemplateOptions } from './commands/template.js';

// Payload reading and encoding detection.
export {
  MAX_FILE_SIZE,
  ReadError,
  decodeJsonBuffer,
  parseJsonText,
  readPayload,
  type DetectedEncoding,
  type PayloadFile,
} from './core/read.js';

// Schema access, module detection and validation.
export {
  MODULES,
  PROFILE,
  SCHEMA_VERSION,
  detectModule,
  isModuleName,
  loadSchema,
  type DetectionResult,
  type JsonSchema,
  type ModuleName,
} from './core/schemas.js';
export {
  getValidator,
  validatePayload,
  type ErrorObject,
  type ValidationResult,
} from './core/validate.js';
export { toFindings, type Finding } from './core/messages.js';

// Origins file parsing.
export {
  OriginsError,
  parseOriginsFile,
  type OriginEntry,
  type OriginSmelter,
  type ParsedOrigins,
} from './risk/origins.js';

// Due-diligence risk screening.
export {
  OECD_STEPS,
  normalizeFacilityName,
  screen,
  type Evidence,
  type OecdStep,
  type RiskFinding,
  type RuleId,
  type ScreenResult,
  type ScreenSummary,
  type Severity,
} from './risk/screen.js';

// Bundled dataset access.
export {
  findCahraEntry,
  loadCahra,
  loadMaterials,
  loadRmi,
  matchMaterial,
  regulatedMaterialNames,
  type CahraData,
  type CahraEntry,
  type CahraRegion,
  type MaterialEntry,
  type MaterialsData,
  type RmiData,
  type RmiFacility,
} from './risk/data.js';

// Package root resolution (useful for locating bundled schemas/data).
export { fromRoot, packageRoot } from './core/paths.js';
