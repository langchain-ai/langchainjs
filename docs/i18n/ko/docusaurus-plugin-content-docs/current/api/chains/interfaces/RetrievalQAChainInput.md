---
title: "RetrievalQAChainInput"
---

# RetrievalQAChainInput

## Hierarchy

- `Omit`<[`ChainInputs`](ChainInputs.md), "memory"\>.**RetrievalQAChainInput**

## Properties

### combineDocumentsChain

> **combineDocumentsChain**: [`BaseChain`](../classes/BaseChain.md)

#### Defined in

[langchain/src/chains/retrieval_qa.ts:13](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/retrieval_qa.ts#L13)

### retriever

> **retriever**: [`BaseRetriever`](../../schema/classes/BaseRetriever.md)

#### Defined in

[langchain/src/chains/retrieval_qa.ts:12](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/retrieval_qa.ts#L12)

### callbackManager?

> **callbackManager**: [`CallbackManager`](../../callbacks/classes/CallbackManager.md)

#### Deprecated

Use `callbacks` instead

#### Inherited from

Omit.callbackManager

#### Defined in

[langchain/src/chains/base.ts:20](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L20)

### callbacks?

> **callbacks**: [`Callbacks`](../../callbacks/types/Callbacks.md)

#### Inherited from

Omit.callbacks

#### Defined in

[langchain/src/base_language/index.ts:17](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L17)

### inputKey?

> **inputKey**: `string`

#### Defined in

[langchain/src/chains/retrieval_qa.ts:14](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/retrieval_qa.ts#L14)

### returnSourceDocuments?

> **returnSourceDocuments**: `boolean`

#### Defined in

[langchain/src/chains/retrieval_qa.ts:15](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/retrieval_qa.ts#L15)

### verbose?

> **verbose**: `boolean`

#### Inherited from

Omit.verbose

#### Defined in

[langchain/src/base_language/index.ts:16](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L16)
