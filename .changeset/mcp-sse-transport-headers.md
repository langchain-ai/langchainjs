---
"@langchain/mcp-adapters": patch
---

Send a configured `Authorization` header instead of joining it to the one an
`authProvider` produced. Header names merge case-insensitively inside the
adapter but reach a transport as a plain object, where the SDK spreads them
over its own `Authorization`; a key differing only in case survived as a
second entry and went out as `Bearer <provider>, Bearer <configured>`, which
servers reject.

Stop rebuilding the SSE stream's request by hand. SDK 1 dropped the
authorization, custom headers and `Accept` when a caller supplied
`eventSourceInit.fetch`, so the adapter reapplied all three; SDK 2 wraps that
fetch rather than replacing it and applies them itself.
