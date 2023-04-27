---
title: "DirectoryLoader"
---

# DirectoryLoader

## Hierarchy

- [`BaseDocumentLoader`](../../document_loaders_base/classes/BaseDocumentLoader.md).**DirectoryLoader**

## Constructors

### constructor()

> **new DirectoryLoader**(`directoryPath`: `string`, `loaders`: `object`, `recursive`: `boolean` = `true`, `unknown`: [`UnknownHandling`](../variables/UnknownHandling.md) = `UnknownHandling.Warn`): [`DirectoryLoader`](DirectoryLoader.md)

#### Parameters

| Parameter       | Type                                                 | Default value          |
| :-------------- | :--------------------------------------------------- | :--------------------- |
| `directoryPath` | `string`                                             | `undefined`            |
| `loaders`       | \{}                                                  | `undefined`            |
| `recursive`     | `boolean`                                            | `true`                 |
| `unknown`       | [`UnknownHandling`](../variables/UnknownHandling.md) | `UnknownHandling.Warn` |

#### Returns

[`DirectoryLoader`](DirectoryLoader.md)

#### Overrides

[BaseDocumentLoader](../../document_loaders_base/classes/BaseDocumentLoader.md).[constructor](../../document_loaders_base/classes/BaseDocumentLoader.md#constructor)

#### Defined in

[langchain/src/document_loaders/fs/directory.ts:19](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/fs/directory.ts#L19)

## Properties

### directoryPath

> **directoryPath**: `string`

#### Defined in

[langchain/src/document_loaders/fs/directory.ts:20](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/fs/directory.ts#L20)

### loaders

> **loaders**: `object`

#### Index signature

\[`extension`: `string`\]: (`filePath`: `string`) => [`BaseDocumentLoader`](../../document_loaders_base/classes/BaseDocumentLoader.md)

#### Type declaration

#### Defined in

[langchain/src/document_loaders/fs/directory.ts:21](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/fs/directory.ts#L21)

### recursive

> **recursive**: `boolean` = `true`

#### Defined in

[langchain/src/document_loaders/fs/directory.ts:24](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/fs/directory.ts#L24)

### unknown

> **unknown**: [`UnknownHandling`](../variables/UnknownHandling.md) = `UnknownHandling.Warn`

#### Defined in

[langchain/src/document_loaders/fs/directory.ts:25](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/fs/directory.ts#L25)

## Methods

### load()

> **load**(): `Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Returns

`Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Overrides

[BaseDocumentLoader](../../document_loaders_base/classes/BaseDocumentLoader.md).[load](../../document_loaders_base/classes/BaseDocumentLoader.md#load)

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

[BaseDocumentLoader](../../document_loaders_base/classes/BaseDocumentLoader.md).[loadAndSplit](../../document_loaders_base/classes/BaseDocumentLoader.md#loadandsplit)

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

#### Defined in

[langchain/src/document_loaders/fs/directory.ts:85](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/fs/directory.ts#L85)
