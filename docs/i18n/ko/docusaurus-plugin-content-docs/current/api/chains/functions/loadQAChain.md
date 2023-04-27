---
title: "loadQAChain()"
---

# loadQAChain()

> **loadQAChain**(`llm`: [`BaseLanguageModel`](../../base_language/classes/BaseLanguageModel.md), `params`: `qaChainParams` = `{}`): [`StuffDocumentsChain`](../classes/StuffDocumentsChain.md) \| [`MapReduceDocumentsChain`](../classes/MapReduceDocumentsChain.md) \| [`RefineDocumentsChain`](../classes/RefineDocumentsChain.md)

## Parameters

| Parameter | Type                                                                    |
| :-------- | :---------------------------------------------------------------------- |
| `llm`     | [`BaseLanguageModel`](../../base_language/classes/BaseLanguageModel.md) |
| `params`  | `qaChainParams`                                                         |

## Returns

[`StuffDocumentsChain`](../classes/StuffDocumentsChain.md) \| [`MapReduceDocumentsChain`](../classes/MapReduceDocumentsChain.md) \| [`RefineDocumentsChain`](../classes/RefineDocumentsChain.md)

## Defined in

[langchain/src/chains/question_answering/load.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/question_answering/load.ts#L29)
