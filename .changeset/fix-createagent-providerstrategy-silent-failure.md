---
"langchain": patch
---

fix(langchain/createAgent): throw on terminal `providerStrategy` parse failure instead of silently resolving with `structuredResponse: undefined`

When `createAgent` was configured with `responseFormat` resolving to a `providerStrategy` (either passed explicitly or auto-promoted from a bare Zod / JSON schema for models whose profile reports `structuredOutput: true`), and the model produced a terminal response (no `tool_calls`) whose text could not be JSON-parsed or did not satisfy the schema, the agent silently exited with no `structuredResponse`, surfacing later as `TypeError: Cannot read properties of undefined`. The agent now throws a `StructuredOutputParsingError` in that case while still allowing the agent loop to continue when tool calls are present. Closes #10878.
