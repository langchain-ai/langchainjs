---
"@langchain/mcp-adapters": minor
---

Use checkpointed LangGraph elicitation by default for modern MCP tools, preserving effective arguments and validating resumed answers and terminal output.

Derive modern form and URL requests from the official SDK core schemas. Modern
URL questions use the pending request key and omit legacy-only `elicitationId`;
legacy callbacks retain the SDK identifier requirement. Strip answer envelope
fields before resuming so they cannot replace continuation routing.

Accept the SDK `AuthProvider` token-broker contract alongside `OAuthClientProvider`
for modern HTTP and legacy HTTP/SSE. Token-only providers manage authorization
externally and cannot be used with `finishAuth()`.

Remove `elicitationMode`; modern tools interrupt a checkpointed graph when the
server asks for input. Direct calls outside a graph still work without user input;
an input request requires a checkpointed graph. Legacy servers use explicit
`mode: "legacy"` and their own `onElicitation` callback, with no protocol fallback.
Keep graph-call headers and authentication in connection configuration; modern
graph executions reject per-call header overrides, while direct HTTP calls retain
them. Continuation rounds disable automatic retries and do
not guarantee exactly-once server side effects.

Add `finishAuth(serverName, callbackParams, expectedState)` for an
application-owned OAuth redirect. The adapter checks callback state, delegates
token exchange and issuer validation to the SDK, and discards the old connection
and catalog after success. The application owns one-time state consumption,
user binding, credential storage, and the redirect endpoint. The configured
provider must persist discovery state, PKCE, and issuer-scoped credentials.

Continue state-only modern responses outside LangGraph without requesting user input. Direct and graph calls share bounded continuation handling, preserving effective arguments and cancellation; actual questions still require a checkpointed graph.

Preserve per-call header overrides across direct continuation rounds, keeping concurrent invocations isolated.

Verify registration application types and issuer-bound re-registration, modern wire metadata and errors, legacy result compatibility, JSON output fidelity, resource caching, and continuation parameter headers with local fixtures. Clarify discovery-cache ownership and the tool-only graph interruption boundary.
