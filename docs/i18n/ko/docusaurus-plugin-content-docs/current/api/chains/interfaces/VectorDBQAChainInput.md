---
title: "VectorDBQAChainInput"
---

# VectorDBQAChainInput

## Hierarchy

- `Omit`<[`ChainInputs`](ChainInputs.md), "memory"\>.**VectorDBQAChainInput**

## Properties

### combineDocumentsChain

> **combineDocumentsChain**: [`BaseChain`](../classes/BaseChain.md)

#### Defined in

[langchain/src/chains/vector_db_qa.ts:14](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/vector_db_qa.ts#L14)

### vectorstore

> **vectorstore**: [`VectorStore`](../../vectorstores_base/classes/VectorStore.md)

#### Defined in

[langchain/src/chains/vector_db_qa.ts:13](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/vector_db_qa.ts#L13)

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

[langchain/src/chains/vector_db_qa.ts:17](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/vector_db_qa.ts#L17)

### k?

> **k**: `number`

#### Defined in

[langchain/src/chains/vector_db_qa.ts:16](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/vector_db_qa.ts#L16)

### returnSourceDocuments?

> **returnSourceDocuments**: `boolean`

#### Defined in

[langchain/src/chains/vector_db_qa.ts:15](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/vector_db_qa.ts#L15)

### verbose?

> **verbose**: `boolean`

#### Inherited from

Omit.verbose

#### Defined in

[langchain/src/base_language/index.ts:16](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L16)
