---
title: "GitbookLoader"
---

# GitbookLoader

## Hierarchy

- [`CheerioWebBaseLoader`](../../document_loaders_web_cheerio/classes/CheerioWebBaseLoader.md).**GitbookLoader**

## Constructors

### constructor()

> **new GitbookLoader**(`webPath`: `string`, `params`: `GitbookLoaderParams` = `{}`): [`GitbookLoader`](GitbookLoader.md)

#### Parameters

| Parameter | Type                  |
| :-------- | :-------------------- |
| `webPath` | `string`              |
| `params`  | `GitbookLoaderParams` |

#### Returns

[`GitbookLoader`](GitbookLoader.md)

#### Overrides

[CheerioWebBaseLoader](../../document_loaders_web_cheerio/classes/CheerioWebBaseLoader.md).[constructor](../../document_loaders_web_cheerio/classes/CheerioWebBaseLoader.md#constructor)

#### Defined in

[langchain/src/document_loaders/web/gitbook.ts:12](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/web/gitbook.ts#L12)

## Properties

### caller

> **caller**: `AsyncCaller`

#### Inherited from

[CheerioWebBaseLoader](../../document_loaders_web_cheerio/classes/CheerioWebBaseLoader.md).[caller](../../document_loaders_web_cheerio/classes/CheerioWebBaseLoader.md#caller)

#### Defined in

[langchain/src/document_loaders/web/cheerio.ts:26](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/web/cheerio.ts#L26)

### shouldLoadAllPaths

> **shouldLoadAllPaths**: `boolean` = `false`

#### Defined in

[langchain/src/document_loaders/web/gitbook.ts:10](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/web/gitbook.ts#L10)

### timeout

> **timeout**: `number`

#### Inherited from

[CheerioWebBaseLoader](../../document_loaders_web_cheerio/classes/CheerioWebBaseLoader.md).[timeout](../../document_loaders_web_cheerio/classes/CheerioWebBaseLoader.md#timeout)

#### Defined in

[langchain/src/document_loaders/web/cheerio.ts:24](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/web/cheerio.ts#L24)

### webPath

> **webPath**: `string`

#### Inherited from

[CheerioWebBaseLoader](../../document_loaders_web_cheerio/classes/CheerioWebBaseLoader.md).[webPath](../../document_loaders_web_cheerio/classes/CheerioWebBaseLoader.md#webpath)

#### Defined in

[langchain/src/document_loaders/web/gitbook.ts:12](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/web/gitbook.ts#L12)

### selector?

> **selector**: `SelectorType`

#### Inherited from

[CheerioWebBaseLoader](../../document_loaders_web_cheerio/classes/CheerioWebBaseLoader.md).[selector](../../document_loaders_web_cheerio/classes/CheerioWebBaseLoader.md#selector)

#### Defined in

[langchain/src/document_loaders/web/cheerio.ts:28](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/web/cheerio.ts#L28)

## Methods

### load()

> **load**(): `Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Returns

`Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Overrides

[CheerioWebBaseLoader](../../document_loaders_web_cheerio/classes/CheerioWebBaseLoader.md).[load](../../document_loaders_web_cheerio/classes/CheerioWebBaseLoader.md#load)

#### Defined in

[langchain/src/document_loaders/web/gitbook.ts:18](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/web/gitbook.ts#L18)

### loadAndSplit()

> **loadAndSplit**(`splitter`: [`TextSplitter`](../../text_splitter/classes/TextSplitter.md) = `...`): `Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Parameters

| Parameter  | Type                                                          |
| :--------- | :------------------------------------------------------------ |
| `splitter` | [`TextSplitter`](../../text_splitter/classes/TextSplitter.md) |

#### Returns

`Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Inherited from

[CheerioWebBaseLoader](../../document_loaders_web_cheerio/classes/CheerioWebBaseLoader.md).[loadAndSplit](../../document_loaders_web_cheerio/classes/CheerioWebBaseLoader.md#loadandsplit)

#### Defined in

[langchain/src/document_loaders/base.ts:15](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/base.ts#L15)

### scrape()

> **scrape**(): `Promise`<`CheerioAPI`\>

#### Returns

`Promise`<`CheerioAPI`\>

#### Inherited from

[CheerioWebBaseLoader](../../document_loaders_web_cheerio/classes/CheerioWebBaseLoader.md).[scrape](../../document_loaders_web_cheerio/classes/CheerioWebBaseLoader.md#scrape)

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

#### Inherited from

[CheerioWebBaseLoader](../../document_loaders_web_cheerio/classes/CheerioWebBaseLoader.md).[\_scrape](../../document_loaders_web_cheerio/classes/CheerioWebBaseLoader.md#_scrape)

#### Defined in

[langchain/src/document_loaders/web/cheerio.ts:38](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/web/cheerio.ts#L38)

### imports()

> `Static` **imports**(): `Promise`<\{`load`: (`content`: `string` \| `Buffer` \| `AnyNode` \| `AnyNode`[], `options?`: null \| `CheerioOptions`, `isDocument?`: `boolean`) => `CheerioAPI`;}\>

#### Returns

`Promise`<\{`load`: (`content`: `string` \| `Buffer` \| `AnyNode` \| `AnyNode`[], `options?`: null \| `CheerioOptions`, `isDocument?`: `boolean`) => `CheerioAPI`;}\>

#### Inherited from

[CheerioWebBaseLoader](../../document_loaders_web_cheerio/classes/CheerioWebBaseLoader.md).[imports](../../document_loaders_web_cheerio/classes/CheerioWebBaseLoader.md#imports)

#### Defined in

[langchain/src/document_loaders/web/cheerio.ts:66](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/web/cheerio.ts#L66)
