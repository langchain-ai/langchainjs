---
title: "initializeAgentExecutorWithOptions()"
---

# initializeAgentExecutorWithOptions()

Initialize an agent executor with options

> **initializeAgentExecutorWithOptions**(`tools`: [`Tool`](../../tools/classes/Tool.md)[], `llm`: [`BaseLanguageModel`](../../base_language/classes/BaseLanguageModel.md), `options`: [`InitializeAgentExecutorOptions`](../interfaces/InitializeAgentExecutorOptions.md) = `...`): `Promise`<[`AgentExecutor`](../classes/AgentExecutor.md)\>

## Parameters

| Parameter | Type                                                                                | Description                                                                                                  |
| :-------- | :---------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------- |
| `tools`   | [`Tool`](../../tools/classes/Tool.md)[]                                             | Array of tools to use in the agent                                                                           |
| `llm`     | [`BaseLanguageModel`](../../base_language/classes/BaseLanguageModel.md)             | LLM or ChatModel to use in the agent                                                                         |
| `options` | [`InitializeAgentExecutorOptions`](../interfaces/InitializeAgentExecutorOptions.md) | Options for the agent, including agentType, agentArgs, and other options for AgentExecutor.fromAgentAndTools |

## Returns

`Promise`<[`AgentExecutor`](../classes/AgentExecutor.md)\>

AgentExecutor

## Defined in

[langchain/src/agents/initialize.ts:83](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/initialize.ts#L83)
