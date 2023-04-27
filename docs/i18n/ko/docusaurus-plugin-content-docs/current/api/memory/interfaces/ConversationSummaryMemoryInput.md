---
title: "ConversationSummaryMemoryInput"
---

# ConversationSummaryMemoryInput

## Hierarchy

- [`BaseChatMemoryInput`](BaseChatMemoryInput.md).**ConversationSummaryMemoryInput**

## Properties

### llm

> **llm**: [`BaseLanguageModel`](../../base_language/classes/BaseLanguageModel.md)

#### Defined in

[langchain/src/memory/summary.ts:15](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/summary.ts#L15)

### aiPrefix?

> **aiPrefix**: `string`

#### Defined in

[langchain/src/memory/summary.ts:18](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/summary.ts#L18)

### chatHistory?

> **chatHistory**: [`BaseChatMessageHistory`](../../schema/classes/BaseChatMessageHistory.md)

#### Inherited from

[BaseChatMemoryInput](BaseChatMemoryInput.md).[chatHistory](BaseChatMemoryInput.md#chathistory)

#### Defined in

[langchain/src/memory/chat_memory.ts:11](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/chat_memory.ts#L11)

### humanPrefix?

> **humanPrefix**: `string`

#### Defined in

[langchain/src/memory/summary.ts:17](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/summary.ts#L17)

### inputKey?

> **inputKey**: `string`

#### Inherited from

[BaseChatMemoryInput](BaseChatMemoryInput.md).[inputKey](BaseChatMemoryInput.md#inputkey)

#### Defined in

[langchain/src/memory/chat_memory.ts:13](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/chat_memory.ts#L13)

### memoryKey?

> **memoryKey**: `string`

#### Defined in

[langchain/src/memory/summary.ts:16](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/summary.ts#L16)

### outputKey?

> **outputKey**: `string`

#### Inherited from

[BaseChatMemoryInput](BaseChatMemoryInput.md).[outputKey](BaseChatMemoryInput.md#outputkey)

#### Defined in

[langchain/src/memory/chat_memory.ts:14](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/chat_memory.ts#L14)

### prompt?

> **prompt**: [`BasePromptTemplate`](../../prompts/classes/BasePromptTemplate.md)

#### Defined in

[langchain/src/memory/summary.ts:19](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/summary.ts#L19)

### returnMessages?

> **returnMessages**: `boolean`

#### Inherited from

[BaseChatMemoryInput](BaseChatMemoryInput.md).[returnMessages](BaseChatMemoryInput.md#returnmessages)

#### Defined in

[langchain/src/memory/chat_memory.ts:12](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/chat_memory.ts#L12)

### summaryChatMessageClass?

> **summaryChatMessageClass**: `Function`

#### Type declaration

> **new summaryChatMessageClass**(`content`: `string`): [`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)

##### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `content` | `string` |

##### Returns

[`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)

#### Defined in

[langchain/src/memory/summary.ts:20](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/summary.ts#L20)
