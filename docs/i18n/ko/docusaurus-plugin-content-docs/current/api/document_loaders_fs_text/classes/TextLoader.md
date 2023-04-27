---
title: "TextLoader"
---

# TextLoader

## Hierarchy

- [`BaseDocumentLoader`](../../document_loaders_base/classes/BaseDocumentLoader.md).**TextLoader**

## Constructors

### constructor()

> **new TextLoader**(`filePathOrBlob`: `string` \| `Blob`): [`TextLoader`](TextLoader.md)

#### Parameters

| Parameter        | Type               |
| :--------------- | :----------------- |
| `filePathOrBlob` | `string` \| `Blob` |

#### Returns

[`TextLoader`](TextLoader.md)

#### Overrides

[BaseDocumentLoader](../../document_loaders_base/classes/BaseDocumentLoader.md).[constructor](../../document_loaders_base/classes/BaseDocumentLoader.md#constructor)

#### Defined in

[langchain/src/document_loaders/fs/text.ts:7](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/fs/text.ts#L7)

## Properties

### filePathOrBlob

> **filePathOrBlob**: `string` \| `Blob`

#### Defined in

[langchain/src/document_loaders/fs/text.ts:7](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/fs/text.ts#L7)

## Methods

### load()

> **load**(): `Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Returns

`Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Overrides

[BaseDocumentLoader](../../document_loaders_base/classes/BaseDocumentLoader.md).[load](../../document_loaders_base/classes/BaseDocumentLoader.md#load)

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

[BaseDocumentLoader](../../document_loaders_base/classes/BaseDocumentLoader.md).[loadAndSplit](../../document_loaders_base/classes/BaseDocumentLoader.md#loadandsplit)

#### Defined in

[langchain/src/document_loaders/base.ts:15](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/base.ts#L15)

### imports()

> `Static` **imports**(): `Promise`<\{`readFile`: (`path`: `PathLike` \| `FileHandle`, `options?`: null \| \{} & `Abortable`) => `Promise`<`Buffer`\>(`path`: `PathLike` \| `FileHandle`, `options`: \{} & `Abortable` \| `BufferEncoding`) => `Promise`<`string`\>(`path`: `PathLike` \| `FileHandle`, `options?`: null \| `BufferEncoding` \| `ObjectEncodingOptions` & `Abortable` & \{}) => `Promise`<`string` \| `Buffer`\>;}\>

#### Returns

`Promise`<\{`readFile`: (`path`: `PathLike` \| `FileHandle`, `options?`: null \| \{} & `Abortable`) => `Promise`<`Buffer`\>(`path`: `PathLike` \| `FileHandle`, `options`: \{} & `Abortable` \| `BufferEncoding`) => `Promise`<`string`\>(`path`: `PathLike` \| `FileHandle`, `options?`: null \| `BufferEncoding` \| `ObjectEncodingOptions` & `Abortable` & \{}) => `Promise`<`string` \| `Buffer`\>;}\>

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

#### Defined in

[langchain/src/document_loaders/fs/text.ts:11](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/fs/text.ts#L11)
