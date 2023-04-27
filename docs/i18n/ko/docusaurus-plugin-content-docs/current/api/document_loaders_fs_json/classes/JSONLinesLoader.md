---
title: "JSONLinesLoader"
---

# JSONLinesLoader

## Hierarchy

- [`TextLoader`](../../document_loaders_fs_text/classes/TextLoader.md).**JSONLinesLoader**

## Constructors

### constructor()

> **new JSONLinesLoader**(`filePathOrBlob`: `string` \| `Blob`, `pointer`: `string`): [`JSONLinesLoader`](JSONLinesLoader.md)

#### Parameters

| Parameter        | Type               |
| :--------------- | :----------------- |
| `filePathOrBlob` | `string` \| `Blob` |
| `pointer`        | `string`           |

#### Returns

[`JSONLinesLoader`](JSONLinesLoader.md)

#### Overrides

[TextLoader](../../document_loaders_fs_text/classes/TextLoader.md).[constructor](../../document_loaders_fs_text/classes/TextLoader.md#constructor)

#### Defined in

[langchain/src/document_loaders/fs/json.ts:120](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/fs/json.ts#L120)

## Properties

### filePathOrBlob

> **filePathOrBlob**: `string` \| `Blob`

#### Inherited from

[TextLoader](../../document_loaders_fs_text/classes/TextLoader.md).[filePathOrBlob](../../document_loaders_fs_text/classes/TextLoader.md#filepathorblob)

#### Defined in

[langchain/src/document_loaders/fs/text.ts:7](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/fs/text.ts#L7)

### pointer

> **pointer**: `string`

#### Defined in

[langchain/src/document_loaders/fs/json.ts:120](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/fs/json.ts#L120)

## Methods

### load()

> **load**(): `Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Returns

`Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Inherited from

[TextLoader](../../document_loaders_fs_text/classes/TextLoader.md).[load](../../document_loaders_fs_text/classes/TextLoader.md#load)

#### Defined in

[langchain/src/document_loaders/fs/text.ts:15](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/fs/text.ts#L15)

### loadAndSplit()

> **loadAndSplit**(`splitter`: [`TextSplitter`](../../text_splitter/classes/TextSplitter.md) = `...`): `Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Parameters

| Parameter  | Type                                                          |
| :--------- | :------------------------------------------------------------ |
| `splitter` | [`TextSplitter`](../../text_splitter/classes/TextSplitter.md) |

#### Returns

`Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Inherited from

[TextLoader](../../document_loaders_fs_text/classes/TextLoader.md).[loadAndSplit](../../document_loaders_fs_text/classes/TextLoader.md#loadandsplit)

#### Defined in

[langchain/src/document_loaders/base.ts:15](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/base.ts#L15)

### imports()

> `Static` **imports**(): `Promise`<\{`readFile`: (`path`: `PathLike` \| `FileHandle`, `options?`: null \| \{} & `Abortable`) => `Promise`<`Buffer`\>(`path`: `PathLike` \| `FileHandle`, `options`: \{} & `Abortable` \| `BufferEncoding`) => `Promise`<`string`\>(`path`: `PathLike` \| `FileHandle`, `options?`: null \| `BufferEncoding` \| `ObjectEncodingOptions` & `Abortable` & \{}) => `Promise`<`string` \| `Buffer`\>;}\>

#### Returns

`Promise`<\{`readFile`: (`path`: `PathLike` \| `FileHandle`, `options?`: null \| \{} & `Abortable`) => `Promise`<`Buffer`\>(`path`: `PathLike` \| `FileHandle`, `options`: \{} & `Abortable` \| `BufferEncoding`) => `Promise`<`string`\>(`path`: `PathLike` \| `FileHandle`, `options?`: null \| `BufferEncoding` \| `ObjectEncodingOptions` & `Abortable` & \{}) => `Promise`<`string` \| `Buffer`\>;}\>

#### Inherited from

[TextLoader](../../document_loaders_fs_text/classes/TextLoader.md).[imports](../../document_loaders_fs_text/classes/TextLoader.md#imports)

#### Defined in

[langchain/src/document_loaders/fs/text.ts:49](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/fs/text.ts#L49)

### parse()

> `Protected` **parse**(`raw`: `string`): `Promise`<`string`[]\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `raw`     | `string` |

#### Returns

`Promise`<`string`[]\>

#### Overrides

[TextLoader](../../document_loaders_fs_text/classes/TextLoader.md).[parse](../../document_loaders_fs_text/classes/TextLoader.md#parse)

#### Defined in

[langchain/src/document_loaders/fs/json.ts:124](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/fs/json.ts#L124)
