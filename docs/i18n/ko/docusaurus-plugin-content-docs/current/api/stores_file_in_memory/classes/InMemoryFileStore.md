---
title: "InMemoryFileStore"
---

# InMemoryFileStore

## Hierarchy

- [`BaseFileStore`](../../schema/classes/BaseFileStore.md).**InMemoryFileStore**

## Constructors

### constructor()

> **new InMemoryFileStore**(): [`InMemoryFileStore`](InMemoryFileStore.md)

#### Returns

[`InMemoryFileStore`](InMemoryFileStore.md)

#### Inherited from

[BaseFileStore](../../schema/classes/BaseFileStore.md).[constructor](../../schema/classes/BaseFileStore.md#constructor)

## Methods

### readFile()

> **readFile**(`path`: `string`): `Promise`<`string`\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `path`    | `string` |

#### Returns

`Promise`<`string`\>

#### Overrides

[BaseFileStore](../../schema/classes/BaseFileStore.md).[readFile](../../schema/classes/BaseFileStore.md#readfile)

#### Defined in

[langchain/src/stores/file/in_memory.ts:6](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/stores/file/in_memory.ts#L6)

### writeFile()

> **writeFile**(`path`: `string`, `contents`: `string`): `Promise`<`void`\>

#### Parameters

| Parameter  | Type     |
| :--------- | :------- |
| `path`     | `string` |
| `contents` | `string` |

#### Returns

`Promise`<`void`\>

#### Overrides

[BaseFileStore](../../schema/classes/BaseFileStore.md).[writeFile](../../schema/classes/BaseFileStore.md#writefile)

#### Defined in

[langchain/src/stores/file/in_memory.ts:14](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/stores/file/in_memory.ts#L14)
