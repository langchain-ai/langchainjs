---
"@langchain/pgvector": patch
---

Make `buildFilterClauses` `protected` so subclasses can override it, and fix two bugs in the metadata filter builder.

- `in: []` and `notIn: []` no longer produce invalid SQL (`IN ()`). An empty `in` list matches nothing; an empty `notIn` list excludes nothing.
- Filter entries the builder cannot translate are no longer dropped silently. The store logs a `console.warn` naming each ignored entry instead of running the query unfiltered.
