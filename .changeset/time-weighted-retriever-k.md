---
"@langchain/classic": patch
---

fix(classic): `TimeWeightedVectorStoreRetriever` now returns at most `k` documents instead of `k + 1`, and returns none when `k` is 0
