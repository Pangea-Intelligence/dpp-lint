**Summary:** Several Aspect-level `samm:description` literals in the 1.2.0
models still embed a license paragraph that contradicts the repository's
actual license. The repository (headers, SPDX identifiers, README) is
CC-BY-4.0 since the October 2025 standardization, but the embedded text
still says CC **BY-NC** 4.0 (non-commercial) - anyone consuming the
descriptions programmatically republishes an incorrect license claim.

The paragraph appears in **two variants**:

1. Most modules (e.g. `GeneralProductInformation.ttl`, aspect description):
   starts with `Copyright 2024 Circulor (for and on behalf of the Battery
   Pass Consortium). This work is licensed under a Creative Commons
   Attribution-NonCommercial 4.0 International License ...`

2. `Circularity.ttl` (aspect description): same paragraph but **without
   the word "Copyright"**, starting directly with `2024 Circulor (for and
   on behalf of the Battery Pass Consortium). This work is licensed ...` -
   easy to miss when grepping for "Copyright".

**Suggested fix:** strip the embedded license paragraphs from the
`samm:description` literals entirely; the file headers and SPDX
identifiers already carry the authoritative CC-BY-4.0 statement.

For reference, [dpp-lint](https://github.com/Pangea-Intelligence/dpp-lint)
(an open-source linter for this data model) currently strips both
variants when generating its DIN-chapter map from the TTL sources, and
documents the deviation - we would much rather drop that workaround once
the source is clean.
