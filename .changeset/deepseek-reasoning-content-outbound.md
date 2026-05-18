---
"@langchain/openai": patch
---

fix(openai): re-emit `reasoning_content` on outbound completions requests

The OpenAI Chat Completions converter already preserved `reasoning_content`
from responses into `additional_kwargs.reasoning_content` on the inbound
path, but the outbound path (`convertMessagesToCompletionsMessageParams`
and `convertStandardContentMessageToCompletionsMessage`) dropped the field
when converting an `AIMessage` back into a request payload. OpenAI-compatible
reasoning providers such as DeepSeek require the `reasoning_content` to be
echoed back on follow-up turns; without this roundtrip, multi-turn tool-call
loops fail with `400 The reasoning_content in the thinking mode must be
passed back to the API.`. OpenAI's own endpoints do not populate this field,
so passthrough is naturally provider-scoped.
