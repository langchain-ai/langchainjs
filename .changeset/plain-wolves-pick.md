---
"@langchain/classic": patch
---

Fix type errors where `@langchain/classic` had drifted from `@langchain/core` v1

Core v1 removed `BaseStoreInterface`, so `MultiVectorRetriever`'s `docstore`
was typed with a name that core no longer exports, which resolves to `any` or
fails to compile in consumers. It is now typed as the `mget`, `mset`,
`mdelete` and `yieldKeys` methods of core's `BaseStore`, which is the same
shape, and `InMemoryDocstore` implements that shape.

No behaviour change.
