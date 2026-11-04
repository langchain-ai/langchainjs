---
"@langchain/pgvector": patch
---

Make `buildFilterClauses` `protected` so subclasses can override it, and add `throwOnInvalidFilter` for strict metadata-filter validation.

- Filter entries that cannot be translated to SQL are reported with a warning by default, preserving the historical behavior. Set `throwOnInvalidFilter: true` to throw a `PGVectorFilterError` (`lc_error_code: "INVALID_METADATA_FILTER"`) before the query runs instead.
- `PGVectorFilterError` is exported and extends the shared `LangChainError`, so strict callers can use `PGVectorFilterError.isInstance(error)`.
- `FilterClausesResult` is now exported so an override can name the method's return contract.
- `in: []` and `notIn: []` no longer produce invalid SQL (`IN ()`). An empty `in` list matches nothing; an empty `notIn` list excludes nothing.
