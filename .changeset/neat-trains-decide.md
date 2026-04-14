---
"@langchain/redis": patch
---

fix(redis): improve RediSearch query escaping and filter validation

- add shared query escaping and field validation helpers for Redis filter builders
- apply escaping and type validation to `buildCustomQuery` tag/text/numeric paths
- add regression tests covering escaped values, wildcard handling, and invalid filter inputs
