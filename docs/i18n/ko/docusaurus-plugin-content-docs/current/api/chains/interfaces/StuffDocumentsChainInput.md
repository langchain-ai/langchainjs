---
title: "StuffDocumentsChainInput"
---

# StuffDocumentsChainInput

## Hierarchy

- [`MapReduceDocumentsChainInput`](MapReduceDocumentsChainInput.md)
- [`RefineDocumentsChainInput`](RefineDocumentsChainInput.md)

## Properties

### llmChain

> **llmChain**: [`LLMChain`](../classes/LLMChain.md)

LLM Wrapper to use after formatting documents

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:18](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L18)

### documentVariableName?

> **documentVariableName**: `string`

Variable name in the LLM chain to put the documents in

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:21](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L21)

### inputKey?

> **inputKey**: `string`

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:19](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L19)
