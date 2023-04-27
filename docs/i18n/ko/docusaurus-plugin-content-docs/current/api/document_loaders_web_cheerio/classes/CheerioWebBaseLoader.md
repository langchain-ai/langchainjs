---
title: "CheerioWebBaseLoader"
---

# CheerioWebBaseLoader

## Hierarchy

- [`BaseDocumentLoader`](../../document_loaders_base/classes/BaseDocumentLoader.md).**CheerioWebBaseLoader**

## Implements

- [`DocumentLoader`](../../document_loaders_base/interfaces/DocumentLoader.md)

## Constructors

### constructor()

> **new CheerioWebBaseLoader**(`webPath`: `string`, `fields`?: [`WebBaseLoaderParams`](../interfaces/WebBaseLoaderParams.md)): [`CheerioWebBaseLoader`](CheerioWebBaseLoader.md)

#### Parameters

| Parameter | Type                                                          |
| :-------- | :------------------------------------------------------------ |
| `webPath` | `string`                                                      |
| `fields?` | [`WebBaseLoaderParams`](../interfaces/WebBaseLoaderParams.md) |

#### Returns

[`CheerioWebBaseLoader`](CheerioWebBaseLoader.md)

#### Overrides

[BaseDocumentLoader](../../document_loaders_base/classes/BaseDocumentLoader.md).[constructor](../../document_loaders_base/classes/BaseDocumentLoader.md#constructor)

#### Defined in

[langchain/src/document_loaders/web/cheerio.ts:30](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/web/cheerio.ts#L30)

## Properties

### caller

> **caller**: `AsyncCaller`

#### Defined in

[langchain/src/document_loaders/web/cheerio.ts:26](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/web/cheerio.ts#L26)

### timeout

> **timeout**: `number`

#### Defined in

[langchain/src/document_loaders/web/cheerio.ts:24](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/web/cheerio.ts#L24)

### webPath

> **webPath**: `string`

#### Defined in

[langchain/src/document_loaders/web/cheerio.ts:30](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/web/cheerio.ts#L30)

### selector?

> **selector**: `SelectorType`

#### Defined in

[langchain/src/document_loaders/web/cheerio.ts:28](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/web/cheerio.ts#L28)

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

[langchain/src/document_loaders/web/cheerio.ts:59](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/web/cheerio.ts#L59)

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

> **scrape**(): `Promise`<`CheerioAPI`\>

#### Returns

`Promise`<`CheerioAPI`\>

#### Defined in

[langchain/src/document_loaders/web/cheerio.ts:51](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/web/cheerio.ts#L51)

### \_scrape()

> `Static` **\_scrape**(`url`: `string`, `caller`: `AsyncCaller`, `timeout`: `undefined` \| `number`): `Promise`<`CheerioAPI`\>

#### Parameters

| Parameter | Type                    |
| :-------- | :---------------------- |
| `url`     | `string`                |
| `caller`  | `AsyncCaller`           |
| `timeout` | `undefined` \| `number` |

#### Returns

`Promise`<`CheerioAPI`\>

#### Defined in

[langchain/src/document_loaders/web/cheerio.ts:38](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/web/cheerio.ts#L38)

### imports()

> `Static` **imports**(): `Promise`<\{`load`: (`content`: `string` \| `Buffer` \| `AnyNode` \| `AnyNode`[], `options?`: null \| `CheerioOptions`, `isDocument?`: `boolean`) => `CheerioAPI`;}\>

#### Returns

`Promise`<\{`load`: (`content`: `string` \| `Buffer` \| `AnyNode` \| `AnyNode`[], `options?`: null \| `CheerioOptions`, `isDocument?`: `boolean`) => `CheerioAPI`;}\>

#### Defined in

[langchain/src/document_loaders/web/cheerio.ts:66](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/web/cheerio.ts#L66)
