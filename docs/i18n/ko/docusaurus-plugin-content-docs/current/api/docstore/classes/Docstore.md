---
title: "Docstore"
---

# Docstore

## Hierarchy

- [`InMemoryDocstore`](InMemoryDocstore.md)

## Constructors

### constructor()

> **new Docstore**(): [`Docstore`](Docstore.md)

#### Returns

[`Docstore`](Docstore.md)

## Methods

### add()

> `Abstract` **add**(`texts`: `Record`<`string`, [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>\>): `void`

#### Parameters

| Parameter | Type                                                                                                  |
| :-------- | :---------------------------------------------------------------------------------------------------- |
| `texts`   | `Record`<`string`, [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>\> |

#### Returns

`void`

#### Defined in

[langchain/src/docstore/base.ts:6](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/docstore/base.ts#L6)

### search()

> `Abstract` **search**(`search`: `string`): `string` \| [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `search`  | `string` |

#### Returns

`string` \| [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>

#### Defined in

[langchain/src/docstore/base.ts:4](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/docstore/base.ts#L4)
