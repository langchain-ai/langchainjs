# @langchain/mcp-adapters

## 2.0.1

### Patch Changes

- [#11804](https://github.com/langchain-ai/langchainjs/pull/11804) [`0552450`](https://github.com/langchain-ai/langchainjs/commit/0552450883862054cab97891be4373b232caf9e8) Thanks [@byhow](https://github.com/byhow)! - Keep the SDK error as `cause` after an HTTP→SSE fallback. When a Streamable HTTP connection falls back to SSE and the SSE attempt fails, the thrown `MCPClientError` now has the SSE attempt's SDK error (an `UnauthorizedError`, or the SSE 401) as its `cause`, one level down as for a direct HTTP or SSE connection, instead of a second `MCPClientError`. Code that checks `UnauthorizedError.isInstance(error.cause)`, such as an OAuth login handler, now works for SSE-only servers too.

- [#11845](https://github.com/langchain-ai/langchainjs/pull/11845) [`1b5ac16`](https://github.com/langchain-ai/langchainjs/commit/1b5ac16fda8099c8a28cebd9328d5c6494dc4e8f) Thanks [@hntrl](https://github.com/hntrl)! - Use a single underscore between MCP server names and tool names (`server_tool` instead of `server__tool`). The separator for `additionalToolNamePrefix` remains unchanged (`mcp__server_tool`).

## 2.0.0

### Major Changes

- [#11767](https://github.com/langchain-ai/langchainjs/pull/11767) [`56a7f0b`](https://github.com/langchain-ai/langchainjs/commit/56a7f0b193eae1069dd4e855b2119df9be07c9c2) Thanks [@byhow](https://github.com/byhow)! - This release moves to MCP SDK 2, supports modern and legacy MCP servers in the same adapter, and lets servers ask users for input through LangGraph interrupts. It also changes tool names, configuration, and tool results. If you are upgrading from 1.x, review the changes below before updating.

  See the [migration guide](https://docs.langchain.com/oss/javascript/migrate/langchain-mcp-adapters) for more information on migrating.

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

  The adapter requires `@langchain/core ^1.2.6` and `@langchain/langgraph ^1.4.13`. It includes the MCP SDK client. If you create an SDK client yourself for `loadMcpTools`, switch your client imports from `@modelcontextprotocol/sdk` to `@modelcontextprotocol/client` (or `@modelcontextprotocol/client/stdio` for the stdio transport). `getClient()` now returns an SDK 2 client. An SDK 2 `Client` negotiates only the legacy protocol by default; pass `versionNegotiation: { mode: "auto" }` when you construct it to reach modern servers.

  ### Tool names and configuration
  - **Tool names now include the server name by default**, including with the deprecated `MultiServerMCPClient` and with one server: `search` on a server named `docs` becomes `docs__search`. Update code, prompts, and saved examples that refer to tool names, or set `prefixToolNameWithServerName: false` to keep unprefixed names. Update `interruptOn` approval rules to the prefixed names; a rule for `delete_repo` no longer matches `github__delete_repo`. Server names aren't validated, so choose names your model provider accepts in tool names. The standalone `loadMcpTools()` helper keeps its previous default of `false`.
  - **Duplicate tool names throw.** With `prefixToolNameWithServerName: false`, `listTools()` and `getTools()` throw `MCPClientError` when two servers expose the same tool name, or when one server lists a name twice. Keep the prefix, or pick tools per server from `listToolsets()`.
  - **Configuration is validated with Zod 4.** Unknown adapter and server options, options that don't apply to a server's mode or transport, conflicting transport settings, empty server maps, and setting both `servers` and `mcpServers` now throw, and `loadMcpTools` validates its options the same way. Remove `useStandardContentBlocks`, `onRootsListChanged`, `onCancelled`, and stdio `encoding`.
  - **Move notification and progress callbacks into each server's configuration:**
    `onMessage`, `onProgress`, `onInitialized`, `onPromptsListChanged`,
    `onResourcesListChanged`, `onResourcesUpdated`, and `onToolsListChanged`.
    `beforeToolCall`, `afterToolCall`, and `onConnectionError` remain top-level `MCPAdapter` options.

  ### Connections and authentication

  Each server negotiates its protocol independently. Omit `mode` to use `"auto"`, set `mode: "modern"` to require the modern protocol, or set `mode: "legacy"` to skip probing a known legacy server.

  - **Legacy connection options need `mode: "legacy"`.** This applies to `onInitialized`, `onElicitation`, `automaticSSEFallback`, and HTTP/SSE `reconnect`. HTTP connections in `"auto"` or `"modern"` mode no longer resume a dropped response stream. Use legacy mode if you depend on that behavior.
  - **Some client methods are legacy-only.** On a server that negotiates the modern protocol, `setLoggingLevel()` throws; set the server's `logLevel` instead. Modern servers reject `resources/subscribe`; list the URIs to watch in the server's `resourceSubscriptions` option and handle `onResourcesUpdated`.
  - **SSE remains a legacy transport.** It rejects `mode: "modern"`, `elicitation`, and `logLevel`. The `SSEConnection` type now describes SSE only; use `StreamableHTTPConnection` for HTTP or `Connection` for any transport. Automatic HTTP-to-SSE fallback in `"auto"` mode is limited to HTTP 404 and 405.
  - **`authProvider` accepts token providers as well as OAuth providers.** Use `{ token, onUnauthorized? }` for tokens your app manages. Once a provider has a token, it takes precedence over a configured `Authorization` header; until then, the configured header is sent. Complete OAuth redirects through the SDK's `transport.finishAuth(params)` using the same provider storage.
  - **Authentication failures can recover.** Discovery retries an authentication failure on the next call, including with `onConnectionError: "ignore"`. Walk the error's `cause` chain for `UnauthorizedError` (now exported) or an HTTP 401 error: discovery wraps it in `MCPClientError`, twice when legacy mode falls back to SSE, and tool calls wrap it in `ToolException`.
  - **Tool catalogs are kept separate for different headers and provider objects.** Recreate the adapter if you switch accounts behind the same provider object. A method-level `authProvider` replaces the configured one, and method-level `headers` are added to each server's headers, where a configured header with the same name wins. Both apply to all of the adapter's HTTP/SSE servers, even when you select tools from just one server.

  See the [connections guide](https://docs.langchain.com/oss/javascript/langchain/mcp/connections) and [authentication guide](https://docs.langchain.com/oss/javascript/langchain/mcp/auth).

  ### Servers can pause a run to ask for input

  Modern MCP elicitation is enabled by default. When a tool asks the user to fill in a form or visit a URL, the adapter pauses the run with a LangGraph interrupt. Use a checkpointer and resume with `createMCPElicitationResume(interrupt, responses)` inside a LangGraph `Command`. A tool needs a checkpointer only if it asks for input; otherwise direct invocation still works. Set `elicitation: false` on a server to opt out. Legacy servers can use the new per-server `onElicitation` callback with `mode: "legacy"`.

  Resuming runs the tool again from the beginning, including `beforeToolCall`. Make sure repeating that work will not duplicate side effects. Answers must cover every request in the interrupt and match the requested form schema. Sampling and roots requests are not answered through these interrupts; they fail the tool call with a `ToolException`, even alongside an elicitation.

  ### Tool results and errors
  - **Multimodal content uses standard LangChain blocks.** Images and audio expose `data` and `mimeType`; resource links become `file` blocks with `url`, `mimeType`, and resource metadata. Update consumers of `image_url`, `mime_type`, or `source_type`. Blocks routed to the artifact keep their MCP format, including when passed to `afterToolCall`.
  - **Structured output and protocol metadata stay in the artifact.** Read `structuredContent` from the `mcp_structured_content` entry and `_meta` from `mcp_meta`. A single text block now becomes plain string content even when those fields are present, so they are no longer included in what the model sees. Original resource blocks and content metadata are retained in `mcp_content` entries when conversion would otherwise lose them.
  - **Resource conversion no longer fetches URIs.** Call `readResource()` explicitly when you need to fetch a resource. When routed to model content, embedded text resources become text blocks; embedded binary resources become image, audio, or file blocks according to their MIME type. `readResource()` preserves SDK metadata; narrow its results with `"text" in content` or `"blob" in content`.
  - **Server-reported failures return an error message.** When an MCP server returns a tool result with `isError`, the adapter returns a `ToolMessage` with `status: "error"` for an agent's tool call. Direct invocation with plain arguments still throws `ToolException`, with the MCP response in `error.result`.
  - **Connection and validation failures still throw from the tool.** Invoked directly, the tool raises the exception; in a `createAgent` agent, the default tool error handling turns it into a `ToolMessage` with `status: "error"`. Read the exception's `message` for details; `cause` is not always set.
  - **Hooks preserve `ToolMessage` and LangGraph `Command` results.** They are no longer flattened or rejected. Hook `state` is now typed `unknown`; narrow it before use, and return an object when overriding arguments. The merged arguments are validated against the tool's input schema before the call is sent. `afterToolCall` receives successful results only.
  - **Tool input schemas are no longer simplified.** They reach the model as the server declares them. 1.x inlined `$ref` definitions, merged `allOf`, flattened `anyOf` and `oneOf`, and removed `if`/`then`/`else`, `not`, `$schema`, and `unevaluatedProperties`.

  ### Discovery, cleanup, and diagnostics
  - `listTools([], { cacheMode: "refresh" })` refreshes discovery; `cacheMode: "bypass"` skips the cache. A failed refresh keeps previously returned tools usable.
  - Keep the adapter open while using its tools, then await `close()`. Closing stops active discovery and pending reconnects and clears connections and caches. You can reuse the adapter by discovering fresh tools afterwards.
  - `listResources()` and `listResourceTemplates()` now surface server errors; 1.x returned `[]` for a failing server and logged the error only under `DEBUG`. A server that does not implement resource-template listing still contributes `[]`.
  - `DEBUG=@langchain/mcp-adapters:*` no longer emits logs; use `onConnectionError` and the per-server notification callbacks.
  - Exhausted background stdio restart attempts report through an `onConnectionError` callback. Errors thrown or rejected by an `onProgress` callback are now ignored.

## 1.1.4

### Patch Changes

- [#11412](https://github.com/langchain-ai/langchainjs/pull/11412) [`7df258c`](https://github.com/langchain-ai/langchainjs/commit/7df258c0af8362fede14d42bb982597a56f41b78) Thanks [@hntrl](https://github.com/hntrl)! - chore(langgraph): update langgraph deps to track serialization fix

## 1.1.3

### Patch Changes

- [#10005](https://github.com/langchain-ai/langchainjs/pull/10005) [`d1365a1`](https://github.com/langchain-ai/langchainjs/commit/d1365a125fc9d0d17120d923957841a33ba160cf) Thanks [@Oscar-Umana](https://github.com/Oscar-Umana)! - map mcp resource link content blocks to langchain url content block

## 1.1.2

### Patch Changes

- [#9805](https://github.com/langchain-ai/langchainjs/pull/9805) [`6c8a335`](https://github.com/langchain-ai/langchainjs/commit/6c8a335ec6e14d27c99a0a49de6be3ac332e33b3) Thanks [@christian-bromann](https://github.com/christian-bromann)! - fix(mcp-adapters): simplify complex JSON schemas for LLM compatibility (#9804)

## 1.1.1

### Patch Changes

- [#9674](https://github.com/langchain-ai/langchainjs/pull/9674) [`2b36431`](https://github.com/langchain-ai/langchainjs/commit/2b36431babf0a4e4bc659c50659777c5228d3ac0) Thanks [@Nitinref](https://github.com/Nitinref)! - bump @modelcontextprotocol/sdk to address CVE-2025-66414

## 1.1.0

### Minor Changes

- [#9649](https://github.com/langchain-ai/langchainjs/pull/9649) [`66c1822`](https://github.com/langchain-ai/langchainjs/commit/66c1822370989a13a7b60fa409811ab2256ed682) Thanks [@hntrl](https://github.com/hntrl)! - add `onConnectionError` option

### Patch Changes

- [#9165](https://github.com/langchain-ai/langchainjs/pull/9165) [`2e5ad70`](https://github.com/langchain-ai/langchainjs/commit/2e5ad70d16c1f13eaaea95336bbe2ec4a4a4954a) Thanks [@pawel-twardziak](https://github.com/pawel-twardziak)! - fix(mcp-adapters): preserve timeout from RunnableConfig in MCP tool calls

## 1.0.3

### Patch Changes

- [#9525](https://github.com/langchain-ai/langchainjs/pull/9525) [`668d7aa`](https://github.com/langchain-ai/langchainjs/commit/668d7aaac0bf69781e7e6c1f42b73fef019ced44) Thanks [@christian-bromann](https://github.com/christian-bromann)! - fix(@langchain/mcp-adapters): resolve $defs/$ref in JSON schemas for Pydantic v2 compatibility

## 1.0.2

### Patch Changes

- [#9514](https://github.com/langchain-ai/langchainjs/pull/9514) [`6cecddf`](https://github.com/langchain-ai/langchainjs/commit/6cecddf07f3daa8c45a3da33f04759f8af0eec41) Thanks [@strowk](https://github.com/strowk)! - fix: pass cwd to mcp sdk correctly

## 1.0.1

### Patch Changes

- [#9416](https://github.com/langchain-ai/langchainjs/pull/9416) [`0fe9beb`](https://github.com/langchain-ai/langchainjs/commit/0fe9bebee6710f719e47f913eec1ec4f638e4de4) Thanks [@hntrl](https://github.com/hntrl)! - fix 'moduleResultion: "node"' compatibility

## 1.0.0

This release updates the package for compatibility with LangChain v1.0. See the v1.0 [release notes](https://docs.langchain.com/oss/javascript/releases/langchain-v1) for details on what's new.

## [0.1.7] - 2024-05-08

### Fixed

- Fixed SSE headers support to properly pass headers to eventsource
- Improved error handling for SSE connections
- Added proper support for Node.js eventsource library
- Fixed type errors in agent integration tests

### Added

- Improved test coverage to over 80%
- Added comprehensive error handling tests
- Added integration tests for different connection types

### Changed

- Updated ESLint configuration to properly exclude dist directory
- Improved build process to avoid linting errors

## [0.1.3] - 2023-03-11

### Changed

- Version bump to resolve npm publishing conflict
- Automated version management in GitHub Actions workflow

## [0.1.2] - 2023-03-10

### Added

- GitHub Actions workflows for PR validation, CI, and npm publishing
- Husky for Git hooks
- lint-staged for running linters on staged files
- Issue and PR templates
- CHANGELOG.md and CONTRIBUTING.md
- Improved npm publishing workflow with automatic version conflict resolution

### Fixed

- Fixed Husky deprecation warnings

## [0.1.0] - 2023-03-03

### Added

- Initial release
- Support for stdio and SSE transports
- MultiServerMCPClient for connecting to multiple MCP servers
- Configuration file support
- Examples for various use cases
- Integration with LangChain.js agents
