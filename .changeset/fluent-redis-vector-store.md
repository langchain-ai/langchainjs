---
"@langchain/redis": minor
---

feat(redis): add FluentRedisVectorStore with advanced pre-filtering for document metadata

- Added `FluentRedisVectorStore` class with type-safe fluent filtering API
- Added filter expression classes: `Tag`, `Num`, `Text`, `Geo`, `Timestamp`, `Custom`
- Added `MetadataFieldSchema` array-based schema definition with automatic inference
- Supports complex filter combinations with AND/OR logic and nesting
- Existing `RedisVectorStore` preserved for backwards compatibility
