---
"@langchain/core": patch
---

fix(core): preserve assistant text when reasoning models reuse protocol index

Reasoning models can emit `text-delta` events at the same content-block index as
a `reasoning` block. `ChatModelStream._assembleMessage` now routes incompatible
deltas to a separate slot instead of silently dropping them, so assembled
`AIMessage`s (and graph checkpoints that persist them) retain assistant text.
