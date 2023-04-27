---
title: "BufferMemory"
---

# BufferMemory

## Hierarchy

- [`BaseChatMemory`](BaseChatMemory.md).**BufferMemory**

## Implements

- [`BufferMemoryInput`](../interfaces/BufferMemoryInput.md)

## Constructors

### constructor()

> **new BufferMemory**(`fields`?: [`BufferMemoryInput`](../interfaces/BufferMemoryInput.md)): [`BufferMemory`](BufferMemory.md)

#### Parameters

| Parameter | Type                                                      |
| :-------- | :-------------------------------------------------------- |
| `fields?` | [`BufferMemoryInput`](../interfaces/BufferMemoryInput.md) |

#### Returns

[`BufferMemory`](BufferMemory.md)

#### Overrides

[BaseChatMemory](BaseChatMemory.md).[constructor](BaseChatMemory.md#constructor)

#### Defined in

[langchain/src/memory/buffer_memory.ts:17](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/buffer_memory.ts#L17)

## Properties

### aiPrefix

> **aiPrefix**: `string` = `"AI"`

#### Implementation of

[BufferMemoryInput](../interfaces/BufferMemoryInput.md).[aiPrefix](../interfaces/BufferMemoryInput.md#aiprefix)

#### Defined in

[langchain/src/memory/buffer_memory.ts:13](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/buffer_memory.ts#L13)

### chatHistory

> **chatHistory**: [`BaseChatMessageHistory`](../../schema/classes/BaseChatMessageHistory.md)

#### Implementation of

[BufferMemoryInput](../interfaces/BufferMemoryInput.md).[chatHistory](../interfaces/BufferMemoryInput.md#chathistory)

#### Inherited from

[BaseChatMemory](BaseChatMemory.md).[chatHistory](BaseChatMemory.md#chathistory)

#### Defined in

[langchain/src/memory/chat_memory.ts:18](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/chat_memory.ts#L18)

### humanPrefix

> **humanPrefix**: `string` = `"Human"`

#### Implementation of

[BufferMemoryInput](../interfaces/BufferMemoryInput.md).[humanPrefix](../interfaces/BufferMemoryInput.md#humanprefix)

#### Defined in

[langchain/src/memory/buffer_memory.ts:11](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/buffer_memory.ts#L11)

### memoryKey

> **memoryKey**: `string` = `"history"`

#### Implementation of

[BufferMemoryInput](../interfaces/BufferMemoryInput.md).[memoryKey](../interfaces/BufferMemoryInput.md#memorykey)

#### Defined in

[langchain/src/memory/buffer_memory.ts:15](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/buffer_memory.ts#L15)

### returnMessages

> **returnMessages**: `boolean` = `false`

#### Implementation of

[BufferMemoryInput](../interfaces/BufferMemoryInput.md).[returnMessages](../interfaces/BufferMemoryInput.md#returnmessages)

#### Inherited from

[BaseChatMemory](BaseChatMemory.md).[returnMessages](BaseChatMemory.md#returnmessages)

#### Defined in

[langchain/src/memory/chat_memory.ts:20](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/chat_memory.ts#L20)

### inputKey?

> **inputKey**: `string`

#### Implementation of

[BufferMemoryInput](../interfaces/BufferMemoryInput.md).[inputKey](../interfaces/BufferMemoryInput.md#inputkey)

#### Inherited from

[BaseChatMemory](BaseChatMemory.md).[inputKey](BaseChatMemory.md#inputkey)

#### Defined in

[langchain/src/memory/chat_memory.ts:22](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/chat_memory.ts#L22)

### outputKey?

> **outputKey**: `string`

#### Implementation of

[BufferMemoryInput](../interfaces/BufferMemoryInput.md).[outputKey](../interfaces/BufferMemoryInput.md#outputkey)

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

[langchain/src/memory/buffer_memory.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/buffer_memory.ts#L29)

#### Overrides

[BaseChatMemory](BaseChatMemory.md).[memoryKeys](BaseChatMemory.md#memorykeys)

#### Defined in

[langchain/src/memory/buffer_memory.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/buffer_memory.ts#L29)

## Methods

### clear()

> **clear**(): `Promise`<`void`\>

#### Returns

`Promise`<`void`\>

#### Inherited from

[BaseChatMemory](BaseChatMemory.md).[clear](BaseChatMemory.md#clear)

#### Defined in

[langchain/src/memory/chat_memory.ts:47](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/chat_memory.ts#L47)

### loadMemoryVariables()

> **loadMemoryVariables**(`_values`: `InputValues`): `Promise`<`MemoryVariables`\>

#### Parameters

| Parameter | Type          |
| :-------- | :------------ |
| `_values` | `InputValues` |

#### Returns

`Promise`<`MemoryVariables`\>

#### Overrides

[BaseChatMemory](BaseChatMemory.md).[loadMemoryVariables](BaseChatMemory.md#loadmemoryvariables)

#### Defined in

[langchain/src/memory/buffer_memory.ts:33](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/buffer_memory.ts#L33)

### saveContext()

> **saveContext**(`inputValues`: `InputValues`, `outputValues`: `OutputValues`): `Promise`<`void`\>

#### Parameters

| Parameter      | Type           |
| :------------- | :------------- |
| `inputValues`  | `InputValues`  |
| `outputValues` | `OutputValues` |

#### Returns

`Promise`<`void`\>

#### Inherited from

[BaseChatMemory](BaseChatMemory.md).[saveContext](BaseChatMemory.md#savecontext)

#### Defined in

[langchain/src/memory/chat_memory.ts:34](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/chat_memory.ts#L34)
