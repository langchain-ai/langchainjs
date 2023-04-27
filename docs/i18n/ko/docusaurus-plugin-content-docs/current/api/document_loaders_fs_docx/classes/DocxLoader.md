---
title: "DocxLoader"
---

# DocxLoader

## Hierarchy

- [`BufferLoader`](../../document_loaders_fs_buffer/classes/BufferLoader.md).**DocxLoader**

## Constructors

### constructor()

> **new DocxLoader**(`filePathOrBlob`: `string` \| `Blob`): [`DocxLoader`](DocxLoader.md)

#### Parameters

| Parameter        | Type               |
| :--------------- | :----------------- |
| `filePathOrBlob` | `string` \| `Blob` |

#### Returns

[`DocxLoader`](DocxLoader.md)

#### Overrides

[BufferLoader](../../document_loaders_fs_buffer/classes/BufferLoader.md).[constructor](../../document_loaders_fs_buffer/classes/BufferLoader.md#constructor)

#### Defined in

[langchain/src/document_loaders/fs/docx.ts:5](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/fs/docx.ts#L5)

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

[langchain/src/document_loaders/fs/docx.ts:9](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/fs/docx.ts#L9)

### imports()

> `Static` **imports**(): `Promise`<\{`readFile`: (`path`: `PathLike` \| `FileHandle`, `options?`: null \| \{} & `Abortable`) => `Promise`<`Buffer`\>(`path`: `PathLike` \| `FileHandle`, `options`: \{} & `Abortable` \| `BufferEncoding`) => `Promise`<`string`\>(`path`: `PathLike` \| `FileHandle`, `options?`: null \| `BufferEncoding` \| `ObjectEncodingOptions` & `Abortable` & \{}) => `Promise`<`string` \| `Buffer`\>;}\>

#### Returns

`Promise`<\{`readFile`: (`path`: `PathLike` \| `FileHandle`, `options?`: null \| \{} & `Abortable`) => `Promise`<`Buffer`\>(`path`: `PathLike` \| `FileHandle`, `options`: \{} & `Abortable` \| `BufferEncoding`) => `Promise`<`string`\>(`path`: `PathLike` \| `FileHandle`, `options?`: null \| `BufferEncoding` \| `ObjectEncodingOptions` & `Abortable` & \{}) => `Promise`<`string` \| `Buffer`\>;}\>

#### Inherited from

[BufferLoader](../../document_loaders_fs_buffer/classes/BufferLoader.md).[imports](../../document_loaders_fs_buffer/classes/BufferLoader.md#imports)

#### Defined in

[langchain/src/document_loaders/fs/buffer.ts:32](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/fs/buffer.ts#L32)
