# @langchain/core

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
