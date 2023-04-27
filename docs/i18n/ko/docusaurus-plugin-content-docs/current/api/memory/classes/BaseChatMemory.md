---
title: "BaseChatMemory"
---

# BaseChatMemory

## Hierarchy

- [`BaseMemory`](BaseMemory.md).**BaseChatMemory**

## Constructors

### constructor()

> **new BaseChatMemory**(`fields`?: [`BaseChatMemoryInput`](../interfaces/BaseChatMemoryInput.md)): [`BaseChatMemory`](BaseChatMemory.md)

#### Parameters

| Parameter | Type                                                          |
| :-------- | :------------------------------------------------------------ |
| `fields?` | [`BaseChatMemoryInput`](../interfaces/BaseChatMemoryInput.md) |

#### Returns

[`BaseChatMemory`](BaseChatMemory.md)

#### Overrides

[BaseMemory](BaseMemory.md).[constructor](BaseMemory.md#constructor)

#### Defined in

[langchain/src/memory/chat_memory.ts:26](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/chat_memory.ts#L26)

## Properties

### chatHistory

> **chatHistory**: [`BaseChatMessageHistory`](../../schema/classes/BaseChatMessageHistory.md)

#### Defined in

[langchain/src/memory/chat_memory.ts:18](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/chat_memory.ts#L18)

### returnMessages

> **returnMessages**: `boolean` = `false`

#### Defined in

[langchain/src/memory/chat_memory.ts:20](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/chat_memory.ts#L20)

### inputKey?

> **inputKey**: `string`

#### Defined in

[langchain/src/memory/chat_memory.ts:22](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/chat_memory.ts#L22)

### outputKey?

> **outputKey**: `string`

#### Defined in

[langchain/src/memory/chat_memory.ts:24](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/chat_memory.ts#L24)

## Accessors

### memoryKeys

> `Abstract` **memoryKeys**(): `string`[]

#### Returns

`string`[]

#### Inherited from

BaseMemory.memoryKeys

#### Defined in

[langchain/src/memory/base.ts:10](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/base.ts#L10)

#### Inherited from

[BaseMemory](BaseMemory.md).[memoryKeys](BaseMemory.md#memorykeys)

#### Defined in

[langchain/src/memory/base.ts:10](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/base.ts#L10)

## Methods

### clear()

> **clear**(): `Promise`<`void`\>

#### Returns

`Promise`<`void`\>

#### Defined in

[langchain/src/memory/chat_memory.ts:47](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/chat_memory.ts#L47)

### loadMemoryVariables()

> `Abstract` **loadMemoryVariables**(`values`: `InputValues`): `Promise`<`MemoryVariables`\>

#### Parameters

| Parameter | Type          |
| :-------- | :------------ |
| `values`  | `InputValues` |

#### Returns

`Promise`<`MemoryVariables`\>

#### Inherited from

[BaseMemory](BaseMemory.md).[loadMemoryVariables](BaseMemory.md#loadmemoryvariables)

#### Defined in

[langchain/src/memory/base.ts:12](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/base.ts#L12)

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

[BaseMemory](BaseMemory.md).[saveContext](BaseMemory.md#savecontext)

#### Defined in

[langchain/src/memory/chat_memory.ts:34](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/chat_memory.ts#L34)
