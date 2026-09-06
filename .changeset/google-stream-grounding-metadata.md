---
"@langchain/google": patch
---

Surface grounding and citation provenance on native Gemini streams. `convertGoogleGeminiStream` read only `finishReason` and content parts off the candidate, so `groundingMetadata`, `citationMetadata` and `groundingAttributions` never reached the caller — a `googleSearch`-grounded answer arrived with no citations, while the non-streaming converter exposed all three on `response_metadata`. They are now carried onto the `message-finish` event under the same snake_case keys, and omitted entirely when the response is not grounded.
