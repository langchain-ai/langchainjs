---
"@langchain/groq": patch
---

Apply `reasoningFormat` and `topLogprobs` passed to the `ChatGroq` constructor

`ChatGroq` sent `reasoning_format` and `top_logprobs` from its `reasoningFormat`
and `topLogprobs` fields, but the constructor never set either field, so both
were always `undefined`: `topLogprobs` was accepted and ignored, and
`reasoningFormat` was not a constructor field at all. The constructor now sets
both, and `ChatGroqInput` gains `reasoningFormat`. A model constructed with
either now sends it to Groq; one constructed without them sends the same
request as before.
