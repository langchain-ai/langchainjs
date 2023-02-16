---
id: "chains"
title: "Module: chains"
sidebar_label: "chains"
sidebar_position: 0
custom_edit_url: null
---

## Modules

- [internal](chains.internal.md)

## Classes

- [BaseChain](../classes/chains.BaseChain.md)
- [StuffDocumentsChain](../classes/chains.StuffDocumentsChain.md)

## References

### LLMChain

Re-exports [LLMChain](../classes/.LLMChain)

## Type Aliases

### ChainValues

Ƭ **ChainValues**: `Record`<`string`, `any`\>

#### Defined in

[chains/base.ts:3](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/chains/base.ts#L3)

___

### SerializedLLMChain

Ƭ **SerializedLLMChain**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `_type` | ``"llm_chain"`` |
| `llm?` | [`SerializedLLM`](llms.md#serializedllm) |
| `llm_path?` | `string` |
| `prompt?` | [`SerializedBasePromptTemplate`](prompt.md#serializedbaseprompttemplate) |
| `prompt_path?` | `string` |

#### Defined in

[chains/llm_chain.ts:18](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/chains/llm_chain.ts#L18)

___

### SerializedStuffDocumentsChain

Ƭ **SerializedStuffDocumentsChain**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `_type` | ``"stuff_documents_chain"`` |
| `llm_chain?` | [`SerializedLLMChain`](chains.md#serializedllmchain) |
| `llm_chain_path?` | `string` |

#### Defined in

[chains/combine_docs_chain.ts:16](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/chains/combine_docs_chain.ts#L16)

## Functions

### loadChain

▸ **loadChain**(`uri`): `Promise`<[`BaseChain`](../classes/chains.BaseChain.md)\>

Load a chain from [LangchainHub](https://github.com/hwchase17/langchain-hub) or local filesystem.

**`Example`**

Loading from LangchainHub:
```ts
import { loadChain } from "langchain/chains";
const chain = await loadChain("lc://chains/hello-world/chain.json");
const res = await chain.call({ topic: "my favorite color" });
```

**`Example`**

Loading from local filesystem:
```ts
import { loadChain } from "langchain/chains";
const chain = await loadChain("/path/to/chain.json");
```

#### Parameters

| Name | Type |
| :------ | :------ |
| `uri` | `string` |

#### Returns

`Promise`<[`BaseChain`](../classes/chains.BaseChain.md)\>

#### Defined in

[chains/load.ts:28](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/chains/load.ts#L28)

___

### loadQAChain

▸ **loadQAChain**(`llm`): [`StuffDocumentsChain`](../classes/chains.StuffDocumentsChain.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `llm` | [`BaseLLM`](../classes/llms.BaseLLM.md) |

#### Returns

[`StuffDocumentsChain`](../classes/chains.StuffDocumentsChain.md)

#### Defined in

[chains/question_answering/load.ts:7](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/chains/question_answering/load.ts#L7)
