---
"@langchain/redis": minor
---

Move to `redis` (node-redis) 6, and fix the type errors where `@langchain/redis` had drifted from its types

This release depends on `redis` `^6.2.1` (1.1.3 depended on `^4.6.13`). node-redis
6 defaults to the RESP3 protocol, so pass in clients created with node-redis 6;
the package's own code sends the same commands and option names as before.

`RedisVectorStore`, `FluentRedisVectorStore` and `RedisCache` take node-redis's
`RedisClientType | RedisClusterType`, so a client from `createClient()` or
`createCluster()` can be passed without a cast; under `redis` 6 the old
`ReturnType<typeof createClient>` type accepted no client it creates. A client
created with `RESP: 2` or extra modules still needs one. `createIndexOptions`
and `RedisSearchLanguages` are typed from `ft.create`'s options again instead
of `never`, `CustomSchemaField.type` and the vector field types use
`SchemaFieldType` and `SchemaVectorFieldAlgorithm`, and the search options use
`FtSearchOptions`.
