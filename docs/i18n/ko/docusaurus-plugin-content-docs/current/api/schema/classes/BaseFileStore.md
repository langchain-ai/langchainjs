---
title: "BaseFileStore"
---

# BaseFileStore

## Hierarchy

- [`InMemoryFileStore`](../../stores_file_in_memory/classes/InMemoryFileStore.md)
- [`NodeFileStore`](../../stores_file_node/classes/NodeFileStore.md)

## Constructors

### constructor()

> **new BaseFileStore**(): [`BaseFileStore`](BaseFileStore.md)

#### Returns

[`BaseFileStore`](BaseFileStore.md)

## Methods

### readFile()

> `Abstract` **readFile**(`path`: `string`): `Promise`<`string`\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `path`    | `string` |

#### Returns

`Promise`<`string`\>

#### Defined in

[langchain/src/schema/index.ts:161](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/schema/index.ts#L161)

### writeFile()

> `Abstract` **writeFile**(`path`: `string`, `contents`: `string`): `Promise`<`void`\>

#### Parameters

| Parameter  | Type     |
| :--------- | :------- |
| `path`     | `string` |
| `contents` | `string` |

#### Returns

`Promise`<`void`\>

#### Defined in

[langchain/src/schema/index.ts:163](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/schema/index.ts#L163)
