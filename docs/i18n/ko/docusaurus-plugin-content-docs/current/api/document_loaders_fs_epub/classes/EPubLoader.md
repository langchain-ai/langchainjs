---
title: "EPubLoader"
---

# EPubLoader

## Hierarchy

- [`BaseDocumentLoader`](../../document_loaders_base/classes/BaseDocumentLoader.md).**EPubLoader**

## Constructors

### constructor()

> **new EPubLoader**(`filePath`: `string`, «destructured»: `object` = `{}`): [`EPubLoader`](EPubLoader.md)

#### Parameters

| Parameter         | Type                     |
| :---------------- | :----------------------- |
| `filePath`        | `string`                 |
| `«destructured»`  | `object`                 |
| › `splitChapters` | `undefined` \| `boolean` |

#### Returns

[`EPubLoader`](EPubLoader.md)

#### Overrides

[BaseDocumentLoader](../../document_loaders_base/classes/BaseDocumentLoader.md).[constructor](../../document_loaders_base/classes/BaseDocumentLoader.md#constructor)

#### Defined in

[langchain/src/document_loaders/fs/epub.ts:8](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/fs/epub.ts#L8)

## Properties

### filePath

> **filePath**: `string`

#### Defined in

[langchain/src/document_loaders/fs/epub.ts:8](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/fs/epub.ts#L8)

## Methods

### load()

> **load**(): `Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Returns

`Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Overrides

[BaseDocumentLoader](../../document_loaders_base/classes/BaseDocumentLoader.md).[load](../../document_loaders_base/classes/BaseDocumentLoader.md#load)

#### Defined in

[langchain/src/document_loaders/fs/epub.ts:36](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/fs/epub.ts#L36)

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

### parse()

> `Protected` **parse**(`epub`: `EPub`): `Promise`<\{`pageContent`: `string`;
> `metadata`?: `object`;}[]\>

#### Parameters

| Parameter | Type   |
| :-------- | :----- |
| `epub`    | `EPub` |

#### Returns

`Promise`<\{`pageContent`: `string`;
`metadata`?: `object`;}[]\>

#### Defined in

[langchain/src/document_loaders/fs/epub.ts:13](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/fs/epub.ts#L13)
