---
title: "CSVLoader"
---

# CSVLoader

Loads a CSV file into a list of documents.
Each document represents one row of the CSV file.

When `column` is not specified, each row is converted into a key/value pair
with each key/value pair outputted to a new line in the document's pageContent.

## Example

```ts
// CSV file:
// id,html
// 1,<i>Corruption discovered at the core of the Banking Clan!</i>
// 2,<i>Corruption discovered at the core of the Banking Clan!</i>

const loader = new CSVLoader("path/to/file.csv");
const docs = await loader.load();

// docs[0].pageContent:
// id: 1
// html: <i>Corruption discovered at the core of the Banking Clan!</i>

When `column` is specified, one document is created for each row, and the
value of the specified column is used as the document's pageContent.
```

## Example

```ts
// CSV file:
// id,html
// 1,<i>Corruption discovered at the core of the Banking Clan!</i>
// 2,<i>Corruption discovered at the core of the Banking Clan!</i>

const loader = new CSVLoader("path/to/file.csv", "html");
const docs = await loader.load();

// docs[0].pageContent:
// <i>Corruption discovered at the core of the Banking Clan!</i>
```

## Hierarchy

- [`TextLoader`](../../document_loaders_fs_text/classes/TextLoader.md).**CSVLoader**

## Constructors

### constructor()

> **new CSVLoader**(`filePathOrBlob`: `string` \| `Blob`, `column`?: `string`): [`CSVLoader`](CSVLoader.md)

#### Parameters

| Parameter        | Type               |
| :--------------- | :----------------- |
| `filePathOrBlob` | `string` \| `Blob` |
| `column?`        | `string`           |

#### Returns

[`CSVLoader`](CSVLoader.md)

#### Overrides

[TextLoader](../../document_loaders_fs_text/classes/TextLoader.md).[constructor](../../document_loaders_fs_text/classes/TextLoader.md#constructor)

#### Defined in

[langchain/src/document_loaders/fs/csv.ts:39](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/fs/csv.ts#L39)

## Properties

### filePathOrBlob

> **filePathOrBlob**: `string` \| `Blob`

#### Inherited from

[TextLoader](../../document_loaders_fs_text/classes/TextLoader.md).[filePathOrBlob](../../document_loaders_fs_text/classes/TextLoader.md#filepathorblob)

#### Defined in

[langchain/src/document_loaders/fs/text.ts:7](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/fs/text.ts#L7)

### column?

> **column**: `string`

#### Defined in

[langchain/src/document_loaders/fs/csv.ts:39](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/fs/csv.ts#L39)

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

[langchain/src/document_loaders/fs/csv.ts:43](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/fs/csv.ts#L43)
