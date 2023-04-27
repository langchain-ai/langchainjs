---
title: "NotionLoader"
---

# NotionLoader

## Hierarchy

- [`DirectoryLoader`](../../document_loaders_fs_directory/classes/DirectoryLoader.md).**NotionLoader**

## Constructors

### constructor()

> **new NotionLoader**(`directoryPath`: `string`): [`NotionLoader`](NotionLoader.md)

#### Parameters

| Parameter       | Type     |
| :-------------- | :------- |
| `directoryPath` | `string` |

#### Returns

[`NotionLoader`](NotionLoader.md)

#### Overrides

[DirectoryLoader](../../document_loaders_fs_directory/classes/DirectoryLoader.md).[constructor](../../document_loaders_fs_directory/classes/DirectoryLoader.md#constructor)

#### Defined in

[langchain/src/document_loaders/fs/notion.ts:5](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/fs/notion.ts#L5)

## Properties

### directoryPath

> **directoryPath**: `string`

#### Inherited from

[DirectoryLoader](../../document_loaders_fs_directory/classes/DirectoryLoader.md).[directoryPath](../../document_loaders_fs_directory/classes/DirectoryLoader.md#directorypath)

#### Defined in

[langchain/src/document_loaders/fs/directory.ts:20](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/fs/directory.ts#L20)

### loaders

> **loaders**: `object`

#### Index signature

\[`extension`: `string`\]: (`filePath`: `string`) => [`BaseDocumentLoader`](../../document_loaders_base/classes/BaseDocumentLoader.md)

#### Type declaration

#### Inherited from

[DirectoryLoader](../../document_loaders_fs_directory/classes/DirectoryLoader.md).[loaders](../../document_loaders_fs_directory/classes/DirectoryLoader.md#loaders)

#### Defined in

[langchain/src/document_loaders/fs/directory.ts:21](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/fs/directory.ts#L21)

### recursive

> **recursive**: `boolean` = `true`

#### Inherited from

[DirectoryLoader](../../document_loaders_fs_directory/classes/DirectoryLoader.md).[recursive](../../document_loaders_fs_directory/classes/DirectoryLoader.md#recursive)

#### Defined in

[langchain/src/document_loaders/fs/directory.ts:24](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/fs/directory.ts#L24)

### unknown

> **unknown**: [`UnknownHandling`](../../document_loaders_fs_directory/variables/UnknownHandling.md) = `UnknownHandling.Warn`

#### Inherited from

[DirectoryLoader](../../document_loaders_fs_directory/classes/DirectoryLoader.md).[unknown](../../document_loaders_fs_directory/classes/DirectoryLoader.md#unknown)

#### Defined in

[langchain/src/document_loaders/fs/directory.ts:25](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/fs/directory.ts#L25)

## Methods

### load()

> **load**(): `Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Returns

`Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Inherited from

[DirectoryLoader](../../document_loaders_fs_directory/classes/DirectoryLoader.md).[load](../../document_loaders_fs_directory/classes/DirectoryLoader.md#load)

#### Defined in

[langchain/src/document_loaders/fs/directory.ts:41](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/fs/directory.ts#L41)

### loadAndSplit()

> **loadAndSplit**(`splitter`: [`TextSplitter`](../../text_splitter/classes/TextSplitter.md) = `...`): `Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Parameters

| Parameter  | Type                                                          |
| :--------- | :------------------------------------------------------------ |
| `splitter` | [`TextSplitter`](../../text_splitter/classes/TextSplitter.md) |

#### Returns

`Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Inherited from

[DirectoryLoader](../../document_loaders_fs_directory/classes/DirectoryLoader.md).[loadAndSplit](../../document_loaders_fs_directory/classes/DirectoryLoader.md#loadandsplit)

#### Defined in

[langchain/src/document_loaders/base.ts:15](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/base.ts#L15)

### imports()

> `Static` **imports**(): `Promise`<\{`extname`: (`path`: `string`) => `string`;
> `readdir`: (`path`: `PathLike`, `options?`: null \| `BufferEncoding` \| `ObjectEncodingOptions` & \{}) => `Promise`<`string`[]\>(`path`: `PathLike`, `options`: "buffer" \| \{}) => `Promise`<`Buffer`[]\>(`path`: `PathLike`, `options?`: null \| `BufferEncoding` \| `ObjectEncodingOptions` & \{}) => `Promise`<`string`[] \| `Buffer`[]\>(`path`: `PathLike`, `options`: `ObjectEncodingOptions` & \{}) => `Promise`<`Dirent`[]\>;
> `resolve`: (...`paths`: `string`[]) => `string`;}\>

#### Returns

`Promise`<\{`extname`: (`path`: `string`) => `string`;
`readdir`: (`path`: `PathLike`, `options?`: null \| `BufferEncoding` \| `ObjectEncodingOptions` & \{}) => `Promise`<`string`[]\>(`path`: `PathLike`, `options`: "buffer" \| \{}) => `Promise`<`Buffer`[]\>(`path`: `PathLike`, `options?`: null \| `BufferEncoding` \| `ObjectEncodingOptions` & \{}) => `Promise`<`string`[] \| `Buffer`[]\>(`path`: `PathLike`, `options`: `ObjectEncodingOptions` & \{}) => `Promise`<`Dirent`[]\>;
`resolve`: (...`paths`: `string`[]) => `string`;}\>

#### Inherited from

[DirectoryLoader](../../document_loaders_fs_directory/classes/DirectoryLoader.md).[imports](../../document_loaders_fs_directory/classes/DirectoryLoader.md#imports)

#### Defined in

[langchain/src/document_loaders/fs/directory.ts:85](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/fs/directory.ts#L85)
