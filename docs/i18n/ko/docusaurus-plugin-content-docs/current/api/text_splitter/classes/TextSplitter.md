---
title: "TextSplitter"
---

# TextSplitter

## Hierarchy

- [`CharacterTextSplitter`](CharacterTextSplitter.md)
- [`RecursiveCharacterTextSplitter`](RecursiveCharacterTextSplitter.md)
- [`TokenTextSplitter`](TokenTextSplitter.md)

## Implements

- [`TextSplitterParams`](../interfaces/TextSplitterParams.md)

## Constructors

### constructor()

> **new TextSplitter**(`fields`?: `Partial`<[`TextSplitterParams`](../interfaces/TextSplitterParams.md)\>): [`TextSplitter`](TextSplitter.md)

#### Parameters

| Parameter | Type                                                                     |
| :-------- | :----------------------------------------------------------------------- |
| `fields?` | `Partial`<[`TextSplitterParams`](../interfaces/TextSplitterParams.md)\> |

#### Returns

[`TextSplitter`](TextSplitter.md)

#### Defined in

[langchain/src/text_splitter.ts:15](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/text_splitter.ts#L15)

## Properties

### chunkOverlap

> **chunkOverlap**: `number` = `200`

#### Implementation of

[TextSplitterParams](../interfaces/TextSplitterParams.md).[chunkOverlap](../interfaces/TextSplitterParams.md#chunkoverlap)

#### Defined in

[langchain/src/text_splitter.ts:13](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/text_splitter.ts#L13)

### chunkSize

> **chunkSize**: `number` = `1000`

#### Implementation of

[TextSplitterParams](../interfaces/TextSplitterParams.md).[chunkSize](../interfaces/TextSplitterParams.md#chunksize)

#### Defined in

[langchain/src/text_splitter.ts:11](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/text_splitter.ts#L11)

## Methods

### createDocuments()

> **createDocuments**(`texts`: `string`[], `metadatas`: `Record`<`string`, `any`\>[] = `[]`): `Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Parameters

| Parameter   | Type                          | Default value |
| :---------- | :---------------------------- | :------------ |
| `texts`     | `string`[]                    | `undefined`   |
| `metadatas` | `Record`<`string`, `any`\>[] | `[]`          |

#### Returns

`Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Defined in

[langchain/src/text_splitter.ts:25](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/text_splitter.ts#L25)

### mergeSplits()

> **mergeSplits**(`splits`: `string`[], `separator`: `string`): `string`[]

#### Parameters

| Parameter   | Type       |
| :---------- | :--------- |
| `splits`    | `string`[] |
| `separator` | `string`   |

#### Returns

`string`[]

#### Defined in

[langchain/src/text_splitter.ts:93](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/text_splitter.ts#L93)

### splitDocuments()

> **splitDocuments**(`documents`: [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]): `Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Parameters

| Parameter   | Type                                                                              |
| :---------- | :-------------------------------------------------------------------------------- |
| `documents` | [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[] |

#### Returns

`Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Defined in

[langchain/src/text_splitter.ts:79](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/text_splitter.ts#L79)

### splitText()

> `Abstract` **splitText**(`text`: `string`): `Promise`<`string`[]\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `text`    | `string` |

#### Returns

`Promise`<`string`[]\>

#### Defined in

[langchain/src/text_splitter.ts:23](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/text_splitter.ts#L23)
