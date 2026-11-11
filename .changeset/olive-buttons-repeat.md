---
"@langchain/openrouter": patch
---

Fix `ChatOpenRouter._generate` throwing a bare `TypeError` when a provider returns HTTP 200 with a body that has no `choices` key. The existing `No choices returned in response.` guard was unreachable in that case because `data.choices[0]` was read one line earlier without optional chaining, unlike `_streamResponseChunks` which already used `data.choices?.[0]`.
