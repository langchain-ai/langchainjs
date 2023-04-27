---
title: "NodeFileStore"
---

# NodeFileStore

## Hierarchy

- [`BaseFileStore`](../../schema/classes/BaseFileStore.md).**NodeFileStore**

## Constructors

### constructor()

> **new NodeFileStore**(`basePath`: `string` = `...`): [`NodeFileStore`](NodeFileStore.md)

#### Parameters

| Parameter  | Type     |
| :--------- | :------- |
| `basePath` | `string` |

#### Returns

[`NodeFileStore`](NodeFileStore.md)

#### Overrides

[BaseFileStore](../../schema/classes/BaseFileStore.md).[constructor](../../schema/classes/BaseFileStore.md#constructor)

#### Defined in

[langchain/src/stores/file/node.ts:8](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/stores/file/node.ts#L8)

## Properties

### basePath

> **basePath**: `string`

#### Defined in

[langchain/src/stores/file/node.ts:8](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/stores/file/node.ts#L8)

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

[langchain/src/stores/file/node.ts:12](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/stores/file/node.ts#L12)

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

[langchain/src/stores/file/node.ts:16](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/stores/file/node.ts#L16)
