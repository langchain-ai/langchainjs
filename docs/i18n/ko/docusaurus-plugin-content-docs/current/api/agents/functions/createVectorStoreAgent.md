---
title: "createVectorStoreAgent()"
---

# createVectorStoreAgent()

> **createVectorStoreAgent**(`llm`: [`BaseLanguageModel`](../../base_language/classes/BaseLanguageModel.md), `toolkit`: [`VectorStoreToolkit`](../classes/VectorStoreToolkit.md), `args`?: [`ZeroShotCreatePromptArgs`](../interfaces/ZeroShotCreatePromptArgs.md)): [`AgentExecutor`](../classes/AgentExecutor.md)

## Parameters

| Parameter | Type                                                                    |
| :-------- | :---------------------------------------------------------------------- |
| `llm`     | [`BaseLanguageModel`](../../base_language/classes/BaseLanguageModel.md) |
| `toolkit` | [`VectorStoreToolkit`](../classes/VectorStoreToolkit.md)                |
| `args?`   | [`ZeroShotCreatePromptArgs`](../interfaces/ZeroShotCreatePromptArgs.md) |

## Returns

[`AgentExecutor`](../classes/AgentExecutor.md)

## Defined in

[langchain/src/agents/agent_toolkits/vectorstore/vectorstore.ts:63](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent_toolkits/vectorstore/vectorstore.ts#L63)
