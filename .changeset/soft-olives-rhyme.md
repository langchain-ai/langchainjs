---
"@langchain/google": patch
---

This addresses four specific issues:

- "thought" and "thoughtSignature" not being present in the conversation
  history sent to Gemini when using v0 messages
- "thought" and "thoughtSignature" not being present in the conversation history sent to Gemini when using v1 messages
- "thoughtSignature" not being present in v1 tool calls specifically
- ContentBlock.Reasoning not being handled in v1 at all

It does so by, largely, keeping the existing logic converting from LangChain representation to a Google.Part in both the v0 (legacy) and v1 (standard) paths intact. (This is done in both in the messages.ts file.)

- In convertLegacyContentMessageToGeminiContent(), the conversion is moved to a new function: convertLegacyPartToGeminiPart() for consistency with the standard path and to standardize where and how the thought/thoughtSignature fields are added
- Both convertLegacyPartToGeminiPart() and convertStandardContentBlockToGeminiPart() get a baseGeminiPart() function that returns the Gemini.Part without the thought or thoughtSignature fields
- Both then add the additional fields, if necessary, independent of what the underlying Gemini.Part is.

The last point is done because Gemini can attach "thought" or "thoughtSignature" to any block type. Not just text.
