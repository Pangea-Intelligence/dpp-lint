This restores the lost backslashes in the `ValidEmailAddress` regular
expression constraint of the GeneralProductInformation module (1.2.0),
fixing #54.

**Current state** (`BatteryPass/io.BatteryPass.GeneralProductInformation/1.2.0/GeneralProductInformation.ttl`):

```
samm:value "^[w.-]+@[w.-]+.[A-Za-z]{2,}$"
```

The character class `[w.-]` matches only the literal characters `w`, `.`
and `-` (instead of `[\w.-]`, word characters), and the unescaped `.`
before the TLD matches any character. In practice almost every real
e-mail address is rejected (`contact@example.com` fails), while nonsense
strings such as `ww.ww@ww.w%XYab` validate.

**This PR** applies exactly the repair that is already in place for the
Circularity module (see #25, fixed there in an earlier release):

```
samm:value "^[\\w.-]+@[\\w.-]+\\.[A-Za-z]{2,}$"
```

The pattern is now byte-identical to `Circularity.ttl`'s
`ValidEmailAddress`, so the two modules are consistent again.

**Scope note:** only the TTL source is changed. The generated artifacts
under `gen/` (JSON schema, sample payload, documentation) still carry the
broken pattern and would need one samm-cli regeneration on your side - I
did not want to hand-edit generated files. Happy to adjust if you prefer
the generated files patched in the same PR.

Found while building [dpp-lint](https://github.com/Pangea-Intelligence/dpp-lint),
an open-source linter that validates battery passport payloads against
this data model.
