---
title: "RecursiveCharacterTextSplitter"
---

# RecursiveCharacterTextSplitter

## Hierarchy

- [`TextSplitter`](TextSplitter.md).**RecursiveCharacterTextSplitter**

## Implements

- [`RecursiveCharacterTextSplitterParams`](../interfaces/RecursiveCharacterTextSplitterParams.md)

## Constructors

### constructor()

> **new RecursiveCharacterTextSplitter**(`fields`?: `Partial`<[`RecursiveCharacterTextSplitterParams`](../interfaces/RecursiveCharacterTextSplitterParams.md)\>): [`RecursiveCharacterTextSplitter`](RecursiveCharacterTextSplitter.md)

#### Parameters

| Parameter | Type                                                                                                         |
| :-------- | :----------------------------------------------------------------------------------------------------------- |
| `fields?` | `Partial`<[`RecursiveCharacterTextSplitterParams`](../interfaces/RecursiveCharacterTextSplitterParams.md)\> |

#### Returns

[`RecursiveCharacterTextSplitter`](RecursiveCharacterTextSplitter.md)

#### Overrides

[TextSplitter](TextSplitter.md).[constructor](TextSplitter.md#constructor)

#### Defined in

[langchain/src/text_splitter.ts:172](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/text_splitter.ts#L172)

## Properties

### chunkOverlap

> **chunkOverlap**: `number` = `200`

#### Implementation of

[RecursiveCharacterTextSplitterParams](../interfaces/RecursiveCharacterTextSplitterParams.md).[chunkOverlap](../interfaces/RecursiveCharacterTextSplitterParams.md#chunkoverlap)

#### Inherited from

[TextSplitter](TextSplitter.md).[chunkOverlap](TextSplitter.md#chunkoverlap)

#### Defined in

[langchain/src/text_splitter.ts:13](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/text_splitter.ts#L13)

### chunkSize

> **chunkSize**: `number` = `1000`

#### Implementation of

[RecursiveCharacterTextSplitterParams](../interfaces/RecursiveCharacterTextSplitterParams.md).[chunkSize](../interfaces/RecursiveCharacterTextSplitterParams.md#chunksize)

#### Inherited from

[TextSplitter](TextSplitter.md).[chunkSize](TextSplitter.md#chunksize)

#### Defined in

[langchain/src/text_splitter.ts:11](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/text_splitter.ts#L11)

### separators

> **separators**: `string`[]

#### Implementation of

[RecursiveCharacterTextSplitterParams](../interfaces/RecursiveCharacterTextSplitterParams.md).[separators](../interfaces/RecursiveCharacterTextSplitterParams.md#separators)

#### Defined in

[langchain/src/text_splitter.ts:170](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/text_splitter.ts#L170)

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

[TextSplitter](TextSplitter.md).[createDocuments](TextSplitter.md#createdocuments)

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

[TextSplitter](TextSplitter.md).[mergeSplits](TextSplitter.md#mergesplits)

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

[TextSplitter](TextSplitter.md).[splitDocuments](TextSplitter.md#splitdocuments)

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

#### Overrides

[TextSplitter](TextSplitter.md).[splitText](TextSplitter.md#splittext)

#### Defined in

[langchain/src/text_splitter.ts:177](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/text_splitter.ts#L177)
