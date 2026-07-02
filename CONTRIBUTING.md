# Contributing to dpp-lint

Thanks for considering a contribution. This is a small, focused tool; small, focused PRs work best.

## Dev setup

```sh
git clone https://github.com/pangea-intelligence/dpp-lint.git
cd dpp-lint
npm install

# Run the CLI from source (tsx)
npm run dev -- lint fixtures/battery/GeneralProductInformation.payload.json

# Run the test suite
npm test

# Type-check and build to dist/
npm run build
```

Requirements: Node >= 20. The project is ESM with NodeNext resolution, so relative imports in `.ts` files must use the `.js` extension.

## How schemas are vendored

The JSON Schemas under `schemas/battery/<version>/` are the official draft-04 artifacts from [batterypass/BatteryPassDataModel](https://github.com/batterypass/BatteryPassDataModel) (CC-BY-4.0). Do not edit them by hand ad hoc:

- Vendoring and updates go through the `scripts/` helpers, so the process stays reproducible.
- Every deliberate deviation from upstream must be documented in `schemas/PATCHES.md` (what was changed, why, upstream issue link if any).
- Keep the upstream attribution in `NOTICE` intact.

## How data snapshots are refreshed

The open datasets used by the `risk` command (EU CAHRA list, RMI public facility lists) are bundled as snapshots under `data/`:

- Refresh them with the `scripts/fetch-*` scripts, never by manual download and paste.
- Each refresh must update `data/SOURCES.md` (source URL, retrieval date, license).
- Commit the snapshot and the SOURCES.md update together in one PR.

## PR expectations

- One topic per PR, with a short description of what and why.
- `npm run build` and `npm test` must pass; add or adjust tests for behavior changes.
- Code, comments and docs are in English. No em dashes, use plain hyphens.
- Do not bump dependencies or the package version as a side effect of a feature PR.
- Exit-code contract is stable API: `0` = clean, `1` = findings, `2` = usage or internal error. Changes to it need discussion first.
