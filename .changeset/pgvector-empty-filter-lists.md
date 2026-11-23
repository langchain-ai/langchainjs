---
"@langchain/pgvector": patch
---

Fix `in: []` and `notIn: []` metadata filters producing invalid SQL.

An empty `in` list now emits a `FALSE` clause instead of `IN ()`, so it matches nothing as intended. An empty `notIn` list is omitted, since it excludes nothing. Both previously reached Postgres as a syntax error.
