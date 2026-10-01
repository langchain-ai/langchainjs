---
"@langchain/redis": patch
---

Fix type errors where `@langchain/redis` had drifted from `redis` 6's types

`RedisVectorStore`, `FluentRedisVectorStore` and `RedisCache` take node-redis's
`RedisClientType | RedisClusterType`, so a client from `createClient()` or
`createCluster()` can be passed without a cast; under `redis` 6 the old
`ReturnType<typeof createClient>` type accepted no client it creates. A client
created with `RESP: 2` or extra modules still needs one. `createIndexOptions`
and `RedisSearchLanguages` are typed from `ft.create`'s options again instead
of `never`, `CustomSchemaField.type` and the vector field types use
`SchemaFieldType` and `SchemaVectorFieldAlgorithm`, and the search options use
`FtSearchOptions`.

No behaviour change.
