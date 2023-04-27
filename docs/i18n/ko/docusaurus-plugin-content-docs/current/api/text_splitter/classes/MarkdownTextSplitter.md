---
title: "MarkdownTextSplitter"
---

# MarkdownTextSplitter

## Hierarchy

- [`RecursiveCharacterTextSplitter`](RecursiveCharacterTextSplitter.md).**MarkdownTextSplitter**

## Implements

- [`MarkdownTextSplitterParams`](../types/MarkdownTextSplitterParams.md)

## Constructors

### constructor()

> **new MarkdownTextSplitter**(`fields`?: `Partial`<[`TextSplitterParams`](../interfaces/TextSplitterParams.md)\>): [`MarkdownTextSplitter`](MarkdownTextSplitter.md)

#### Parameters

| Parameter | Type                                                                     |
| :-------- | :----------------------------------------------------------------------- |
| `fields?` | `Partial`<[`TextSplitterParams`](../interfaces/TextSplitterParams.md)\> |

#### Returns

[`MarkdownTextSplitter`](MarkdownTextSplitter.md)

#### Overrides

[RecursiveCharacterTextSplitter](RecursiveCharacterTextSplitter.md).[constructor](RecursiveCharacterTextSplitter.md#constructor)

#### Defined in

[langchain/src/text_splitter.ts:332](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/text_splitter.ts#L332)

## Properties

### chunkOverlap

> **chunkOverlap**: `number` = `200`

#### Implementation of

MarkdownTextSplitterParams.chunkOverlap

#### Inherited from

[RecursiveCharacterTextSplitter](RecursiveCharacterTextSplitter.md).[chunkOverlap](RecursiveCharacterTextSplitter.md#chunkoverlap)

#### Defined in

[langchain/src/text_splitter.ts:13](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/text_splitter.ts#L13)

### chunkSize

> **chunkSize**: `number` = `1000`

#### Implementation of

MarkdownTextSplitterParams.chunkSize

#### Inherited from

[RecursiveCharacterTextSplitter](RecursiveCharacterTextSplitter.md).[chunkSize](RecursiveCharacterTextSplitter.md#chunksize)

#### Defined in

[langchain/src/text_splitter.ts:11](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/text_splitter.ts#L11)

### separators

> **separators**: `string`[]

#### Overrides

[RecursiveCharacterTextSplitter](RecursiveCharacterTextSplitter.md).[separators](RecursiveCharacterTextSplitter.md#separators)

#### Defined in

[langchain/src/text_splitter.ts:308](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/text_splitter.ts#L308)

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

#### Inherited from

[RecursiveCharacterTextSplitter](RecursiveCharacterTextSplitter.md).[createDocuments](RecursiveCharacterTextSplitter.md#createdocuments)

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

#### Inherited from

[RecursiveCharacterTextSplitter](RecursiveCharacterTextSplitter.md).[mergeSplits](RecursiveCharacterTextSplitter.md#mergesplits)

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

#### Inherited from

[RecursiveCharacterTextSplitter](RecursiveCharacterTextSplitter.md).[splitDocuments](RecursiveCharacterTextSplitter.md#splitdocuments)

#### Defined in

[langchain/src/text_splitter.ts:79](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/text_splitter.ts#L79)

### splitText()

> **splitText**(`text`: `string`): `Promise`<`string`[]\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `text`    | `string` |

#### Returns

`Promise`<`string`[]\>

#### Inherited from

[RecursiveCharacterTextSplitter](RecursiveCharacterTextSplitter.md).[splitText](RecursiveCharacterTextSplitter.md#splittext)

#### Defined in

[langchain/src/text_splitter.ts:177](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/text_splitter.ts#L177)
