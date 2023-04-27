---
title: "PuppeteerWebBaseLoader"
---

# PuppeteerWebBaseLoader

## Hierarchy

- [`BaseDocumentLoader`](../../document_loaders_base/classes/BaseDocumentLoader.md).**PuppeteerWebBaseLoader**

## Implements

- [`DocumentLoader`](../../document_loaders_base/interfaces/DocumentLoader.md)

## Constructors

### constructor()

> **new PuppeteerWebBaseLoader**(`webPath`: `string`, `options`?: [`PuppeteerWebBaseLoaderOptions`](../types/PuppeteerWebBaseLoaderOptions.md)): [`PuppeteerWebBaseLoader`](PuppeteerWebBaseLoader.md)

#### Parameters

| Parameter  | Type                                                                         |
| :--------- | :--------------------------------------------------------------------------- |
| `webPath`  | `string`                                                                     |
| `options?` | [`PuppeteerWebBaseLoaderOptions`](../types/PuppeteerWebBaseLoaderOptions.md) |

#### Returns

[`PuppeteerWebBaseLoader`](PuppeteerWebBaseLoader.md)

#### Overrides

[BaseDocumentLoader](../../document_loaders_base/classes/BaseDocumentLoader.md).[constructor](../../document_loaders_base/classes/BaseDocumentLoader.md#constructor)

#### Defined in

[langchain/src/document_loaders/web/puppeteer.ts:37](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/web/puppeteer.ts#L37)

## Properties

### options

> **options**: `undefined` \| [`PuppeteerWebBaseLoaderOptions`](../types/PuppeteerWebBaseLoaderOptions.md)

#### Defined in

[langchain/src/document_loaders/web/puppeteer.ts:35](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/web/puppeteer.ts#L35)

### webPath

> **webPath**: `string`

#### Defined in

[langchain/src/document_loaders/web/puppeteer.ts:37](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/web/puppeteer.ts#L37)

## Methods

### load()

> **load**(): `Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Returns

`Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Implementation of

[DocumentLoader](../../document_loaders_base/interfaces/DocumentLoader.md).[load](../../document_loaders_base/interfaces/DocumentLoader.md#load)

#### Overrides

[BaseDocumentLoader](../../document_loaders_base/classes/BaseDocumentLoader.md).[load](../../document_loaders_base/classes/BaseDocumentLoader.md#load)

#### Defined in

[langchain/src/document_loaders/web/puppeteer.ts:74](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/web/puppeteer.ts#L74)

### loadAndSplit()

> **loadAndSplit**(`splitter`: [`TextSplitter`](../../text_splitter/classes/TextSplitter.md) = `...`): `Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Parameters

| Parameter  | Type                                                          |
| :--------- | :------------------------------------------------------------ |
| `splitter` | [`TextSplitter`](../../text_splitter/classes/TextSplitter.md) |

#### Returns

`Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Implementation of

[DocumentLoader](../../document_loaders_base/interfaces/DocumentLoader.md).[loadAndSplit](../../document_loaders_base/interfaces/DocumentLoader.md#loadandsplit)

#### Inherited from

[BaseDocumentLoader](../../document_loaders_base/classes/BaseDocumentLoader.md).[loadAndSplit](../../document_loaders_base/classes/BaseDocumentLoader.md#loadandsplit)

#### Defined in

[langchain/src/document_loaders/base.ts:15](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/base.ts#L15)

### scrape()

> **scrape**(): `Promise`<`string`\>

#### Returns

`Promise`<`string`\>

#### Defined in

[langchain/src/document_loaders/web/puppeteer.ts:70](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/web/puppeteer.ts#L70)

### \_scrape()

> `Static` **\_scrape**(`url`: `string`, `options`?: [`PuppeteerWebBaseLoaderOptions`](../types/PuppeteerWebBaseLoaderOptions.md)): `Promise`<`string`\>

#### Parameters

| Parameter  | Type                                                                         |
| :--------- | :--------------------------------------------------------------------------- |
| `url`      | `string`                                                                     |
| `options?` | [`PuppeteerWebBaseLoaderOptions`](../types/PuppeteerWebBaseLoaderOptions.md) |

#### Returns

`Promise`<`string`\>

#### Defined in

[langchain/src/document_loaders/web/puppeteer.ts:42](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/web/puppeteer.ts#L42)

### imports()

> `Static` **imports**(): `Promise`<\{`launch`: (`options?`: `PuppeteerLaunchOptions`) => `Promise`<`Browser`\>;}\>

#### Returns

`Promise`<\{`launch`: (`options?`: `PuppeteerLaunchOptions`) => `Promise`<`Browser`\>;}\>

#### Defined in

[langchain/src/document_loaders/web/puppeteer.ts:81](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/web/puppeteer.ts#L81)
