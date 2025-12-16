# @langchain/core

## 1.1.6

### Patch Changes

- [#9668](https://github.com/langchain-ai/langchainjs/pull/9668) [`a7b2a7d`](https://github.com/langchain-ai/langchainjs/commit/a7b2a7db5ef57df3731ae6c9931f4b663e909505) Thanks [@bracesproul](https://github.com/bracesproul)! - fix: Cannot merge two undefined objects error

- [#9657](https://github.com/langchain-ai/langchainjs/pull/9657) [`a496c5f`](https://github.com/langchain-ai/langchainjs/commit/a496c5fc64d94cc0809216325b0f1bfde3f92c45) Thanks [@dqbd](https://github.com/dqbd)! - fix(core): avoid writing to TransformStream in EventStreamCallbackHandler when underlying ReadableStream is closed

- [#9658](https://github.com/langchain-ai/langchainjs/pull/9658) [`1da1325`](https://github.com/langchain-ai/langchainjs/commit/1da1325aea044fb37af54a9de1f4ae0b9f47d4a2) Thanks [@dqbd](https://github.com/dqbd)! - fix(core): ensure streaming test chat models respect AbortSignal

## 1.1.5

### Patch Changes

- [#9641](https://github.com/langchain-ai/langchainjs/pull/9641) [`005c729`](https://github.com/langchain-ai/langchainjs/commit/005c72903bcdf090e0f4c58960c8c243481f9874) Thanks [@christian-bromann](https://github.com/christian-bromann)! - fix(community/core): various security fixes

- [#7907](https://github.com/langchain-ai/langchainjs/pull/7907) [`ab78246`](https://github.com/langchain-ai/langchainjs/commit/ab782462753e6c3ae5d55c0c251f795af32929d5) Thanks [@jasonphillips](https://github.com/jasonphillips)! - fix(core): handle subgraph nesting better in graph_mermaid

- [#9589](https://github.com/langchain-ai/langchainjs/pull/9589) [`8cc81c7`](https://github.com/langchain-ai/langchainjs/commit/8cc81c7cee69530f7a6296c69123edbe227b2fce) Thanks [@nathannewyen](https://github.com/nathannewyen)! - test(core): add test for response_metadata in streamEvents

- [#9644](https://github.com/langchain-ai/langchainjs/pull/9644) [`f32e499`](https://github.com/langchain-ai/langchainjs/commit/f32e4991d0e707324e3f6af287a1ee87ab833b7e) Thanks [@hntrl](https://github.com/hntrl)! - add bindTools to FakeListChatModel

- [#9508](https://github.com/langchain-ai/langchainjs/pull/9508) [`a28d83d`](https://github.com/langchain-ai/langchainjs/commit/a28d83d49dd1fd31e67b52a44abc70f2cc2a2026) Thanks [@shubham-021](https://github.com/shubham-021)! - Fix toFormattedString() to properly display nested objects in tool call arguments instead of [object Object]

- [#9165](https://github.com/langchain-ai/langchainjs/pull/9165) [`2e5ad70`](https://github.com/langchain-ai/langchainjs/commit/2e5ad70d16c1f13eaaea95336bbe2ec4a4a4954a) Thanks [@pawel-twardziak](https://github.com/pawel-twardziak)! - fix(mcp-adapters): preserve timeout from RunnableConfig in MCP tool calls

- [#9647](https://github.com/langchain-ai/langchainjs/pull/9647) [`e456c66`](https://github.com/langchain-ai/langchainjs/commit/e456c661aa1ab8f1ed4a98c40616f5a13270e88e) Thanks [@hntrl](https://github.com/hntrl)! - handle missing parent runs in tracer to prevent LangSmith 400 errors

- [#9597](https://github.com/langchain-ai/langchainjs/pull/9597) [`1cfe603`](https://github.com/langchain-ai/langchainjs/commit/1cfe603e97d8711343ae5f1f5a75648e7bd2a16e) Thanks [@hntrl](https://github.com/hntrl)! - use uuid7 for run ids

## 1.1.4

### Patch Changes

- [#9575](https://github.com/langchain-ai/langchainjs/pull/9575) [`0bade90`](https://github.com/langchain-ai/langchainjs/commit/0bade90ed47c7988ed86f1e695a28273c7b3df50) Thanks [@hntrl](https://github.com/hntrl)! - bin p-retry

- [#9574](https://github.com/langchain-ai/langchainjs/pull/9574) [`6c40d00`](https://github.com/langchain-ai/langchainjs/commit/6c40d00e926f377d249c2919549381522eac8ed1) Thanks [@hntrl](https://github.com/hntrl)! - Revert "fix(@langchain/core): update and bundle dependencies (#9534)"

## 1.1.3

### Patch Changes

- [#9534](https://github.com/langchain-ai/langchainjs/pull/9534) [`bd2c46e`](https://github.com/langchain-ai/langchainjs/commit/bd2c46e09e661d9ac766c09e71bc6687d6fc811c) Thanks [@christian-bromann](https://github.com/christian-bromann)! - fix(@langchain/core): update and bundle `p-retry`, `ansi-styles`, `camelcase` and `decamelize` dependencies

- [#9544](https://github.com/langchain-ai/langchainjs/pull/9544) [`487378b`](https://github.com/langchain-ai/langchainjs/commit/487378bf14277659c8ca0ef06ea0f9836b818ff4) Thanks [@hntrl](https://github.com/hntrl)! - fix tool chunk concat behavior (#9450)

- [#9505](https://github.com/langchain-ai/langchainjs/pull/9505) [`138e7fb`](https://github.com/langchain-ai/langchainjs/commit/138e7fb6280705457079863bedb238b16b322032) Thanks [@chosh-dev](https://github.com/chosh-dev)! - feat: replace btoa with toBase64Url for encoding in drawMermaidImage

## 1.1.2

### Patch Changes

- [#9511](https://github.com/langchain-ai/langchainjs/pull/9511) [`833f578`](https://github.com/langchain-ai/langchainjs/commit/833f57834dc3aa64e4cfdd7499f865b2ab41462a) Thanks [@dqbd](https://github.com/dqbd)! - allow parsing more partial JSON

## 1.1.1

### Patch Changes

- [#9495](https://github.com/langchain-ai/langchainjs/pull/9495) [`636b994`](https://github.com/langchain-ai/langchainjs/commit/636b99459bf843362298866211c63a7a15c2a319) Thanks [@gsriram24](https://github.com/gsriram24)! - fix: use dynamic import for p-retry to support CommonJS environments

- [#9531](https://github.com/langchain-ai/langchainjs/pull/9531) [`38f0162`](https://github.com/langchain-ai/langchainjs/commit/38f0162b7b2db2be2c3a75ae468728adcb49fdfb) Thanks [@hntrl](https://github.com/hntrl)! - add `extras` to tools

## 1.1.0

### Minor Changes

- [#9475](https://github.com/langchain-ai/langchainjs/pull/9475) [`708d360`](https://github.com/langchain-ai/langchainjs/commit/708d360df1869def7e4caaa5995d6e907bbf54cd) Thanks [@christian-bromann](https://github.com/christian-bromann)! - allow to concat system messages

### Patch Changes

- [#9416](https://github.com/langchain-ai/langchainjs/pull/9416) [`0fe9beb`](https://github.com/langchain-ai/langchainjs/commit/0fe9bebee6710f719e47f913eec1ec4f638e4de4) Thanks [@hntrl](https://github.com/hntrl)! - fix 'moduleResultion: "node"' compatibility

- [#9463](https://github.com/langchain-ai/langchainjs/pull/9463) [`10fa2af`](https://github.com/langchain-ai/langchainjs/commit/10fa2afec0b81efd3467e61b59ba5c82e1043de5) Thanks [@christian-bromann](https://github.com/christian-bromann)! - fix(core): update p-retry to fix memory leak

## 1.0.6

### Patch Changes

- [#9431](https://github.com/langchain-ai/langchainjs/pull/9431) [`5709cb6`](https://github.com/langchain-ai/langchainjs/commit/5709cb64cc3e4eb300bde5ec8ae90686d2aa3d8e) Thanks [@dqbd](https://github.com/dqbd)! - fix(core): `store` should be accessible from tools

## 1.0.5

### Patch Changes

- [#9308](https://github.com/langchain-ai/langchainjs/pull/9308) [`04bd55c`](https://github.com/langchain-ai/langchainjs/commit/04bd55c63d8a0cb56f85da0b61a6bd6169b383f3) Thanks [@ro0sterjam](https://github.com/ro0sterjam)! - respect JSON schema references in interopZodTransformInputSchema

- [#9387](https://github.com/langchain-ai/langchainjs/pull/9387) [`ac0d4fe`](https://github.com/langchain-ai/langchainjs/commit/ac0d4fe3807e05eb2185ae8a36da69498e6163d4) Thanks [@hntrl](https://github.com/hntrl)! - Add `ModelProfile` and `.profile` properties to ChatModel

## 1.0.4

### Patch Changes

- 8319201: Export standard converter function utility

## 1.0.3

### Patch Changes

- 0a8a23b: feat(@langchain/core): support of ToolRuntime

## 1.0.2

### Patch Changes

- 6426eb6: fix chunks constructed with tool calls + chunks
- 619ae64: Add `BaseMessage.toFormattedString()`

## 1.0.1

### Patch changes

- cacc137: remove bad import map exports

## 1.0.0

🎉 **LangChain v1.0** is here! This release provides a focused, production-ready foundation for building agents with significant improvements to the core abstractions and APIs. See the [release notes](https://docs.langchain.com/oss/javascript/releases/langchain-v1) for more details.

### ✨ Major Features

#### Standard content blocks

A new unified API for accessing modern LLM features across all providers:

- **New `contentBlocks` property**: Provides provider-agnostic access to reasoning traces, citations, built-in tools (web search, code interpreters, etc.), and other advanced LLM features
- **Type-safe**: Full TypeScript support with type hints for all content block types
- **Backward compatible**: Content blocks can be loaded lazily with no breaking changes to existing code

Example:

```typescript
const response = await model.invoke([
  { role: "user", content: "What is the weather in Tokyo?" },
]);

// Access structured content blocks
for (const block of response.contentBlocks) {
  if (block.type === "thinking") {
    console.log("Model reasoning:", block.thinking);
  } else if (block.type === "text") {
    console.log("Response:", block.text);
  }
}
```

For more information, see our guide on [content blocks](https://docs.langchain.com/oss/javascript/langchain/messages#content).

#### Enhanced Message API

Improvements to the core message types:

- **Structured content**: Better support for multimodal content with the new content blocks API
- **Provider compatibility**: Consistent message format across all LLM providers
- **Rich metadata**: Enhanced metadata support for tracking message provenance and transformations

### 🔧 Improvements

- **Better structured output generation**: Core abstractions for generating structured outputs in the main agent loop
- **Improved type safety**: Enhanced TypeScript definitions across all core abstractions
- **Performance optimizations**: Reduced overhead in message processing and runnable composition
- **Better error handling**: More informative error messages and better error recovery

### 📦 Package Changes

The `@langchain/core` package remains focused on essential abstractions:

- Core message types and content blocks
- Base runnable abstractions
- Tool definitions and schemas
- Middleware infrastructure
- Callback system
- Output parsers
- Prompt templates

### 🔄 Migration Notes

**Backward Compatibility**: This release maintains backward compatibility with existing code. Content blocks are loaded lazily, so no changes are required to existing applications.

**New Features**: To take advantage of new features like content blocks and middleware:

1. Update to `@langchain/core@next`:

   ```bash
   npm install @langchain/core@1.0.0
   ```

2. Use the new `contentBlocks` property to access rich content:

   ```typescript
   const response = await model.invoke(messages);
   console.log(response.contentBlocks); // New API
   console.log(response.content); // Legacy API still works
   ```

3. For middleware and `createAgent`, install `langchain@next`:

   ```bash
   npm install langchain@1.0.0 @langchain/core@1.0.0
   ```

### 📚 Additional Resources

- [LangChain 1.0 Announcement](https://blog.langchain.com/langchain-langchain-1-0-alpha-releases/)
- [Migration Guide](https://docs.langchain.com/oss/javascript/migrate/langchain-v1)
- [Content Blocks Documentation](https://docs.langchain.com/oss/javascript/langchain/messages#content)
- [Agents Documentation](https://docs.langchain.com/oss/javascript/langchain/agents)

---

## 0.3.79

### Patch Changes

- 1063b43: fix chunks constructed with tool calls + chunks

## 0.3.78

### Patch Changes

- 1519a97: update chunk concat logic to match on missing ID fields
- 079e11d: omit tool call chunks without tool call id

## 0.3.76

### Patch Changes

- 41bd944: support base64 embeddings format
- e90bc0a: fix(core): prevent tool call chunks from merging incorrectly in AIMes…
- 3a99a40: Fix deserialization of RemoveMessage if represented as a plain object
- 58e9522: make mustache prompt with nested object working correctly
- e44dc1b: handle backticks in structured output

## 0.3.75

### Patch Changes

- d6d841f: fix(core): Fix deep nesting of runnables within traceables

## 0.3.74

### Patch Changes

- 4e53005: fix(core): Always inherit parent run id onto callback manager from context

## 0.3.73

### Patch Changes

- a5a2e10: add root export to satisfy bundler requirements
