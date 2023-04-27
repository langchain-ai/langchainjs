---
title: "GithubRepoLoader"
---

# GithubRepoLoader

## Hierarchy

- [`BaseDocumentLoader`](../../document_loaders_base/classes/BaseDocumentLoader.md).**GithubRepoLoader**

## Implements

- [`GithubRepoLoaderParams`](../interfaces/GithubRepoLoaderParams.md)

## Constructors

### constructor()

> **new GithubRepoLoader**(`githubUrl`: `string`, «destructured»: [`GithubRepoLoaderParams`](../interfaces/GithubRepoLoaderParams.md) = `{}`): [`GithubRepoLoader`](GithubRepoLoader.md)

#### Parameters

| Parameter        | Type                                                                |
| :--------------- | :------------------------------------------------------------------ |
| `githubUrl`      | `string`                                                            |
| `«destructured»` | [`GithubRepoLoaderParams`](../interfaces/GithubRepoLoaderParams.md) |

#### Returns

[`GithubRepoLoader`](GithubRepoLoader.md)

#### Overrides

[BaseDocumentLoader](../../document_loaders_base/classes/BaseDocumentLoader.md).[constructor](../../document_loaders_base/classes/BaseDocumentLoader.md#constructor)

#### Defined in

[langchain/src/document_loaders/web/github.ts:60](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/web/github.ts#L60)

## Properties

### branch

> **branch**: `string`

#### Implementation of

[GithubRepoLoaderParams](../interfaces/GithubRepoLoaderParams.md).[branch](../interfaces/GithubRepoLoaderParams.md#branch)

#### Defined in

[langchain/src/document_loaders/web/github.ts:50](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/web/github.ts#L50)

### ignoreFiles

> **ignoreFiles**: (`string` \| `RegExp`)[]

#### Implementation of

[GithubRepoLoaderParams](../interfaces/GithubRepoLoaderParams.md).[ignoreFiles](../interfaces/GithubRepoLoaderParams.md#ignorefiles)

#### Defined in

[langchain/src/document_loaders/web/github.ts:58](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/web/github.ts#L58)

### recursive

> **recursive**: `boolean`

#### Implementation of

[GithubRepoLoaderParams](../interfaces/GithubRepoLoaderParams.md).[recursive](../interfaces/GithubRepoLoaderParams.md#recursive)

#### Defined in

[langchain/src/document_loaders/web/github.ts:52](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/web/github.ts#L52)

### unknown

> **unknown**: [`UnknownHandling`](../../document_loaders_fs_directory/variables/UnknownHandling.md)

#### Implementation of

[GithubRepoLoaderParams](../interfaces/GithubRepoLoaderParams.md).[unknown](../interfaces/GithubRepoLoaderParams.md#unknown)

#### Defined in

[langchain/src/document_loaders/web/github.ts:54](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/web/github.ts#L54)

### accessToken?

> **accessToken**: `string`

#### Implementation of

[GithubRepoLoaderParams](../interfaces/GithubRepoLoaderParams.md).[accessToken](../interfaces/GithubRepoLoaderParams.md#accesstoken)

#### Defined in

[langchain/src/document_loaders/web/github.ts:56](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/web/github.ts#L56)

## Methods

### load()

> **load**(): `Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Returns

`Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Overrides

[BaseDocumentLoader](../../document_loaders_base/classes/BaseDocumentLoader.md).[load](../../document_loaders_base/classes/BaseDocumentLoader.md#load)

#### Defined in

[langchain/src/document_loaders/web/github.ts:106](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/web/github.ts#L106)

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
