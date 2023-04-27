---
title: "ConversationSummaryMemory"
---

# ConversationSummaryMemory

## Hierarchy

- [`BaseChatMemory`](BaseChatMemory.md).**ConversationSummaryMemory**

## Constructors

### constructor()

> **new ConversationSummaryMemory**(`fields`: [`ConversationSummaryMemoryInput`](../interfaces/ConversationSummaryMemoryInput.md)): [`ConversationSummaryMemory`](ConversationSummaryMemory.md)

#### Parameters

| Parameter | Type                                                                                |
| :-------- | :---------------------------------------------------------------------------------- |
| `fields`  | [`ConversationSummaryMemoryInput`](../interfaces/ConversationSummaryMemoryInput.md) |

#### Returns

[`ConversationSummaryMemory`](ConversationSummaryMemory.md)

#### Overrides

[BaseChatMemory](BaseChatMemory.md).[constructor](BaseChatMemory.md#constructor)

#### Defined in

[langchain/src/memory/summary.ts:39](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/summary.ts#L39)

## Properties

### aiPrefix

> **aiPrefix**: `string` = `"AI"`

#### Defined in

[langchain/src/memory/summary.ts:30](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/summary.ts#L30)

### buffer

> **buffer**: `string` = `""`

#### Defined in

[langchain/src/memory/summary.ts:24](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/summary.ts#L24)

### chatHistory

> **chatHistory**: [`BaseChatMessageHistory`](../../schema/classes/BaseChatMessageHistory.md)

#### Inherited from

[BaseChatMemory](BaseChatMemory.md).[chatHistory](BaseChatMemory.md#chathistory)

#### Defined in

[langchain/src/memory/chat_memory.ts:18](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/chat_memory.ts#L18)

### humanPrefix

> **humanPrefix**: `string` = `"Human"`

#### Defined in

[langchain/src/memory/summary.ts:28](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/summary.ts#L28)

### llm

> **llm**: [`BaseLanguageModel`](../../base_language/classes/BaseLanguageModel.md)

#### Defined in

[langchain/src/memory/summary.ts:32](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/summary.ts#L32)

### memoryKey

> **memoryKey**: `string` = `"history"`

#### Defined in

[langchain/src/memory/summary.ts:26](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/summary.ts#L26)

### prompt

> **prompt**: [`BasePromptTemplate`](../../prompts/classes/BasePromptTemplate.md) = `SUMMARY_PROMPT`

#### Defined in

[langchain/src/memory/summary.ts:34](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/summary.ts#L34)

### returnMessages

> **returnMessages**: `boolean` = `false`

#### Inherited from

[BaseChatMemory](BaseChatMemory.md).[returnMessages](BaseChatMemory.md#returnmessages)

#### Defined in

[langchain/src/memory/chat_memory.ts:20](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/chat_memory.ts#L20)

### summaryChatMessageClass

> **summaryChatMessageClass**: `Function` = `SystemChatMessage`

#### Type declaration

> **new summaryChatMessageClass**(`content`: `string`): [`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)

##### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `content` | `string` |

##### Returns

[`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)

#### Defined in

[langchain/src/memory/summary.ts:36](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/summary.ts#L36)

### inputKey?

> **inputKey**: `string`

#### Inherited from

[BaseChatMemory](BaseChatMemory.md).[inputKey](BaseChatMemory.md#inputkey)

#### Defined in

[langchain/src/memory/chat_memory.ts:22](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/chat_memory.ts#L22)

### outputKey?

> **outputKey**: `string`

#### Inherited from

[BaseChatMemory](BaseChatMemory.md).[outputKey](BaseChatMemory.md#outputkey)

#### Defined in

[langchain/src/memory/chat_memory.ts:24](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/chat_memory.ts#L24)

## Accessors

### memoryKeys

> **memoryKeys**(): `string`[]

#### Returns

`string`[]

#### Overrides

BaseChatMemory.memoryKeys

#### Defined in

[langchain/src/memory/summary.ts:63](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/summary.ts#L63)

#### Overrides

[BaseChatMemory](BaseChatMemory.md).[memoryKeys](BaseChatMemory.md#memorykeys)

#### Defined in

[langchain/src/memory/summary.ts:63](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/summary.ts#L63)

## Methods

### clear()

> **clear**(): `Promise`<`void`\>

#### Returns

`Promise`<`void`\>

#### Overrides

[BaseChatMemory](BaseChatMemory.md).[clear](BaseChatMemory.md#clear)

#### Defined in

[langchain/src/memory/summary.ts:99](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/summary.ts#L99)

### loadMemoryVariables()

> **loadMemoryVariables**(`_`: `InputValues`): `Promise`<`MemoryVariables`\>

#### Parameters

| Parameter | Type          |
| :-------- | :------------ |
| `_`       | `InputValues` |

#### Returns

`Promise`<`MemoryVariables`\>

#### Overrides

[BaseChatMemory](BaseChatMemory.md).[loadMemoryVariables](BaseChatMemory.md#loadmemoryvariables)

#### Defined in

[langchain/src/memory/summary.ts:79](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/summary.ts#L79)

### predictNewSummary()

> **predictNewSummary**(`messages`: [`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)[], `existingSummary`: `string`): `Promise`<`string`\>

#### Parameters

| Parameter         | Type                                                           |
| :---------------- | :------------------------------------------------------------- |
| `messages`        | [`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)[] |
| `existingSummary` | `string`                                                       |

#### Returns

`Promise`<`string`\>

#### Defined in

[langchain/src/memory/summary.ts:67](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/summary.ts#L67)

### saveContext()

> **saveContext**(`inputValues`: `InputValues`, `outputValues`: `OutputValues`): `Promise`<`void`\>

#### Parameters

| Parameter      | Type           |
| :------------- | :------------- |
| `inputValues`  | `InputValues`  |
| `outputValues` | `OutputValues` |

#### Returns

`Promise`<`void`\>

#### Overrides

[BaseChatMemory](BaseChatMemory.md).[saveContext](BaseChatMemory.md#savecontext)

#### Defined in

[langchain/src/memory/summary.ts:90](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/summary.ts#L90)
