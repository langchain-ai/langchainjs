---
title: "MapReduceDocumentsChainInput"
---

# MapReduceDocumentsChainInput

## Hierarchy

- [`StuffDocumentsChainInput`](StuffDocumentsChainInput.md).**MapReduceDocumentsChainInput**

## Properties

### combineDocumentChain

> **combineDocumentChain**: [`BaseChain`](../classes/BaseChain.md)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:102](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L102)

### llmChain

> **llmChain**: [`LLMChain`](../classes/LLMChain.md)

LLM Wrapper to use after formatting documents

#### Inherited from

[StuffDocumentsChainInput](StuffDocumentsChainInput.md).[llmChain](StuffDocumentsChainInput.md#llmchain)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:18](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L18)

### documentVariableName?

> **documentVariableName**: `string`

Variable name in the LLM chain to put the documents in

#### Inherited from

[StuffDocumentsChainInput](StuffDocumentsChainInput.md).[documentVariableName](StuffDocumentsChainInput.md#documentvariablename)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:21](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L21)

### ensureMapStep?

> **ensureMapStep**: `boolean`

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:101](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L101)

### inputKey?

> **inputKey**: `string`

#### Inherited from

[StuffDocumentsChainInput](StuffDocumentsChainInput.md).[inputKey](StuffDocumentsChainInput.md#inputkey)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:19](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L19)

### maxIterations?

> **maxIterations**: `number`

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:100](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L100)

### maxTokens?

> **maxTokens**: `number`

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:99](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L99)
