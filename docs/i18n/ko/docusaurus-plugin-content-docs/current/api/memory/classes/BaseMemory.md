---
title: "BaseMemory"
---

# BaseMemory

## Hierarchy

- [`BaseChatMemory`](BaseChatMemory.md)

## Constructors

### constructor()

> **new BaseMemory**(): [`BaseMemory`](BaseMemory.md)

#### Returns

[`BaseMemory`](BaseMemory.md)

## Accessors

### memoryKeys

> `Abstract` **memoryKeys**(): `string`[]

#### Returns

`string`[]

#### Defined in

[langchain/src/memory/base.ts:10](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/base.ts#L10)

#### Defined in

[langchain/src/memory/base.ts:10](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/base.ts#L10)

## Methods

### loadMemoryVariables()

> `Abstract` **loadMemoryVariables**(`values`: `InputValues`): `Promise`<`MemoryVariables`\>

#### Parameters

| Parameter | Type          |
| :-------- | :------------ |
| `values`  | `InputValues` |

#### Returns

`Promise`<`MemoryVariables`\>

#### Defined in

[langchain/src/memory/base.ts:12](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/base.ts#L12)

### saveContext()

> `Abstract` **saveContext**(`inputValues`: `InputValues`, `outputValues`: `OutputValues`): `Promise`<`void`\>

#### Parameters

| Parameter      | Type           |
| :------------- | :------------- |
| `inputValues`  | `InputValues`  |
| `outputValues` | `OutputValues` |

#### Returns

`Promise`<`void`\>

#### Defined in

[langchain/src/memory/base.ts:14](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/base.ts#L14)
