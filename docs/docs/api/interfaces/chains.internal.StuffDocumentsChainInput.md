---
id: "chains.internal.StuffDocumentsChainInput"
title: "Interface: StuffDocumentsChainInput"
sidebar_label: "StuffDocumentsChainInput"
custom_edit_url: null
---

[chains](../modules/chains.md).[internal](../modules/chains.internal.md).StuffDocumentsChainInput

## Implemented by

- [`StuffDocumentsChain`](../classes/chains.StuffDocumentsChain.md)

## Properties

### documentVariableName

• **documentVariableName**: `string`

Variable name in the LLM chain to put the documents in

#### Defined in

[chains/combine_docs_chain.ts:13](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/chains/combine_docs_chain.ts#L13)

___

### inputKey

• **inputKey**: `string`

#### Defined in

[chains/combine_docs_chain.ts:10](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/chains/combine_docs_chain.ts#L10)

___

### llmChain

• **llmChain**: [`LLMChain`](../classes/.LLMChain)

LLM Wrapper to use after formatting documents

#### Defined in

[chains/combine_docs_chain.ts:9](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/chains/combine_docs_chain.ts#L9)

___

### outputKey

• **outputKey**: `string`

#### Defined in

[chains/combine_docs_chain.ts:11](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/chains/combine_docs_chain.ts#L11)
