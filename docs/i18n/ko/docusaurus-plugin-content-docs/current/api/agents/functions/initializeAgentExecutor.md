---
title: "initializeAgentExecutor()"
---

# initializeAgentExecutor()

## Deprecated

use initializeAgentExecutorWithOptions instead

> **initializeAgentExecutor**(`tools`: [`Tool`](../../tools/classes/Tool.md)[], `llm`: [`BaseLanguageModel`](../../base_language/classes/BaseLanguageModel.md), `_agentType`?: `AgentType`, `_verbose`?: `boolean`, `_callbackManager`?: [`CallbackManager`](../../callbacks/classes/CallbackManager.md)): `Promise`<[`AgentExecutor`](../classes/AgentExecutor.md)\>

## Parameters

| Parameter           | Type                                                                    |
| :------------------ | :---------------------------------------------------------------------- |
| `tools`             | [`Tool`](../../tools/classes/Tool.md)[]                                 |
| `llm`               | [`BaseLanguageModel`](../../base_language/classes/BaseLanguageModel.md) |
| `_agentType?`       | `AgentType`                                                             |
| `_verbose?`         | `boolean`                                                               |
| `_callbackManager?` | [`CallbackManager`](../../callbacks/classes/CallbackManager.md)         |

## Returns

`Promise`<[`AgentExecutor`](../classes/AgentExecutor.md)\>

## Defined in

[langchain/src/agents/initialize.ts:18](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/initialize.ts#L18)
