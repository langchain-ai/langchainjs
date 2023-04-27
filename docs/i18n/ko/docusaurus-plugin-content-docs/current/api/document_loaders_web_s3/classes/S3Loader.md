---
title: "S3Loader"
---

# S3Loader

## Hierarchy

- [`BaseDocumentLoader`](../../document_loaders_base/classes/BaseDocumentLoader.md).**S3Loader**

## Constructors

### constructor()

> **new S3Loader**(«destructured»: [`S3LoaderParams`](../interfaces/S3LoaderParams.md)): [`S3Loader`](S3Loader.md)

#### Parameters

| Parameter        | Type                                                |
| :--------------- | :-------------------------------------------------- |
| `«destructured»` | [`S3LoaderParams`](../interfaces/S3LoaderParams.md) |

#### Returns

[`S3Loader`](S3Loader.md)

#### Overrides

[BaseDocumentLoader](../../document_loaders_base/classes/BaseDocumentLoader.md).[constructor](../../document_loaders_base/classes/BaseDocumentLoader.md#constructor)

#### Defined in

[langchain/src/document_loaders/web/s3.ts:37](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/web/s3.ts#L37)

## Methods

### load()

> **load**(): `Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Returns

`Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Overrides

[BaseDocumentLoader](../../document_loaders_base/classes/BaseDocumentLoader.md).[load](../../document_loaders_base/classes/BaseDocumentLoader.md#load)

#### Defined in

[langchain/src/document_loaders/web/s3.ts:54](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/web/s3.ts#L54)

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
