---
"@langchain/google": patch
---

Preserve `thought` and `thoughtSignature` when converting `AIMessage` history back to Gemini API parts. Previously, resending a prior turn's thinking text stripped these markers, so a thinking model's own chain-of-thought was replayed to Gemini as an ordinary, unflagged assistant utterance on the next turn — contradicting Gemini's documented requirement (https://ai.google.dev/gemini-api/docs/thinking) that thought blocks be resent verbatim including their flag/signature. Fixes both content-block shapes a Gemini `AIMessage` can present as:

- The legacy/default `AIMessage.content` array (`{ type: "text", thought: true, ... }`), read directly by `convertLegacyContentMessageToGeminiContent`.
- The standardized `AIMessage.contentBlocks` getter, which `ChatGoogleTranslator` (`@langchain/core`) normalizes into `{ type: "reasoning", reasoning, thought, ... }` — read by `convertStandardContentMessageToGeminiContent` whenever `response_metadata.model_provider === "google"` (i.e. on every real response this package produces) and `output_version` isn't explicitly `"v1"`.
