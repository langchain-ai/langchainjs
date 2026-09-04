---
"@langchain/google": patch
---

fix: omit native functionCall.id / functionResponse.id for Vertex AI, preserve them for the Gemini Developer API

#10292 stripped a LangChain-generated `tool_call_id` from `functionResponse.id` to fix Vertex AI's rejection of that field, but only checked for the `lc-tool-call-` prefix. When Gemini/Vertex supplies its own native `functionCall.id`, that id is not generated, so it still round-trips into `functionResponse.id` and Vertex rejects the request with the same `Unknown name "id" ... Cannot find field` error #10292 was meant to fix.

Vertex rejects `functionResponse.id` unconditionally (native or generated), while the Gemini Developer API accepts it and needs it to disambiguate parallel calls to the same tool name. This now threads the resolved `platformType` through `convertMessagesToGeminiContents` and only omits a native id when the platform is Vertex (`gcp`).

The same leak affects `functionCall.id` in the opposite direction. `convertGeminiPartToContentBlock` stores the model's `functionCall` object verbatim — including a native `id` — and the legacy converter spreads it straight back onto the wire, so replaying a prior tool call 400s with `Unknown name "id" at 'contents[N].parts[0].function_call'`. Vertex began populating `functionCall.id` on 2026-07-24, turning every multi-turn tool-calling conversation into a failure with no client-side change. Both part types are now gated on `platformType` (#11209).
