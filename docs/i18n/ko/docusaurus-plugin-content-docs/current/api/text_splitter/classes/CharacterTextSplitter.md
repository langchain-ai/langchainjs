---
title: "CharacterTextSplitter"
---

# CharacterTextSplitter

## Hierarchy

- [`TextSplitter`](TextSplitter.md).**CharacterTextSplitter**

## Implements

- [`CharacterTextSplitterParams`](../interfaces/CharacterTextSplitterParams.md)

## Constructors

### constructor()

> **new CharacterTextSplitter**(`fields`?: `Partial`<[`CharacterTextSplitterParams`](../interfaces/CharacterTextSplitterParams.md)\>): [`CharacterTextSplitter`](CharacterTextSplitter.md)

#### Parameters

| Parameter | Type                                                                                       |
| :-------- | :----------------------------------------------------------------------------------------- |
| `fields?` | `Partial`<[`CharacterTextSplitterParams`](../interfaces/CharacterTextSplitterParams.md)\> |

#### Returns

[`CharacterTextSplitter`](CharacterTextSplitter.md)

#### Overrides

[TextSplitter](TextSplitter.md).[constructor](TextSplitter.md#constructor)

#### Defined in

[langchain/src/text_splitter.ts:144](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/text_splitter.ts#L144)

## Properties

### chunkOverlap

> **chunkOverlap**: `number` = `200`

#### Implementation of

[CharacterTextSplitterParams](../interfaces/CharacterTextSplitterParams.md).[chunkOverlap](../interfaces/CharacterTextSplitterParams.md#chunkoverlap)

#### Inherited from

[TextSplitter](TextSplitter.md).[chunkOverlap](TextSplitter.md#chunkoverlap)

#### Defined in

[langchain/src/text_splitter.ts:13](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/text_splitter.ts#L13)

### chunkSize

> **chunkSize**: `number` = `1000`

#### Implementation of

[CharacterTextSplitterParams](../interfaces/CharacterTextSplitterParams.md).[chunkSize](../interfaces/CharacterTextSplitterParams.md#chunksize)

#### Inherited from

[TextSplitter](TextSplitter.md).[chunkSize](TextSplitter.md#chunksize)

#### Defined in

[langchain/src/text_splitter.ts:11](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/text_splitter.ts#L11)

### separator

> **separator**: `string` = `"\n\n"`

#### Implementation of

[CharacterTextSplitterParams](../interfaces/CharacterTextSplitterParams.md).[separator](../interfaces/CharacterTextSplitterParams.md#separator)

#### Defined in

[langchain/src/text_splitter.ts:142](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/text_splitter.ts#L142)

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

[langchain/src/text_splitter.ts:149](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/text_splitter.ts#L149)
