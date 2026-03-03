---
"@langchain/community": patch
---

fix(community): Fix SQL injection via table/schema names in TypeORMVectorStore

- Added `quoteIdentifier()` helper that escapes double quotes and wraps identifiers per the SQL standard
- Fixed `getTablePath()` to always quote table and schema identifiers
- Fixed `similaritySearchVectorWithScore()` to use `getTablePath()` instead of raw `this.tableName`
