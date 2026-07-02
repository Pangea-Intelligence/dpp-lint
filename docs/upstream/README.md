# Upstream submissions to batterypass/BatteryPassDataModel

Prepared 2026-07-02, found while building and vendoring for dpp-lint.
Everything below is ready to send; nothing has been submitted yet.
Send order: the PR first, then the issues (they reference the PR where
relevant). All texts are in the sibling files of this folder.

## Status

| # | What | Type | File | Sent |
|---|---|---|---|---|
| 1 | GPI e-mail regex fix (issue #54) | PR from fork branch `fix/gpi-email-regex` | `pr-email-regex.md` | no |
| 2 | Stale CC-BY-NC boilerplate in samm:description (2 variants) | Issue | `issue-license-boilerplate.md` | no |
| 3 | warrentyPeriod uses xs:gMonth - a duration cannot be expressed | Issue | `issue-warranty-gmonth.md` | no |
| 4 | Minor consistency findings (payload filename, typo inventory) | Issue | `issue-minor-findings.md` | no |

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
