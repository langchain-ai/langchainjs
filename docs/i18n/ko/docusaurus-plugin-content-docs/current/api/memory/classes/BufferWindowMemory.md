---
title: "BufferWindowMemory"
---

# BufferWindowMemory

## Hierarchy

- [`BaseChatMemory`](BaseChatMemory.md).**BufferWindowMemory**

## Implements

- [`BufferWindowMemoryInput`](../interfaces/BufferWindowMemoryInput.md)

## Constructors

### constructor()

> **new BufferWindowMemory**(`fields`?: [`BufferWindowMemoryInput`](../interfaces/BufferWindowMemoryInput.md)): [`BufferWindowMemory`](BufferWindowMemory.md)

#### Parameters

| Parameter | Type                                                                  |
| :-------- | :-------------------------------------------------------------------- |
| `fields?` | [`BufferWindowMemoryInput`](../interfaces/BufferWindowMemoryInput.md) |

#### Returns

[`BufferWindowMemory`](BufferWindowMemory.md)

#### Overrides

[BaseChatMemory](BaseChatMemory.md).[constructor](BaseChatMemory.md#constructor)

#### Defined in

[langchain/src/memory/buffer_window_memory.ts:24](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/buffer_window_memory.ts#L24)

## Properties

### aiPrefix

> **aiPrefix**: `string` = `"AI"`

#### Implementation of

[BufferWindowMemoryInput](../interfaces/BufferWindowMemoryInput.md).[aiPrefix](../interfaces/BufferWindowMemoryInput.md#aiprefix)

#### Defined in

[langchain/src/memory/buffer_window_memory.ts:18](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/buffer_window_memory.ts#L18)

### chatHistory

> **chatHistory**: [`BaseChatMessageHistory`](../../schema/classes/BaseChatMessageHistory.md)

#### Implementation of

[BufferWindowMemoryInput](../interfaces/BufferWindowMemoryInput.md).[chatHistory](../interfaces/BufferWindowMemoryInput.md#chathistory)

#### Inherited from

[BaseChatMemory](BaseChatMemory.md).[chatHistory](BaseChatMemory.md#chathistory)

#### Defined in

[langchain/src/memory/chat_memory.ts:18](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/chat_memory.ts#L18)

### humanPrefix

> **humanPrefix**: `string` = `"Human"`

#### Implementation of

[BufferWindowMemoryInput](../interfaces/BufferWindowMemoryInput.md).[humanPrefix](../interfaces/BufferWindowMemoryInput.md#humanprefix)

#### Defined in

[langchain/src/memory/buffer_window_memory.ts:16](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/buffer_window_memory.ts#L16)

### k

> **k**: `number` = `5`

#### Implementation of

[BufferWindowMemoryInput](../interfaces/BufferWindowMemoryInput.md).[k](../interfaces/BufferWindowMemoryInput.md#k)

#### Defined in

[langchain/src/memory/buffer_window_memory.ts:22](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/buffer_window_memory.ts#L22)

### memoryKey

> **memoryKey**: `string` = `"history"`

#### Implementation of

[BufferWindowMemoryInput](../interfaces/BufferWindowMemoryInput.md).[memoryKey](../interfaces/BufferWindowMemoryInput.md#memorykey)

#### Defined in

[langchain/src/memory/buffer_window_memory.ts:20](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/buffer_window_memory.ts#L20)

### returnMessages

> **returnMessages**: `boolean` = `false`

#### Implementation of

[BufferWindowMemoryInput](../interfaces/BufferWindowMemoryInput.md).[returnMessages](../interfaces/BufferWindowMemoryInput.md#returnmessages)

#### Inherited from

[BaseChatMemory](BaseChatMemory.md).[returnMessages](BaseChatMemory.md#returnmessages)

#### Defined in

[langchain/src/memory/chat_memory.ts:20](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/chat_memory.ts#L20)

### inputKey?

> **inputKey**: `string`

#### Implementation of

[BufferWindowMemoryInput](../interfaces/BufferWindowMemoryInput.md).[inputKey](../interfaces/BufferWindowMemoryInput.md#inputkey)

#### Inherited from

[BaseChatMemory](BaseChatMemory.md).[inputKey](BaseChatMemory.md#inputkey)

#### Defined in

[langchain/src/memory/chat_memory.ts:22](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/chat_memory.ts#L22)

### outputKey?

> **outputKey**: `string`

#### Implementation of

[BufferWindowMemoryInput](../interfaces/BufferWindowMemoryInput.md).[outputKey](../interfaces/BufferWindowMemoryInput.md#outputkey)

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

[langchain/src/memory/buffer_window_memory.ts:35](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/buffer_window_memory.ts#L35)

#### Overrides

[BaseChatMemory](BaseChatMemory.md).[memoryKeys](BaseChatMemory.md#memorykeys)

#### Defined in

[langchain/src/memory/buffer_window_memory.ts:35](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/buffer_window_memory.ts#L35)

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

[langchain/src/memory/buffer_window_memory.ts:39](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/buffer_window_memory.ts#L39)

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
