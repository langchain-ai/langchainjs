---
"@langchain/pinecone": minor
---

Require `@pinecone-database/pinecone` 9, calling it with its options objects, and import `flatten` from `flat` 6 by name

This release requires `@pinecone-database/pinecone` 9.1 or later (the peer
range is now `^9.1.0`; 1.0.3 declared `^5.0.2`) and depends on `flat` 6, so
upgrade the Pinecone SDK along with this package; SDK versions 5 to 8 are no
longer supported.

The ranges moved without a code change, and the package did not work with
either. `flat` 6 has no default export, so the ESM build failed to load and
the CJS build threw `flat.default is not a function` on every `addDocuments`.
SDK 8 takes options objects, so `PineconeEmbeddings` threw a `TypeError` from
`inference.embed(model, inputs, params)`, a `PineconeStore` built from
`pineconeConfig` threw `PineconeArgumentError` from the positional `Index`
constructor, and `addVectors` passed `upsert` a bare array, which SDK 8
rejects. These now pass `{ model, inputs, parameters }`,
`({ name, namespace, host, additionalHeaders }, config)` and `{ records }`.
`pineconeConfig.indexName` is typed `string` again; under SDK 8 its derived
type had become `IndexOptions`. SDK 9 keeps SDK 8's call forms.
