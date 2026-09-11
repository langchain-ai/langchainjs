---
"@langchain/mcp-adapters": major
---

Use `MCPAdapter({ servers })` as the canonical client API. `MultiServerMCPClient` and existing server-map configurations remain supported; the old class name is deprecated.

Upgrade to Zod 4. Configuration now rejects conflicting options and unknown output-handling keys. Hook argument overrides must be objects. Configuration snapshots preserve callbacks and OAuth provider identity.

Hook `state` is now typed as `unknown` rather than an object record. Its runtime value is unchanged. Applications must narrow it before accessing properties.

Remove `useStandardContentBlocks`; tool content always uses standard LangChain blocks. Update image/audio consumers to use `data` and `mimeType`. Artifact-routed blocks keep their MCP format, including when passed through `afterToolCall`; resource reads remain explicit.
