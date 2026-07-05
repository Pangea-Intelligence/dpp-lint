# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-07-05

### Added

- `runTemplate` and `TemplateOptions` are exported from the programmatic API, alongside `runLint` and `runRisk`.
- `SECURITY.md` with the vulnerability reporting process.
- ESLint and Prettier (`npm run lint`, `npm run format`, `npm run format:check`), enforced in CI.
- Release workflow (`.github/workflows/release.yml`): pushing a `v*` tag builds, tests and publishes to npm with provenance via npm Trusted Publishing (OIDC, no token secret in CI).

### Changed

- GitHub Action hardened against script injection: `action.yml` passes its inputs to the run script via `env:` variables instead of `${{ }}` interpolation. The README documents that the word-split `args` and `files` inputs must not carry untrusted data.
- Workflow and script hardening: CI runs with a top-level `permissions: contents: read`; the release workflow pins its actions to commit SHAs and installs a pinned npm version; `scripts/fetch-materials.mjs` fetches the regulation text over HTTPS.
- `package.json` exports declare an explicit `types` condition; `bugs` field added.
- README example output regenerated from the actual CLI output; badges and a terminal demo GIF added.

## [0.3.0] - 2026-07-02

### Added

- GitHub Action: the repository doubles as a composite action (`uses: Pangea-Intelligence/dpp-lint@v0.3.0` with `files`, `command`, `origins`, `module`, `args` and `version` inputs). CI dogfoods the action against the example scenario and asserts both the pass and the fail path.
- `template <module>` command: writes a starter payload with curated official example values and prints the required fields with DIN DKE SPEC 99100 chapter references. `fixtures/` now ships in the npm package.
- `--report <file>` for `lint` and `risk`: self-contained HTML report (traffic light, findings tables, severity badges, data provenance, audit disclaimer).
- `examples/brandt-foerdertechnik/`: end-to-end scenario of a fictional mid-market machine builder checking supplier passport files, with four realistic mistakes, a fixed variant and an origins file that triggers R1 and R3.
- `lookupDin` exported for the template field guide.

## [0.2.0] - 2026-07-02

### Added

- The four remaining modules of the battery passport data model: `CarbonFootprintForBatteries`, `Circularity`, `PerformanceAndDurability` and `Labeling`. `lint` now covers all seven modules of DIN DKE SPEC 99100 / BatteryPassDataModel 1.2.0.
- `scripts/vendor-schemas.mjs`: reproducible schema vendoring from a pinned upstream commit; never overwrites curated files without `--force`.
- Mutation tests for the new modules and drift protection: the exported `MODULES` list is asserted against the vendored schema files.

### Changed

- **Behavior change:** payloads that tie for the best module detection score are treated as ambiguous. `lint` reports the tied candidate modules, asks for an explicit `--module <name>` and exits with code 2 (usage error). The ambiguity handling itself dates back to 0.1.0; the four newly vendored schemas make such ties reachable for combined payloads. A payload with a single best-scoring module still validates against that match.

### Fixed

- R4 no longer downgrades a present but broken `supplyChainDueDiligenceReport` to info when module detection picks another module in combined payloads.
- CC-BY-NC license boilerplate (including the variant without a "Copyright" anchor) no longer leaks into the DIN description map.
- DIN chapter ranges such as "6.7.7.5 - 8" are no longer truncated to the first number.
- A literal NUL byte in `scripts/vendor-schemas.mjs` made git treat the script as binary, hiding it from diffs.
- Vendor script hardening: no blanket 404 fallback masking network errors, `--ref` without a value no longer swallows the next flag, strict UTF-8/UTF-16 decoding.

## [0.1.0] - 2026-07-02

Initial release, published to npm as `dpp-lint@0.1.0`.

### Added

- `lint`: validates payloads against the vendored BatteryPassDataModel 1.2.0 JSON Schemas (draft-04, DIN DKE SPEC 99100) for `GeneralProductInformation`, `MaterialComposition` and `SupplyChainDueDiligence`. Encoding-tolerant reader (UTF-8/UTF-16), module auto-detection, findings enriched with DIN chapter references extracted from the SAMM TTL sources.
- `risk` (rules R1-R5): screens declared raw material origins (JSON/CSV) against the bundled EU CAHRA snapshot (June 2026 report, 29 countries / 234 regions) and the RMI facility list (shipped empty for licensing reasons, populate locally via `scripts/fetch-rmi.mjs --accept-rmi-terms`), plus payload gap analysis for the four regulated materials (EU 2023/1542 Annex X) along the OECD five-step framework.
- Exit-code contract: 0 clean, 1 findings (high/medium), 2 usage errors, enforced including commander subcommand overrides.

### Fixed

- `bin` entry normalized to `dist/cli.js`: npm 11 strips bin entries with a `./` prefix, which would have dropped the `dpp-lint` command on install.
