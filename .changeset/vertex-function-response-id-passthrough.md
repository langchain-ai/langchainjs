---
"@langchain/google": patch
---

fix: omit native functionResponse.id for Vertex AI, preserve it for the Gemini Developer API

#10292 stripped a LangChain-generated `tool_call_id` from `functionResponse.id` to fix Vertex AI's rejection of that field, but only checked for the `lc-tool-call-` prefix. When Gemini/Vertex supplies its own native `functionCall.id`, that id is not generated, so it still round-trips into `functionResponse.id` and Vertex rejects the request with the same `Unknown name "id" ... Cannot find field` error #10292 was meant to fix.

Vertex rejects `functionResponse.id` unconditionally (native or generated), while the Gemini Developer API accepts it and needs it to disambiguate parallel calls to the same tool name. This now threads the resolved `platformType` through `convertMessagesToGeminiContents` and only omits a native id when the platform is Vertex (`gcp`).
