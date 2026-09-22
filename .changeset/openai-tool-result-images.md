---
"@langchain/openai": patch
---

Send image tool results so the model can see them.
On Chat Completions, images are moved from the tool message into a user message after the tool results. For messages with `output_version: "v1"`, this only happens when the model profile reports image input support; otherwise images are dropped as before.
On the Responses API, they are converted to native `input_image` items in `function_call_output` instead of being serialized as JSON text. Responses messages with `output_version: "v1"` are unchanged.
