---
title: "UnstructuredLoader"
---

# UnstructuredLoader

## Hierarchy

- [`BaseDocumentLoader`](../../document_loaders_base/classes/BaseDocumentLoader.md).**UnstructuredLoader**

## Constructors

### constructor()

> **new UnstructuredLoader**(`webPath`: `string`, `filePath`: `string`): [`UnstructuredLoader`](UnstructuredLoader.md)

#### Parameters

| Parameter  | Type     |
| :--------- | :------- |
| `webPath`  | `string` |
| `filePath` | `string` |

#### Returns

[`UnstructuredLoader`](UnstructuredLoader.md)

#### Overrides

[BaseDocumentLoader](../../document_loaders_base/classes/BaseDocumentLoader.md).[constructor](../../document_loaders_base/classes/BaseDocumentLoader.md#constructor)

#### Defined in

[langchain/src/document_loaders/fs/unstructured.ts:18](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/fs/unstructured.ts#L18)

## Properties

### filePath

> **filePath**: `string`

#### Defined in

[langchain/src/document_loaders/fs/unstructured.ts:18](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/fs/unstructured.ts#L18)

### webPath

> **webPath**: `string`

#### Defined in

[langchain/src/document_loaders/fs/unstructured.ts:18](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/fs/unstructured.ts#L18)

## Methods

### \_partition()

> **\_partition**(): `Promise`<`Element`[]\>

#### Returns

`Promise`<`Element`[]\>

#### Defined in

[langchain/src/document_loaders/fs/unstructured.ts:25](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/fs/unstructured.ts#L25)

### imports()

> **imports**(): `Promise`<\{`basename`: (`path`: `string`, `suffix?`: `string`) => `string`;
> `readFile`: (`path`: `PathLike` \| `FileHandle`, `options?`: null \| \{} & `Abortable`) => `Promise`<`Buffer`\>(`path`: `PathLike` \| `FileHandle`, `options`: \{} & `Abortable` \| `BufferEncoding`) => `Promise`<`string`\>(`path`: `PathLike` \| `FileHandle`, `options?`: null \| `BufferEncoding` \| `ObjectEncodingOptions` & `Abortable` & \{}) => `Promise`<`string` \| `Buffer`\>;}\>

#### Returns

`Promise`<\{`basename`: (`path`: `string`, `suffix?`: `string`) => `string`;
`readFile`: (`path`: `PathLike` \| `FileHandle`, `options?`: null \| \{} & `Abortable`) => `Promise`<`Buffer`\>(`path`: `PathLike` \| `FileHandle`, `options`: \{} & `Abortable` \| `BufferEncoding`) => `Promise`<`string`\>(`path`: `PathLike` \| `FileHandle`, `options?`: null \| `BufferEncoding` \| `ObjectEncodingOptions` & `Abortable` & \{}) => `Promise`<`string` \| `Buffer`\>;}\>

#### Defined in

[langchain/src/document_loaders/fs/unstructured.ts:79](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/fs/unstructured.ts#L79)

### load()

> **load**(): `Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Returns

`Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Overrides

[BaseDocumentLoader](../../document_loaders_base/classes/BaseDocumentLoader.md).[load](../../document_loaders_base/classes/BaseDocumentLoader.md#load)

#### Defined in

[langchain/src/document_loaders/fs/unstructured.ts:59](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/fs/unstructured.ts#L59)

### loadAndSplit()

> **loadAndSplit**(`splitter`: [`TextSplitter`](../../text_splitter/classes/TextSplitter.md) = `...`): `Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Parameters

| Parameter  | Type                                                          |
| :--------- | :------------------------------------------------------------ |
| `splitter` | [`TextSplitter`](../../text_splitter/classes/TextSplitter.md) |

#### Returns

`Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Inherited from

[BaseDocumentLoader](../../document_loaders_base/classes/BaseDocumentLoader.md).[loadAndSplit](../../document_loaders_base/classes/BaseDocumentLoader.md#loadandsplit)

#### Defined in

[langchain/src/document_loaders/base.ts:15](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/base.ts#L15)
