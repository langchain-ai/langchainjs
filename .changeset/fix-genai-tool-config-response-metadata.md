---
"@langchain/google-genai": patch
---

fix(genai): improve tool config, response metadata, and structured output

- Support `tool_choice: "none"` by mapping it to `FunctionCallingMode.NONE`
- Add `model` and `model_provider` to response metadata for both invoke and streaming
- Default `withStructuredOutput` method to `"functionCalling"` and add `ls_structured_output_format` config for LangSmith tracing