---
"@langchain/openai": patch
---

Clear type errors where the code drifted from the OpenAI SDK and core types

The Azure classes now check the client configuration before building the
`AzureOpenAI` client. `provider`, `dataResidency`, `credential`,
`x509Transport` and an X.509 `workloadIdentity` are options the SDK's
`AzureClientOptions` does not accept, and the SDK already threw when one was
set; that now fails with `Azure OpenAI does not support these client options`
instead of the SDK's own error. Every other option is passed through as
before. The remaining changes are types only: streamed custom tool call chunks
are typed with their `isCustomTool` marker, the Responses input converter types
the custom tool call id map it already read, the filename helpers accept the
legacy data content blocks they were already given, and MCP credential
redaction for tracing narrows each tool before reading its `type`.
