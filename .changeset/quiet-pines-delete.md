---
"@langchain/pinecone": patch
---

Pass ids and filters to `@pinecone-database/pinecone` 8's `deleteMany` as `{ ids }` and `{ filter }`

`PineconeStore.delete` passed `deleteMany` a bare id array or filter object,
the SDK 5 form. SDK 8 takes `{ ids }` or `{ filter }`, and neither old call
worked. `delete({ filter })` threw "Either `ids` or `filter` must be provided."
`delete({ ids })` failed silently: SDK 8 read the array's own `filter` method
as the filter, and the request it sent carried no ids, so the records were
not deleted. Both now send the ids or filter they were given.
`delete({ deleteAll: true })` is unchanged.
