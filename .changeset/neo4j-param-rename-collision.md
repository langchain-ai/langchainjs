---
"@langchain/neo4j": patch
---

fix(neo4j): bind every parameter when combining nested metadata filters

`combineQueries` renamed parameters with a first-occurrence string replace that also matched prefixes of longer parameter names, so nested `$and`/`$or` filters could produce an unbound parameter and two fields sharing one value. Renaming now matches the whole parameter token everywhere it appears.
