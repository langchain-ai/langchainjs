---
title: "BaseDocumentLoader"
---

# BaseDocumentLoader

## Hierarchy

- [`CheerioWebBaseLoader`](../../document_loaders_web_cheerio/classes/CheerioWebBaseLoader.md)
- [`PuppeteerWebBaseLoader`](../../document_loaders_web_puppeteer/classes/PuppeteerWebBaseLoader.md)
- [`PlaywrightWebBaseLoader`](../../document_loaders_web_playwright/classes/PlaywrightWebBaseLoader.md)
- [`GithubRepoLoader`](../../document_loaders_web_github/classes/GithubRepoLoader.md)
- [`S3Loader`](../../document_loaders_web_s3/classes/S3Loader.md)
- [`DirectoryLoader`](../../document_loaders_fs_directory/classes/DirectoryLoader.md)
- [`BufferLoader`](../../document_loaders_fs_buffer/classes/BufferLoader.md)
- [`TextLoader`](../../document_loaders_fs_text/classes/TextLoader.md)
- [`EPubLoader`](../../document_loaders_fs_epub/classes/EPubLoader.md)
- [`UnstructuredLoader`](../../document_loaders_fs_unstructured/classes/UnstructuredLoader.md)

## Implements

- [`DocumentLoader`](../interfaces/DocumentLoader.md)

## Constructors

### constructor()

> **new BaseDocumentLoader**(): [`BaseDocumentLoader`](BaseDocumentLoader.md)

#### Returns

[`BaseDocumentLoader`](BaseDocumentLoader.md)

## Methods

### load()

> `Abstract` **load**(): `Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Returns

`Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Implementation of

[DocumentLoader](../interfaces/DocumentLoader.md).[load](../interfaces/DocumentLoader.md#load)

#### Defined in

[langchain/src/document_loaders/base.ts:13](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/base.ts#L13)

### loadAndSplit()

> **loadAndSplit**(`splitter`: [`TextSplitter`](../../text_splitter/classes/TextSplitter.md) = `...`): `Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Parameters

| Parameter  | Type                                                          |
| :--------- | :------------------------------------------------------------ |
| `splitter` | [`TextSplitter`](../../text_splitter/classes/TextSplitter.md) |

#### Returns

`Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Implementation of

[DocumentLoader](../interfaces/DocumentLoader.md).[loadAndSplit](../interfaces/DocumentLoader.md#loadandsplit)

#### Defined in

[langchain/src/document_loaders/base.ts:15](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/base.ts#L15)
