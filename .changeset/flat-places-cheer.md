---
"@langchain/core": patch
---

Fix StructuredOutputParser failing to parse JSON when LLMs return multiline string fields by escaping unescaped newline characters inside quoted JSON values. This prevents JSON.parse errors and improves compatibility with OpenAI-style function/tool call outputs (e.g., in LangChain docs such as the Ollama withStructuredOutput example).


This update introduces a helper that safely escapes newline characters **only inside quoted JSON strings**, ensuring JSON remains valid.

### What this fixes
- Multiline LLM JSON output now parses correctly.
- Tool/function-call–style JSON (OpenAI-style) continues to work properly.
- Improves compatibility with LangChain docs, including the Ollama `withStructuredOutput` example:
  https://github.com/langchain-ai/docs/blob/main/src/oss/javascript/integrations/chat/ollama.mdx#withstructuredoutput

### Impact
- No breaking changes.
- Consumers do not need to modify their code.
- Structured JSON output from LLMs is parsed more reliably across providers.
