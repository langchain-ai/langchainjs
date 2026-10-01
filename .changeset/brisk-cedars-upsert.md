---
"@langchain/pinecone": patch
---

Call `@pinecone-database/pinecone` 8 with its options objects, and import `flatten` from `flat` 6 by name

The peer range moved to `@pinecone-database/pinecone` `^8.2.0` and `flat` to
`^6.0.1` without a code change, and the package did not work with either.
`flat` 6 has no default export, so the ESM build failed to load and the CJS
build threw `flat.default is not a function` on every `addDocuments`. SDK 8
takes options objects, so `PineconeEmbeddings` threw a `TypeError` from
`inference.embed(model, inputs, params)`, a `PineconeStore` built from
`pineconeConfig` threw `PineconeArgumentError` from the positional `Index`
constructor, and `addVectors` passed `upsert` a bare array, which SDK 8
rejects. These now pass `{ model, inputs, parameters }`,
`({ name, namespace, host, additionalHeaders }, config)` and `{ records }`.
`pineconeConfig.indexName` is typed `string` again; under SDK 8 its derived
type had become `IndexOptions`.
