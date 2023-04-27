---
title: "DocumentLoader"
---

# DocumentLoader

## Methods

### load()

> **load**(): `Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Returns

`Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Defined in

[langchain/src/document_loaders/base.ts:8](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/base.ts#L8)

### loadAndSplit()

> **loadAndSplit**(`textSplitter`?: [`TextSplitter`](../../text_splitter/classes/TextSplitter.md)): `Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Parameters

| Parameter       | Type                                                          |
| :-------------- | :------------------------------------------------------------ |
| `textSplitter?` | [`TextSplitter`](../../text_splitter/classes/TextSplitter.md) |

#### Returns

`Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Defined in

[langchain/src/document_loaders/base.ts:9](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/base.ts#L9)
