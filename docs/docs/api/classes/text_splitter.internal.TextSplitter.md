---
id: "text_splitter.internal.TextSplitter"
title: "Class: TextSplitter"
sidebar_label: "TextSplitter"
custom_edit_url: null
---

[text_splitter](../modules/text_splitter.md).[internal](../modules/text_splitter.internal.md).TextSplitter

## Hierarchy

- **`TextSplitter`**

  ↳ [`CharacterTextSplitter`](text_splitter.CharacterTextSplitter.md)

  ↳ [`RecursiveCharacterTextSplitter`](text_splitter.RecursiveCharacterTextSplitter.md)

## Implements

- [`TextSplitterParams`](../interfaces/text_splitter.internal.TextSplitterParams.md)

## Constructors

### constructor

• **new TextSplitter**(`fields?`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `fields?` | `Partial`<[`TextSplitterParams`](../interfaces/text_splitter.internal.TextSplitterParams.md)\> |

#### Defined in

[text_splitter.ts:15](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/text_splitter.ts#L15)

## Properties

### chunkOverlap

• **chunkOverlap**: `number` = `200`

#### Implementation of

[TextSplitterParams](../interfaces/text_splitter.internal.TextSplitterParams.md).[chunkOverlap](../interfaces/text_splitter.internal.TextSplitterParams.md#chunkoverlap)

#### Defined in

[text_splitter.ts:13](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/text_splitter.ts#L13)

___

### chunkSize

• **chunkSize**: `number` = `1000`

#### Implementation of

[TextSplitterParams](../interfaces/text_splitter.internal.TextSplitterParams.md).[chunkSize](../interfaces/text_splitter.internal.TextSplitterParams.md#chunksize)

#### Defined in

[text_splitter.ts:11](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/text_splitter.ts#L11)

## Methods

### createDocuments

▸ **createDocuments**(`texts`, `metadatas?`): [`Document`](text_splitter.internal.Document.md)[]

#### Parameters

| Name | Type | Default value |
| :------ | :------ | :------ |
| `texts` | `string`[] | `undefined` |
| `metadatas` | `Record`<`string`, `any`\>[] | `[]` |

#### Returns

[`Document`](text_splitter.internal.Document.md)[]

#### Defined in

[text_splitter.ts:27](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/text_splitter.ts#L27)

___

### joinDocs

▸ `Private` **joinDocs**(`docs`, `separator`): ``null`` \| `string`

#### Parameters

| Name | Type |
| :------ | :------ |
| `docs` | `string`[] |
| `separator` | `string` |

#### Returns

``null`` \| `string`

#### Defined in

[text_splitter.ts:49](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/text_splitter.ts#L49)

___

### mergeSplits

▸ **mergeSplits**(`splits`, `separator`): `string`[]

#### Parameters

| Name | Type |
| :------ | :------ |
| `splits` | `string`[] |
| `separator` | `string` |

#### Returns

`string`[]

#### Defined in

[text_splitter.ts:54](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/text_splitter.ts#L54)

___

### splitDocuments

▸ **splitDocuments**(`documents`): [`Document`](text_splitter.internal.Document.md)[]

#### Parameters

| Name | Type |
| :------ | :------ |
| `documents` | [`Document`](text_splitter.internal.Document.md)[] |

#### Returns

[`Document`](text_splitter.internal.Document.md)[]

#### Defined in

[text_splitter.ts:43](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/text_splitter.ts#L43)

___

### splitText

▸ `Abstract` **splitText**(`text`): `string`[]

#### Parameters

| Name | Type |
| :------ | :------ |
| `text` | `string` |

#### Returns

`string`[]

#### Defined in

[text_splitter.ts:25](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/text_splitter.ts#L25)
