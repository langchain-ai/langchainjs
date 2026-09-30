---
"@langchain/mcp-adapters": major
---

This release moves to MCP SDK 2, supports modern and legacy MCP servers in the same adapter, and lets servers ask users for input through LangGraph interrupts. It also changes tool names, configuration, and tool results. If you are upgrading from 1.x, review the changes below before updating.

See the [migration guide](https://docs.langchain.com/oss/javascript/migrate/langchain-mcp-adapters) for more information on migratimg.

### Update your client code

Use `MCPAdapter` for new code:

| 1.x API                           | Recommended API        |
| --------------------------------- | ---------------------- |
| `MultiServerMCPClient`            | `MCPAdapter`           |
| `mcpServers` or a flat server map | `{ servers: { ... } }` |
| `getTools(...)`                   | `listTools(...)`       |
| `initializeConnections()`         | `listToolsets()`       |
| `ClientConfig`                    | `MCPAdapterConfig`     |

These older APIs still work but are deprecated. `listTools()` returns a flat list of executable LangChain tools; `listToolsets()` groups them by server. Read configuration from `adapter.config.servers`; the returned snapshot no longer has `mcpServers`, and changing it does not reconfigure the adapter.

The adapter requires `@langchain/core ^1.2.6` and `@langchain/langgraph ^1.4.13`. It includes the MCP SDK client. If you create an SDK client yourself for `loadMcpTools`, switch your client imports from `@modelcontextprotocol/sdk` to `@modelcontextprotocol/client` (or `@modelcontextprotocol/client/stdio` for the stdio transport). `getClient()` now returns an SDK 2 client.

### Tool names and configuration

- **Tool names now include the server name by default**, even with one server: `search` on a server named `docs` becomes `docs__search`. Update code, prompts, and saved examples that refer to tool names, or set `prefixToolNameWithServerName: false` to keep unprefixed names. The standalone `loadMcpTools()` helper keeps its previous default of `false`.
- **Configuration is validated with Zod 4.** Unknown adapter and server options, conflicting transport settings, empty server maps, and invalid keys now throw. Remove `useStandardContentBlocks`, `onRootsListChanged`, `onCancelled`, and stdio `encoding`.
- **Move notification and progress callbacks into each server's configuration:**
  `onMessage`, `onProgress`, `onInitialized`, `onPromptsListChanged`,
  `onResourcesListChanged`, `onResourcesUpdated`, and `onToolsListChanged`.
  `beforeToolCall`, `afterToolCall`, and `onConnectionError` remain top-level `MCPAdapter` options.

### Connections and authentication

Each server negotiates its protocol independently. Omit `mode` to use `"auto"`, set `mode: "modern"` to require the modern protocol, or set `mode: "legacy"` to skip probing a known legacy server.

- **Legacy connection options need `mode: "legacy"`.** This applies to `onInitialized`, `onElicitation`, `automaticSSEFallback`, and HTTP/SSE `reconnect`. HTTP connections in `"auto"` or `"modern"` mode no longer resume a dropped response stream. Use legacy mode if you depend on that behavior.
- **SSE remains a legacy transport.** It rejects `mode: "modern"`, `elicitation`, and `logLevel`. The `SSEConnection` type now describes SSE only; use `StreamableHTTPConnection` for HTTP or `Connection` for any transport. Automatic HTTP-to-SSE fallback in `"auto"` mode is limited to HTTP 404 and 405.
- **`authProvider` accepts token providers as well as OAuth providers.** Use `{ token, onUnauthorized? }` for tokens your app manages. Once a provider has a token, it takes precedence over a configured `Authorization` header; until then, the configured header is sent. Complete OAuth redirects through the SDK's `transport.finishAuth(params)` using the same provider storage.
- **Authentication failures can recover.** Discovery retries an authentication failure on the next call, including with `onConnectionError: "ignore"`. Inspect the `MCPClientError` cause for `UnauthorizedError` (now exported) or an HTTP 401 error.
- **Tool catalogs are kept separate for different headers and provider objects.** Recreate the adapter if you switch accounts behind the same provider object. Method-level auth overrides apply to all of the adapter's HTTP/SSE servers, even when you select tools from just one server.

See the [connections guide](https://docs.langchain.com/oss/javascript/langchain/mcp/connections) and [authentication guide](https://docs.langchain.com/oss/javascript/langchain/mcp/auth).

### Servers can pause a run to ask for input

Modern MCP elicitation is enabled by default. When a tool asks the user to fill in a form or visit a URL, the adapter pauses the run with a LangGraph interrupt. Use a checkpointer and resume with `createMCPElicitationResume(interrupt, responses)` inside a LangGraph `Command`. A tool needs a checkpointer only if it asks for input; otherwise direct invocation still works. Set `elicitation: false` on a server to opt out. Legacy servers can use the new per-server `onElicitation` callback with `mode: "legacy"`.

Resuming runs the tool again from the beginning, including `beforeToolCall`. Make sure repeating that work will not duplicate side effects. Answers must cover every request in the interrupt and match the requested form schema. Sampling and roots requests are not handled through these interrupts.

### Tool results and errors

- **Multimodal content uses standard LangChain blocks.** Images and audio expose `data` and `mimeType`; resource links become `file` blocks with `url`, `mimeType`, and resource metadata. Update consumers of `image_url`, `mime_type`, or `source_type`. Blocks routed to the artifact keep their MCP format, including when passed to `afterToolCall`.
- **Structured output and protocol metadata stay in the artifact.** Read `structuredContent` from the `mcp_structured_content` entry and `_meta` from `mcp_meta`. A single text block now becomes plain string content even when those fields are present, so they are no longer included in what the model sees. Original resource blocks and content metadata are retained in `mcp_content` entries when conversion would otherwise lose them.
- **Resource conversion no longer fetches URIs.** Call `readResource()` explicitly when you need to fetch a resource. When routed to model content, embedded text resources become text blocks; embedded binary resources become image, audio, or file blocks according to their MIME type. `readResource()` preserves SDK metadata; narrow its results with `"text" in content` or `"blob" in content`.
- **Server-reported tool errors now reach the agent as error messages.** When a tool is invoked with a tool call, an MCP result with `isError` returns a `ToolMessage` with `status: "error"`. Its error text reaches the model even if `outputHandling` routes text to the artifact. These results no longer trigger exception-based handling such as `toolRetryMiddleware` or `handleToolErrors`. If you invoke the tool with plain arguments, it still throws `ToolException`, with the MCP response in `error.result`.
- **Other tool failures still throw.** Transport and validation errors retain their underlying cause. Use `isToolException(error)` and `MCPClientError.isInstance(error)` to recognize adapter errors across module copies; objects with a matching `name` alone no longer pass these checks.
- **Hooks preserve `ToolMessage` and LangGraph `Command` results.** They are no longer flattened or rejected. Hook `state` is now typed `unknown`; narrow it before use, and return an object when overriding arguments. `afterToolCall` receives successful results only.

### Discovery, cleanup, and diagnostics

- `listTools([], { cacheMode: "refresh" })` refreshes discovery; `cacheMode: "bypass"` skips the cache. A failed refresh keeps previously returned tools usable.
- Keep the adapter open while using its tools, then await `close()`. Closing stops active discovery and pending reconnects and clears connections and caches. You can reuse the adapter by discovering fresh tools afterwards.
- `listResources()` and `listResourceTemplates()` now surface server errors instead of silently returning empty lists. A server that does not implement resource-template listing still contributes `[]`.
- `DEBUG=@langchain/mcp-adapters:*` no longer emits logs; use `onConnectionError` and the per-server notification callbacks.
- Exhausted background stdio restart attempts report through an `onConnectionError` callback. A throwing or rejecting `onProgress` callback no longer fails the tool call.
