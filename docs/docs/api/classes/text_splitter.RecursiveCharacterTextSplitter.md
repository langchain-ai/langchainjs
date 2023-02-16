---
id: "text_splitter.RecursiveCharacterTextSplitter"
title: "Class: RecursiveCharacterTextSplitter"
sidebar_label: "RecursiveCharacterTextSplitter"
custom_edit_url: null
---

[text_splitter](../modules/text_splitter.md).RecursiveCharacterTextSplitter

## Hierarchy

- [`TextSplitter`](text_splitter.internal.TextSplitter.md)

  ↳ **`RecursiveCharacterTextSplitter`**

## Implements

- [`RecursiveCharacterTextSplitterParams`](../interfaces/text_splitter.RecursiveCharacterTextSplitterParams.md)

## Constructors

### constructor

• **new RecursiveCharacterTextSplitter**(`fields?`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `fields?` | `Partial`<[`RecursiveCharacterTextSplitterParams`](../interfaces/text_splitter.RecursiveCharacterTextSplitterParams.md)\> |

#### Overrides

[TextSplitter](text_splitter.internal.TextSplitter.md).[constructor](text_splitter.internal.TextSplitter.md#constructor)

#### Defined in

[text_splitter.ts:126](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/text_splitter.ts#L126)

## Properties

### chunkOverlap

• **chunkOverlap**: `number` = `200`

#### Implementation of

[RecursiveCharacterTextSplitterParams](../interfaces/text_splitter.RecursiveCharacterTextSplitterParams.md).[chunkOverlap](../interfaces/text_splitter.RecursiveCharacterTextSplitterParams.md#chunkoverlap)

#### Inherited from

[TextSplitter](text_splitter.internal.TextSplitter.md).[chunkOverlap](text_splitter.internal.TextSplitter.md#chunkoverlap)

#### Defined in

[text_splitter.ts:13](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/text_splitter.ts#L13)

___

### chunkSize

• **chunkSize**: `number` = `1000`

#### Implementation of

[RecursiveCharacterTextSplitterParams](../interfaces/text_splitter.RecursiveCharacterTextSplitterParams.md).[chunkSize](../interfaces/text_splitter.RecursiveCharacterTextSplitterParams.md#chunksize)

#### Inherited from

[TextSplitter](text_splitter.internal.TextSplitter.md).[chunkSize](text_splitter.internal.TextSplitter.md#chunksize)

#### Defined in

[text_splitter.ts:11](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/text_splitter.ts#L11)

___

### separators

• **separators**: `string`[]

#### Implementation of

[RecursiveCharacterTextSplitterParams](../interfaces/text_splitter.RecursiveCharacterTextSplitterParams.md).[separators](../interfaces/text_splitter.RecursiveCharacterTextSplitterParams.md#separators)

#### Defined in

[text_splitter.ts:124](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/text_splitter.ts#L124)

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

#### Inherited from

[TextSplitter](text_splitter.internal.TextSplitter.md).[createDocuments](text_splitter.internal.TextSplitter.md#createdocuments)

#### Defined in

[text_splitter.ts:27](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/text_splitter.ts#L27)

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

#### Inherited from

[TextSplitter](text_splitter.internal.TextSplitter.md).[mergeSplits](text_splitter.internal.TextSplitter.md#mergesplits)

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

#### Inherited from

[TextSplitter](text_splitter.internal.TextSplitter.md).[splitDocuments](text_splitter.internal.TextSplitter.md#splitdocuments)

#### Defined in

[text_splitter.ts:43](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/text_splitter.ts#L43)

___

### splitText

▸ **splitText**(`text`): `string`[]

#### Parameters

| Name | Type |
| :------ | :------ |
| `text` | `string` |

#### Returns

`string`[]

#### Overrides

[TextSplitter](text_splitter.internal.TextSplitter.md).[splitText](text_splitter.internal.TextSplitter.md#splittext)

#### Defined in

[text_splitter.ts:131](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/text_splitter.ts#L131)
