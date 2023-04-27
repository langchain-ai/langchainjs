---
title: "ConversationalRetrievalQAChainInput"
---

# ConversationalRetrievalQAChainInput

## Hierarchy

- `Omit`<[`ChainInputs`](ChainInputs.md), "memory"\>.**ConversationalRetrievalQAChainInput**

## Properties

### combineDocumentsChain

> **combineDocumentsChain**: [`BaseChain`](../classes/BaseChain.md)

#### Defined in

[langchain/src/chains/conversational_retrieval_chain.ts:30](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/conversational_retrieval_chain.ts#L30)

### questionGeneratorChain

> **questionGeneratorChain**: [`LLMChain`](../classes/LLMChain.md)

#### Defined in

[langchain/src/chains/conversational_retrieval_chain.ts:31](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/conversational_retrieval_chain.ts#L31)

### retriever

> **retriever**: [`BaseRetriever`](../../schema/classes/BaseRetriever.md)

#### Defined in

[langchain/src/chains/conversational_retrieval_chain.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/conversational_retrieval_chain.ts#L29)

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

[langchain/src/chains/conversational_retrieval_chain.ts:33](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/conversational_retrieval_chain.ts#L33)

### returnSourceDocuments?

> **returnSourceDocuments**: `boolean`

#### Defined in

[langchain/src/chains/conversational_retrieval_chain.ts:32](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/conversational_retrieval_chain.ts#L32)

### verbose?

> **verbose**: `boolean`

#### Inherited from

Omit.verbose

#### Defined in

[langchain/src/base_language/index.ts:16](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L16)
