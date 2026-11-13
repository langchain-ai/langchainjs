---
"@langchain/core": patch
---

mergeMessageRuns only puts a newline between two non-empty string contents, so merging an AI message that only has tool calls no longer leaves a leading newline
