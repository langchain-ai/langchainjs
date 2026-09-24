---
"@langchain/openai": patch
---

Send image tool results on the Responses API as native `input_image` items in `function_call_output` instead of serializing them as JSON text, so the model can see them.
On Chat Completions, when OpenAI rejects a request with a 400 and a tool message contains an image, the error message now explains that Chat Completions does not support images in tool messages and points to `useResponsesApi: true`.
Messages with `output_version: "v1"` are unchanged.
