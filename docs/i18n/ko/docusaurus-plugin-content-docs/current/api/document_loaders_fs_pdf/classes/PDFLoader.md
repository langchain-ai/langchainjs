---
title: "PDFLoader"
---

# PDFLoader

## Hierarchy

- [`BufferLoader`](../../document_loaders_fs_buffer/classes/BufferLoader.md).**PDFLoader**

## Constructors

### constructor()

> **new PDFLoader**(`filePathOrBlob`: `string` \| `Blob`, «destructured»: `object` = `{}`): [`PDFLoader`](PDFLoader.md)

#### Parameters

| Parameter        | Type                                                                                                                                                                                               |
| :--------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `filePathOrBlob` | `string` \| `Blob`                                                                                                                                                                                 |
| `«destructured»` | `object`                                                                                                                                                                                           |
| › `pdfjs`        | `undefined` \| () => `Promise`<\{`getDocument`: (`src`: `string` \| `URL` \| `ArrayBuffer` \| `TypedArray` \| `DocumentInitParameters`) => `PDFDocumentLoadingTask`;<br />`version`: `string`;}\> |
| › `splitPages`   | `undefined` \| `boolean`                                                                                                                                                                           |

#### Returns

[`PDFLoader`](PDFLoader.md)

#### Overrides

[BufferLoader](../../document_loaders_fs_buffer/classes/BufferLoader.md).[constructor](../../document_loaders_fs_buffer/classes/BufferLoader.md#constructor)

#### Defined in

[langchain/src/document_loaders/fs/pdf.ts:10](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/fs/pdf.ts#L10)

## Properties

### filePathOrBlob

> **filePathOrBlob**: `string` \| `Blob`

#### Inherited from

[BufferLoader](../../document_loaders_fs_buffer/classes/BufferLoader.md).[filePathOrBlob](../../document_loaders_fs_buffer/classes/BufferLoader.md#filepathorblob)

#### Defined in

[langchain/src/document_loaders/fs/buffer.ts:7](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/fs/buffer.ts#L7)

## Methods

### load()

> **load**(): `Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Returns

`Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Inherited from

[BufferLoader](../../document_loaders_fs_buffer/classes/BufferLoader.md).[load](../../document_loaders_fs_buffer/classes/BufferLoader.md#load)

#### Defined in

[langchain/src/document_loaders/fs/buffer.ts:16](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/fs/buffer.ts#L16)

### loadAndSplit()

> **loadAndSplit**(`splitter`: [`TextSplitter`](../../text_splitter/classes/TextSplitter.md) = `...`): `Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Parameters

| Parameter  | Type                                                          |
| :--------- | :------------------------------------------------------------ |
| `splitter` | [`TextSplitter`](../../text_splitter/classes/TextSplitter.md) |

#### Returns

`Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Inherited from

[BufferLoader](../../document_loaders_fs_buffer/classes/BufferLoader.md).[loadAndSplit](../../document_loaders_fs_buffer/classes/BufferLoader.md#loadandsplit)

#### Defined in

[langchain/src/document_loaders/base.ts:15](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/base.ts#L15)

### parse()

> **parse**(`raw`: `Buffer`, `metadata`: `Record`<`string`, `any`\>): `Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Parameters

| Parameter  | Type                        |
| :--------- | :-------------------------- |
| `raw`      | `Buffer`                    |
| `metadata` | `Record`<`string`, `any`\> |

#### Returns

`Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Overrides

[BufferLoader](../../document_loaders_fs_buffer/classes/BufferLoader.md).[parse](../../document_loaders_fs_buffer/classes/BufferLoader.md#parse)

#### Defined in

[langchain/src/document_loaders/fs/pdf.ts:19](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/fs/pdf.ts#L19)

### imports()

> `Static` **imports**(): `Promise`<\{`readFile`: (`path`: `PathLike` \| `FileHandle`, `options?`: null \| \{} & `Abortable`) => `Promise`<`Buffer`\>(`path`: `PathLike` \| `FileHandle`, `options`: \{} & `Abortable` \| `BufferEncoding`) => `Promise`<`string`\>(`path`: `PathLike` \| `FileHandle`, `options?`: null \| `BufferEncoding` \| `ObjectEncodingOptions` & `Abortable` & \{}) => `Promise`<`string` \| `Buffer`\>;}\>

#### Returns

`Promise`<\{`readFile`: (`path`: `PathLike` \| `FileHandle`, `options?`: null \| \{} & `Abortable`) => `Promise`<`Buffer`\>(`path`: `PathLike` \| `FileHandle`, `options`: \{} & `Abortable` \| `BufferEncoding`) => `Promise`<`string`\>(`path`: `PathLike` \| `FileHandle`, `options?`: null \| `BufferEncoding` \| `ObjectEncodingOptions` & `Abortable` & \{}) => `Promise`<`string` \| `Buffer`\>;}\>

#### Inherited from

[BufferLoader](../../document_loaders_fs_buffer/classes/BufferLoader.md).[imports](../../document_loaders_fs_buffer/classes/BufferLoader.md#imports)

#### Defined in

[langchain/src/document_loaders/fs/buffer.ts:32](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/fs/buffer.ts#L32)
