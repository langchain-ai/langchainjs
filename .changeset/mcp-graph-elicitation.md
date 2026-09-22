---
"@langchain/mcp-adapters": minor
---

Answer modern MCP elicitation with durable LangGraph interrupts. Each completed
`tools/call` round is recorded as plain task data before pausing, so resuming
retrieves the exact saved question and continuation instead of reissuing earlier
requests. Legacy elicitation callbacks remain unchanged.

Use `createMCPElicitationResume(interrupt, responses)` with the latest interrupt.
Answers target both the graph task and the displayed question attempt. Invalid
form answers re-ask without another MCP request, and one allowance counts server
questions and corrections. The original allowance survives reconstructed runs;
changed effective tool arguments and stale answers are rejected.

Recovery does not depend on the original process, client, or loop counter. Use a
persistent checkpointer and reconstruct compatible tools/graph against the same
thread and logical server/authentication identity. Server continuation expiry is
independent of checkpoint retention: an expired continuation fails rather than
silently restarting with old consent. Remote effects still require idempotency
across the server-success/checkpoint-write crash window.

`beforeToolCall` remains attempt-level. Hook-supplied header overrides continue to
work for ordinary calls but are refused for durable elicitation. SDK output
validation, descriptor forwarding, and header behavior remain intact. Unsupported
input requests and state-only responses fail clearly rather than being polled.

Public interrupts omit server continuation data; internal task streams and traces
can contain saved protocol data and require application-appropriate access and
projection policies.
