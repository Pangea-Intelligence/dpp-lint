# Upstream submissions to batterypass/BatteryPassDataModel

Prepared 2026-07-02, found while building and vendoring for dpp-lint.
All four submitted on 2026-07-05 (PR first, then the issues, as planned).

## Status

| # | What | Type | File | Sent |
|---|---|---|---|---|
| 1 | GPI e-mail regex fix (issue #54) | PR from fork branch `fix/gpi-email-regex` | `pr-email-regex.md` | yes, [PR #56](https://github.com/batterypass/BatteryPassDataModel/pull/56) (2026-07-05) |
| 2 | Stale CC-BY-NC boilerplate in samm:description (2 variants) | Issue | `issue-license-boilerplate.md` | yes, [#57](https://github.com/batterypass/BatteryPassDataModel/issues/57) (2026-07-05) |
| 3 | warrentyPeriod uses xs:gMonth - a duration cannot be expressed | Issue | `issue-warranty-gmonth.md` | yes, [#58](https://github.com/batterypass/BatteryPassDataModel/issues/58) (2026-07-05) |
| 4 | Minor consistency findings (payload filename, typo inventory) | Issue | `issue-minor-findings.md` | yes, [#59](https://github.com/batterypass/BatteryPassDataModel/issues/59) (2026-07-05) |

## Send commands (after review)

The fork with the fix branch already exists:
https://github.com/Pangea-Intelligence/BatteryPassDataModel (branch `fix/gpi-email-regex`).

```sh
# 1. Pull request (title + body from pr-email-regex.md)
gh pr create --repo batterypass/BatteryPassDataModel \
  --head Pangea-Intelligence:fix/gpi-email-regex \
  --title "fix: restore lost backslashes in GeneralProductInformation e-mail regex (#54)" \
  --body-file docs/upstream/pr-email-regex.md

# 2.-4. Issues
gh issue create --repo batterypass/BatteryPassDataModel \
  --title "Stale CC-BY-NC boilerplate still embedded in samm:description literals" \
  --body-file docs/upstream/issue-license-boilerplate.md

gh issue create --repo batterypass/BatteryPassDataModel \
  --title "warrentyPeriod is constrained to xs:gMonth - a warranty duration cannot be expressed" \
  --body-file docs/upstream/issue-warranty-gmonth.md

gh issue create --repo batterypass/BatteryPassDataModel \
  --title "Minor 1.2.0 consistency findings (Circularity example filename, field name typos)" \
  --body-file docs/upstream/issue-minor-findings.md
```

After sending, tick the table above and note the issue/PR numbers.
