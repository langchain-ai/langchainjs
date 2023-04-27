---
title: "RefineDocumentsChainInput"
---

# RefineDocumentsChainInput

## Hierarchy

- [`StuffDocumentsChainInput`](StuffDocumentsChainInput.md).**RefineDocumentsChainInput**

## Properties

### llmChain

> **llmChain**: [`LLMChain`](../classes/LLMChain.md)

LLM Wrapper to use after formatting documents

#### Inherited from

[StuffDocumentsChainInput](StuffDocumentsChainInput.md).[llmChain](StuffDocumentsChainInput.md#llmchain)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:18](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L18)

### refineLLMChain

> **refineLLMChain**: [`LLMChain`](../classes/LLMChain.md)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:229](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L229)

### documentPrompt?

> **documentPrompt**: [`BasePromptTemplate`](../../prompts/classes/BasePromptTemplate.md)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:230](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L230)

### documentVariableName?

> **documentVariableName**: `string`

Variable name in the LLM chain to put the documents in

#### Overrides

[StuffDocumentsChainInput](StuffDocumentsChainInput.md).[documentVariableName](StuffDocumentsChainInput.md#documentvariablename)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:232](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L232)

### initialResponseName?

> **initialResponseName**: `string`

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:231](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L231)

### inputKey?

> **inputKey**: `string`

#### Inherited from

[StuffDocumentsChainInput](StuffDocumentsChainInput.md).[inputKey](StuffDocumentsChainInput.md#inputkey)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:19](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L19)

### outputKey?

> **outputKey**: `string`

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:233](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L233)
