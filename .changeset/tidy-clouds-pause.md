---
"@langchain/mcp-adapters": minor
---

Add opt-in checkpointed LangGraph elicitation for modern MCP tools, preserving effective arguments and validating resumed answers and terminal output. Verify SDK-owned OAuth refresh, DCR, and CIMD selection with local acceptance fixtures.

Set `elicitationMode: "interrupt"` on modern connections to resume through a
LangGraph checkpointer. Legacy fallback requires `onElicitation`. Keep durable
call headers and authentication in connection configuration; per-call header
overrides are rejected. Continuation rounds disable automatic retries and do
not guarantee exactly-once server side effects.

Add `finishAuth(serverName, callbackParams, expectedState)` for an
application-owned OAuth redirect. The adapter checks callback state, delegates
token exchange and issuer validation to the SDK, and discards the old connection
and catalog after success. The application owns one-time state consumption,
user binding, credential storage, and the redirect endpoint. The configured
provider must persist discovery state, PKCE, and issuer-scoped credentials.
