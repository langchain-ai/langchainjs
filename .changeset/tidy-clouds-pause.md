---
"@langchain/mcp-adapters": minor
---

For applications upgrading from adapter 1.x, modern MCP tools use LangGraph
interrupts when the server asks for input. Configure a checkpointer and resume
with the same thread ID. Direct calls can complete outside a graph when no user
input is needed; legacy servers use `mode: "legacy"` and per-server
`onElicitation` callbacks.

Derive modern form and URL requests from the official SDK core schemas. Modern
URL questions use the pending request key and omit legacy-only `elicitationId`;
legacy callbacks retain the SDK identifier requirement. Strip answer envelope
fields before resuming so they cannot replace continuation routing.

Accept the SDK `AuthProvider` token-broker contract alongside `OAuthClientProvider`
for modern HTTP and legacy HTTP/SSE. Token-only providers manage authorization
externally and cannot be used with `finishAuth()`.

Keep graph-call headers and authentication in connection configuration; modern
graph executions reject per-call header overrides, while direct HTTP calls retain
them across continuation rounds. Completed rounds preserve effective arguments
and server state in checkpoints. Continuation rounds disable automatic retries;
work repeated after a crash before checkpoint commit can repeat server side effects.

Add `finishAuth(serverName, callbackParams, expectedState)` for an
application-owned OAuth redirect. The adapter checks callback state, delegates
token exchange and issuer validation to the SDK, and discards the old connection
and catalog after success. The application owns one-time state consumption,
user binding, credential storage, and the redirect endpoint. The configured
provider must persist discovery state, PKCE, and issuer-scoped credentials.

State-only responses continue without requesting input. Direct and graph calls
share bounded continuation handling and cancellation. Graph interruption covers
tool elicitation; it does not add sampling, task or prompt/resource interruption APIs.
