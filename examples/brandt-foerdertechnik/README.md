# Example: Brandt Fördertechnik GmbH

A fictional but typical scenario for dpp-lint: a mid-market machine builder
that uses batteries as a component, without producing them itself.

**The company.** Brandt Fördertechnik GmbH (Augsburg, ~450 employees, all
names and data invented) builds electric forklifts and automated guided
vehicles. Every vehicle ships with a purchased 48 V LFP traction battery
"NC-Trak 48" from their cell supplier, NordCell Battery Systems (Sweden).
Industrial batteries above 2 kWh need a battery passport from 2027-02-18
(EU 2023/1542), so NordCell delivers the passport data as JSON files, and
Brandt has to check them before taking the machines to market.

**The folders.**

- `incoming/` - the passport files exactly as delivered by the supplier
  (they contain four realistic mistakes)
- `incoming-fixed/` - the same files after the supplier corrected them
- `origins.json` - the raw material origins NordCell declared alongside

## 1. Check the incoming supplier data

```sh
npx dpp-lint lint examples/brandt-foerdertechnik/incoming/*.json
```

One of the three files fails with four findings, each pointing at the DIN
DKE SPEC 99100 chapter to look up:

- `warrentyPeriod` is missing (yes, the misspelling is official - the
  canonical field name in the standard is `warrentyPeriod`)
- the battery passport identifier `urn:nordcell:NC-Trak-48/SN-2026-041377`
  violates the required URN pattern (uppercase, slashes and extra segments
  are not allowed)
- `batteryMass` arrives as the string `"48.2"` instead of a number - a
  classic export bug
- the supplier contact e-mail is written as `passport(at)nordcell.example`

Exit code is 1, so the same command works as a gate in a CI pipeline or
goods-receipt automation.

## 2. Screen the declared raw material origins

```sh
npx dpp-lint risk examples/brandt-foerdertechnik/incoming/MaterialComposition.json \
  --origins examples/brandt-foerdertechnik/origins.json
```

The screening walks the five OECD due-diligence steps and finds:

- **HIGH** - the payload declares lithium (a regulated material under
  Annex X), but the origins file has no entry for it: its origin must be
  identified and screened
- **HIGH** - the declared cobalt origin CD (Democratic Republic of the
  Congo) is on the EU indicative CAHRA list
- **INFO** - the two declared smelters cannot be checked because the
  bundled RMI snapshot ships empty for licensing reasons (populate it
  locally with `node scripts/fetch-rmi.mjs --accept-rmi-terms`)

This is the conversation starter with the supplier: two questions that
must be answered before the due-diligence duties apply from 2027-08-18.

## 3. Re-check after the supplier corrected the files

```sh
npx dpp-lint lint examples/brandt-foerdertechnik/incoming-fixed/*.json
```

All three files pass, exit code 0. Note that the risk findings from step 2
do not disappear by fixing file formats - real supply chain risk has to be
addressed with the supplier, not in the JSON.

## Footnotes on the fixed data

- `warrentyPeriod` accepts only the XML `gMonth` format (`--01` to `--12`).
  A warranty *duration* cannot actually be expressed in it; the corrected
  file uses `--08` to satisfy the official schema.
- The passport identifier pattern `^urn:[a-z0-9]+:[a-z0-9]+$` allows
  exactly two lowercase alphanumeric segments, so serial numbers with
  hyphens have to be normalized (here: `urn:nordcell:sn2026041377`).
