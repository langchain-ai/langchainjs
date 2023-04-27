---
title: "MotorheadMemoryInput"
---

# MotorheadMemoryInput

## Properties

### sessionId

> **sessionId**: `string`

#### Defined in

[langchain/src/memory/motorhead_memory.ts:21](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/motorhead_memory.ts#L21)

### chatHistory?

> **chatHistory**: [`BaseChatMessageHistory`](../../schema/classes/BaseChatMessageHistory.md)

#### Defined in

[langchain/src/memory/chat_memory.ts:11](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/chat_memory.ts#L11)

### inputKey?

> **inputKey**: `string`

#### Defined in

[langchain/src/memory/chat_memory.ts:13](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/chat_memory.ts#L13)

### maxConcurrency?

> **maxConcurrency**: `number`

The maximum number of concurrent calls that can be made.
Defaults to `Infinity`, which means no limit.

#### Defined in

[langchain/src/util/async_caller.ts:21](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/util/async_caller.ts#L21)

### maxRetries?

> **maxRetries**: `number`

The maximum number of retries that can be made for a single call,
with an exponential backoff between each attempt. Defaults to 6.

#### Defined in

[langchain/src/util/async_caller.ts:26](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/util/async_caller.ts#L26)

### memoryKey?

> **memoryKey**: `string`

#### Defined in

[langchain/src/memory/motorhead_memory.ts:23](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/motorhead_memory.ts#L23)

### motorheadURL?

> **motorheadURL**: `string`

#### Defined in

[langchain/src/memory/motorhead_memory.ts:22](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/motorhead_memory.ts#L22)

### outputKey?

> **outputKey**: `string`

#### Defined in

[langchain/src/memory/chat_memory.ts:14](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/chat_memory.ts#L14)

### returnMessages?

> **returnMessages**: `boolean`

#### Defined in

[langchain/src/memory/chat_memory.ts:12](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/chat_memory.ts#L12)

### timeout?

> **timeout**: `number`

#### Defined in

[langchain/src/memory/motorhead_memory.ts:24](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/motorhead_memory.ts#L24)
