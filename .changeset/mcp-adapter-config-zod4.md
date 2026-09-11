---
"@langchain/mcp-adapters": major
---

Use `MCPAdapter({ servers })` as the canonical client API. `MultiServerMCPClient` and existing server-map configurations remain supported; the old class name is deprecated.

Upgrade to Zod 4. Configuration now rejects conflicting options and unknown output-handling keys. Hook argument overrides must be objects. Configuration snapshots preserve callbacks and OAuth provider identity.

Hook `state` is now typed as `unknown` rather than an object record. Its runtime value is unchanged. Applications must narrow it before accessing properties.

Remove `useStandardContentBlocks`; tool content always uses standard LangChain blocks. Update image/audio consumers to use `data` and `mimeType`. Artifact-routed blocks keep their MCP format, including when passed through `afterToolCall`; resource reads remain explicit.

Resource types now derive from the MCP SDK. `readResource()` preserves SDK content metadata; narrow with `"text" in content` or `"blob" in content` before accessing those fields.

Prefer `listTools()`; `getTools()` remains a compatibility alias. Connections now default to modern protocol mode. Add `mode: "legacy"` to legacy stdio, Streamable HTTP, and SSE server definitions. Modern connections never negotiate legacy or fall back to SSE. Unknown and incompatible configuration fields fail with Zod errors, including empty server maps.

Move notification and progress callbacks into each server configuration. `onInitialized` and SSE fallback are legacy-only. Remove `onRootsListChanged`: roots notifications originate from clients, so this server observer did not implement roots support. Supply workspace paths through tool parameters, resource URIs, or server configuration instead. Global LangChain hooks, naming, output policies, and load-error handling remain adapter options.
