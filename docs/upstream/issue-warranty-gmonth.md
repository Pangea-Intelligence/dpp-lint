**Summary:** In GeneralProductInformation 1.2.0, the `warrentyPeriod`
property is constrained to the XML Schema `gMonth` lexical space:

```
--(0[1-9]|1[0-2])(Z|(\+|-)((0[0-9]|1[0-3]):[0-5][0-9]|14:00))?
```

`xs:gMonth` denotes a **recurring calendar month** ("every June"), so the
only valid values are `--01` through `--12` (optionally with a timezone).
A warranty *period* - a duration such as "8 years" or "96 months" -
cannot be expressed in this value space at all. The official sample
payload works around this by shipping `--06`, which reads as "June", not
as a warranty length.

Given DIN DKE SPEC 99100 ch. 6.1.3.4 describes this field as the battery
warranty period, `xs:duration` (e.g. `P8Y`) or a plain month count seem
like the intended semantics.

**Question:** is `gMonth` intentional here (and if so, what is the
intended interpretation), or should the characteristic move to a
duration-based type in a future model release? We are aware the field
name itself (`warrentyPeriod`) is canonical and interoperability-relevant,
so this issue is only about the value space, not the name.

Found while building [dpp-lint](https://github.com/Pangea-Intelligence/dpp-lint),
an open-source linter for this data model.
