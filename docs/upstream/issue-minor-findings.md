Two small 1.2.0 consistency findings from vendoring the model into
[dpp-lint](https://github.com/Pangea-Intelligence/dpp-lint). Neither is
functionally critical; both cost consumers a special case.

**1. Circularity sample payload filename differs from every other module**

Six of the seven modules ship their example as
`gen/<AspectName>-payload.json`; Circularity ships `gen/Circularity.json`
instead. Tooling that fetches the official examples needs a per-module
exception for this one file. Renaming to `Circularity-payload.json` would
make the layout uniform.

**2. Field name typo inventory (documentation only - NOT a rename request)**

For consumers it is worth a documented note (e.g. in the release notes or
README) that the following canonical property names are intentionally
kept although misspelled, since payloads must use them exactly:

- `warrentyPeriod` (GeneralProductInformation) - "warranty"
- `thirdPartyAussurances` (SupplyChainDueDiligence) - "assurances"
- `supplyChainIndicies` (SupplyChainDueDiligence) - "indices"
- `batteryTechicalProperties` (PerformanceAndDurability) - "technical"

We deliberately do **not** propose renaming them in 1.2.0 - that would
break every existing payload. A short authoritative statement that these
names are frozen would help implementers resist the urge to "fix" them
and break interoperability.
