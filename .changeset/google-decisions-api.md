---
"@langchain/google": patch
---

Adds **experimental** support for the Google Gemini Decisions API on AI
Studio. (Google Cloud / Vertex support has been added, but final support is
pending platform implementation.)

- Add `GoogleClassifier` and `BaseGoogleClassifier` (implementing `BaseDecisionModel` from `@langchain/core/decisions`) in `@langchain/google` and `@langchain/google/node`
- Support `Noul`, `Choice`, and `Score` questions across text, structured JSON, `BaseMessage` conversations, and multimodal `ContentBlock` inputs
- Add Decisions API converters for state, questions, responses, and `PromptRefusedError` safety refusals

Incorporates the most recent changes to the Interactions API as well,
including the removal of the Retrieval tools.
