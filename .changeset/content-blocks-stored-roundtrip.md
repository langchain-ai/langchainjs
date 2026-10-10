---
"@langchain/core": patch
---

fix(core): restore contentBlocks content on stored-message deserialization

A message built with the `contentBlocks` input field serialized its content under the snake-cased `content_blocks` key, which `mapStoredMessageToChatMessage` did not map back to `contentBlocks`, so the message round-tripped to empty content. Remap it before construction, mirroring the `load()` reviver.
