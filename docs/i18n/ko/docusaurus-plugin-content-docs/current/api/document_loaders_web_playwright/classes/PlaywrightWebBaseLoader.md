---
title: "PlaywrightWebBaseLoader"
---

# PlaywrightWebBaseLoader

## Hierarchy

- [`BaseDocumentLoader`](../../document_loaders_base/classes/BaseDocumentLoader.md).**PlaywrightWebBaseLoader**

## Implements

- [`DocumentLoader`](../../document_loaders_base/interfaces/DocumentLoader.md)

## Constructors

### constructor()

> **new PlaywrightWebBaseLoader**(`webPath`: `string`, `options`?: [`PlaywrightWebBaseLoaderOptions`](../types/PlaywrightWebBaseLoaderOptions.md)): [`PlaywrightWebBaseLoader`](PlaywrightWebBaseLoader.md)

#### Parameters

| Parameter  | Type                                                                           |
| :--------- | :----------------------------------------------------------------------------- |
| `webPath`  | `string`                                                                       |
| `options?` | [`PlaywrightWebBaseLoaderOptions`](../types/PlaywrightWebBaseLoaderOptions.md) |

#### Returns

[`PlaywrightWebBaseLoader`](PlaywrightWebBaseLoader.md)

#### Overrides

[BaseDocumentLoader](../../document_loaders_base/classes/BaseDocumentLoader.md).[constructor](../../document_loaders_base/classes/BaseDocumentLoader.md#constructor)

#### Defined in

[langchain/src/document_loaders/web/playwright.ts:32](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/web/playwright.ts#L32)

## Properties

### options

> **options**: `undefined` \| [`PlaywrightWebBaseLoaderOptions`](../types/PlaywrightWebBaseLoaderOptions.md)

#### Defined in

[langchain/src/document_loaders/web/playwright.ts:30](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/web/playwright.ts#L30)

### webPath

> **webPath**: `string`

#### Defined in

[langchain/src/document_loaders/web/playwright.ts:33](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/web/playwright.ts#L33)

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

[langchain/src/document_loaders/web/playwright.ts:70](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/web/playwright.ts#L70)

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

[langchain/src/document_loaders/web/playwright.ts:66](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/web/playwright.ts#L66)

### \_scrape()

> `Static` **\_scrape**(`url`: `string`, `options`?: [`PlaywrightWebBaseLoaderOptions`](../types/PlaywrightWebBaseLoaderOptions.md)): `Promise`<`string`\>

#### Parameters

| Parameter  | Type                                                                           |
| :--------- | :----------------------------------------------------------------------------- |
| `url`      | `string`                                                                       |
| `options?` | [`PlaywrightWebBaseLoaderOptions`](../types/PlaywrightWebBaseLoaderOptions.md) |

#### Returns

`Promise`<`string`\>

#### Defined in

[langchain/src/document_loaders/web/playwright.ts:40](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/web/playwright.ts#L40)

### imports()

> `Static` **imports**(): `Promise`<\{`chromium`: `BrowserType`<\{}\>;}\>

#### Returns

`Promise`<\{`chromium`: `BrowserType`<\{}\>;}\>

#### Defined in

[langchain/src/document_loaders/web/playwright.ts:77](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/web/playwright.ts#L77)
