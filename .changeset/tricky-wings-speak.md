---
"@langchain/pgvector": patch
---

feat(pgvector): Several improvements to `PGVectorStore`:

- **Extensible filter API**: `buildFilterClauses` is now `protected` with an explicit `FilterClausesResult` return type, allowing subclasses to override and add custom SQL filter operators (e.g. JSONB containment `@>`). The `FilterClausesResult` type is also exported from the package.
- **Safe empty-array filter handling**: Empty `in: []` now correctly generates a `FALSE` clause (matching nothing) and empty `notIn: []` omits the clause entirely, preventing invalid Postgres `IN ()` / `NOT IN ()` syntax errors.
- **Score normalization**: New `scoreNormalization` constructor option (`"distance"` | `"similarity"`) lets you control whether `similaritySearchVectorWithScore` returns raw distance values (default, backward-compatible) or normalized similarity scores (higher = more similar).
- **Dual-score method**: New `similaritySearchVectorWithScores` method returns both the raw `distance` and computed `similarity` score for every result in a single call, without requiring callers to re-configure score normalization.
