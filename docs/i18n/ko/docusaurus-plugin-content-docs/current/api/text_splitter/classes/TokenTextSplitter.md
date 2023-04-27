---
title: "TokenTextSplitter"
---

# TokenTextSplitter

Implementation of splitter which looks at tokens.

## Hierarchy

- [`TextSplitter`](TextSplitter.md).**TokenTextSplitter**

## Implements

- [`TokenTextSplitterParams`](../interfaces/TokenTextSplitterParams.md)

## Constructors

### constructor()

> **new TokenTextSplitter**(`fields`?: `Partial`<[`TokenTextSplitterParams`](../interfaces/TokenTextSplitterParams.md)\>): [`TokenTextSplitter`](TokenTextSplitter.md)

#### Parameters

| Parameter | Type                                                                               |
| :-------- | :--------------------------------------------------------------------------------- |
| `fields?` | `Partial`<[`TokenTextSplitterParams`](../interfaces/TokenTextSplitterParams.md)\> |

#### Returns

[`TokenTextSplitter`](TokenTextSplitter.md)

#### Overrides

[TextSplitter](TextSplitter.md).[constructor](TextSplitter.md#constructor)

#### Defined in

[langchain/src/text_splitter.ts:247](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/text_splitter.ts#L247)

## Properties

### allowedSpecial

> **allowedSpecial**: `string`[] \| "all"

#### Implementation of

[TokenTextSplitterParams](../interfaces/TokenTextSplitterParams.md).[allowedSpecial](../interfaces/TokenTextSplitterParams.md#allowedspecial)

#### Defined in

[langchain/src/text_splitter.ts:239](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/text_splitter.ts#L239)

### chunkOverlap

> **chunkOverlap**: `number` = `200`

#### Implementation of

[TokenTextSplitterParams](../interfaces/TokenTextSplitterParams.md).[chunkOverlap](../interfaces/TokenTextSplitterParams.md#chunkoverlap)

#### Inherited from

[TextSplitter](TextSplitter.md).[chunkOverlap](TextSplitter.md#chunkoverlap)

#### Defined in

[langchain/src/text_splitter.ts:13](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/text_splitter.ts#L13)

### chunkSize

> **chunkSize**: `number` = `1000`

#### Implementation of

[TokenTextSplitterParams](../interfaces/TokenTextSplitterParams.md).[chunkSize](../interfaces/TokenTextSplitterParams.md#chunksize)

#### Inherited from

[TextSplitter](TextSplitter.md).[chunkSize](TextSplitter.md#chunksize)

#### Defined in

[langchain/src/text_splitter.ts:11](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/text_splitter.ts#L11)

### disallowedSpecial

> **disallowedSpecial**: `string`[] \| "all"

#### Implementation of

[TokenTextSplitterParams](../interfaces/TokenTextSplitterParams.md).[disallowedSpecial](../interfaces/TokenTextSplitterParams.md#disallowedspecial)

#### Defined in

[langchain/src/text_splitter.ts:241](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/text_splitter.ts#L241)

### encodingName

> **encodingName**: `TiktokenEncoding`

#### Implementation of

[TokenTextSplitterParams](../interfaces/TokenTextSplitterParams.md).[encodingName](../interfaces/TokenTextSplitterParams.md#encodingname)

#### Defined in

[langchain/src/text_splitter.ts:237](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/text_splitter.ts#L237)

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

[langchain/src/text_splitter.ts:255](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/text_splitter.ts#L255)

### imports()

> `Static` **imports**(): `Promise`<`__module`\>

#### Returns

`Promise`<`__module`\>

#### Defined in

[langchain/src/text_splitter.ts:290](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/text_splitter.ts#L290)
