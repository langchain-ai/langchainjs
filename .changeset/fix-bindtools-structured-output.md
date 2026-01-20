---
"@langchain/core": patch
---

Add validation to throw an error when `withStructuredOutput` is called on a model that already has tools bound via `bindTools`. These methods are mutually exclusive because `withStructuredOutput` internally uses tool calling to generate structured output. Added optional `getBoundTools()` method to `BaseChatModel` that subclasses can implement to enable this validation.
