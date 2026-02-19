---
"@langchain/community": patch
---

Fix Milvus collection loading before delete operations (#9749) and partition name handling in search/delete (#9748)

- Added `loadCollectionSync()` call in the `delete()` method to ensure collection is loaded before delete operations
- Added `partition_names` parameter to `search()` call in `similaritySearchVectorWithScore()`
- Added `partition_name` parameter to both `deleteEntities()` and `delete()` calls
- Updated error message in delete method from "before search" to "before deletion"
