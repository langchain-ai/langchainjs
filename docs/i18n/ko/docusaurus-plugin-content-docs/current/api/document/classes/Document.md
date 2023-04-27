---
title: "Document<Metadata>"
---

# Document<Metadata\>

Interface for interacting with a document.

## Type parameters

- `Metadata` _extends_ `Record`<`string`, `any`\> = `Record`<`string`, `any`\>

## Implements

- [`DocumentInput`](../interfaces/DocumentInput.md)

## Constructors

### constructor()

> **new Document**<Metadata\>(`fields`: [`DocumentInput`](../interfaces/DocumentInput.md)<`Metadata`\>): [`Document`](Document.md)<`Metadata`\>

#### Type parameters

- `Metadata` _extends_ `Record`<`string`, `any`\> = `Record`<`string`, `any`\>

#### Parameters

| Parameter | Type                                                            |
| :-------- | :-------------------------------------------------------------- |
| `fields`  | [`DocumentInput`](../interfaces/DocumentInput.md)<`Metadata`\> |

#### Returns

[`Document`](Document.md)<`Metadata`\>

#### Defined in

[langchain/src/document.ts:22](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document.ts#L22)

## Properties

### metadata

> **metadata**: `Metadata`

#### Implementation of

[DocumentInput](../interfaces/DocumentInput.md).[metadata](../interfaces/DocumentInput.md#metadata)

#### Defined in

[langchain/src/document.ts:20](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document.ts#L20)

### pageContent

> **pageContent**: `string`

#### Implementation of

[DocumentInput](../interfaces/DocumentInput.md).[pageContent](../interfaces/DocumentInput.md#pagecontent)

#### Defined in

[langchain/src/document.ts:18](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document.ts#L18)
