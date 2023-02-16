---
id: "text_splitter.internal.Document"
title: "Class: Document"
sidebar_label: "Document"
custom_edit_url: null
---

[text_splitter](../modules/text_splitter.md).[internal](../modules/text_splitter.internal.md).Document

Interface for interacting with a document.

## Implements

- [`DocumentParams`](../interfaces/text_splitter.internal.DocumentParams.md)

## Constructors

### constructor

• **new Document**(`fields?`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `fields?` | `Partial`<[`DocumentParams`](../interfaces/text_splitter.internal.DocumentParams.md)\> |

#### Defined in

[document.ts:17](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/document.ts#L17)

## Properties

### metadata

• **metadata**: `Record`<`string`, `any`\>

#### Implementation of

[DocumentParams](../interfaces/text_splitter.internal.DocumentParams.md).[metadata](../interfaces/text_splitter.internal.DocumentParams.md#metadata)

#### Defined in

[document.ts:15](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/document.ts#L15)

___

### pageContent

• **pageContent**: `string`

#### Implementation of

[DocumentParams](../interfaces/text_splitter.internal.DocumentParams.md).[pageContent](../interfaces/text_splitter.internal.DocumentParams.md#pagecontent)

#### Defined in

[document.ts:12](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/document.ts#L12)
