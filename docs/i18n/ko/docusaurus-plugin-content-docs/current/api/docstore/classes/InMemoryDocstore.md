---
title: "InMemoryDocstore"
---

# InMemoryDocstore

## Hierarchy

- [`Docstore`](Docstore.md).**InMemoryDocstore**

## Constructors

### constructor()

> **new InMemoryDocstore**(`docs`?: `Map`<`string`, [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>\>): [`InMemoryDocstore`](InMemoryDocstore.md)

#### Parameters

| Parameter | Type                                                                                               |
| :-------- | :------------------------------------------------------------------------------------------------- |
| `docs?`   | `Map`<`string`, [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>\> |

#### Returns

[`InMemoryDocstore`](InMemoryDocstore.md)

#### Overrides

[Docstore](Docstore.md).[constructor](Docstore.md#constructor)

#### Defined in

[langchain/src/docstore/in_memory.ts:7](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/docstore/in_memory.ts#L7)

## Properties

### \_docs

> **\_docs**: `Map`<`string`, [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>\>

#### Defined in

[langchain/src/docstore/in_memory.ts:5](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/docstore/in_memory.ts#L5)

## Accessors

### count

Method for getting count of documents in \_docs

> **count**(): `number`

#### Returns

`number`

#### Defined in

[langchain/src/docstore/in_memory.ts:13](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/docstore/in_memory.ts#L13)

#### Defined in

[langchain/src/docstore/in_memory.ts:13](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/docstore/in_memory.ts#L13)

## Methods

### add()

> **add**(`texts`: `Record`<`string`, [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>\>): `void`

#### Parameters

| Parameter | Type                                                                                                  |
| :-------- | :---------------------------------------------------------------------------------------------------- |
| `texts`   | `Record`<`string`, [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>\> |

#### Returns

`void`

#### Overrides

[Docstore](Docstore.md).[add](Docstore.md#add)

#### Defined in

[langchain/src/docstore/in_memory.ts:21](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/docstore/in_memory.ts#L21)

### search()

> **search**(`search`: `string`): `string` \| [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `search`  | `string` |

#### Returns

`string` \| [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>

#### Overrides

[Docstore](Docstore.md).[search](Docstore.md#search)

#### Defined in

[langchain/src/docstore/in_memory.ts:17](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/docstore/in_memory.ts#L17)
