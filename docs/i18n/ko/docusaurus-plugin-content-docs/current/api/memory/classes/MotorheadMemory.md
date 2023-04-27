---
title: "MotorheadMemory"
---

# MotorheadMemory

## Hierarchy

- [`BaseChatMemory`](BaseChatMemory.md).**MotorheadMemory**

## Constructors

### constructor()

> **new MotorheadMemory**(`fields`: [`MotorheadMemoryInput`](../interfaces/MotorheadMemoryInput.md)): [`MotorheadMemory`](MotorheadMemory.md)

#### Parameters

| Parameter | Type                                                            |
| :-------- | :-------------------------------------------------------------- |
| `fields`  | [`MotorheadMemoryInput`](../interfaces/MotorheadMemoryInput.md) |

#### Returns

[`MotorheadMemory`](MotorheadMemory.md)

#### Overrides

[BaseChatMemory](BaseChatMemory.md).[constructor](BaseChatMemory.md#constructor)

#### Defined in

[langchain/src/memory/motorhead_memory.ts:40](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/motorhead_memory.ts#L40)

## Properties

### caller

> **caller**: `AsyncCaller`

#### Defined in

[langchain/src/memory/motorhead_memory.ts:38](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/motorhead_memory.ts#L38)

### chatHistory

> **chatHistory**: [`BaseChatMessageHistory`](../../schema/classes/BaseChatMessageHistory.md)

#### Inherited from

[BaseChatMemory](BaseChatMemory.md).[chatHistory](BaseChatMemory.md#chathistory)

#### Defined in

[langchain/src/memory/chat_memory.ts:18](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/chat_memory.ts#L18)

### memoryKey

> **memoryKey**: `string` = `"history"`

#### Defined in

[langchain/src/memory/motorhead_memory.ts:32](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/motorhead_memory.ts#L32)

### motorheadURL

> **motorheadURL**: `string` = `"localhost:8080"`

#### Defined in

[langchain/src/memory/motorhead_memory.ts:28](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/motorhead_memory.ts#L28)

### returnMessages

> **returnMessages**: `boolean` = `false`

#### Inherited from

[BaseChatMemory](BaseChatMemory.md).[returnMessages](BaseChatMemory.md#returnmessages)

#### Defined in

[langchain/src/memory/chat_memory.ts:20](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/chat_memory.ts#L20)

### sessionId

> **sessionId**: `string`

#### Defined in

[langchain/src/memory/motorhead_memory.ts:34](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/motorhead_memory.ts#L34)

### timeout

> **timeout**: `number` = `3000`

#### Defined in

[langchain/src/memory/motorhead_memory.ts:30](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/motorhead_memory.ts#L30)

### context?

> **context**: `string`

#### Defined in

[langchain/src/memory/motorhead_memory.ts:36](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/motorhead_memory.ts#L36)

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

[langchain/src/memory/motorhead_memory.ts:61](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/motorhead_memory.ts#L61)

#### Overrides

[BaseChatMemory](BaseChatMemory.md).[memoryKeys](BaseChatMemory.md#memorykeys)

#### Defined in

[langchain/src/memory/motorhead_memory.ts:61](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/motorhead_memory.ts#L61)

## Methods

### clear()

> **clear**(): `Promise`<`void`\>

#### Returns

`Promise`<`void`\>

#### Inherited from

[BaseChatMemory](BaseChatMemory.md).[clear](BaseChatMemory.md#clear)

#### Defined in

[langchain/src/memory/chat_memory.ts:47](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/chat_memory.ts#L47)

### init()

> **init**(): `Promise`<`void`\>

#### Returns

`Promise`<`void`\>

#### Defined in

[langchain/src/memory/motorhead_memory.ts:65](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/motorhead_memory.ts#L65)

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

[langchain/src/memory/motorhead_memory.ts:94](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/motorhead_memory.ts#L94)

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

[langchain/src/memory/motorhead_memory.ts:108](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/motorhead_memory.ts#L108)
